import type { ProgressionEvent } from '../modules/fitness/types'
import { exerciseName } from '../modules/fitness/data'

/** Named, calm win moments. Every one earned, none shouted. */
export function celebrationLine(event: ProgressionEvent): { what: string; detail: string } | null {
  switch (event.type) {
    case 'weightPr':
      return { what: `${exerciseName(event.exerciseId)} — new top weight`, detail: `${event.weightLbs} lb × ${event.reps}` }
    case 'repPr':
      return {
        what: `${exerciseName(event.exerciseId)} — rep PR`,
        detail: `${event.reps} reps at ${event.weightLbs} lb (was ${event.prevReps})`,
      }
    case 'e1rmPr':
      return { what: `${exerciseName(event.exerciseId)} — new best e1RM`, detail: `${event.e1rm} lb estimated` }
    case 'tmBump':
      return { what: `Training max up: ${event.liftKey}`, detail: `${event.fromLbs} → ${event.toLbs} lb. Cycle banked.` }
    case 'tmProposal':
      return { what: `New training max proven: ${event.liftKey}`, detail: `${event.fromLbs} → ${event.toLbs} lb` }
    case 'stageAdvance':
      return { what: `${event.liftKey}: new rep scheme unlocked`, detail: 'Same weight, new attack. This is the plan working.' }
    case 'stageReset':
      return { what: `${event.liftKey}: fresh runway`, detail: `Restarting at ${event.newLoadLbs} lb — built from what you just proved.` }
    case 'dpBump':
      return { what: 'Load up next time', detail: `Accessory earned +weight → ${event.toLbs} lb` }
    default:
      return null
  }
}

export function Celebration({ event }: { event: ProgressionEvent }) {
  const line = celebrationLine(event)
  if (!line) return null
  return (
    <div className="celebration">
      <span className="mark">▲</span>
      <div>
        <div className="what">{line.what}</div>
        <div className="detail">{line.detail}</div>
      </div>
    </div>
  )
}
