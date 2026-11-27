/**
 * RoadmapSnap — statistics calculation
 * Binding over @roadmapsnap/core: the statistics, upcoming-milestone and visible-source rules live in
 * packages/core/src/{stats,filters}.js. This file reads CONFIG, window.AppState and the clock only to supply arguments.
 * calculateStats accepts (deliverables, workflow, todayStr, config?) for testability.
 */
import * as core from '@roadmapsnap/core';
import { getWorkflow, getNonFilterableGroups } from './workflow.js';

function hasConfig() {
    return typeof CONFIG !== 'undefined';
}

// Workflow for the statistics: the config's, or the default one when no CONFIG is loaded (tests).
function resolveWorkflow(workflowOverride) {
    if (workflowOverride != null) return workflowOverride;
    return hasConfig() ? getWorkflow() : core.normalizeWorkflow({});
}

// Today for the statistics: the override, CONFIG.TIMELINE.TODAY, or the clock. Not imported from timeline.js,
// which attaches to window unguarded and would not load in Node.
function resolveToday(todayStrOverride) {
    if (todayStrOverride != null) return todayStrOverride;
    if (hasConfig() && CONFIG.TIMELINE && CONFIG.TIMELINE.TODAY) return CONFIG.TIMELINE.TODAY;
    return core.formatDDMMYYYY(new Date());
}

function getDeliverables() {
    return hasConfig() && CONFIG.DELIVERABLES ? CONFIG.DELIVERABLES : [];
}

// Get visible data sources (with filters applied)
function getVisibleDataSources() {
    // AppState is read from window (set by js/state/appState.js) so this module loads in Node without localStorage.
    const state = window.AppState.get();
    return core.getVisibleDataSources(getDeliverables(), {
        filter: state.filter,
        sort: state.sort,
        workflow: resolveWorkflow(),
        today: resolveToday(),
        nonFilterableGroups: getNonFilterableGroups()
    });
}

// Get all visible sources (without filters, for stats)
function getAllVisibleDataSources() {
    return core.getAllVisibleDataSources(getDeliverables());
}

// Calculate Statistics (uses all deliverables, not filtered)
// Params: deliverables?, workflow?, todayStr?, config? — default to CONFIG.DELIVERABLES, CONFIG.WORKFLOW, CONFIG today, CONFIG.
function calculateStats(deliverablesOverride, workflowOverride, todayStrOverride, configOverride) {
    const deliverables = deliverablesOverride ?? getDeliverables();
    const config = configOverride ?? (hasConfig() ? CONFIG : {});
    return core.calculateStats(deliverables, resolveWorkflow(workflowOverride), resolveToday(todayStrOverride), config);
}

// Find upcoming milestones (dynamic)
function getUpcomingMilestones() {
    return core.getUpcomingMilestones(getDeliverables(), resolveWorkflow(), resolveToday(), getNonFilterableGroups());
}

// Export on window for global access (browser only)
if (typeof window !== 'undefined') {
    window.calculateStats = calculateStats;
    window.getUpcomingMilestones = getUpcomingMilestones;
    window.getVisibleDataSources = getVisibleDataSources;
    window.getAllVisibleDataSources = getAllVisibleDataSources;
}

export {
    calculateStats, getUpcomingMilestones, getVisibleDataSources, getAllVisibleDataSources
};
