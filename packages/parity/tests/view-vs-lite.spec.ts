import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { comparePngs, MAX_DIFF_RATIO } from '../lib/compare'
import { canonicalLiteConfig, FIXED_NOW, FIXTURES, newIsolatedContext, openLite } from '../lib/lite'
// @ts-ignore plain JavaScript test helper without declarations
import { roadmapToApi } from '../../../tests/helpers/roadmapToApi.js'

// Early Lite-vs-SaaS pixel check (D-08, D-10, D-15). Lite on 4302 (always the HEAD build) renders the canonical
// roadmap; the React preview on 4303 (LiteRoadmapView) renders the same fixture after a trip through roadmapToApi and
// apiToRoadmap. A skipped fixture must not pass silently: the suite is exactly one region test per fixture, the
// full-area test for the minimal fixture and the negative control (4 tests).
if (Object.keys(FIXTURES).sort().join() !== 'complex,minimal') {
  throw new Error('view-vs-lite expects exactly the minimal and complex fixtures')
}

const LITE_URL = 'http://127.0.0.1:4302/'
const VIEW_URL = 'http://127.0.0.1:4303/parity-view.html'

/** Opens Lite on the canonical roadmap of `fixture` (the timeline included, as the preview renders it). */
function openLiteFor(context: BrowserContext, fixture: unknown): Promise<Page> {
  return openLite(context, LITE_URL, { config: canonicalLiteConfig(fixture), theme: 'light' })
}

/** Opens the React preview on `baseUrl`, serving roadmapToApi(config) as the payload, with a frozen clock. */
async function openView(
  context: BrowserContext,
  { config, theme }: { config: unknown; theme: string },
): Promise<Page> {
  const page = await context.newPage()
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await page.route('**/parity-view/payload.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(roadmapToApi(config)) }),
  )
  await page.goto(VIEW_URL)
  await page.waitForSelector('.lite-area .summary-dashboard')
  // The version line differs between the products; hide it but keep its layout space, as openLite does for Lite.
  await page.addStyleTag({ content: '.build-version { visibility: hidden !important; }' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
  return page
}

async function expectRegionMatches(lite: Page, view: Page, selector: string, testInfo: import('@playwright/test').TestInfo) {
  let result: ReturnType<typeof comparePngs>
  try {
    result = comparePngs(
      await lite.locator(selector).first().screenshot(),
      await view.locator(selector).first().screenshot(),
    )
  } catch (err) {
    throw new Error(`${selector}: ${(err as Error).message}`)
  }
  if (result.ratio > MAX_DIFF_RATIO) {
    await testInfo.attach(`diff-${selector}.png`, { body: result.diffPng, contentType: 'image/png' })
  }
  expect(result.ratio, `${selector} differs from Lite`).toBeLessThanOrEqual(MAX_DIFF_RATIO)
}

const REGIONS = ['.filter-bar', '.export-controls', '#summary-section', '.page-footer']

for (const [fixture, config] of Object.entries(FIXTURES)) {
  test(`the React Lite area matches Lite region by region: ${fixture} / light`, async ({ browser }, testInfo) => {
    const context = await newIsolatedContext(browser)
    const lite = await openLiteFor(context, config)
    const view = await openView(context, { config, theme: 'light' })
    for (const selector of REGIONS) {
      await expectRegionMatches(lite, view, selector, testInfo)
    }
    await context.close()
  })
}

// The first full-area React-vs-Lite check: Lite's body against the preview's .lite-area, so the timeline model (02-11)
// and the timeline markup (02-13) are pixel-checked before the page chrome is added (VIEW-01, D-08). Both carry the
// same 20px page padding through lite.css, so the two screenshots have the same dimensions.
test('the whole React Lite area matches Lite: minimal / light', async ({ browser }, testInfo) => {
  const context = await newIsolatedContext(browser)
  const lite = await openLiteFor(context, FIXTURES.minimal)
  const view = await openView(context, { config: FIXTURES.minimal, theme: 'light' })
  const [liteShot, viewShot] = [await lite.locator('body').screenshot(), await view.locator('.lite-area').screenshot()]
  const result = comparePngs(liteShot, viewShot)
  if (result.ratio > MAX_DIFF_RATIO) {
    await testInfo.attach('diff-whole-area.png', { body: result.diffPng, contentType: 'image/png' })
  }
  expect(result.ratio, 'the whole .lite-area differs from Lite body').toBeLessThanOrEqual(MAX_DIFF_RATIO)
  await context.close()
})

test('negative control: a one-pixel style change in the preview is detected', async ({ browser }) => {
  const context = await newIsolatedContext(browser)
  const config = FIXTURES.minimal
  const lite = await openLiteFor(context, config)
  const view = await openView(context, { config, theme: 'light' })
  await view.addStyleTag({ content: '.kpi-value { letter-spacing: 1px }' })
  const result = comparePngs(
    await lite.locator('#summary-section').screenshot(),
    await view.locator('#summary-section').screenshot(),
  )
  expect(result.diffPixels).toBeGreaterThan(0)
  expect(result.ratio).toBeGreaterThan(0)
  await context.close()
})
