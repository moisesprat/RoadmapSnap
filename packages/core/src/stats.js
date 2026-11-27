/**
 * RoadmapSnap core: KPI statistics and upcoming milestones.
 * Pure: no DOM, no storage, no clock. Every function takes the deliverables, workflow and today explicitly.
 */

import { parseDDMMYYYY } from './dates.js';
import {
    getStates, getMilestones, getCurrentStatus, getMilestoneDate, getFirstMilestoneKey,
    getNonFilterableGroups, isGroupNonFilterable,
} from './workflow.js';
import { getEffectiveAtRiskSet, getRedDependencyEndpointSet } from './dependencies.js';
import { filterDeliverables, sortDeliverables } from './filters.js';

/**
 * Rows shown on the timeline: everything unless showInTimeline is exactly false.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function getAllVisibleDataSources(deliverables) {
    return deliverables.filter(source => source.showInTimeline !== false);
}

/**
 * Rows outside the non-filterable groups. Returns the list itself when there are no such groups.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {string[]} nonFilterableGroups
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function getFilterableDeliverablesFrom(deliverables, nonFilterableGroups) {
    if (!nonFilterableGroups.length) return deliverables;
    return deliverables.filter(source => !source.group || !nonFilterableGroups.includes(source.group));
}

/**
 * The timeline rows after the active filters and sort: visible rows, then filterDeliverables, then
 * sortDeliverables. The risk sets are computed over every deliverable given, not only the visible ones.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {{
 *   filter: import('./filters.js').FilterState,
 *   sort: import('./filters.js').SortState,
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   today: string,
 *   nonFilterableGroups: string[]
 * }} ctx
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function getVisibleDataSources(deliverables, ctx) {
    const { filter, sort, workflow, today, nonFilterableGroups } = ctx;
    const effectiveAtRiskSet = getEffectiveAtRiskSet(deliverables, workflow, today);
    const redEndpointSet = getRedDependencyEndpointSet(deliverables, workflow, today);
    let sources = getAllVisibleDataSources(deliverables);
    sources = filterDeliverables(sources, { filter, workflow, today, nonFilterableGroups, effectiveAtRiskSet, redEndpointSet });
    sources = sortDeliverables(sources, { sort, workflow, today, effectiveAtRiskSet });
    return sources;
}

/**
 * KPI statistics over all deliverables (not the filtered view). Rows of non-filterable groups are excluded
 * from every count and descoped rows from every count except `descoped`. The effective at-risk set uses the
 * given today.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @param {import('./workflow.js').RoadmapConfig | { NON_FILTERABLE_GROUPS?: string[] }} config
 * @returns {Record<string, any>}
 */
export function calculateStats(deliverables, workflow, today, config) {
    const allSources = getFilterableDeliverablesFrom(deliverables, getNonFilterableGroups(config || {}));
    const effectiveAtRiskSet = getEffectiveAtRiskSet(allSources, workflow, today);
    // KPIs exclude descoped items: only count non-descoped for totals, state counts and progress
    const kpiSources = allSources.filter(source => !source.descoped);
    const visibleSources = kpiSources.filter(source => source.showInTimeline !== false);

    const states = getStates(workflow);
    const lastState = states[states.length - 1] || { key: 'DONE', short: 'DONE', title: 'Done', description: '' };

    /** @type {Record<string, any>} */
    const stats = {
        total: kpiSources.length,
        visible: visibleSources.length,
        hidden: kpiSources.length - visibleSources.length,
        atRisk: 0,
        descoped: 0,
        visibleByStatus: {},
        hiddenByStatus: {},
        stateKeys: states.map(s => s.key)
    };

    states.forEach(s => {
        stats[s.key] = 0;
        stats.visibleByStatus[s.key] = 0;
        stats.hiddenByStatus[s.key] = 0;
    });

    // Descoped is counted from the full set (for the filter pill); every other count comes from kpiSources.
    allSources.forEach(source => {
        if (source.descoped) stats.descoped++;
    });

    kpiSources.forEach(source => {
        const status = getCurrentStatus(source, workflow, today);
        if (stats[status] !== undefined) {
            stats[status]++;
        }

        if (effectiveAtRiskSet.has(source.name)) stats.atRisk++;

        // Truthiness, not !== false: a row with showInTimeline undefined is counted in `visible` above but
        // filed under hiddenByStatus here (kept as Lite has it).
        if (source.showInTimeline) {
            if (stats.visibleByStatus[status] !== undefined) {
                stats.visibleByStatus[status]++;
            }
        } else {
            if (stats.hiddenByStatus[status] !== undefined) {
                stats.hiddenByStatus[status]++;
            }
        }
    });

    const lastStateKey = lastState.key;
    stats.completionPercentage = stats.total === 0 ? 0 : Math.round((stats[lastStateKey] / stats.total) * 100);

    if (states.length >= 2) {
        const secondLastState = states[states.length - 2];
        stats.productionReadyPercentage = stats.total === 0 ? 0 : Math.round(((stats[secondLastState.key] + stats[lastStateKey]) / stats.total) * 100);
    } else {
        stats.productionReadyPercentage = stats.completionPercentage;
    }

    return stats;
}

/**
 * For every milestone key, the nearest milestone date that is today or later across the visible rows
 * (null when none), with the row's effective at-risk flag. Rows of non-filterable groups are skipped.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @param {string[]} nonFilterableGroups
 * @returns {Record<string, { source: string, date: string, atRisk: boolean } | null>}
 */
export function getUpcomingMilestones(deliverables, workflow, today, nonFilterableGroups) {
    const todayDate = parseDDMMYYYY(today);
    const milestones = getMilestones(workflow);
    const firstKey = getFirstMilestoneKey(workflow);
    /** @type {Record<string, { source: string, date: string, atRisk: boolean } | null>} */
    const upcoming = {};
    const visibleSources = getAllVisibleDataSources(deliverables);
    const effectiveAtRiskSet = getEffectiveAtRiskSet(visibleSources, workflow, today);

    milestones.forEach(m => {
        /** @type {{ source: string, date: string, atRisk: boolean } | null} */
        let nearest = null;
        /** @type {Date | null} */
        let nearestDate = null;

        visibleSources.forEach(source => {
            const milestoneDate = getMilestoneDate(source, m.key, firstKey);
            const date = parseDDMMYYYY(milestoneDate);
            if (source.group && isGroupNonFilterable(nonFilterableGroups, source.group)) {
                return;
            }

            // @ts-ignore: a null today compares as 0 (every date qualifies), exactly as Lite always did
            if (date && milestoneDate && date >= todayDate) {
                if (!nearestDate || date < nearestDate) {
                    nearestDate = date;
                    nearest = { source: source.name, date: milestoneDate, atRisk: effectiveAtRiskSet.has(source.name) };
                }
            }
        });

        upcoming[m.key] = nearest;
    });

    return upcoming;
}
