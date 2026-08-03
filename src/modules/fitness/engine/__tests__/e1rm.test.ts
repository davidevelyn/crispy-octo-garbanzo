import { describe, expect, it } from 'vitest'
import { displayWeight, epley1RM, kgToLbs, lbsToKg, roundToIncrement, tmFromTopSet } from '../e1rm'

describe('epley1RM', () => {
  it('returns the weight itself for a single', () => {
    expect(epley1RM(300, 1)).toBe(300)
  })
  it('estimates 5-rep sets upward', () => {
    expect(epley1RM(275, 5)).toBeCloseTo(275 * (1 + 5 / 30))
  })
  it('handles zero/invalid input', () => {
    expect(epley1RM(0, 5)).toBe(0)
    expect(epley1RM(100, 0)).toBe(0)
  })
})

describe('roundToIncrement', () => {
  it('rounds to nearest 5 by default', () => {
    expect(roundToIncrement(212.4)).toBe(210)
    expect(roundToIncrement(212.6)).toBe(215)
  })
  it('supports 2.5 increments', () => {
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5)
  })
  it('passes through on nonpositive increment', () => {
    expect(roundToIncrement(101.3, 0)).toBe(101.3)
  })
})

describe('tmFromTopSet', () => {
  it('gives 90% of e1RM rounded to 5', () => {
    // 275x5 → e1RM 320.83 → TM 288.75 → 290
    expect(tmFromTopSet(275, 5)).toBe(290)
  })
  it('single at 300 → TM 270', () => {
    expect(tmFromTopSet(300, 1)).toBe(270)
  })
})

describe('unit conversion', () => {
  it('round-trips lbs↔kg', () => {
    expect(kgToLbs(lbsToKg(225))).toBeCloseTo(225)
  })
  it('displayWeight converts and rounds', () => {
    expect(displayWeight(225, 'lbs')).toBe(225)
    expect(displayWeight(225, 'kg')).toBeCloseTo(102.1, 1)
  })
})
