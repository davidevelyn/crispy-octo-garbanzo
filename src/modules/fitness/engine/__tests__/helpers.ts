import type { LoggedSet, ProgramState, SessionExercise, SetEntry, WorkoutSession } from '../../types'
import type { Profile } from '../../../../platform/types'

let counter = 0
export function testId(): string {
  return `test-${++counter}`
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'david',
    profileId: 'david',
    name: 'David',
    units: 'lbs',
    barWeightLbs: 45,
    platesLbs: [45, 35, 25, 10, 5, 2.5],
    roundTomorrow: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeState(overrides: Partial<ProgramState> = {}): ProgramState {
  return {
    id: testId(),
    profileId: 'david',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    programId: 'golf-athlete-531',
    startDate: '2026-01-01T00:00:00.000Z',
    currentWeek: 1,
    currentDay: 1,
    trainingMaxes: { squat: 290, bench: 215, deadlift: 385, press: 125 },
    cycleCount: 0,
    stageState: {},
    dpLoads: {},
    completedDays: [],
    status: 'active',
    ...overrides,
  }
}

export function loggedSet(weightLbs: number | undefined, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: testId(),
    setType: 'working',
    weightLbs,
    reps,
    completedAt: '2026-01-02T00:00:00.000Z',
    ...extra,
  }
}

export function sessionWith(
  exercises: Array<Partial<SessionExercise> & { exerciseId: string }>,
  overrides: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    id: testId(),
    profileId: 'david',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    status: 'finished',
    startedAt: overrides.startedAt ?? '2026-01-02T00:00:00.000Z',
    finishedAt: '2026-01-02T01:00:00.000Z',
    exercises: exercises.map((e) => ({
      restSec: 120,
      prescribed: [] as SetEntry[],
      sets: [],
      ...e,
    })),
    ...overrides,
  }
}
