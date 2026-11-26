// Parity harness preview: renders the React Lite area from a payload the harness serves, so the 02-06 Playwright
// suite can compare its regions with Lite pixel by pixel. Built only with `vite build --mode parity` (parity-view.html
// into dist-parity) and never part of the default build. It loads only the shared tokens CSS, not the app's own
// stylesheet, so a difference points at core models, markup or shared CSS rather than page chrome.
import { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  apiToRoadmap,
  buildDashboardModel,
  buildFilterBarModel,
  buildRoadmapModel,
  formatDDMMYYYY,
  groupNamesOf,
  normalizeTheme,
} from '@roadmapsnap/core'
import type { RoadmapConfig, ThemeName } from '@roadmapsnap/core'
import { LiteDashboard } from '../components/lite/LiteDashboard'
import { LiteFilterBar } from '../components/lite/LiteFilterBar'
import { useLiteViewState } from '../hooks/useLiteViewState'
import '@roadmapsnap/tokens/css'
import '@roadmapsnap/tokens/components.css'
import '@roadmapsnap/tokens/lite.css'

const THEME_KEY = 'roadmapsnap-theme'

function readTheme(): ThemeName {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return normalizeTheme(null)
  }
}

interface PreviewAreaProps {
  config: RoadmapConfig
  today: string
  initialTheme: ThemeName
}

function PreviewArea({ config, today, initialTheme }: PreviewAreaProps) {
  const [state, actions] = useLiteViewState()
  const [theme, setTheme] = useState<ThemeName>(initialTheme)
  const roadmap = useMemo(() => buildRoadmapModel({ config, state, today, theme }), [config, state, today, theme])
  const dashboard = useMemo(() => buildDashboardModel(roadmap), [roadmap])
  const filterBar = useMemo(() => buildFilterBarModel(roadmap), [roadmap])
  const groupNames = useMemo(() => groupNamesOf(config.DELIVERABLES), [config])

  function changeTheme(next: ThemeName) {
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }

  return (
    <div className="lite-area">
      <LiteFilterBar
        model={filterBar}
        search={state.filter.search}
        actions={actions}
        groupNames={groupNames}
        theme={theme}
        onThemeChange={changeTheme}
      />
      <div className="roadmap-container" id="roadmap-export">
        <LiteDashboard
          model={dashboard}
          onStatusClick={actions.statusClick}
          onRiskToggle={actions.toggleRisk}
          onDescopedToggle={actions.toggleDescoped}
        />
      </div>
    </div>
  )
}

async function main() {
  document.documentElement.dataset.parity = '__ROADMAPSNAP_PARITY__'
  const theme = readTheme()
  document.documentElement.setAttribute('data-theme', theme)
  const response = await fetch('/parity-view/payload.json')
  const payload = await response.json()
  // The harness freezes the clock, so this is the same "today" Lite reads.
  const today = formatDDMMYYYY(new Date())
  const config = apiToRoadmap(payload, { today })
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <PreviewArea config={config} today={today} initialTheme={theme} />,
  )
}

void main()
