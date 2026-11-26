/**
 * RoadmapSnap — page composition
 * renderPageHTML(state) returns the full page HTML (filter bar, export controls,
 * dashboard, timeline, footers) so the browser and Node tests render the same string.
 * Moved verbatim out of js/app.js renderRoadmap().
 * Depends on window globals defined by earlier imports: CONFIG, getVisibleDataSources,
 * filterBySearchOnly, calculateStats, getUpcomingMilestones, isDeliverableNonFilterable,
 * renderFilterBar, renderExportControls, renderDashboard, renderTimelineGrid.
 * Not attached to window.
 */
import { parseDate, getTodayDate, generateMonths, generateVisibleMonthsForZoom, calculatePosition } from '../core/timeline.js';
import { getEffectiveAtRiskSet } from '../core/dependencies.js';

function renderFooter() {
    const v = typeof CONFIG !== 'undefined' ? (CONFIG.VERSION || '?') : '?';
    const b = typeof CONFIG !== 'undefined' ? (CONFIG.BUILD_DATE || '') : '';
    return '<footer class="page-footer">© 2026 <a href="https://github.com/moises-prat-epm/RoadmapSnap" target="_blank" rel="noopener">RoadmapSnap</a> · Licensed under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">MIT License</a></footer>' +
        '<footer class="build-version" aria-label="Build version">v' + v + ' · Build ' + b + '</footer>';
}

function renderPageHTML(state) {
    const months = (state.zoom === 'all' || !state.zoom)
        ? generateMonths()
        : generateVisibleMonthsForZoom(parseDate(getTodayDate()), parseInt(state.zoom, 10));
    const todayPosition = calculatePosition(getTodayDate(), months);
    const visibleSources = getVisibleDataSources();
    const effectiveAtRiskSet = getEffectiveAtRiskSet();
    const hasSearchFilter = Boolean(state.filter.search && state.filter.search.trim());
    const sourcesForKpi = hasSearchFilter
        ? filterBySearchOnly(CONFIG.DELIVERABLES)
        : null;
    const stats = hasSearchFilter ? calculateStats(sourcesForKpi) : calculateStats();
    const upcoming = getUpcomingMilestones();
    const atRiskInView = visibleSources.filter(s => !isDeliverableNonFilterable(s) && effectiveAtRiskSet.has(s.name)).length;
    const descopedInView = visibleSources.filter(s => !isDeliverableNonFilterable(s) && s.descoped).length;
    const statsForDashboard = Object.assign({}, stats, { atRiskInView, descopedInView });

    const pageHTML =
        renderFilterBar(state, visibleSources) +
        renderExportControls(state) +
        '<div class="roadmap-container" id="roadmap-export">' +
        renderDashboard(state, statsForDashboard, upcoming, months) +
        renderTimelineGrid(state, visibleSources, months, todayPosition) +
        '</div>' +
        renderFooter();

    return pageHTML;
}

export { renderPageHTML, renderFooter };
