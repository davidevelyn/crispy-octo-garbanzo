/** Strength math. Pure. */

/** Epley estimated 1RM. reps=1 returns the weight itself. */
export function epley1RM(weightLbs: number, reps: number): number {
  if (reps <= 0 || weightLbs <= 0) return 0
  if (reps === 1) return weightLbs
  return weightLbs * (1 + reps / 30)
}

export function roundToIncrement(value: number, increment = 5): number {
  if (increment <= 0) return value
  return Math.round(value / increment) * increment
}

/** Training max = 90% of e1RM, rounded — the 5/3/1 convention. */
export function tmFromTopSet(weightLbs: number, reps: number, increment = 5): number {
  return roundToIncrement(0.9 * epley1RM(weightLbs, reps), increment)
}

export function lbsToKg(lbs: number): number {
  return lbs * 0.45359237
}

export function kgToLbs(kg: number): number {
  return kg / 0.45359237
}

/** Display helper: convert stored lbs into the profile's unit, sensibly rounded. */
export function displayWeight(lbs: number, units: 'lbs' | 'kg'): number {
  if (units === 'lbs') return Math.round(lbs * 10) / 10
  return Math.round(lbsToKg(lbs) * 10) / 10
}
