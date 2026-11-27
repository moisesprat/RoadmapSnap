import { test, expect, type Page } from '@playwright/test'
import { FIXTURES, canonicalLiteConfig, newIsolatedContext, openLite } from '../lib/lite'
import { openSaas } from '../lib/saas'
import { STATES } from '../lib/states'

// Behavior that a screenshot cannot show, checked on both products with the same steps (VIEW-03).
const LITE_URL = 'http://127.0.0.1:4302/'

async function openPages(browser: import('@playwright/test').Browser): Promise<{ name: string; page: Page }[]> {
  const context = await newIsolatedContext(browser)
  const config = FIXTURES.complex
  return [
    { name: 'Lite', page: await openLite(context, LITE_URL, { config: canonicalLiteConfig(config), theme: 'light' }) },
    { name: 'SaaS', page: await openSaas(context, { config, theme: 'light' }) },
  ]
}

test('after a debounced search the search input keeps focus with the caret at the end', async ({ browser }) => {
  for (const { name, page } of await openPages(browser)) {
    await STATES.search(page, 0)
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null
      return {
        isSearch: el?.classList.contains('filter-input') ?? false,
        value: el?.value ?? '',
        caret: el?.selectionStart ?? -1,
      }
    })
    expect(focus.isSearch, `${name}: focus is on the search input`).toBe(true)
    expect(focus.value, `${name}: the search term is kept`).toBe('Platform')
    expect(focus.caret, `${name}: the caret is at the end`).toBe(focus.value.length)
  }
})

test('a click outside the exclusion list clears an active status filter', async ({ browser }) => {
  for (const { name, page } of await openPages(browser)) {
    await STATES.status(page, 0)
    expect(await page.locator('.kpi-card.active').count(), `${name}: the status filter is active`).toBeGreaterThan(0)
    await page.locator('.page-footer').click()
    await expect(page.locator('.kpi-card.active'), `${name}: the status filter is cleared`).toHaveCount(0)
  }
})
