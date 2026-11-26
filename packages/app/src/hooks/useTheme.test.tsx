// useTheme owns the theme: the data-theme attribute, the localStorage cache, the optimistic PATCH /auth/me and the
// reconcile with the stored preference (D-06). The API client is mocked; no network is involved.
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from './useTheme'

const api = vi.hoisted(() => ({ getMe: vi.fn(), updateMe: vi.fn() }))
vi.mock('./useApi', () => ({ useApi: () => api }))

const SAVE_FAILED = 'Your theme could not be saved to your account. It is applied on this device only.'

function me(theme: string | undefined) {
  return {
    sub: 's',
    email: 'e',
    name: 'n',
    preferences: theme === undefined ? {} : { theme },
    role: 'editor',
    orgId: 'o',
    orgs: [],
  }
}

// Newer Node versions define a global localStorage getter that yields undefined without a file, hiding jsdom's;
// install a plain in-memory store whose methods tests can replace.
const store = new Map<string, string>()
const memoryStorage = {
  getItem: vi.fn((k: string) => (store.has(k) ? (store.get(k) as string) : null)),
  setItem: vi.fn((k: string, v: string) => {
    store.set(k, String(v))
  }),
  removeItem: vi.fn((k: string) => {
    store.delete(k)
  }),
  clear: vi.fn(() => store.clear()),
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage })

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  api.getMe.mockReset()
  api.updateMe.mockReset()
  api.getMe.mockResolvedValue(me(undefined))
  api.updateMe.mockResolvedValue(me('light'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useTheme', () => {
  it('starts from the data-theme attribute set before paint, normalized', () => {
    document.documentElement.setAttribute('data-theme', 'papallona')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('papallona')
  })

  it('falls back to light for an unknown attribute value', () => {
    document.documentElement.setAttribute('data-theme', 'neon')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('light')
  })

  it('setTheme applies data-theme, writes the cache and PATCHes the preference', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setTheme('papallona'))
    expect(result.current.theme).toBe('papallona')
    expect(document.documentElement.getAttribute('data-theme')).toBe('papallona')
    expect(localStorage.getItem('roadmapsnap-theme')).toBe('papallona')
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith({ preferences: { theme: 'papallona' } }))
  })

  it('keeps the theme applied and shows the notice when the PATCH fails', async () => {
    api.updateMe.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setTheme('papallona'))
    await waitFor(() => expect(result.current.notice).toBe(SAVE_FAILED))
    expect(result.current.theme).toBe('papallona')
    expect(document.documentElement.getAttribute('data-theme')).toBe('papallona')
    expect(localStorage.getItem('roadmapsnap-theme')).toBe('papallona')
  })

  it('clears the save-failure notice after 6 seconds', async () => {
    api.updateMe.mockRejectedValue(new Error('boom'))
    // Only the timers are faked, so promises still settle; the clock advances inside act.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setTheme('papallona'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(result.current.notice).toBe(SAVE_FAILED)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5900)
    })
    expect(result.current.notice).toBe(SAVE_FAILED)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(result.current.notice).toBeNull()
  })

  it('dismissNotice clears the notice at once', async () => {
    api.updateMe.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setTheme('papallona'))
    await waitFor(() => expect(result.current.notice).toBe(SAVE_FAILED))
    act(() => result.current.dismissNotice())
    expect(result.current.notice).toBeNull()
  })

  it('applies a stored preference that differs from the cache, without a PATCH', async () => {
    localStorage.setItem('roadmapsnap-theme', 'light')
    document.documentElement.setAttribute('data-theme', 'light')
    api.getMe.mockResolvedValue(me('dark'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('roadmapsnap-theme')).toBe('dark')
    expect(api.updateMe).not.toHaveBeenCalled()
  })

  it('changes nothing and sends no PATCH when the preference equals the cache', async () => {
    localStorage.setItem('roadmapsnap-theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    api.getMe.mockResolvedValue(me('dark'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(api.getMe).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.theme).toBe('dark')
    expect(api.updateMe).not.toHaveBeenCalled()
  })

  it('does not let a late /auth/me answer overwrite a theme the user already picked', async () => {
    let resolveMe: (value: unknown) => void = () => {}
    api.getMe.mockReturnValue(new Promise((resolve) => (resolveMe = resolve)))
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setTheme('evergreen'))
    await act(async () => resolveMe(me('dark')))
    expect(result.current.theme).toBe('evergreen')
  })

  it('normalizes a legacy cached value and a legacy stored preference to evergreen', async () => {
    document.documentElement.setAttribute('data-theme', 'dsm-firmenich')
    api.getMe.mockResolvedValue(me('dsm-firmenich'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('evergreen')
    await act(async () => {})
    expect(result.current.theme).toBe('evergreen')
    expect(api.updateMe).not.toHaveBeenCalled()
  })

  it('swallows localStorage exceptions', async () => {
    memoryStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(() => act(() => result.current.setTheme('dark'))).not.toThrow()
    expect(result.current.theme).toBe('dark')
  })
})
