// The page's theme (D-06): the value applied as data-theme on <html>, its localStorage cache (read before first paint
// by the page shell) and its per-user persistence through PATCH /auth/me. A change is optimistic and never rolled
// back: when the PATCH fails the theme stays applied and a notice says it is saved on this device only. When the user
// record loads with a stored theme that differs from the cached one, the stored theme wins once.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { normalizeTheme } from '@roadmapsnap/core'
import type { ThemeName } from '@roadmapsnap/core'
import type { CurrentUser } from '../api/client'
import { useApi } from './useApi'
import { useCurrentUser } from './useRole'

const THEME_STORAGE_KEY = 'roadmapsnap-theme'
const NOTICE_MS = 6000

export const THEME_SAVE_FAILED_NOTICE =
  'Your theme could not be saved to your account. It is applied on this device only.'

function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or a full quota: the theme still applies for this session.
  }
}

export function useTheme() {
  const api = useApi()
  const queryClient = useQueryClient()
  const { data: me } = useCurrentUser()
  const [theme, setThemeState] = useState<ThemeName>(() => normalizeTheme(document.documentElement.getAttribute('data-theme')))
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeTick, setNoticeTick] = useState(0)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const settled = useRef(false)

  const save = useMutation({
    mutationFn: (next: ThemeName) => api.updateMe({ preferences: { theme: next } }),
    onSuccess: (user) => {
      // PATCH /auth/me answers only sub, email, name and preferences. Merge the saved preferences into the cached
      // user so role, orgId and orgs survive; replacing the record made useRole fall back to viewer.
      queryClient.setQueryData<CurrentUser>(['me'], (prev) =>
        prev ? { ...prev, preferences: user.preferences } : prev,
      )
    },
    onError: () => {
      setNotice(THEME_SAVE_FAILED_NOTICE)
      setNoticeTick((tick) => tick + 1)
    },
  })
  const { mutate } = save

  const setTheme = useCallback(
    (next: ThemeName) => {
      const normalized = normalizeTheme(next)
      // A choice made before the user record arrives is newer than the record, so the record must not replace it.
      settled.current = true
      applyTheme(normalized)
      setThemeState(normalized)
      mutate(normalized)
    },
    [mutate],
  )

  // Reconcile with the stored preference once. No PATCH: the server already holds this value.
  useEffect(() => {
    if (settled.current || !me) return
    settled.current = true
    const stored = me.preferences?.theme
    if (typeof stored !== 'string') return
    const next = normalizeTheme(stored)
    if (next === themeRef.current) return
    applyTheme(next)
    setThemeState(next)
  }, [me])

  useEffect(() => {
    if (noticeTick === 0) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [noticeTick])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return { theme, setTheme, notice, dismissNotice }
}
