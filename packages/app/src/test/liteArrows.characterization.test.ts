// Characterizes the SVG Lite draws for dependency arrows: the markup is recorded from the code as it was before
// the arrow geometry moved into @roadmapsnap/core, so the refactor must reproduce it byte for byte.
// jsdom has no layout, so Element.prototype.getBoundingClientRect is replaced by a deterministic function of
// the element's row index and class. Record with UPDATE_LITE_SNAPSHOTS=1.
import { beforeAll, describe, expect, it } from 'vitest'
// @ts-ignore Lite is plain JavaScript without declarations
import { complexConfig } from '../../../../tests/fixtures/config.complex.js'

// The app has no Node type declarations, so the Node globals and the fs module are reached through any.
const nodeProcess = (globalThis as any).process
nodeProcess.env.TZ = 'UTC'

const fixturePath = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '')).replace(/[^/]*$/, '__fixtures__/lite-arrows.json')
const update = nodeProcess.env.UPDATE_LITE_SNAPSHOTS === '1'
const FS_MODULE = 'node:fs'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }

const cases: { key: string; patch: Record<string, unknown> }[] = [
  { key: 'complex:graphEventBus', patch: { activeDependencyGraph: 'Event Bus' } },
  { key: 'complex:graphWebPortal', patch: { activeDependencyGraph: 'Web Portal' } },
  { key: 'complex:graphEventBusPlatformCollapsed', patch: { activeDependencyGraph: 'Event Bus', groupCollapsed: { Platform: true } } },
  { key: 'complex:graphDataLake', patch: { activeDependencyGraph: 'Data Lake' } },
  { key: 'complex:graphDataLakePlatformCollapsed', patch: { activeDependencyGraph: 'Data Lake', groupCollapsed: { Platform: true } } },
  { key: 'complex:graphEventBusZoom6', patch: { activeDependencyGraph: 'Event Bus', zoom: '6mo' } },
  { key: 'complex:riskOnly', patch: { filter: { ...ALL, riskOnly: true } } },
]

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

// Rows are 40px apart starting at y=100; the track starts at x=260 and is 740px wide; the container sits at (10, 20).
function installRectMock() {
  const rect = (left: number, top: number, width: number, height: number) => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
    toJSON() { return this },
  })
  const rowIndexOf = (el: Element) => {
    const row = el.closest('.data-source-row')
    return row ? Array.from(document.querySelectorAll('.data-source-row')).indexOf(row) : -1
  }
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains('roadmap-content')) return rect(10, 20, 1000, 900) as DOMRect
    if (this.classList.contains('data-source-row')) return rect(10, 100 + rowIndexOf(this) * 40, 1000, 36) as DOMRect
    if (this.classList.contains('timeline-track')) return rect(260, 100 + rowIndexOf(this) * 40, 740, 36) as DOMRect
    return rect(0, 0, 0, 0) as DOMRect
  }
}

type Lite = {
  AppState: { reset(): void; set(patch: Record<string, unknown>): void; get(): Record<string, unknown> }
  renderPageHTML: (state: unknown) => string
  drawDependencyArrows: () => void
}

let lite: Lite
let recorded: Record<string, string> = {}

function arrowsFor(patch: Record<string, unknown>): string {
  ;(globalThis as any).CONFIG = structuredClone(complexConfig)
  lite.AppState.reset()
  lite.AppState.set({ theme: 'light', ...patch })
  document.body.innerHTML = lite.renderPageHTML(lite.AppState.get())
  lite.drawDependencyArrows()
  const svg = document.getElementById('dependency-arrows-svg')
  return svg ? svg.outerHTML : ''
}

describe('Lite dependency arrows (jsdom, mocked rectangles)', () => {
  beforeAll(async () => {
    ;(globalThis as any).CONFIG = structuredClone(complexConfig)
    installLocalStorage()
    installRectMock()
    // @ts-ignore Lite is plain JavaScript without declarations
    const { default: AppState } = await import('../../../../js/state/appState.js')
    // @ts-ignore
    await import('../../../../js/app.js')
    // @ts-ignore
    const { renderPageHTML } = await import('../../../../js/ui/page.js')
    // @ts-ignore dependencyArrows.js only attaches drawDependencyArrows to window
    await import('../../../../js/ui/dependencyArrows.js')
    lite = { AppState, renderPageHTML, drawDependencyArrows: (globalThis as any).drawDependencyArrows }
    const fs = await import(/* @vite-ignore */ FS_MODULE)
    if (update) {
      const next: Record<string, string> = {}
      for (const c of cases) next[c.key] = arrowsFor(c.patch)
      fs.writeFileSync(fixturePath, JSON.stringify(next, null, 2) + '\n')
    }
    recorded = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  })

  for (const c of cases) {
    it(`draws the recorded SVG for ${c.key}`, () => {
      expect(c.key in recorded).toBe(true)
      const actual = arrowsFor(c.patch)
      expect(actual.startsWith('<svg id="dependency-arrows-svg"')).toBe(true)
      expect(actual).toBe(recorded[c.key])
    })
  }

  it('colors the edges of the complex fixture red, orange and green', () => {
    expect(arrowsFor({ activeDependencyGraph: 'Event Bus' })).toContain('url(#arrowhead-red)')
    expect(arrowsFor({ activeDependencyGraph: 'Mobile App' })).toContain('url(#arrowhead-orange)')
    expect(arrowsFor({ activeDependencyGraph: 'Web Portal' })).toContain('url(#arrowhead-green)')
  })

  it('draws only red edges when the risk filter is on and no graph is open', () => {
    arrowsFor({ filter: { ...ALL, riskOnly: true } })
    const paths = Array.from(document.querySelectorAll('#dependency-arrows-svg path[marker-end]'))
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p.getAttribute('marker-end') === 'url(#arrowhead-red)')).toBe(true)
  })

  it('skips an edge whose row is hidden by a collapsed group', () => {
    const open = arrowsFor({ activeDependencyGraph: 'Data Lake' })
    const collapsed = arrowsFor({ activeDependencyGraph: 'Data Lake', groupCollapsed: { Platform: true } })
    const count = (s: string) => (s.match(/<g /g) || []).length
    expect(count(collapsed)).toBeGreaterThan(0)
    expect(count(collapsed)).toBeLessThan(count(open))
  })

  it('highlights an arrow on hover and keeps the container positioned', () => {
    arrowsFor({ activeDependencyGraph: 'Event Bus' })
    const group = document.querySelector('#dependency-arrows-svg g') as SVGGElement
    const visible = group.querySelectorAll('path')[1]
    expect(visible.getAttribute('stroke-width')).toBe('2')
    expect(visible.getAttribute('opacity')).toBe('0.8')
    group.dispatchEvent(new Event('mouseenter'))
    expect(visible.getAttribute('stroke-width')).toBe('3')
    expect(visible.getAttribute('opacity')).toBe('1')
    group.dispatchEvent(new Event('mouseleave'))
    expect(visible.getAttribute('stroke-width')).toBe('2')
    expect(visible.getAttribute('opacity')).toBe('0.8')
    expect((document.querySelector('.roadmap-content') as HTMLElement).style.position).toBe('relative')
  })
})
