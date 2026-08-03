import type {
  Program,
  ProgramState,
  ProgressionEvent,
  Scheme,
  SessionExercise,
  WorkoutSession,
} from '../types'
import { epley1RM, roundToIncrement } from './e1rm'
import { detectPrs } from './stats'
import { slotKey } from './resolve'

/**
 * The feedback half of the engine: given a finished session, produce the next
 * ProgramState and the named events that happened. Pure — persistence is the
 * caller's job.
 */

interface SlotOutcome {
  scheme: Scheme
  exercise: SessionExercise
}

function collectSlotOutcomes(program: Program, session: WorkoutSession): SlotOutcome[] {
  const week = program.weeks.find((w) => w.week === session.week)
  const day = week?.days.find((d) => d.day === session.day)
  if (!day) return []
  const out: SlotOutcome[] = []
  for (const slot of day.slots) {
    const ex = session.exercises.find((e) => e.slotId === slot.id)
    if (!ex) continue
    // A swapped (golf-alternate) exercise doesn't drive the original slot's progression.
    const swapped = ex.exerciseId !== slot.exerciseId
    if (swapped) continue
    out.push({ scheme: slot.scheme, exercise: ex })
  }
  return out
}

function workingResults(ex: SessionExercise): Array<{ weightLbs: number; reps: number }> {
  return ex.sets
    .filter((s) => s.setType !== 'warmup')
    .map((s) => ({ weightLbs: s.weightLbs ?? 0, reps: s.reps ?? 0 }))
}

/** Did every prescribed non-warmup set get at least its target reps? */
function metPrescription(ex: SessionExercise): boolean {
  const targets = ex.prescribed.filter((p) => p.setType !== 'warmup')
  const results = workingResults(ex)
  if (targets.length === 0 || results.length < targets.length) return false
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i].targetReps ?? 0
    if ((results[i]?.reps ?? 0) < target) return false
  }
  return true
}

/**
 * 5/3/1 wave bookkeeping: within a percentTM program, TMs bump when the lifter
 * completes the final training week of a wave (the week before a deload, or
 * the last non-deload week). We detect wave completion by weeks whose label
 * marks the end of a cycle via `bumpAfter` weeks in content — simpler and less
 * error-prone: content weeks carry `deload: true`, and the engine bumps TMs
 * when the lifter finishes the last day of the week IMMEDIATELY BEFORE a
 * deload week, plus at the anchor's final training week (week before tmTest
 * week 12). To keep the rule content-driven, a week may also set
 * `label: '...'`; the engine only relies on deload flags and week ordering.
 */
function isTmBumpWeek(program: Program, week: number): boolean {
  const idx = program.weeks.findIndex((w) => w.week === week)
  if (idx === -1) return false
  const current = program.weeks[idx]
  if (current.deload) return false
  const next = program.weeks[idx + 1]
  if (!next) return false
  const hasPercentTm = current.days.some((d) => d.slots.some((s) => s.scheme.kind === 'percentTM'))
  if (!hasPercentTm) return false
  const nextIsReset = next.deload === true || next.days.some((d) => d.slots.some((s) => s.scheme.kind === 'tmTest'))
  return nextIsReset
}

function isLastDayOfWeek(program: Program, week: number, day: number, completed: ProgramState['completedDays']): boolean {
  const w = program.weeks.find((x) => x.week === week)
  if (!w) return false
  const doneThisWeek = new Set(completed.filter((c) => c.week === week).map((c) => c.day))
  doneThisWeek.add(day)
  return w.days.every((d) => doneThisWeek.has(d.day))
}

export function applySessionResult(
  program: Program,
  state: ProgramState,
  session: WorkoutSession,
  priorSessions: WorkoutSession[],
): { nextState: ProgramState; events: ProgressionEvent[] } {
  const events: ProgressionEvent[] = []
  const next: ProgramState = {
    ...state,
    trainingMaxes: { ...state.trainingMaxes },
    stageState: { ...state.stageState },
    dpLoads: { ...state.dpLoads },
    completedDays: [...state.completedDays],
  }

  const week = session.week ?? state.currentWeek
  const day = session.day ?? state.currentDay

  for (const { scheme, exercise } of collectSlotOutcomes(program, session)) {
    // A slot with nothing logged was skipped, not failed — it drives no progression.
    if (workingResults(exercise).length === 0) continue
    switch (scheme.kind) {
      case 'linearStages': {
        const st = next.stageState[scheme.liftKey]
        if (!st) break
        if (metPrescription(exercise)) {
          next.stageState[scheme.liftKey] = { ...st, loadLbs: st.loadLbs + scheme.incrementLbs }
        } else if (st.stageIndex < scheme.stages.length - 1) {
          next.stageState[scheme.liftKey] = { ...st, stageIndex: st.stageIndex + 1 }
          events.push({ type: 'stageAdvance', liftKey: scheme.liftKey, toStage: st.stageIndex + 1 })
        } else {
          // Last stage failed → reset: 90% of session-best e1RM, back to stage 0.
          let bestE1 = 0
          for (const r of workingResults(exercise)) {
            bestE1 = Math.max(bestE1, epley1RM(r.weightLbs, r.reps))
          }
          const newLoad = Math.max(roundToIncrement(0.9 * bestE1, 5), 45)
          next.stageState[scheme.liftKey] = { stageIndex: 0, loadLbs: newLoad }
          events.push({ type: 'stageReset', liftKey: scheme.liftKey, newLoadLbs: newLoad })
        }
        break
      }
      case 'doubleProgression': {
        const key = slotKey(program.id, exercise.slotId ?? '')
        const load = next.dpLoads[key] ?? scheme.startLbs
        const results = workingResults(exercise)
        const allAtTop =
          scheme.incrementLbs > 0 &&
          results.length >= scheme.sets &&
          results.slice(0, scheme.sets).every((r) => r.reps >= scheme.repMax)
        if (allAtTop) {
          next.dpLoads[key] = load + scheme.incrementLbs
          events.push({ type: 'dpBump', slotKey: key, toLbs: load + scheme.incrementLbs })
        } else if (next.dpLoads[key] === undefined) {
          // Remember the working load even without a bump so the slot is sticky.
          next.dpLoads[key] = load
        }
        break
      }
      case 'tmTest': {
        let bestE1 = 0
        for (const r of workingResults(exercise)) {
          bestE1 = Math.max(bestE1, epley1RM(r.weightLbs, r.reps))
        }
        if (bestE1 > 0) {
          const from = next.trainingMaxes[scheme.liftKey] ?? 0
          const proposed = roundToIncrement(0.9 * bestE1, 5)
          events.push({ type: 'tmProposal', liftKey: scheme.liftKey, fromLbs: from, toLbs: proposed })
        }
        break
      }
      case 'percentTM':
      case 'fixedSets':
      case 'amrapRpeCap':
      case 'timeDistance':
      case 'checklist':
        break
    }
  }

  // percentTM TM bumps at wave completion.
  if (isTmBumpWeek(program, week) && isLastDayOfWeek(program, week, day, state.completedDays)) {
    for (const lift of program.lifts) {
      const usesTm = program.weeks.some((w) =>
        w.days.some((d) => d.slots.some((s) => s.scheme.kind === 'percentTM' && s.scheme.liftKey === lift.key)),
      )
      if (!usesTm) continue
      const from = next.trainingMaxes[lift.key] ?? 0
      if (from <= 0) continue
      const to = from + lift.tmIncrementLbs
      next.trainingMaxes[lift.key] = to
      events.push({ type: 'tmBump', liftKey: lift.key, fromLbs: from, toLbs: to })
    }
    next.cycleCount = state.cycleCount + 1
  }

  // Advance the day/week pointer past completed days.
  next.completedDays.push({ week, day, sessionId: session.id })
  const done = new Set(next.completedDays.map((c) => `${c.week}:${c.day}`))
  let pointer: { week: number; day: number } | null = null
  outer: for (const w of program.weeks) {
    for (const d of w.days) {
      if (!done.has(`${w.week}:${d.day}`)) {
        pointer = { week: w.week, day: d.day }
        break outer
      }
    }
  }
  if (pointer) {
    next.currentWeek = pointer.week
    next.currentDay = pointer.day
  } else {
    next.status = 'completed'
  }

  // PRs (skipped on deload weeks — light work isn't a record attempt).
  const wk = program.weeks.find((w) => w.week === week)
  if (!wk?.deload) {
    events.push(...detectPrs(session, priorSessions))
  }

  return { nextState: next, events }
}
