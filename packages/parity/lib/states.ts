import type { Page } from '@playwright/test'

/**
 * Interaction states applied identically to the Lite page and the SaaS page (VIEW-03, VIEW-04). Each step uses only
 * selectors both products share. `offset` is the height above the Lite area: 0 on Lite, the SaaS header on the SaaS
 * page, so the scroll step shows the same content in both viewports.
 */
export type StateStep = (page: Page, offset: number) => Promise<void>

/** Two animation frames, so a re-render and the arrow overlay (measured after the commit) have settled. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
}

/** Parks the pointer away from the page, so no hover style differs between the two layouts. */
export async function parkPointer(page: Page): Promise<void> {
  await page.mouse.move(1, 1)
  await settle(page)
}

export const STATES = {
  /** A search typed into the filter input; Lite and the app both debounce it. */
  search: async (page) => {
    await page.locator('.filter-input').fill('Platform')
    await page.waitForTimeout(300)
    await settle(page)
  },
  /** The second KPI status card selected. */
  status: async (page) => {
    await page.locator('.kpi-card.clickable').nth(1).click()
    await settle(page)
  },
  /** The risk summary toggled on. */
  riskOnly: async (page) => {
    await page.locator('.risk-summary.clickable').click()
    await settle(page)
  },
  /** The 6 month zoom. */
  zoom6: async (page) => {
    await page.locator('.zoom-btn', { hasText: '6mo' }).click()
    await settle(page)
  },
  /** Every group collapsed. */
  collapsed: async (page) => {
    await page.getByRole('button', { name: 'Collapse All' }).click()
    await settle(page)
  },
  /** The dependency graph of a row with both directions open, with the pointer on the first arrow. */
  graphHover: async (page) => {
    await page.locator('.dependency-icon.both').first().click()
    await page.waitForSelector('#dependency-arrows-svg g path[stroke="transparent"]')
    await settle(page)
    const point = await page.evaluate(() => {
      const path = document.querySelector<SVGPathElement>('#dependency-arrows-svg g path[stroke="transparent"]')!
      const matrix = path.getScreenCTM()!
      const p = path.getPointAtLength(path.getTotalLength() / 2)
      return { x: p.x * matrix.a + p.y * matrix.c + matrix.e, y: p.x * matrix.b + p.y * matrix.d + matrix.f }
    })
    await page.mouse.move(point.x, point.y)
    await settle(page)
  },
  /** Scrolled so the sticky filter bar is pinned; a short viewport makes the page scrollable. */
  scrolled: async (page, offset) => {
    await page.setViewportSize({ width: 1440, height: 700 })
    await page.evaluate((y) => window.scrollTo(0, y), 400 + offset)
    await settle(page)
  },
} satisfies Record<string, StateStep>

export type StateName = keyof typeof STATES

/** The states whose screenshot is the viewport rather than the element. */
export const VIEWPORT_STATES: readonly StateName[] = ['scrolled']

/** A step that leaves the pointer where it clicked or hovered; the others get the pointer parked. */
export const KEEPS_POINTER: readonly StateName[] = ['graphHover']
