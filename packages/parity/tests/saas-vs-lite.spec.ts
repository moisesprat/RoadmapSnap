import { test, expect } from '@playwright/test'
import { comparePngs, MAX_DIFF_RATIO } from '../lib/compare'
import { canonicalLiteConfig, FIXTURES, newIsolatedContext, openLite } from '../lib/lite'
import { openSaas } from '../lib/saas'

// The page-level Lite-vs-SaaS check (D-08..D-11): Lite on 4302 renders the canonical roadmap of a fixture; the real
// SaaS page on 4303 (DashboardPage, stub Auth0) renders the same fixture through stubbed API routes. Lite's body is
// compared with the SaaS .lite-area: both carry the same 20px page padding, so the screenshots have equal dimensions.
const LITE_URL = 'http://127.0.0.1:4302/'

test('minimal / light: the SaaS page matches Lite', async ({ browser }, testInfo) => {
  const config = FIXTURES.minimal
  const context = await newIsolatedContext(browser)
  const lite = await openLite(context, LITE_URL, { config: canonicalLiteConfig(config), theme: 'light' })
  const saas = await openSaas(context, { config, theme: 'light' })
  const result = comparePngs(await lite.locator('body').screenshot(), await saas.locator('.lite-area').screenshot())
  if (result.ratio > MAX_DIFF_RATIO) {
    await testInfo.attach('diff.png', { body: result.diffPng, contentType: 'image/png' })
  }
  expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO)
  await context.close()
})
