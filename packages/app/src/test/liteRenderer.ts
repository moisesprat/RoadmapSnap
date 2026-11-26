// Loads Lite's own renderers inside jsdom so a React component can be compared with them (D-01 golden tests).
// The model comes from @roadmapsnap/core with the same inputs Lite's page binding uses; the HTML comes from
// Lite's renderers. The timeline grid, export controls and footer HTML are returned too, because 02-17 builds those components on
// this helper.
import { buildDashboardModel, buildFilterBarModel, buildRoadmapModel } from '@roadmapsnap/core'
import type { RoadmapModel } from '@roadmapsnap/core'

const nodeProcess = (globalThis as any).process

type LiteGlobals = {
  AppState: { reset(): void; set(patch: Record<string, unknown>): void; get(): Record<string, unknown> }
  renderPageHTML: unknown
  renderFooter: () => string
}

let loaded: LiteGlobals | null = null

// Newer Node versions define a global localStorage getter that yields undefined without a file, hiding jsdom's;
// Lite's AppState reads the stored theme at import, so install a plain in-memory store.
function installLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
    },
  })
}

/** Imports Lite's browser modules (they attach their renderers to window) once per test file. */
export async function loadLiteRenderers(): Promise<LiteGlobals> {
  if (loaded) return loaded
  // Lite positions are computed from local-time Dates; pin the zone so every machine renders the same text.
  nodeProcess.env.TZ = 'UTC'
  installLocalStorage()
  // @ts-ignore Lite is plain JavaScript without declarations
  const { default: AppState } = await import('../../../../js/state/appState.js')
  // @ts-ignore
  await import('../../../../js/app.js')
  // @ts-ignore
  const page = await import('../../../../js/ui/page.js')
  loaded = { AppState, renderPageHTML: page.renderPageHTML, renderFooter: page.renderFooter }
  return loaded
}

export interface LiteHtml {
  dashboard: string
  timeline: string
  filterBar: string
  exportControls: string
  footer: string
}

/**
 * @param config a roadmap config (use `canonicalRoadmap(fixture)` so SaaS and Lite start from the same data)
 * @param statePatch Lite view-state fields to set on top of the defaults (a patch of `filter` must be complete)
 * @param theme the theme both renderings are made for
 */
export async function liteModelFor(
  config: unknown,
  statePatch: Record<string, unknown> = {},
  theme = 'light',
): Promise<{ roadmapModel: RoadmapModel; liteHtml: LiteHtml }> {
  const lite = await loadLiteRenderers()
  const win = globalThis as any
  win.CONFIG = structuredClone(config)
  document.documentElement.setAttribute('data-theme', theme)
  lite.AppState.reset()
  lite.AppState.set({ ...statePatch, theme })
  const roadmapModel = buildRoadmapModel({
    config: win.CONFIG,
    state: lite.AppState.get() as any,
    today: win.CONFIG.TIMELINE.TODAY,
    theme,
  })
  const liteHtml: LiteHtml = {
    dashboard: win.renderDashboard(buildDashboardModel(roadmapModel)),
    timeline: win.renderTimelineGrid(roadmapModel.timeline),
    filterBar: win.renderFilterBar(buildFilterBarModel(roadmapModel)),
    exportControls: win.renderExportControls(lite.AppState.get()),
    footer: lite.renderFooter(),
  }
  return { roadmapModel, liteHtml }
}
