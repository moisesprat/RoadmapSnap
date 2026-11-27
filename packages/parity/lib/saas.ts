import { expect, type BrowserContext, type Page } from '@playwright/test'
import { FIXED_NOW } from './lite'
// @ts-ignore plain JavaScript test helper without declarations
import { roadmapToApi } from '../../../tests/helpers/roadmapToApi.js'

/** The SaaS page (parity.html: the real DashboardPage with a stub Auth0 context), served on 4303 by playwright.config. */
export const SAAS_URL = 'http://127.0.0.1:4303/parity.html'

const ORG_ID = '00000000-0000-4000-8000-0000000000a1'

export interface InstallApiStubsOptions {
  config: unknown
  theme: string
  role?: 'viewer' | 'editor' | 'admin'
}

const patchBodies = new WeakMap<Page, unknown[]>()

/** The JSON bodies of every PATCH /auth/me the page sent, in order. */
export function recordedPatches(page: Page): unknown[] {
  return patchBodies.get(page) ?? []
}

/**
 * Answers the four API routes the SaaS page calls, with the same canonical data Lite renders: GET /auth/me, PATCH
 * /auth/me (recorded and echoed), GET /api/v1/workspaces and GET /api/v1/workspaces/:id/projects (roadmapToApi).
 */
export async function installApiStubs(
  page: Page,
  { config, theme, role = 'editor' }: InstallApiStubsOptions,
): Promise<void> {
  const payload = roadmapToApi(config)
  let preferences = { theme }
  const recorded: unknown[] = []
  patchBodies.set(page, recorded)

  await page.route('**/auth/me', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as { preferences?: { theme: string } }
      recorded.push(body)
      if (body.preferences) preferences = { ...preferences, ...body.preferences }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ sub: 'parity|user', email: 'parity@example.test', name: 'Parity User', preferences }),
      })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        sub: 'parity|user',
        email: 'parity@example.test',
        name: 'Parity User',
        preferences,
        role,
        orgId: ORG_ID,
        orgs: [{ id: ORG_ID, name: 'Parity Org', role }],
      }),
    })
  })
  await page.route('**/api/v1/workspaces', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        workspaces: [{ id: payload.workspace.id, name: payload.workspace.name, slug: payload.workspace.slug }],
      }),
    }),
  )
  await page.route('**/api/v1/workspaces/*/projects', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) }),
  )
}

export interface OpenSaasOptions {
  config: unknown
  theme: string
  role?: 'viewer' | 'editor' | 'admin'
}

/**
 * Opens the SaaS page rendering `config` (served through the stubbed API) in `theme`, with the clock frozen like
 * openLite. Resolves once the Lite area is drawn and fonts are loaded.
 */
export async function openSaas(
  context: BrowserContext,
  { config, theme, role }: OpenSaasOptions,
  baseUrl: string = SAAS_URL,
): Promise<Page> {
  const page = await context.newPage()
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await installApiStubs(page, { config, theme, role })
  await page.goto(baseUrl)
  await page.waitForSelector('.lite-area .summary-dashboard')
  // The version line differs between the products; hide it but keep its layout space, as openLite does for Lite.
  const buildText = await page.locator('.build-version').textContent()
  expect(buildText).toMatch(/^v.+ · Build /)
  await page.addStyleTag({ content: '.build-version { visibility: hidden !important; }' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
  return page
}
