import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../../platform/store'
import { exerciseMap, exerciseName, getSessions } from '../data'
import { epley1RM } from '../engine/e1rm'
import { volumeByMuscleGroup, weeklyStreak, weekKey } from '../engine/stats'
import type { MuscleGroup, WorkoutSession } from '../types'

export function Progress() {
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])

  useEffect(() => {
    void getSessions(activeProfileId).then(setSessions)
  }, [activeProfileId])

  const finished = useMemo(() => sessions.filter((s) => s.status === 'finished'), [sessions])
  const streak = useMemo(() => weeklyStreak(finished, 3, new Date().toISOString()), [finished])

  const thisWeek = useMemo(() => {
    const wk = weekKey(new Date().toISOString())
    return finished.filter((s) => weekKey(s.startedAt) === wk)
  }, [finished])

  const volume = useMemo(() => {
    const recent = finished.slice(-12)
    return [...volumeByMuscleGroup(recent, exerciseMap).entries()].sort((a, b) => b[1] - a[1])
  }, [finished])
  const maxVol = volume[0]?.[1] ?? 1

  const bests = useMemo(() => {
    const best = new Map<string, { e1rm: number; weight: number; reps: number }>()
    for (const s of finished) {
      for (const ex of s.exercises) {
        const def = exerciseMap.get(ex.exerciseId)
        if (!def || !['barbell', 'trap-bar'].some((eq) => def.equipment.includes(eq as never))) continue
        for (const set of ex.sets) {
          if (set.setType === 'warmup' || !set.weightLbs || !set.reps) continue
          const e1 = epley1RM(set.weightLbs, set.reps)
          const cur = best.get(ex.exerciseId)
          if (!cur || e1 > cur.e1rm) best.set(ex.exerciseId, { e1rm: e1, weight: set.weightLbs, reps: set.reps })
        }
      }
    }
    return [...best.entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 8)
  }, [finished])

  const labelFor: Record<string, string> = { 'full-body': 'full body' }

  return (
    <main className="screen">
      <div className="card">
        <div className="spread">
          <div>
            <div className="kicker">This week</div>
            <div className="big-number">{thisWeek.length}<span style={{ fontSize: 16 }} className="dim"> sessions</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker">3+/week streak</div>
            <div className="big-number">{streak}<span style={{ fontSize: 16 }} className="dim"> wk</span></div>
          </div>
        </div>
      </div>

      {bests.length > 0 && (
        <>
          <div className="section-title">Best lifts (e1RM)</div>
          <div className="list">
            {bests.map(([exId, b]) => (
              <Link key={exId} to={`/fitness/exercise/${exId}`} className="row">
                <div className="grow">
                  <div className="title">{exerciseName(exId)}</div>
                  <div className="sub">
                    best set {b.weight}×{b.reps}
                  </div>
                </div>
                <span className="end mono">{Math.round(b.e1rm)} lb</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {volume.length > 0 && (
        <>
          <div className="section-title">Working sets by muscle — last 12 sessions</div>
          <div className="card stack">
            {volume.map(([mg, sets]) => (
              <div key={mg} className="bar-row">
                <span className="name">{labelFor[mg] ?? (mg as MuscleGroup)}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(sets / maxVol) * 100}%` }} />
                </div>
                <span className="val">{sets}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {finished.length === 0 && <div className="empty">Progress shows up after your first finished workout.</div>}
    </main>
  )
}
