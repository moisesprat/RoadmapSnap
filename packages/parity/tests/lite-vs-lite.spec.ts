import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js'

const FIXED_NOW = new Date('2026-04-15T12:00:00Z')
const MAX_DIFF_RATIO = 0.001

async function openLite(context: BrowserContext, baseUrl: string, theme: string): Promise<Page> {
  const page = await context.newPage()
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: `const CONFIG = ${JSON.stringify(minimalConfig)};` }),
  )
  await page.goto(baseUrl)
  await page.waitForSelector('.summary-dashboard')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  })
  return page
}

test('tracer: Lite A and Lite B render identically (minimal, light)', async ({ browser }, testInfo) => {
  const context = await browser.newContext()
  // D-08: nothing but the local servers may be reached (no CDN, no Google Fonts).
  await context.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  const a = await openLite(context, 'http://127.0.0.1:4301/', 'light')
  const b = await openLite(context, 'http://127.0.0.1:4302/', 'light')
  const pngA = PNG.sync.read(await a.locator('body').screenshot())
  const pngB = PNG.sync.read(await b.locator('body').screenshot())
  expect([pngA.width, pngA.height]).toEqual([pngB.width, pngB.height])
  const diff = new PNG({ width: pngA.width, height: pngA.height })
  const bad = pixelmatch(pngA.data, pngB.data, diff.data, pngA.width, pngA.height, { threshold: 0.1 })
  const ratio = bad / (pngA.width * pngA.height)
  if (ratio > MAX_DIFF_RATIO) {
    await testInfo.attach('diff.png', { body: PNG.sync.write(diff), contentType: 'image/png' })
  }
  expect(ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO)
  await context.close()
})
