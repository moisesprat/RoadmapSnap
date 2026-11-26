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
        AppState.set({ zoom: 'all', activeDependencyGraph: null });
    } else {
        // 3mo/6mo/12mo: visible months from today at beginning + next X months (computed in renderRoadmap)
        AppState.set({ zoom: months + 'mo', activeDependencyGraph: null });
    }
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

// Info icon SVG (for optional link)
const infoIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm9-3.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75V8.25zm.75 2.25a.75.75 0 00-.75.75v4.5c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75v-4.5a.75.75 0 00-.75-.75H12z" clip-rule="evenodd" />
</svg>`;
window.infoIconSVG = infoIconSVG;

// Risk icon SVG
const riskIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
</svg>`;
window.riskIconSVG = riskIconSVG;

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
