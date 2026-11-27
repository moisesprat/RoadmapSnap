import { test, expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { comparePngs, MAX_DIFF_RATIO } from '../lib/compare'
import { canonicalLiteConfig, FIXTURES, newIsolatedContext, openLite, THEME_MATRIX } from '../lib/lite'
import { openSaas, recordedPatches } from '../lib/saas'
import { KEEPS_POINTER, parkPointer, STATES, VIEWPORT_STATES, type StateName } from '../lib/states'

// The page-level Lite-vs-SaaS check (D-08..D-11): Lite on 4302 renders the canonical roadmap of a fixture; the real
// SaaS page on 4303 (DashboardPage, stub Auth0) renders the same fixture through stubbed API routes. Lite's body is
// compared with the SaaS .lite-area: both carry the same 20px page padding, so the screenshots have equal dimensions.
// No screenshot baselines exist anywhere: both sides are rendered live in the same run (D-10).
const LITE_URL = 'http://127.0.0.1:4302/'

const MATRIX = Object.entries(FIXTURES).flatMap(([fixture, config]) =>
  THEME_MATRIX.map((theme) => ({ fixture, config, theme })),
)

const ALL_STATES = Object.keys(STATES) as StateName[]
/** Every state under light on the complex fixture, then the two that lean on theme colors under dark. */
const STATE_CASES: { state: StateName; theme: string }[] = [
  ...ALL_STATES.map((state) => ({ state, theme: 'light' })),
  { state: 'graphHover', theme: 'dark' },
  { state: 'riskOnly', theme: 'dark' },
]

// A skipped theme, fixture or state must not pass silently: the suite asserts its own case count.
test('the matrix covers 2 fixtures x 8 themes and every listed state', () => {
  expect(Object.keys(FIXTURES).sort()).toEqual(['complex', 'minimal'])
  expect(THEME_MATRIX).toHaveLength(8)
  expect(MATRIX).toHaveLength(16)
  expect([...ALL_STATES].sort()).toEqual(
    ['collapsed', 'graphHover', 'riskOnly', 'scrolled', 'search', 'status', 'zoom6'].sort(),
  )
  expect(STATE_CASES).toHaveLength(9)
})

async function openBoth(context: BrowserContext, config: unknown, theme: string): Promise<{ lite: Page; saas: Page }> {
  const lite = await openLite(context, LITE_URL, { config: canonicalLiteConfig(config), theme })
  const saas = await openSaas(context, { config, theme })
  return { lite, saas }
}

async function expectSame(a: Buffer, b: Buffer, testInfo: TestInfo, label: string) {
  const result = comparePngs(a, b)
  if (result.ratio > MAX_DIFF_RATIO) {
    await testInfo.attach(`diff-${label}.png`, { body: result.diffPng, contentType: 'image/png' })
  }
  expect(result.ratio, `${label}: ${result.diffPixels} of ${result.width * result.height} pixels differ`).toBeLessThanOrEqual(
    MAX_DIFF_RATIO,
  )
}

for (const { fixture, config, theme } of MATRIX) {
  test(`the SaaS page matches Lite: ${fixture} / ${theme}`, async ({ browser }, testInfo) => {
    const context = await newIsolatedContext(browser)
    const { lite, saas } = await openBoth(context, config, theme)
    await expectSame(
      await lite.locator('body').screenshot(),
      await saas.locator('.lite-area').screenshot(),
      testInfo,
      `${fixture}-${theme}`,
    )
    await context.close()
  })
}

for (const { state, theme } of STATE_CASES) {
  test(`the SaaS page matches Lite after ${state}: complex / ${theme}`, async ({ browser }, testInfo) => {
    const context = await newIsolatedContext(browser)
    const { lite, saas } = await openBoth(context, FIXTURES.complex, theme)
    // The SaaS header sits above the Lite area; the scroll step needs its height to show the same content.
    const offset = await saas.evaluate(() => document.querySelector('.lite-area')!.getBoundingClientRect().top)
    expect(offset, 'the SaaS header is above the Lite area').toBeGreaterThan(0)
    await STATES[state](lite, 0)
    await STATES[state](saas, offset)
    if (state === 'scrolled') {
      // A viewport too tall to scroll would make this state a second copy of the default one.
      expect(await lite.evaluate(() => window.scrollY), 'Lite scrolled').toBe(400)
      expect(await saas.evaluate(() => window.scrollY), 'SaaS scrolled').toBe(400 + offset)
    }
    if (!KEEPS_POINTER.includes(state)) {
      await parkPointer(lite)
      await parkPointer(saas)
    }
    const [a, b] = VIEWPORT_STATES.includes(state)
      ? [await lite.screenshot(), await saas.screenshot()]
      : [await lite.locator('body').screenshot(), await saas.locator('.lite-area').screenshot()]
    await expectSame(a, b, testInfo, `${state}-${theme}`)
    await context.close()
  })
}

test('switching the theme in the SaaS select applies, caches and saves it, and matches Lite under dark', async ({
  browser,
}, testInfo) => {
  const context = await newIsolatedContext(browser)
  const config = FIXTURES.complex
  const saas = await openSaas(context, { config, theme: 'light' })
  await saas.locator('.theme-select').selectOption('dark')
  await expect(saas.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await saas.evaluate(() => localStorage.getItem('roadmapsnap-theme'))).toBe('dark')
  await expect.poll(() => recordedPatches(saas)).toEqual([{ preferences: { theme: 'dark' } }])
  await saas.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
  const lite = await openLite(context, LITE_URL, { config: canonicalLiteConfig(config), theme: 'dark' })
  await expectSame(
    await lite.locator('body').screenshot(),
    await saas.locator('.lite-area').screenshot(),
    testInfo,
    'theme-switch-dark',
  )
  await context.close()
})

test('negative control: a one-pixel style change in the SaaS page is detected', async ({ browser }) => {
  const context = await newIsolatedContext(browser)
  const { lite, saas } = await openBoth(context, FIXTURES.minimal, 'light')
  await saas.addStyleTag({ content: '.kpi-value { letter-spacing: 1px }' })
  const result = comparePngs(await lite.locator('body').screenshot(), await saas.locator('.lite-area').screenshot())
  expect(result.diffPixels).toBeGreaterThan(0)
  expect(result.ratio).toBeGreaterThan(0)
  await context.close()
})
