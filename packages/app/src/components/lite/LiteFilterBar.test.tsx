// Golden-markup and behavior tests for the Lite filter bar (D-01, VIEW-04, VIEW-05).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { buildFilterBarModel } from '@roadmapsnap/core'
import type { FilterBarModel } from '@roadmapsnap/core'
import { LiteFilterBar } from './LiteFilterBar'
import type { LiteFilterBarActions } from './LiteFilterBar'
import { normalizeHtmlString, normalizeMarkup } from '../../test/goldenMarkup'
import { liteModelFor } from '../../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { complexConfig } from '../../../../../tests/fixtures/config.complex.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }

const states: { name: string; patch: Record<string, unknown>; theme?: string }[] = [
  { name: 'default', patch: {} },
  { name: 'search', patch: { filter: { ...ALL, search: 'Alp' } } },
  { name: 'status', patch: { filter: { ...ALL, status: 'DEV' } } },
  { name: 'zoom6', patch: { zoom: '6mo' } },
  { name: 'sortDesc', patch: { sort: { by: 'name', order: 'desc' } } },
  { name: 'monochrome theme', patch: {}, theme: 'monochrome' },
]

const configs: Record<string, unknown> = {}
const groupNames = ['Group A', 'Platform']

beforeAll(() => {
  configs.minimal = canonicalRoadmap(minimalConfig)
  configs.complex = canonicalRoadmap(complexConfig)
})

afterEach(() => {
  vi.useRealTimers()
})

function makeActions(): { [K in keyof LiteFilterBarActions]: ReturnType<typeof vi.fn> } {
  return {
    setSearch: vi.fn(),
    setSortBy: vi.fn(),
    setSortOrder: vi.fn(),
    setZoom: vi.fn(),
    expandAll: vi.fn(),
    collapseAll: vi.fn(),
    reset: vi.fn(),
  }
}

function bar(model: FilterBarModel, actions = makeActions(), extra: { search?: string; theme?: string; onThemeChange?: (t: any) => void } = {}) {
  return (
    <LiteFilterBar
      model={model}
      search={extra.search ?? model.searchValue}
      actions={actions}
      groupNames={groupNames}
      theme={(extra.theme ?? 'light') as any}
      onThemeChange={extra.onThemeChange ?? (() => {})}
    />
  )
}

describe('LiteFilterBar golden markup', () => {
  for (const fixtureName of ['minimal', 'complex']) {
    for (const state of states) {
      it(`${fixtureName} / ${state.name} equals Lite's renderFilterBar`, async () => {
        const theme = state.theme ?? 'light'
        const { roadmapModel, liteHtml } = await liteModelFor(configs[fixtureName], state.patch, theme)
        const model = buildFilterBarModel(roadmapModel)
        const { container } = render(bar(model, makeActions(), { theme }))
        expect(normalizeMarkup(container.firstElementChild as Element)).toBe(normalizeHtmlString(liteHtml.filterBar))
      })
    }
  }
})

describe('LiteFilterBar behavior', () => {
  async function modelFor(patch: Record<string, unknown> = {}, fixture = 'complex') {
    const { roadmapModel } = await liteModelFor(configs[fixture], patch)
    return buildFilterBarModel(roadmapModel)
  }

  it('commits the search once, 150 ms after the last keystroke, on the same input node, with the caret at the end', async () => {
    vi.useFakeTimers()
    const actions = makeActions()
    const model = await modelFor({}, 'minimal')
    const view = render(bar(model, actions))
    const input = view.container.querySelector('.filter-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.change(input, { target: { value: 'Al' } })
    fireEvent.change(input, { target: { value: 'Alp' } })
    act(() => { vi.advanceTimersByTime(149) })
    expect(actions.setSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(actions.setSearch).toHaveBeenCalledTimes(1)
    expect(actions.setSearch).toHaveBeenCalledWith('Alp')

    const searched = await modelFor({ filter: { ...ALL, search: 'Alp' } }, 'minimal')
    view.rerender(bar(searched, actions, { search: 'Alp' }))
    expect(view.container.querySelector('.filter-input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.value).toBe('Alp')
  })

  it('follows an external search reset (Clear Filters) without remounting', async () => {
    const actions = makeActions()
    const searched = await modelFor({ filter: { ...ALL, search: 'Alp' } }, 'minimal')
    const view = render(bar(searched, actions, { search: 'Alp' }))
    const input = view.container.querySelector('.filter-input') as HTMLInputElement
    expect(input.value).toBe('Alp')
    view.rerender(bar(await modelFor({}, 'minimal'), actions, { search: '' }))
    expect(view.container.querySelector('.filter-input')).toBe(input)
    expect(input.value).toBe('')
  })

  it('lists the eight themes with their labels, marks the current one and reports a change', async () => {
    const onThemeChange = vi.fn()
    const model = await modelFor()
    const { container } = render(bar(model, makeActions(), { theme: 'dark', onThemeChange }))
    const select = container.querySelector('.theme-select') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent)
    expect(labels).toEqual(['Light', 'Dark', 'Professional', 'Colorful', 'Blank', 'Monochrome', 'Papallona', 'Evergreen'])
    expect(select.value).toBe('dark')
    fireEvent.change(select, { target: { value: 'evergreen' } })
    expect(onThemeChange).toHaveBeenCalledWith('evergreen')
  })

  it('reads the results line exactly as Lite does, with no singular or plural handling', async () => {
    const model = { ...(await modelFor({}, 'minimal')), filteredCount: 1, totalVisible: 1 }
    const { container } = render(bar(model))
    expect(container.querySelector('.filter-results')?.textContent).toBe('Showing 1 of 1 deliverables')
  })

  it('shows Expand All and Collapse All only when there are groups, and Clear Filters only with active filters', async () => {
    const grouped = await modelFor()
    const actions = makeActions()
    const view = render(bar(grouped, actions))
    expect(view.container.querySelector('.filter-clear')).toBeNull()
    const buttons = Array.from(view.container.querySelectorAll('.group-control-btn'))
    expect(buttons.map((b) => b.textContent)).toEqual(['Expand All', 'Collapse All'])
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    expect(actions.expandAll).toHaveBeenCalledWith(groupNames)
    expect(actions.collapseAll).toHaveBeenCalledWith(groupNames)
    view.unmount()

    const filtered = await modelFor({ filter: { ...ALL, riskOnly: true } })
    const second = render(bar(filtered, actions))
    const clear = second.container.querySelector('.filter-clear') as HTMLElement
    fireEvent.click(clear)
    expect(actions.reset).toHaveBeenCalledTimes(1)
    second.unmount()

    const ungrouped = { ...grouped, hasGroups: false }
    const third = render(bar(ungrouped, actions))
    expect(third.container.querySelector('.group-controls')).toBeNull()
  })

  it('sends sort and zoom choices to the actions and gives the controls accessible names', async () => {
    const actions = makeActions()
    const model = await modelFor()
    const { container } = render(bar(model, actions))
    const input = container.querySelector('.filter-input') as HTMLElement
    expect(input.getAttribute('aria-label')).toBe('Search by name')
    const sortBy = container.querySelector('[aria-label="Sort by"]') as HTMLSelectElement
    const sortOrder = container.querySelector('[aria-label="Sort order"]') as HTMLSelectElement
    fireEvent.change(sortBy, { target: { value: 'risk' } })
    fireEvent.change(sortOrder, { target: { value: 'desc' } })
    expect(actions.setSortBy).toHaveBeenCalledWith('risk')
    expect(actions.setSortOrder).toHaveBeenCalledWith('desc')
    const zoomButtons = Array.from(container.querySelectorAll('.zoom-btn'))
    zoomButtons.forEach((b) => fireEvent.click(b))
    expect(actions.setZoom.mock.calls.map((c) => c[0])).toEqual([3, 6, 12, 'all'])
  })
})
