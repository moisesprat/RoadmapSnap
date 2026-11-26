/**
 * RoadmapSnap core: workflow states, milestones and non-filterable group rules.
 * Pure: no DOM, no storage, no clock. Every function takes the workflow, the deliverables or today
 * explicitly; Lite (js/core/workflow.js) and the SaaS app supply those arguments from their own sources.
 */

import { parseDDMMYYYY } from './dates.js';

/**
 * @typedef {{ type: 'state' | 'milestone', key: string, short: string, title: string, description?: string, subtitle?: string }} WorkflowItem
 */

/**
 * A dependency entry: a bare task name, or an object naming the milestones the edge connects.
 * @typedef {string | { task: string, from?: string | null, to?: string | null }} Dependency
 */

/**
 * @typedef {{
 *   name: string,
 *   atRisk?: boolean,
 *   descoped?: boolean,
 *   showInTimeline?: boolean,
 *   group?: string,
 *   tags?: string[],
 *   link?: string,
 *   milestones?: Record<string, string>,
 *   dependencies?: Dependency[],
 *   startDate?: string
 * }} Deliverable
 */

/**
 * @typedef {{
 *   TIMELINE: { TODAY?: string, START_MONTH?: string, END_MONTH?: string },
 *   WORKFLOW?: WorkflowItem[],
 *   MILESTONES?: { key: string, short: string, title: string, subtitle?: string }[],
 *   DELIVERABLES: Deliverable[],
 *   ENTITY_LABELS?: Record<string, string>,
 *   DASHBOARD_TEXT?: Record<string, string>,
 *   GROUP_ORDER?: string[],
 *   NON_FILTERABLE_GROUPS?: string[],
 *   VERSION?: string,
 *   BUILD_DATE?: string
 * }} RoadmapConfig
 */

/**
 * Returns the workflow of a config: its WORKFLOW array when present, otherwise a synthetic workflow built
 * from the legacy MILESTONES list (or the default M0..M3 milestones).
 * @param {Pick<RoadmapConfig, 'WORKFLOW' | 'MILESTONES'>} config
 * @returns {WorkflowItem[]}
 */
export function normalizeWorkflow(config) {
    if (config.WORKFLOW && Array.isArray(config.WORKFLOW)) {
        return config.WORKFLOW;
    }
    const legacyMilestones = config.MILESTONES || [
        { key: 'M0', short: 'M0', title: 'Dev Complete', subtitle: '' },
        { key: 'M1', short: 'M1', title: 'Deployed', subtitle: '' },
        { key: 'M2', short: 'M2', title: 'Ready', subtitle: '' },
        { key: 'M3', short: 'M3', title: 'Complete', subtitle: '' }
    ];
    /** @type {WorkflowItem[]} */
    const workflow = [
        { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: 'Pending kickoff' },
        { type: 'milestone', key: 'START', short: 'START', title: 'Start', subtitle: 'Kickoff' },
        { type: 'state', key: 'DEV', short: 'DEV', title: 'In Development', description: 'Active development' }
    ];
    legacyMilestones.forEach((m, index) => {
        workflow.push({ type: 'milestone', key: m.key, short: m.short, title: m.title, subtitle: m.subtitle });
        if (index < legacyMilestones.length - 1) {
            workflow.push({ type: 'state', key: `S${index + 1}`, short: `S${index + 1}`, title: `Phase ${index + 2}`, description: '' });
        } else {
            workflow.push({ type: 'state', key: 'DONE', short: 'DONE', title: 'Done', description: 'Complete' });
        }
    });
    return workflow;
}

/**
 * @param {WorkflowItem[]} workflow
 * @returns {WorkflowItem[]}
 */
export function getStates(workflow) {
    return workflow.filter(item => item.type === 'state');
}

/**
 * @param {WorkflowItem[]} workflow
 * @returns {WorkflowItem[]}
 */
export function getMilestones(workflow) {
    return workflow.filter(item => item.type === 'milestone');
}

/**
 * @param {WorkflowItem[]} workflow
 * @param {string} key
 * @returns {WorkflowItem | null}
 */
export function getStateByKey(workflow, key) {
    return getStates(workflow).find(s => s.key === key) || null;
}

/**
 * @param {WorkflowItem[]} workflow
 * @param {string} key
 * @returns {WorkflowItem | null}
 */
export function getMilestoneByKey(workflow, key) {
    return getMilestones(workflow).find(m => m.key === key) || null;
}

/**
 * The first state that follows a milestone in workflow order, or null when the milestone is unknown or last.
 * @param {WorkflowItem[]} workflow
 * @param {string} milestoneKey
 * @returns {WorkflowItem | null}
 */
export function getStateAfterMilestone(workflow, milestoneKey) {
    const milestoneIndex = workflow.findIndex(item => item.type === 'milestone' && item.key === milestoneKey);
    if (milestoneIndex === -1) return null;
    for (let i = milestoneIndex + 1; i < workflow.length; i++) {
        if (workflow[i].type === 'state') {
            return workflow[i];
        }
    }
    return null;
}

/**
 * @param {WorkflowItem[]} workflow
 * @returns {WorkflowItem}
 */
export function getFirstState(workflow) {
    const states = getStates(workflow);
    return states[0] || { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: '' };
}

/**
 * @param {WorkflowItem[]} workflow
 * @returns {WorkflowItem}
 */
export function getLastState(workflow) {
    const states = getStates(workflow);
    return states[states.length - 1] || { type: 'state', key: 'DONE', short: 'DONE', title: 'Done', description: '' };
}

/**
 * Key of the first milestone, 'START' when the workflow has none.
 * @param {WorkflowItem[]} workflow
 * @returns {string}
 */
export function getFirstMilestoneKey(workflow) {
    const milestones = getMilestones(workflow);
    return milestones[0]?.key || 'START';
}

/**
 * Key of the last milestone, 'M4' when the workflow has none.
 * @param {WorkflowItem[]} workflow
 * @returns {string}
 */
export function getLastMilestoneKey(workflow) {
    const milestones = getMilestones(workflow);
    return milestones[milestones.length - 1]?.key || 'M4';
}

/**
 * @param {Pick<RoadmapConfig, 'NON_FILTERABLE_GROUPS'>} config
 * @returns {string[]}
 */
export function getNonFilterableGroups(config) {
    return Array.isArray(config.NON_FILTERABLE_GROUPS) ? config.NON_FILTERABLE_GROUPS : [];
}

/**
 * @param {string[]} nonFilterableGroups
 * @param {string} groupName
 * @returns {boolean}
 */
export function isGroupNonFilterable(nonFilterableGroups, groupName) {
    return nonFilterableGroups.includes(groupName);
}

/**
 * True when the deliverable belongs to a group that status filters never apply to.
 * @param {string[]} nonFilterableGroups
 * @param {Pick<Deliverable, 'group'>} source
 * @returns {boolean}
 */
export function isDeliverableNonFilterable(nonFilterableGroups, source) {
    return Boolean(source.group) && isGroupNonFilterable(nonFilterableGroups, /** @type {string} */ (source.group));
}

/**
 * @param {Pick<RoadmapConfig, 'DELIVERABLES' | 'NON_FILTERABLE_GROUPS'>} config
 * @returns {Deliverable[]}
 */
export function getFilterableDeliverables(config) {
    const groups = getNonFilterableGroups(config);
    return config.DELIVERABLES.filter(source => !isDeliverableNonFilterable(groups, source));
}

/**
 * The date (DD/MM/YYYY) a deliverable reaches a milestone. Order: its own entry for the key; for the first
 * milestone key only, the START alias, then startDate. Null when none applies.
 * @param {Pick<Deliverable, 'milestones' | 'startDate'>} source
 * @param {string} key
 * @param {string} firstKey key of the workflow's first milestone
 * @returns {string | null}
 */
export function getMilestoneDate(source, key, firstKey) {
    if (source.milestones && source.milestones[key]) {
        return source.milestones[key];
    }
    if (key === firstKey && source.milestones && source.milestones.START) {
        return source.milestones.START;
    }
    if (key === firstKey && source.startDate) {
        return source.startDate;
    }
    return null;
}

/**
 * The first milestone whose date is after today, or null when none is.
 * @param {Pick<Deliverable, 'milestones' | 'startDate'>} source
 * @param {WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @returns {WorkflowItem | null}
 */
export function getNextMilestone(source, workflow, today) {
    const todayDate = parseDDMMYYYY(today);
    const firstKey = getFirstMilestoneKey(workflow);
    for (const milestone of getMilestones(workflow)) {
        const milestoneDate = parseDDMMYYYY(getMilestoneDate(source, milestone.key, firstKey));
        if (todayDate && milestoneDate && todayDate < milestoneDate) {
            return milestone;
        }
    }
    return null;
}

/**
 * The key of the state a deliverable is in on a given day: the state after the latest milestone whose date
 * is today or earlier, the first state when none has been reached.
 * @param {Pick<Deliverable, 'milestones' | 'startDate'>} source
 * @param {WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @returns {string}
 */
export function getCurrentStatus(source, workflow, today) {
    const todayDate = parseDDMMYYYY(today);
    const milestones = getMilestones(workflow);
    const firstKey = getFirstMilestoneKey(workflow);
    for (let i = milestones.length - 1; i >= 0; i--) {
        const milestone = milestones[i];
        const milestoneDate = parseDDMMYYYY(getMilestoneDate(source, milestone.key, firstKey));
        if (todayDate && milestoneDate && todayDate >= milestoneDate) {
            const nextState = getStateAfterMilestone(workflow, milestone.key);
            return nextState ? nextState.key : getLastState(workflow).key;
        }
    }
    return getFirstState(workflow).key;
}
