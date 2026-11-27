import { useEffect, useRef } from 'react'
import type { ProjectRow } from '../../api/client'
import { useDeleteProject } from '../../hooks/useProjectMutations'

interface DeleteProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: ProjectRow | null
  workspaceId: string
}

export default function DeleteProjectModal({ isOpen, onClose, project, workspaceId }: DeleteProjectModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const deleteMutation = useDeleteProject(workspaceId)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (isOpen) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [isOpen])

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  // Focus the safe choice first when the dialog opens (UI-SPEC); the failure state comes from the mutation.
  useEffect(() => {
    if (isOpen) {
      deleteMutation.reset()
      keepRef.current?.focus()
    }
    // The mutation object is new on every render; the reset belongs to opening only.
  }, [isOpen])

  function handleDelete() {
    if (!project || deleteMutation.isPending) return
    deleteMutation.mutate(project.id, { onSuccess: onClose })
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onClose={onClose}
      className="w-full max-w-sm rounded-lg border border-border bg-bg-white p-0 text-text-dark shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        <h2 className="text-18 font-600 leading-tight text-text-dark">Delete project</h2>
        <p className="text-14 text-text-dark">
          {`Delete ${project?.name ?? ''}? This permanently deletes the project and all its milestones. This cannot be undone.`}
        </p>

        {deleteMutation.isError && (
          <div role="alert" className="flex flex-col gap-1 text-14 text-danger">
            <p>Could not delete the project. Try again.</p>
            {deleteMutation.error instanceof Error && deleteMutation.error.message && (
              <p className="text-12 text-text-light">{deleteMutation.error.message}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            ref={keepRef}
            type="button"
            onClick={onClose}
            disabled={deleteMutation.isPending}
            className="h-8 rounded-sm border border-border bg-bg-white px-4 text-14 text-text-dark hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Keep project
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-8 rounded-sm bg-danger px-4 text-14 font-600 text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
