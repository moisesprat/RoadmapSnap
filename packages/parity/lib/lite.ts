import { expect, type BrowserContext, type Page } from '@playwright/test'
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js'
import { complexConfig } from '../../../tests/fixtures/config.complex.js'
// @ts-ignore plain JavaScript test helper without declarations
import { canonicalRoadmap } from '../../../tests/helpers/roadmapToApi.js'
// @ts-ignore relative path: the container installs only this workspace, so the core package is not linked
import { getFirstMilestoneKey, normalizeWorkflow } from '../../core/src/index.js'

/** The fixed "now" for every render; the fixtures use TIMELINE.TODAY 15/04/2026. */
export const FIXED_NOW = new Date('2026-04-15T12:00:00Z')

export const FIXTURES = { minimal: minimalConfig, complex: complexConfig } as const

/** The eight Lite themes, in the order of the theme select in js/ui/filterBar.js. */
export const THEME_MATRIX = [
  'light',
  'dark',
  'professional',
  'colorful',
  'blank',
  'monochrome',
  'papallona',
  'evergreen',
] as const

export interface OpenLiteOptions {
  config: unknown
  theme: string
  /** Runs after the first render and before the final waits (for example to open a menu). */
  statePrep?: (page: Page) => Promise<void>
}

/** Body of the classic script that replaces js/config.js. */
export function liteConfigScript(config: unknown): string {
  return `const CONFIG = ${JSON.stringify(config)};`
}

/** A context that aborts every request whose host is not 127.0.0.1 or localhost (D-08). */
export async function newIsolatedContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
  const context = await browser.newContext()
  await context.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  return context
}

/** Opens Lite from `baseUrl` rendering `config` in `theme`, with a frozen clock. */
export async function openLite(
  context: BrowserContext,
  baseUrl: string,
  { config, theme, statePrep }: OpenLiteOptions,
): Promise<Page> {
  const page = await context.newPage()
  // setFixedTime freezes Date but keeps timers running (Lite draws arrows in setTimeout).
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: liteConfigScript(config) }),
  )
  await page.goto(baseUrl)
  await page.waitForSelector('.summary-dashboard')
  if (statePrep) await statePrep(page)
  // The build footer text differs between products; hide it but keep its layout space.
  const buildText = await page.locator('.build-version').textContent()
  expect(buildText).toMatch(/^v.+ · Build /)
  await page.addStyleTag({ content: '.build-version { visibility: hidden !important; }' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
  return page
}

/**
 * The config Lite renders for `fixture`: the canonical roadmap (one trip through the API shape and the adapter), with
 * the first milestone key present on every deliverable because Lite's validator rejects a page without it. The adapter
 * drops an empty milestone; Lite writes it as ''. Both mean "no date".
 */
export function canonicalLiteConfig(fixture: unknown): any {
  const config = canonicalRoadmap(fixture)
  const firstKey = getFirstMilestoneKey(normalizeWorkflow(config))
  for (const deliverable of config.DELIVERABLES) {
    if (deliverable.milestones[firstKey] === undefined) deliverable.milestones[firstKey] = ''
  }
  return config
}
