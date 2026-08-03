import { useState } from 'react'
import type { LoggedSet, SetEntry } from '../types'
import { uuid, nowIso } from '../../../platform/ids'

interface Props {
  index: number
  prescribed?: SetEntry
  ghost?: LoggedSet
  logged?: LoggedSet
  showRpe: boolean
  onLog(set: LoggedSet): void
  onClear(): void
}

function tag(prescribed?: SetEntry): { text: string; amrap: boolean } {
  if (!prescribed) return { text: '—', amrap: false }
  if (prescribed.setType === 'warmup') return { text: 'W', amrap: false }
  if (prescribed.amrap) return { text: `${prescribed.targetReps ?? ''}+`, amrap: true }
  if (prescribed.targetRepsMax) return { text: `${prescribed.targetReps}-${prescribed.targetRepsMax}`, amrap: false }
  return { text: String(prescribed.targetReps ?? '—'), amrap: false }
}

export function SetRow({ index, prescribed, ghost, logged, showRpe, onLog, onClear }: Props) {
  const [weight, setWeight] = useState<string>(logged?.weightLbs?.toString() ?? '')
  const [reps, setReps] = useState<string>(logged?.reps?.toString() ?? '')
  const [rpe, setRpe] = useState<string>(logged?.rpe?.toString() ?? '')

  const ghostWeight = prescribed?.targetWeightLbs ?? ghost?.weightLbs
  const ghostReps = prescribed?.targetReps ?? ghost?.reps
  const done = !!logged
  const t = tag(prescribed)

  const complete = () => {
    const w = weight === '' ? ghostWeight : Number(weight)
    const r = reps === '' ? ghostReps : Number(reps)
    if (r === undefined || Number.isNaN(r) || r < 0) return
    onLog({
      id: logged?.id ?? uuid(),
      setType: prescribed?.setType ?? 'working',
      weightLbs: w === undefined || Number.isNaN(w) ? undefined : w,
      reps: r,
      rpe: rpe === '' ? undefined : Number(rpe),
      completedAt: nowIso(),
    })
    if (weight === '' && ghostWeight !== undefined) setWeight(String(ghostWeight))
    if (reps === '' && ghostReps !== undefined) setReps(String(ghostReps))
  }

  return (
    <div className="setgrid" style={showRpe ? { gridTemplateColumns: '44px 1fr 1fr 64px 44px' } : { gridTemplateColumns: '44px 1fr 1fr 44px' }}>
      <div className={`settag ${t.amrap ? 'amrap' : ''}`}>
        {index + 1}
        <div style={{ fontSize: 9 }}>{t.text}</div>
      </div>
      <input
        inputMode="decimal"
        placeholder={ghostWeight !== undefined ? String(ghostWeight) : 'lb'}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        aria-label={`Set ${index + 1} weight`}
      />
      <input
        inputMode="numeric"
        placeholder={ghostReps !== undefined ? String(ghostReps) : 'reps'}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        aria-label={`Set ${index + 1} reps`}
      />
      {showRpe && (
        <input
          inputMode="decimal"
          placeholder={prescribed?.targetRpeCap ? `≤${prescribed.targetRpeCap}` : 'rpe'}
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          aria-label={`Set ${index + 1} RPE`}
        />
      )}
      <button
        className={`setcheck ${done ? 'done' : ''}`}
        onClick={done ? onClear : complete}
        aria-label={done ? 'Undo set' : 'Complete set'}
      >
        ✓
      </button>
    </div>
  )
}
