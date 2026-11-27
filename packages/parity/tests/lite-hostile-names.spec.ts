import { test, expect } from '@playwright/test'
import { FIXTURES, newIsolatedContext, openLite } from '../lib/lite'

// Real clicks on Lite with config text that is hostile to a JavaScript string or an HTML attribute (WR-04). The
// click handlers must receive the exact text, and none of it may run.
const LITE_URL = 'http://127.0.0.1:4302/'

const INJECTION = "x');window.PWNED=1;//"
const APOSTROPHE = "Team's API"

function hostileConfig(group: string) {
  const config: any = structuredClone(FIXTURES.minimal)
  const names: Record<string, string> = { 'Task Alpha': INJECTION, 'Task Beta': APOSTROPHE }
  const rename = (n: string) => names[n] ?? n
  for (const d of config.DELIVERABLES) {
    d.name = rename(d.name)
    if (d.group) d.group = group
    if (d.dependencies) d.dependencies = d.dependencies.map(rename)
  }
  config.WORKFLOW.find((item: any) => item.key === 'DEV').key = APOSTROPHE
  return config
}

for (const group of ['R&D', 'A <b> "quoted" group', "Moe's &amp; co", INJECTION]) {
  test(`Lite controls work and run no config text: group ${group}`, async ({ browser }) => {
    const context = await newIsolatedContext(browser)
    const page = await openLite(context, LITE_URL, { config: hostileConfig(group), theme: 'light' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    const rows = page.locator('.data-source-row')
    const total = await rows.count()
    await page.locator('.group-header').click()
    await expect(page.locator('.group-chevron.collapsed'), 'the group collapses').toHaveCount(1)
    expect(await rows.count()).toBeLessThan(total)
    await page.locator('.group-header-name').click()
    await expect(rows, 'the group expands again').toHaveCount(total)

    for (const name of [INJECTION, APOSTROPHE]) {
      const row = rows.filter({ has: page.getByText(name, { exact: true }) })
      // The click lands on the SVG inside the icon, and the open graph must survive the outside-click listener.
      await row.locator('.dependency-icon svg').click()
      await expect(row.locator('.dependency-icon.active'), `the graph of ${name} opens`).toHaveCount(1)
      await page.waitForSelector('#dependency-arrows-svg')
      await row.locator('.dependency-icon svg').click()
      await expect(page.locator('.dependency-icon.active'), `the graph of ${name} closes`).toHaveCount(0)
    }

    const card = page.locator('.kpi-card.clickable', { hasText: 'In Development' })
    await card.locator('.kpi-label').click()
    await expect(page.locator('.kpi-card.clickable.active'), 'the status filter applies').toHaveCount(1)
    await expect(card).toHaveClass(/active/)
    await card.locator('.kpi-label').click()
    await expect(page.locator('.kpi-card.clickable.active'), 'the status filter clears').toHaveCount(0)

    expect(await page.evaluate(() => (window as any).PWNED), 'config text did not run').toBeUndefined()
    expect(errors, 'no script errors').toEqual([])
    await context.close()
  })
}
