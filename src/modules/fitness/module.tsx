import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ModuleDefinition, ProfileId } from '../../platform/types'
import { STORES } from '../../platform/schema'
import { getAll } from '../../platform/db'
import { mergeRecords } from '../../platform/exportImport'
import { getProgram } from './content/programs'
import { getActiveProgramState, getActiveSession } from './data'
import { FitnessToday } from './screens/FitnessToday'
import { ActiveWorkout } from './screens/ActiveWorkout'
import { SessionSummary } from './screens/SessionSummary'
import { History } from './screens/History'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { Progress } from './screens/Progress'
import { Measurements } from './screens/Measurements'
import { ProgramSetup } from './screens/ProgramSetup'
import type { MeasurementEntry, ProgramState, WorkoutSession } from './types'

function FitnessHomeCard({ profileId }: { profileId: ProfileId }) {
  const [line, setLine] = useState<{ title: string; sub: string; active: boolean }>({
    title: 'Fitness',
    sub: 'Loading…',
    active: false,
  })

  useEffect(() => {
    let live = true
    void (async () => {
      const [state, activeSession] = await Promise.all([
        getActiveProgramState(profileId),
        getActiveSession(profileId),
      ])
      if (!live) return
      if (activeSession) {
        setLine({ title: 'Workout in progress', sub: activeSession.dayName ?? 'Tap to continue', active: true })
      } else if (state) {
        const program = getProgram(state.programId)
        const day = program?.weeks
          .find((w) => w.week === state.currentWeek)
          ?.days.find((d) => d.day === state.currentDay)
        setLine({
          title: day ? `Up next: ${day.name}` : 'Fitness',
          sub: program ? `${program.name} · week ${state.currentWeek} of ${program.weeks.length}` : '',
          active: true,
        })
      } else {
        setLine({ title: 'Fitness', sub: 'Pick a 12-week program to begin', active: false })
      }
    })()
    return () => {
      live = false
    }
  }, [profileId])

  return (
    <Link to="/fitness" className={`card ${line.active ? 'now' : ''}`} style={{ display: 'block' }}>
      <div className="kicker">Fitness</div>
      <h2>{line.title}</h2>
      <div className="sub" style={{ marginTop: 4 }}>{line.sub}</div>
    </Link>
  )
}

export const fitnessModule: ModuleDefinition = {
  id: 'fitness',
  title: 'Fitness',
  basePath: '/fitness',
  HomeCard: FitnessHomeCard,
  stores: [STORES.sessions, STORES.programStates, STORES.measurements],
  routes: [
    { path: '', element: <FitnessToday /> },
    { path: 'workout', element: <ActiveWorkout /> },
    { path: 'summary/:id', element: <SessionSummary /> },
    { path: 'history', element: <History /> },
    { path: 'exercise/:id', element: <ExerciseDetail /> },
    { path: 'progress', element: <Progress /> },
    { path: 'measurements', element: <Measurements /> },
    { path: 'program', element: <ProgramSetup /> },
  ],
  async exportData() {
    const [sessions, programStates, measurements] = await Promise.all([
      getAll<WorkoutSession>(STORES.sessions),
      getAll<ProgramState>(STORES.programStates),
      getAll<MeasurementEntry>(STORES.measurements),
    ])
    return { sessions, programStates, measurements }
  },
  async importData(section, mode) {
    const s = (section ?? {}) as {
      sessions?: WorkoutSession[]
      programStates?: ProgramState[]
      measurements?: MeasurementEntry[]
    }
    const [a, b, c] = await Promise.all([
      mergeRecords(STORES.sessions, s.sessions ?? [], mode),
      mergeRecords(STORES.programStates, s.programStates ?? [], mode),
      mergeRecords(STORES.measurements, s.measurements ?? [], mode),
    ])
    return {
      added: a.added + b.added + c.added,
      updated: a.updated + b.updated + c.updated,
      skippedOlder: a.skippedOlder + b.skippedOlder + c.skippedOlder,
      errors: [...a.errors, ...b.errors, ...c.errors],
    }
  },
}
