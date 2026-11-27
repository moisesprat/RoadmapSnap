/**
 * RoadmapSnap core: display defaults equal to js/config_base.js.
 * A SaaS workspace stores only the labels and texts its owner changed; the adapter merges them over these
 * values so the page reads the same as a Lite config that omits them (D-04).
 * Pure: no DOM, no storage, no clock.
 */

/** @type {Readonly<{ singular: string, plural: string, columnHeader: string, scopeLabel: string }>} */
export const DEFAULT_ENTITY_LABELS = Object.freeze({
    singular: 'Deliverable',
    plural: 'Deliverables',
    columnHeader: 'Deliverable',
    scopeLabel: 'deliverables',
});

/** @type {Readonly<{ title: string, totalSubtitleSuffix: string }>} */
export const DEFAULT_DASHBOARD_TEXT = Object.freeze({
    title: 'Project Roadmap Dashboard',
    totalSubtitleSuffix: 'in roadmap scope',
});
