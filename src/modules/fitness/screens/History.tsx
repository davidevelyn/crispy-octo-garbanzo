import { useEffect, useState } from 'react'
import { useApp } from '../../../platform/store'
import { BottomSheet } from '../../../components/BottomSheet'
import { exerciseName, getSessions } from '../data'
import type { WorkoutSession } from '../types'

export function History() {
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [open, setOpen] = useState<WorkoutSession | null>(null)

  useEffect(() => {
    void getSessions(activeProfileId).then((all) =>
      setSessions(all.filter((s) => s.status === 'finished').reverse()),
    )
  }, [activeProfileId])

  return (
    <main className="screen">
      <div className="section-title">History</div>
      {sessions.length === 0 && <div className="empty">First finished workout will land here.</div>}
      <div className="list">
        {sessions.map((s) => (
          <button key={s.id} className="row" onClick={() => setOpen(s)}>
            <div className="grow">
              <div className="title">{s.dayName ?? 'Workout'}</div>
              <div className="sub">
                {new Date(s.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                {s.week ? ` · week ${s.week}` : ''}
              </div>
            </div>
            <span className="end mono">{s.summary?.workingSets ?? 0} sets</span>
          </button>
        ))}
      </div>

      <BottomSheet open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <div className="stack">
            <h2>{open.dayName ?? 'Workout'}</h2>
            <div className="sub">{new Date(open.startedAt).toLocaleString()}</div>
            {open.exercises
              .filter((e) => e.sets.length > 0 || (e.checklistDone?.length ?? 0) > 0)
              .map((e, i) => (
                <div key={i}>
                  <div className="title" style={{ fontSize: 14 }}>{exerciseName(e.exerciseId)}</div>
                  <div className="prescription">
                    {e.sets.length > 0
                      ? e.sets
                          .map((s) =>
                            s.weightLbs !== undefined && s.weightLbs > 0
                              ? `${s.weightLbs}×${s.reps ?? 0}${s.rpe ? `@${s.rpe}` : ''}`
                              : `${s.reps ?? s.seconds ?? 0}${s.seconds ? 's' : ''}`,
                          )
                          .join('  ')
                      : `${e.checklistDone?.length ?? 0} items done`}
                  </div>
                </div>
              ))}
          </div>
        )}
      </BottomSheet>
    </main>
  )
}
