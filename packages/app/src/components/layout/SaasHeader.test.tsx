// The SaaS header (D-02) and the dialogs it opens (D-03): role gating, the workspace select states, the projects
// dialog count and the project form opening from Add project.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SaasHeader from './SaasHeader'
import { Auth0TestProvider } from '../../test/auth0Stub'
import type { ProjectRow } from '../../api/client'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

function makeProject(id: string, name: string): ProjectRow {
  return {
    id,
    name,
    group_name: null,
    at_risk: false,
    descoped: false,
    show_in_timeline: true,
    tags: [],
    external_link: null,
    display_order: 0,
  }
}

const PROJECTS = [makeProject('p1', 'Alpha'), makeProject('p2', 'Beta')]

function stubMe(role: 'viewer' | 'editor' | 'admin', overrides: Record<string, unknown> = {}) {
  const me = { sub: 's', email: 'db@example.com', name: 'Db Name', preferences: { theme: 'light' }, role, orgId: 'o', orgs: [], ...overrides }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => me })),
  )
}

function renderHeader(props: Partial<React.ComponentProps<typeof SaasHeader>> = {}, authOverrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Auth0TestProvider overrides={authOverrides}>
      <QueryClientProvider client={client}>
        <SaasHeader
          workspaces={[{ id: WORKSPACE_ID, name: 'Main workspace', slug: 'main' }]}
          workspacesLoading={false}
          workspaceId={WORKSPACE_ID}
          onWorkspaceChange={() => {}}
          projects={PROJECTS}
          {...props}
        />
      </QueryClientProvider>
    </Auth0TestProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SaasHeader', () => {
  it('is a plain, non-sticky header with the product name', () => {
    stubMe('editor')
    const { container } = renderHeader()
    const header = container.querySelector('header.saas-header') as HTMLElement
    expect(header).not.toBeNull()
    expect(header.className).not.toMatch(/sticky|fixed/)
    expect(within(header).getByText('RoadmapSnap')).toBeInTheDocument()
  })

  it('shows Add project and Manage projects to an editor', async () => {
    stubMe('editor')
    renderHeader()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add project' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Manage projects' })).toBeInTheDocument()
  })

  it('hides Add project and the Edit and Delete row actions from a viewer', async () => {
    stubMe('viewer')
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Manage projects' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Projects (2)' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Add project' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull()
  })

  it('opens the project form from Add project', async () => {
    stubMe('editor')
    renderHeader()
    const add = await screen.findByRole('button', { name: 'Add project' })
    expect(screen.queryByRole('heading', { name: /^add project$/i })).toBeNull()
    fireEvent.click(add)
    expect(await screen.findByRole('heading', { name: /^add project$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
  })

  it('titles the projects dialog with the project count and labels the row actions for an editor', async () => {
    stubMe('editor')
    renderHeader()
    await screen.findByRole('button', { name: 'Add project' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage projects' }))
    expect(await screen.findByRole('heading', { name: 'Projects (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Alpha' })).toHaveTextContent('Edit')
    expect(screen.getByRole('button', { name: 'Delete Beta' })).toHaveTextContent('Delete')
    expect(screen.getByRole('button', { name: 'Close projects dialog' })).toBeInTheDocument()
  })

  it('titles the dialog Projects (0) with no projects', () => {
    stubMe('editor')
    renderHeader({ projects: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Manage projects' }))
    expect(screen.getByRole('heading', { name: 'Projects (0)' })).toBeInTheDocument()
  })

  it('opens the edit form for a row from the projects dialog', async () => {
    stubMe('editor')
    renderHeader()
    await screen.findByRole('button', { name: 'Add project' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage projects' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Alpha' }))
    expect(await screen.findByRole('heading', { name: /^edit project$/i })).toBeInTheDocument()
  })

  it('disables the workspace select and reads "No workspaces" with zero workspaces', () => {
    stubMe('editor')
    renderHeader({ workspaces: [], workspaceId: null })
    const select = screen.getByLabelText('Workspace') as HTMLSelectElement
    expect(select).toBeDisabled()
    expect(select).toHaveDisplayValue('No workspaces')
  })

  it('disables the workspace select while workspaces load', () => {
    stubMe('editor')
    renderHeader({ workspaces: [], workspacesLoading: true, workspaceId: null })
    expect(screen.getByLabelText('Workspace')).toBeDisabled()
  })

  it('reports the chosen workspace', () => {
    stubMe('editor')
    const onWorkspaceChange = vi.fn()
    renderHeader(
      {
        workspaces: [
          { id: WORKSPACE_ID, name: 'Main workspace', slug: 'main' },
          { id: 'second', name: 'Second', slug: 'second' },
        ],
        onWorkspaceChange,
      },
    )
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'second' } })
    expect(onWorkspaceChange).toHaveBeenCalledWith('second')
  })
})

describe('UserMenu', () => {
  it('shows the Auth0 user at once and switches to the /auth/me record when it loads', async () => {
    stubMe('editor')
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveTextContent('Test User')
    await waitFor(() => expect(trigger).toHaveTextContent('Db Name'))
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Db Name')).toBeInTheDocument()
    expect(within(menu).getByText('db@example.com')).toBeInTheDocument()
  })

  it('signs out through the Auth0 SDK and closes on Escape', async () => {
    stubMe('editor')
    const logout = vi.fn(async () => {})
    renderHeader({}, { logout })
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } })
  })
})
