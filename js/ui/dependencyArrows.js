/**
 * RoadmapSnap — dependency arrows overlay and toggle
 * drawDependencyArrows only measures the rows on screen, asks core computeDependencyArrows
 * (packages/core/src/arrows.js) for each arrow's path, color, arrowhead and title, and builds the SVG elements.
 * Opening, closing and click-outside use the core view-state transitions (packages/core/src/viewState.js).
 * Uses AppState for activeDependencyGraph. Depends on AppState, CONFIG (window).
 */
import {
    computeDependencyArrows, selectMonths, ARROW_MARKERS, ARROW_STROKE, GRAPH_OUTSIDE_CLICK_EXCLUSIONS, groupNamesForNodes,
    toggleDependencyGraph as coreToggleDependencyGraph, closeDependencyGraph as coreCloseDependencyGraph
} from '@roadmapsnap/core';
import AppState from '../state/appState.js';
import { getDependencyGraph, getAllDataSources } from '../core/dependencies.js';
import { getTodayDate } from '../core/timeline.js';
import { getWorkflow } from '../core/workflow.js';

function toggleDependencyGraph(sourceName, event) {
    if (event) {
        event.stopPropagation();
    }

    // Opening a graph expands the groups of its nodes and clears the filters; the same click closes it again.
    const groupNames = groupNamesForNodes(getDependencyGraph(sourceName).nodes, getAllDataSources());
    AppState.set(coreToggleDependencyGraph(AppState.get(), sourceName, groupNames));

    if (AppState.get().activeDependencyGraph) {
        setTimeout(() => drawDependencyArrows(), 50);
    } else {
        clearDependencyArrows();
    }
}

function clearDependencyGraphOnClickOutside(event) {
    const active = AppState.get().activeDependencyGraph;
    if (active && !event.target.closest(GRAPH_OUTSIDE_CLICK_EXCLUSIONS)) {
        AppState.set(coreCloseDependencyGraph(AppState.get()));
        clearDependencyArrows();
    }
}

// The rectangles computeDependencyArrows needs, measured from the rows on screen (rows of collapsed groups are
// not in the DOM, so they have no entry and their edges are skipped). Keyed by name; a name seen twice keeps the first row.
function measureArrowRects(container) {
    const containerRect = container.getBoundingClientRect();
    const rows = Object.create(null);
    container.querySelectorAll('.data-source-row').forEach(row => {
        const nameEl = row.querySelector('.source-name-text');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        if (name in rows) return;
        const rect = row.getBoundingClientRect();
        const track = row.querySelector('.timeline-track');
        const trackRect = track ? track.getBoundingClientRect() : rect;
        rows[name] = {
            left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            trackLeft: trackRect.left, trackWidth: trackRect.width
        };
    });
    return { container: { left: containerRect.left, top: containerRect.top }, rows };
}

function drawDependencyArrows() {
    const state = AppState.get();
    const activeDependencyGraph = state.activeDependencyGraph;
    const showRiskOnlyRed = !!(state.filter && state.filter.riskOnly) && !activeDependencyGraph;
    if (!activeDependencyGraph && !showRiskOnlyRed) return;

    const container = document.querySelector('.roadmap-content');
    if (!container) return;

    clearDependencyArrows();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'dependency-arrows-svg';
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20;';
    svg.setAttribute('pointer-events', 'none');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ARROW_MARKERS.forEach(({ id, color }) => {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', id);
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', color);
        polygon.setAttribute('stroke', color);
        polygon.setAttribute('stroke-width', '1');
        marker.appendChild(polygon);
        defs.appendChild(marker);
    });
    svg.appendChild(defs);

    // Same visible months as the timeline (today at the beginning + next X months for 3mo/6mo/12mo)
    const today = getTodayDate();
    const months = selectMonths({ zoom: state.zoom, timeline: CONFIG.TIMELINE, today });
    const deliverables = getAllDataSources();
    const arrows = computeDependencyArrows({
        graph: activeDependencyGraph ? getDependencyGraph(activeDependencyGraph) : null,
        deliverables,
        workflow: getWorkflow(),
        today,
        months,
        rects: measureArrowRects(container),
        onlyRed: showRiskOnlyRed
    });

    arrows.forEach(arrow => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.style.cursor = 'pointer';
        group.setAttribute('pointer-events', 'auto');

        const hoverPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hoverPath.setAttribute('d', arrow.d);
        hoverPath.setAttribute('stroke', 'transparent');
        hoverPath.setAttribute('stroke-width', '14');
        hoverPath.setAttribute('fill', 'none');
        hoverPath.setAttribute('pointer-events', 'stroke');
        group.appendChild(hoverPath);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', arrow.d);
        path.setAttribute('class', 'dependency-arrow-' + arrow.type);
        path.setAttribute('stroke', arrow.color);
        path.style.stroke = arrow.color;
        path.setAttribute('stroke-width', String(ARROW_STROKE.normal.width));
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', `url(#${arrow.markerId})`);
        path.setAttribute('opacity', String(ARROW_STROKE.normal.opacity));
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        group.addEventListener('mouseenter', () => {
            path.setAttribute('stroke-width', String(ARROW_STROKE.hover.width));
            path.setAttribute('opacity', String(ARROW_STROKE.hover.opacity));
        });
        group.addEventListener('mouseleave', () => {
            path.setAttribute('stroke-width', String(ARROW_STROKE.normal.width));
            path.setAttribute('opacity', String(ARROW_STROKE.normal.opacity));
        });

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = arrow.title;
        group.appendChild(title);

        svg.appendChild(group);
    });

    container.style.position = 'relative';
    container.appendChild(svg);
}

function clearDependencyArrows() {
    const svg = document.getElementById('dependency-arrows-svg');
    if (svg) {
        svg.remove();
    }
}

/** Close the dependency graph (state + DOM). Call when filters change so the graph is cleared. */
function closeDependencyGraph() {
    if (AppState.get().activeDependencyGraph) {
        AppState.set(coreCloseDependencyGraph(AppState.get()));
        clearDependencyArrows();
    }
}

// Export on window for global access
window.toggleDependencyGraph = toggleDependencyGraph;
window.clearDependencyGraphOnClickOutside = clearDependencyGraphOnClickOutside;
window.drawDependencyArrows = drawDependencyArrows;
window.clearDependencyArrows = clearDependencyArrows;
window.closeDependencyGraph = closeDependencyGraph;
