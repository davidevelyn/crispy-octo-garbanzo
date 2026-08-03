import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, toast } from '../../../platform/store'
import { getProfiles, saveProfile } from '../../../platform/profiles'
import { getProgram } from '../content/programs'
import { resolveDay } from '../engine/resolve'
import {
  getActiveProgramState,
  getActiveSession,
  getSessions,
  newSession,
  saveSession,
} from '../data'
import type { PrescribedSession, ProgramState, WorkoutSession } from '../types'

export function FitnessToday() {
  const navigate = useNavigate()
  const activeProfileId = useApp((s) => s.activeProfileId)
  const profiles = useApp((s) => s.profiles)
  const setProfiles = useApp((s) => s.setProfiles)
  const profile = profiles.find((p) => p.profileId === activeProfileId)

  const [state, setState] = useState<ProgramState | null>(null)
  const [tonight, setTonight] = useState<PrescribedSession | null>(null)
  const [active, setActive] = useState<WorkoutSession | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      if (!profile) return
      const [ps, sessions, activeSession] = await Promise.all([
        getActiveProgramState(activeProfileId),
        getSessions(activeProfileId),
        getActiveSession(activeProfileId),
      ])
      if (!live) return
      setActive(activeSession ?? null)
      if (ps) {
        const program = getProgram(ps.programId)
        if (program) {
          setState(ps)
          setTonight(resolveDay(program, ps, profile, sessions))
        }
      } else {
        setState(null)
        setTonight(null)
      }
      setLoaded(true)
    })()
    return () => {
      live = false
    }
  }, [activeProfileId, profile])

  if (!profile || !loaded) return <main className="screen" />

  const startProgrammed = async () => {
    if (!tonight) return
    const session = newSession(activeProfileId)
    session.programId = tonight.programId
    session.programStateId = state?.id
    session.week = tonight.week
    session.day = tonight.day
    session.dayName = tonight.dayName
    session.exercises = tonight.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      slotId: e.slotId,
      supersetGroup: e.supersetGroup,
      restSec: e.restSec,
      prescribed: e.prescribed,
      sets: [],
      checklistDone: [],
      note: e.note,
    }))
    await saveSession(session)
    navigate('/fitness/workout')
  }

  const startEmpty = async () => {
    const session = newSession(activeProfileId)
    await saveSession(session)
    navigate('/fitness/workout')
  }

  const toggleRound = async () => {
    const updated = await saveProfile({ ...profile, roundTomorrow: !profile.roundTomorrow })
    setProfiles(await getProfiles())
    toast(updated.roundTomorrow ? 'Heavy lower work will swap out' : 'Back to the full program')
  }

  const program = state ? getProgram(state.programId) : null

  return (
    <main className="screen">
      {active ? (
        <div className="card now">
          <div className="kicker">In progress</div>
          <h2>{active.dayName ?? 'Workout'}</h2>
          <p className="dim" style={{ margin: '6px 0 12px' }}>
            Started {new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
          <button className="btn accent" onClick={() => navigate('/fitness/workout')}>
            Continue workout
          </button>
        </div>
      ) : tonight && program && state ? (
        <div className="card now">
          <div className="kicker">
            Week {tonight.week} of {program.weeks.length}
            {tonight.deload ? ' · deload' : ''}
          </div>
          <h2>{tonight.dayName}</h2>
          {tonight.weekLabel && <p className="dim" style={{ marginTop: 4 }}>{tonight.weekLabel}</p>}
          <p className="dim" style={{ margin: '6px 0 12px' }}>
            {tonight.exercises.length} movements
            {tonight.deload ? ' — light on purpose. Recovery is training.' : ''}
          </p>
          <button className="btn accent" onClick={() => void startProgrammed()}>
            Start {tonight.dayName}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="kicker">No program running</div>
          <h2>Pick a 12-week program</h2>
          <p className="dim" style={{ margin: '6px 0 12px' }}>
            Golf Athlete 5/3/1 or Foundations — built for this gym, this household.
          </p>
          <Link to="/fitness/program" className="btn primary">
            Choose program
          </Link>
        </div>
      )}

      <button className="row" onClick={() => void toggleRound()}>
        <div className="grow">
          <div className="title">Round tomorrow{profile.roundTomorrow ? ' — on' : ''}</div>
          <div className="sub">
            {profile.roundTomorrow
              ? 'Heavy lower-body work swaps to fast, light options'
              : 'Playing golf tomorrow? Tap to protect your legs'}
          </div>
        </div>
        <span className={`chip ${profile.roundTomorrow ? 'accent' : ''}`}>{profile.roundTomorrow ? 'ON' : 'off'}</span>
      </button>

      <div className="list">
        <button className="row" onClick={() => void startEmpty()}>
          <div className="grow">
            <div className="title">Empty workout</div>
            <div className="sub">Log anything, no program</div>
          </div>
          <span className="end">›</span>
        </button>
        <Link to="/fitness/history" className="row">
          <div className="grow">
            <div className="title">History</div>
          </div>
          <span className="end">›</span>
        </Link>
        <Link to="/fitness/progress" className="row">
          <div className="grow">
            <div className="title">Progress</div>
            <div className="sub">PRs, volume, streak</div>
          </div>
          <span className="end">›</span>
        </Link>
        <Link to="/fitness/measurements" className="row">
          <div className="grow">
            <div className="title">Measurements</div>
          </div>
          <span className="end">›</span>
        </Link>
        <Link to="/fitness/program" className="row">
          <div className="grow">
            <div className="title">Program</div>
            <div className="sub">{program ? `${program.name} — week ${state?.currentWeek}` : 'None active'}</div>
          </div>
          <span className="end">›</span>
        </Link>
      </div>
    </main>
  )
}
