/** Plate math for a barbell loaded symmetrically. Pure. */

export interface PlateBreakdown {
  /** plates per side, heaviest first, e.g. [45, 25, 2.5] */
  perSide: number[]
  /** the weight actually achievable with the inventory */
  achievedLbs: number
  exact: boolean
}

/**
 * Greedy per-side breakdown from an inventory of plate sizes (assumed ample
 * pairs of each). Returns nearest achievable at-or-below target when inexact.
 */
export function plateBreakdown(targetLbs: number, barLbs: number, inventory: number[]): PlateBreakdown {
  const sizes = [...inventory].sort((a, b) => b - a)
  if (targetLbs <= barLbs) {
    return { perSide: [], achievedLbs: barLbs, exact: targetLbs === barLbs }
  }
  let remainingPerSide = (targetLbs - barLbs) / 2
  const perSide: number[] = []
  for (const size of sizes) {
    while (remainingPerSide >= size - 1e-9) {
      perSide.push(size)
      remainingPerSide -= size
    }
  }
  const achievedLbs = barLbs + 2 * perSide.reduce((a, b) => a + b, 0)
  return { perSide, achievedLbs, exact: Math.abs(achievedLbs - targetLbs) < 1e-9 }
}
