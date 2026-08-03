import { describe, expect, it } from 'vitest'
import { applySessionResult } from '../progress'
import { golfAthlete531, foundations, FOUNDATION_DEFAULT_LOADS } from '../../content/programs'
import { loggedSet, makeState, sessionWith } from './helpers'
import type { SetEntry, WorkoutSession } from '../../types'

function fiveByFive(weight: number, reps = 5): { prescribed: SetEntry[]; sets: ReturnType<typeof loggedSet>[] } {
  return {
    prescribed: Array.from({ length: 5 }, () => ({ setType: 'working', targetWeightLbs: weight, targetReps: reps })),
    sets: Array.from({ length: 5 }, () => loggedSet(weight, reps)),
  }
}

/** Build a finished session for a given program week/day covering all slots with met prescriptions. */
function completedDay(programId: string, week: number, day: number): WorkoutSession {
  const program = programId === 'golf-athlete-531' ? golfAthlete531 : foundations
  const d = program.weeks.find((w) => w.week === week)!.days.find((x) => x.day === day)!
  return sessionWith(
    d.slots.map((slot) => ({
      exerciseId: slot.exerciseId,
      slotId: slot.id,
      prescribed: [],
      sets: [],
    })),
    { programId, week, day },
  )
}

describe('5/3/1 TM bumps', () => {
  it('does not bump TMs mid-wave', () => {
    const state = makeState({ currentWeek: 1, currentDay: 1 })
    const session = completedDay('golf-athlete-531', 1, 1)
    const { nextState, events } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.trainingMaxes).toEqual(state.trainingMaxes)
    expect(events.filter((e) => e.type === 'tmBump')).toHaveLength(0)
  })

  it('bumps all TMs after the last day of week 3 (pre-deload)', () => {
    const completedDays = [1, 2, 3].flatMap((w) =>
      [1, 2, 3, 4].map((d) => ({ week: w, day: d, sessionId: `s${w}${d}` })),
    )
    // remove the final day — the session being applied is w3 d4
    completedDays.pop()
    const state = makeState({ currentWeek: 3, currentDay: 4, completedDays })
    const session = completedDay('golf-athlete-531', 3, 4)
    const { nextState, events } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.trainingMaxes.squat).toBe(300) // +10
    expect(nextState.trainingMaxes.bench).toBe(220) // +5
    expect(nextState.trainingMaxes.deadlift).toBe(395)
    expect(nextState.trainingMaxes.press).toBe(130)
    expect(events.filter((e) => e.type === 'tmBump')).toHaveLength(4)
    expect(nextState.cycleCount).toBe(1)
    expect(nextState.currentWeek).toBe(4)
  })

  it('does not bump when other days of the week remain', () => {
    const state = makeState({ currentWeek: 3, currentDay: 1, completedDays: [] })
    const session = completedDay('golf-athlete-531', 3, 1)
    const { nextState } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.trainingMaxes.squat).toBe(290)
  })
})

describe('GZCLP stage machine', () => {
  const gzclpState = () =>
    makeState({
      programId: 'foundations-gzclp',
      currentWeek: 3,
      currentDay: 1,
      trainingMaxes: {},
      stageState: Object.fromEntries(
        Object.entries(FOUNDATION_DEFAULT_LOADS).map(([k, v]) => [k, { stageIndex: 0, loadLbs: v }]),
      ),
    })

  function t1Session(met: boolean): WorkoutSession {
    // week 3 day 1 = A1: T1 squat (5×3+), T2 bench
    const base = completedDay('foundations-gzclp', 3, 1)
    const t1 = base.exercises.find((e) => e.slotId === 't1-squat')!
    t1.prescribed = Array.from({ length: 5 }, (_, i) => ({
      setType: i === 4 ? 'amrap' : 'working',
      targetWeightLbs: 45,
      targetReps: 3,
      amrap: i === 4,
    }))
    t1.sets = Array.from({ length: 5 }, () => loggedSet(45, met ? 3 : 2))
    return base
  }

  it('success adds the increment to the load', () => {
    const { nextState, events } = applySessionResult(foundations, gzclpState(), t1Session(true), [])
    expect(nextState.stageState.squat).toEqual({ stageIndex: 0, loadLbs: 55 })
    expect(events.some((e) => e.type === 'stageAdvance')).toBe(false)
  })

  it('failure advances the stage at the same load', () => {
    const { nextState, events } = applySessionResult(foundations, gzclpState(), t1Session(false), [])
    expect(nextState.stageState.squat).toEqual({ stageIndex: 1, loadLbs: 45 })
    expect(events.some((e) => e.type === 'stageAdvance' && e.toStage === 1)).toBe(true)
  })

  it('failure on the last stage resets to 90% of session-best e1RM', () => {
    const st = gzclpState()
    st.stageState.squat = { stageIndex: 2, loadLbs: 135 }
    const session = t1Session(false)
    const t1 = session.exercises.find((e) => e.slotId === 't1-squat')!
    t1.sets = [loggedSet(135, 1), loggedSet(135, 1), loggedSet(135, 0)]
    const { nextState, events } = applySessionResult(foundations, st, session, [])
    // e1RM(135×1)=135 → 90% = 121.5 → round 120
    expect(nextState.stageState.squat).toEqual({ stageIndex: 0, loadLbs: 120 })
    expect(events.some((e) => e.type === 'stageReset')).toBe(true)
  })
})

describe('double progression', () => {
  it('bumps only when every set hits repMax', () => {
    const state = makeState({ currentWeek: 1, currentDay: 1 })
    const session = completedDay('golf-athlete-531', 1, 1)
    const split = session.exercises.find((e) => e.slotId === 'd1-split-acc')!
    split.prescribed = Array.from({ length: 3 }, () => ({
      setType: 'working', targetWeightLbs: 40, targetReps: 8, targetRepsMax: 12,
    }))
    split.sets = [loggedSet(40, 12), loggedSet(40, 12), loggedSet(40, 12)]
    const { nextState, events } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.dpLoads['golf-athlete-531:d1-split-acc']).toBe(45)
    expect(events.some((e) => e.type === 'dpBump' && e.toLbs === 45)).toBe(true)
  })

  it('holds the load when short of repMax and stays sticky', () => {
    const state = makeState({ currentWeek: 1, currentDay: 1, dpLoads: { 'golf-athlete-531:d1-split-acc': 50 } })
    const session = completedDay('golf-athlete-531', 1, 1)
    const split = session.exercises.find((e) => e.slotId === 'd1-split-acc')!
    split.prescribed = Array.from({ length: 3 }, () => ({
      setType: 'working', targetWeightLbs: 50, targetReps: 8, targetRepsMax: 12,
    }))
    split.sets = [loggedSet(50, 12), loggedSet(50, 10), loggedSet(50, 8)]
    const { nextState } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.dpLoads['golf-athlete-531:d1-split-acc']).toBe(50)
  })
})

describe('tmTest week', () => {
  it('proposes new TMs from the test top set', () => {
    const completedDays = golfAthlete531.weeks
      .filter((w) => w.week < 12)
      .flatMap((w) => w.days.map((d) => ({ week: w.week, day: d.day, sessionId: 'x' })))
    const state = makeState({ currentWeek: 12, currentDay: 1, completedDays })
    const session = completedDay('golf-athlete-531', 12, 1)
    const test = session.exercises.find((e) => e.slotId === 'd1-test')!
    test.sets = [loggedSet(260, 5, { setType: 'amrap' })]
    const { events } = applySessionResult(golfAthlete531, state, session, [])
    const proposal = events.find((e) => e.type === 'tmProposal' && e.liftKey === 'squat')
    // e1RM(260×5) = 303.3 → 90% = 273 → 275
    expect(proposal && proposal.type === 'tmProposal' && proposal.toLbs).toBe(275)
  })
})

describe('pointer + completion', () => {
  it('advances day pointer within a week', () => {
    const state = makeState({ currentWeek: 1, currentDay: 1 })
    const { nextState } = applySessionResult(golfAthlete531, state, completedDay('golf-athlete-531', 1, 1), [])
    expect(nextState.currentWeek).toBe(1)
    expect(nextState.currentDay).toBe(2)
  })

  it('marks the program completed after the final day', () => {
    const all = golfAthlete531.weeks.flatMap((w) => w.days.map((d) => ({ week: w.week, day: d.day, sessionId: 'x' })))
    all.pop()
    const state = makeState({ currentWeek: 12, currentDay: 4, completedDays: all })
    const { nextState } = applySessionResult(golfAthlete531, state, completedDay('golf-athlete-531', 12, 4), [])
    expect(nextState.status).toBe('completed')
  })

  it('swapped golf-alternate exercises do not drive slot progression', () => {
    const state = makeState({ currentWeek: 1, currentDay: 1 })
    const session = completedDay('golf-athlete-531', 1, 1)
    const main = session.exercises.find((e) => e.slotId === 'd1-main')!
    main.exerciseId = 'banded-hinge' // swapped
    main.sets = [loggedSet(0, 8)]
    const { nextState } = applySessionResult(golfAthlete531, state, session, [])
    expect(nextState.trainingMaxes).toEqual(state.trainingMaxes)
  })
})

describe('5x5 helper sanity', () => {
  it('constructs matching prescription and sets', () => {
    const { prescribed, sets } = fiveByFive(100)
    expect(prescribed).toHaveLength(5)
    expect(sets.every((s) => s.reps === 5)).toBe(true)
  })
})
