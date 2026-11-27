/**
 * RoadmapSnap core: page, dashboard and filter-bar view models.
 * Every page-level decision Lite's renderers used to make lives here, so Lite (HTML strings) and the SaaS app
 * (React) are both mappers over the same models. Models carry plain strings, numbers, booleans and arrays:
 * never markup built from deliverable data. Pure: no DOM, no storage, no clock (today and theme are arguments).
 */

import { parseDDMMYYYY, formatShortDate } from './dates.js';
import { generateMonths, generateVisibleMonthsForZoom, calculatePosition } from './timeline.js';
import {
    normalizeWorkflow, getNonFilterableGroups, isDeliverableNonFilterable, getStates, getMilestones,
    getLastMilestoneKey,
} from './workflow.js';
import { getEffectiveAtRiskSet } from './dependencies.js';
import { filterBySearchOnly, hasSearchFilter } from './filters.js';
import { getVisibleDataSources, getAllVisibleDataSources, calculateStats, getUpcomingMilestones } from './stats.js';
import { THEMES, THEME_LABELS } from './themes.js';
import { buildTimelineModel } from './timelineModel.js';

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
 *   statsForDashboard: Record<string, any>,
 *   timeline: import('./timelineModel.js').TimelineModel
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
 * The page-level model: every derivation Lite's renderRoadmap made before rendering, plus the timeline grid
 * model (`timeline`, see timelineModel.js).
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
    const model = {
        config, state, today, theme: theme || 'light', workflow, nonFilterableGroups, months, todayPosition,
        visibleSources, effectiveAtRiskSet, hasSearchFilter: searching, stats, upcoming, statsForDashboard,
    };
    return { ...model, timeline: buildTimelineModel(model) };
}

/**
 * @typedef {{
 *   key: string, title: string, description: string, count: number, stateIndex: number, stateClass: string,
 *   breakdownText: string, clickable: boolean, active: boolean
 * }} DashboardKpiCard
 * @typedef {{
 *   key: string, short: string, title: string, subtitle: string, slot: string, nextName: string | null,
 *   nextDate: string, atRisk: boolean, completeText: string
 * }} DashboardMilestoneCard
 * @typedef {{
 *   title: string, entityPlural: string, scopeLabel: string, totalSubtitleSuffix: string,
 *   total: number, visible: number, todayLabel: string,
 *   riskSummary: { count: number, active: boolean, disabled: boolean } | null,
 *   descopedSummary: { count: number, active: boolean } | null,
 *   totalCard: { value: number, label: string, sublabel: string, breakdownText: string },
 *   kpiColumns: number,
 *   kpiCards: DashboardKpiCard[],
 *   progress: {
 *     title: string,
 *     segments: { key: string, stateIndex: number, stateClass: string, count: number, label: string, widthPct: number, opacity: string }[]
 *   },
 *   legend: { key: string, stateClass: string, short: string, title: string, label: string }[],
 *   milestoneColumns: number,
 *   milestoneCards: DashboardMilestoneCard[]
 * }} DashboardModel
 */

/**
 * "{visible} shown + {hidden} hidden" for a status, only when some rows of it are hidden from the timeline.
 * @param {Record<string, any>} stats
 * @param {string} status
 * @returns {string}
 */
function breakdownFor(stats, status) {
    const visible = stats.visibleByStatus && stats.visibleByStatus[status];
    const hidden = stats.hiddenByStatus && stats.hiddenByStatus[status];
    return hidden > 0 ? `${visible || 0} shown + ${hidden} hidden` : '';
}

/**
 * The dashboard model: titles and labels with Lite's fallbacks ('Items', 'Roadmap Dashboard', 'in scope'),
 * the Today text, risk and descoped summaries, KPI cards, progress segments, legend and milestone cards.
 * Plain data only; the renderers own the markup and its escaping.
 * @param {RoadmapModel} roadmapModel
 * @returns {DashboardModel}
 */
export function buildDashboardModel(roadmapModel) {
    const { config, state, today, workflow, upcoming, statsForDashboard: stats } = roadmapModel;
    const states = getStates(workflow);
    const milestones = getMilestones(workflow);
    const labels = config.ENTITY_LABELS;
    const text = config.DASHBOARD_TEXT;
    const entityPlural = (labels && labels.plural) ? labels.plural : 'Items';
    const scopeLabel = (labels && labels.scopeLabel) ? labels.scopeLabel : entityPlural.toLowerCase();
    const title = (text && text.title) ? text.title : 'Roadmap Dashboard';
    const totalSubtitleSuffix = (text && text.totalSubtitleSuffix) ? text.totalSubtitleSuffix : 'in scope';

    const atRiskInView = stats.atRiskInView != null ? stats.atRiskInView : stats.atRisk;
    /** @type {DashboardModel['riskSummary']} */
    let riskSummary = null;
    if (atRiskInView > 0) {
        riskSummary = { count: atRiskInView, active: Boolean(state.filter.riskOnly), disabled: false };
    } else if (stats.atRisk > 0) {
        riskSummary = { count: 0, active: false, disabled: true };
    }
    const descopedInView = stats.descopedInView != null ? stats.descopedInView : (stats.descoped || 0);
    const descopedSummary = descopedInView > 0
        ? { count: descopedInView, active: Boolean(state.filter.descopedOnly) }
        : null;

    const filtering = Boolean(state.filter.status) && state.filter.status !== 'ALL';
    const kpiCards = states.map((s, i) => {
        const stateIndex = Math.min(i, 7);
        return {
            key: s.key,
            title: s.title,
            description: s.description || '',
            count: stats[s.key] != null ? stats[s.key] : 0,
            stateIndex,
            stateClass: 'state-' + stateIndex,
            breakdownText: breakdownFor(stats, s.key),
            clickable: true,
            active: state.filter.status === s.key,
        };
    });
    const segments = states.map((s, i) => {
        const count = stats[s.key] != null ? stats[s.key] : 0;
        const stateIndex = Math.min(i, 7);
        return {
            key: s.key,
            stateIndex,
            stateClass: 'state-' + stateIndex,
            count,
            label: count > 0 ? String(count) : '',
            widthPct: stats.total > 0 ? (count / stats.total) * 100 : 0,
            opacity: filtering ? (state.filter.status === s.key ? '1' : '0.3') : '1',
        };
    });
    const legend = states.map((s, i) => ({
        key: s.key,
        stateClass: 'state-' + Math.min(i, 7),
        short: s.short,
        title: s.title,
        label: `${s.short} ${s.title}`,
    }));
    const milestoneCards = milestones.map((m, idx) => {
        const next = upcoming && upcoming[m.key];
        return {
            key: m.key,
            short: m.short,
            title: m.title,
            subtitle: m.subtitle || '',
            slot: idx === 0 ? 'start' : 'm' + Math.min(idx - 1, 5),
            nextName: next ? next.source : null,
            nextDate: next ? formatShortDate(next.date) : '',
            atRisk: Boolean(next && next.atRisk),
            completeText: 'All ' + (m.title ? m.title.toLowerCase() : m.key.toLowerCase()) + ' complete',
        };
    });

    return {
        title,
        entityPlural,
        scopeLabel,
        totalSubtitleSuffix,
        total: stats.total,
        visible: stats.visible,
        todayLabel: formatShortDate(today),
        riskSummary,
        descopedSummary,
        totalCard: {
            value: stats.total,
            label: 'Total ' + entityPlural,
            sublabel: totalSubtitleSuffix,
            breakdownText: stats.hidden > 0 ? `${stats.visible} shown + ${stats.hidden} hidden` : '',
        },
        kpiColumns: 1 + states.length,
        kpiCards,
        progress: { title: `Overall Progress (All ${stats.total} ${entityPlural})`, segments },
        legend,
        milestoneColumns: milestones.length,
        milestoneCards,
    };
}

/**
 * @typedef {{
 *   filteredCount: number, totalVisible: number, scopeLabel: string, hasGroups: boolean, hasActiveFilters: boolean,
 *   searchValue: string,
 *   sortByOptions: { value: string, label: string, selected: boolean }[],
 *   sortOrderOptions: { value: string, label: string, selected: boolean }[],
 *   zoomOptions: { zoom: string, months: number | string, label: string, active: boolean }[],
 *   themeOptions: { value: string, label: string, selected: boolean }[]
 * }} FilterBarModel
 */

/**
 * The filter-bar model: result counts over filterable rows, scope label (fallback 'items'), whether groups and
 * active filters exist, and the sort, zoom and theme options with the current choice flagged. The search
 * value is the raw text; the renderer escapes it.
 * @param {RoadmapModel} roadmapModel
 * @returns {FilterBarModel}
 */
export function buildFilterBarModel(roadmapModel) {
    const { config, state, workflow, nonFilterableGroups, visibleSources } = roadmapModel;
    const filterable = (/** @type {import('./workflow.js').Deliverable} */ s) => !isDeliverableNonFilterable(nonFilterableGroups, s);
    const labels = config.ENTITY_LABELS;
    const { filter, sort } = state;
    const theme = state.theme || roadmapModel.theme;
    const lastMilestoneKey = getLastMilestoneKey(workflow);
    /** @type {FilterBarModel['zoomOptions']} */
    const zoomOptions = [
        { zoom: '3mo', months: 3, label: '3mo' },
        { zoom: '6mo', months: 6, label: '6mo' },
        { zoom: '12mo', months: 12, label: '12mo' },
        { zoom: 'all', months: 'all', label: 'All' },
    ].map(o => ({ ...o, active: state.zoom === o.zoom }));
    return {
        filteredCount: visibleSources.filter(filterable).length,
        totalVisible: getAllVisibleDataSources(config.DELIVERABLES || []).filter(filterable).length,
        scopeLabel: (labels && labels.scopeLabel) ? labels.scopeLabel : 'items',
        hasGroups: visibleSources.some(s => s.group),
        hasActiveFilters: Boolean(filter.status !== 'ALL' || filter.riskOnly || filter.descopedOnly || filter.search),
        searchValue: filter.search,
        sortByOptions: [
            { value: 'name', label: 'Name' },
            { value: 'status', label: 'Status' },
            { value: 'm3date', label: `${lastMilestoneKey} Date` },
            { value: 'risk', label: 'Risk' },
        ].map(o => ({ ...o, selected: sort.by === o.value })),
        sortOrderOptions: [
            { value: 'asc', label: 'Asc' },
            { value: 'desc', label: 'Desc' },
        ].map(o => ({ ...o, selected: sort.order === o.value })),
        zoomOptions,
        themeOptions: THEMES.map(value => ({ value, label: THEME_LABELS[value], selected: theme === value })),
    };
}
