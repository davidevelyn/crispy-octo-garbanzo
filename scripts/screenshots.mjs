/* Capture app screenshots for review. Usage:
   node scripts/screenshots.mjs [outdir]   (vite preview must be running) */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'shots'
mkdirSync(out, { recursive: true })
const BASE = 'http://localhost:4173/crispy-octo-garbanzo/#/'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })

const shot = (name) => page.screenshot({ path: `${out}/${name}.png` })

// Seed: start the 5/3/1 program
await page.goto(BASE)
await page.getByText('Pick a 12-week program to begin').click()
await page.getByRole('link', { name: 'Choose program' }).click()
await shot('3-program-picker')
await page.getByText('Golf Athlete 5/3/1').click()
const tops = [
  ['Back Squat', '275', '5'],
  ['Bench Press', '225', '4'],
  ['Trap Bar Deadlift', '405', '3'],
  ['Overhead Press', '115', '5'],
]
for (const [name, w, r] of tops) {
  const section = page.locator('.stack', { has: page.getByText(name, { exact: true }) }).last()
  await section.getByPlaceholder('weight lb').fill(w)
  await section.getByPlaceholder('reps').fill(r)
  await section.getByPlaceholder('reps').blur()
}
await shot('4-tm-onboarding')
await page.getByRole('button', { name: 'Start week 1' }).click()
await shot('2-fitness-today')

await page.getByRole('button', { name: /Start Lower/ }).click()
await page.locator('.chip', { hasText: 'Back Squat' }).click()
await shot('5-active-workout')

// Log the squat sets to show the rest timer
await page.getByLabel('Set 1 weight').first().fill('190')
await page.getByLabel('Set 1 reps').first().fill('5')
await page.getByLabel('Complete set').first().click()
await shot('6-rest-timer')

// Grocery + tasks
await page.goto(BASE + 'grocery')
for (const item of ['Chicken thighs', 'Greek yogurt', 'Coffee beans']) {
  await page.getByPlaceholder('Add to the list').fill(item)
  await page.getByPlaceholder('Add to the list').press('Enter')
  await page.locator('.row', { hasText: item }).waitFor()
}
await page.locator('.row', { hasText: 'Coffee beans' }).click()
await shot('7-grocery')

await page.goto(BASE)
await shot('1-home')

await browser.close()
console.log('screenshots →', out)
