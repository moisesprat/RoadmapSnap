import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoadmapModel, buildTimelineModel, groupDeliverables, hasAnyGroups, getGroupStats, groupNamesForNodes,
  DEFAULT_VIEW_STATE, toggleGroup, collapseAllGroups, expandAllGroups,
} from '../src/index.js';
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';

const view = (patch = {}) => ({
  ...structuredClone({ ...DEFAULT_VIEW_STATE }),
  ...patch,
});

const timelineOf = (config, state = {}) =>
  buildRoadmapModel({ config, state: view(state), today: config.TIMELINE.TODAY, theme: 'light' }).timeline;

const rowOf = (timeline, name) => {
  for (const section of timeline.sections) {
    const row = section.rows.find((r) => r.name === name);
    if (row) return row;
  }
  throw new Error('no row ' + name);
};

test('buildRoadmapModel exposes the timeline model and buildTimelineModel rebuilds the same one', () => {
  const roadmap = buildRoadmapModel({ config: complexConfig, state: view(), today: '15/04/2026', theme: 'light' });
  assert.deepEqual(buildTimelineModel(roadmap), roadmap.timeline);
});

test('sections follow GROUP_ORDER, a group missing from it comes after, ungrouped rows come last', () => {
  const sections = timelineOf(complexConfig).sections;
  assert.deepEqual(sections.map((s) => (s.kind === 'group' ? s.name : s.kind)), ['Platform', 'Apps', 'Data', 'Ops', 'ungrouped']);
});

test('groups are alphabetical when the config has no GROUP_ORDER', () => {
  const { GROUP_ORDER, ...noOrder } = complexConfig;
  assert.ok(GROUP_ORDER);
  const names = timelineOf(noOrder).sections.filter((s) => s.kind === 'group').map((s) => s.name);
  assert.deepEqual(names, ['Apps', 'Data', 'Ops', 'Platform']);
});

test('without any group the timeline is one ungrouped section and no row is a group item', () => {
  const ungrouped = { ...minimalConfig, DELIVERABLES: minimalConfig.DELIVERABLES.map(({ group, ...d }) => d) };
  const sections = timelineOf(ungrouped).sections;
  assert.equal(sections.length, 1);
  assert.equal(sections[0].kind, 'ungrouped');
  assert.ok(sections[0].rows.length > 0);
  assert.ok(sections[0].rows.every((r) => r.groupItem === false));
});

test('group rows are group items and ungrouped rows are not', () => {
  const sections = timelineOf(complexConfig).sections;
  for (const section of sections) {
    for (const row of section.rows) assert.equal(row.groupItem, section.kind === 'group');
  }
});

test('the collapsed flag comes from the view state', () => {
  const sections = timelineOf(complexConfig, { groupCollapsed: { Platform: true } }).sections;
  assert.equal(sections.find((s) => s.name === 'Platform').collapsed, true);
  assert.equal(sections.find((s) => s.name === 'Apps').collapsed, false);
});

test('group stats count the items and the raw atRisk flags, not the dependency-derived at-risk set', () => {
  const timeline = timelineOf(complexConfig);
  const platform = timeline.sections.find((s) => s.name === 'Platform');
  assert.deepEqual(platform.stats, { count: platform.rows.length, atRisk: 1 });
  // Admin Portal is at risk through a red dependency (row flag) but is not flagged in the config (group stat).
  const apps = timeline.sections.find((s) => s.name === 'Apps');
  assert.equal(apps.stats.atRisk, 0);
  assert.equal(rowOf(timeline, 'Admin Portal').atRisk, true);
});

test('header periods cover 18 months and grid lines sit between the months', () => {
  const timeline = timelineOf(complexConfig);
  assert.equal(timeline.months.length, 18);
  assert.equal(timeline.gridLines.length, 17);
  assert.ok(timeline.gridLines.every((p, i) => p > 0 && p < 100 && (i === 0 || p > timeline.gridLines[i - 1])));
  const total = timeline.headerPeriods.reduce((sum, p) => sum + p.widthPct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
  assert.ok(timeline.headerPeriods.length < 18, 'long timelines group months into periods');
  assert.equal(timeline.columnHeader, 'Workstream');
  assert.equal(timeline.rangeStart, timeline.months[0].name);
  assert.equal(timeline.rangeEnd, timeline.months[17].name);
});

test('the column header falls back to the singular label, then to Item', () => {
  assert.equal(timelineOf({ ...complexConfig, ENTITY_LABELS: { singular: 'Epic' } }).columnHeader, 'Epic');
  assert.equal(timelineOf({ ...complexConfig, ENTITY_LABELS: undefined }).columnHeader, 'Item');
});

test('the today position and the Gantt switch come from the page model and the view state', () => {
  const roadmap = buildRoadmapModel({ config: complexConfig, state: view({ showGantt: false }), today: '15/04/2026', theme: 'light' });
  assert.equal(roadmap.timeline.todayPosition, roadmap.todayPosition);
  assert.equal(roadmap.timeline.showGantt, false);
});

test('gantt tooltip lists each milestone date, one per line', () => {
  const row = rowOf(timelineOf(complexConfig), 'Identity Service');
  assert.equal(row.ganttTooltip, 'GO: 10 Jan\nM1: 15 Mar\nM2: 20 Jun\nM3: 30 Sep');
  assert.equal(rowOf(timelineOf(complexConfig), 'Unscheduled Spike').ganttTooltip, '');
});

test('a row carries its status text, state index, segments and markers as plain data', () => {
  const row = rowOf(timelineOf(complexConfig), 'Identity Service');
  assert.equal(row.status.short, 'LIVE');
  assert.equal(row.status.title, 'Live');
  assert.equal(row.stateIndex, 4);
  assert.ok(row.segments.length > 0);
  assert.ok(row.segments.every((s) => typeof s.left === 'number' && typeof s.width === 'number'));
  assert.ok(row.markers.every((m) => typeof m.dateText === 'string' && m.dateText.length > 0));
});

test('dependency icon: type, active flag and tooltip text for inbound, outbound and both', () => {
  const timeline = timelineOf(complexConfig, { activeDependencyGraph: 'Event Bus' });
  const eventBus = rowOf(timeline, 'Event Bus');
  assert.equal(eventBus.dependency.type, 'both');
  assert.equal(eventBus.dependency.active, true);
  assert.ok(eventBus.dependency.tooltip.startsWith('Blocked by:\nAPI Gateway (M2 → M1) — '));
  assert.ok(eventBus.dependency.tooltip.includes('\n\nBlocks:\nAdmin Portal ('));
  assert.equal(rowOf(timeline, 'Identity Service').dependency.type, 'outbound');
  assert.ok(rowOf(timeline, 'Identity Service').dependency.tooltip.startsWith('Blocks:\n'));
  assert.equal(rowOf(timeline, 'Admin Portal').dependency.type, 'inbound');
  assert.equal(rowOf(timeline, 'Admin Portal').dependency.active, false);
  assert.equal(rowOf(timeline, 'Incident Runbook').dependency, null);
});

test('the row class while a graph is open: active, highlighted or dimmed', () => {
  const timeline = timelineOf(complexConfig, { activeDependencyGraph: 'Event Bus' });
  assert.equal(rowOf(timeline, 'Event Bus').dependencyClass, 'dependency-active');
  assert.equal(rowOf(timeline, 'API Gateway').dependencyClass, 'dependency-highlight');
  assert.equal(rowOf(timeline, 'Incident Runbook').dependencyClass, 'dependency-dimmed');
  assert.equal(rowOf(timelineOf(complexConfig), 'Event Bus').dependencyClass, '');
});

test('link keeps the raw value and safeLink is null unless it is an http or https URL', () => {
  const timeline = timelineOf(complexConfig);
  assert.equal(rowOf(timeline, 'Identity Service').link, 'https://example.com/identity');
  assert.equal(rowOf(timeline, 'Identity Service').safeLink, 'https://example.com/identity');
  assert.equal(rowOf(timeline, 'Event Bus').link, null);
  assert.equal(rowOf(timeline, 'Event Bus').safeLink, null);

  const hostile = {
    ...complexConfig,
    DELIVERABLES: complexConfig.DELIVERABLES.map((d) => (d.name === 'Event Bus' ? { ...d, link: 'javascript:alert(1)' } : d)),
  };
  const row = rowOf(timelineOf(hostile), 'Event Bus');
  assert.equal(row.link, 'javascript:alert(1)');
  assert.equal(row.safeLink, null);
});

test('the model holds plain data: names with markup characters pass through unescaped', () => {
  const hostile = {
    ...complexConfig,
    DELIVERABLES: complexConfig.DELIVERABLES.map((d) => (d.name === 'Event Bus' ? { ...d, name: '<b>"x"</b>' } : d)),
  };
  const timeline = timelineOf(hostile);
  assert.equal(rowOf(timeline, '<b>"x"</b>').name, '<b>"x"</b>');
});

test('groupDeliverables, hasAnyGroups and getGroupStats keep Lite behavior', () => {
  const sources = [{ name: 'a', group: 'G', atRisk: true }, { name: 'b' }, { name: 'c', group: 'G' }];
  const { groups, ungrouped } = groupDeliverables(sources);
  assert.deepEqual(Object.keys(groups), ['G']);
  assert.deepEqual(groups.G.map((s) => s.name), ['a', 'c']);
  assert.deepEqual(ungrouped.map((s) => s.name), ['b']);
  assert.equal(hasAnyGroups(sources), true);
  assert.equal(hasAnyGroups([{ name: 'b' }]), false);
  assert.deepEqual(getGroupStats(groups.G), { total: 2, atRisk: 1 });
});

const PROTOTYPE_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

test('groupDeliverables groups names that match Object.prototype keys instead of throwing (CR-01)', () => {
  for (const name of PROTOTYPE_KEYS) {
    const sources = [{ name: 'a', group: name }, { name: 'b' }, { name: 'c', group: name }, { name: 'd', group: 'Other' }];
    const { groups, ungrouped } = groupDeliverables(sources);
    assert.deepEqual(Object.keys(groups).sort(), [name, 'Other'].sort(), name);
    assert.deepEqual(groups[name].map((s) => s.name), ['a', 'c'], name);
    assert.deepEqual(groups.Other.map((s) => s.name), ['d'], name);
    assert.deepEqual(ungrouped.map((s) => s.name), ['b'], name);
  }
});

test('buildRoadmapModel renders a group named like an Object.prototype key as a normal section (CR-01)', () => {
  for (const name of PROTOTYPE_KEYS) {
    const config = {
      ...complexConfig,
      DELIVERABLES: complexConfig.DELIVERABLES.map((d) => (d.group === 'Platform' ? { ...d, group: name } : d)),
      GROUP_ORDER: undefined,
    };
    const timeline = timelineOf(config);
    const section = timeline.sections.find((s) => s.kind === 'group' && s.name === name);
    assert.ok(section, name);
    assert.equal(section.collapsed, false, name);
    assert.ok(section.rows.length > 0, name);
  }
});

test('a group named like an Object.prototype key collapses only after it is toggled (CR-01)', () => {
  for (const name of PROTOTYPE_KEYS) {
    const config = {
      ...complexConfig,
      DELIVERABLES: complexConfig.DELIVERABLES.map((d) => (d.group === 'Platform' ? { ...d, group: name } : d)),
      GROUP_ORDER: undefined,
    };
    const find = (state) => timelineOf(config, state).sections.find((s) => s.kind === 'group' && s.name === name);
    const collapsed = toggleGroup(view(), name);
    assert.equal(find(collapsed).collapsed, true, name);
    assert.equal(find(toggleGroup(collapsed, name)).collapsed, false, name);
    assert.equal(find(collapseAllGroups(view(), [name])).collapsed, true, name);
    assert.equal(find(expandAllGroups(collapseAllGroups(view(), [name]), [name])).collapsed, false, name);
  }
});

test('groupNamesForNodes returns each group of the graph nodes once, in deliverable order', () => {
  const names = groupNamesForNodes(['Event Bus', 'Admin Portal', 'API Gateway', 'Vendor Contract Review'], complexConfig.DELIVERABLES);
  assert.deepEqual(names, ['Platform', 'Apps']);
  assert.deepEqual(groupNamesForNodes([], complexConfig.DELIVERABLES), []);
});
