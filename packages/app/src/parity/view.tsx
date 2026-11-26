// Parity harness preview: renders LiteRoadmapView (the whole React Lite area) from a payload the harness serves, so
// the 02-06 Playwright suite can compare it with Lite pixel by pixel. Built only with `vite build --mode parity`
// (parity-view.html into dist-parity) and never part of the default build. It loads only the shared tokens CSS, not
// the app's own stylesheet, so a difference points at core models, markup or shared CSS rather than page chrome.
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { apiToRoadmap, formatDDMMYYYY, normalizeTheme } from '@roadmapsnap/core'
import type { RoadmapConfig, ThemeName } from '@roadmapsnap/core'
import { LiteRoadmapView } from '../components/lite/LiteRoadmapView'
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
  const [theme, setTheme] = useState<ThemeName>(initialTheme)

  function changeTheme(next: ThemeName) {
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }

  return (
    <LiteRoadmapView
      config={config}
      today={today}
      theme={theme}
      onThemeChange={changeTheme}
      onExportError={(err) => console.error(err)}
    />
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
