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
