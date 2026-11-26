import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { renderLiteHTML, loadLite } from '../../../tests/helpers/liteRender.js';
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';

process.env.TZ = 'UTC';

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' };
const withFilter = (patch) => ({ filter: { ...ALL, ...patch } });

const FIXTURES = { minimal: minimalConfig, complex: complexConfig };
const STATES = {
  default: {},
  search: withFilter({ search: 'a' }),
  status: withFilter({ status: 'DEV' }),
  riskOnly: withFilter({ riskOnly: true }),
  zoom6: { zoom: '6mo' },
  sortDesc: { sort: { by: 'name', order: 'desc' } },
};

// Lite bindings are the reference: they are what the byte-exact snapshots were generated from.
await loadLite();
const lite = {
  timeline: await import('../../../js/core/timeline.js'),
  stats: await import('../../../js/core/stats.js'),
  dependencies: await import('../../../js/core/dependencies.js'),
  workflow: await import('../../../js/core/workflow.js'),
};

for (const [fixtureName, config] of Object.entries(FIXTURES)) {
  for (const [stateName, patch] of Object.entries(STATES)) {
    test(`buildRoadmapModel matches the Lite page derivations (${fixtureName}:${stateName})`, async () => {
      await renderLiteHTML(config, patch);
      const { default: AppState } = await import('../../../js/state/appState.js');
      const state = AppState.get();
      const today = lite.timeline.getTodayDate();
      const model = core.buildRoadmapModel({ config: globalThis.CONFIG, state, today, theme: 'light' });

      const months = (state.zoom === 'all' || !state.zoom)
        ? lite.timeline.generateMonths()
        : lite.timeline.generateVisibleMonthsForZoom(lite.timeline.parseDate(today), parseInt(state.zoom, 10));
      assert.deepEqual(model.months, months);
      assert.equal(model.todayPosition, lite.timeline.calculatePosition(today, months));
      assert.deepEqual(model.visibleSources.map((s) => s.name), lite.stats.getVisibleDataSources().map((s) => s.name));
      assert.deepEqual([...model.effectiveAtRiskSet].sort(), [...lite.dependencies.getEffectiveAtRiskSet()].sort());
      assert.deepEqual(model.upcoming, lite.stats.getUpcomingMilestones());

      const searching = Boolean(state.filter.search && state.filter.search.trim());
      const expectedStats = searching
        ? lite.stats.calculateStats(window.filterBySearchOnly(globalThis.CONFIG.DELIVERABLES))
        : lite.stats.calculateStats();
      assert.deepEqual(model.stats, expectedStats);
      assert.equal(model.hasSearchFilter, searching);

      const inView = model.visibleSources.filter((s) => !lite.workflow.isDeliverableNonFilterable(s));
      assert.equal(model.statsForDashboard.atRiskInView, inView.filter((s) => model.effectiveAtRiskSet.has(s.name)).length);
      assert.equal(model.statsForDashboard.descopedInView, inView.filter((s) => s.descoped).length);
      assert.deepEqual(model.workflow, lite.workflow.getWorkflow());
    });
  }
}

test('selectMonths: zoom all and a missing zoom use the configured range, a zoom of N months counts from today', () => {
  const timeline = { START_MONTH: '01/2026', END_MONTH: '03/2026' };
  const all = core.selectMonths({ zoom: 'all', timeline, today: '15/02/2026' });
  assert.equal(all.length, 3);
  assert.deepEqual(core.selectMonths({ zoom: undefined, timeline, today: '15/02/2026' }), all);
  const six = core.selectMonths({ zoom: '6mo', timeline, today: '15/02/2026' });
  assert.deepEqual(six, core.generateVisibleMonthsForZoom(core.parseDDMMYYYY('15/02/2026'), 6));
});

test('buildRoadmapModel defaults the theme to light and never mutates the config', () => {
  const before = JSON.stringify(minimalConfig);
  const state = { filter: ALL, sort: { by: 'm3date', order: 'asc' }, zoom: 'all', showGantt: true, groupCollapsed: {}, activeDependencyGraph: null };
  const model = core.buildRoadmapModel({ config: minimalConfig, state, today: '15/04/2026' });
  assert.equal(model.theme, 'light');
  assert.equal(JSON.stringify(minimalConfig), before);
});

// --- buildDashboardModel ---

const DEFAULT_STATE = { filter: ALL, sort: { by: 'm3date', order: 'asc' }, zoom: 'all', showGantt: true, groupCollapsed: {}, activeDependencyGraph: null };

function dashboardFor(config, patch = {}) {
  const state = { ...DEFAULT_STATE, ...patch };
  return core.buildDashboardModel(core.buildRoadmapModel({ config, state, today: config.TIMELINE.TODAY, theme: 'light' }));
}

test('buildDashboardModel uses Lite fallbacks without labels and the config labels with them', () => {
  const minimal = dashboardFor(minimalConfig);
  assert.equal(minimal.entityPlural, 'Items');
  assert.equal(minimal.scopeLabel, 'items');
  assert.equal(minimal.title, 'Roadmap Dashboard');
  assert.equal(minimal.totalSubtitleSuffix, 'in scope');
  const complex = dashboardFor(complexConfig);
  assert.equal(complex.entityPlural, 'Workstreams');
  assert.equal(complex.scopeLabel, 'workstreams');
  assert.equal(complex.title, 'Complex Program Dashboard');
  assert.equal(complex.totalSubtitleSuffix, 'in program scope');
});

test('buildDashboardModel derives the scope label from the plural when only the plural is configured', () => {
  const config = { ...minimalConfig, ENTITY_LABELS: { plural: 'Epics' } };
  const model = dashboardFor(config);
  assert.equal(model.entityPlural, 'Epics');
  assert.equal(model.scopeLabel, 'epics');
});

test('buildDashboardModel carries the totals, today label and total card', () => {
  const model = dashboardFor(complexConfig);
  assert.equal(model.total, 12);
  assert.equal(model.visible, 11);
  assert.equal(model.todayLabel, '15 Apr 2026');
  assert.deepEqual(model.totalCard, { value: 12, label: 'Total Workstreams', sublabel: 'in program scope', breakdownText: '11 shown + 1 hidden' });
  assert.equal(model.kpiColumns, 6);
  assert.equal(model.milestoneColumns, 4);
  assert.equal(dashboardFor(minimalConfig).totalCard.breakdownText, '2 shown + 1 hidden');
});

test('buildDashboardModel KPI cards follow the workflow state order with counts, breakdown text and active flag', () => {
  const model = dashboardFor(complexConfig);
  assert.deepEqual(model.kpiCards.map((c) => c.key), ['NS', 'DSN', 'DEV', 'QA', 'LIVE']);
  assert.deepEqual(model.kpiCards.map((c) => c.count), [2, 3, 2, 2, 3]);
  assert.deepEqual(model.kpiCards.map((c) => c.stateIndex), [0, 1, 2, 3, 4]);
  assert.deepEqual(model.kpiCards.map((c) => c.breakdownText), ['', '', '', '1 shown + 1 hidden', '']);
  assert.ok(model.kpiCards.every((c) => c.clickable === true && c.active === false));
  assert.equal(model.kpiCards[0].description, 'Waiting for kickoff');
  assert.equal(model.kpiCards[2].title, 'In Development and Cross-Team Integration Testing');
  const filtered = dashboardFor(complexConfig, { filter: { ...ALL, status: 'DEV' } });
  assert.deepEqual(filtered.kpiCards.map((c) => c.active), [false, false, true, false, false]);
});

test('buildDashboardModel clamps the state index to 7 and leaves the description empty when absent', () => {
  const states = Array.from({ length: 10 }, (_, i) => ({ type: 'state', key: `S${i}`, short: `S${i}`, title: `State ${i}` }));
  const workflow = [{ type: 'milestone', key: 'START', short: 'GO', title: 'Start' }, ...states];
  const config = { TIMELINE: minimalConfig.TIMELINE, WORKFLOW: workflow, DELIVERABLES: [{ name: 'A', milestones: { START: '01/01/2026' } }] };
  const model = dashboardFor(config);
  assert.deepEqual(model.kpiCards.map((c) => c.stateIndex), [0, 1, 2, 3, 4, 5, 6, 7, 7, 7]);
  assert.equal(model.kpiCards[9].stateClass, 'state-7');
  assert.equal(model.kpiCards[0].description, '');
});

test('buildDashboardModel risk summary: clickable with in-view count, disabled when none in view, absent when no row is at risk', () => {
  assert.deepEqual(dashboardFor(complexConfig).riskSummary, { count: 3, active: false, disabled: false });
  assert.deepEqual(dashboardFor(complexConfig, { filter: { ...ALL, riskOnly: true } }).riskSummary, { count: 3, active: true, disabled: false });
  assert.deepEqual(dashboardFor(complexConfig, { filter: { ...ALL, status: 'DEV' } }).riskSummary, { count: 0, active: false, disabled: true });
  const calm = { ...minimalConfig, DELIVERABLES: minimalConfig.DELIVERABLES.map((d) => ({ ...d, atRisk: false })) };
  assert.equal(dashboardFor(calm).riskSummary, null);
});

test('buildDashboardModel descoped summary: present with the in-view count, absent without descoped rows', () => {
  assert.deepEqual(dashboardFor(complexConfig).descopedSummary, { count: 1, active: false });
  assert.deepEqual(dashboardFor(complexConfig, { filter: { ...ALL, descopedOnly: true } }).descopedSummary, { count: 1, active: true });
  assert.equal(dashboardFor(minimalConfig).descopedSummary, null);
});

test('buildDashboardModel progress segments carry width, label and the dimmed opacity while a status is filtered', () => {
  const model = dashboardFor(complexConfig);
  assert.equal(model.progress.title, 'Overall Progress (All 12 Workstreams)');
  assert.deepEqual(model.progress.segments.map((s) => s.widthPct), [(2 / 12) * 100, (3 / 12) * 100, (2 / 12) * 100, (2 / 12) * 100, (3 / 12) * 100]);
  assert.ok(model.progress.segments.every((s) => s.opacity === '1'));
  const filtered = dashboardFor(complexConfig, { filter: { ...ALL, status: 'DEV' } });
  assert.deepEqual(filtered.progress.segments.map((s) => s.opacity), ['0.3', '0.3', '1', '0.3', '0.3']);
  const minimal = dashboardFor(minimalConfig);
  assert.deepEqual(minimal.progress.segments.map((s) => s.label), ['1', '2', '']);
  assert.equal(minimal.progress.segments[2].widthPct, 0);
});

test('buildDashboardModel legend labels each state with its short code and title', () => {
  const legend = dashboardFor(complexConfig).legend;
  assert.equal(legend.length, 5);
  assert.deepEqual(legend[2], { key: 'DEV', stateClass: 'state-2', short: 'DEV', title: 'In Development and Cross-Team Integration Testing', label: 'DEV In Development and Cross-Team Integration Testing' });
});

test('buildDashboardModel milestone cards name the next deliverable and its short date, or say all are complete', () => {
  const minimal = dashboardFor(minimalConfig).milestoneCards;
  assert.deepEqual(minimal[0], { key: 'START', short: 'GO', title: 'Start', subtitle: '', slot: 'start', nextName: null, nextDate: '', atRisk: false, completeText: 'All start complete' });
  assert.deepEqual(minimal[1], { key: 'M1', short: 'M1', title: 'Done', subtitle: '', slot: 'm0', nextName: 'Task Alpha', nextDate: '1 Jun 2026', atRisk: false, completeText: 'All done complete' });
  const complex = dashboardFor(complexConfig).milestoneCards;
  assert.equal(complex[0].nextName, 'Admin Portal');
  assert.equal(complex[0].nextDate, '1 May 2026');
  assert.equal(complex[0].atRisk, true);
  assert.equal(complex[0].subtitle, 'Kickoff');
  assert.deepEqual(complex.map((m) => m.slot), ['start', 'm0', 'm1', 'm2']);
});

test('buildDashboardModel holds plain data only: deliverable text passes through unescaped and nothing is markup', () => {
  for (const config of [minimalConfig, complexConfig]) {
    assert.equal(JSON.stringify(dashboardFor(config)).includes('<'), false);
  }
  const hostile = { ...minimalConfig, DELIVERABLES: [{ name: '<b>x</b>', milestones: { START: '01/01/2026', M1: '01/06/2026' } }] };
  assert.equal(dashboardFor(hostile).milestoneCards[1].nextName, '<b>x</b>');
});
