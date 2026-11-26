// The React arrow overlay must draw what Lite's drawDependencyArrows draws for the same rectangles (VIEW-03).
// jsdom has no layout, so getBoundingClientRect is the deterministic mock shared with the Lite characterization.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { RoadmapModel } from '@roadmapsnap/core'
import { LiteDependencyArrows } from './LiteDependencyArrows'
import type { LiteDependencyArrowsProps } from './LiteDependencyArrows'
import { LiteTimelineGrid } from './LiteTimelineGrid'
import { normalizeHtmlString, normalizeMarkup } from '../../test/goldenMarkup'
import { loadLiteRenderers, liteModelFor } from '../../test/liteRenderer'
import { installRectMock } from '../../test/rectMock'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { complexConfig } from '../../../../../tests/fixtures/config.complex.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }
const layout = installRectMock()
let complex: unknown

beforeAll(() => {
  complex = canonicalRoadmap(complexConfig)
})

afterEach(() => {
  cleanup()
  layout.firstRowTop = 100
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const noop = () => {}

function arrowProps(model: RoadmapModel, overrides: Partial<LiteDependencyArrowsProps> = {}): LiteDependencyArrowsProps {
  return {
    graphName: model.state.activeDependencyGraph,
    riskOnly: model.state.filter.riskOnly,
    deliverables: model.config.DELIVERABLES || [],
    workflow: model.workflow,
    today: model.today,
    months: model.months,
    layoutKey: 'k',
    onCloseGraph: noop,
    onClearStatusFilters: noop,
    ...overrides,
  }
}

function View({ model, arrows }: { model: RoadmapModel; arrows: LiteDependencyArrowsProps }) {
  return (
    <>
      <LiteTimelineGrid model={model.timeline} onToggleGroup={noop} onToggleGraph={noop} />
      <LiteDependencyArrows {...arrows} />
    </>
  )
}

// The SVG Lite's drawDependencyArrows builds for the same state, measured with the same mocked rectangles.
async function liteSvg(): Promise<string> {
  const lite = await loadLiteRenderers()
  document.body.innerHTML = (lite.renderPageHTML as (state: unknown) => string)(lite.AppState.get())
  ;(globalThis as any).drawDependencyArrows()
  const svg = document.getElementById('dependency-arrows-svg')
  const out = svg ? svg.outerHTML : ''
  document.body.innerHTML = ''
  return out
}

const svgOf = (root: ParentNode) => root.querySelector('#dependency-arrows-svg') as SVGSVGElement | null
const content = () => document.querySelector('.roadmap-content') as HTMLElement

describe('LiteDependencyArrows equals Lite drawDependencyArrows', () => {
  const states: { name: string; patch: Record<string, unknown> }[] = [
    { name: 'graph Event Bus', patch: { activeDependencyGraph: 'Event Bus' } },
    { name: 'graph Web Portal', patch: { activeDependencyGraph: 'Web Portal' } },
    { name: 'graph Mobile App', patch: { activeDependencyGraph: 'Mobile App' } },
    { name: 'graph Data Lake with Platform collapsed', patch: { activeDependencyGraph: 'Data Lake', groupCollapsed: { Platform: true } } },
    { name: 'graph Event Bus at zoom 6mo', patch: { activeDependencyGraph: 'Event Bus', zoom: '6mo' } },
    { name: 'riskOnly without a graph', patch: { filter: { ...ALL, riskOnly: true } } },
  ]
  for (const state of states) {
    it(`complex / ${state.name}`, async () => {
      const { roadmapModel } = await liteModelFor(complex, state.patch)
      const expected = await liteSvg()
      expect(expected.startsWith('<svg id="dependency-arrows-svg"')).toBe(true)
      const { container } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
      const svg = svgOf(container)
      expect(svg).not.toBeNull()
      expect(normalizeMarkup(svg as Element)).toBe(normalizeHtmlString(expected))
      // titles (tooltip text) are compared on their own as well: they carry the multi-line arrow description
      const titles = (root: ParentNode) => Array.from(root.querySelectorAll('title')).map((t) => t.textContent)
      const liteDoc = document.createElement('div')
      liteDoc.innerHTML = expected
      expect(titles(svg as Element)).toEqual(titles(liteDoc))
      expect(titles(svg as Element).length).toBeGreaterThan(0)
    })
  }

  it('draws a blocked (red), a tight (orange) and a reached (green) arrow on the complex fixture', async () => {
    const colors = async (graph: string) => {
      const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: graph })
      const { container, unmount } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
      const html = (svgOf(container) as SVGSVGElement).outerHTML
      unmount()
      return html
    }
    expect(await colors('Event Bus')).toContain('url(#arrowhead-red)')
    expect(await colors('Mobile App')).toContain('url(#arrowhead-orange)')
    expect(await colors('Web Portal')).toContain('url(#arrowhead-green)')
  })
})

describe('LiteDependencyArrows visibility', () => {
  it('draws only red arrows with riskOnly and no graph', async () => {
    const { roadmapModel } = await liteModelFor(complex, { filter: { ...ALL, riskOnly: true } })
    const { container } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    const paths = Array.from(svgOf(container)!.querySelectorAll('path[marker-end]'))
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p.getAttribute('marker-end') === 'url(#arrowhead-red)')).toBe(true)
    expect(content().style.position).toBe('relative')
  })

  it('draws nothing and leaves .roadmap-content unpositioned with neither a graph nor riskOnly', async () => {
    const { roadmapModel } = await liteModelFor(complex)
    const { container } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    expect(svgOf(container)).toBeNull()
    expect(document.getElementById('dependency-arrows-svg')).toBeNull()
    expect(content().style.position).toBe('')
  })

  it('removes the SVG and the inline position when the graph closes, and brings them back when it opens', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const open = arrowProps(roadmapModel)
    const { rerender } = render(<View model={roadmapModel} arrows={open} />)
    expect(document.getElementById('dependency-arrows-svg')).not.toBeNull()
    expect(content().style.position).toBe('relative')
    rerender(<View model={roadmapModel} arrows={{ ...open, graphName: null }} />)
    expect(document.getElementById('dependency-arrows-svg')).toBeNull()
    expect(content().style.position).toBe('')
    rerender(<View model={roadmapModel} arrows={open} />)
    expect(document.getElementById('dependency-arrows-svg')).not.toBeNull()
  })

  it('removes the inline position on unmount', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const { rerender } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    const target = content()
    expect(target.style.position).toBe('relative')
    rerender(<LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={noop} />)
    expect(target.style.position).toBe('')
  })
})

describe('LiteDependencyArrows hover', () => {
  it('widens the visible path on hover and restores it on leave', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const { container } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    const group = svgOf(container)!.querySelector('g') as SVGGElement
    const visible = () => group.querySelectorAll('path')[1]
    expect(visible().getAttribute('stroke-width')).toBe('2')
    expect(visible().getAttribute('opacity')).toBe('0.8')
    fireEvent.mouseEnter(group)
    expect(visible().getAttribute('stroke-width')).toBe('3')
    expect(visible().getAttribute('opacity')).toBe('1')
    fireEvent.mouseLeave(group)
    expect(visible().getAttribute('stroke-width')).toBe('2')
    expect(visible().getAttribute('opacity')).toBe('0.8')
  })
})

describe('LiteDependencyArrows re-measure', () => {
  const firstPath = () => svgOf(document)!.querySelectorAll('g')[0].querySelectorAll('path')[1].getAttribute('d')

  it('re-measures on window resize', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    const before = firstPath()
    layout.firstRowTop = 160
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(firstPath()).not.toBe(before)
  })

  it('re-measures when layoutKey changes and not when nothing changes', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const props = arrowProps(roadmapModel)
    const { rerender } = render(<View model={roadmapModel} arrows={props} />)
    const before = firstPath()
    layout.firstRowTop = 160
    rerender(<View model={roadmapModel} arrows={{ ...props }} />)
    expect(firstPath()).toBe(before)
    rerender(<View model={roadmapModel} arrows={{ ...props, layoutKey: 'zoom-6mo' }} />)
    expect(firstPath()).not.toBe(before)
  })

  it('stops listening to resize after unmount', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<View model={roadmapModel} arrows={arrowProps(roadmapModel)} />)
    const added = add.mock.calls.filter(([type]) => type === 'resize')
    expect(added.length).toBeGreaterThan(0)
    unmount()
    for (const [, listener] of added) {
      expect(remove.mock.calls.some(([type, fn]) => type === 'resize' && fn === listener)).toBe(true)
    }
  })
})

describe('LiteDependencyArrows document clicks', () => {
  async function setup() {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const onCloseGraph = vi.fn()
    const onClearStatusFilters = vi.fn()
    const props = arrowProps(roadmapModel, { onCloseGraph, onClearStatusFilters })
    const view = render(<View model={roadmapModel} arrows={props} />)
    return { ...view, roadmapModel, props, onCloseGraph, onClearStatusFilters }
  }

  it('closes the graph and clears the status filters on a click outside both exclusion lists', async () => {
    const { container, onCloseGraph, onClearStatusFilters } = await setup()
    fireEvent.click(container.querySelector('.state-legend') as Element)
    expect(onCloseGraph).toHaveBeenCalledTimes(1)
    expect(onClearStatusFilters).toHaveBeenCalledTimes(1)
  })

  it('keeps the graph for a click on a dependency icon or a row, and keeps the filters for a row', async () => {
    const { container, onCloseGraph, onClearStatusFilters } = await setup()
    fireEvent.click(container.querySelector('.dependency-icon') as Element)
    fireEvent.click(container.querySelector('.data-source-row') as Element)
    expect(onCloseGraph).not.toHaveBeenCalled()
    expect(onClearStatusFilters).not.toHaveBeenCalled()
  })

  it('keeps the graph but clears the status filters for a click on a button', async () => {
    const { onCloseGraph, onClearStatusFilters } = await setup()
    const button = document.createElement('button')
    document.body.appendChild(button)
    fireEvent.click(button)
    expect(onCloseGraph).not.toHaveBeenCalled()
    expect(onClearStatusFilters).toHaveBeenCalledTimes(1)
  })

  it('keeps the status filters for a click inside the filter bar and the export controls', async () => {
    const { onClearStatusFilters } = await setup()
    for (const className of ['filter-bar', 'export-controls']) {
      const el = document.createElement('div')
      el.className = className
      document.body.appendChild(el)
      fireEvent.click(el)
    }
    expect(onClearStatusFilters).not.toHaveBeenCalled()
  })

  it('does not call onCloseGraph when no graph is open', async () => {
    const { roadmapModel } = await liteModelFor(complex)
    const onCloseGraph = vi.fn()
    const onClearStatusFilters = vi.fn()
    const { container } = render(
      <View model={roadmapModel} arrows={arrowProps(roadmapModel, { onCloseGraph, onClearStatusFilters })} />,
    )
    fireEvent.click(container.querySelector('.state-legend') as Element)
    expect(onCloseGraph).not.toHaveBeenCalled()
    expect(onClearStatusFilters).toHaveBeenCalledTimes(1)
  })

  it('registers its two click listeners once on mount, keeps them across re-renders and removes them on unmount', async () => {
    const { roadmapModel } = await liteModelFor(complex, { activeDependencyGraph: 'Event Bus' })
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const props = arrowProps(roadmapModel)
    const { rerender, unmount } = render(<View model={roadmapModel} arrows={props} />)
    const added = add.mock.calls.filter(([type]) => type === 'click')
    expect(added.length).toBe(2)
    rerender(<View model={roadmapModel} arrows={{ ...props, onCloseGraph: vi.fn(), layoutKey: 'other' }} />)
    expect(add.mock.calls.filter(([type]) => type === 'click').length).toBe(2)
    unmount()
    for (const [, listener] of added) {
      expect(remove.mock.calls.some(([type, fn]) => type === 'click' && fn === listener)).toBe(true)
    }
  })

  it('calls the latest handlers after a re-render', async () => {
    const { roadmapModel, props, container, rerender } = await setup()
    const latest = vi.fn()
    rerender(<View model={roadmapModel} arrows={{ ...props, onCloseGraph: latest }} />)
    fireEvent.click(container.querySelector('.state-legend') as Element)
    expect(latest).toHaveBeenCalledTimes(1)
  })
})
