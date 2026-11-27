import { useEffect, useRef, useState } from 'react'
import type { ProjectRow } from '../../api/client'
import { useCreateProject, useUpdateProject } from '../../hooks/useProjectMutations'

interface ProjectFormModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  project?: ProjectRow | null
}

interface FormValues {
  name: string
  group_name: string
  tags: string
  external_link: string
  at_risk: boolean
  descoped: boolean
  show_in_timeline: boolean
}

const emptyForm: FormValues = {
  name: '',
  group_name: '',
  tags: '',
  external_link: '',
  at_risk: false,
  descoped: false,
  show_in_timeline: true,
}

function projectToForm(p: ProjectRow): FormValues {
  return {
    name: p.name,
    group_name: p.group_name ?? '',
    tags: (p.tags ?? []).join(', '),
    external_link: p.external_link ?? '',
    at_risk: p.at_risk,
    descoped: p.descoped,
    show_in_timeline: p.show_in_timeline,
  }
}

export default function ProjectFormModal({ isOpen, onClose, workspaceId, project }: ProjectFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = project != null

  const [values, setValues] = useState<FormValues>(emptyForm)
  const [nameTouched, setNameTouched] = useState(false)

  const createMutation = useCreateProject(workspaceId)
  const updateMutation = useUpdateProject(workspaceId)
  const activeMutation = isEdit ? updateMutation : createMutation
  const isPending = activeMutation.isPending
  const nameEmpty = values.name.trim() === ''
  const showNameHint = nameTouched && nameEmpty

  // Open / close the native dialog
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (isOpen) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [isOpen])

  // Sync form values when project changes (edit mode) or modal opens (create mode)
  useEffect(() => {
    if (isOpen) {
      setValues(isEdit ? projectToForm(project!) : emptyForm)
      setNameTouched(false)
      createMutation.reset()
      updateMutation.reset()
    }
    // The mutation objects are new on every render; the reset belongs to opening, not to each render.
  }, [isOpen, isEdit, project])

  // Auto-focus name field after open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  function set(field: keyof FormValues, value: string | boolean) {
    setValues((v) => ({ ...v, [field]: value }))
    if (activeMutation.isError) activeMutation.reset()
  }

  function parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nameEmpty || isPending) {
      setNameTouched(true)
      nameRef.current?.focus()
      return
    }

    const body = {
      name: values.name.trim(),
      group_name: values.group_name.trim() || null,
      tags: parseTags(values.tags),
      external_link: values.external_link.trim() || null,
      at_risk: values.at_risk,
      descoped: values.descoped,
      show_in_timeline: values.show_in_timeline,
    }

    // Errors come from the mutation state and are shown below; a success closes the dialog and the page refetches.
    if (isEdit) {
      updateMutation.mutate({ projectId: project!.id, body }, { onSuccess: onClose })
    } else {
      createMutation.mutate(body, { onSuccess: onClose })
    }
  }

  const title = isEdit ? 'Edit project' : 'Add project'
  const submitLabel = isPending ? (isEdit ? 'Saving…' : 'Adding…') : isEdit ? 'Save changes' : 'Add project'
  const apiMessage = activeMutation.error instanceof Error ? activeMutation.error.message : ''

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onClose={onClose}
      className="w-full max-w-lg rounded-lg border border-border bg-bg-white p-0 text-text-dark shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-dark">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={isPending}
            className="rounded-sm p-1 text-text-light hover:text-text-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="proj-name" className="text-sm font-medium text-text-dark">
              Name <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              ref={nameRef}
              id="proj-name"
              type="text"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => setNameTouched(true)}
              aria-describedby={showNameHint ? 'proj-name-hint' : undefined}
              aria-invalid={showNameHint || undefined}
              placeholder="e.g. Customer Portal v2"
              className="rounded-sm border border-border bg-bg-white px-3 py-1.5 text-14 text-text-dark placeholder:text-text-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              required
            />
            {showNameHint && (
              <p id="proj-name-hint" className="text-12 text-danger">
                Enter a project name.
              </p>
            )}
          </div>

          {/* Group */}
          <div className="flex flex-col gap-1">
            <label htmlFor="proj-group" className="text-sm font-medium text-text-dark">
              Group
            </label>
            <input
              id="proj-group"
              type="text"
              value={values.group_name}
              onChange={(e) => set('group_name', e.target.value)}
              placeholder="e.g. Platform"
              className="rounded-sm border border-border bg-bg-white px-3 py-1.5 text-14 text-text-dark placeholder:text-text-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label htmlFor="proj-tags" className="text-sm font-medium text-text-dark">
              Tags
              <span className="ml-1 text-xs font-normal text-text-light">(comma-separated)</span>
            </label>
            <input
              id="proj-tags"
              type="text"
              value={values.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="e.g. frontend, Q3, priority"
              className="rounded-sm border border-border bg-bg-white px-3 py-1.5 text-14 text-text-dark placeholder:text-text-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* External link */}
          <div className="flex flex-col gap-1">
            <label htmlFor="proj-link" className="text-sm font-medium text-text-dark">
              External link
            </label>
            <input
              id="proj-link"
              type="url"
              value={values.external_link}
              onChange={(e) => set('external_link', e.target.value)}
              placeholder="https://..."
              className="rounded-sm border border-border bg-bg-white px-3 py-1.5 text-14 text-text-dark placeholder:text-text-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-dark">
              <input
                type="checkbox"
                checked={values.at_risk}
                onChange={(e) => set('at_risk', e.target.checked)}
                className="rounded-sm border-border"
              />
              At risk
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-dark">
              <input
                type="checkbox"
                checked={values.descoped}
                onChange={(e) => set('descoped', e.target.checked)}
                className="rounded-sm border-border"
              />
              Descoped
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-dark">
              <input
                type="checkbox"
                checked={values.show_in_timeline}
                onChange={(e) => set('show_in_timeline', e.target.checked)}
                className="rounded-sm border-border"
              />
              Show in timeline
            </label>
          </div>

          {/* Submit failure: the dialog stays open and the field values are kept */}
          {activeMutation.isError && (
            <div role="alert" className="flex flex-col gap-1 text-14 text-danger">
              <p>Could not save the project. Try again.</p>
              {apiMessage && <p className="text-12 text-text-light">{apiMessage}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-8 rounded-sm border border-border bg-bg-white px-4 text-14 text-text-dark hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={isPending || nameEmpty}
            className="h-8 rounded-sm bg-accent px-4 text-14 font-600 text-on-accent hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
