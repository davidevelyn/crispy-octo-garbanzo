import { expect, test } from '@playwright/test'

const BASE = '/crispy-octo-garbanzo/#/'

test('log a workout end to end and export it', async ({ page }) => {
  await page.goto(BASE)

  // Home renders both profiles and the module cards
  await expect(page.getByRole('heading', { name: 'Life OS' })).toBeVisible()
  await expect(page.locator('.profile-switch button', { hasText: 'David' })).toBeVisible()
  await expect(page.locator('.kicker', { hasText: 'Fitness' })).toBeVisible()

  // Into fitness → start an empty workout
  await page.getByText('Pick a 12-week program to begin').click()
  await page.getByText('Empty workout').click()

  // Add an exercise and log a set
  await page.getByText('+ Add exercise').click()
  await page.getByPlaceholder('Search exercises').fill('goblet')
  await page.getByText('Goblet Squat', { exact: true }).click()
  await page.getByLabel('Set 1 weight').fill('50')
  await page.getByLabel('Set 1 reps').fill('10')
  await page.getByLabel('Complete set').click()

  // Finish
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('button', { name: 'Finish — save it' }).click()
  await expect(page.getByText('Workout finished')).toBeVisible()
  await expect(page.locator('.big-number').nth(1)).toHaveText('1')
  await page.getByRole('link', { name: 'Done' }).click()

  // History shows it
  await page.getByText('History').first().click()
  await expect(page.locator('.row .title', { hasText: 'Workout' })).toBeVisible()

  // Export produces a parseable full document containing the session
  await page.goto(BASE + 'settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export everything (JSON)' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const doc = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(doc.app).toBe('life-os')
  expect(doc.profiles).toHaveLength(2)
  expect(doc.modules.fitness.sessions).toHaveLength(1)
  expect(doc.modules.fitness.sessions[0].exercises[0].exerciseId).toBe('goblet-squat')
})

test('start the 5/3/1 program and see week-1 prescriptions', async ({ page }) => {
  await page.goto(BASE)
  await page.getByText('Pick a 12-week program to begin').click()
  await page.getByRole('link', { name: 'Choose program' }).click()
  await page.getByText('Golf Athlete 5/3/1').click()

  // Enter top sets: squat 275x5 → TM 290
  const lifts = ['Back Squat', 'Bench Press', 'Trap Bar Deadlift', 'Overhead Press']
  const tops: Array<[string, string]> = [
    ['275', '5'],
    ['225', '4'],
    ['405', '3'],
    ['115', '5'],
  ]
  for (let i = 0; i < lifts.length; i++) {
    const section = page.locator('.stack', { has: page.getByText(lifts[i], { exact: true }) }).last()
    await section.getByPlaceholder('weight lb').fill(tops[i][0])
    await section.getByPlaceholder('reps').fill(tops[i][1])
    await section.getByPlaceholder('reps').blur()
  }
  await page.getByRole('button', { name: 'Start week 1' }).click()

  // Tonight's card shows week 1 lower day
  await expect(page.getByText('Week 1 of 12')).toBeVisible()
  await page.getByRole('button', { name: /Start Lower/ }).click()

  // Squat slot prescribes 65% of 290 = 190 as the first ghost value
  await page.locator('.chip', { hasText: 'Back Squat' }).click()
  await expect(page.getByLabel('Set 1 weight')).toHaveAttribute('placeholder', '190')
})
