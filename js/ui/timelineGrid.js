/**
 * RoadmapSnap — timeline section HTML (state legend, roadmap-content with header + data rows).
 * A markup-only mapper over the core TimelineModel (packages/core/src/timelineModel.js): every decision
 * (grouping and order, classes, gantt segments, markers, tooltip texts, dependency icon, status text) is made
 * there; this file turns it into HTML with html`` and escapes at render time.
 * Group headers and dependency icons carry their name in a data- attribute (clicks: delegatedClicks.js).
 * Depends on window: riskIconSVG, infoIconSVG.
 */
import { html, raw, renderIf } from './renderer.js';

var chevronSVG = '<svg class="group-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clip-rule="evenodd" /></svg>';

var DEPENDENCY_ICON_SVGS = {
    inbound: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 3v7H6l6 8 6-8h-3.5V3z"/></svg>',
    outbound: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 21v-7H18l-6-8-6 8h3.5v7z"/></svg>',
    both: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z"/></svg>'
};

function renderTimelineGrid(model) {
    var todayPosition = model.todayPosition;
    var gridLinesHTML = model.gridLines.map(function (leftPct) {
        return '<div class="month-grid-line" style="left: ' + leftPct + '%;"></div>';
    }).join('');

    function renderSourceRow(row) {
        var statusClass = 'state-' + row.stateIndex;
        var indicatorClass = 'state-' + row.stateIndex;
        var atRiskClass = row.atRisk ? 'at-risk' : '';
        var descopedClass = row.descoped ? 'descoped' : '';
        var groupItemClass = row.groupItem ? 'group-item' : '';
        var ganttTooltip = row.ganttTooltip;
        var ganttSegmentsHTML = row.segments.map(function (seg) {
            return html`<div class="gantt-bar ${seg.segmentClass}${seg.isFuture ? ' gantt-future' : ''}" style="left: ${seg.left}%; width: ${seg.width}%;" title="${ganttTooltip}"></div>`;
        });
        var milestonesHTMLArr = row.markers.map(function (m) {
            return html`<div class="milestone-marker ${m.slotClass}" style="left: ${m.position}%;${m.hideLabel ? ' min-width: 8px; width: 8px; height: 8px; border-radius: 50%;' : ''}">${m.hideLabel ? [] : [html`<span>${m.short}</span><div class="milestone-date">${m.dateText}</div>`]}</div>`;
        });
        var dependencyIconHTML = '';
        if (row.dependency) {
            dependencyIconHTML = html`<div class="dependency-icon ${row.dependency.type} ${row.dependency.active ? 'active' : ''}" title="${row.dependency.tooltip}" data-dependency-toggle="${row.name}">${raw(DEPENDENCY_ICON_SVGS[row.dependency.type])}</div>`;
        }
        var riskIndicatorHTML = renderIf(row.atRisk, raw('<div class="risk-indicator" title="At Risk">' + (typeof riskIconSVG !== 'undefined' ? riskIconSVG : '') + '</div>'));
        var infoLinkHTML = renderIf(row.safeLink, raw(html`<a class="info-link" href="${row.safeLink}" target="_blank" rel="noopener noreferrer" title="More info">${raw(typeof infoIconSVG !== 'undefined' ? infoIconSVG : '')}</a>`));
        var dependencyIconFragment = renderIf(!!row.dependency, raw(dependencyIconHTML));
        var ganttOrOverlay = model.showGantt ? ganttSegmentsHTML : (ganttTooltip ? [html`<div class="gantt-tooltip-overlay" title="${ganttTooltip}"></div>`] : []);
        return html`<div class="data-source-row ${atRiskClass} ${groupItemClass} ${row.dependencyClass} ${descopedClass}">
            <div class="source-name ${statusClass}">
                ${riskIndicatorHTML}
                <span class="source-name-text">${row.name}</span>
                ${infoLinkHTML}
                ${dependencyIconFragment}
                <span class="status-indicator ${indicatorClass}" title="${row.status.title}">${row.status.short}</span>
            </div>
            <div class="timeline-track">
                ${raw(gridLinesHTML)}
                ${ganttOrOverlay}
                <div class="today-guide-line" style="left: ${todayPosition}%;"></div>
                ${milestonesHTMLArr}
            </div>
        </div>`;
    }

    var monthColumns = model.headerPeriods.map(function (p) {
        return html`<div class="month-column" style="width: ${p.widthPct}%; flex: 0 0 ${p.widthPct}%;">${p.label}</div>`;
    });

    var dataSourceRows = [];
    model.sections.forEach(function (section) {
        if (section.kind === 'group') {
            var chevronClass = 'group-chevron' + (section.collapsed ? ' collapsed' : '');
            dataSourceRows.push(html`<div class="group-header" data-group-toggle="${section.name}">
                <div class="group-header-name">
                    ${raw(chevronSVG.replace('class="group-chevron"', 'class="' + chevronClass + '"'))}
                    ${section.name}
                    <span class="group-stats">
                        ${section.stats.count} items${section.stats.atRisk > 0 ? raw(' <span class="group-stats-risk">(' + section.stats.atRisk + ' at risk)</span>') : []}
                    </span>
                </div>
                <div class="group-header-track"></div>
            </div>`);
            if (!section.collapsed) {
                section.rows.forEach(function (row) {
                    dataSourceRows.push(renderSourceRow(row));
                });
            }
        } else {
            section.rows.forEach(function (row) {
                dataSourceRows.push(renderSourceRow(row));
            });
        }
    });

    var stateLegendItems = model.legend.map(function (s) {
        return html`<div class="state-legend-item">
            <span class="state-legend-badge ${s.stateClass}">${s.short}</span>
            <span class="state-legend-label">${s.title}</span>
        </div>`;
    });

    var rowsHTML = dataSourceRows.join('');
    return html`<div id="timeline-section">
        <div class="state-legend">
            <div class="state-legend-items">
                ${stateLegendItems}
            </div>
            <div class="state-legend-info">
                Timeline: <span class="state-legend-info-count">${model.rangeStart}</span> - <span class="state-legend-info-count">${model.rangeEnd}</span>
            </div>
        </div>
        <div class="roadmap-content">
            <div class="roadmap-grid">
                <div class="timeline-header">
                    <div class="timeline-label">${model.columnHeader}</div>
                    <div class="timeline-months">
                        ${monthColumns}
                        <div class="today-pointer" style="left: ${todayPosition}%;">
                            <div class="today-pointer-arrow"></div>
                        </div>
                    </div>
                </div>
                ${raw(rowsHTML)}
            </div>
        </div>
    </div>`;
}

window.renderTimelineGrid = renderTimelineGrid;
