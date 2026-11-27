// Guards the "Lite area is not restyled by app CSS" contract (RESEARCH Pitfall 6) and the sticky filter bar.
// The Lite filter bar is `position: sticky; top: 10px` (packages/tokens/lite.css). Sticky resolves against the nearest
// scrolling ancestor, so any overflow on html, body or #root, or on an ancestor of .lite-area, silently turns the page
// into a scroll container and the bar scrolls away with the content. jsdom has no layout, so these checks are
// structural: they read the CSS and the rendered ancestors instead of measuring a scroll. The sticky behavior itself
// still needs a look in a real browser.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '../pages/DashboardPage'
import { Auth0TestProvider } from './auth0Stub'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { roadmapToApi } from '../../../../tests/helpers/roadmapToApi.js'
// @ts-ignore
import { minimalConfig } from '../../../../tests/fixtures/config.minimal.js'

// The app has no Node type declarations, so the fs module is reached through a dynamic import of a variable.
const FS_MODULE = 'node:fs'
const appRoot = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '')).replace(/src\/test\/[^/]*$/, '')

let indexCss = ''
let mainTsx = ''
let tailwindConfig = ''
let liteCss = ''

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ FS_MODULE)
  indexCss = fs.readFileSync(appRoot + 'src/index.css', 'utf8') as string
  mainTsx = fs.readFileSync(appRoot + 'src/main.tsx', 'utf8') as string
  tailwindConfig = fs.readFileSync(appRoot + 'tailwind.config.ts', 'utf8') as string
  liteCss = fs.readFileSync(appRoot + '../tokens/lite.css', 'utf8') as string
})

interface Rule {
  selector: string
  body: string
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Flat list of the rule blocks in a stylesheet with comments removed (at-rules are flattened to their inner rules). */
function rulesOf(css: string): Rule[] {
  const text = stripComments(css)
  const rules: Rule[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    // A selector never contains `;`, so anything before the last one is a statement such as `@tailwind base;`.
    rules.push({ selector: m[1].slice(m[1].lastIndexOf(';') + 1).trim(), body: m[2] })
  }
  return rules
}

describe('main.tsx stylesheet imports', () => {
  it('imports tokens, components, then lite.css, then the app stylesheet last', () => {
    const order = ['@roadmapsnap/tokens/css', '@roadmapsnap/tokens/components.css', '@roadmapsnap/tokens/lite.css', './index.css']
    const at = order.map((spec) => mainTsx.indexOf(`'${spec}'`))
    expect(at.every((i) => i > -1)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('no longer uses the html.dark class helper', () => {
    expect(mainTsx).not.toContain('themeStorage')
  })
})

describe('lite.css carries the sticky filter bar', () => {
  it('declares position: sticky with top: 10px on .filter-bar', () => {
    const bar = rulesOf(liteCss).filter((r) => r.selector === '.filter-bar' && /position:\s*sticky/.test(r.body))
    expect(bar.length).toBeGreaterThan(0)
    expect(bar[0].body).toMatch(/top:\s*10px/)
  })
})

describe('index.css cannot break sticky or restyle the Lite area', () => {
  it('sets no overflow, transform or containment on html, body, #root or .lite-area', () => {
    const offenders = rulesOf(indexCss).filter((r) => {
      const targets = r.selector.split(',').map((s) => s.trim())
      const hitsPage = targets.some((s) => /^(html|body|#root|:root)\b/.test(s) || s.includes('.lite-area'))
      return hitsPage && /(^|[;\s])(overflow(-x|-y)?|transform|contain|filter|perspective|will-change)\s*:/.test(r.body)
    })
    expect(offenders).toEqual([])
  })

  it('has no overflow declaration anywhere', () => {
    expect(stripComments(indexCss)).not.toMatch(/overflow(-x|-y)?\s*:/)
  })

  it('has no html.dark rules and no rule that targets .lite-area or Lite class names', () => {
    const css = stripComments(indexCss)
    expect(css).not.toContain('html.dark')
    expect(css).not.toContain('.lite-area')
    for (const lite of ['.filter-bar', '.filter-group', '.export-btn', '.progress-bar-container', '.summary-dashboard']) {
      expect(css).not.toContain(lite)
    }
  })

  it('gives body margin 0 and padding 0 for the SaaS page', () => {
    const bodyRules = rulesOf(indexCss).filter((r) => r.selector === 'body')
    const css = bodyRules.map((r) => r.body).join(';')
    expect(css).toMatch(/margin:\s*0/)
    expect(css).toMatch(/padding:\s*0/)
  })
})

describe('tailwind config', () => {
  it('disables preflight and keys dark mode to data-theme', () => {
    expect(tailwindConfig).toContain('preflight: false')
    expect(tailwindConfig).toContain(`darkMode: ['selector', '[data-theme="dark"]']`)
  })
})

// The page renders .lite-area directly under the router; nothing between it and #root may scroll or transform.
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the rendered page', () => {
  it('has no overflow or transform on any ancestor of .lite-area', async () => {
    const payload = roadmapToApi(minimalConfig)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input)
        const ok = (b: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => b })
        if (url.endsWith('/auth/me')) {
          return ok({ sub: 's', email: 'e', name: 'n', preferences: { theme: 'light' }, role: 'editor', orgId: 'o', orgs: [] })
        }
        if (url.endsWith('/api/v1/workspaces')) {
          return ok({ workspaces: [{ id: WORKSPACE_ID, name: 'Main', slug: 'main' }] })
        }
        if (/\/api\/v1\/workspaces\/[^/]+\/projects$/.test(url)) return ok(payload)
        return { ok: false, status: 404, statusText: '404', json: async () => ({}) }
      }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <Auth0TestProvider>
        <QueryClientProvider client={client}>
          <DashboardPage />
        </QueryClientProvider>
      </Auth0TestProvider>,
    )
    await screen.findByRole('button', { name: 'Manage projects' })
    const lite = await vi.waitFor(() => {
      const el = container.querySelector('.lite-area')
      if (!el) throw new Error('lite area not rendered yet')
      return el
    })
    let node: Element | null = lite.parentElement
    while (node && node !== container.ownerDocument.documentElement) {
      expect(node.className.toString(), `${node.tagName} class`).not.toMatch(/(^|\s)(overflow|transform|will-change|filter|backdrop|contain)/)
      const style = (node as HTMLElement).style
      expect(style.overflow, `${node.tagName} overflow`).toBe('')
      expect(style.overflowX).toBe('')
      expect(style.overflowY).toBe('')
      expect(style.transform).toBe('')
      node = node.parentElement
    }
  })
})
