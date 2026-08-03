import { useEffect, useState } from 'react'
import { useApp, toast } from '../../../platform/store'
import { Sparkline } from '../../../components/Sparkline'
import { addMeasurement, getMeasurements } from '../data'
import type { MeasurementEntry, Metric } from '../types'

const METRICS: Array<{ id: Metric; label: string; unit: string }> = [
  { id: 'bodyweight', label: 'Bodyweight', unit: 'lb' },
  { id: 'waist', label: 'Waist', unit: 'in' },
  { id: 'chest', label: 'Chest', unit: 'in' },
  { id: 'hips', label: 'Hips', unit: 'in' },
  { id: 'arm', label: 'Arm', unit: 'in' },
  { id: 'thigh', label: 'Thigh', unit: 'in' },
]

export function Measurements() {
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [entries, setEntries] = useState<MeasurementEntry[]>([])
  const [metric, setMetric] = useState<Metric>('bodyweight')
  const [value, setValue] = useState('')

  const refresh = () => void getMeasurements(activeProfileId).then(setEntries)
  useEffect(refresh, [activeProfileId])

  const current = entries.filter((e) => e.metric === metric)
  const meta = METRICS.find((m) => m.id === metric)!
  const latest = current[current.length - 1]

  const add = async () => {
    const v = Number(value)
    if (!v || v <= 0) return
    await addMeasurement(activeProfileId, metric, v)
    setValue('')
    refresh()
    toast(`${meta.label} logged`)
  }

  return (
    <main className="screen">
      <div className="hstack wrap">
        {METRICS.map((m) => (
          <button key={m.id} className={`chip ${m.id === metric ? 'on' : ''}`} onClick={() => setMetric(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div className="spread">
          <h2>{meta.label}</h2>
          {latest && (
            <span className="mono dim">
              {latest.value} {meta.unit}
            </span>
          )}
        </div>
        <Sparkline values={current.map((e) => e.value)} height={100} />
        <div className="hstack">
          <div className="numwrap" style={{ flex: 1 }}>
            <input
              className="input"
              inputMode="decimal"
              placeholder={latest ? String(latest.value) : '0'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="unit">{meta.unit}</span>
          </div>
          <button className="btn small primary" onClick={() => void add()} style={{ padding: '12px 20px' }}>
            Log
          </button>
        </div>
      </div>

      <p className="faint center" style={{ fontSize: 13 }}>
        Trends over days matter. Single readings are weather, not climate.
      </p>
    </main>
  )
}
