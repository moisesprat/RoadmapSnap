import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import { FIXTURES, THEME_MATRIX, newIsolatedContext } from '../lib/lite'
import { openSaas } from '../lib/saas'

// PNG export smoke (VIEW-06, D-12): under every theme the SaaS "Export Full Roadmap" downloads a real PNG named after
// the frozen date. html2canvas paints the container's 8px rounded corner over the #ffffff background it is given, so
// pixel (0,0) must be opaque white whatever the theme.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

for (const theme of THEME_MATRIX) {
  test(`Export Full Roadmap downloads an opaque-white-cornered PNG: ${theme}`, async ({ browser }) => {
    const context = await newIsolatedContext(browser)
    const page = await openSaas(context, { config: FIXTURES.complex, theme })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Full Roadmap' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('Full-Roadmap-15-04-2026.png')
    const bytes = readFileSync(await download.path())
    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'the file starts with the PNG signature').toBe(true)
    const image = PNG.sync.read(bytes)
    expect(image.width).toBeGreaterThan(0)
    expect(Array.from(image.data.subarray(0, 4))).toEqual([255, 255, 255, 255])
    await context.close()
  })
}
