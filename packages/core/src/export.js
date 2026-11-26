/**
 * RoadmapSnap core: CSV and JSON export builders.
 * Pure: no DOM, no storage, no clock. The caller supplies today (DD/MM/YYYY) and, for JSON, the export
 * timestamp, so Lite and the SaaS app produce the same bytes from the same roadmap (D-12).
 *
 * Known gap (deferred, see the phase deferred-items.md): CSV cells that begin with =, +, - or @ are written
 * unescaped, exactly as Lite always has, because changing them would change Lite's export bytes.
 */

import {
    normalizeWorkflow,
    getStates,
    getMilestones,
    getStateByKey,
    getCurrentStatus,
    getNextMilestone,
    getMilestoneDate,
    getFirstMilestoneKey,
} from './workflow.js';

/** File names both products download. */
export const EXPORT_FILENAMES = Object.freeze({ csv: 'deliverables.csv', json: 'deliverables.json' });

/**
 * Builds the deliverables CSV: one row per deliverable, one "<KEY> Date" column per milestone. The name cell
 * has its quotes doubled; the group and link cells are written as-is (preserved from Lite).
 * @param {import('./workflow.js').RoadmapConfig} config
 * @param {{ today: string }} opts today as DD/MM/YYYY
 * @returns {string}
 */
export function buildCsv(config, { today }) {
    const workflow = normalizeWorkflow(config);
    const milestones = getMilestones(workflow);
    const firstKey = getFirstMilestoneKey(workflow);
    const headers = ['Name', 'Group', 'Current State', 'Next Milestone', 'At Risk', 'Tags', 'Link'];
    milestones.forEach(m => headers.push(`${m.key} Date`));

    const rows = [headers.join(',')];

    config.DELIVERABLES.forEach(source => {
        const status = getCurrentStatus(source, workflow, today);
        const currentState = getStateByKey(workflow, status);
        const nextMilestone = getNextMilestone(source, workflow, today);
        const row = [
            `"${(source.name || '').replace(/"/g, '""')}"`,
            `"${source.group || ''}"`,
            currentState ? `${currentState.short} - ${currentState.title}` : status,
            nextMilestone ? nextMilestone.short : 'Complete',
            source.atRisk ? 'Yes' : 'No',
            `"${(source.tags || []).join('; ')}"`,
            `"${source.link || ''}"`
        ];
        milestones.forEach(m => {
            row.push(getMilestoneDate(source, m.key, firstKey) || '');
        });
        rows.push(row.join(','));
    });

    return rows.join('\n');
}

/**
 * Builds the roadmap JSON export, indented with two spaces.
 * @param {import('./workflow.js').RoadmapConfig} config
 * @param {{ today: string, now: string }} opts today as DD/MM/YYYY, now as an ISO timestamp used as exportDate
 * @returns {string}
 */
export function buildJson(config, { today, now }) {
    const workflow = normalizeWorkflow(config);
    const exportData = {
        exportDate: now,
        timeline: config.TIMELINE,
        workflow,
        states: getStates(workflow),
        milestones: getMilestones(workflow),
        deliverables: config.DELIVERABLES.map(source => {
            const currentState = getStateByKey(workflow, getCurrentStatus(source, workflow, today));
            const nextMilestone = getNextMilestone(source, workflow, today);
            return {
                ...source,
                currentState: currentState ? { key: currentState.key, title: currentState.title } : null,
                nextMilestone: nextMilestone ? { key: nextMilestone.key, title: nextMilestone.title } : null
            };
        })
    };
    return JSON.stringify(exportData, null, 2);
}
