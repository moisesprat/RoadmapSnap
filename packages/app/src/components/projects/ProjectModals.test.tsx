// The project dialogs (D-03) follow the UI-SPEC copy contract: titles, dismiss and confirm labels, the empty-Name rule,
// the pending labels and the failure text. Neither dialog offers a button called "Cancel".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectFormModal from './ProjectFormModal'
import DeleteProjectModal from './DeleteProjectModal'
import { Auth0TestProvider } from '../../test/auth0Stub'
import type { ProjectRow } from '../../api/client'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

const PROJECT: ProjectRow = {
  id: 'p1',
  name: 'Alpha',
  group_name: 'Platform',
  at_risk: false,
  descoped: false,
  show_in_timeline: true,
  tags: ['q3'],
  external_link: null,
  display_order: 0,
}

function wrap(children: React.ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(
    <Auth0TestProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Auth0TestProvider>,
  )
}

function stubFetch(handler: () => { ok: boolean; status?: number; body?: unknown } | Promise<{ ok: boolean; status?: number; body?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = await handler()
      const status = r.status ?? (r.ok ? 200 : 500)
      // A real Response, so a 204 has the empty body the API sends and json() rejects on it, as in the browser.
      return new Response(status === 204 ? null : JSON.stringify(r.body ?? {}), {
        status,
        statusText: r.ok ? 'OK' : 'Internal Server Error',
      })
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProjectFormModal', () => {
  it('uses the Add project copy and the Discard changes dismiss button, never Cancel or Done', () => {
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} />)
    expect(screen.getByRole('heading', { name: 'Add project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  })

  it('uses the Edit project copy in edit mode', () => {
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} project={PROJECT} />)
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('disables submit while Name is empty or whitespace and enables it once a name is typed', () => {
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} />)
    const submit = screen.getByRole('button', { name: 'Add project' })
    expect(submit).toBeDisabled()
    const name = screen.getByLabelText(/^Name/)
    fireEvent.change(name, { target: { value: '   ' } })
    expect(submit).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Beta' } })
    expect(submit).toBeEnabled()
  })

  it('shows "Enter a project name." linked by aria-describedby when an empty Name loses focus', () => {
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} />)
    const name = screen.getByLabelText(/^Name/)
    expect(screen.queryByText('Enter a project name.')).toBeNull()
    fireEvent.blur(name)
    const hint = screen.getByText('Enter a project name.')
    expect(name.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('reads Adding… and disables both buttons while the create is pending', async () => {
    let release: () => void = () => {}
    stubFetch(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, body: { project: PROJECT } })
        }),
    )
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} />)
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Beta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    const pending = await screen.findByRole('button', { name: 'Adding…' })
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled()
    release()
  })

  it('reads Saving… while an edit is pending', async () => {
    let release: () => void = () => {}
    stubFetch(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, body: { project: PROJECT } })
        }),
    )
    wrap(<ProjectFormModal isOpen onClose={() => {}} workspaceId={WORKSPACE_ID} project={PROJECT} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    const pending = await screen.findByRole('button', { name: 'Saving…' })
    expect(pending).toBeDisabled()
    release()
  })

  it('closes after a successful save', async () => {
    stubFetch(() => ({ ok: true, body: { project: PROJECT } }))
    const onClose = vi.fn()
    wrap(<ProjectFormModal isOpen onClose={onClose} workspaceId={WORKSPACE_ID} />)
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Beta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('keeps the dialog open and the values on failure, with an alert and the API message', async () => {
    stubFetch(() => ({ ok: false, status: 500, body: { message: 'Name already used' } }))
    const onClose = vi.fn()
    wrap(<ProjectFormModal isOpen onClose={onClose} workspaceId={WORKSPACE_ID} />)
    const name = screen.getByLabelText(/^Name/) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Beta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not save the project. Try again.')
    expect(alert).toHaveTextContent('Name already used')
    expect(onClose).not.toHaveBeenCalled()
    expect(name.value).toBe('Beta')
    expect(screen.getByRole('button', { name: 'Add project' })).toBeEnabled()
  })
})

describe('DeleteProjectModal', () => {
  it('shows the UI-SPEC body and buttons, with Keep project focused first and no Cancel', async () => {
    wrap(<DeleteProjectModal isOpen onClose={() => {}} project={PROJECT} workspaceId={WORKSPACE_ID} />)
    expect(screen.getByRole('heading', { name: 'Delete project' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete Alpha? This permanently deletes the project and all its milestones. This cannot be undone.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeInTheDocument()
    const keep = screen.getByRole('button', { name: 'Keep project' })
    await waitFor(() => expect(document.activeElement).toBe(keep))
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('fills the confirm button with the danger token', () => {
    wrap(<DeleteProjectModal isOpen onClose={() => {}} project={PROJECT} workspaceId={WORKSPACE_ID} />)
    const confirm = screen.getByRole('button', { name: 'Delete project' })
    expect(confirm.className).toContain('bg-danger')
    expect(confirm.className).not.toContain('bg-risk')
  })

  it('reads Deleting… and disables both buttons while pending', async () => {
    let release: () => void = () => {}
    stubFetch(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, body: {} })
        }),
    )
    wrap(<DeleteProjectModal isOpen onClose={() => {}} project={PROJECT} workspaceId={WORKSPACE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    const pending = await screen.findByRole('button', { name: 'Deleting…' })
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep project' })).toBeDisabled()
    release()
  })

  it('shows "Could not delete the project. Try again." with the API message on failure and stays open', async () => {
    stubFetch(() => ({ ok: false, status: 500, body: { message: 'Database busy' } }))
    const onClose = vi.fn()
    wrap(<DeleteProjectModal isOpen onClose={onClose} project={PROJECT} workspaceId={WORKSPACE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not delete the project. Try again.')
    expect(alert).toHaveTextContent('Database busy')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes and refetches the project list after a successful delete answered with 204 and no body', async () => {
    stubFetch(() => ({ ok: true, status: 204 }))
    const onClose = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    wrap(<DeleteProjectModal isOpen onClose={onClose} project={PROJECT} workspaceId={WORKSPACE_ID} />, client)
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', WORKSPACE_ID, 'projects'] })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/projects/p1'), expect.objectContaining({ method: 'DELETE' }))
  })
})
