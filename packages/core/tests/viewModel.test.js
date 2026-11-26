import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { complexWorkflow, complexDeliverables } from '../../../tests/fixtures/config.complex.js';
import { minimalWorkflow, minimalDeliverables } from '../../../tests/fixtures/config.minimal.js';

process.env.TZ = 'UTC';

const TODAY = '15/04/2026';
const months = core.generateMonths('01/2025', '06/2026');
const todayPosition = core.calculatePosition(TODAY, months);

function ctx(extra = {}) {
  return {
    months,
    todayPosition,
    activeDependencyGraph: null,
    effectiveAtRiskSet: core.getEffectiveAtRiskSet(complexDeliverables, complexWorkflow, TODAY),
    workflow: complexWorkflow,
    deliverables: complexDeliverables,
    today: TODAY,
    theme: 'light',
    ...extra,
  };
}

const eventBus = complexDeliverables.find((d) => d.name === 'Event Bus');

// --- buildDeliverableViewModel ---

test('buildDeliverableViewModel for a dependency-heavy row matches the recorded Lite view model', () => {
  assert.equal(todayPosition, 85.8974358974359);
  const vm = core.buildDeliverableViewModel(eventBus, ctx());
  assert.deepEqual(JSON.parse(JSON.stringify(vm)), {
    name: 'Event Bus',
    group: 'Platform',
    status: 'QA',
    state: { type: 'state', key: 'QA', short: 'QA', title: 'Quality Assurance', description: 'Verification' },
    stateColor: '#ffab00',
    stateTextColor: '#172b4d',
    atRisk: true,
    descoped: false,
    showInTimeline: true,
    link: null,
    tags: ['core', 'messaging'],
    milestoneMarkers: [
      { position: 44.505494505494504, slotClass: 'start', short: 'GO', date: '01/09/2025', hideLabel: false },
      { position: 61.172161172161175, slotClass: 'm0', short: 'M1', date: '01/12/2025', hideLabel: false },
      { position: 77.65567765567766, slotClass: 'm1', short: 'M2', date: '01/03/2026', hideLabel: false },
      { position: 99.81684981684981, slotClass: 'm2', short: 'M3', date: '30/06/2026', hideLabel: false },
    ],
    ganttSegments: [
      { left: 44.505494505494504, width: 16.66666666666667, segmentClass: 'segment-start', isFuture: false },
      { left: 61.172161172161175, width: 16.48351648351649, segmentClass: 'segment-m0', isFuture: false },
      { left: 77.65567765567766, width: 8.241758241758234, segmentClass: 'segment-m1', isFuture: false },
      { left: 85.8974358974359, width: 13.919413919413913, segmentClass: 'segment-m1', isFuture: true },
    ],
    dependencyType: 'both',
    dependencyClass: '',
    inboundDeps: [{ task: 'API Gateway', from: 'M2', to: 'M1' }],
    outboundDeps: [{ task: 'Admin Portal', from: null, to: null }],
  });
});

test('buildDeliverableViewModel marks the active graph node, its relatives and everything else', () => {
  const classOf = (name) => core.buildDeliverableViewModel(complexDeliverables.find((d) => d.name === name), ctx({ activeDependencyGraph: 'Event Bus' })).dependencyClass;
  assert.equal(classOf('Event Bus'), 'dependency-active');
  assert.equal(classOf('Identity Service'), 'dependency-highlight');
  assert.equal(classOf('Admin Portal'), 'dependency-highlight');
  assert.equal(classOf('Data Lake'), 'dependency-dimmed');
});

test('buildDeliverableViewModel computes the effective at-risk set when the context omits it', () => {
  const { effectiveAtRiskSet, ...rest } = ctx();
  assert.equal(core.buildDeliverableViewModel(eventBus, rest).atRisk, true);
  assert.equal(core.buildDeliverableViewModel(complexDeliverables.find((d) => d.name === 'Web Portal'), rest).atRisk, false);
});

test('buildDeliverableViewModel defaults tags, group and link for a bare row and reports a descoped row', () => {
  const bare = { name: 'Bare', descoped: true, showInTimeline: false, milestones: {} };
  const vm = core.buildDeliverableViewModel(bare, ctx({ deliverables: [bare] }));
  assert.deepEqual([vm.tags, vm.group, vm.link, vm.descoped, vm.showInTimeline], [[], null, null, true, false]);
  assert.deepEqual(vm.milestoneMarkers, []);
  assert.deepEqual(vm.ganttSegments, []);
});

test('buildDeliverableViewModel takes the state color from the given theme', () => {
  assert.equal(core.buildDeliverableViewModel(eventBus, ctx({ theme: 'monochrome' })).stateColor, '#9e9e9e');
  assert.equal(core.buildDeliverableViewModel(eventBus, ctx({ theme: 'evergreen' })).stateColor, '#6cbe4c');
});

// --- resolveStateColor and resolveStateTextColor ---

test('resolveStateColor returns the monochrome, papallona and evergreen palettes for those themes', () => {
  assert.equal(core.resolveStateColor('monochrome', complexWorkflow, 'NS'), '#e8e8e8');
  assert.equal(core.resolveStateColor('monochrome', complexWorkflow, 'LIVE'), '#858585');
  assert.equal(core.resolveStateColor('papallona', complexWorkflow, 'NS'), '#94a3b8');
  assert.equal(core.resolveStateColor('papallona', complexWorkflow, 'LIVE'), '#15803d');
  assert.equal(core.resolveStateColor('evergreen', complexWorkflow, 'NS'), '#cccccc');
  assert.equal(core.resolveStateColor('evergreen', complexWorkflow, 'LIVE'), '#cbd938');
});

test('resolveStateColor uses the light palette for light, dark, professional, colorful, blank and unknown themes', () => {
  for (const theme of ['light', 'dark', 'professional', 'colorful', 'blank', 'nonsense', undefined, null]) {
    assert.equal(core.resolveStateColor(theme, complexWorkflow, 'NS'), '#c1c7d0', String(theme));
    assert.equal(core.resolveStateColor(theme, complexWorkflow, 'QA'), '#ffab00', String(theme));
  }
});

test('resolveStateColor falls back to index 0 for an unknown state key and caps the index at 7', () => {
  assert.equal(core.resolveStateColor('light', complexWorkflow, 'MISSING'), '#c1c7d0');
  const many = [
    ...Array.from({ length: 10 }, (_, i) => ({ type: 'state', key: `S${i}`, short: `S${i}`, title: `S${i}` })),
    { type: 'milestone', key: 'START', short: 'GO', title: 'Start' },
  ];
  assert.equal(core.resolveStateColor('light', many, 'S9'), '#004cbf');
});

test('resolveStateTextColor picks dark text on light fills and white on dark fills, with a dark default', () => {
  assert.equal(core.resolveStateTextColor('#ffab00'), '#172b4d');
  assert.equal(core.resolveStateTextColor('#0b3c56'), 'white');
  assert.equal(core.resolveStateTextColor('#fff'), '#172b4d');
  assert.equal(core.resolveStateTextColor('000'), 'white');
  assert.equal(core.resolveStateTextColor('#12'), '#172b4d');
  assert.equal(core.resolveStateTextColor(''), '#172b4d');
  assert.equal(core.resolveStateTextColor(undefined), '#172b4d');
});

// --- markers, segments, dependency class ---

test('buildMilestoneMarkers keeps only the last of markers closer than 2 percent and hides labels left of 2 percent', () => {
  const milestones = core.getMilestones(minimalWorkflow);
  const closeMonths = core.generateMonths('01/2026', '12/2026');
  const source = { name: 'X', milestones: { START: '01/01/2026', M1: '02/01/2026' } };
  const markers = core.buildMilestoneMarkers(source, closeMonths, milestones, 'START');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].short, 'M1');
  assert.equal(markers[0].hideLabel, true);
  assert.deepEqual(core.buildMilestoneMarkers({ name: 'Y', milestones: {} }, closeMonths, milestones, 'START'), []);
});

test('buildMilestoneMarkers labels the first milestone with its short name, or GO when the definition is missing', () => {
  const source = { name: 'X', milestones: { START: '01/03/2026' } };
  const m = core.generateMonths('01/2026', '12/2026');
  assert.equal(core.buildMilestoneMarkers(source, m, core.getMilestones(minimalWorkflow), 'START')[0].short, 'GO');
  assert.equal(core.buildMilestoneMarkers(source, m, [], 'START')[0].short, 'GO');
});

test('buildGanttSegments splits a bar at today into past and future parts and skips empty ranges', () => {
  const milestones = core.getMilestones(minimalWorkflow);
  const m = core.generateMonths('01/2026', '12/2026');
  const pos = core.calculatePosition(TODAY, m);
  const source = minimalDeliverables[0];
  const segs = core.buildGanttSegments(source, m, pos, milestones, 'START');
  assert.deepEqual(segs.map((s) => [s.segmentClass, s.isFuture]), [['segment-start', false], ['segment-start', true]]);
  assert.equal(segs[1].left, pos);
  assert.deepEqual(core.buildGanttSegments({ name: 'Z', milestones: {} }, m, pos, milestones, 'START'), []);
});

test('buildDependencyClass is empty without a graph, active for the root, highlight for relatives and dimmed otherwise', () => {
  const graph = core.getDependencyGraph('Event Bus', complexDeliverables);
  assert.equal(core.buildDependencyClass(null, 'Event Bus'), '');
  assert.equal(core.buildDependencyClass(graph, 'Event Bus'), 'dependency-active');
  assert.equal(core.buildDependencyClass(graph, 'Admin Portal'), 'dependency-highlight');
  assert.equal(core.buildDependencyClass(graph, 'Data Lake'), 'dependency-dimmed');
});

test('edge (empty): the view model of a row with no dependencies and a lone deliverable list builds without throwing', () => {
  const row = { name: 'Solo', milestones: { START: '01/03/2026' } };
  const vm = core.buildDeliverableViewModel(row, ctx({ deliverables: [row], effectiveAtRiskSet: new Set() }));
  assert.deepEqual([vm.name, vm.dependencyType, vm.inboundDeps, vm.outboundDeps], ['Solo', 'none', [], []]);
});
