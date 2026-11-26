/**
 * RoadmapSnap core: dependency arrow geometry, color and titles.
 * The caller measures the rectangles of the rows it drew and passes them in; this module turns them into the
 * curve, color, arrowhead and title text of every arrow, so Lite (SVG elements) and the SaaS app (React) draw
 * exactly the same arrows. Pure: no DOM, no storage, no clock (today and the months are arguments).
 */

import { formatDateDisplay } from './dates.js';
import { calculatePosition, isDateInRange } from './timeline.js';
import { getFirstMilestoneKey, getLastMilestoneKey, getMilestoneByKey, getMilestoneDate } from './workflow.js';
import { getInboundDependencies, getDependencyColorForDates } from './dependencies.js';

/**
 * The arrowheads an SVG overlay defines, in definition order: the marker id and the color of its polygon.
 */
export const ARROW_MARKERS = Object.freeze([
    Object.freeze({ id: 'arrowhead-green', color: '#16a34a' }),
    Object.freeze({ id: 'arrowhead-orange', color: '#ea580c' }),
    Object.freeze({ id: 'arrowhead-red', color: '#dc2626' }),
]);

/** Stroke width and opacity of an arrow at rest and while hovered. */
export const ARROW_STROKE = Object.freeze({
    normal: Object.freeze({ width: 2, opacity: 0.8 }),
    hover: Object.freeze({ width: 3, opacity: 1 }),
});

/** The arrow color by dependency color name. */
const MARKER_BY_LEVEL = {
    green: ARROW_MARKERS[0],
    orange: ARROW_MARKERS[1],
    red: ARROW_MARKERS[2],
};

/**
 * @typedef {{ left: number, top: number, width: number, height: number, trackLeft?: number, trackWidth?: number }} RowRect
 *   A measured row; trackLeft and trackWidth are the timeline track inside it (the row's own left and width when
 *   it has none). All values are in the same coordinate space as the container.
 * @typedef {{ container: { left: number, top: number }, rows: Record<string, RowRect> }} ArrowRects
 *   The measured container (the element the arrows are drawn in) and the rows that are on screen, by name. A
 *   deliverable without a row (hidden, collapsed group) has no entry, and the edges touching it are skipped.
 * @typedef {{
 *   id: string, from: string, to: string, type: 'inbound' | 'outbound', d: string,
 *   color: string, level: 'red' | 'orange' | 'green', markerId: string, title: string
 * }} Arrow
 */

/**
 * Every dependency edge of the roadmap, as an inbound edge of its dependent.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {import('./dependencies.js').DependencyEdge[]}
 */
function allInboundEdges(deliverables) {
    /** @type {import('./dependencies.js').DependencyEdge[]} */
    const edges = [];
    deliverables.forEach(target => {
        getInboundDependencies(target).forEach(dep => {
            edges.push({ from: dep.task, to: target.name, fromMilestone: dep.from, toMilestone: dep.to });
        });
    });
    return edges;
}

/**
 * The arrows to draw, from measured rectangles only. With an open `graph` the arrows are the graph's inbound
 * edges followed by its outbound edges; without one they are every edge of the roadmap (inbound), which only
 * makes sense with `onlyRed` (the at-risk filter shows the red edges alone). An edge is skipped when either row
 * was not measured or either milestone date is missing or outside `months`. The curve is a straight line for
 * rows less than 5px apart, otherwise a quadratic curve bulging to the right of the larger x. The color rule is
 * the dependency color rule (reached: green, behind schedule: red, 0..10 days of buffer: orange, else green).
 * Titles are plain text; the mapper escapes or renders them as text.
 * @param {{
 *   graph: { inboundEdges: import('./dependencies.js').DependencyEdge[], outboundEdges: import('./dependencies.js').DependencyEdge[] } | null,
 *   deliverables: import('./workflow.js').Deliverable[],
 *   workflow: import('./workflow.js').WorkflowItem[],
 *   today: string,
 *   months: import('./timeline.js').Month[],
 *   rects: ArrowRects,
 *   onlyRed?: boolean
 * }} args `today` is DD/MM/YYYY; `months` are the months the timeline shows, so positions match the Gantt.
 * @returns {Arrow[]}
 */
export function computeDependencyArrows({ graph, deliverables, workflow, today, months, rects, onlyRed = false }) {
    const sourceMap = new Map(deliverables.map(s => [s.name, s]));
    const firstKey = getFirstMilestoneKey(workflow);
    const lastKey = getLastMilestoneKey(workflow);
    const { container, rows } = rects;

    /**
     * @param {import('./dependencies.js').DependencyEdge} edge
     * @param {'inbound' | 'outbound'} type
     * @param {number} index
     * @returns {Arrow | null}
     */
    function arrowFor(edge, type, index) {
        const fromRow = Object.prototype.hasOwnProperty.call(rows, edge.from) ? rows[edge.from] : undefined;
        const toRow = Object.prototype.hasOwnProperty.call(rows, edge.to) ? rows[edge.to] : undefined;
        if (!fromRow || !toRow) return null;

        const fromSource = sourceMap.get(edge.from);
        const toSource = sourceMap.get(edge.to);

        const fromKey = edge.fromMilestone || lastKey;
        const toKey = edge.toMilestone || firstKey;
        const fromDef = getMilestoneByKey(workflow, fromKey);
        const toDef = getMilestoneByKey(workflow, toKey);

        let fromXPercent = 100;
        let toXPercent = 0;
        let fromDateStr = 'N/A';
        let toDateStr = 'N/A';
        let fromVisible = false;
        let toVisible = false;
        /** @type {string | null} */
        let fromDate = null;
        /** @type {string | null} */
        let toDate = null;

        if (fromSource) {
            const milestoneDate = getMilestoneDate(fromSource, fromKey, firstKey);
            if (milestoneDate) {
                fromDate = milestoneDate;
                fromDateStr = formatDateDisplay(milestoneDate);
                fromVisible = isDateInRange(milestoneDate, months);
                const pos = calculatePosition(milestoneDate, months);
                fromXPercent = pos !== null ? pos : 100;
            }
        }
        if (toSource) {
            const milestoneDate = getMilestoneDate(toSource, toKey, firstKey);
            if (milestoneDate) {
                toDate = milestoneDate;
                toDateStr = formatDateDisplay(milestoneDate);
                toVisible = isDateInRange(milestoneDate, months);
                const pos = calculatePosition(milestoneDate, months);
                toXPercent = pos !== null ? pos : 0;
            }
        }
        if (!fromVisible || !toVisible) return null;

        const fromTrackLeft = fromRow.trackLeft != null ? fromRow.trackLeft : fromRow.left;
        const fromTrackWidth = fromRow.trackWidth != null ? fromRow.trackWidth : fromRow.width;
        const toTrackLeft = toRow.trackLeft != null ? toRow.trackLeft : toRow.left;
        const toTrackWidth = toRow.trackWidth != null ? toRow.trackWidth : toRow.width;

        const fromX = fromTrackLeft - container.left + (fromTrackWidth * fromXPercent / 100);
        const fromY = fromRow.top - container.top + fromRow.height / 2;
        const toX = toTrackLeft - container.left + (toTrackWidth * toXPercent / 100);
        const toY = toRow.top - container.top + toRow.height / 2;

        const vertDist = Math.abs(toY - fromY);
        const curveOffset = Math.min(20, vertDist * 0.15 + 8);

        let d;
        if (vertDist < 5) {
            d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
        } else {
            const midY = (fromY + toY) / 2;
            const controlX = Math.max(fromX, toX) + curveOffset;
            d = `M ${fromX} ${fromY} Q ${controlX} ${midY}, ${toX} ${toY}`;
        }

        const level = getDependencyColorForDates(fromDate, toDate, today);
        if (onlyRed && level !== 'red') return null;
        const marker = MARKER_BY_LEVEL[level];

        const fromShort = (fromDef && fromDef.short) || fromKey;
        const toShort = (toDef && toDef.short) || toKey;
        const fromTitle = (fromDef && fromDef.title) || fromKey;
        const toTitle = (toDef && toDef.title) || toKey;
        return {
            id: `${type}:${edge.from}->${edge.to}:${index}`,
            from: edge.from,
            to: edge.to,
            type,
            d,
            color: marker.color,
            level,
            markerId: marker.id,
            title: `${edge.from}\n[${fromShort}] ${fromTitle}: ${fromDateStr}\n  ↓\n${edge.to}\n[${toShort}] ${toTitle}: ${toDateStr}`,
        };
    }

    const inbound = graph ? graph.inboundEdges : allInboundEdges(deliverables);
    const outbound = graph ? graph.outboundEdges : [];
    /** @type {Arrow[]} */
    const arrows = [];
    inbound.forEach((edge, i) => {
        const arrow = arrowFor(edge, 'inbound', i);
        if (arrow) arrows.push(arrow);
    });
    outbound.forEach((edge, i) => {
        const arrow = arrowFor(edge, 'outbound', i);
        if (arrow) arrows.push(arrow);
    });
    return arrows;
}
