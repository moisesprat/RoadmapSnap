// React render of core's FilterBarModel with the tag tree and class names of Lite's renderFilterBar
// (js/ui/filterBar.js), so the shared tokens CSS styles both the same way (D-01). Every value is a JSX text node
// or attribute. The theme select lists the core THEMES (the options come from the model) and reports the choice
// through onThemeChange; the page applies it.
import { Fragment, useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { FilterBarModel, ThemeName } from '@roadmapsnap/core'
import type { LiteViewActions } from '../../hooks/useLiteViewState'

export type LiteFilterBarActions = Pick<
  LiteViewActions,
  'setSearch' | 'setSortBy' | 'setSortOrder' | 'setZoom' | 'expandAll' | 'collapseAll' | 'reset'
>

export interface LiteFilterBarProps {
  model: FilterBarModel
  /** The committed search text; the input follows it when it changes from outside (Clear Filters). */
  search: string
  actions: LiteFilterBarActions
  /** Every group of the roadmap, for Expand All and Collapse All. */
  groupNames: string[]
  theme: ThemeName
  onThemeChange: (theme: ThemeName) => void
}

// Lite commits the search 150 ms after the last keystroke.
const SEARCH_DEBOUNCE_MS = 150

function selectedValue(options: { value: string; selected: boolean }[]): string {
  const selected = options.find((option) => option.selected)
  return selected ? selected.value : options.length ? options[0].value : ''
}

export function LiteFilterBar({ model, search, actions, groupNames, theme, onThemeChange }: LiteFilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  // The input is uncontrolled and never remounted, so typing keeps its identity, focus and caret (Pitfall 8).
  // An outside change of the committed search (Clear Filters) is copied in, unless a keystroke is still pending.
  useEffect(() => {
    const input = inputRef.current
    if (input && timerRef.current === null && input.value !== search) input.value = search
  }, [search])

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      actionsRef.current.setSearch(value)
      const input = inputRef.current
      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <input
          ref={inputRef}
          type="text"
          className="filter-input"
          placeholder="Search by name..."
          aria-label="Search by name"
          defaultValue={search}
          onChange={handleSearchChange}
        />
      </div>
      <div className="filter-group">
        <span className="filter-label">Sort:</span>
        <select
          className="filter-select"
          aria-label="Sort by"
          value={selectedValue(model.sortByOptions)}
          onChange={(event) => actions.setSortBy(event.target.value)}
        >
          {model.sortByOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Sort order"
          value={selectedValue(model.sortOrderOptions)}
          onChange={(event) => actions.setSortOrder(event.target.value)}
        >
          {model.sortOrderOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {model.hasActiveFilters && (
        <button className="filter-clear" onClick={() => actions.reset()}>
          Clear Filters
        </button>
      )}
      {model.hasGroups && (
        <div className="group-controls">
          <button className="group-control-btn" onClick={() => actions.expandAll(groupNames)}>
            Expand All
          </button>{' '}
          <button className="group-control-btn" onClick={() => actions.collapseAll(groupNames)}>
            Collapse All
          </button>
        </div>
      )}
      <div className="zoom-controls">
        <span className="filter-label">Zoom:</span>
        {model.zoomOptions.map((option) => (
          <Fragment key={option.zoom}>
            {' '}
            <button
              className={option.active ? 'zoom-btn active' : 'zoom-btn'}
              onClick={() => actions.setZoom(option.months)}
            >
              {option.label}
            </button>
          </Fragment>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-label">Theme:</span>
        <select
          className="filter-select theme-select"
          title="Choose theme"
          value={theme}
          onChange={(event) => onThemeChange(event.target.value as ThemeName)}
        >
          {model.themeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-results">
        Showing <strong>{model.filteredCount}</strong> of <strong>{model.totalVisible}</strong> {model.scopeLabel}
      </div>
    </div>
  )
}
