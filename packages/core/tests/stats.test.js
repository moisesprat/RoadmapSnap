import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { minimalWorkflow, minimalDeliverables } from '../../../tests/fixtures/config.minimal.js';
import { complexWorkflow, complexDeliverables, complexConfig } from '../../../tests/fixtures/config.complex.js';

process.env.TZ = 'UTC';

const TODAY = '15/04/2026';
const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' };
const STATE_KEYS = ['NS', 'DSN', 'DEV', 'QA', 'LIVE'];

// --- calculateStats ---

test('calculateStats on the complex fixture counts effective at-risk rows and excludes descoped rows from the KPIs', () => {
  // 13 rows, 1 descoped: total 12. Effective at risk: Event Bus, Admin Portal (red edge), Data Lake.
  const stats = core.calculateStats(complexDeliverables, complexWorkflow, TODAY, complexConfig);
  assert.equal(stats.total, 12);
  assert.equal(stats.atRisk, 3);
  assert.equal(stats.descoped, 1);
  assert.equal(stats.visible, 11);
  assert.equal(stats.hidden, 1);
  assert.deepEqual(
    { NS: stats.NS, DSN: stats.DSN, DEV: stats.DEV, QA: stats.QA, LIVE: stats.LIVE },
    { NS: 2, DSN: 3, DEV: 2, QA: 2, LIVE: 3 },
  );
  assert.deepEqual(stats.stateKeys, STATE_KEYS);
  assert.equal(stats.completionPercentage, 25);
  assert.equal(stats.productionReadyPercentage, 42);
});

test('calculateStats returns the Lite shape: one top-level count per state key plus the split maps', () => {
  const stats = core.calculateStats(minimalDeliverables, minimalWorkflow, TODAY, {});
  assert.deepEqual(Object.keys(stats).sort(), [
    'DEV', 'DONE', 'NS', 'atRisk', 'completionPercentage', 'descoped', 'hidden', 'hiddenByStatus',
    'productionReadyPercentage', 'stateKeys', 'total', 'visible', 'visibleByStatus',
  ]);
  assert.equal(stats.total, 3);
  assert.equal(stats.atRisk, 1);
});

test('calculateStats excludes rows of NON_FILTERABLE_GROUPS from every count', () => {
  const config = { ...complexConfig, NON_FILTERABLE_GROUPS: ['Ops'] };
  const stats = core.calculateStats(complexDeliverables, complexWorkflow, TODAY, config);
  assert.equal(stats.total, 11);
  assert.equal(stats.DEV, 1);
  assert.equal(stats.completionPercentage, 27);
  assert.equal(stats.productionReadyPercentage, 45);
});

test('calculateStats files a row with showInTimeline undefined under visible but hiddenByStatus (preserved quirk)', () => {
  const rows = [
    { name: 'Undefined flag', atRisk: false, milestones: { START: '01/01/2026' } },
    { name: 'True flag', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026' } },
  ];
  const stats = core.calculateStats(rows, complexWorkflow, TODAY, {});
  assert.equal(stats.visible, 2);
  assert.equal(stats.hidden, 0);
  assert.equal(stats.visibleByStatus.DSN, 1);
  assert.equal(stats.hiddenByStatus.DSN, 1);
});

test('calculateStats uses the given today for the red-dependency part of atRisk', () => {
  const rows = [
    { name: 'Blocker', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026', M3: '30/06/2026' } },
    { name: 'Blocked', atRisk: false, showInTimeline: true, milestones: { START: '01/05/2026' }, dependencies: ['Blocker'] },
  ];
  // On 15/04/2026 the Blocker's M3 (30/06) is after the Blocked START (01/05) and not reached: the edge is red.
  assert.equal(core.calculateStats(rows, complexWorkflow, '15/04/2026', {}).atRisk, 1);
  // On 01/01/2030 every from-date counts as reached, so the edge is green.
  assert.equal(core.calculateStats(rows, complexWorkflow, '01/01/2030', {}).atRisk, 0);
});

test('edge (empty): calculateStats on [] yields zero counts and percentages without throwing', () => {
  const stats = core.calculateStats([], complexWorkflow, TODAY, {});
  assert.equal(stats.total, 0);
  assert.equal(stats.visible, 0);
  assert.equal(stats.hidden, 0);
  assert.equal(stats.atRisk, 0);
  assert.equal(stats.descoped, 0);
  assert.equal(stats.completionPercentage, 0);
  assert.equal(stats.productionReadyPercentage, 0);
  assert.deepEqual(stats.visibleByStatus, { NS: 0, DSN: 0, DEV: 0, QA: 0, LIVE: 0 });
  assert.deepEqual(stats.hiddenByStatus, { NS: 0, DSN: 0, DEV: 0, QA: 0, LIVE: 0 });
});

test('calculateStats with a single state reports the completion percentage as the production-ready percentage', () => {
  const wf = [{ type: 'state', key: 'ONLY', short: 'ONLY', title: 'Only' }, { type: 'milestone', key: 'START', short: 'GO', title: 'Start' }];
  const stats = core.calculateStats([{ name: 'A', showInTimeline: true, milestones: {} }], wf, TODAY, {});
  assert.equal(stats.productionReadyPercentage, stats.completionPercentage);
});

// --- visible sources ---

test('getAllVisibleDataSources keeps rows unless showInTimeline is exactly false', () => {
  const rows = [{ name: 'A', showInTimeline: false }, { name: 'B' }, { name: 'C', showInTimeline: true }];
  assert.deepEqual(core.getAllVisibleDataSources(rows).map((d) => d.name), ['B', 'C']);
  assert.deepEqual(core.getAllVisibleDataSources([]), []);
});

test('getFilterableDeliverablesFrom drops rows of non-filterable groups and returns the list itself when there are none', () => {
  const rows = [{ name: 'A', group: 'Ops' }, { name: 'B', group: 'Dev' }, { name: 'C' }];
  assert.deepEqual(core.getFilterableDeliverablesFrom(rows, ['Ops']).map((d) => d.name), ['B', 'C']);
  assert.equal(core.getFilterableDeliverablesFrom(rows, []), rows);
});

test('getVisibleDataSources composes the visible rows, the filters and the sort', () => {
  const ctx = {
    filter: { ...ALL, status: 'DEV' },
    sort: { by: 'name', order: 'desc' },
    workflow: complexWorkflow,
    today: TODAY,
    nonFilterableGroups: [],
  };
  const out = core.getVisibleDataSources(complexDeliverables, ctx);
  assert.ok(out.length > 0);
  assert.ok(out.every((d) => core.getCurrentStatus(d, complexWorkflow, TODAY) === 'DEV'));
  const names = out.map((d) => d.name);
  assert.deepEqual(names, [...names].sort((a, b) => b.localeCompare(a)));
  assert.deepEqual(core.getVisibleDataSources([], ctx), []);
});

// --- getUpcomingMilestones ---

test('getUpcomingMilestones returns the nearest future date per milestone key with the effective at-risk flag', () => {
  assert.deepEqual(core.getUpcomingMilestones(complexDeliverables, complexWorkflow, TODAY, []), {
    START: { source: 'Admin Portal', date: '01/05/2026', atRisk: true },
    M1: { source: 'Data Lake', date: '25/04/2026', atRisk: true },
    M2: { source: 'Mobile App', date: '02/05/2026', atRisk: false },
    M3: { source: 'Event Bus', date: '30/06/2026', atRisk: true },
  });
});

test('getUpcomingMilestones keeps null for every key when nothing is in the future, and for []', () => {
  const old = [{ name: 'Old', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2025', M1: '01/02/2025' } }];
  assert.deepEqual(core.getUpcomingMilestones(old, complexWorkflow, TODAY, []), { START: null, M1: null, M2: null, M3: null });
  assert.deepEqual(core.getUpcomingMilestones([], complexWorkflow, TODAY, []), { START: null, M1: null, M2: null, M3: null });
});

test('getUpcomingMilestones counts a milestone dated exactly today and skips non-filterable groups', () => {
  const rows = [
    { name: 'Today Row', atRisk: false, showInTimeline: true, milestones: { START: '15/04/2026' } },
    { name: 'Ops Early', atRisk: false, showInTimeline: true, group: 'Ops', milestones: { START: '15/04/2026' } },
  ];
  assert.equal(core.getUpcomingMilestones(rows, complexWorkflow, TODAY, []).START.source, 'Today Row');
  assert.equal(core.getUpcomingMilestones([rows[1], rows[0]], complexWorkflow, TODAY, ['Ops']).START.source, 'Today Row');
  assert.equal(core.getUpcomingMilestones([rows[1]], complexWorkflow, TODAY, ['Ops']).START, null);
});

test('getUpcomingMilestones ignores rows hidden from the timeline', () => {
  const rows = [{ name: 'Hidden', atRisk: false, showInTimeline: false, milestones: { START: '20/04/2026' } }];
  assert.equal(core.getUpcomingMilestones(rows, complexWorkflow, TODAY, []).START, null);
});
