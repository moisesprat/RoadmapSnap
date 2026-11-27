/**
 * RoadmapSnap core: deliverable filtering, search and sorting.
 * Pure: no DOM, no storage, no clock. Every function takes the filter or sort state, the workflow, today and
 * the precomputed risk sets explicitly; Lite (js/ui/filterBar.js) and the SaaS app supply them.
 */

import { parseDDMMYYYY } from './dates.js';
import {
    getStates, getCurrentStatus, getMilestoneDate, getFirstMilestoneKey, getLastMilestoneKey,
    isDeliverableNonFilterable,
} from './workflow.js';

/**
 * @typedef {{ status: string, riskOnly: boolean, descopedOnly: boolean, search: string }} FilterState
 * `status` is a workflow state key or 'ALL'.
 */

/**
 * @typedef {{ by: string, order: string }} SortState
 * `by` is 'name', 'status', 'm3date' (the last milestone's date) or 'risk'; `order` is 'asc' or 'desc'.
 */

/**
 * Applies the status, risk, descoped and search filters. Rows of non-filterable groups are dropped as soon as a
 * status filter is active. Search is the untrimmed term, folded with toLowerCase over name and tags (no Unicode
 * normalization).
 * @param {import('./workflow.js').Deliverable[]} sources
 * @param {{
 *   filter: FilterState,
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   today: string,
 *   nonFilterableGroups: string[],
 *   effectiveAtRiskSet: Set<string>,
 *   redEndpointSet: Set<string>
 * }} ctx
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function filterDeliverables(sources, ctx) {
    const { filter, workflow, today, nonFilterableGroups, effectiveAtRiskSet, redEndpointSet } = ctx;
    return sources.filter(source => {
        if (filter.status !== 'ALL' && isDeliverableNonFilterable(nonFilterableGroups, source)) {
            return false;
        }
        if (filter.riskOnly && !effectiveAtRiskSet.has(source.name) && !redEndpointSet.has(source.name)) {
            return false;
        }
        if (filter.descopedOnly && !source.descoped) {
            return false;
        }
        if (filter.status !== 'ALL') {
            const status = getCurrentStatus(source, workflow, today);
            if (status !== filter.status) return false;
        }
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const nameMatch = source.name.toLowerCase().includes(searchLower);
            const tagsMatch = source.tags && source.tags.some(tag =>
                tag.toLowerCase().includes(searchLower)
            );
            if (!nameMatch && !tagsMatch) return false;
        }
        return true;
    });
}

/**
 * True when the filter carries a non-blank search term.
 * @param {Pick<FilterState, 'search'>} filter
 * @returns {boolean}
 */
export function hasSearchFilter(filter) {
    return Boolean(filter && filter.search && String(filter.search).trim());
}

/**
 * Filters by the search term only (trimmed), ignoring status, risk and descoped. Used for KPI statistics so
 * the status and risk toggles do not change them. Returns the input list itself when the term is blank.
 * @param {import('./workflow.js').Deliverable[]} sources
 * @param {string} search
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function filterBySearchOnly(sources, search) {
    if (!search || !String(search).trim()) return sources;
    const searchLower = String(search).trim().toLowerCase();
    return sources.filter(source => {
        const nameMatch = source.name && source.name.toLowerCase().includes(searchLower);
        const tagsMatch = source.tags && source.tags.some(tag =>
            tag && String(tag).toLowerCase().includes(searchLower)
        );
        return nameMatch || tagsMatch;
    });
}

/**
 * Sorts a copy of the list (the input is never mutated). The sort is stable: rows with equal keys keep their
 * input order. Rows without a last-milestone date sort as 31/12/9999.
 * @param {import('./workflow.js').Deliverable[]} sources
 * @param {{
 *   sort: SortState,
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   today: string,
 *   effectiveAtRiskSet: Set<string>
 * }} ctx
 * @returns {import('./workflow.js').Deliverable[]}
 */
export function sortDeliverables(sources, ctx) {
    const { sort, workflow, today, effectiveAtRiskSet } = ctx;
    const sorted = [...sources];
    const statusOrder = getStates(workflow).map(s => s.key);
    const firstKey = getFirstMilestoneKey(workflow);
    const lastKey = getLastMilestoneKey(workflow);
    const farFuture = () => new Date(9999, 11, 31);

    sorted.sort((a, b) => {
        let comparison = 0;
        switch (sort.by) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'status': {
                const statusA = statusOrder.indexOf(getCurrentStatus(a, workflow, today));
                const statusB = statusOrder.indexOf(getCurrentStatus(b, workflow, today));
                comparison = statusA - statusB;
                break;
            }
            case 'm3date': {
                const dateA = parseDDMMYYYY(getMilestoneDate(a, lastKey, firstKey)) || farFuture();
                const dateB = parseDDMMYYYY(getMilestoneDate(b, lastKey, firstKey)) || farFuture();
                comparison = dateA.getTime() - dateB.getTime();
                break;
            }
            case 'risk':
                comparison = (effectiveAtRiskSet.has(b.name) ? 1 : 0) - (effectiveAtRiskSet.has(a.name) ? 1 : 0);
                break;
        }
        return sort.order === 'desc' ? -comparison : comparison;
    });

    return sorted;
}
