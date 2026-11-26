// STUB for the RED commit: replaced by the real component in the GREEN commit.
import type { FilterBarModel, ThemeName } from '@roadmapsnap/core'
import type { LiteViewActions } from '../../hooks/useLiteViewState'

export type LiteFilterBarActions = Pick<
  LiteViewActions,
  'setSearch' | 'setSortBy' | 'setSortOrder' | 'setZoom' | 'expandAll' | 'collapseAll' | 'reset'
>

export interface LiteFilterBarProps {
  model: FilterBarModel
  search: string
  actions: LiteFilterBarActions
  groupNames: string[]
  theme: ThemeName
  onThemeChange: (theme: ThemeName) => void
}

export function LiteFilterBar(_props: LiteFilterBarProps) {
  return <div className="filter-bar" />
}
