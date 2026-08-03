import { byIndex, get, getAll, put } from '../../platform/db'
import { STORES } from '../../platform/schema'
import { nowIso, uuid } from '../../platform/ids'
import type { OwnerId, ProfileId } from '../../platform/types'
import type { Exercise, MeasurementEntry, Metric, ProgramState, WorkoutSession } from './types'
import exercisesJson from './content/exercises.json'

/* ---------- Exercise library (bundled content) ---------- */

export const exercises = exercisesJson as Exercise[]
export const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

export function exerciseName(id: string): string {
  return exerciseMap.get(id)?.name ?? id
}

/* ---------- Sessions ---------- */

export async function getSessions(profileId: ProfileId): Promise<WorkoutSession[]> {
  const sessions = await byIndex<WorkoutSession>(
    STORES.sessions,
    'byProfileStart',
    IDBKeyRange.bound([profileId, ''], [profileId, '￿']),
  )
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

export async function getActiveSession(profileId: ProfileId): Promise<WorkoutSession | undefined> {
  const active = await byIndex<WorkoutSession>(STORES.sessions, 'byProfileStatus', [profileId, 'active'])
  return active[0]
}

export async function getSession(id: string): Promise<WorkoutSession | undefined> {
  return get<WorkoutSession>(STORES.sessions, id)
}

export async function saveSession(session: WorkoutSession): Promise<WorkoutSession> {
  const next = { ...session, updatedAt: nowIso() }
  await put(STORES.sessions, next)
  return next
}

export function newSession(profileId: OwnerId & ProfileId): WorkoutSession {
  const now = nowIso()
  return {
    id: uuid(),
    profileId,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    startedAt: now,
    exercises: [],
  }
}

/* ---------- Program state ---------- */

export async function getProgramStates(profileId: ProfileId): Promise<ProgramState[]> {
  return byIndex<ProgramState>(STORES.programStates, 'byProfile', profileId)
}

export async function getActiveProgramState(profileId: ProfileId): Promise<ProgramState | undefined> {
  const states = await getProgramStates(profileId)
  return states.find((s) => s.status === 'active')
}

export async function saveProgramState(state: ProgramState): Promise<ProgramState> {
  const next = { ...state, updatedAt: nowIso() }
  await put(STORES.programStates, next)
  return next
}

export function newProgramState(
  profileId: ProfileId,
  programId: string,
  trainingMaxes: Record<string, number>,
  stageState: Record<string, { stageIndex: number; loadLbs: number }>,
): ProgramState {
  const now = nowIso()
  return {
    id: uuid(),
    profileId,
    createdAt: now,
    updatedAt: now,
    programId,
    startDate: now,
    currentWeek: 1,
    currentDay: 1,
    trainingMaxes,
    cycleCount: 0,
    stageState,
    dpLoads: {},
    completedDays: [],
    status: 'active',
  }
}

/* ---------- Measurements ---------- */

export async function getMeasurements(profileId: ProfileId): Promise<MeasurementEntry[]> {
  const all = await getAll<MeasurementEntry>(STORES.measurements)
  return all.filter((m) => m.profileId === profileId).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
}

export async function addMeasurement(profileId: ProfileId, metric: Metric, value: number): Promise<MeasurementEntry> {
  const now = nowIso()
  const entry: MeasurementEntry = {
    id: uuid(),
    profileId,
    createdAt: now,
    updatedAt: now,
    metric,
    value,
    takenAt: now,
  }
  await put(STORES.measurements, entry)
  return entry
}
