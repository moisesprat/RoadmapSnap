/**
 * RoadmapSnap — filter bar logic
 * Uses AppState for filter/sort/showGantt. Subscriber in index.html calls renderRoadmap. Depends on AppState and CONFIG.
 * The filter and sort rules live in packages/core/src/filters.js; filterDeliverables, filterBySearchOnly and
 * sortDeliverables here are bindings that read AppState, CONFIG and the clock only to supply arguments.
 * Every UI transition (search, sort, status KPI click, risk and descoped toggles, outside-click clear) is a pure
 * function in packages/core/src/viewState.js, applied here as AppState.set(transition(AppState.get(), ...)).
 * renderFilterBar(model) only maps the FilterBarModel from packages/core/src/models.js to markup.
 */
import AppState from '../state/appState.js';
import * as core from '@roadmapsnap/core';
import { getWorkflow, getNonFilterableGroups } from '../core/workflow.js';
import { getTodayDate } from '../core/timeline.js';
import { getEffectiveAtRiskSet, getRedDependencyEndpointSet } from '../core/dependencies.js';
import { html, raw } from './renderer.js';

// Context the core filter and sort rules need, read once per call from AppState, CONFIG and the clock.
// The risk sets are computed over every deliverable (not just the rows being filtered), as before.
function getFilterContext() {
    const workflow = getWorkflow();
    const today = getTodayDate();
    return {
        workflow,
        today,
        nonFilterableGroups: getNonFilterableGroups(),
        effectiveAtRiskSet: getEffectiveAtRiskSet(),
        redEndpointSet: getRedDependencyEndpointSet()
    };
}

function filterDeliverables(sources) {
    return core.filterDeliverables(sources, { ...getFilterContext(), filter: AppState.get().filter });
}

/** Filter by search/name only (used for KPI stats when name filter is active so status/risk toggles don't change KPIs). */
function filterBySearchOnly(sources) {
    return core.filterBySearchOnly(sources, AppState.get().filter.search);
}

function sortDeliverables(sources) {
    const { workflow, today, effectiveAtRiskSet } = getFilterContext();
    return core.sortDeliverables(sources, { sort: AppState.get().sort, workflow, today, effectiveAtRiskSet });
}

function updateFilter(key, value) {
    const state = AppState.get();
    if (key === 'search') {
        clearTimeout(window.searchDebounceTimer);
        window.searchDebounceTimer = setTimeout(() => {
            AppState.set(core.setSearch(AppState.get(), value));
            if (typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
            const searchInput = document.querySelector('.filter-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
            }
        }, 150);
        return;
    }
    if (key === 'sortBy') {
        AppState.set(core.setSortBy(state, value));
    } else if (key === 'sortOrder') {
        AppState.set(core.setSortOrder(state, value));
    } else if (key === 'showGantt') {
        AppState.set(core.setShowGantt(state, value));
    } else {
        AppState.set({ filter: { ...state.filter, [key]: value } });
    }
    if (key !== 'showGantt' && typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
}

function clearFilters() {
    if (typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
    AppState.reset();
}

function filterByStatus(status, event) {
    if (event) event.stopPropagation();
    AppState.set(core.applyStatusFilter(AppState.get(), status));
    if (typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
}

function clearStatusFilterOnOutsideClick(event) {
    if (event.target.closest(core.STATUS_OUTSIDE_CLICK_EXCLUSIONS)) return;
    const state = AppState.get();
    const next = core.clearStatusFilters(state);
    if (next !== state) AppState.set(next);
}

function toggleRiskFilter(event) {
    if (event) event.stopPropagation();
    AppState.set(core.toggleRiskOnly(AppState.get()));
    if (typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
}

function toggleDescopedFilter(event) {
    if (event) event.stopPropagation();
    AppState.set(core.toggleDescopedOnly(AppState.get()));
    if (typeof window.closeDependencyGraph === 'function') window.closeDependencyGraph();
}

// Option and button lists are joined with the same newline and indentation the template had, so the markup
// is byte-identical to the hand-written one.
function renderOptions(options, indent) {
    return raw(options.map(function (o) {
        return html`<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`;
    }).join('\n' + indent));
}

function renderFilterBar(model) {
    return html`<div class="filter-bar">
        <div class="filter-group">
            <input type="text" class="filter-input" placeholder="Search by name..." value="${(typeof window.escapeHtmlAttr === 'function' ? window.escapeHtmlAttr(model.searchValue) : model.searchValue)}" oninput="updateFilter('search', this.value)">
        </div>
        <div class="filter-group">
            <span class="filter-label">Sort:</span>
            <select class="filter-select" onchange="updateFilter('sortBy', this.value)">
                ${renderOptions(model.sortByOptions, '                ')}
            </select>
            <select class="filter-select" onchange="updateFilter('sortOrder', this.value)">
                ${renderOptions(model.sortOrderOptions, '                ')}
            </select>
        </div>
        ${model.hasActiveFilters ? [html`<button class="filter-clear" onclick="clearFilters()">Clear Filters</button>`] : []}
        ${model.hasGroups ? [html`<div class="group-controls">
            <button class="group-control-btn" onclick="expandAllGroups()">Expand All</button>
            <button class="group-control-btn" onclick="collapseAllGroups()">Collapse All</button>
        </div>`] : []}
        <div class="zoom-controls">
            <span class="filter-label">Zoom:</span>
            ${raw(model.zoomOptions.map(function (z) {
                return html`<button class="zoom-btn ${z.active ? 'active' : ''}" onclick="setDateRange(${z.months === 'all' ? "'all'" : z.months})">${z.label}</button>`;
            }).join('\n            '))}
        </div>
        <div class="filter-group">
            <span class="filter-label">Theme:</span>
            <select class="filter-select theme-select" onchange="AppState.set({ theme: this.value })" title="Choose theme">
                ${renderOptions(model.themeOptions, '                ')}
            </select>
        </div>
        <div class="filter-results">
            Showing <strong>${model.filteredCount}</strong> of <strong>${model.totalVisible}</strong> ${model.scopeLabel}
        </div>
    </div>`;
}

// Export on window for global access
window.filterDeliverables = filterDeliverables;
window.filterBySearchOnly = filterBySearchOnly;
window.sortDeliverables = sortDeliverables;
window.updateFilter = updateFilter;
window.clearFilters = clearFilters;
window.filterByStatus = filterByStatus;
window.clearStatusFilterOnOutsideClick = clearStatusFilterOnOutsideClick;
window.toggleRiskFilter = toggleRiskFilter;
window.toggleDescopedFilter = toggleDescopedFilter;
window.renderFilterBar = renderFilterBar;
