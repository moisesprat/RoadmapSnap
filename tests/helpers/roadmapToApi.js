// Test-only inverse of the core adapter: turns a Lite roadmap config into the payload shape
// GET /workspaces/:id/projects returns, and canonicalizes a config by passing it through the adapter.
// It is deliberately not exported from @roadmapsnap/core: production code never needs the inverse.
// Used by the core export/adapter tests and the Lite/SaaS parity suite.

import { apiToRoadmap, normalizeWorkflow } from '../../packages/core/src/index.js';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

// DD/MM/YYYY -> YYYY-MM-DD by string operations only; anything else becomes null (no date).
function liteToIso(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}

function projectId(index) {
  return '00000000-0000-4000-8000-0000000001' + String(index + 1).padStart(2, '0');
}

function dependencyToApi(dep) {
  if (typeof dep === 'string') return { task: dep };
  const out = { task: dep.task };
  if (dep.from != null) out.from = dep.from;
  if (dep.to != null) out.to = dep.to;
  return out;
}

/**
 * @param {import('../../packages/core/src/workflow.js').RoadmapConfig} config
 * @returns {{ workspace: object, projects: object[] }}
 */
export function roadmapToApi(config) {
  const settings = {
    start_month: config.TIMELINE && config.TIMELINE.START_MONTH,
    end_month: config.TIMELINE && config.TIMELINE.END_MONTH,
  };
  if (Array.isArray(config.GROUP_ORDER)) settings.group_order = [...config.GROUP_ORDER];
  const workspace = {
    id: WORKSPACE_ID,
    name: (config.DASHBOARD_TEXT && config.DASHBOARD_TEXT.title) || 'Workspace',
    slug: 'parity',
    workflow_definition: normalizeWorkflow(config),
    entity_labels: config.ENTITY_LABELS ? { ...config.ENTITY_LABELS } : {},
    dashboard_text: config.DASHBOARD_TEXT ? { ...config.DASHBOARD_TEXT } : {},
    settings,
  };
  const projects = config.DELIVERABLES.map((d, index) => {
    const milestones = {};
    for (const [key, value] of Object.entries(d.milestones || {})) {
      milestones[key] = liteToIso(value);
    }
    return {
      id: projectId(index),
      name: d.name,
      group_name: d.group == null ? null : d.group,
      at_risk: Boolean(d.atRisk),
      descoped: Boolean(d.descoped),
      show_in_timeline: d.showInTimeline !== false,
      tags: d.tags ? [...d.tags] : [],
      external_link: d.link == null ? null : d.link,
      display_order: index,
      milestones,
      dependencies: (d.dependencies || []).map(dependencyToApi),
    };
  });
  return { workspace, projects };
}

/**
 * The config a roadmap becomes after one trip through the API shape and the adapter.
 * @param {import('../../packages/core/src/workflow.js').RoadmapConfig} config
 */
export function canonicalRoadmap(config) {
  return apiToRoadmap(roadmapToApi(config), { today: config.TIMELINE.TODAY });
}
