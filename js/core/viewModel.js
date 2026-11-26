/**
 * RoadmapSnap — deliverable view model (Lite binding)
 * buildDeliverableViewModel(source, months, todayPosition, activeDependencyGraph)
 * resolveStateColor(statusKey), resolveStateTextColor(hexColor)
 * Binding over @roadmapsnap/core: the view model rules live in packages/core/src/viewModel.js and take the
 * theme as an argument. Only this file reads data-theme from the document, plus CONFIG and the clock to
 * supply the other arguments.
 */
import * as core from '@roadmapsnap/core';
import { getWorkflow } from './workflow.js';
import { getTodayDate } from './timeline.js';
import { getAllDataSources } from './dependencies.js';

// The theme the core view model colors for: the data-theme attribute of <html>, 'light' without a document.
function getCurrentTheme() {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') || 'light';
}

function resolveStateColor(statusKey) {
    return core.resolveStateColor(getCurrentTheme(), getWorkflow(), statusKey);
}

function resolveStateTextColor(hexColor) {
    return core.resolveStateTextColor(hexColor);
}

function buildDeliverableViewModel(source, months, todayPosition, activeDependencyGraph, effectiveAtRiskSetOverride) {
    return core.buildDeliverableViewModel(source, {
        months: months,
        todayPosition: todayPosition,
        activeDependencyGraph: activeDependencyGraph,
        effectiveAtRiskSet: effectiveAtRiskSetOverride || undefined,
        workflow: getWorkflow(),
        deliverables: getAllDataSources(),
        today: getTodayDate(),
        theme: getCurrentTheme()
    });
}

window.buildDeliverableViewModel = buildDeliverableViewModel;
window.resolveStateColor = resolveStateColor;
window.resolveStateTextColor = resolveStateTextColor;

export { buildDeliverableViewModel, resolveStateColor, resolveStateTextColor };
