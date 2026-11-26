/**
 * RoadmapSnap — grouping (Lite binding)
 * The pure grouping rules (groupDeliverables, hasAnyGroups, getGroupStats) live in packages/core/src/timelineModel.js
 * and are re-exported here. The handlers apply the core view-state transitions (viewState.js) to AppState.
 * Depends on AppState, CONFIG (window).
 */
import AppState from '../state/appState.js';
import {
    groupDeliverables, hasAnyGroups, getGroupStats, groupNamesOf, groupNamesForNodes,
    toggleGroup as coreToggleGroup, expandAllGroups as coreExpandAllGroups, collapseAllGroups as coreCollapseAllGroups
} from '@roadmapsnap/core';

function toggleGroup(groupName) {
    AppState.set(coreToggleGroup(AppState.get(), groupName));
}

function expandAllGroups() {
    AppState.set(coreExpandAllGroups(AppState.get(), groupNamesOf(CONFIG.DELIVERABLES)));
}

function collapseAllGroups() {
    AppState.set(coreCollapseAllGroups(AppState.get(), groupNamesOf(CONFIG.DELIVERABLES)));
}

function expandGroupsForDependencyGraph(graphNodes) {
    AppState.set(coreExpandAllGroups(AppState.get(), groupNamesForNodes(graphNodes, CONFIG.DELIVERABLES)));
}

// Export on window for global access
window.groupDeliverables = groupDeliverables;
window.hasAnyGroups = hasAnyGroups;
window.toggleGroup = toggleGroup;
window.expandAllGroups = expandAllGroups;
window.collapseAllGroups = collapseAllGroups;
window.getGroupStats = getGroupStats;
window.expandGroupsForDependencyGraph = expandGroupsForDependencyGraph;

export { hasAnyGroups, groupDeliverables, getGroupStats, expandAllGroups, collapseAllGroups, expandGroupsForDependencyGraph, toggleGroup };
