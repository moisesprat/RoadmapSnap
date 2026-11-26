// STUB for the RED commit: replaced by the real reducer in the GREEN commit.
import { DEFAULT_VIEW_STATE } from '@roadmapsnap/core'
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

const noop = () => {}
const actions: LiteViewActions = {
  setSearch: noop, setSortBy: noop, setSortOrder: noop, setShowGantt: noop, statusClick: noop, toggleRisk: noop,
  toggleDescoped: noop, clearStatusFilters: noop, reset: noop, setZoom: noop, toggleGroup: noop, expandAll: noop,
  collapseAll: noop, toggleGraph: noop, closeGraph: noop,
}

export function useLiteViewState(): [LiteViewState, LiteViewActions] {
  return [DEFAULT_VIEW_STATE as LiteViewState, actions]
}
