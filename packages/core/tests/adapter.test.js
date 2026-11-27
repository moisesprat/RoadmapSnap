import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiToRoadmap,
  deriveTimelineRange,
  DEFAULT_ENTITY_LABELS,
  DEFAULT_DASHBOARD_TEXT,
  normalizeWorkflow,
  getMilestones,
} from '../src/index.js';
import { roadmapToApi, canonicalRoadmap } from '../../../tests/helpers/roadmapToApi.js';
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';

const TODAY = '15/04/2026';

const workflow = [
  { type: 'state', key: 'NS', short: 'NS', title: 'Not Started' },
  { type: 'milestone', key: 'START', short: 'GO', title: 'Start' },
  { type: 'state', key: 'DEV', short: 'DEV', title: 'In Development' },
  { type: 'milestone', key: 'M1', short: 'M1', title: 'Done' },
  { type: 'state', key: 'DONE', short: 'DONE', title: 'Done' },
];

function api(projects, settings = {}, extra = {}) {
  return { workspace: { id: 'w', name: 'W', workflow_definition: workflow, entity_labels: {}, dashboard_text: {}, settings, ...extra }, projects };
}

function project(over = {}) {
  return {
    id: 'p1', name: 'A', group_name: null, at_risk: false, descoped: false, show_in_timeline: true,
    tags: [], external_link: null, display_order: 0, milestones: {}, dependencies: [], ...over,
  };
}

// --- defaults ---
test('defaults: config_base labels and dashboard text, frozen', () => {
  assert.deepEqual({ ...DEFAULT_ENTITY_LABELS }, { singular: 'Deliverable', plural: 'Deliverables', columnHeader: 'Deliverable', scopeLabel: 'deliverables' });
  assert.deepEqual({ ...DEFAULT_DASHBOARD_TEXT }, { title: 'Project Roadmap Dashboard', totalSubtitleSuffix: 'in roadmap scope' });
  assert.equal(Object.isFrozen(DEFAULT_ENTITY_LABELS), true);
  assert.equal(Object.isFrozen(DEFAULT_DASHBOARD_TEXT), true);
});

// --- project conversion ---
test('apiToRoadmap: ISO dates become DD/MM/YYYY and null dates remove the key', () => {
  const out = apiToRoadmap(api([project({ milestones: { START: '2026-03-31', M1: null } })]), { today: TODAY });
  assert.deepEqual(out.DELIVERABLES[0].milestones, { START: '31/03/2026' });
});

test('apiToRoadmap: null group_name and external_link omit group and link', () => {
  const out = apiToRoadmap(api([project(), project({ id: 'p2', name: 'B', group_name: 'G', external_link: 'https://x.example' })]), { today: TODAY });
  assert.equal('group' in out.DELIVERABLES[0], false);
  assert.equal('link' in out.DELIVERABLES[0], false);
  assert.equal(out.DELIVERABLES[1].group, 'G');
  assert.equal(out.DELIVERABLES[1].link, 'https://x.example');
});

test('apiToRoadmap: deliverable keys follow the canonical order', () => {
  const out = apiToRoadmap(api([project({ group_name: 'G', external_link: 'https://x.example', dependencies: [{ task: 'Z' }] })]), { today: TODAY });
  assert.deepEqual(Object.keys(out.DELIVERABLES[0]), ['name', 'atRisk', 'descoped', 'showInTimeline', 'group', 'tags', 'link', 'milestones', 'dependencies']);
  const bare = apiToRoadmap(api([project()]), { today: TODAY });
  assert.deepEqual(Object.keys(bare.DELIVERABLES[0]), ['name', 'atRisk', 'descoped', 'showInTimeline', 'tags', 'milestones']);
});

test('apiToRoadmap: dependencies without from/to are plain strings, others keep only the present keys', () => {
  const out = apiToRoadmap(api([project({ dependencies: [
    { task: 'A' }, { task: 'B', from: 'M1' }, { task: 'C', to: 'M1' }, { task: 'D', from: 'START', to: 'M1' }, { task: 'E', from: null, to: null },
  ] })]), { today: TODAY });
  assert.deepEqual(out.DELIVERABLES[0].dependencies, ['A', { task: 'B', from: 'M1' }, { task: 'C', to: 'M1' }, { task: 'D', from: 'START', to: 'M1' }, 'E']);
});

test('apiToRoadmap: milestone keys follow the workflow order, not the API order', () => {
  const out = apiToRoadmap(api([project({ milestones: { M1: '2026-06-01', START: '2026-01-01', X9: '2026-02-02' } })]), { today: TODAY });
  assert.deepEqual(Object.keys(out.DELIVERABLES[0].milestones), ['START', 'M1', 'X9']);
});

test('apiToRoadmap: projects keep API order', () => {
  const out = apiToRoadmap(api([project({ id: 'a', name: 'Zed' }), project({ id: 'b', name: 'Abe' })]), { today: TODAY });
  assert.deepEqual(out.DELIVERABLES.map((d) => d.name), ['Zed', 'Abe']);
});

// --- settings, labels, workflow ---
test('apiToRoadmap: settings start_month, end_month and group_order become TIMELINE and GROUP_ORDER', () => {
  const out = apiToRoadmap(api([project()], { start_month: '01/2025', end_month: '06/2026', group_order: ['B', 'A'] }), { today: TODAY });
  assert.deepEqual(out.TIMELINE, { TODAY, START_MONTH: '01/2025', END_MONTH: '06/2026' });
  assert.deepEqual(out.GROUP_ORDER, ['B', 'A']);
  assert.equal('NON_FILTERABLE_GROUPS' in out, false);
});

test('apiToRoadmap: no GROUP_ORDER key unless settings.group_order is an array', () => {
  assert.equal('GROUP_ORDER' in apiToRoadmap(api([project()]), { today: TODAY }), false);
  assert.equal('GROUP_ORDER' in apiToRoadmap(api([project()], { group_order: 'x' }), { today: TODAY }), false);
});

test('apiToRoadmap: entity_labels and dashboard_text merge over the config_base defaults', () => {
  const out = apiToRoadmap(api([project()], {}, { entity_labels: { scopeLabel: 'teams' }, dashboard_text: { title: 'Mine' } }), { today: TODAY });
  assert.deepEqual(out.ENTITY_LABELS, { ...DEFAULT_ENTITY_LABELS, scopeLabel: 'teams' });
  assert.deepEqual(out.DASHBOARD_TEXT, { ...DEFAULT_DASHBOARD_TEXT, title: 'Mine' });
});

test('apiToRoadmap: WORKFLOW is the workspace workflow_definition', () => {
  assert.deepEqual(apiToRoadmap(api([project()]), { today: TODAY }).WORKFLOW, workflow);
});

// --- default range (resolved OQ4) ---
test('deriveTimelineRange: earliest and latest milestone months', () => {
  const projects = [
    project({ milestones: { START: '2025-02-14', M1: '2026-01-01' } }),
    project({ id: 'b', milestones: { START: '2025-06-01', M1: '2026-09-03' } }),
  ];
  assert.deepEqual(deriveTimelineRange(projects, TODAY), { START_MONTH: '02/2025', END_MONTH: '09/2026' });
});

test('deriveTimelineRange: no milestone dates gives January to December of the year of today', () => {
  assert.deepEqual(deriveTimelineRange([project({ milestones: { START: null } })], TODAY), { START_MONTH: '01/2026', END_MONTH: '12/2026' });
  assert.deepEqual(deriveTimelineRange([], TODAY), { START_MONTH: '01/2026', END_MONTH: '12/2026' });
});

test('apiToRoadmap: empty settings derive the range from the milestones', () => {
  const out = apiToRoadmap(api([project({ milestones: { START: '2025-02-14', M1: '2026-09-03' } })], {}), { today: TODAY });
  assert.equal(out.TIMELINE.START_MONTH, '02/2025');
  assert.equal(out.TIMELINE.END_MONTH, '09/2026');
});

test('apiToRoadmap: one setting given, the other derived', () => {
  const out = apiToRoadmap(api([project({ milestones: { START: '2025-02-14', M1: '2026-09-03' } })], { start_month: '01/2025' }), { today: TODAY });
  assert.equal(out.TIMELINE.START_MONTH, '01/2025');
  assert.equal(out.TIMELINE.END_MONTH, '09/2026');
});

test('apiToRoadmap: no milestone dates and no settings use the year of today', () => {
  const out = apiToRoadmap(api([project()]), { today: TODAY });
  assert.equal(out.TIMELINE.START_MONTH, '01/2026');
  assert.equal(out.TIMELINE.END_MONTH, '12/2026');
});

// --- null safety (T-02-17) ---
test('apiToRoadmap: missing or malformed input never throws', () => {
  for (const input of [undefined, null, {}, { workspace: null, projects: null }, { workspace: {}, projects: [{}] }]) {
    const out = apiToRoadmap(input, { today: TODAY });
    assert.ok(Array.isArray(out.DELIVERABLES));
    assert.ok(Array.isArray(out.WORKFLOW) && out.WORKFLOW.length > 0);
    assert.deepEqual(out.ENTITY_LABELS, { ...DEFAULT_ENTITY_LABELS });
  }
  const odd = apiToRoadmap(api([project({ tags: null, dependencies: null, milestones: { START: 5, M1: 'garbage' } })]), { today: TODAY });
  assert.deepEqual(odd.DELIVERABLES[0].tags, []);
  assert.equal('dependencies' in odd.DELIVERABLES[0], false);
  assert.deepEqual(odd.DELIVERABLES[0].milestones, { M1: 'garbage' });
});

// --- round trip through the test-only inverse ---
// A fixture row with { START: '' } (the "no dates" row, kept because validateConfig rejects milestones: {})
// has a null date in the API shape, and a null date removes the key, so the round trip yields {}.
function withoutEmptyDates(config) {
  const copy = structuredClone(config);
  for (const d of copy.DELIVERABLES) {
    for (const [k, v] of Object.entries(d.milestones || {})) {
      if (v === '') delete d.milestones[k];
    }
  }
  return copy;
}

test('round trip: apiToRoadmap(roadmapToApi(complexConfig)) equals complexConfig (empty dates become absent)', () => {
  assert.deepEqual(apiToRoadmap(roadmapToApi(complexConfig), { today: TODAY }), withoutEmptyDates(complexConfig));
});

test('round trip: canonicalRoadmap is idempotent for minimalConfig and complexConfig', () => {
  for (const config of [minimalConfig, complexConfig]) {
    const once = canonicalRoadmap(config);
    assert.deepEqual(canonicalRoadmap(once), once);
  }
});

test('round trip: the canonical workflow of a legacy MILESTONES config is the normalized one', () => {
  const legacy = { TIMELINE: { TODAY, START_MONTH: '01/2026', END_MONTH: '12/2026' }, DELIVERABLES: [{ name: 'A', milestones: { START: '01/02/2026' } }] };
  const out = canonicalRoadmap(legacy);
  assert.deepEqual(out.WORKFLOW, normalizeWorkflow(legacy));
  assert.equal(getMilestones(out.WORKFLOW).length > 0, true);
});
