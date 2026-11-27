// The SaaS page end to end with mocked API responses: workspaces and projects load through TanStack Query, core
// apiToRoadmap adapts the raw payload, and the .lite-area equals Lite's own page for the same data (D-02, D-15).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'
import { Auth0TestProvider } from '../test/auth0Stub'
import type { Auth0TestProviderProps } from '../test/auth0Stub'
import { normalizeMarkup } from '../test/goldenMarkup'
import { liteModelFor, loadLiteRenderers } from '../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { canonicalRoadmap, roadmapToApi } from '../../../../tests/helpers/roadmapToApi.js'

// Real captures need a browser; a rejected capture exercises the page's export-failure notice.
vi.mock('html2canvas', () => ({ default: vi.fn(() => Promise.reject(new Error('capture failed'))) }))

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

interface Routes {
  workspaces?: unknown
  projects?: unknown
  /** HTTP status for the projects route (default 200). */
  projectsStatus?: number
  /** Replaces the /auth/me answer. */
  me?: unknown
  /** HTTP status for PATCH /auth/me (default 200). */
  patchStatus?: number
}

const ME = { sub: 's', email: 'e', name: 'n', preferences: { theme: 'light' }, role: 'editor', orgId: 'o', orgs: [] }

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, statusText: String(status), json: async () => body }
}

// A fetch stub keyed by path; a path without an entry answers 404.
function stubApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: unknown, _init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) {
      if (_init?.method === 'PATCH') return jsonResponse(routes.me ?? ME, routes.patchStatus ?? 200)
      return jsonResponse(routes.me ?? ME)
    }
    if (url.endsWith('/api/v1/workspaces') && routes.workspaces !== undefined) return jsonResponse(routes.workspaces)
    if (/\/api\/v1\/workspaces\/[^/]+\/projects$/.test(url) && routes.projects !== undefined) {
      return jsonResponse(routes.projects, routes.projectsStatus ?? 200)
    }
    return jsonResponse({ message: 'Not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(overrides?: Auth0TestProviderProps['overrides']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Auth0TestProvider overrides={overrides}>
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

describe('DashboardPage theme', () => {
  it('applies a theme chosen in the Lite select, caches it and PATCHes /auth/me', async () => {
    const fetchMock = stubApi({
      workspaces: { workspaces: [{ id: WORKSPACE_ID, name: 'WS', slug: 'ws' }] },
      projects: roadmapToApi(minimalConfig),
    })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    const select = container.querySelector('.filter-bar select[title="Choose theme"]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'papallona' } })
    expect(document.documentElement.getAttribute('data-theme')).toBe('papallona')
    expect(localStorage.getItem('roadmapsnap-theme')).toBe('papallona')
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/auth/me') && init?.method === 'PATCH')
      expect(patch?.[1]?.body).toBe(JSON.stringify({ preferences: { theme: 'papallona' } }))
    })
  })
})

const ONE_WORKSPACE = { workspaces: [{ id: WORKSPACE_ID, name: 'WS', slug: 'ws' }] }

describe('DashboardPage loading', () => {
  it('shows three fixed-height blocks that pulse only without reduced motion', () => {
    // Nothing ever answers, so the page stays in its loading state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { container } = renderPage()
    const blocks = Array.from(container.querySelectorAll('.saas-skeleton-block')) as HTMLElement[]
    expect(blocks).toHaveLength(3)
    expect(blocks.map((b) => b.style.height).join(' ')).toBe('56px 240px 320px')
    for (const block of blocks) {
      expect(block.className).toMatch(/motion-safe:animate-/)
      expect(block.className.split(/\s+/).some((c) => c.startsWith('animate-'))).toBe(false)
      expect(block.className).toMatch(/bg-bg-secondary/)
    }
    expect(container.querySelector('.lite-area')).toBeNull()
  })
})

describe('DashboardPage load errors', () => {
  it('shows the load-error copy, the API message and a Retry loading button that refetches', async () => {
    const fetchMock = stubApi({ workspaces: ONE_WORKSPACE, projects: { message: 'Database unavailable' }, projectsStatus: 500 })
    renderPage()
    expect(await screen.findByText('Could not load the roadmap')).toBeInTheDocument()
    expect(screen.getByText('Check your connection and try again. If it keeps failing, sign out and back in.')).toBeInTheDocument()
    expect(screen.getByText('Database unavailable')).toBeInTheDocument()
    expect(document.querySelector('[role="alert"]')).not.toBeNull()
    const callsBefore = fetchMock.mock.calls.length
    stubApi({ workspaces: ONE_WORKSPACE, projects: roadmapToApi(minimalConfig) })
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
    await waitFor(() => expect(document.querySelector('.lite-area')).not.toBeNull())
    expect(callsBefore).toBeGreaterThan(0)
  })

  it('shows the session-expired copy on HTTP 401 and signs in again, with no developer hint', async () => {
    stubApi({ workspaces: ONE_WORKSPACE, projects: { message: 'Unauthorized' }, projectsStatus: 401 })
    const loginWithRedirect = vi.fn(async () => {})
    const { container } = renderPage({ loginWithRedirect })
    expect(await screen.findByText('Your session has expired')).toBeInTheDocument()
    expect(screen.getByText('Sign in again to continue.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(loginWithRedirect).toHaveBeenCalled()
    expect(container.textContent).not.toMatch(/auth0|AUTH0_DOMAIN|tenant/i)
    expect(screen.queryByText('Could not load the roadmap')).toBeNull()
  })
})

describe('DashboardPage empty states', () => {
  it('shows the no-workspaces state when the user can see no workspace', async () => {
    stubApi({ workspaces: { workspaces: [] } })
    renderPage()
    expect(await screen.findByText('No workspaces yet')).toBeInTheDocument()
    expect(
      screen.getByText('Your organization has no workspace you can view. Ask an admin to add you to one.'),
    ).toBeInTheDocument()
  })

  it('renders the Lite area with the editor notice when a workspace has no projects', async () => {
    stubApi({ workspaces: ONE_WORKSPACE, projects: { ...roadmapToApi(minimalConfig), projects: [] } })
    const { container } = renderPage()
    expect(
      await screen.findByText('This workspace has no projects yet. Use Add project to create the first one.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.lite-area .summary-dashboard')).not.toBeNull()
    expect(container.querySelectorAll('.data-source-row').length).toBe(0)
    const region = container.querySelector('[role="status"][aria-live="polite"]')
    expect(region?.textContent).toContain('This workspace has no projects yet.')
  })

  it('shows the shorter notice to viewers', async () => {
    stubApi({
      workspaces: ONE_WORKSPACE,
      projects: { ...roadmapToApi(minimalConfig), projects: [] },
      me: { ...ME, role: 'viewer' },
    })
    renderPage()
    expect(await screen.findByText('This workspace has no projects yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Use Add project/)).toBeNull()
  })

  it('shows Workflow not configured for a workspace without workflow steps', async () => {
    const payload = roadmapToApi(minimalConfig)
    payload.workspace.workflow_definition = []
    stubApi({ workspaces: ONE_WORKSPACE, projects: payload })
    const { container } = renderPage()
    expect(await screen.findByText('Workflow not configured')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This workspace has no workflow steps, so the roadmap cannot be drawn. Workflow editing is not available yet.',
      ),
    ).toBeInTheDocument()
    expect(container.querySelector('.lite-area')).toBeNull()
  })

  it("renders a project with no dates and no group as Lite renders such a deliverable", async () => {
    const config = structuredClone(minimalConfig)
    config.DELIVERABLES.push({ name: 'Undated item', milestones: {} })
    stubApi({ workspaces: ONE_WORKSPACE, projects: roadmapToApi(config) })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    const lite = await loadLiteRenderers()
    await liteModelFor(canonicalRoadmap(config))
    const expected = document.createElement('div')
    expected.className = 'lite-area'
    expected.innerHTML = (lite.renderPageHTML as (state: unknown) => string)(lite.AppState.get())
    expect(container.textContent).toContain('Undated item')
    expect(normalizeMarkup(withoutBuildVersion(container.querySelector('.lite-area') as Element))).toBe(
      normalizeMarkup(withoutBuildVersion(expected)),
    )
  })
})

describe('DashboardPage notices', () => {
  it('shows the PNG failure notice in the polite status region', async () => {
    stubApi({ workspaces: ONE_WORKSPACE, projects: roadmapToApi(minimalConfig) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Export Full Roadmap/ }))
    const region = await waitFor(() => {
      const found = container.querySelector('[role="status"][aria-live="polite"]')
      expect(found?.textContent).toContain('PNG export failed. Try again.')
      return found as Element
    })
    expect(region.nextElementSibling?.classList.contains('lite-area')).toBe(true)
  })

  it('keeps the theme and shows the save-failure notice, which can be dismissed', async () => {
    stubApi({ workspaces: ONE_WORKSPACE, projects: roadmapToApi(minimalConfig), patchStatus: 500 })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    const select = container.querySelector('.filter-bar select[title="Choose theme"]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'papallona' } })
    const text = 'Your theme could not be saved to your account. It is applied on this device only.'
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('papallona')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByText(text)).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe('papallona')
  })
})

describe('DashboardPage workspace switching', () => {
  it('resets the view state to defaults and keeps the theme', async () => {
    const SECOND_ID = '00000000-0000-4000-8000-000000000002'
    stubApi({
      workspaces: {
        workspaces: [
          { id: WORKSPACE_ID, name: 'First', slug: 'first' },
          { id: SECOND_ID, name: 'Second', slug: 'second' },
        ],
      },
      projects: roadmapToApi(minimalConfig),
    })
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    fireEvent.change(container.querySelector('.filter-bar select[title="Choose theme"]') as HTMLSelectElement, {
      target: { value: 'dark' },
    })
    const zoomButton = () => container.querySelector('.zoom-btn.active') as HTMLElement
    const initialZoom = zoomButton().textContent
    const other = Array.from(container.querySelectorAll('.zoom-btn')).find((b) => b.textContent !== initialZoom) as HTMLElement
    fireEvent.click(other)
    expect(zoomButton().textContent).toBe(other.textContent)

    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: SECOND_ID } })
    await waitFor(() => expect(container.querySelector('.lite-area')).not.toBeNull())
    expect(zoomButton().textContent).toBe(initialZoom)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
