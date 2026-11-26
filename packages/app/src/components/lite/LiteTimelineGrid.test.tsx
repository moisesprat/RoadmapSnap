// Golden-markup test (D-01): the React timeline grid must equal Lite's renderTimelineGrid for the same core
// TimelineModel, including every title attribute (resolved OQ3: tooltip text is asserted on the DOM).
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { LiteTimelineGrid } from './LiteTimelineGrid'
import { normalizeHtmlString, normalizeMarkup } from '../../test/goldenMarkup'
import { liteModelFor } from '../../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { complexConfig } from '../../../../../tests/fixtures/config.complex.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }

const states: { name: string; patch: Record<string, unknown> }[] = [
  { name: 'default', patch: {} },
  { name: 'collapsed group', patch: { groupCollapsed: { Platform: true } } },
  { name: 'active graph', patch: { activeDependencyGraph: 'Event Bus' } },
  { name: 'zoom 6mo', patch: { zoom: '6mo' } },
  { name: 'riskOnly', patch: { filter: { ...ALL, riskOnly: true } } },
  { name: 'gantt off', patch: { showGantt: false } },
]

const fixtures: Record<string, unknown> = {}

beforeAll(() => {
  fixtures.minimal = canonicalRoadmap(minimalConfig)
  fixtures.complex = canonicalRoadmap(complexConfig)
})

const noop = () => {}

describe('LiteTimelineGrid golden markup', () => {
  for (const fixtureName of ['minimal', 'complex']) {
    for (const state of states) {
      it(`${fixtureName} / ${state.name} equals Lite's renderTimelineGrid`, async () => {
        const { roadmapModel, liteHtml } = await liteModelFor(fixtures[fixtureName], state.patch)
        const { container } = render(
          <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={noop} />,
        )
        expect(normalizeMarkup(container.firstElementChild as Element)).toBe(normalizeHtmlString(liteHtml.timeline))
      })
    }
  }
})

describe('LiteTimelineGrid tooltips (OQ3)', () => {
  const titlesOf = (root: ParentNode) => Array.from(root.querySelectorAll('[title]')).map((el) => el.getAttribute('title'))

  for (const state of states) {
    it(`complex / ${state.name}: every title value and its order equal Lite's`, async () => {
      const { roadmapModel, liteHtml } = await liteModelFor(fixtures.complex, state.patch)
      const { container } = render(
        <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={noop} />,
      )
      const lite = document.createElement('div')
      lite.innerHTML = liteHtml.timeline
      const expected = titlesOf(lite)
      expect(expected.length).toBeGreaterThan(0)
      expect(titlesOf(container)).toEqual(expected)
    })
  }

  it('keeps the newlines of a multi-line gantt tooltip', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.complex)
    const { container } = render(
      <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={noop} />,
    )
    const bar = container.querySelector('.gantt-bar') as HTMLElement
    expect(bar.getAttribute('title')).toContain('\n')
  })

  it('renders the gantt tooltip overlay in place of the bars when the gantt is off', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.complex, { showGantt: false })
    const { container } = render(
      <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={noop} />,
    )
    expect(container.querySelector('.gantt-bar')).toBeNull()
    expect(container.querySelector('.gantt-tooltip-overlay')).not.toBeNull()
  })
})

describe('LiteTimelineGrid links (T-02-24)', () => {
  it('renders an .info-link only for http(s) links', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.complex)
    const model = structuredClone(roadmapModel.timeline)
    const rows = model.sections.flatMap((section) => section.rows)
    const links = ['javascript:alert(1)', 'data:text/html,x', '/relative/path', 'https://example.com/ok']
    rows.slice(0, links.length).forEach((row, index) => {
      row.link = links[index]
      row.safeLink = links[index].startsWith('http') ? links[index] : null
    })
    rows.slice(links.length).forEach((row) => {
      row.link = null
      row.safeLink = null
    })
    const { container } = render(<LiteTimelineGrid model={model} onToggleGroup={noop} onToggleGraph={noop} />)
    const anchors = Array.from(container.querySelectorAll('.info-link'))
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(['https://example.com/ok'])
    expect(container.innerHTML).not.toContain('javascript:')
    expect(container.innerHTML).not.toContain('data:text')
    const anchor = anchors[0]
    expect(anchor.getAttribute('target')).toBe('_blank')
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
    expect(anchor.getAttribute('title')).toBe('More info')
  })
})

describe('LiteTimelineGrid interactions', () => {
  it('toggles a group from its header with click, Enter and Space', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.complex)
    const onToggleGroup = vi.fn()
    const { container } = render(
      <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={onToggleGroup} onToggleGraph={noop} />,
    )
    const header = container.querySelector('.group-header') as HTMLElement
    const name = (roadmapModel.timeline.sections.find((s) => s.kind === 'group') as { name: string }).name
    fireEvent.click(header)
    fireEvent.keyDown(header, { key: 'Enter' })
    fireEvent.keyDown(header, { key: ' ' })
    fireEvent.keyDown(header, { key: 'a' })
    expect(onToggleGroup).toHaveBeenCalledTimes(3)
    expect(onToggleGroup).toHaveBeenCalledWith(name)
  })

  it('toggles the dependency graph from the icon without bubbling to the document', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.complex)
    const onToggleGraph = vi.fn()
    const onDocumentClick = vi.fn()
    document.addEventListener('click', onDocumentClick)
    const { container } = render(
      <LiteTimelineGrid model={roadmapModel.timeline} onToggleGroup={noop} onToggleGraph={onToggleGraph} />,
    )
    const icon = container.querySelector('.dependency-icon') as HTMLElement
    const rowName = (icon.closest('.data-source-row') as HTMLElement).querySelector('.source-name-text')!.textContent
    fireEvent.click(icon)
    document.removeEventListener('click', onDocumentClick)
    expect(onToggleGraph).toHaveBeenCalledWith(rowName)
    expect(onDocumentClick).not.toHaveBeenCalled()
  })
})
