// Lite's view state (filters, sort, zoom, Gantt, collapsed groups, open dependency graph) as a reducer over the
// pure transitions of @roadmapsnap/core. No transition rule lives here: each action delegates to the core
// function Lite's handlers apply, and closes the dependency graph exactly where Lite's handlers do.
// The theme is owned outside this hook (it is saved per user), so reset keeps nothing but the six view fields.
import { useMemo, useReducer } from 'react'
import {
  DEFAULT_VIEW_STATE,
  applyStatusFilter,
  clearStatusFilters,
  closeDependencyGraph,
  collapseAllGroups,
  expandAllGroups,
  resetViewState,
  setShowGantt,
  setSortBy,
  setSortOrder,
  setSearch,
  setZoom,
  toggleDependencyGraph,
  toggleDescopedOnly,
  toggleGroup,
  toggleRiskOnly,
} from '@roadmapsnap/core'
import type { CoreViewState } from '@roadmapsnap/core'

export type LiteViewState = CoreViewState

export interface LiteViewActions {
  setSearch(search: string): void
  setSortBy(by: string): void
  setSortOrder(order: string): void
  setShowGantt(showGantt: boolean): void
  statusClick(status: string): void
  toggleRisk(): void
  toggleDescoped(): void
  clearStatusFilters(): void
  reset(): void
  setZoom(months: number | string): void
  toggleGroup(groupName: string): void
  expandAll(groupNames: string[]): void
  collapseAll(groupNames: string[]): void
  toggleGraph(name: string, groupNames: string[]): void
  closeGraph(): void
}

type Action =
  | { type: 'setSearch'; search: string }
  | { type: 'setSortBy'; by: string }
  | { type: 'setSortOrder'; order: string }
  | { type: 'setShowGantt'; showGantt: boolean }
  | { type: 'statusClick'; status: string }
  | { type: 'toggleRisk' }
  | { type: 'toggleDescoped' }
  | { type: 'clearStatusFilters' }
  | { type: 'reset' }
  | { type: 'setZoom'; months: number | string }
  | { type: 'toggleGroup'; groupName: string }
  | { type: 'expandAll'; groupNames: string[] }
  | { type: 'collapseAll'; groupNames: string[] }
  | { type: 'toggleGraph'; name: string; groupNames: string[] }
  | { type: 'closeGraph' }

function reduce(state: LiteViewState, action: Action): LiteViewState {
  switch (action.type) {
    case 'setSearch':
      return closeDependencyGraph(setSearch(state, action.search))
    case 'setSortBy':
      return closeDependencyGraph(setSortBy(state, action.by))
    case 'setSortOrder':
      return closeDependencyGraph(setSortOrder(state, action.order))
    case 'setShowGantt':
      return setShowGantt(state, action.showGantt)
    case 'statusClick':
      return closeDependencyGraph(applyStatusFilter(state, action.status))
    case 'toggleRisk':
      return closeDependencyGraph(toggleRiskOnly(state))
    case 'toggleDescoped':
      return closeDependencyGraph(toggleDescopedOnly(state))
    case 'clearStatusFilters':
      return clearStatusFilters(state)
    case 'reset': {
      const { filter, sort, zoom, showGantt, groupCollapsed, activeDependencyGraph } = resetViewState({})
      return { filter, sort, zoom, showGantt, groupCollapsed, activeDependencyGraph }
    }
    case 'setZoom':
      return setZoom(state, action.months)
    case 'toggleGroup':
      return toggleGroup(state, action.groupName)
    case 'expandAll':
      return expandAllGroups(state, action.groupNames)
    case 'collapseAll':
      return collapseAllGroups(state, action.groupNames)
    case 'toggleGraph':
      return toggleDependencyGraph(state, action.name, action.groupNames)
    case 'closeGraph':
      return closeDependencyGraph(state)
  }
}

export function useLiteViewState(): [LiteViewState, LiteViewActions] {
  const [state, dispatch] = useReducer(reduce, DEFAULT_VIEW_STATE as LiteViewState)
  const actions = useMemo<LiteViewActions>(
    () => ({
      setSearch: (search) => dispatch({ type: 'setSearch', search }),
      setSortBy: (by) => dispatch({ type: 'setSortBy', by }),
      setSortOrder: (order) => dispatch({ type: 'setSortOrder', order }),
      setShowGantt: (showGantt) => dispatch({ type: 'setShowGantt', showGantt }),
      statusClick: (status) => dispatch({ type: 'statusClick', status }),
      toggleRisk: () => dispatch({ type: 'toggleRisk' }),
      toggleDescoped: () => dispatch({ type: 'toggleDescoped' }),
      clearStatusFilters: () => dispatch({ type: 'clearStatusFilters' }),
      reset: () => dispatch({ type: 'reset' }),
      setZoom: (months) => dispatch({ type: 'setZoom', months }),
      toggleGroup: (groupName) => dispatch({ type: 'toggleGroup', groupName }),
      expandAll: (groupNames) => dispatch({ type: 'expandAll', groupNames }),
      collapseAll: (groupNames) => dispatch({ type: 'collapseAll', groupNames }),
      toggleGraph: (name, groupNames) => dispatch({ type: 'toggleGraph', name, groupNames }),
      closeGraph: () => dispatch({ type: 'closeGraph' }),
    }),
    [],
  )
  return [state, actions]
}
