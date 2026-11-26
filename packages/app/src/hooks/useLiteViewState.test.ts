import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DEFAULT_VIEW_STATE } from '@roadmapsnap/core'
import { useLiteViewState } from './useLiteViewState'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }

function setup() {
  return renderHook(() => useLiteViewState())
}

describe('useLiteViewState', () => {
  it('starts at the core defaults', () => {
    const { result } = setup()
    expect(result.current[0]).toEqual(DEFAULT_VIEW_STATE)
  })

  it('keeps action identities stable across renders', () => {
    const { result } = setup()
    const first = result.current[1]
    act(() => result.current[1].setSearch('a'))
    expect(result.current[1]).toBe(first)
    expect(result.current[1].toggleRisk).toBe(first.toggleRisk)
  })

  it('applies search, sort and Gantt through the core transitions', () => {
    const { result } = setup()
    act(() => result.current[1].setSearch('Alp'))
    act(() => result.current[1].setSortBy('name'))
    act(() => result.current[1].setSortOrder('desc'))
    act(() => result.current[1].setShowGantt(false))
    expect(result.current[0].filter.search).toBe('Alp')
    expect(result.current[0].sort).toEqual({ by: 'name', order: 'desc' })
    expect(result.current[0].showGantt).toBe(false)
  })

  it('selects a status on a KPI click, returns to ALL on a second click and clears the risk toggle', () => {
    const { result } = setup()
    act(() => result.current[1].toggleRisk())
    expect(result.current[0].filter.riskOnly).toBe(true)
    act(() => result.current[1].statusClick('DEV'))
    expect(result.current[0].filter).toEqual({ ...ALL, status: 'DEV' })
    act(() => result.current[1].statusClick('DEV'))
    expect(result.current[0].filter.status).toBe('ALL')
  })

  it('flips the risk and descoped toggles against each other', () => {
    const { result } = setup()
    act(() => result.current[1].toggleRisk())
    act(() => result.current[1].toggleDescoped())
    expect(result.current[0].filter).toEqual({ ...ALL, descopedOnly: true })
    act(() => result.current[1].toggleRisk())
    expect(result.current[0].filter).toEqual({ ...ALL, riskOnly: true })
  })

  it('clears the status filters but keeps the search, and keeps the same state when there is nothing to clear', () => {
    const { result } = setup()
    act(() => result.current[1].setSearch('x'))
    const before = result.current[0]
    act(() => result.current[1].clearStatusFilters())
    expect(result.current[0]).toBe(before)
    act(() => result.current[1].statusClick('DEV'))
    act(() => result.current[1].clearStatusFilters())
    expect(result.current[0].filter).toEqual({ ...ALL, search: 'x' })
  })

  it('zooms to the last N months or to everything', () => {
    const { result } = setup()
    act(() => result.current[1].setZoom(6))
    expect(result.current[0].zoom).toBe('6mo')
    act(() => result.current[1].setZoom('all'))
    expect(result.current[0].zoom).toBe('all')
  })

  it('toggles, expands and collapses groups', () => {
    const { result } = setup()
    act(() => result.current[1].toggleGroup('Platform'))
    expect(result.current[0].groupCollapsed).toEqual({ Platform: true })
    act(() => result.current[1].collapseAll(['Platform', 'Apps']))
    expect(result.current[0].groupCollapsed).toEqual({ Platform: true, Apps: true })
    act(() => result.current[1].expandAll(['Platform', 'Apps']))
    expect(result.current[0].groupCollapsed).toEqual({ Platform: false, Apps: false })
  })

  it('opens a graph, expands the groups of its nodes and clears the filters; the same click closes it', () => {
    const { result } = setup()
    act(() => result.current[1].collapseAll(['Platform', 'Apps', 'Data']))
    act(() => result.current[1].toggleRisk())
    act(() => result.current[1].setSearch('zz'))
    act(() => result.current[1].toggleGraph('Event Bus', ['Platform', 'Apps']))
    expect(result.current[0].activeDependencyGraph).toBe('Event Bus')
    expect(result.current[0].groupCollapsed).toEqual({ Platform: false, Apps: false, Data: true })
    expect(result.current[0].filter).toEqual(ALL)
    act(() => result.current[1].toggleGraph('Event Bus', ['Platform', 'Apps']))
    expect(result.current[0].activeDependencyGraph).toBeNull()
  })

  it('closes the open graph on filter, sort and zoom actions, as Lite does, but not on Gantt or group changes', () => {
    const open = (r: ReturnType<typeof setup>['result']) => act(() => r.current[1].toggleGraph('Event Bus', []))
    const closing: [string, (a: ReturnType<typeof setup>['result']['current'][1]) => void][] = [
      ['setSearch', (a) => a.setSearch('q')],
      ['setSortBy', (a) => a.setSortBy('name')],
      ['setSortOrder', (a) => a.setSortOrder('desc')],
      ['statusClick', (a) => a.statusClick('DEV')],
      ['toggleRisk', (a) => a.toggleRisk()],
      ['toggleDescoped', (a) => a.toggleDescoped()],
      ['setZoom', (a) => a.setZoom(3)],
      ['reset', (a) => a.reset()],
      ['closeGraph', (a) => a.closeGraph()],
    ]
    for (const [name, run] of closing) {
      const { result } = setup()
      open(result)
      expect(result.current[0].activeDependencyGraph, name).toBe('Event Bus')
      act(() => run(result.current[1]))
      expect(result.current[0].activeDependencyGraph, name).toBeNull()
    }
    const { result } = setup()
    open(result)
    act(() => result.current[1].setShowGantt(false))
    act(() => result.current[1].toggleGroup('Platform'))
    expect(result.current[0].activeDependencyGraph).toBe('Event Bus')
  })

  it('reset returns to the defaults', () => {
    const { result } = setup()
    act(() => result.current[1].setSearch('x'))
    act(() => result.current[1].setSortBy('name'))
    act(() => result.current[1].setZoom(3))
    act(() => result.current[1].toggleGroup('Platform'))
    act(() => result.current[1].setShowGantt(false))
    act(() => result.current[1].reset())
    expect(result.current[0]).toEqual(DEFAULT_VIEW_STATE)
  })
})
