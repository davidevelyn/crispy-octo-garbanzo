import { describe, expect, it } from 'vitest'
import { plateBreakdown } from '../plates'

const INV = [45, 35, 25, 10, 5, 2.5]

describe('plateBreakdown', () => {
  it('breaks 225 into a plate per side', () => {
    const r = plateBreakdown(225, 45, INV)
    expect(r.perSide).toEqual([45, 45])
    expect(r.exact).toBe(true)
  })
  it('handles compound loads', () => {
    const r = plateBreakdown(185, 45, INV)
    expect(r.perSide).toEqual([45, 25])
    expect(r.achievedLbs).toBe(185)
  })
  it('uses small plates', () => {
    const r = plateBreakdown(135, 45, INV)
    expect(r.perSide).toEqual([45])
    const r2 = plateBreakdown(140, 45, INV)
    expect(r2.perSide).toEqual([45, 2.5])
  })
  it('below bar weight → empty bar, inexact', () => {
    const r = plateBreakdown(30, 45, INV)
    expect(r.perSide).toEqual([])
    expect(r.achievedLbs).toBe(45)
    expect(r.exact).toBe(false)
  })
  it('unreachable target → nearest below', () => {
    const r = plateBreakdown(151, 45, INV)
    expect(r.achievedLbs).toBe(150)
    expect(r.exact).toBe(false)
  })
})
