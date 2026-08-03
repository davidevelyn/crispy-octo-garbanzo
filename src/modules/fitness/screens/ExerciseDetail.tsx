import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../../../platform/store'
import { Sparkline } from '../../../components/Sparkline'
import { exerciseMap, getSessions } from '../data'
import { exerciseHistory } from '../engine/stats'
import type { WorkoutSession } from '../types'

export function ExerciseDetail() {
  const { id } = useParams()
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const def = id ? exerciseMap.get(id) : undefined

  useEffect(() => {
    void getSessions(activeProfileId).then(setSessions)
  }, [activeProfileId])

  const points = useMemo(() => (id ? exerciseHistory(id, sessions) : []), [id, sessions])

  if (!def) return <main className="screen"><div className="empty">Unknown exercise.</div></main>

  const fmt = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <main className="screen">
      <div className="card stack">
        <div>
          <div className="kicker">{def.muscleGroups.primary.join(' · ')}{def.golfRelevant ? ' · golf' : ''}</div>
          <h2>{def.name}</h2>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>{def.instructions}</p>
        </div>
      </div>

      <div className="section-title">Best e1RM over time</div>
      <div className="card">
        <Sparkline
          values={points.map((p) => p.bestE1rm)}
          startLabel={points[0] ? fmt(points[0].date) : undefined}
          endLabel={points.length > 1 ? fmt(points[points.length - 1].date) : undefined}
        />
      </div>

      {points.length > 0 && (
        <>
          <div className="section-title">Sessions</div>
          <div className="list">
            {[...points].reverse().map((p, i) => (
              <div key={i} className="row">
                <div className="grow">
                  <div className="title">{p.topWeight > 0 ? `${p.topWeight} × ${p.topReps}` : `${p.topReps} reps`}</div>
                  <div className="sub">{fmt(p.date)}</div>
                </div>
                <span className="end mono">{p.bestE1rm} e1RM</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
