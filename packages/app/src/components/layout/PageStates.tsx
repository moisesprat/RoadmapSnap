// The states of the SaaS page that are not the Lite area (UI-SPEC "Copywriting Contract / SaaS chrome", "Loading"):
// loading skeleton, load error, expired session, empty workspace list, workflow not configured and the notice
// region. Chrome typography is 14/400 body, 12/600 label and 18/600 heading; colors are shared-token classes only.
// Copy names no env var and no tenant domain.
import type { ReactNode } from 'react'

const PRIMARY_BUTTON =
  'h-8 rounded-sm bg-accent px-4 text-14 font-600 text-on-accent hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

// Fixed heights (filter bar, dashboard, timeline) keep the layout still when the Lite area mounts. The pulse is a
// motion-safe variant, so prefers-reduced-motion: reduce turns it off.
const SKELETON_BLOCK_HEIGHTS = [56, 240, 320]

export function LoadingSkeleton() {
  return (
    <div className="saas-state mx-auto flex max-w-screen flex-col gap-4 p-page" aria-busy="true" aria-label="Loading the roadmap">
      {SKELETON_BLOCK_HEIGHTS.map((height) => (
        <div
          key={height}
          className="saas-skeleton-block rounded-md bg-bg-secondary motion-safe:animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ height }}
        />
      ))}
    </div>
  )
}

interface StateBlockProps {
  title: string
  children?: ReactNode
  role?: 'alert'
  titleClass?: string
}

// Full-page state: heading, body copy and an optional action, centered with the 64px top margin.
function StateBlock({ title, children, role, titleClass = 'text-text-dark' }: StateBlockProps) {
  return (
    <div role={role} className="saas-state mx-auto mt-16 flex max-w-screen flex-col items-center gap-2 px-page py-8 text-center">
      <h2 className={`text-18 font-600 leading-tight ${titleClass}`}>{title}</h2>
      {children}
    </div>
  )
}

export interface LoadErrorProps {
  /** The API message, when there is one. */
  message?: string
  onRetry: () => void
}

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <StateBlock title="Could not load the roadmap" role="alert" titleClass="text-danger">
      <p className="text-14 font-400 text-text-dark">
        Check your connection and try again. If it keeps failing, sign out and back in.
      </p>
      <button type="button" className={`${PRIMARY_BUTTON} mt-2`} onClick={onRetry}>
        Retry loading
      </button>
      {message ? <p className="text-12 font-600 text-text-light">{message}</p> : null}
    </StateBlock>
  )
}

export interface SessionExpiredProps {
  onSignIn: () => void
}

export function SessionExpired({ onSignIn }: SessionExpiredProps) {
  return (
    <StateBlock title="Your session has expired" role="alert" titleClass="text-danger">
      <p className="text-14 font-400 text-text-dark">Sign in again to continue.</p>
      <button type="button" className={`${PRIMARY_BUTTON} mt-2`} onClick={onSignIn}>
        Sign in
      </button>
    </StateBlock>
  )
}

export function NoWorkspaces() {
  return (
    <StateBlock title="No workspaces yet">
      <p className="text-14 font-400 text-text-dark">
        Your organization has no workspace you can view. Ask an admin to add you to one.
      </p>
    </StateBlock>
  )
}

export function WorkflowNotConfigured() {
  return (
    <StateBlock title="Workflow not configured">
      <p className="text-14 font-400 text-text-dark">
        This workspace has no workflow steps, so the roadmap cannot be drawn. Workflow editing is not available yet.
      </p>
    </StateBlock>
  )
}

export interface Notice {
  id: string
  text: string
  /** Shows a dismiss button when given. */
  onDismiss?: () => void
}

export interface NoticeRegionProps {
  notices: Notice[]
}

// One live region for every notice; nothing renders while there is none. It sits above .lite-area with the 24px gap.
export function NoticeRegion({ notices }: NoticeRegionProps) {
  if (notices.length === 0) return null
  return (
    <div role="status" aria-live="polite" className="saas-notice mx-auto mb-6 flex max-w-screen flex-col gap-2 px-page pt-4">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex items-start justify-between gap-2 rounded-md border border-border bg-bg-white p-4 text-14 font-400 text-text-dark"
        >
          <span>{notice.text}</span>
          {notice.onDismiss ? (
            <button
              type="button"
              className="shrink-0 rounded-sm px-2 text-12 font-600 text-text-light hover:text-text-dark focus-visible:outline focus-visible:outline-2"
              aria-label="Dismiss notice"
              onClick={notice.onDismiss}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
