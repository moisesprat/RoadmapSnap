/**
 * RoadmapSnap — dependency graph logic (Lite binding)
 * Binding over @roadmapsnap/core; reads CONFIG and the clock only to supply arguments.
 * The graph, color and red-set rules live in packages/core/src/dependencies.js.
 * In Node/tests pass deliverablesOverride; without CONFIG the red sets use the default START..M3 workflow.
 */

import * as core from '@roadmapsnap/core';
import { getWorkflow } from './workflow.js';

function getTodayDateLocal() {
    if (typeof CONFIG !== 'undefined' && CONFIG.TIMELINE && CONFIG.TIMELINE.TODAY) {
        return CONFIG.TIMELINE.TODAY;
    }
    return core.formatDDMMYYYY(new Date());
}

// Workflow for the red-dependency rules: the config's, or the default one when no CONFIG is loaded (tests).
function getWorkflowForDependencies() {
    return typeof CONFIG !== 'undefined' ? getWorkflow() : core.normalizeWorkflow({});
}

// Get all data sources (all deliverables, regardless of visibility)
// In Node/tests pass deliverablesOverride; in browser uses CONFIG.DELIVERABLES when absent.
function getAllDataSources(deliverablesOverride) {
    if (deliverablesOverride != null) return deliverablesOverride;
    if (typeof CONFIG !== 'undefined' && CONFIG.DELIVERABLES) return CONFIG.DELIVERABLES;
    return [];
}

// Normalize a dependency entry to object format
// Supports: string "TaskA" or object { task: "TaskA", from: "M3", to: "M2" }
function normalizeDependency(dep) {
    return core.normalizeDependency(dep);
}

// Get the task name from a dependency (handles both string and object formats)
function getDependencyTaskName(dep) {
    return core.getDependencyTaskName(dep);
}

// Get inbound dependencies (tasks this deliverable depends on / is blocked by)
// Returns array of normalized dependency objects
function getInboundDependencies(source) {
    return core.getInboundDependencies(source);
}

// Get inbound dependency task names only (for simple lookups)
function getInboundDependencyNames(source) {
    return core.getInboundDependencyNames(source);
}

// Get outbound dependencies (tasks that depend on this deliverable / are blocked by it)
// Returns array of { task, from, to } where task is the dependent task name
function getOutboundDependencies(source, deliverablesOverride) {
    return core.getOutboundDependencies(source, getAllDataSources(deliverablesOverride));
}

// Get outbound dependency task names only (for simple lookups)
function getOutboundDependencyNames(source) {
    return core.getOutboundDependencyNames(source, getAllDataSources());
}

// Check if a deliverable has any dependencies (inbound or outbound)
function hasDependencies(source) {
    return core.hasDependencies(source, getAllDataSources());
}

// Get dependency type for icon display
// Returns: 'inbound' | 'outbound' | 'both' | 'none'
function getDependencyType(source, deliverablesOverride) {
    return core.getDependencyType(source, getAllDataSources(deliverablesOverride));
}

// Get the full dependency graph for a deliverable (all connected nodes)
function getDependencyGraph(sourceName, deliverablesOverride) {
    return core.getDependencyGraph(sourceName, getAllDataSources(deliverablesOverride));
}

/**
 * Dependency color rule:
 * - green: dependency milestone reached (fromDate <= today)
 * - red: dependency behind schedule (fromDate > toDate)
 * - orange: non-finished and within 10 days to target (0..10)
 * - green: otherwise (>10 days buffer)
 */
function getDependencyColorForDates(fromDateInput, toDateInput, todayDateInput) {
    return core.getDependencyColorForDates(fromDateInput, toDateInput, todayDateInput);
}

/**
 * Returns deliverable names blocked by "red" dependencies:
 * a dependency edge is red when fromDate > toDate.
 */
function getBlockedByRedDependencySet(deliverablesOverride) {
    return core.getBlockedByRedDependencySet(getAllDataSources(deliverablesOverride), getWorkflowForDependencies(), getTodayDateLocal());
}

/** Returns both source+target deliverables that participate in red dependency edges. */
function getRedDependencyEndpointSet(deliverablesOverride) {
    return core.getRedDependencyEndpointSet(getAllDataSources(deliverablesOverride), getWorkflowForDependencies(), getTodayDateLocal());
}

/** Config atRisk OR blocked by red dependency. */
function getEffectiveAtRiskSet(deliverablesOverride) {
    return core.getEffectiveAtRiskSet(getAllDataSources(deliverablesOverride), getWorkflowForDependencies(), getTodayDateLocal());
}

// Export on window for global access (browser only)
if (typeof window !== 'undefined') {
    window.getAllDataSources = getAllDataSources;
    window.normalizeDependency = normalizeDependency;
    window.getDependencyTaskName = getDependencyTaskName;
    window.getInboundDependencies = getInboundDependencies;
    window.getInboundDependencyNames = getInboundDependencyNames;
    window.getOutboundDependencies = getOutboundDependencies;
    window.getOutboundDependencyNames = getOutboundDependencyNames;
    window.hasDependencies = hasDependencies;
    window.getDependencyType = getDependencyType;
    window.getDependencyGraph = getDependencyGraph;
    window.getDependencyColorForDates = getDependencyColorForDates;
    window.getBlockedByRedDependencySet = getBlockedByRedDependencySet;
    window.getRedDependencyEndpointSet = getRedDependencyEndpointSet;
    window.getEffectiveAtRiskSet = getEffectiveAtRiskSet;
}

export {
    getAllDataSources, normalizeDependency, getDependencyTaskName,
    getInboundDependencies, getInboundDependencyNames,
    getOutboundDependencies, getOutboundDependencyNames,
    hasDependencies, getDependencyType, getDependencyGraph,
    getDependencyColorForDates,
    getBlockedByRedDependencySet, getRedDependencyEndpointSet, getEffectiveAtRiskSet
};
