import type { ThemeName } from '@roadmapsnap/core'

// RED stub: the hook shape without behavior, so the tests compile and fail on their assertions.
export function useTheme(): {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  notice: string | null
  dismissNotice: () => void
} {
  return { theme: 'light', setTheme: () => {}, notice: null, dismissNotice: () => {} }
}
