import type {
  PrescribedExercise,
  PrescribedSession,
  Program,
  ProgramState,
  Scheme,
  SetEntry,
  Slot,
  WorkoutSession,
} from '../types'
import type { Profile } from '../../../platform/types'
import { roundToIncrement } from './e1rm'
import { getGhosts, lastWorkingWeight } from './stats'

export function slotKey(programId: string, slotId: string): string {
  return `${programId}:${slotId}`
}

/** Resolve a scheme + state into concrete prescribed sets. */
export function resolveScheme(
  scheme: Scheme,
  state: ProgramState,
  programId: string,
  slotId: string,
  sessions: WorkoutSession[],
  exerciseId: string,
): { prescribed: SetEntry[]; checklist?: string[] } {
  switch (scheme.kind) {
    case 'percentTM': {
      const tm = state.trainingMaxes[scheme.liftKey] ?? 0
      const round = scheme.roundLbs ?? 5
      return {
        prescribed: scheme.sets.map((s) => ({
          setType: s.amrap ? 'amrap' : 'working',
          targetWeightLbs: roundToIncrement(tm * s.pct, round),
          targetReps: s.reps,
          amrap: s.amrap,
          targetRpeCap: s.amrap ? scheme.rpeCap : undefined,
        })),
      }
    }
    case 'fixedSets': {
      const prescribed: SetEntry[] = []
      for (let i = 0; i < scheme.sets; i++) {
        prescribed.push({
          setType: 'working',
          targetWeightLbs: scheme.loadLbs,
          targetReps: scheme.reps,
        })
      }
      return { prescribed }
    }
    case 'linearStages': {
      const st = state.stageState[scheme.liftKey] ?? { stageIndex: 0, loadLbs: 0 }
      const stage = scheme.stages[Math.min(st.stageIndex, scheme.stages.length - 1)]
      const prescribed: SetEntry[] = []
      for (let i = 0; i < stage.sets; i++) {
        const isLast = i === stage.sets - 1
        prescribed.push({
          setType: stage.amrapLast && isLast ? 'amrap' : 'working',
          targetWeightLbs: st.loadLbs,
          targetReps: stage.reps,
          amrap: stage.amrapLast && isLast,
        })
      }
      return { prescribed }
    }
    case 'doubleProgression': {
      const key = slotKey(programId, slotId)
      const load = state.dpLoads[key] ?? scheme.startLbs
      const prescribed: SetEntry[] = []
      for (let i = 0; i < scheme.sets; i++) {
        prescribed.push({
          setType: 'working',
          targetWeightLbs: load,
          targetReps: scheme.repMin,
          targetRepsMax: scheme.repMax,
        })
      }
      return { prescribed }
    }
    case 'amrapRpeCap': {
      const last = lastWorkingWeight(exerciseId, sessions) ?? scheme.startLbs
      const count = scheme.sets ?? 1
      const prescribed: SetEntry[] = []
      for (let i = 0; i < count; i++) {
        prescribed.push({
          setType: 'amrap',
          targetWeightLbs: last,
          targetRpeCap: scheme.targetRpe,
          amrap: true,
        })
      }
      return { prescribed }
    }
    case 'timeDistance': {
      return {
        prescribed: [
          {
            setType: 'working',
            targetSeconds: scheme.minutes !== undefined ? scheme.minutes * 60 : undefined,
          },
        ],
      }
    }
    case 'checklist':
      return { prescribed: [], checklist: scheme.items }
    case 'tmTest': {
      const tm = state.trainingMaxes[scheme.liftKey] ?? 0
      // Wendler 7th-week test: work to 5 clean reps at the TM (90% TM x 5 validates).
      return {
        prescribed: [
          { setType: 'warmup', targetWeightLbs: roundToIncrement(tm * 0.7), targetReps: 5 },
          { setType: 'warmup', targetWeightLbs: roundToIncrement(tm * 0.8), targetReps: 3 },
          { setType: 'amrap', targetWeightLbs: roundToIncrement(tm * 0.9), targetReps: 5, targetRpeCap: 9, amrap: true },
        ],
      }
    }
  }
}

function pickSlotVariant(slot: Slot, profile: Profile): { exerciseId: string; scheme: Scheme; note?: string } {
  if (profile.roundTomorrow && slot.heavyLower && slot.golfAlternate) {
    return { ...slot.golfAlternate, note: 'Swapped — round tomorrow' }
  }
  return { exerciseId: slot.exerciseId, scheme: slot.scheme }
}

/** Resolve tonight's full session from the program + state + history. */
export function resolveDay(
  program: Program,
  state: ProgramState,
  profile: Profile,
  sessions: WorkoutSession[],
  weekNumber?: number,
  dayNumber?: number,
): PrescribedSession | null {
  const week = program.weeks.find((w) => w.week === (weekNumber ?? state.currentWeek))
  if (!week) return null
  const day = week.days.find((d) => d.day === (dayNumber ?? state.currentDay))
  if (!day) return null

  const exercises: PrescribedExercise[] = day.slots.map((slot) => {
    const variant = pickSlotVariant(slot, profile)
    const { prescribed, checklist } = resolveScheme(
      variant.scheme,
      state,
      program.id,
      slot.id,
      sessions,
      variant.exerciseId,
    )
    return {
      exerciseId: variant.exerciseId,
      slotId: slot.id,
      supersetGroup: slot.supersetGroup,
      restSec: slot.restSec,
      prescribed,
      ghosts: getGhosts(variant.exerciseId, sessions),
      checklist,
      note: variant.note,
    }
  })

  return {
    programId: program.id,
    week: week.week,
    day: day.day,
    dayName: day.name,
    weekLabel: week.label,
    deload: week.deload ?? false,
    primer: day.primer,
    exercises,
  }
}
