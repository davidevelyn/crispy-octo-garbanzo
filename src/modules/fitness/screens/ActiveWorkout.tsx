import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../../platform/store'
import { BottomSheet } from '../../../components/BottomSheet'
import { SetRow } from '../components/SetRow'
import { PlateCalc } from '../components/PlateCalc'
import { unlockAudio } from '../components/RestTimer'
import { getProgram } from '../content/programs'
import { applySessionResult } from '../engine/progress'
import { sessionVolume, getGhosts, detectPrs } from '../engine/stats'
import {
  exerciseMap,
  exerciseName,
  exercises,
  getActiveSession,
  getSessions,
  getActiveProgramState,
  saveProgramState,
  saveSession,
  deleteSession,
} from '../data'
import type { LoggedSet, ProgressionEvent, SessionExercise, WorkoutSession } from '../types'

export function ActiveWorkout() {
  const navigate = useNavigate()
  const activeProfileId = useApp((s) => s.activeProfileId)
  const profiles = useApp((s) => s.profiles)
  const profile = profiles.find((p) => p.profileId === activeProfileId)
  const startRest = useApp((s) => s.startRest)

  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [history, setHistory] = useState<WorkoutSession[]>([])
  const [index, setIndex] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [platesFor, setPlatesFor] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [primerDone, setPrimerDone] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const [active, sessions] = await Promise.all([getActiveSession(activeProfileId), getSessions(activeProfileId)])
      if (!active) {
        navigate('/fitness', { replace: true })
        return
      }
      setSession(active)
      setHistory(sessions)
    })()
  }, [activeProfileId, navigate])

  const program = session?.programId ? getProgram(session.programId) : null
  const primer = useMemo(() => {
    if (!program || !session?.week || !session.day) return null
    return program.weeks.find((w) => w.week === session.week)?.days.find((d) => d.day === session.day)?.primer ?? null
  }, [program, session?.week, session?.day])

  if (!session || !profile) return <main className="screen" />

  const persist = (next: WorkoutSession) => {
    setSession(next)
    void saveSession(next)
  }

  const updateExercise = (i: number, patch: Partial<SessionExercise>) => {
    const exercisesNext = session.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e))
    persist({ ...session, exercises: exercisesNext })
  }

  const logSet = (exIndex: number, setIndex: number, set: LoggedSet) => {
    unlockAudio()
    const ex = session.exercises[exIndex]
    const sets = [...ex.sets]
    sets[setIndex] = set
    updateExercise(exIndex, { sets })
    if (ex.restSec > 0) startRest(ex.restSec, exerciseName(ex.exerciseId))
  }

  const clearSet = (exIndex: number, setIndex: number) => {
    const ex = session.exercises[exIndex]
    const sets = ex.sets.filter((_, j) => j !== setIndex)
    updateExercise(exIndex, { sets })
  }

  const addExercise = (exerciseId: string) => {
    const entry: SessionExercise = {
      exerciseId,
      restSec: 120,
      prescribed: [],
      sets: [],
    }
    persist({ ...session, exercises: [...session.exercises, entry] })
    setIndex(session.exercises.length)
    setPickerOpen(false)
    setSearch('')
  }

  const addSetRow = (exIndex: number) => {
    // Extending beyond prescription: SetRow renders from max(prescribed, sets)+1 rows via extraRows
    const ex = session.exercises[exIndex]
    updateExercise(exIndex, { prescribed: [...ex.prescribed, { setType: 'working' }] })
  }

  const finish = async () => {
    const summaryBase = sessionVolume(session)
    let finished: WorkoutSession = {
      ...session,
      status: 'finished',
      finishedAt: new Date().toISOString(),
    }

    const prior = history.filter((h) => h.id !== session.id)
    let events: ProgressionEvent[] = []

    if (program && session.programStateId) {
      const state = await getActiveProgramState(activeProfileId)
      if (state && state.id === session.programStateId) {
        const result = applySessionResult(program, state, finished, prior)
        await saveProgramState(result.nextState)
        events = result.events
      }
    } else {
      events = detectPrs(finished, prior)
    }

    finished = { ...finished, summary: { ...summaryBase, prEvents: events } }
    await saveSession(finished)
    navigate(`/fitness/summary/${finished.id}`, { replace: true })
  }

  const discard = async () => {
    await deleteSession(session.id)
    navigate('/fitness', { replace: true })
  }

  const current = session.exercises[index]
  const currentDef = current ? exerciseMap.get(current.exerciseId) : undefined
  const ghosts = current ? getGhosts(current.exerciseId, history.filter((h) => h.id !== session.id)) : []
  const rowCount = current ? Math.max(current.prescribed.length, current.sets.length) : 0
  const loggedCount = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const partnered = current?.supersetGroup
    ? session.exercises
        .map((e, i) => ({ e, i }))
        .filter(({ e, i }) => i !== index && e.supersetGroup === current.supersetGroup)
    : []

  const filteredLibrary = exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <main className="screen" style={{ paddingBottom: 110 }}>
      <div className="spread">
        <div>
          <div className="kicker" style={{ marginBottom: 0 }}>
            {session.dayName ?? 'Workout'}
          </div>
        </div>
        <button className="btn small ghost" onClick={() => setConfirmFinish(true)}>
          Finish
        </button>
      </div>

      {primer && (
        <div className="card">
          <div className="kicker">Primer — move first, lift second</div>
          {primer.map((item) => (
            <button
              key={item}
              className={`checkitem ${primerDone.includes(item) ? 'done' : ''}`}
              onClick={() =>
                setPrimerDone((d) => (d.includes(item) ? d.filter((x) => x !== item) : [...d, item]))
              }
            >
              <span className="box">✓</span>
              <span>{item}</span>
            </button>
          ))}
        </div>
      )}

      {session.exercises.length > 0 && (
        <div className="hstack wrap">
          {session.exercises.map((e, i) => (
            <button
              key={i}
              className={`chip ${i === index ? 'on' : ''}`}
              onClick={() => setIndex(i)}
            >
              {e.sets.length > 0 ? `${exerciseName(e.exerciseId)} ✓` : exerciseName(e.exerciseId)}
            </button>
          ))}
        </div>
      )}

      {current && currentDef ? (
        <div className="card stack" key={index}>
          <div>
            <h2>{currentDef.name}</h2>
            {current.note && <div className="sub" style={{ color: 'var(--accent)' }}>{current.note}</div>}
            {partnered.length > 0 && (
              <div className="sub">
                Superset with {partnered.map(({ e }) => exerciseName(e.exerciseId)).join(', ')} — alternate sets
              </div>
            )}
            <div className="sub">{currentDef.instructions}</div>
          </div>

          {current.checklistDone !== undefined && (current.prescribed.length === 0) && program && session.week && session.day ? (
            <ChecklistBlock
              session={session}
              exIndex={index}
              onToggle={(items) => updateExercise(index, { checklistDone: items })}
            />
          ) : null}

          {rowCount > 0 && (
            <div className="stack">
              <div className="setgrid" style={{ gridTemplateColumns: '44px 1fr 1fr 64px 44px' }}>
                <div className="head">Set</div>
                <div className="head">lb</div>
                <div className="head">Reps</div>
                <div className="head">RPE</div>
                <div className="head">✓</div>
              </div>
              {Array.from({ length: rowCount }, (_, si) => (
                <SetRow
                  key={`${index}-${si}-${current.sets[si]?.id ?? 'blank'}`}
                  index={si}
                  prescribed={current.prescribed[si]}
                  ghost={ghosts[si] ?? ghosts[ghosts.length - 1]}
                  logged={current.sets[si]}
                  showRpe
                  onLog={(s) => logSet(index, si, s)}
                  onClear={() => clearSet(index, si)}
                />
              ))}
            </div>
          )}

          <div className="hstack">
            <button className="btn small ghost" onClick={() => addSetRow(index)}>
              + Set
            </button>
            {current.prescribed[0]?.targetWeightLbs !== undefined && current.prescribed[0].targetWeightLbs > profile.barWeightLbs && (
              <button
                className="btn small ghost"
                onClick={() => setPlatesFor(current.sets[current.sets.length - 1]?.weightLbs ?? current.prescribed[0]?.targetWeightLbs ?? 0)}
              >
                Plates
              </button>
            )}
            <span className="grow" />
            {index > 0 && (
              <button className="btn small ghost" onClick={() => setIndex(index - 1)}>
                ‹ Prev
              </button>
            )}
            {index < session.exercises.length - 1 && (
              <button className="btn small primary" onClick={() => setIndex(index + 1)}>
                Next ›
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="empty">Add your first exercise below.</div>
      )}

      <button className="btn ghost" onClick={() => setPickerOpen(true)}>
        + Add exercise
      </button>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="stack">
          <input
            className="input"
            placeholder="Search exercises"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="list" style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
            {filteredLibrary.map((e) => (
              <button key={e.id} className="row" onClick={() => addExercise(e.id)}>
                <div className="grow">
                  <div className="title">{e.name}</div>
                  <div className="sub">
                    {e.muscleGroups.primary.join(', ')}
                    {e.golfRelevant ? ' · golf' : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={platesFor !== null} onClose={() => setPlatesFor(null)}>
        {platesFor !== null && <PlateCalc targetLbs={platesFor} profile={profile} />}
      </BottomSheet>

      <BottomSheet open={confirmFinish} onClose={() => setConfirmFinish(false)}>
        <div className="stack">
          <h2>Finish workout?</h2>
          <p className="dim">{loggedCount} sets logged.</p>
          <button className="btn primary" onClick={() => void finish()}>
            Finish — save it
          </button>
          <button className="btn ghost" onClick={() => setConfirmFinish(false)}>
            Keep going
          </button>
          <button className="btn ghost faint" onClick={() => void discard()}>
            Discard this workout
          </button>
        </div>
      </BottomSheet>
    </main>
  )
}

function ChecklistBlock({
  session,
  exIndex,
  onToggle,
}: {
  session: WorkoutSession
  exIndex: number
  onToggle(items: string[]): void
}) {
  const ex = session.exercises[exIndex]
  const program = session.programId ? getProgram(session.programId) : null
  const slot = program?.weeks
    .find((w) => w.week === session.week)
    ?.days.find((d) => d.day === session.day)
    ?.slots.find((s) => s.id === ex.slotId)
  if (!slot || slot.scheme.kind !== 'checklist') return null
  const done = ex.checklistDone ?? []
  return (
    <div>
      {slot.scheme.items.map((item) => (
        <button
          key={item}
          className={`checkitem ${done.includes(item) ? 'done' : ''}`}
          onClick={() => onToggle(done.includes(item) ? done.filter((x) => x !== item) : [...done, item])}
        >
          <span className="box">✓</span>
          <span>{item}</span>
        </button>
      ))}
    </div>
  )
}
