import { describe, expect, it } from 'vitest'
import { resolveDay, resolveScheme } from '../resolve'
import { golfAthlete531, foundations, FOUNDATION_DEFAULT_LOADS } from '../../content/programs'
import { makeProfile, makeState, sessionWith, loggedSet } from './helpers'

const state = makeState()

function schemesOf(programId: string) {
  return { programId }
}
void schemesOf

describe('resolveScheme: percentTM', () => {
  it('computes 5/3/1 week-1 loads from TM', () => {
    const { prescribed } = resolveScheme(
      { kind: 'percentTM', liftKey: 'squat', sets: [{ pct: 0.65, reps: 5 }, { pct: 0.75, reps: 5 }, { pct: 0.85, reps: 5, amrap: true }], rpeCap: 9 },
      state, 'p', 's', [], 'back-squat',
    )
    expect(prescribed.map((p) => p.targetWeightLbs)).toEqual([190, 220, 245])
    expect(prescribed[2].amrap).toBe(true)
    expect(prescribed[2].targetRpeCap).toBe(9)
    expect(prescribed[0].targetRpeCap).toBeUndefined()
  })
})

describe('resolveScheme: linearStages', () => {
  const scheme: import('../../types').Scheme = {
    kind: 'linearStages',
    liftKey: 'squat',
    stages: [
      { sets: 5, reps: 3, amrapLast: true },
      { sets: 6, reps: 2, amrapLast: true },
      { sets: 10, reps: 1, amrapLast: true },
    ],
    incrementLbs: 10,
  }

  it('stage 0 gives 5×3 with AMRAP last at stored load', () => {
    const st = makeState({ stageState: { squat: { stageIndex: 0, loadLbs: 95 } } })
    const { prescribed } = resolveScheme(scheme, st, 'p', 's', [], 'back-squat')
    expect(prescribed).toHaveLength(5)
    expect(prescribed.every((p) => p.targetWeightLbs === 95)).toBe(true)
    expect(prescribed[4].amrap).toBe(true)
    expect(prescribed[3].amrap).toBeFalsy()
  })

  it('stage 2 gives 10×1', () => {
    const st = makeState({ stageState: { squat: { stageIndex: 2, loadLbs: 135 } } })
    const { prescribed } = resolveScheme(scheme, st, 'p', 's', [], 'back-squat')
    expect(prescribed).toHaveLength(10)
    expect(prescribed[9].amrap).toBe(true)
  })
})

describe('resolveScheme: doubleProgression', () => {
  it('uses startLbs before any state exists', () => {
    const { prescribed } = resolveScheme(
      { kind: 'doubleProgression', sets: 3, repMin: 8, repMax: 12, startLbs: 40, incrementLbs: 5 },
      makeState(), 'prog', 'slot1', [], 'bulgarian-split-squat',
    )
    expect(prescribed).toHaveLength(3)
    expect(prescribed[0].targetWeightLbs).toBe(40)
    expect(prescribed[0].targetReps).toBe(8)
    expect(prescribed[0].targetRepsMax).toBe(12)
  })
  it('uses stored dp load when present', () => {
    const st = makeState({ dpLoads: { 'prog:slot1': 55 } })
    const { prescribed } = resolveScheme(
      { kind: 'doubleProgression', sets: 3, repMin: 8, repMax: 12, startLbs: 40, incrementLbs: 5 },
      st, 'prog', 'slot1', [], 'bulgarian-split-squat',
    )
    expect(prescribed[0].targetWeightLbs).toBe(55)
  })
})

describe('resolveScheme: amrapRpeCap ghost-rides history', () => {
  it('takes last working weight from sessions', () => {
    const history = [sessionWith([{ exerciseId: 'db-rdl', sets: [loggedSet(80, 10)] }])]
    const { prescribed } = resolveScheme(
      { kind: 'amrapRpeCap', targetRpe: 8, startLbs: 50 },
      makeState(), 'p', 's', history, 'db-rdl',
    )
    expect(prescribed[0].targetWeightLbs).toBe(80)
    expect(prescribed[0].targetRpeCap).toBe(8)
  })
})

describe('resolveDay', () => {
  it('resolves week 1 day 1 of the 531 program with ghosts', () => {
    const prior = sessionWith([{ exerciseId: 'back-squat', sets: [loggedSet(275, 5)] }])
    const day = resolveDay(golfAthlete531, state, makeProfile(), [prior])
    expect(day).not.toBeNull()
    expect(day!.dayName).toBe('Lower — Squat')
    const squat = day!.exercises.find((e) => e.exerciseId === 'back-squat')!
    expect(squat.prescribed.length).toBeGreaterThan(0)
    expect(squat.ghosts[0].weightLbs).toBe(275)
  })

  it('deload week 4 prescribes lighter squat work', () => {
    const st = makeState({ currentWeek: 4 })
    const day = resolveDay(golfAthlete531, st, makeProfile(), [])
    const squat = day!.exercises.find((e) => e.exerciseId === 'back-squat')!
    // 40/50/60% of 290 → 115, 145, 175
    expect(squat.prescribed.map((p) => p.targetWeightLbs)).toEqual([115, 145, 175])
    expect(day!.deload).toBe(true)
  })

  it('golf swap replaces heavy lower slots when roundTomorrow', () => {
    const profile = makeProfile({ roundTomorrow: true })
    const day = resolveDay(golfAthlete531, state, profile, [])
    expect(day!.exercises.some((e) => e.exerciseId === 'banded-hinge')).toBe(true)
    expect(day!.exercises.some((e) => e.exerciseId === 'back-squat')).toBe(false)
    const swapped = day!.exercises.find((e) => e.exerciseId === 'banded-hinge')!
    expect(swapped.note).toMatch(/round tomorrow/i)
  })

  it('resolves foundations GZCLP day with seeded stage loads', () => {
    const st = makeState({
      programId: 'foundations-gzclp',
      currentWeek: 3,
      currentDay: 1,
      trainingMaxes: {},
      stageState: Object.fromEntries(
        Object.entries(FOUNDATION_DEFAULT_LOADS).map(([k, v]) => [k, { stageIndex: 0, loadLbs: v }]),
      ),
    })
    const day = resolveDay(foundations, st, makeProfile(), [])
    expect(day!.dayName).toContain('A1')
    const t1 = day!.exercises.find((e) => e.exerciseId === 'back-squat')!
    expect(t1.prescribed).toHaveLength(5)
    expect(t1.prescribed[0].targetWeightLbs).toBe(45)
  })

  it('returns null past the end of the program', () => {
    const st = makeState({ currentWeek: 99 })
    expect(resolveDay(golfAthlete531, st, makeProfile(), [])).toBeNull()
  })
})
