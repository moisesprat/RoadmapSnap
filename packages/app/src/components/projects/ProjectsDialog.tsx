// "Manage projects": the list of the workspace's projects in a native dialog (D-03). Rows come from the page's project
// data. Edit and Delete (editors and admins only) open the existing project modals; the API stays the enforcement point.
import { useEffect, useRef, useState } from 'react'
import type { ProjectRow } from '../../api/client'
import { useRole } from '../../hooks/useRole'
import DeleteProjectModal from './DeleteProjectModal'
import ProjectFormModal from './ProjectFormModal'

interface ProjectsDialogProps {
  isOpen: boolean
  onClose: () => void
  projects: ProjectRow[]
  workspaceId: string
}

const ROW_BUTTON =
  'h-8 rounded-sm border border-border bg-bg-white px-3 text-14 font-400 text-text-dark hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export default function ProjectsDialog({ isOpen, onClose, projects, workspaceId }: ProjectsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { can } = useRole()
  const canEdit = can('editor')
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [deleting, setDeleting] = useState<ProjectRow | null>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (isOpen) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [isOpen])

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        onClick={handleDialogClick}
        onClose={onClose}
        aria-labelledby="projects-dialog-title"
        className="w-full max-w-2xl rounded-lg border border-border bg-bg-white p-0 text-text-dark shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="projects-dialog-title" className="text-18 font-600 leading-tight text-text-dark">
            {`Projects (${projects.length})`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close projects dialog"
            className="rounded-sm p-1 text-text-light hover:text-text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between gap-2 border-b border-border px-6 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-14 font-400 text-text-dark" title={project.name}>
                  {project.name}
                </p>
                {project.group_name ? (
                  <p className="truncate text-12 font-600 text-text-light">{project.group_name}</p>
                ) : null}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${project.name}`}
                    onClick={() => setEditing(project)}
                    className={ROW_BUTTON}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => setDeleting(project)}
                    className={ROW_BUTTON}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </dialog>
      <ProjectFormModal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        workspaceId={workspaceId}
        project={editing}
      />
      <DeleteProjectModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        project={deleting}
        workspaceId={workspaceId}
      />
    </>
  )
}
