/**
 * RoadmapSnap — export controls HTML.
 * Uses html``. Depends on window: html, raw. The button icons are constants in @roadmapsnap/core.
 */

import { EXPORT_ICON_SVGS } from '@roadmapsnap/core';

function renderExportControls(state) {
    return html`<div class="export-controls">
        <button class="export-btn" onclick="exportToPNG('roadmap-export', 'Full-Roadmap')">${raw(EXPORT_ICON_SVGS.full)} Export Full Roadmap</button>
        <button class="export-btn secondary" onclick="exportToPNG('summary-section', 'Summary-Dashboard')">${raw(EXPORT_ICON_SVGS.summary)} Export Summary Only</button>
        <button class="export-btn secondary" onclick="exportToPNG('timeline-section', 'Timeline-Only')">${raw(EXPORT_ICON_SVGS.timeline)} Export Timeline Only</button>
        <button class="export-btn secondary" onclick="exportToCSV()">${raw(EXPORT_ICON_SVGS.csv)} CSV</button>
        <button class="export-btn secondary" onclick="exportToJSON()">${raw(EXPORT_ICON_SVGS.json)} JSON</button>
        <span class="export-note">Export different views for your presentation</span>
    </div>`;
}

window.renderExportControls = renderExportControls;
