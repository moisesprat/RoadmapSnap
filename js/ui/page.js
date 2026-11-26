/**
 * RoadmapSnap — page composition
 * renderPageHTML(state) returns the full page HTML (filter bar, export controls,
 * dashboard, timeline, footers) so the browser and Node tests render the same string.
 * Every page-level decision (months per zoom, today position, visible sources, at-risk set, KPI search branch,
 * stats, upcoming milestones) is made by buildRoadmapModel in packages/core/src/models.js; this file reads CONFIG,
 * the clock and the document theme only to supply its arguments.
 * Depends on window globals defined by earlier imports: CONFIG, renderFilterBar, renderExportControls,
 * renderDashboard, renderTimelineGrid.
 * Not attached to window.
 */
import { buildRoadmapModel, buildDashboardModel, buildFilterBarModel } from '@roadmapsnap/core';
import { getTodayDate } from '../core/timeline.js';

function renderFooter() {
    const v = typeof CONFIG !== 'undefined' ? (CONFIG.VERSION || '?') : '?';
    const b = typeof CONFIG !== 'undefined' ? (CONFIG.BUILD_DATE || '') : '';
    return '<footer class="page-footer">© 2026 <a href="https://github.com/moises-prat-epm/RoadmapSnap" target="_blank" rel="noopener">RoadmapSnap</a> · Licensed under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">MIT License</a></footer>' +
        '<footer class="build-version" aria-label="Build version">v' + v + ' · Build ' + b + '</footer>';
}

// The theme the page is rendered for: the data-theme attribute of <html>, 'light' without a document.
function getDocumentTheme() {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') || 'light';
}

function renderPageHTML(state) {
    const model = buildRoadmapModel({ config: CONFIG, state, today: getTodayDate(), theme: getDocumentTheme() });

    const pageHTML =
        renderFilterBar(buildFilterBarModel(model)) +
        renderExportControls(state) +
        '<div class="roadmap-container" id="roadmap-export">' +
        renderDashboard(buildDashboardModel(model)) +
        renderTimelineGrid(model.timeline) +
        '</div>' +
        renderFooter();

    return pageHTML;
}

export { renderPageHTML, renderFooter };
