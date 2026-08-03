import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../../platform/store'

/**
 * Timestamp-truth rest timer: renders endsAt − now, never decrements a
 * counter, so backgrounding/throttling can't drift it. Audio unlocks on the
 * first user gesture (iOS requirement); vibration is a free win on Android.
 */

let audioCtx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {
    audioCtx = null
  }
}

/** Two-tone synthesized chime — no asset, works offline, gentle. */
function chime(): void {
  if (audioCtx && audioCtx.state === 'running') {
    const now = audioCtx.currentTime
    for (const [freq, start] of [
      [880, 0],
      [1174.66, 0.18],
    ] as const) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.5)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + start)
      osc.stop(now + start + 0.55)
    }
  }
  navigator.vibrate?.(200)
}

function fmt(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : ''
  const s = Math.abs(totalSec)
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function RestTimerBar() {
  const timer = useApp((s) => s.restTimer)
  const clearRest = useApp((s) => s.clearRest)
  const [, force] = useState(0)
  const chimed = useRef(false)

  useEffect(() => {
    if (!timer) return
    chimed.current = false
    const tick = () => force((n) => n + 1)
    const interval = setInterval(tick, 250)
    const onVisible = () => tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timer])

  if (!timer) return null
  const remaining = Math.round((timer.endsAt - Date.now()) / 1000)
  if (remaining <= 0 && !chimed.current) {
    chimed.current = true
    chime()
  }
  const overrun = remaining <= 0

  return (
    <div className={`timerbar ${overrun ? 'overrun' : ''}`}>
      <span className="time">{overrun ? fmt(0) : fmt(remaining)}</span>
      <span className="label">
        {overrun ? `Rest done · ${fmt(-remaining)} ago` : `Rest — ${timer.exerciseName}`}
      </span>
      <button onClick={clearRest}>{overrun ? 'OK' : 'Skip'}</button>
    </div>
  )
}
