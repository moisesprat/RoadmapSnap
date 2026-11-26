/**
 * RoadmapSnap — grouping (Lite binding)
 * The pure grouping rules (groupDeliverables, hasAnyGroups, getGroupStats) live in packages/core/src/timelineModel.js
 * and are re-exported here. The handlers apply core view-state transitions to AppState.
 * Depends on AppState, CONFIG (window).
 */
import AppState from '../state/appState.js';
import { groupDeliverables, hasAnyGroups, getGroupStats } from '@roadmapsnap/core';

function toggleGroup(groupName) {
    const groupCollapsed = { ...AppState.get().groupCollapsed };
    groupCollapsed[groupName] = !groupCollapsed[groupName];
    AppState.set({ groupCollapsed });
}

function expandAllGroups() {
    const sources = CONFIG.DELIVERABLES;
    const groupCollapsed = { ...AppState.get().groupCollapsed };
    sources.forEach(source => {
        if (source.group) {
            groupCollapsed[source.group] = false;
        }
    });
    AppState.set({ groupCollapsed });
}

function collapseAllGroups() {
    const sources = CONFIG.DELIVERABLES;
    const groupCollapsed = { ...AppState.get().groupCollapsed };
    sources.forEach(source => {
        if (source.group) {
            groupCollapsed[source.group] = true;
        }
    });
    AppState.set({ groupCollapsed });
}

function expandGroupsForDependencyGraph(graphNodes) {
    const sources = CONFIG.DELIVERABLES;
    const groupCollapsed = { ...AppState.get().groupCollapsed };
    sources.forEach(source => {
        if (graphNodes.includes(source.name) && source.group) {
            groupCollapsed[source.group] = false;
        }
    });
    AppState.set({ groupCollapsed });
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
