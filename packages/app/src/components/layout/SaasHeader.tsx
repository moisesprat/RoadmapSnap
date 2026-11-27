// The thin SaaS header above the Lite area (D-02, UI-SPEC "Header, left to right"): product name, workspace select,
// flexible space, Manage projects, Add project (editors and admins) and the account menu. It scrolls away with the
// page on purpose: Lite's .filter-bar pins itself at top: 10px, and a pinned header would cover it or force a
// different offset, which breaks parity. The project dialogs open from here and never touch the Lite area's view
// state (D-03).
import { useState } from 'react'
import type { ProjectRow, WorkspaceSummary } from '../../api/client'
import { useRole } from '../../hooks/useRole'
import ProjectFormModal from '../projects/ProjectFormModal'
import ProjectsDialog from '../projects/ProjectsDialog'
import UserMenu from './UserMenu'

interface SaasHeaderProps {
  workspaces: WorkspaceSummary[]
  workspacesLoading: boolean
  /** The selected workspace, or null while none is selected. */
  workspaceId: string | null
  onWorkspaceChange: (id: string) => void
  /** The selected workspace's projects, for the Manage projects dialog. */
  projects: ProjectRow[]
}

const PRIMARY_BUTTON =
  'h-8 rounded-sm bg-accent px-4 text-14 font-600 text-on-accent hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY_BUTTON =
  'h-8 rounded-sm border border-border bg-bg-white px-4 text-14 font-400 text-text-dark hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

export default function SaasHeader({
  workspaces,
  workspacesLoading,
  workspaceId,
  onWorkspaceChange,
  projects,
}: SaasHeaderProps) {
  const { can } = useRole()
  const [manageOpen, setManageOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const noWorkspaces = !workspacesLoading && workspaces.length === 0
  const selectDisabled = workspacesLoading || noWorkspaces
  const hasWorkspace = workspaceId !== null

  return (
    <header className="saas-header border-b border-border bg-bg-white text-text-dark">
      <div className="mx-auto flex min-h-12 max-w-screen flex-wrap items-center gap-2 px-page py-2 md:h-12 md:flex-nowrap md:py-0">
        <span className="text-18 font-600 leading-tight text-text-dark">RoadmapSnap</span>
        <select
          aria-label="Workspace"
          value={workspaceId ?? ''}
          disabled={selectDisabled}
          onChange={(e) => onWorkspaceChange(e.target.value)}
          title={workspaces.find((w) => w.id === workspaceId)?.name}
          className="order-last h-8 w-full max-w-[240px] truncate rounded-sm border border-border bg-bg-white px-2 text-14 font-400 text-text-dark disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:order-none md:w-auto"
        >
          {noWorkspaces ? (
            <option value="">No workspaces</option>
          ) : (
            <>
              {workspaceId === null && <option value="">Select workspace</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </>
          )}
        </select>
        <div className="flex-1" />
        <button type="button" className={SECONDARY_BUTTON} disabled={!hasWorkspace} onClick={() => setManageOpen(true)}>
          Manage projects
        </button>
        {can('editor') && (
          <button type="button" className={PRIMARY_BUTTON} disabled={!hasWorkspace} onClick={() => setAddOpen(true)}>
            Add project
          </button>
        )}
        <UserMenu />
      </div>
      {hasWorkspace && (
        <>
          <ProjectsDialog
            isOpen={manageOpen}
            onClose={() => setManageOpen(false)}
            projects={projects}
            workspaceId={workspaceId}
          />
          <ProjectFormModal isOpen={addOpen} onClose={() => setAddOpen(false)} workspaceId={workspaceId} />
        </>
      )}
    </header>
  )
}
