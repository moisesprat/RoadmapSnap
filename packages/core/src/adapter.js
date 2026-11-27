/**
 * RoadmapSnap core: API project rows to the Lite config shape (D-15).
 * The one place API data (ISO dates, snake_case columns) becomes the config every core function reads
 * (DD/MM/YYYY dates, camelCase keys). Pure: no DOM, no storage, no clock; today is passed in.
 * Never throws on missing or malformed input: absent fields are omitted or defaulted, malformed dates pass
 * through isoToLite unchanged so a bad value stays visible instead of vanishing.
 */

import { isoToLite, parseDDMMYYYY } from './dates.js';
import { normalizeWorkflow, getMilestones } from './workflow.js';
import { DEFAULT_ENTITY_LABELS, DEFAULT_DASHBOARD_TEXT } from './defaults.js';

/**
 * @typedef {{ task?: string, from?: string | null, to?: string | null }} ApiDependency
 */

/**
 * One project row of GET /workspaces/:id/projects.
 * @typedef {{
 *   id?: string,
 *   name?: string,
 *   group_name?: string | null,
 *   at_risk?: boolean,
 *   descoped?: boolean,
 *   show_in_timeline?: boolean,
 *   tags?: string[] | null,
 *   external_link?: string | null,
 *   display_order?: number,
 *   milestones?: Record<string, string | null> | null,
 *   dependencies?: ApiDependency[] | null
 * }} ApiProject
 */

/**
 * The workspace object of GET /workspaces/:id/projects.
 * @typedef {{
 *   id?: string,
 *   name?: string,
 *   slug?: string,
 *   workflow_definition?: import('./workflow.js').WorkflowItem[] | null,
 *   entity_labels?: Record<string, string> | null,
 *   dashboard_text?: Record<string, string> | null,
 *   settings?: { start_month?: string, end_month?: string, group_order?: string[] } | null
 * }} ApiWorkspace
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value !== '';
}

/**
 * The month range that covers every planned milestone date, as MM/YYYY. With no dates at all it is January
 * to December of the year of today (resolved OQ4).
 * @param {ApiProject[]} projects
 * @param {string} today DD/MM/YYYY
 * @returns {{ START_MONTH: string, END_MONTH: string }}
 */
export function deriveTimelineRange(projects, today) {
    /** @type {string[]} */
    const dates = [];
    for (const project of Array.isArray(projects) ? projects : []) {
        const milestones = project && project.milestones;
        if (!milestones || typeof milestones !== 'object') continue;
        for (const value of Object.values(milestones)) {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) dates.push(value);
        }
    }
    if (dates.length === 0) {
        const parsed = parseDDMMYYYY(today);
        const year = parsed ? String(parsed.getFullYear()) : '';
        return { START_MONTH: '01/' + year, END_MONTH: '12/' + year };
    }
    // ISO dates sort lexicographically in date order.
    dates.sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    return {
        START_MONTH: earliest.slice(5, 7) + '/' + earliest.slice(0, 4),
        END_MONTH: latest.slice(5, 7) + '/' + latest.slice(0, 4),
    };
}

/**
 * @param {ApiDependency | string | null | undefined} dep
 * @returns {import('./workflow.js').Dependency | null}
 */
function convertDependency(dep) {
    if (typeof dep === 'string') return dep === '' ? null : dep;
    if (!dep || !isNonEmptyString(dep.task)) return null;
    const hasFrom = dep.from != null && dep.from !== '';
    const hasTo = dep.to != null && dep.to !== '';
    if (!hasFrom && !hasTo) return dep.task;
    /** @type {{ task: string, from?: string, to?: string }} */
    const out = { task: dep.task };
    if (hasFrom) out.from = /** @type {string} */ (dep.from);
    if (hasTo) out.to = /** @type {string} */ (dep.to);
    return out;
}

/**
 * Converts the milestones of one project: ISO to DD/MM/YYYY, null dates dropped, keys in workflow order
 * (unknown keys follow in API order) so the output does not depend on how the API orders milestone keys.
 * @param {ApiProject['milestones']} milestones
 * @param {string[]} workflowKeys
 * @returns {Record<string, string>}
 */
function convertMilestones(milestones, workflowKeys) {
    /** @type {Record<string, string>} */
    const out = {};
    if (!milestones || typeof milestones !== 'object') return out;
    const source = /** @type {Record<string, unknown>} */ (milestones);
    const keys = [
        ...workflowKeys.filter(key => Object.prototype.hasOwnProperty.call(source, key)),
        ...Object.keys(source).filter(key => !workflowKeys.includes(key)),
    ];
    for (const key of keys) {
        const value = source[key];
        if (isNonEmptyString(value)) out[key] = isoToLite(value);
    }
    return out;
}

/**
 * @param {ApiProject} project
 * @param {string[]} workflowKeys
 * @returns {import('./workflow.js').Deliverable}
 */
function convertProject(project, workflowKeys) {
    const p = project || {};
    /** @type {import('./workflow.js').Deliverable} */
    const deliverable = {
        name: typeof p.name === 'string' ? p.name : '',
        atRisk: Boolean(p.at_risk),
        descoped: Boolean(p.descoped),
        showInTimeline: p.show_in_timeline !== false,
    };
    if (isNonEmptyString(p.group_name)) deliverable.group = p.group_name;
    deliverable.tags = Array.isArray(p.tags) ? [...p.tags] : [];
    if (isNonEmptyString(p.external_link)) deliverable.link = p.external_link;
    deliverable.milestones = convertMilestones(p.milestones, workflowKeys);
    const dependencies = (Array.isArray(p.dependencies) ? p.dependencies : [])
        .map(convertDependency)
        .filter(dep => dep !== null);
    if (dependencies.length > 0) deliverable.dependencies = /** @type {import('./workflow.js').Dependency[]} */ (dependencies);
    return deliverable;
}

/**
 * Builds the Lite config from a GET /workspaces/:id/projects payload. Projects keep the API order. The
 * workspace workflow is used as is; an empty or missing one falls back to the default workflow so the page
 * can still render. The non-filterable group list has no database source and is never set (D-04).
 * @param {{ workspace?: ApiWorkspace | null, projects?: ApiProject[] | null } | null | undefined} payload
 * @param {{ today: string }} opts today as DD/MM/YYYY
 * @returns {import('./workflow.js').RoadmapConfig}
 */
export function apiToRoadmap(payload, { today }) {
    const workspace = (payload && payload.workspace) || {};
    const projects = (payload && Array.isArray(payload.projects)) ? payload.projects : [];
    const settings = workspace.settings || {};

    const derived = deriveTimelineRange(projects, today);
    const workflow = Array.isArray(workspace.workflow_definition) && workspace.workflow_definition.length > 0
        ? workspace.workflow_definition
        : normalizeWorkflow({});
    const workflowKeys = getMilestones(workflow).map(m => m.key);

    /** @type {import('./workflow.js').RoadmapConfig} */
    const config = {
        TIMELINE: {
            TODAY: today,
            START_MONTH: isNonEmptyString(settings.start_month) ? settings.start_month : derived.START_MONTH,
            END_MONTH: isNonEmptyString(settings.end_month) ? settings.end_month : derived.END_MONTH,
        },
        ENTITY_LABELS: { ...DEFAULT_ENTITY_LABELS, ...(workspace.entity_labels || {}) },
        DASHBOARD_TEXT: { ...DEFAULT_DASHBOARD_TEXT, ...(workspace.dashboard_text || {}) },
        WORKFLOW: workflow,
        ...(Array.isArray(settings.group_order) ? { GROUP_ORDER: [...settings.group_order] } : {}),
        DELIVERABLES: projects.map(project => convertProject(project, workflowKeys)),
    };
    return config;
}
