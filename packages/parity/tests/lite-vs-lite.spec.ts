import { test, expect } from '@playwright/test'
import { comparePngs, MAX_DIFF_RATIO } from '../lib/compare'
import { FIXTURES, THEME_MATRIX, newIsolatedContext, openLite } from '../lib/lite'

const URL_A = 'http://127.0.0.1:4301/'
const URL_B = 'http://127.0.0.1:4302/'

const CASES = Object.entries(FIXTURES).flatMap(([fixture, config]) =>
  THEME_MATRIX.map((theme) => ({ fixture, config, theme })),
)

test('the matrix covers 2 fixtures x 8 themes', () => {
  expect(Object.keys(FIXTURES)).toHaveLength(2)
  expect(THEME_MATRIX).toHaveLength(8)
  expect(CASES).toHaveLength(16)
})

for (const { fixture, config, theme } of CASES) {
  test(`Lite A and Lite B render identically: ${fixture} / ${theme}`, async ({ browser }, testInfo) => {
    const context = await newIsolatedContext(browser)
    const a = await openLite(context, URL_A, { config, theme })
    const b = await openLite(context, URL_B, { config, theme })
    const result = comparePngs(await a.locator('body').screenshot(), await b.locator('body').screenshot())
    if (result.ratio > MAX_DIFF_RATIO) {
      await testInfo.attach('diff.png', { body: result.diffPng, contentType: 'image/png' })
    }
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO)
    await context.close()
  })
}

test('negative control: a one-pixel style change is detected', async ({ browser }) => {
  const context = await newIsolatedContext(browser)
  const a = await openLite(context, URL_A, { config: FIXTURES.minimal, theme: 'light' })
  const b = await openLite(context, URL_B, { config: FIXTURES.minimal, theme: 'light' })
  await b.addStyleTag({ content: '.kpi-value { letter-spacing: 1px }' })
  const result = comparePngs(await a.locator('body').screenshot(), await b.locator('body').screenshot())
  expect(result.diffPixels).toBeGreaterThan(0)
  expect(result.ratio).toBeGreaterThan(0)
  await context.close()
})
