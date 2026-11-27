/**
 * RoadmapSnap — delegated click handlers for the controls that carry config text.
 * Deliverable names, group names and workflow keys are emitted as data- attributes and read back here, so they
 * are never parsed as JavaScript. Depends on window: toggleDependencyGraph, toggleGroup, filterByStatus.
 */

const CLICK_ACTIONS = [
    ['data-dependency-toggle', (name, event) => window.toggleDependencyGraph(name, event)],
    ['data-group-toggle', (name) => window.toggleGroup(name)],
    ['data-status-filter', (key, event) => window.filterByStatus(key, event)]
];

const SELECTOR = CLICK_ACTIONS.map(([attribute]) => '[' + attribute + ']').join(', ');

function handleDelegatedClick(event) {
    const target = event.target.closest(SELECTOR);
    if (!target) return;
    const [attribute, action] = CLICK_ACTIONS.find(([name]) => target.hasAttribute(name));
    action(target.getAttribute(attribute), event);
}

/**
 * root must sit below document (the app passes document.body, which survives re-renders): the dependency icon and
 * KPI card actions call stopPropagation to keep the document-level outside-click listeners from running.
 */
function bindDelegatedClicks(root) {
    root.addEventListener('click', handleDelegatedClick);
}

export { bindDelegatedClicks };
