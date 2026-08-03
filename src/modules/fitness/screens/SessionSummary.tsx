import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Celebration } from '../../../components/Celebration'
import { getSession } from '../data'
import type { WorkoutSession } from '../types'

function fmtDuration(start: string, end?: string): string {
  if (!end) return '—'
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
}

export function SessionSummary() {
  const { id } = useParams()
  const [session, setSession] = useState<WorkoutSession | null>(null)

  useEffect(() => {
    if (id) void getSession(id).then((s) => setSession(s ?? null))
  }, [id])

  if (!session) return <main className="screen" />

  const events = session.summary?.prEvents ?? []

  return (
    <main className="screen">
      <div className="card center stack">
        <div className="kicker">Done</div>
        <h2>{session.dayName ?? 'Workout'} finished</h2>
        <div className="hstack" style={{ justifyContent: 'center', gap: 24 }}>
          <div>
            <div className="big-number">{fmtDuration(session.startedAt, session.finishedAt)}</div>
            <div className="sub">duration</div>
          </div>
          <div>
            <div className="big-number">{session.summary?.workingSets ?? 0}</div>
            <div className="sub">sets</div>
          </div>
          <div>
            <div className="big-number">{Math.round((session.summary?.totalVolumeLbs ?? 0) / 1000 * 10) / 10}k</div>
            <div className="sub">lb volume</div>
          </div>
        </div>
      </div>

      {events.length > 0 && (
        <>
          <div className="section-title">Banked tonight</div>
          <div className="stack">
            {events.map((e, i) => (
              <Celebration key={i} event={e} />
            ))}
          </div>
        </>
      )}

      <Link to="/fitness" className="btn primary">
        Done
      </Link>
    </main>
  )
}
