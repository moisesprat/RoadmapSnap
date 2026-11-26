/**
 * RoadmapSnap core: dependency graph, colors, blocked and at-risk analysis.
 * Pure: no DOM, no storage, no clock. Every function takes the deliverables, and where milestone keys or
 * dates matter the workflow and today, explicitly.
 */

import { parseDDMMYYYY } from './dates.js';
import { getFirstMilestoneKey, getLastMilestoneKey, getMilestoneDate } from './workflow.js';

/**
 * A dependency in object form. `from` is the milestone of the blocking task (null: its last milestone),
 * `to` the milestone of the blocked task (null: its first milestone).
 * @typedef {{ task: string, from: string | null, to: string | null }} NormalizedDependency
 */

/**
 * An edge of a dependency graph. `fromMilestone` and `toMilestone` stay null when the config named none.
 * @typedef {{ from: string, to: string, fromMilestone: string | null, toMilestone: string | null }} DependencyEdge
 */

/**
 * Normalizes a dependency entry to object form. Accepts "TaskA" or { task, from, to }.
 * @param {import('./workflow.js').Dependency} dep
 * @returns {NormalizedDependency}
 */
export function normalizeDependency(dep) {
    if (typeof dep === 'string') {
        return { task: dep, from: null, to: null };
    }
    return {
        task: dep.task,
        from: dep.from || null,
        to: dep.to || null
    };
}

/**
 * The task name of a dependency entry (string or object form).
 * @param {import('./workflow.js').Dependency} dep
 * @returns {string}
 */
export function getDependencyTaskName(dep) {
    return typeof dep === 'string' ? dep : dep.task;
}

/**
 * Tasks this deliverable depends on (is blocked by), as normalized objects.
 * @param {Pick<import('./workflow.js').Deliverable, 'dependencies'>} source
 * @returns {NormalizedDependency[]}
 */
export function getInboundDependencies(source) {
    const deps = source.dependencies || [];
    return deps.map(normalizeDependency);
}

/**
 * Task names this deliverable depends on.
 * @param {Pick<import('./workflow.js').Deliverable, 'dependencies'>} source
 * @returns {string[]}
 */
export function getInboundDependencyNames(source) {
    const deps = source.dependencies || [];
    return deps.map(getDependencyTaskName);
}

/**
 * Tasks that depend on this deliverable (are blocked by it). `task` is the dependent's name; `from` and
 * `to` are the milestone keys of the edge.
 * @param {Pick<import('./workflow.js').Deliverable, 'name'>} source
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {NormalizedDependency[]}
 */
export function getOutboundDependencies(source, deliverables) {
    /** @type {NormalizedDependency[]} */
    const dependents = [];
    deliverables.forEach(s => {
        if (s.dependencies) {
            s.dependencies.forEach(dep => {
                if (getDependencyTaskName(dep) === source.name) {
                    const normalized = normalizeDependency(dep);
                    dependents.push({ task: s.name, from: normalized.from, to: normalized.to });
                }
            });
        }
    });
    return dependents;
}

/**
 * Names of the deliverables that depend on this one.
 * @param {Pick<import('./workflow.js').Deliverable, 'name'>} source
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {string[]}
 */
export function getOutboundDependencyNames(source, deliverables) {
    return getOutboundDependencies(source, deliverables).map(d => d.task);
}

/**
 * True when the deliverable has any dependency, inbound or outbound.
 * @param {import('./workflow.js').Deliverable} source
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {boolean}
 */
export function hasDependencies(source, deliverables) {
    return getInboundDependencies(source).length > 0 || getOutboundDependencies(source, deliverables).length > 0;
}

/**
 * Dependency type for the icon: 'inbound', 'outbound', 'both' or 'none'.
 * @param {import('./workflow.js').Deliverable} source
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {'inbound' | 'outbound' | 'both' | 'none'}
 */
export function getDependencyType(source, deliverables) {
    const inbound = getInboundDependencies(source);
    const outbound = getOutboundDependencies(source, deliverables);
    if (inbound.length > 0 && outbound.length > 0) return 'both';
    if (inbound.length > 0) return 'inbound';
    if (outbound.length > 0) return 'outbound';
    return 'none';
}

/**
 * The full dependency graph around a deliverable: every node reachable through inbound and outbound
 * dependencies of the passed deliverables. Nodes is an array; edges keep null milestone keys.
 * @param {string} sourceName
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {{ nodes: string[], inboundEdges: DependencyEdge[], outboundEdges: DependencyEdge[] }}
 */
export function getDependencyGraph(sourceName, deliverables) {
    const sourceMap = new Map(deliverables.map(s => [s.name, s]));
    const graph = new Set([sourceName]);
    /** @type {DependencyEdge[]} */
    const inboundEdges = [];
    /** @type {DependencyEdge[]} */
    const outboundEdges = [];

    if (!sourceMap.get(sourceName)) return { nodes: [], inboundEdges: [], outboundEdges: [] };

    // Tasks this depends on, and what they depend on in turn
    /** @type {Set<string>} */
    const visitedInbound = new Set();
    /** @param {string} currentName */
    function traverseInbound(currentName) {
        if (visitedInbound.has(currentName)) return;
        visitedInbound.add(currentName);
        const current = sourceMap.get(currentName);
        if (!current) return;
        getInboundDependencies(current).forEach(dep => {
            graph.add(dep.task);
            inboundEdges.push({ from: dep.task, to: currentName, fromMilestone: dep.from, toMilestone: dep.to });
            traverseInbound(dep.task);
        });
    }
    traverseInbound(sourceName);

    // Tasks that depend on this, and what they block in turn
    /** @type {Set<string>} */
    const visitedOutbound = new Set();
    /** @param {string} currentName */
    function traverseOutbound(currentName) {
        if (visitedOutbound.has(currentName)) return;
        visitedOutbound.add(currentName);
        const current = sourceMap.get(currentName);
        if (!current) return;
        getOutboundDependencies(current, deliverables).forEach(dep => {
            graph.add(dep.task);
            outboundEdges.push({ from: currentName, to: dep.task, fromMilestone: dep.from, toMilestone: dep.to });
            traverseOutbound(dep.task);
        });
    }
    traverseOutbound(sourceName);

    return { nodes: Array.from(graph), inboundEdges, outboundEdges };
}

/**
 * Dependency color rule:
 * - green: the from-milestone is reached (fromDate <= today)
 * - red: behind schedule (fromDate > toDate)
 * - orange: unfinished and 0..10 days before the target
 * - green: otherwise (more than 10 days of buffer)
 * Dates are DD/MM/YYYY strings or Dates; a missing or malformed from or to date is green.
 * @param {string | Date | null | undefined} fromDateInput
 * @param {string | Date | null | undefined} toDateInput
 * @param {string | Date | null | undefined} todayDateInput
 * @returns {'red' | 'orange' | 'green'}
 */
export function getDependencyColorForDates(fromDateInput, toDateInput, todayDateInput) {
    const fromDate = fromDateInput instanceof Date ? fromDateInput : parseDDMMYYYY(fromDateInput);
    const toDate = toDateInput instanceof Date ? toDateInput : parseDDMMYYYY(toDateInput);
    const todayDate = todayDateInput instanceof Date ? todayDateInput : parseDDMMYYYY(todayDateInput);
    if (!fromDate || !toDate) return 'green';

    const fromTs = fromDate.getTime();
    const toTs = toDate.getTime();
    const todayTs = todayDate ? todayDate.getTime() : Number.NaN;

    if (!Number.isNaN(todayTs) && fromTs <= todayTs) return 'green';
    if (fromTs > toTs) return 'red';

    const diffDays = Math.floor((toTs - fromTs) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 10) return 'orange';
    return 'green';
}

/**
 * Calls visit(blocker, dependent) for every dependency edge whose color is red. The default from-key is the
 * workflow's last milestone, the default to-key its first (resolved OQ1); dates come from getMilestoneDate.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @param {(fromSource: import('./workflow.js').Deliverable, targetSource: import('./workflow.js').Deliverable) => void} visit
 */
function forEachRedEdge(deliverables, workflow, today, visit) {
    const sourceMap = new Map(deliverables.map(s => [s.name, s]));
    const firstKey = getFirstMilestoneKey(workflow);
    const lastKey = getLastMilestoneKey(workflow);
    deliverables.forEach(targetSource => {
        getInboundDependencies(targetSource).forEach(dep => {
            const fromSource = sourceMap.get(dep.task);
            if (!fromSource) return;
            const fromDateStr = getMilestoneDate(fromSource, dep.from || lastKey, firstKey);
            const toDateStr = getMilestoneDate(targetSource, dep.to || firstKey, firstKey);
            if (getDependencyColorForDates(fromDateStr, toDateStr, today) === 'red') {
                visit(fromSource, targetSource);
            }
        });
    });
}

/**
 * Names of the deliverables blocked by a red dependency edge (the blocker's date is after the dependent's
 * and not yet reached).
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @returns {Set<string>}
 */
export function getBlockedByRedDependencySet(deliverables, workflow, today) {
    /** @type {Set<string>} */
    const blocked = new Set();
    forEachRedEdge(deliverables, workflow, today, (_from, target) => {
        blocked.add(target.name);
    });
    return blocked;
}

/**
 * Names of both the blocker and the dependent of every red dependency edge.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @returns {Set<string>}
 */
export function getRedDependencyEndpointSet(deliverables, workflow, today) {
    /** @type {Set<string>} */
    const endpoints = new Set();
    forEachRedEdge(deliverables, workflow, today, (from, target) => {
        endpoints.add(from.name);
        endpoints.add(target.name);
    });
    return endpoints;
}

/**
 * Names of the deliverables flagged atRisk in the config or blocked by a red dependency.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} today DD/MM/YYYY
 * @returns {Set<string>}
 */
export function getEffectiveAtRiskSet(deliverables, workflow, today) {
    const redBlocked = getBlockedByRedDependencySet(deliverables, workflow, today);
    /** @type {Set<string>} */
    const set = new Set();
    deliverables.forEach(s => {
        if (s.atRisk || redBlocked.has(s.name)) set.add(s.name);
    });
    return set;
}
