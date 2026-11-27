/**
 * RoadmapSnap core: per-deliverable view model.
 * Pure: no DOM, no storage, no clock. The theme, workflow, deliverables and today are explicit arguments;
 * Lite reads the theme from the document and passes it in.
 */

import {
    getStates, getMilestones, getStateByKey, getCurrentStatus, getMilestoneDate, getFirstMilestoneKey,
} from './workflow.js';
import { calculatePosition, isDateInRange } from './timeline.js';
import {
    getDependencyType, getInboundDependencies, getOutboundDependencies, getDependencyGraph, getEffectiveAtRiskSet,
} from './dependencies.js';

// Light theme state palette (index 0..7), the canonical mapping for resolveStateColor
const STATE_PALETTE = [
    '#c1c7d0', '#6554c0', '#0891b2', '#ffab00', '#36b37e', '#0065ff', '#0d9488', '#004cbf'
];

// Matches css/roadmap.css and tokens [data-theme="monochrome"] --color-state-0..7
const MONO_STATE_PALETTE = [
    '#e8e8e8', '#d0d0d0', '#b8b8b8', '#9e9e9e', '#858585', '#6b6b6b', '#525252', '#3a3a3a'
];

// Matches [data-theme="papallona"] --color-state-0..7 (Opella-inspired)
const PAPALLONA_STATE_PALETTE = [
    '#94a3b8', '#475569', '#0d9488', '#0f766e', '#15803d', '#0369a1', '#1d4ed8', '#1e3a5c'
];

// Matches [data-theme="evergreen"]: green/teal/navy palette
const EVERGREEN_STATE_PALETTE = [
    '#cccccc', '#676767', '#277e6e', '#6cbe4c', '#cbd938', '#44b4a1', '#48a2cf', '#0b3c56'
];

// When markers are within this % of the timeline, show only the last (most relevant) one
const MILESTONE_OVERLAP_THRESHOLD_PCT = 2;

/**
 * The fill color of a state. Only the monochrome, papallona and evergreen themes have their own palette; every
 * other theme (light, dark, professional, colorful, blank, unknown) uses the light palette. An unknown state
 * key uses index 0 and the index is capped at 7.
 * @param {string | null | undefined} theme
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @param {string} statusKey
 * @returns {string}
 */
export function resolveStateColor(theme, workflow, statusKey) {
    const states = getStates(workflow);
    let index = states.findIndex(s => s.key === statusKey);
    if (index < 0) index = 0;
    index = Math.min(7, index);
    if (theme === 'monochrome') return MONO_STATE_PALETTE[index];
    if (theme === 'papallona') return PAPALLONA_STATE_PALETTE[index];
    if (theme === 'evergreen') return EVERGREEN_STATE_PALETTE[index];
    return STATE_PALETTE[index];
}

/**
 * Readable text color on a state fill: dark on light fills, white on dark ones. Accepts #rgb and #rrggbb (with
 * or without the #); anything else gives the dark default.
 * @param {string | null | undefined} hexColor
 * @returns {string}
 */
export function resolveStateTextColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#172b4d';
    let hex = hexColor.replace(/^#/, '');
    if (hex.length !== 6 && hex.length !== 3) return '#172b4d';
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#172b4d' : 'white';
}

/**
 * Milestone markers placed on the timeline. Markers closer than 2 percent collapse to the last one of the
 * group; a marker left of 2 percent hides its label.
 * @param {import('./workflow.js').Deliverable} source
 * @param {import('./timeline.js').Month[]} months
 * @param {import('./workflow.js').WorkflowItem[]} milestonesDef the workflow's milestones, in order
 * @param {string} firstKey key of the workflow's first milestone
 * @returns {{ position: number, slotClass: string, short: string, date: string, hideLabel: boolean }[]}
 */
export function buildMilestoneMarkers(source, months, milestonesDef, firstKey) {
    /** @type {{ position: number, slotClass: string, short: string, date: string }[]} */
    const allMarkers = [];
    const startDate = getMilestoneDate(source, firstKey, firstKey);
    const startMilestone = milestonesDef.find(m => m.key === firstKey);
    if (startDate && isDateInRange(startDate, months)) {
        // isDateInRange guarantees a parseable date, so the position is a number
        const position = /** @type {number} */ (calculatePosition(startDate, months));
        allMarkers.push({ position, slotClass: 'start', short: (startMilestone && startMilestone.short) ? startMilestone.short : 'GO', date: startDate });
    }
    const nonFirst = milestonesDef.filter(m => m.key !== firstKey);
    nonFirst.forEach((m, i) => {
        const date = getMilestoneDate(source, m.key, firstKey);
        if (!date || !isDateInRange(date, months)) return;
        const pos = /** @type {number} */ (calculatePosition(date, months));
        const slotClass = 'm' + Math.min(i, 5);
        allMarkers.push({ position: pos, slotClass, short: m.short, date });
    });
    allMarkers.sort((a, b) => a.position - b.position);
    /** @type {Set<number>} */
    const keepIndex = new Set();
    let i = 0;
    while (i < allMarkers.length) {
        let j = i;
        while (j + 1 < allMarkers.length && (allMarkers[j + 1].position - allMarkers[j].position) < MILESTONE_OVERLAP_THRESHOLD_PCT) j++;
        keepIndex.add(j);
        i = j + 1;
    }
    return allMarkers.filter((_, idx) => keepIndex.has(idx)).map(m => ({
        position: m.position,
        slotClass: m.slotClass,
        short: m.short,
        date: m.date,
        hideLabel: m.position < 2
    }));
}

/**
 * Gantt bar segments between consecutive milestones, each split at today into a past and a future part.
 * @param {import('./workflow.js').Deliverable} source
 * @param {import('./timeline.js').Month[]} months
 * @param {number} todayPosition today's position on the timeline, in percent
 * @param {import('./workflow.js').WorkflowItem[]} milestonesDef the workflow's milestones, in order
 * @param {string} firstKey key of the workflow's first milestone
 * @returns {{ left: number, width: number, segmentClass: string, isFuture: boolean }[]}
 */
export function buildGanttSegments(source, months, todayPosition, milestonesDef, firstKey) {
    /** @type {{ left: number, width: number, segmentClass: string, isFuture: boolean }[]} */
    const segments = [];
    const startDate = getMilestoneDate(source, firstKey, firstKey);
    const startDatePos = startDate ? calculatePosition(startDate, months) : null;
    /** @type {Record<string, number | null>} */
    const milestonePositions = {};
    milestonesDef.forEach(m => {
        const date = getMilestoneDate(source, m.key, firstKey);
        milestonePositions[m.key] = date ? calculatePosition(date, months) : null;
    });
    /**
     * @param {number | null} start
     * @param {number | null} end
     * @param {number} milestoneSlot
     */
    function addSegment(start, end, milestoneSlot) {
        if (start === null || end === null || end <= start) return;
        const segClass = milestoneSlot === 0 ? 'segment-start' : 'segment-m' + (milestoneSlot - 1);
        const w = end - start;
        const pastWidth = Math.min(w, Math.max(0, todayPosition - start));
        const futureWidth = w - pastWidth;
        if (pastWidth > 0) {
            segments.push({ left: start, width: pastWidth, segmentClass: segClass, isFuture: false });
        }
        if (futureWidth > 0) {
            segments.push({ left: start + pastWidth, width: futureWidth, segmentClass: segClass, isFuture: true });
        }
    }
    for (let i = 0; i < milestonesDef.length; i++) {
        const current = milestonesDef[i];
        const currentPos = milestonePositions[current.key];
        const slot = i;
        if (i === 0) {
            if (currentPos !== null) {
                const segStart = startDatePos !== null ? startDatePos : Math.max(0, currentPos - 5);
                addSegment(segStart, currentPos, slot);
            }
        }
        if (i < milestonesDef.length - 1) {
            const next = milestonesDef[i + 1];
            const nextPos = milestonePositions[next.key];
            addSegment(currentPos, nextPos, slot);
        }
    }
    return segments;
}

/**
 * The highlight class of a row while a dependency graph is open. `graph` is the object getDependencyGraph
 * returned for the active deliverable, whose first node is that deliverable; null when no graph is open.
 * @param {{ nodes: string[] } | null} graph
 * @param {string} sourceName
 * @returns {'' | 'dependency-active' | 'dependency-highlight' | 'dependency-dimmed'}
 */
export function buildDependencyClass(graph, sourceName) {
    if (!graph) return '';
    if (graph.nodes[0] === sourceName) return 'dependency-active';
    if (graph.nodes.indexOf(sourceName) !== -1) return 'dependency-highlight';
    return 'dependency-dimmed';
}

/**
 * Everything a row of the roadmap needs to render, as a plain object.
 * @param {import('./workflow.js').Deliverable} source
 * @param {{
 *   months: import('./timeline.js').Month[],
 *   todayPosition: number,
 *   activeDependencyGraph?: string | null,
 *   effectiveAtRiskSet?: Set<string>,
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   deliverables: import('./workflow.js').Deliverable[],
 *   today: string,
 *   theme?: string | null
 * }} ctx `activeDependencyGraph` is the name of the deliverable whose dependency graph is open, or null.
 *   `effectiveAtRiskSet` is computed from the deliverables when omitted.
 */
export function buildDeliverableViewModel(source, ctx) {
    const { months, todayPosition, activeDependencyGraph, workflow, deliverables, today, theme } = ctx;
    const status = getCurrentStatus(source, workflow, today);
    const state = getStateByKey(workflow, status);
    const stateColor = resolveStateColor(theme, workflow, status);
    const milestonesDef = getMilestones(workflow);
    const firstKey = getFirstMilestoneKey(workflow);
    const effectiveAtRiskSet = ctx.effectiveAtRiskSet || getEffectiveAtRiskSet(deliverables, workflow, today);
    const graph = activeDependencyGraph ? getDependencyGraph(activeDependencyGraph, deliverables) : null;

    return {
        name: source.name,
        group: source.group || null,
        status,
        state,
        stateColor,
        stateTextColor: resolveStateTextColor(stateColor),
        atRisk: effectiveAtRiskSet.has(source.name),
        descoped: !!source.descoped,
        showInTimeline: source.showInTimeline !== false,
        link: source.link || null,
        tags: Array.isArray(source.tags) ? source.tags : [],
        milestoneMarkers: buildMilestoneMarkers(source, months, milestonesDef, firstKey),
        ganttSegments: buildGanttSegments(source, months, todayPosition, milestonesDef, firstKey),
        dependencyType: getDependencyType(source, deliverables),
        dependencyClass: buildDependencyClass(graph, source.name),
        inboundDeps: getInboundDependencies(source),
        outboundDeps: getOutboundDependencies(source, deliverables)
    };
}
