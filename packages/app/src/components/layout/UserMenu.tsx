// The account menu in the SaaS header (UI-SPEC "SaaS chrome / User menu"). Name, email and initial come from the
// Auth0 SDK user immediately and switch to the /auth/me record once it loads, so the menu has no placeholder state.
import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useCurrentUser } from '../../hooks/useRole'

export default function UserMenu() {
  const { user: authUser, logout } = useAuth0()
  const { data: me } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const signOutRef = useRef<HTMLButtonElement>(null)

  const name = me?.name || authUser?.name || authUser?.email || ''
  const email = me?.email || authUser?.email || ''
  const initial = (name || email || '?').charAt(0).toUpperCase()

  // Close on an outside click.
  useEffect(() => {
    if (!open) return
    function onDocumentClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [open])

  // Keyboard users land on the only action when the menu opens.
  useEffect(() => {
    if (open) signOutRef.current?.focus()
  }, [open])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-sm border border-border bg-bg-white px-2 text-14 font-400 text-text-dark hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-secondary text-12 font-600 text-text-dark"
        >
          {initial}
        </span>
        <span className="max-w-[120px] truncate" title={name}>
          {name}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-border bg-bg-white p-1 shadow-xl"
        >
          <div className="px-3 py-2">
            <p className="truncate text-14 font-400 text-text-dark" title={name}>
              {name}
            </p>
            <p className="truncate text-12 font-600 text-text-light" title={email}>
              {email}
            </p>
          </div>
          <button
            ref={signOutRef}
            type="button"
            role="menuitem"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            className="block w-full rounded-sm px-3 py-2 text-left text-14 font-400 text-text-dark hover:bg-bg-secondary focus:bg-accent focus:text-on-accent focus:outline-none"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
