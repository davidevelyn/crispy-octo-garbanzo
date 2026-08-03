import { describe, expect, it } from 'vitest'
import { detectPrs, exerciseHistory, getGhosts, sessionVolume, weeklyStreak, weekKey } from '../stats'
import { loggedSet, sessionWith } from './helpers'

describe('getGhosts', () => {
  it('returns sets from the most recent finished session with the exercise', () => {
    const older = sessionWith([{ exerciseId: 'bench-press', sets: [loggedSet(185, 8)] }], { startedAt: '2026-01-01T00:00:00Z' })
    const newer = sessionWith([{ exerciseId: 'bench-press', sets: [loggedSet(205, 5)] }], { startedAt: '2026-01-08T00:00:00Z' })
    const ghosts = getGhosts('bench-press', [older, newer])
    expect(ghosts[0].weightLbs).toBe(205)
  })
  it('ignores active sessions and returns [] with no history', () => {
    const active = sessionWith([{ exerciseId: 'bench-press', sets: [loggedSet(225, 3)] }], { status: 'active' })
    expect(getGhosts('bench-press', [active])).toEqual([])
  })
})

describe('detectPrs', () => {
  const prior = [sessionWith([{ exerciseId: 'back-squat', sets: [loggedSet(225, 5), loggedSet(245, 3)] }], { startedAt: '2026-01-01T00:00:00Z' })]

  it('first-ever exposure is not a PR parade', () => {
    const first = sessionWith([{ exerciseId: 'deadlift', sets: [loggedSet(315, 5)] }], { startedAt: '2026-01-05T00:00:00Z' })
    expect(detectPrs(first, [])).toEqual([])
  })

  it('detects a weight PR', () => {
    const session = sessionWith([{ exerciseId: 'back-squat', sets: [loggedSet(255, 2)] }], { startedAt: '2026-01-08T00:00:00Z' })
    const events = detectPrs(session, prior)
    expect(events).toEqual([{ type: 'weightPr', exerciseId: 'back-squat', weightLbs: 255, reps: 2 }])
  })

  it('detects a rep PR at a known weight when no weight PR', () => {
    const session = sessionWith([{ exerciseId: 'back-squat', sets: [loggedSet(225, 8)] }], { startedAt: '2026-01-08T00:00:00Z' })
    const events = detectPrs(session, prior)
    expect(events[0]).toEqual({ type: 'repPr', exerciseId: 'back-squat', weightLbs: 225, reps: 8, prevReps: 5 })
  })

  it('warmups never produce PRs', () => {
    const session = sessionWith(
      [{ exerciseId: 'back-squat', sets: [loggedSet(275, 1, { setType: 'warmup' })] }],
      { startedAt: '2026-01-08T00:00:00Z' },
    )
    expect(detectPrs(session, prior)).toEqual([])
  })
})

describe('sessionVolume', () => {
  it('sums weight×reps for working sets only', () => {
    const s = sessionWith([
      { exerciseId: 'bench-press', sets: [loggedSet(45, 10, { setType: 'warmup' }), loggedSet(185, 5), loggedSet(185, 5)] },
    ])
    expect(sessionVolume(s)).toEqual({ totalVolumeLbs: 1850, workingSets: 2 })
  })
})

describe('exerciseHistory', () => {
  it('produces one best-e1RM point per session', () => {
    const a = sessionWith([{ exerciseId: 'bench-press', sets: [loggedSet(185, 5), loggedSet(205, 2)] }], { startedAt: '2026-01-01T00:00:00Z' })
    const b = sessionWith([{ exerciseId: 'bench-press', sets: [loggedSet(210, 3)] }], { startedAt: '2026-01-08T00:00:00Z' })
    const points = exerciseHistory('bench-press', [b, a])
    expect(points).toHaveLength(2)
    expect(points[0].topWeight).toBe(205)
    expect(points[1].bestE1rm).toBe(231)
  })
})

describe('weeklyStreak', () => {
  it('counts consecutive weeks at target, current week not breaking', () => {
    const mk = (iso: string) => sessionWith([{ exerciseId: 'x', sets: [loggedSet(100, 5)] }], { startedAt: iso })
    const sessions = [
      // two full prior weeks with 3 sessions each (Mon/Wed/Fri)
      mk('2026-07-20T18:00:00Z'), mk('2026-07-22T18:00:00Z'), mk('2026-07-24T18:00:00Z'),
      mk('2026-07-27T18:00:00Z'), mk('2026-07-29T18:00:00Z'), mk('2026-07-31T18:00:00Z'),
      // current week: only one so far
      mk('2026-08-03T18:00:00Z'),
    ]
    expect(weeklyStreak(sessions, 3, '2026-08-04T00:00:00Z')).toBe(2)
  })
  it('weekKey stays stable within a week', () => {
    expect(weekKey('2026-08-03T10:00:00Z')).toBe(weekKey('2026-08-07T10:00:00Z'))
  })
})
