/**
 * RoadmapSnap — ES module entry point.
 * Imports all core and UI scripts in order (they attach to window), then runs init.
 * CONFIG must be loaded before this (classic script in index.html).
 */

import './state/appState.js';
import './core/configValidator.js';
import './core/timeline.js';
import './core/workflow.js';
import './core/dependencies.js';
import './core/viewModel.js';
import './core/stats.js';
import './ui/renderer.js';
import './ui/dashboard.js';
import './ui/filterBar.js';
import './ui/grouping.js';
import './ui/timelineGrid.js';
import './export/csv.js';
import './export/json.js';
import './export/png.js';
import './ui/dependencyArrows.js';
import './ui/exportControls.js';
import { renderPageHTML } from './ui/page.js';
import { INFO_ICON_SVG, RISK_ICON_SVG, setZoom } from '@roadmapsnap/core';

// ============================================
// THEME (via AppState)
// ============================================
(function initTheme() {
    document.documentElement.setAttribute('data-theme', AppState.get().theme);
})();

// ============================================
// DATE RANGE ZOOM FUNCTIONS
// ============================================
function initOriginalTimeline() {
    const state = AppState.get();
    if (state.timelineStart === null || state.timelineEnd === null) {
        AppState.set({
            timelineStart: CONFIG.TIMELINE.START_MONTH,
            timelineEnd: CONFIG.TIMELINE.END_MONTH
        });
    }
}

function setDateRange(months) {
    initOriginalTimeline();
    const state = AppState.get();

    if (months === 'all') {
        CONFIG.TIMELINE.START_MONTH = state.timelineStart;
        CONFIG.TIMELINE.END_MONTH = state.timelineEnd;
    }
    // 3mo/6mo/12mo: visible months from today at beginning + next X months (computed by the core page model)
    AppState.set(setZoom(AppState.get(), months));
}
window.setDateRange = setDateRange;

// ============================================
// UTILITY FUNCTIONS (escapeHtmlAttr used by filter bar and timeline grid)
// ============================================
function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
window.escapeHtmlAttr = escapeHtmlAttr;

// Icon SVGs live in core as constants (INFO_ICON_SVG for the optional link, RISK_ICON_SVG for at-risk rows).
window.infoIconSVG = INFO_ICON_SVG;
window.riskIconSVG = RISK_ICON_SVG;

// Render Functions
function renderRoadmap() {
    const state = AppState.get();
    document.body.innerHTML = renderPageHTML(state);
    if (state.activeDependencyGraph || state.filter?.riskOnly) {
        setTimeout(() => drawDependencyArrows(), 0);
    } else {
        clearDependencyArrows();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const validation = validateConfig(CONFIG);
    if (validation.errors.length > 0) {
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        document.body.innerHTML = '<div style="color:red; padding:20px; font-family:monospace;">' +
            '<h2>Config Errors</h2><ul>' +
            validation.errors.map(e => '<li>' + esc(e) + '</li>').join('') +
            '</ul></div>';
        return;
    }
    if (validation.warnings.length > 0) {
        console.warn('RoadmapSnap config warnings:', validation.warnings);
    }
    AppState.subscribe((state, prevState) => {
        if (state.theme !== prevState?.theme) {
            document.documentElement.setAttribute('data-theme', state.theme);
            localStorage.setItem('roadmapsnap-theme', state.theme);
        }
        renderRoadmap();
    });
    AppState.set({}); // trigger initial render
    document.addEventListener('click', clearStatusFilterOnOutsideClick);
    document.addEventListener('click', clearDependencyGraphOnClickOutside);
});
