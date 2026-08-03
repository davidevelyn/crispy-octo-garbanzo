import { describe, expect, it } from 'vitest'
import exercisesJson from '../../content/exercises.json'
import { programs, FOUNDATION_DEFAULT_LOADS } from '../../content/programs'
import type { Exercise } from '../../types'

const exercises = exercisesJson as Exercise[]
const ids = new Set(exercises.map((e) => e.id))

describe('exercise library', () => {
  it('has a substantial library with unique ids', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(85)
    expect(ids.size).toBe(exercises.length)
  })
  it('every exercise has instructions and at least one primary muscle', () => {
    for (const e of exercises) {
      expect(e.instructions.length, e.id).toBeGreaterThan(10)
      expect(e.muscleGroups.primary.length, e.id).toBeGreaterThan(0)
      expect(e.equipment.length, e.id).toBeGreaterThan(0)
    }
  })
})

describe('programs', () => {
  it('both programs run exactly 12 weeks with sequential numbering', () => {
    for (const p of programs) {
      expect(p.weeks).toHaveLength(12)
      p.weeks.forEach((w, i) => expect(w.week).toBe(i + 1))
      for (const w of p.weeks) {
        expect(w.days.length).toBe(p.daysPerWeek)
        w.days.forEach((d, i) => expect(d.day).toBe(i + 1))
      }
    }
  })

  it('every slot references a real exercise (including golf alternates)', () => {
    for (const p of programs) {
      for (const w of p.weeks) {
        for (const d of w.days) {
          for (const s of d.slots) {
            expect(ids.has(s.exerciseId), `${p.id} w${w.week}d${d.day} ${s.id} → ${s.exerciseId}`).toBe(true)
            if (s.golfAlternate) {
              expect(ids.has(s.golfAlternate.exerciseId), `${s.id} alt`).toBe(true)
            }
          }
        }
      }
    }
  })

  it('slot ids are unique within each day', () => {
    for (const p of programs) {
      for (const w of p.weeks) {
        for (const d of w.days) {
          const slotIds = d.slots.map((s) => s.id)
          expect(new Set(slotIds).size, `${p.id} w${w.week}d${d.day}`).toBe(slotIds.length)
        }
      }
    }
  })

  it('percentTM/tmTest liftKeys exist in program lifts', () => {
    for (const p of programs) {
      const liftKeys = new Set(p.lifts.map((l) => l.key))
      for (const w of p.weeks) {
        for (const d of w.days) {
          for (const s of d.slots) {
            if (s.scheme.kind === 'percentTM' || s.scheme.kind === 'tmTest') {
              expect(liftKeys.has(s.scheme.liftKey), `${p.id} ${s.id} → ${s.scheme.liftKey}`).toBe(true)
            }
          }
        }
      }
    }
  })

  it('every linearStages liftKey in foundations has a default starting load', () => {
    const foundations = programs.find((p) => p.id === 'foundations-gzclp')!
    for (const w of foundations.weeks) {
      for (const d of w.days) {
        for (const s of d.slots) {
          if (s.scheme.kind === 'linearStages') {
            expect(FOUNDATION_DEFAULT_LOADS[s.scheme.liftKey], `missing default for ${s.scheme.liftKey}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('531 has deloads at weeks 4 and 8 and a test in week 12', () => {
    const p = programs.find((x) => x.id === 'golf-athlete-531')!
    expect(p.weeks[3].deload).toBe(true)
    expect(p.weeks[7].deload).toBe(true)
    const w12 = p.weeks[11]
    const hasTest = w12.days.some((d) => d.slots.some((s) => s.scheme.kind === 'tmTest'))
    expect(hasTest).toBe(true)
  })

  it('foundations weeks 1-2 are technique weeks, 3+ are GZCLP', () => {
    const p = programs.find((x) => x.id === 'foundations-gzclp')!
    expect(p.weeks[0].label).toMatch(/technique/i)
    expect(p.weeks[2].label).toMatch(/GZCLP/)
  })
})
