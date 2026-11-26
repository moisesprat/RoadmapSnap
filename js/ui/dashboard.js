/**
 * RoadmapSnap — summary dashboard HTML (header, KPI cards, progress bar, milestone cards).
 * renderDashboard(model) maps the DashboardModel built by @roadmapsnap/core (packages/core/src/models.js) to markup
 * with the html`` tagged template; every decision (labels, fallbacks, counts, flags) is made in the model.
 * The inline handlers call window.filterByStatus, window.toggleRiskFilter and window.toggleDescopedFilter.
 */
import { html, raw } from './renderer.js';
import { RISK_ICON_SVG } from '@roadmapsnap/core';

function renderDashboard(model) {
    var riskSummaryBlock = [];
    if (model.riskSummary && !model.riskSummary.disabled) {
        riskSummaryBlock = raw(html`<div class="risk-summary clickable ${model.riskSummary.active ? 'active' : ''}" onclick="toggleRiskFilter(event)" title="Click to filter At Risk items">
            <span class="risk-summary-icon">${raw(RISK_ICON_SVG)}</span>
            <span class="risk-summary-text">${model.riskSummary.count} At Risk</span>
          </div>`);
    } else if (model.riskSummary) {
        riskSummaryBlock = raw(html`<div class="risk-summary disabled" title="No at-risk items in current filter">
                <span class="risk-summary-icon">${raw(RISK_ICON_SVG)}</span>
                <span class="risk-summary-text">0 At Risk</span>
              </div>`);
    }

    var descopedSummaryBlock = model.descopedSummary
        ? raw(html`<div class="descoped-summary clickable ${model.descopedSummary.active ? 'active' : ''}" onclick="toggleDescopedFilter(event)" title="Click to filter Descoped items">
            <span class="descoped-summary-text">${model.descopedSummary.count} Descoped</span>
          </div>`)
        : [];

    var kpiCards = model.kpiCards.map(function (c) {
        return html`<div class="kpi-card clickable ${c.stateClass} ${c.active ? 'active' : ''}" onclick="filterByStatus('${c.key}', event)">
            <div class="kpi-value">${c.count}</div>
            <div class="kpi-label">${c.title}</div>
            <div class="kpi-sublabel">${c.description}</div>
            ${c.breakdownText ? [html`<div class="kpi-breakdown">${c.breakdownText}</div>`] : []}
          </div>`;
    });

    var totalBreakdown = model.totalCard.breakdownText ? [html`<div class="kpi-breakdown">${model.totalCard.breakdownText}</div>`] : [];

    var progressSegments = model.progress.segments.map(function (seg) {
        return html`<div class="progress-segment ${seg.stateClass}" style="width: ${seg.widthPct}%; opacity: ${seg.opacity};">${seg.label}</div>`;
    });

    var progressLegend = model.legend.map(function (item) {
        return html`<div class="progress-legend-item">
            <div class="progress-legend-dot ${item.stateClass}"></div>
            <span>${item.label}</span>
          </div>`;
    });

    var milestoneCards = model.milestoneCards.map(function (m) {
        var content = m.nextName != null
            ? raw(html`<span class="milestone-card-date">${m.nextDate}</span> - <span class="milestone-card-source">${m.nextName}</span>${m.atRisk ? ' ⚠️' : ''}`)
            : m.completeText;
        return html`<div class="milestone-card">
            <div class="milestone-card-header">
                <div class="milestone-card-icon ${m.slot}">${m.short}</div>
                <div>
                    <div class="milestone-card-title">Next ${m.title}</div>
                    <div class="milestone-card-subtitle">${m.subtitle}</div>
                </div>
            </div>
            <div class="milestone-card-content">${content}</div>
          </div>`;
    });

    return html`<div class="summary-dashboard" id="summary-section">
        <div class="summary-header">
            <div class="summary-title">
                ${model.title}
                <span class="summary-title-note">(${model.total} total ${model.scopeLabel}, ${model.visible} shown in timeline)</span>
            </div>
            <div class="header-right">
                ${riskSummaryBlock}
                ${descopedSummaryBlock}
                <div class="today-date-container">
                    <span class="today-date-label">Today:</span>
                    <span class="today-date-value">${model.todayLabel}</span>
                </div>
            </div>
        </div>
        <div class="kpi-section" style="grid-template-columns: repeat(${model.kpiColumns}, 1fr);">
            <div class="kpi-card total">
                <div class="kpi-value">${model.totalCard.value}</div>
                <div class="kpi-label">${model.totalCard.label}</div>
                <div class="kpi-sublabel">${model.totalCard.sublabel}</div>
                ${totalBreakdown}
            </div>
            ${kpiCards}
        </div>
        <div class="progress-section">
            <div class="progress-header">
                <div class="progress-title">${model.progress.title}</div>
            </div>
            <div class="progress-bar-container">
                ${progressSegments}
            </div>
            <div class="progress-legend">
                ${progressLegend}
            </div>
        </div>
        <div class="key-milestones" style="grid-template-columns: repeat(${model.milestoneColumns}, 1fr);">
            ${milestoneCards}
        </div>
    </div>`;
}

window.renderDashboard = renderDashboard;
