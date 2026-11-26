/**
 * RoadmapSnap core: page, dashboard and filter-bar view models.
 * Every page-level decision Lite's renderers used to make lives here, so Lite (HTML strings) and the SaaS app
 * (React) are both mappers over the same models. Models carry plain strings, numbers, booleans and arrays:
 * never markup built from deliverable data. Pure: no DOM, no storage, no clock (today and theme are arguments).
 */

import { parseDDMMYYYY } from './dates.js';
import { generateMonths, generateVisibleMonthsForZoom, calculatePosition } from './timeline.js';
import {
    normalizeWorkflow, getNonFilterableGroups, isDeliverableNonFilterable,
} from './workflow.js';
import { getEffectiveAtRiskSet } from './dependencies.js';
import { filterBySearchOnly, hasSearchFilter } from './filters.js';
import { getVisibleDataSources, calculateStats, getUpcomingMilestones } from './stats.js';

/**
 * @typedef {{
 *   filter: import('./filters.js').FilterState,
 *   sort: import('./filters.js').SortState,
 *   zoom: string,
 *   showGantt: boolean,
 *   groupCollapsed: Record<string, boolean>,
 *   activeDependencyGraph: string | null,
 *   theme?: string
 * }} ViewState
 */

/**
 * @typedef {{
 *   config: import('./workflow.js').RoadmapConfig,
 *   state: ViewState,
 *   today: string,
 *   theme: string,
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   nonFilterableGroups: string[],
 *   months: ReturnType<typeof generateMonths>,
 *   todayPosition: number | null,
 *   visibleSources: import('./workflow.js').Deliverable[],
 *   effectiveAtRiskSet: Set<string>,
 *   hasSearchFilter: boolean,
 *   stats: Record<string, any>,
 *   upcoming: Record<string, any>,
 *   statsForDashboard: Record<string, any>
 * }} RoadmapModel
 */

/**
 * The months the timeline shows: the configured range for zoom 'all' (or no zoom), otherwise the current month
 * plus the next N months counted from today.
 * @param {{ zoom?: string, timeline: { START_MONTH?: string, END_MONTH?: string }, today: string }} args
 * @returns {ReturnType<typeof generateMonths>}
 */
export function selectMonths({ zoom, timeline, today }) {
    if (zoom === 'all' || !zoom) {
        return generateMonths(/** @type {string} */ (timeline.START_MONTH), /** @type {string} */ (timeline.END_MONTH));
    }
    return generateVisibleMonthsForZoom(/** @type {Date} */ (parseDDMMYYYY(today)), parseInt(zoom, 10));
}

/**
 * The page-level model: every derivation Lite's renderRoadmap made before rendering.
 * With an active search the KPI statistics are computed over the search matches only, so the status and risk
 * toggles do not change them. atRiskInView and descopedInView count the rows on screen, excluding rows of
 * non-filterable groups.
 * @param {{ config: import('./workflow.js').RoadmapConfig, state: ViewState, today: string, theme?: string }} args
 * @returns {RoadmapModel}
 */
export function buildRoadmapModel({ config, state, today, theme }) {
    const workflow = normalizeWorkflow(config);
    const nonFilterableGroups = getNonFilterableGroups(config);
    const deliverables = config.DELIVERABLES || [];
    const months = selectMonths({ zoom: state.zoom, timeline: config.TIMELINE, today });
    const todayPosition = calculatePosition(today, months);
    const visibleSources = getVisibleDataSources(deliverables, {
        filter: state.filter, sort: state.sort, workflow, today, nonFilterableGroups,
    });
    const effectiveAtRiskSet = getEffectiveAtRiskSet(deliverables, workflow, today);
    const searching = hasSearchFilter(state.filter);
    const stats = searching
        ? calculateStats(filterBySearchOnly(deliverables, state.filter.search), workflow, today, config)
        : calculateStats(deliverables, workflow, today, config);
    const upcoming = getUpcomingMilestones(deliverables, workflow, today, nonFilterableGroups);
    const inView = visibleSources.filter(s => !isDeliverableNonFilterable(nonFilterableGroups, s));
    const atRiskInView = inView.filter(s => effectiveAtRiskSet.has(s.name)).length;
    const descopedInView = inView.filter(s => s.descoped).length;
    const statsForDashboard = Object.assign({}, stats, { atRiskInView, descopedInView });
    return {
        config, state, today, theme: theme || 'light', workflow, nonFilterableGroups, months, todayPosition,
        visibleSources, effectiveAtRiskSet, hasSearchFilter: searching, stats, upcoming, statsForDashboard,
    };
}
