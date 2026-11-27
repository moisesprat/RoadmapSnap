/**
 * RoadmapSnap core: view state (filters, sort, zoom, collapsed groups) and its pure transitions.
 * Every UI action of Lite is a function `(state, ...args) => nextState` here, so Lite's handlers and the SaaS
 * app apply the same rules. Transitions return a new object and never mutate their input.
 * Pure: no DOM, no storage, no clock.
 */

/**
 * @typedef {{ status: string, riskOnly: boolean, descopedOnly: boolean, search: string }} FilterFields
 * @typedef {{
 *   filter: FilterFields,
 *   sort: { by: string, order: string },
 *   zoom: string,
 *   showGantt: boolean,
 *   groupCollapsed: Record<string, boolean>,
 *   activeDependencyGraph: string | null
 * }} CoreViewState
 */

/** Lite's defaults: no filter, sorted by the last milestone ascending, whole timeline, Gantt shown. */
export const DEFAULT_VIEW_STATE = Object.freeze({
    filter: Object.freeze({ status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }),
    sort: Object.freeze({ by: 'm3date', order: 'asc' }),
    zoom: 'all',
    showGantt: true,
    groupCollapsed: Object.freeze(/** @type {Record<string, boolean>} */ ({})),
    activeDependencyGraph: /** @type {string | null} */ (null),
});

/**
 * Elements whose clicks must not clear the status, risk and descoped filters (a CSS selector list).
 * Lite passes it to `event.target.closest()`.
 */
export const STATUS_OUTSIDE_CLICK_EXCLUSIONS = '.kpi-card.clickable, .risk-summary.clickable, .descoped-summary.clickable, .filter-bar, .export-controls, .info-link, .data-source-row';

/** Elements whose clicks must not close the open dependency graph (a CSS selector list). */
export const GRAPH_OUTSIDE_CLICK_EXCLUSIONS = '.dependency-icon, .data-source-row, .filter-bar, .filter-toggle, button, select';

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {Partial<FilterFields>} patch
 * @returns {S}
 */
function withFilter(state, patch) {
    return { ...state, filter: { ...state.filter, ...patch } };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} search
 * @returns {S}
 */
export function setSearch(state, search) {
    return withFilter(state, { search });
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} by 'name', 'status', 'm3date' or 'risk'
 * @returns {S}
 */
export function setSortBy(state, by) {
    return { ...state, sort: { ...state.sort, by } };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} order 'asc' or 'desc'
 * @returns {S}
 */
export function setSortOrder(state, order) {
    return { ...state, sort: { ...state.sort, order } };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {boolean} showGantt
 * @returns {S}
 */
export function setShowGantt(state, showGantt) {
    return { ...state, showGantt };
}

/**
 * A KPI card click: selects the status (or returns to 'ALL' when it is already selected) and clears the risk
 * and descoped toggles. The search text is kept.
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} status
 * @returns {S}
 */
export function applyStatusFilter(state, status) {
    const next = state.filter.status === status ? 'ALL' : status;
    return withFilter(state, { status: next, riskOnly: false, descopedOnly: false });
}

/**
 * The at-risk summary click: flips riskOnly and clears descopedOnly.
 * @template {CoreViewState} S
 * @param {S} state
 * @returns {S}
 */
export function toggleRiskOnly(state) {
    return withFilter(state, { riskOnly: !state.filter.riskOnly, descopedOnly: false });
}

/**
 * The descoped summary click: flips descopedOnly and clears riskOnly.
 * @template {CoreViewState} S
 * @param {S} state
 * @returns {S}
 */
export function toggleDescopedOnly(state) {
    return withFilter(state, { descopedOnly: !state.filter.descopedOnly, riskOnly: false });
}

/**
 * The outside-click clear: status back to 'ALL' and both toggles off, search kept. Returns the same object
 * when there is nothing to clear, so callers can skip the update (and the re-render).
 * @template {CoreViewState} S
 * @param {S} state
 * @returns {S}
 */
export function clearStatusFilters(state) {
    const { status, riskOnly, descopedOnly } = state.filter;
    if (status === 'ALL' && !riskOnly && !descopedOnly) return state;
    return withFilter(state, { status: 'ALL', riskOnly: false, descopedOnly: false });
}

/**
 * Clear Filters: the defaults plus the current theme, with fresh (unfrozen) nested objects.
 * @param {{ theme?: string }} state
 * @returns {CoreViewState & { theme?: string }}
 */
export function resetViewState(state) {
    return {
        filter: { ...DEFAULT_VIEW_STATE.filter },
        sort: { ...DEFAULT_VIEW_STATE.sort },
        zoom: DEFAULT_VIEW_STATE.zoom,
        showGantt: DEFAULT_VIEW_STATE.showGantt,
        groupCollapsed: { ...DEFAULT_VIEW_STATE.groupCollapsed },
        activeDependencyGraph: DEFAULT_VIEW_STATE.activeDependencyGraph,
        theme: state.theme,
    };
}

/**
 * Zoom to the last N months from today ('<N>mo') or to the whole timeline ('all'); closes the dependency graph.
 * @template {CoreViewState} S
 * @param {S} state
 * @param {number | string} months a month count, or 'all'
 * @returns {S}
 */
export function setZoom(state, months) {
    return { ...state, zoom: months === 'all' ? 'all' : months + 'mo', activeDependencyGraph: null };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} groupName
 * @returns {S}
 */
export function toggleGroup(state, groupName) {
    // Own-property read: a group named like an Object.prototype key (constructor, toString) has no inherited flag.
    const collapsed = Object.hasOwn(state.groupCollapsed, groupName) && state.groupCollapsed[groupName];
    return { ...state, groupCollapsed: { ...state.groupCollapsed, [groupName]: !collapsed } };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string[]} groupNames every group of the roadmap
 * @returns {S}
 */
export function expandAllGroups(state, groupNames) {
    return setCollapsed(state, groupNames, false);
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string[]} groupNames every group of the roadmap
 * @returns {S}
 */
export function collapseAllGroups(state, groupNames) {
    return setCollapsed(state, groupNames, true);
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string[]} groupNames
 * @param {boolean} collapsed
 * @returns {S}
 */
function setCollapsed(state, groupNames, collapsed) {
    // fromEntries and spread define own properties; `groupCollapsed[name] = ...` would hit the __proto__ setter
    // for a group of that name.
    const groupCollapsed = { ...state.groupCollapsed, ...Object.fromEntries(groupNames.map(name => [name, collapsed])) };
    return { ...state, groupCollapsed };
}

/**
 * The dependency icon click: the same deliverable closes the graph; another one opens it, expands the groups
 * of the graph's nodes and resets the filter so every node is visible.
 * @template {CoreViewState} S
 * @param {S} state
 * @param {string} name deliverable whose graph is toggled
 * @param {string[]} groupsOfGraphNodes groups containing the graph's nodes
 * @returns {S}
 */
export function toggleDependencyGraph(state, name, groupsOfGraphNodes) {
    if (state.activeDependencyGraph === name) return closeDependencyGraph(state);
    const opened = setCollapsed({ ...state, activeDependencyGraph: name }, groupsOfGraphNodes, false);
    return { ...opened, filter: { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' } };
}

/**
 * @template {CoreViewState} S
 * @param {S} state
 * @returns {S}
 */
export function closeDependencyGraph(state) {
    return { ...state, activeDependencyGraph: null };
}
