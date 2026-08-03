import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, toast } from '../../../platform/store'
import { programs, getProgram, FOUNDATION_DEFAULT_LOADS } from '../content/programs'
import { tmFromTopSet } from '../engine/e1rm'
import { exerciseName, getActiveProgramState, newProgramState, saveProgramState } from '../data'
import type { Program, ProgramState } from '../types'

export function ProgramSetup() {
  const navigate = useNavigate()
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [existing, setExisting] = useState<ProgramState | null>(null)
  const [choosing, setChoosing] = useState<Program | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void getActiveProgramState(activeProfileId).then((s) => {
      setExisting(s ?? null)
      setLoaded(true)
    })
  }, [activeProfileId])

  if (!loaded) return <main className="screen" />

  if (existing && !choosing) {
    const program = getProgram(existing.programId)
    return (
      <main className="screen">
        <div className="card stack">
          <div className="kicker">Active program</div>
          <h2>{program?.name ?? existing.programId}</h2>
          <p className="dim">
            Week {existing.currentWeek} of {program?.weeks.length ?? 12} · day {existing.currentDay} up next
          </p>
          {Object.keys(existing.trainingMaxes).length > 0 && (
            <div className="stack">
              <div className="section-title">Training maxes</div>
              {Object.entries(existing.trainingMaxes).map(([k, v]) => (
                <div key={k} className="spread">
                  <span className="dim">{k}</span>
                  <span className="mono">{v} lb</span>
                </div>
              ))}
            </div>
          )}
          <button
            className="btn ghost faint"
            onClick={() => {
              void saveProgramState({ ...existing, status: 'abandoned' }).then(() => {
                setExisting(null)
                toast('Program stopped — history stays')
              })
            }}
          >
            Stop this program
          </button>
        </div>
      </main>
    )
  }

  if (!choosing) {
    return (
      <main className="screen">
        <div className="section-title">Pick your 12 weeks</div>
        {programs.map((p) => (
          <button key={p.id} className="card stack" style={{ textAlign: 'left' }} onClick={() => setChoosing(p)}>
            <div className="kicker">{p.level}</div>
            <h2>{p.name}</h2>
            <div className="sub">{p.tagline}</div>
            <p className="dim" style={{ fontSize: 13 }}>{p.description}</p>
          </button>
        ))}
      </main>
    )
  }

  return <SetupWizard program={choosing} onBack={() => setChoosing(null)} onDone={() => navigate('/fitness')} />
}

function SetupWizard({ program, onBack, onDone }: { program: Program; onBack: () => void; onDone: () => void }) {
  const activeProfileId = useApp((s) => s.activeProfileId)
  const uses531 = program.weeks.some((w) => w.days.some((d) => d.slots.some((s) => s.scheme.kind === 'percentTM')))
  // top-set inputs per lift: weight and reps
  const [tops, setTops] = useState<Record<string, { w: string; r: string }>>({})
  const [tms, setTms] = useState<Record<string, string>>({})
  const [starts, setStarts] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(FOUNDATION_DEFAULT_LOADS).map(([k, v]) => [k, String(v)])),
  )

  const computeTm = (key: string) => {
    const t = tops[key]
    if (!t) return
    const w = Number(t.w)
    const r = Number(t.r)
    if (w > 0 && r > 0 && r < 30) {
      setTms((m) => ({ ...m, [key]: String(tmFromTopSet(w, r)) }))
    }
  }

  const start = async () => {
    let trainingMaxes: Record<string, number> = {}
    let stageState: Record<string, { stageIndex: number; loadLbs: number }> = {}

    if (uses531) {
      for (const lift of program.lifts) {
        const tm = Number(tms[lift.key])
        if (!tm || tm <= 0) {
          toast(`Training max needed for ${lift.key}`)
          return
        }
        trainingMaxes[lift.key] = tm
      }
    } else {
      // linearStages program: seed every stage key with a starting load
      stageState = Object.fromEntries(
        Object.entries(starts).map(([k, v]) => [k, { stageIndex: 0, loadLbs: Number(v) || FOUNDATION_DEFAULT_LOADS[k] || 45 }]),
      )
    }

    const state = newProgramState(activeProfileId, program.id, trainingMaxes, stageState)
    await saveProgramState(state)
    toast(`${program.name} — week 1 ready`)
    onDone()
  }

  return (
    <main className="screen">
      <button className="btn small ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        ‹ All programs
      </button>
      <div className="card stack">
        <div className="kicker">{program.name}</div>
        {uses531 ? (
          <>
            <h2>Set your training maxes</h2>
            <p className="dim" style={{ fontSize: 13 }}>
              Enter a recent hard-but-clean top set for each lift. The app computes a training max at 90% of the
              estimate — trust it, the program is built on submaximal work.
            </p>
            {program.lifts.map((lift) => (
              <div key={lift.key} className="stack" style={{ gap: 6 }}>
                <div className="section-title">{exerciseName(lift.exerciseId)}</div>
                <div className="hstack">
                  <input
                    className="input"
                    placeholder="weight lb"
                    inputMode="decimal"
                    value={tops[lift.key]?.w ?? ''}
                    onChange={(e) => setTops((m) => ({ ...m, [lift.key]: { w: e.target.value, r: m[lift.key]?.r ?? '' } }))}
                    onBlur={() => computeTm(lift.key)}
                  />
                  <span className="dim">×</span>
                  <input
                    className="input"
                    placeholder="reps"
                    inputMode="numeric"
                    value={tops[lift.key]?.r ?? ''}
                    onChange={(e) => setTops((m) => ({ ...m, [lift.key]: { w: m[lift.key]?.w ?? '', r: e.target.value } }))}
                    onBlur={() => computeTm(lift.key)}
                  />
                  <span className="dim">→</span>
                  <input
                    className="input"
                    placeholder="TM"
                    inputMode="decimal"
                    value={tms[lift.key] ?? ''}
                    onChange={(e) => setTms((m) => ({ ...m, [lift.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <h2>Starting weights</h2>
            <p className="dim" style={{ fontSize: 13 }}>
              Light on purpose — the first weeks groove technique and the program climbs from there. The defaults
              are the empty bar; adjust if you know better.
            </p>
            {Object.entries(starts)
              .filter(([k]) => !k.endsWith('-t2'))
              .map(([key, value]) => (
                <div key={key} className="field">
                  <label>{key}</label>
                  <div className="numwrap">
                    <input
                      className="input"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) =>
                        setStarts((m) => ({ ...m, [key]: e.target.value, [`${key}-t2`]: e.target.value }))
                      }
                    />
                    <span className="unit">lb</span>
                  </div>
                </div>
              ))}
          </>
        )}
        <button className="btn accent" onClick={() => void start()}>
          Start week 1
        </button>
      </div>
    </main>
  )
}
