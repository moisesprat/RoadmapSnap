/**
 * RoadmapSnap — workflow logic (Lite binding)
 * Binding over @roadmapsnap/core; reads CONFIG and window only to supply arguments.
 * The rules (states, milestones, status, non-filterable groups) live in packages/core/src/workflow.js.
 * In Node (tests), window/CONFIG/getTodayDate may be missing; pass workflow and todayStr where supported.
 */

import * as core from '@roadmapsnap/core';

function getTodayDateFallback() {
    return core.formatDDMMYYYY(new Date());
}

function resolveToday(todayStr) {
    if (todayStr) return todayStr;
    return typeof window !== 'undefined' && window.getTodayDate ? window.getTodayDate() : getTodayDateFallback();
}

function getWorkflow() {
    return core.normalizeWorkflow(CONFIG);
}

function getStates() {
    return core.getStates(getWorkflow());
}

function getMilestones() {
    return core.getMilestones(getWorkflow());
}

function getStateByKey(key) {
    return core.getStateByKey(getWorkflow(), key);
}

function getMilestoneByKey(key) {
    return core.getMilestoneByKey(getWorkflow(), key);
}

function getStateAfterMilestone(milestoneKey, workflowOverride) {
    return core.getStateAfterMilestone(workflowOverride || getWorkflow(), milestoneKey);
}

function getFirstState(workflowOverride) {
    return core.getFirstState(workflowOverride || getWorkflow());
}

function getLastState(workflowOverride) {
    return core.getLastState(workflowOverride || getWorkflow());
}

function getNonFilterableGroups() {
    return core.getNonFilterableGroups(CONFIG);
}

function isGroupNonFilterable(groupName) {
    return core.isGroupNonFilterable(getNonFilterableGroups(), groupName);
}

function isDeliverableNonFilterable(source) {
    return core.isDeliverableNonFilterable(getNonFilterableGroups(), source);
}

function getFilterableDeliverables() {
    return core.getFilterableDeliverables(CONFIG);
}

function getFirstMilestoneKey() {
    return core.getFirstMilestoneKey(getWorkflow());
}

function getLastMilestoneKey() {
    return core.getLastMilestoneKey(getWorkflow());
}

function getMilestoneDate(source, milestoneKey) {
    var firstKey;
    try {
        firstKey = getFirstMilestoneKey();
    } catch (e) {
        firstKey = 'START';
    }
    return core.getMilestoneDate(source, milestoneKey, firstKey);
}

function getNextMilestone(source, workflowOverride, todayStr) {
    return core.getNextMilestone(source, workflowOverride || getWorkflow(), resolveToday(todayStr));
}

function getCurrentStatus(source, workflowOverride, todayStr) {
    return core.getCurrentStatus(source, workflowOverride || getWorkflow(), resolveToday(todayStr));
}

// Export on window for global access (browser only)
if (typeof window !== 'undefined') {
    window.getWorkflow = getWorkflow;
    window.getStates = getStates;
    window.getMilestones = getMilestones;
    window.getStateByKey = getStateByKey;
    window.getMilestoneByKey = getMilestoneByKey;
    window.getStateAfterMilestone = getStateAfterMilestone;
    window.getFirstState = getFirstState;
    window.getLastState = getLastState;
    window.getFirstMilestoneKey = getFirstMilestoneKey;
    window.getLastMilestoneKey = getLastMilestoneKey;
    window.getCurrentStatus = getCurrentStatus;
    window.getNextMilestone = getNextMilestone;
    window.getMilestoneDate = getMilestoneDate;
    window.getNonFilterableGroups = getNonFilterableGroups;
    window.isGroupNonFilterable = isGroupNonFilterable;
    window.isDeliverableNonFilterable = isDeliverableNonFilterable;
    window.getFilterableDeliverables = getFilterableDeliverables;
}

export {
    getWorkflow, getStates, getMilestones, getStateByKey, getMilestoneByKey,
    getStateAfterMilestone, getFirstState, getLastState,
    getFirstMilestoneKey, getLastMilestoneKey,
    getCurrentStatus, getNextMilestone, getMilestoneDate,
    getNonFilterableGroups, isGroupNonFilterable, isDeliverableNonFilterable, getFilterableDeliverables
};
