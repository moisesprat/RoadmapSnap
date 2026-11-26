import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../src/index.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';

process.env.TZ = 'UTC';

const here = path.dirname(fileURLToPath(import.meta.url));
const recorded = JSON.parse(fs.readFileSync(path.resolve(here, '../../app/src/test/__fixtures__/lite-arrows.json'), 'utf8'));

const { buildRoadmapModel, getDependencyGraph, DEFAULT_VIEW_STATE } = core;
const computeDependencyArrows = (...args) => core.computeDependencyArrows(...args);

const TODAY = complexConfig.TIMELINE.TODAY;
const GREEN = '#16a34a';
const ORANGE = '#ea580c';
const RED = '#dc2626';

// The same synthetic rectangles the jsdom characterization mocks: rows 40px apart from y=100, tracks start at
// x=260 and are 740px wide, the container sits at (10, 20).
function measure(names) {
  const rows = {};
  names.forEach((name, i) => {
    rows[name] = { left: 10, top: 100 + i * 40, width: 1000, height: 36, trackLeft: 260, trackWidth: 740 };
  });
  return { container: { left: 10, top: 20 }, rows };
}

function setup(patch = {}) {
  const state = { ...structuredClone({ ...DEFAULT_VIEW_STATE }), ...patch };
  const roadmap = buildRoadmapModel({ config: complexConfig, state, today: TODAY, theme: 'light' });
  const names = roadmap.timeline.sections
    .flatMap((s) => (s.kind === 'group' && s.collapsed ? [] : s.rows))
    .map((r) => r.name);
  return { roadmap, rects: measure(names) };
}

function arrowsFor({ graphOf = null, onlyRed = false, ...patch } = {}) {
  const { roadmap, rects } = setup(patch);
  const deliverables = complexConfig.DELIVERABLES;
  return computeDependencyArrows({
    graph: graphOf ? getDependencyGraph(graphOf, deliverables) : null,
    deliverables,
    workflow: roadmap.workflow,
    today: TODAY,
    months: roadmap.months,
    rects,
    onlyRed,
  });
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// The arrows of a recorded SVG: path d, marker and title of each group, in drawing order.
function parseRecorded(svg) {
  return [...svg.matchAll(/<g [^>]*>([\s\S]*?)<\/g>/g)].map((m) => ({
    d: /<path d="([^"]*)" class=/.exec(m[1])[1],
    markerId: /marker-end="url\(#([^)]*)\)"/.exec(m[1])[1],
    type: /class="dependency-arrow-([a-z]+)"/.exec(m[1])[1],
    title: unescape(/<title>([\s\S]*?)<\/title>/.exec(m[1])[1]),
  }));
}

test('ARROW_MARKERS lists the three arrowheads with their ids and colors', () => {
  assert.deepEqual(core.ARROW_MARKERS.map((m) => [m.id, m.color]), [
    ['arrowhead-green', GREEN], ['arrowhead-orange', ORANGE], ['arrowhead-red', RED],
  ]);
});

test('ARROW_STROKE: 2px at 0.8 opacity, 3px at full opacity on hover', () => {
  assert.deepEqual(core.ARROW_STROKE, { normal: { width: 2, opacity: 0.8 }, hover: { width: 3, opacity: 1 } });
});

test('an open graph yields one arrow per drawable edge, typed inbound or outbound, with Lite colors', () => {
  const arrows = arrowsFor({ graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus' });
  assert.deepEqual(arrows.map((a) => [a.type, a.from, a.to, a.color]), [
    ['inbound', 'API Gateway', 'Event Bus', GREEN],
    ['inbound', 'Identity Service', 'API Gateway', GREEN],
    ['outbound', 'Event Bus', 'Admin Portal', RED],
  ]);
  assert.deepEqual(arrows.map((a) => a.markerId), ['arrowhead-green', 'arrowhead-green', 'arrowhead-red']);
});

test('blocking detection: an unfinished dependency behind its dependent is red, a reached one green, a tight unfinished one orange', () => {
  const red = arrowsFor({ graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus' }).find((a) => a.to === 'Admin Portal');
  assert.equal(red.color, RED);
  const green = arrowsFor({ graphOf: 'Web Portal', activeDependencyGraph: 'Web Portal' });
  assert.ok(green.every((a) => a.color === GREEN));
  const orange = arrowsFor({ graphOf: 'Mobile App', activeDependencyGraph: 'Mobile App' }).find((a) => a.from === 'Data Lake');
  assert.equal(orange.color, ORANGE);
  assert.equal(orange.markerId, 'arrowhead-orange');
});

test('titles name both ends with milestone short, title and date', () => {
  const arrow = arrowsFor({ graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus' }).find((a) => a.to === 'Admin Portal');
  assert.equal(arrow.title, 'Event Bus\n[M3] Release: 30 Jun\n  ↓\nAdmin Portal\n[GO] Start: 01 May');
});

test('with onlyRed and no graph only the red edges of the whole roadmap are returned', () => {
  const arrows = arrowsFor({ onlyRed: true, filter: { ...DEFAULT_VIEW_STATE.filter, riskOnly: true } });
  assert.deepEqual(arrows.map((a) => [a.type, a.from, a.to, a.color]), [['inbound', 'Event Bus', 'Admin Portal', RED]]);
});

test('without a graph and without onlyRed every edge of the roadmap is returned as inbound', () => {
  const arrows = arrowsFor();
  assert.ok(arrows.length > 3);
  assert.ok(arrows.every((a) => a.type === 'inbound'));
});

test('an edge whose row was not measured (a collapsed group) is skipped', () => {
  const open = arrowsFor({ graphOf: 'Data Lake', activeDependencyGraph: 'Data Lake' });
  const collapsed = arrowsFor({ graphOf: 'Data Lake', activeDependencyGraph: 'Data Lake', groupCollapsed: { Platform: true } });
  assert.ok(open.some((a) => a.from === 'Identity Service'));
  assert.ok(collapsed.length > 0 && collapsed.length < open.length);
  assert.ok(collapsed.every((a) => a.from !== 'Identity Service' && a.to !== 'Identity Service'));
});

test('an edge with a milestone outside the visible months is skipped', () => {
  const zoomed = arrowsFor({ graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus', zoom: '6mo' });
  assert.deepEqual(zoomed.map((a) => [a.from, a.to]), [['Event Bus', 'Admin Portal']]);
});

test('a straight line when the rows are less than 5px apart, a curve otherwise', () => {
  const { roadmap } = setup();
  const deliverables = complexConfig.DELIVERABLES;
  const base = { graph: getDependencyGraph('Event Bus', deliverables), deliverables, workflow: roadmap.workflow, today: TODAY, months: roadmap.months };
  const flat = measure(['API Gateway', 'Event Bus', 'Admin Portal', 'Identity Service']);
  flat.rows['Event Bus'].top = flat.rows['API Gateway'].top + 2;
  const straight = computeDependencyArrows({ ...base, rects: flat }).find((a) => a.from === 'API Gateway' && a.to === 'Event Bus');
  assert.match(straight.d, /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  const curved = arrowsFor({ graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus' }).find((a) => a.from === 'API Gateway' && a.to === 'Event Bus');
  assert.match(curved.d, /^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+, [\d.]+ [\d.]+$/);
});

test('the track rectangle falls back to the row rectangle when the row has no track', () => {
  const { roadmap, rects } = setup({ activeDependencyGraph: 'Event Bus' });
  for (const row of Object.values(rects.rows)) { delete row.trackLeft; delete row.trackWidth; }
  const deliverables = complexConfig.DELIVERABLES;
  const arrows = computeDependencyArrows({
    graph: getDependencyGraph('Event Bus', deliverables), deliverables, workflow: roadmap.workflow,
    today: TODAY, months: roadmap.months, rects, onlyRed: false,
  });
  assert.equal(arrows.length, 3);
});

test('arrows have unique ids', () => {
  const arrows = arrowsFor();
  assert.equal(new Set(arrows.map((a) => a.id)).size, arrows.length);
});

for (const [key, args] of [
  ['complex:graphEventBus', { graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus' }],
  ['complex:graphWebPortal', { graphOf: 'Web Portal', activeDependencyGraph: 'Web Portal' }],
  ['complex:graphDataLake', { graphOf: 'Data Lake', activeDependencyGraph: 'Data Lake' }],
  ['complex:graphDataLakePlatformCollapsed', { graphOf: 'Data Lake', activeDependencyGraph: 'Data Lake', groupCollapsed: { Platform: true } }],
  ['complex:graphEventBusZoom6', { graphOf: 'Event Bus', activeDependencyGraph: 'Event Bus', zoom: '6mo' }],
  ['complex:riskOnly', { onlyRed: true, filter: { ...DEFAULT_VIEW_STATE.filter, riskOnly: true } }],
]) {
  test(`core reproduces the geometry, color and title Lite drew before the refactor (${key})`, () => {
    const expected = parseRecorded(recorded[key]);
    const actual = arrowsFor(args);
    assert.equal(actual.length, expected.length);
    assert.deepEqual(actual.map((a) => ({ d: a.d, markerId: a.markerId, type: a.type, title: a.title })), expected);
  });
}
