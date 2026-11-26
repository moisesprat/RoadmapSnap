// The SaaS page end to end with mocked API responses: workspaces and projects load through TanStack Query, core
// apiToRoadmap adapts the raw payload, and the .lite-area equals Lite's own page for the same data (D-02, D-15).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'
import { Auth0TestProvider } from '../test/auth0Stub'
import { normalizeMarkup } from '../test/goldenMarkup'
import { liteModelFor, loadLiteRenderers } from '../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { canonicalRoadmap, roadmapToApi } from '../../../../tests/helpers/roadmapToApi.js'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

interface Routes {
  workspaces?: unknown
  projects?: unknown
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, statusText: String(status), json: async () => body }
}

// A fetch stub keyed by path; a path without an entry answers 404.
function stubApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) {
      return jsonResponse({ sub: 's', email: 'e', name: 'n', preferences: { theme: 'light' }, role: 'editor', orgId: 'o', orgs: [] })
    }
    if (url.endsWith('/api/v1/workspaces') && routes.workspaces !== undefined) return jsonResponse(routes.workspaces)
    if (/\/api\/v1\/workspaces\/[^/]+\/projects$/.test(url) && routes.projects !== undefined) return jsonResponse(routes.projects)
    return jsonResponse({ message: 'Not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Auth0TestProvider>
      <QueryClientProvider client={client}>
        <DashboardPage />
      </QueryClientProvider>
    </Auth0TestProvider>,
  )
}

// The version line differs between products by design (build constants), so both sides drop its text.
function withoutBuildVersion(root: Element): Element {
  root.querySelectorAll('.build-version').forEach((el) => {
    el.textContent = ''
  })
  return root
}

beforeAll(async () => {
  await loadLiteRenderers()
})

beforeEach(() => {
  // Lite's fixtures use TODAY 15/04/2026; the page reads the clock.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-04-15T12:00:00Z'))
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DashboardPage golden page', () => {
  it("renders the minimal fixture's .lite-area equal to Lite's renderPageHTML", async () => {
    const payload = roadmapToApi(minimalConfig)
    stubApi({ workspaces: { workspaces: [{ id: WORKSPACE_ID, name: 'WS', slug: 'ws' }] }, projects: payload })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())

    const lite = await loadLiteRenderers()
    await liteModelFor(canonicalRoadmap(minimalConfig))
    const expected = document.createElement('div')
    expected.className = 'lite-area'
    expected.innerHTML = (lite.renderPageHTML as (state: unknown) => string)(lite.AppState.get())

    expect(normalizeMarkup(withoutBuildVersion(container.querySelector('.lite-area') as Element))).toBe(
      normalizeMarkup(withoutBuildVersion(expected)),
    )
  })

  it('keeps .filter-bar a direct child of .lite-area and nests the dashboard and grid in #roadmap-export', async () => {
    stubApi({
      workspaces: { workspaces: [{ id: WORKSPACE_ID, name: 'WS', slug: 'ws' }] },
      projects: roadmapToApi(minimalConfig),
    })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    const area = container.querySelector('.lite-area') as Element
    expect(Array.from(area.children).map((el) => el.className.split(' ')[0])).toEqual([
      'filter-bar',
      'export-controls',
      'roadmap-container',
      'page-footer',
      'build-version',
    ])
    expect(area.querySelector('#roadmap-export #summary-section')).not.toBeNull()
    expect(area.querySelector('#roadmap-export #timeline-section')).not.toBeNull()
  })
})
