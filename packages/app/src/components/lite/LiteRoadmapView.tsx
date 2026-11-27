// The Lite area of the SaaS page: Lite's page (renderPageHTML in js/ui/page.js) as one React composition built from
// a RoadmapConfig. Order and nesting are Lite's: filter bar, export controls, the #roadmap-export container with the
// dashboard and the timeline grid, the dependency-arrow overlay, then the footers. `.filter-bar` stays a direct
// child of `.lite-area` so its sticky positioning behaves as in Lite (Pitfall 6). All view state lives in
// useLiteViewState; every change re-renders the whole area (the equivalent of Lite's renderRoadmap()).
import { useMemo } from 'react'
import {
  buildDashboardModel,
  buildFilterBarModel,
  buildRoadmapModel,
  groupNamesOf,
} from '@roadmapsnap/core'
import type { RoadmapConfig, ThemeName } from '@roadmapsnap/core'
import { useLiteViewState } from '../../hooks/useLiteViewState'
import { LiteDashboard } from './LiteDashboard'
import { LiteDependencyArrows } from './LiteDependencyArrows'
import { LiteExportControls } from './LiteExportControls'
import { LiteFilterBar } from './LiteFilterBar'
import { LiteFooter } from './LiteFooter'
import { LiteTimelineGrid } from './LiteTimelineGrid'

export interface LiteRoadmapViewProps {
  config: RoadmapConfig
  /** Today as DD/MM/YYYY. */
  today: string
  theme: ThemeName
  onThemeChange: (theme: ThemeName) => void
  onExportError: (err: unknown) => void
  /** Changing it (the workspace id) resets filter, sort, zoom, collapsed groups and the dependency graph. */
  resetKey?: string
}

function LiteRoadmapArea({ config, today, theme, onThemeChange, onExportError }: LiteRoadmapViewProps) {
  const [state, actions] = useLiteViewState()
  const roadmap = useMemo(() => buildRoadmapModel({ config, state, today, theme }), [config, state, today, theme])
  const dashboard = useMemo(() => buildDashboardModel(roadmap), [roadmap])
  const filterBar = useMemo(() => buildFilterBarModel(roadmap), [roadmap])
  const groupNames = useMemo(() => groupNamesOf(config.DELIVERABLES), [config])
  const deliverables = useMemo(() => config.DELIVERABLES || [], [config])

  // The arrows are measured after the commit; rows move when any of these change without a prop of the overlay changing.
  const layoutKey = useMemo(
    () => JSON.stringify([state.zoom, state.sort, state.filter, state.groupCollapsed, state.showGantt]),
    [state.zoom, state.sort, state.filter, state.groupCollapsed, state.showGantt],
  )

  return (
    <div className="lite-area">
      <LiteFilterBar
        model={filterBar}
        search={state.filter.search}
        actions={actions}
        groupNames={groupNames}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      <LiteExportControls config={config} today={today} onExportError={onExportError} />
      <div className="roadmap-container" id="roadmap-export">
        <LiteDashboard
          model={dashboard}
          onStatusClick={actions.statusClick}
          onRiskToggle={actions.toggleRisk}
          onDescopedToggle={actions.toggleDescoped}
        />
        <LiteTimelineGrid
          model={roadmap.timeline}
          onToggleGroup={actions.toggleGroup}
          onToggleGraph={(name) => actions.toggleGraph(name, groupNames)}
        />
      </div>
      <LiteDependencyArrows
        graphName={state.activeDependencyGraph}
        riskOnly={state.filter.riskOnly}
        deliverables={deliverables}
        workflow={roadmap.workflow}
        today={today}
        months={roadmap.timeline.months}
        layoutKey={layoutKey}
        onCloseGraph={actions.closeGraph}
        onClearStatusFilters={actions.clearStatusFilters}
      />
      <LiteFooter />
    </div>
  )
}

export function LiteRoadmapView(props: LiteRoadmapViewProps) {
  // A new resetKey remounts the area, so the view state starts from the defaults (the theme is owned by the caller).
  return <LiteRoadmapArea key={props.resetKey ?? ''} {...props} />
}
