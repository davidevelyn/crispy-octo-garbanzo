import { plateBreakdown } from '../engine/plates'
import type { Profile } from '../../../platform/types'

export function PlateCalc({ targetLbs, profile }: { targetLbs: number; profile: Profile }) {
  const { perSide, achievedLbs, exact } = plateBreakdown(targetLbs, profile.barWeightLbs, profile.platesLbs)
  return (
    <div className="stack">
      <div className="spread">
        <span className="dim">Per side for {targetLbs} lb</span>
        {!exact && <span className="faint">nearest: {achievedLbs} lb</span>}
      </div>
      <div className="hstack wrap">
        {perSide.length === 0 ? (
          <span className="dim">Empty bar ({profile.barWeightLbs} lb)</span>
        ) : (
          perSide.map((p, i) => (
            <span key={i} className="chip on mono">
              {p}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
