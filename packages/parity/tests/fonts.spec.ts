import { test, expect } from '@playwright/test'
import { FIXTURES, newIsolatedContext, openLite } from '../lib/lite'

const URL_B = 'http://127.0.0.1:4302/'

// Every non-localhost request is aborted by newIsolatedContext, so DM Sans can only load
// from the files bundled through @roadmapsnap/tokens (T-02-18).
test('DM Sans loads offline under evergreen from the token package', async ({ browser }) => {
  const context = await newIsolatedContext(browser)
  const externalRequests: string[] = []
  context.on('request', (request) => {
    const { hostname } = new URL(request.url())
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') externalRequests.push(request.url())
  })

  const page = await openLite(context, URL_B, { config: FIXTURES.complex, theme: 'evergreen' })

  const probe = await page.evaluate(async () => {
    await document.fonts.ready
    const faces = Array.from(document.fonts).filter((f) => f.family.replace(/["']/g, '') === 'DM Sans')
    return {
      declared: faces.length,
      loaded: faces.filter((f) => f.status === 'loaded').length,
      check: document.fonts.check('16px "DM Sans"'),
      bodyFamily: getComputedStyle(document.body).fontFamily,
    }
  })

  expect(probe.declared).toBeGreaterThan(0)
  expect(probe.loaded).toBeGreaterThan(0)
  expect(probe.check).toBe(true)
  expect(probe.bodyFamily.replace(/["']/g, '')).toMatch(/^DM Sans/)
  // No request was ever made to a third party for the font (Google Fonts links are gone).
  expect(externalRequests.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([])
  await context.close()
})
