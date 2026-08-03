import type { LoggedSet, MuscleGroup, Exercise, ProgressionEvent, WorkoutSession } from '../types'
import { epley1RM } from './e1rm'

/** History-derived stats. Pure — callers pass sessions in. */

function finishedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

function workingSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => s.setType !== 'warmup' && (s.reps ?? 0) > 0)
}

/** Most recent finished session's logged sets for an exercise → ghost values. */
export function getGhosts(exerciseId: string, sessions: WorkoutSession[]): LoggedSet[] {
  const done = finishedSessions(sessions)
  for (let i = done.length - 1; i >= 0; i--) {
    const ex = done[i].exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
    if (ex) return ex.sets
  }
  return []
}

/** Last logged working weight for an exercise (drives amrapRpeCap prescriptions). */
export function lastWorkingWeight(exerciseId: string, sessions: WorkoutSession[]): number | undefined {
  const ghosts = workingSets(getGhosts(exerciseId, sessions))
  if (ghosts.length === 0) return undefined
  return ghosts[ghosts.length - 1].weightLbs
}

export interface ExercisePoint {
  date: string
  bestE1rm: number
  topWeight: number
  topReps: number
}

/** One point per finished session containing the exercise: best e1RM that day. */
export function exerciseHistory(exerciseId: string, sessions: WorkoutSession[]): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (const session of finishedSessions(sessions)) {
    let best: ExercisePoint | null = null
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue
      for (const set of workingSets(ex.sets)) {
        const e1 = epley1RM(set.weightLbs ?? 0, set.reps ?? 0)
        if (!best || e1 > best.bestE1rm) {
          best = {
            date: session.startedAt,
            bestE1rm: Math.round(e1),
            topWeight: set.weightLbs ?? 0,
            topReps: set.reps ?? 0,
          }
        }
      }
    }
    if (best) points.push(best)
  }
  return points
}

/**
 * PR detection for a just-finished session vs all prior history.
 * Weight PR: heaviest-ever working weight on the exercise.
 * Rep PR: most reps ever at that same weight.
 * e1RM PR: new best estimated 1RM.
 * Warmups never count; bodyweight-only sets (no weight) count reps at weight 0.
 */
export function detectPrs(session: WorkoutSession, priorSessions: WorkoutSession[]): ProgressionEvent[] {
  const prior = finishedSessions(priorSessions).filter((s) => s.id !== session.id)
  const events: ProgressionEvent[] = []

  for (const ex of session.exercises) {
    const sets = workingSets(ex.sets)
    if (sets.length === 0) continue

    let prevMaxWeight = 0
    let prevBestE1rm = 0
    const prevRepsAtWeight = new Map<number, number>()
    let hasHistory = false
    for (const past of prior) {
      for (const pex of past.exercises) {
        if (pex.exerciseId !== ex.exerciseId) continue
        for (const set of workingSets(pex.sets)) {
          hasHistory = true
          const w = set.weightLbs ?? 0
          const r = set.reps ?? 0
          prevMaxWeight = Math.max(prevMaxWeight, w)
          prevBestE1rm = Math.max(prevBestE1rm, epley1RM(w, r))
          prevRepsAtWeight.set(w, Math.max(prevRepsAtWeight.get(w) ?? 0, r))
        }
      }
    }
    // First-ever exposure isn't a PR parade — celebrate real progress only.
    if (!hasHistory) continue

    let bestWeightSet: LoggedSet | null = null
    let bestE1rmValue = 0
    let bestRepPr: { weightLbs: number; reps: number; prevReps: number } | null = null

    for (const set of sets) {
      const w = set.weightLbs ?? 0
      const r = set.reps ?? 0
      if (w > prevMaxWeight && (!bestWeightSet || w > (bestWeightSet.weightLbs ?? 0))) {
        bestWeightSet = set
      }
      const prevReps = prevRepsAtWeight.get(w)
      if (prevReps !== undefined && r > prevReps && (!bestRepPr || r - prevReps > bestRepPr.reps - bestRepPr.prevReps)) {
        bestRepPr = { weightLbs: w, reps: r, prevReps }
      }
      const e1 = epley1RM(w, r)
      if (e1 > prevBestE1rm && e1 > bestE1rmValue) bestE1rmValue = e1
    }

    if (bestWeightSet) {
      events.push({
        type: 'weightPr',
        exerciseId: ex.exerciseId,
        weightLbs: bestWeightSet.weightLbs ?? 0,
        reps: bestWeightSet.reps ?? 0,
      })
    } else if (bestRepPr) {
      events.push({ type: 'repPr', exerciseId: ex.exerciseId, ...bestRepPr })
    } else if (bestE1rmValue > 0) {
      events.push({ type: 'e1rmPr', exerciseId: ex.exerciseId, e1rm: Math.round(bestE1rmValue) })
    }
  }
  return events
}

export function sessionVolume(session: WorkoutSession): { totalVolumeLbs: number; workingSets: number } {
  let vol = 0
  let count = 0
  for (const ex of session.exercises) {
    for (const set of workingSets(ex.sets)) {
      vol += (set.weightLbs ?? 0) * (set.reps ?? 0)
      count++
    }
  }
  return { totalVolumeLbs: vol, workingSets: count }
}

/** ISO week key like '2026-W31' for grouping. */
export function weekKey(iso: string): string {
  const d = new Date(iso)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Working sets per primary muscle group for sessions in a window. */
export function volumeByMuscleGroup(
  sessions: WorkoutSession[],
  exercises: Map<string, Exercise>,
): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  for (const session of finishedSessions(sessions)) {
    for (const ex of session.exercises) {
      const def = exercises.get(ex.exerciseId)
      if (!def) continue
      const sets = workingSets(ex.sets).length
      if (sets === 0) continue
      for (const mg of def.muscleGroups.primary) {
        out.set(mg, (out.get(mg) ?? 0) + sets)
      }
    }
  }
  return out
}

/** Consecutive weeks (ending this week or last) with >= target finished sessions. */
export function weeklyStreak(sessions: WorkoutSession[], targetPerWeek: number, now: string): number {
  const done = finishedSessions(sessions)
  const counts = new Map<string, number>()
  for (const s of done) {
    const k = weekKey(s.startedAt)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let streak = 0
  const cursor = new Date(now)
  // If the current (incomplete) week hasn't hit target yet, it doesn't break the streak.
  const currentKey = weekKey(cursor.toISOString())
  if ((counts.get(currentKey) ?? 0) >= targetPerWeek) streak++
  cursor.setUTCDate(cursor.getUTCDate() - 7)
  for (;;) {
    const k = weekKey(cursor.toISOString())
    if ((counts.get(k) ?? 0) >= targetPerWeek) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 7)
    } else {
      break
    }
  }
  return streak
}
