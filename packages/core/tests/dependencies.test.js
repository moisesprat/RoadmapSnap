import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { minimalWorkflow, minimalDeliverables } from '../../../tests/fixtures/config.minimal.js';
import { complexWorkflow, complexDeliverables } from '../../../tests/fixtures/config.complex.js';

const TODAY = '15/04/2026';

// A workflow whose milestones are START, A0 ... A5: neither the first nor the last key is the Lite default pair START/M3.
const a5Workflow = [
  { type: 'state', key: 'NS', short: 'NS', title: 'Not Started' },
  { type: 'milestone', key: 'START', short: 'GO', title: 'Start' },
  ...['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].flatMap((key, i) => [
    { type: 'state', key: `S${i}`, short: `S${i}`, title: `State ${i}` },
    { type: 'milestone', key, short: key, title: key },
  ]),
  { type: 'state', key: 'DONE', short: 'DONE', title: 'Done' },
];

const names = (set) => [...set].sort();

// --- normalization and inbound lookups ---

test('normalizeDependency turns a string into an object with null from and to', () => {
  assert.deepEqual(core.normalizeDependency('A'), { task: 'A', from: null, to: null });
});

test('normalizeDependency keeps from and to of an object entry and nulls missing ones', () => {
  assert.deepEqual(core.normalizeDependency({ task: 'A', from: 'M2', to: 'M1' }), { task: 'A', from: 'M2', to: 'M1' });
  assert.deepEqual(core.normalizeDependency({ task: 'A' }), { task: 'A', from: null, to: null });
});

test('getDependencyTaskName reads both entry shapes', () => {
  assert.equal(core.getDependencyTaskName('A'), 'A');
  assert.equal(core.getDependencyTaskName({ task: 'B', from: 'M1' }), 'B');
});

test('getInboundDependencies and getInboundDependencyNames normalize string and object entries', () => {
  const source = { name: 'X', dependencies: ['A', { task: 'B', from: 'M1', to: 'M2' }] };
  assert.deepEqual(core.getInboundDependencies(source), [
    { task: 'A', from: null, to: null },
    { task: 'B', from: 'M1', to: 'M2' },
  ]);
  assert.deepEqual(core.getInboundDependencyNames(source), ['A', 'B']);
  assert.deepEqual(core.getInboundDependencies({ name: 'Y' }), []);
  assert.deepEqual(core.getInboundDependencyNames({ name: 'Y' }), []);
});

// --- outbound lookups, hasDependencies, getDependencyType ---

test('getOutboundDependencies lists the dependents of a deliverable with the milestone keys of the edge', () => {
  const rows = [
    { name: 'A' },
    { name: 'B', dependencies: [{ task: 'A', from: 'M2', to: 'M1' }] },
    { name: 'C', dependencies: ['A'] },
  ];
  assert.deepEqual(core.getOutboundDependencies(rows[0], rows), [
    { task: 'B', from: 'M2', to: 'M1' },
    { task: 'C', from: null, to: null },
  ]);
  assert.deepEqual(core.getOutboundDependencyNames(rows[0], rows), ['B', 'C']);
  assert.deepEqual(core.getOutboundDependencies(rows[1], rows), []);
});

test('hasDependencies is true for inbound or outbound links and false for an isolated row', () => {
  const [alpha, beta, gamma] = minimalDeliverables;
  assert.equal(core.hasDependencies(alpha, minimalDeliverables), true); // outbound: Beta depends on it
  assert.equal(core.hasDependencies(beta, minimalDeliverables), true); // inbound
  assert.equal(core.hasDependencies(gamma, minimalDeliverables), false);
});

test('getDependencyType returns inbound, outbound, both and none', () => {
  const [alpha, beta, gamma] = minimalDeliverables;
  assert.equal(core.getDependencyType(alpha, minimalDeliverables), 'outbound');
  assert.equal(core.getDependencyType(beta, minimalDeliverables), 'inbound');
  assert.equal(core.getDependencyType(gamma, minimalDeliverables), 'none');
  const eventBus = complexDeliverables.find((d) => d.name === 'Event Bus');
  assert.equal(core.getDependencyType(eventBus, complexDeliverables), 'both');
});

test('getDependencyType returns none for a deliverable with no dependencies in either direction, with an empty list too', () => {
  assert.equal(core.getDependencyType({ name: 'Solo' }, []), 'none');
  assert.equal(core.hasDependencies({ name: 'Solo' }, []), false);
  assert.deepEqual(core.getOutboundDependencies({ name: 'Solo' }, []), []);
  assert.deepEqual(core.getOutboundDependencyNames({ name: 'Solo' }, []), []);
});

// --- getDependencyGraph ---

test('getDependencyGraph with no CONFIG defined includes outbound nodes found in the passed deliverables (D11)', () => {
  assert.equal(typeof globalThis.CONFIG, 'undefined');
  const rows = [
    { name: 'A' },
    { name: 'B', dependencies: ['A'] },
    { name: 'C', dependencies: ['B'] },
  ];
  const graph = core.getDependencyGraph('A', rows);
  assert.ok(Array.isArray(graph.nodes));
  assert.deepEqual(graph.nodes.slice().sort(), ['A', 'B', 'C']);
  assert.deepEqual(graph.outboundEdges, [
    { from: 'A', to: 'B', fromMilestone: null, toMilestone: null },
    { from: 'B', to: 'C', fromMilestone: null, toMilestone: null },
  ]);
  assert.deepEqual(graph.inboundEdges, []);
});

test('getDependencyGraph walks inbound edges and keeps explicit and null milestone keys', () => {
  const graph = core.getDependencyGraph('Event Bus', complexDeliverables);
  assert.deepEqual(graph.nodes.slice().sort(), ['API Gateway', 'Admin Portal', 'Event Bus', 'Identity Service']);
  assert.deepEqual(graph.inboundEdges.find((e) => e.from === 'API Gateway'), {
    from: 'API Gateway', to: 'Event Bus', fromMilestone: 'M2', toMilestone: 'M1',
  });
  assert.deepEqual(graph.outboundEdges.find((e) => e.to === 'Admin Portal'), {
    from: 'Event Bus', to: 'Admin Portal', fromMilestone: null, toMilestone: null,
  });
});

test('getDependencyGraph returns empty nodes and edges for an unknown name or an empty list', () => {
  assert.deepEqual(core.getDependencyGraph('Nope', complexDeliverables), { nodes: [], inboundEdges: [], outboundEdges: [] });
  assert.deepEqual(core.getDependencyGraph('A', []), { nodes: [], inboundEdges: [], outboundEdges: [] });
});

test('getDependencyGraph terminates on circular dependencies and visits every node once', () => {
  const circular = [
    { name: 'A', dependencies: ['B'] },
    { name: 'B', dependencies: ['A'] },
  ];
  const graph = core.getDependencyGraph('A', circular);
  assert.deepEqual(graph.nodes.slice().sort(), ['A', 'B']);
  assert.ok(graph.inboundEdges.length >= 1);
});

test('getDependencyGraph includes a self-dependency as a node of itself', () => {
  const graph = core.getDependencyGraph('A', [{ name: 'A', dependencies: ['A'] }]);
  assert.deepEqual(graph.nodes, ['A']);
});

// --- colors ---

test('getDependencyColorForDates is green when the from-milestone is reached, including exactly today (adjacency)', () => {
  assert.equal(core.getDependencyColorForDates('15/04/2026', '16/04/2026', TODAY), 'green');
  assert.equal(core.getDependencyColorForDates(TODAY, '20/04/2026', TODAY), 'green');
  assert.equal(core.getDependencyColorForDates('01/01/2026', '01/02/2026', TODAY), 'green');
});

test('getDependencyColorForDates is red when an unfinished from-date is after the to-date', () => {
  assert.equal(core.getDependencyColorForDates('30/06/2026', '01/05/2026', TODAY), 'red');
});

test('getDependencyColorForDates is orange within 10 days of the target and green beyond', () => {
  assert.equal(core.getDependencyColorForDates('25/04/2026', '02/05/2026', TODAY), 'orange');
  assert.equal(core.getDependencyColorForDates('20/04/2026', '30/04/2026', TODAY), 'orange'); // exactly 10 days
  assert.equal(core.getDependencyColorForDates('20/04/2026', '01/05/2026', TODAY), 'green'); // 11 days
});

test('getDependencyColorForDates is green when either date is missing or malformed, and accepts Date arguments', () => {
  assert.equal(core.getDependencyColorForDates(null, '01/05/2026', TODAY), 'green');
  assert.equal(core.getDependencyColorForDates('01/05/2026', '', TODAY), 'green');
  assert.equal(core.getDependencyColorForDates('garbage', '01/05/2026', TODAY), 'green');
  assert.equal(core.getDependencyColorForDates(new Date(2026, 5, 30), new Date(2026, 4, 1), new Date(2026, 3, 15)), 'red');
});

// --- red sets and effective at risk ---

test('red sets on the complex workflow equal the values pinned by the characterization test', () => {
  assert.deepEqual(names(core.getBlockedByRedDependencySet(complexDeliverables, complexWorkflow, TODAY)), ['Admin Portal']);
  assert.deepEqual(names(core.getRedDependencyEndpointSet(complexDeliverables, complexWorkflow, TODAY)), ['Admin Portal', 'Event Bus']);
  assert.deepEqual(names(core.getEffectiveAtRiskSet(complexDeliverables, complexWorkflow, TODAY)), ['Admin Portal', 'Data Lake', 'Event Bus']);
});

test('OQ1: with milestones START, A0..A5 the default from-key is A5 and the default to-key is START', () => {
  const rows = [
    { name: 'P', atRisk: false, milestones: { START: '01/01/2026', A5: '30/06/2026' } },
    { name: 'Q', atRisk: false, milestones: { START: '01/05/2026', A5: '01/09/2026' }, dependencies: ['P'] },
  ];
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, a5Workflow, TODAY)), ['Q']);
  assert.deepEqual(names(core.getRedDependencyEndpointSet(rows, a5Workflow, TODAY)), ['P', 'Q']);
  assert.deepEqual(names(core.getEffectiveAtRiskSet(rows, a5Workflow, TODAY)), ['Q']);
});

test('OQ1: a first milestone key other than START is the default to-key', () => {
  const wf = [
    { type: 'state', key: 'NS', short: 'NS', title: 'NS' },
    { type: 'milestone', key: 'K0', short: 'K0', title: 'K0' },
    { type: 'state', key: 'S', short: 'S', title: 'S' },
    { type: 'milestone', key: 'K9', short: 'K9', title: 'K9' },
    { type: 'state', key: 'DONE', short: 'DONE', title: 'DONE' },
  ];
  const rows = [
    { name: 'P', milestones: { K0: '01/01/2026', K9: '30/06/2026' } },
    { name: 'Q', milestones: { K0: '01/05/2026', K9: '01/09/2026' }, dependencies: ['P'] },
  ];
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, wf, TODAY)), ['Q']);
});

test('an edge with explicit from and to keys overrides the workflow defaults', () => {
  const rows = [
    { name: 'P', milestones: { START: '01/01/2026', A2: '30/06/2026', A5: '01/02/2026' } },
    { name: 'Q', milestones: { START: '01/05/2026', A1: '01/07/2026' }, dependencies: [{ task: 'P', from: 'A2', to: 'A1' }] },
  ];
  // A2 (30/06) is before A1 (01/07) and not reached: orange (1 day), not red
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, a5Workflow, TODAY)), []);
});

test('an unfinished from-date after the to-date is red, a reached from-date is not (today moves the result)', () => {
  const rows = [
    { name: 'P', milestones: { START: '01/01/2026', M1: '30/06/2026' } },
    { name: 'Q', milestones: { START: '01/05/2026', M1: '01/09/2026' }, dependencies: ['P'] },
  ];
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, minimalWorkflow, TODAY)), ['Q']);
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, minimalWorkflow, '01/07/2026')), []);
});

test('the START alias and startDate supply the first-key date through the shared getMilestoneDate (D8)', () => {
  const rows = [
    { name: 'P', milestones: { M1: '30/06/2026' }, startDate: '01/01/2026' },
    { name: 'Q', milestones: { M1: '01/09/2026' }, startDate: '01/05/2026', dependencies: ['P'] },
  ];
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, minimalWorkflow, TODAY)), ['Q']);
});

test('a dependency on an unknown deliverable, or a date that is missing, creates no red edge', () => {
  const rows = [
    { name: 'Q', milestones: { START: '01/05/2026' }, dependencies: ['Ghost'] },
    { name: 'R', milestones: { START: '01/05/2026' }, dependencies: ['Q'] },
  ];
  assert.deepEqual(names(core.getBlockedByRedDependencySet(rows, minimalWorkflow, TODAY)), []);
  assert.deepEqual(names(core.getRedDependencyEndpointSet(rows, minimalWorkflow, TODAY)), []);
});

test('getEffectiveAtRiskSet is the atRisk flags plus the red-blocked rows', () => {
  const rows = [
    { name: 'P', atRisk: true, milestones: { START: '01/01/2026', M1: '30/06/2026' } },
    { name: 'Q', atRisk: false, milestones: { START: '01/05/2026' }, dependencies: ['P'] },
    { name: 'R', atRisk: false, milestones: { START: '01/01/2026' } },
  ];
  assert.deepEqual(names(core.getEffectiveAtRiskSet(rows, minimalWorkflow, TODAY)), ['P', 'Q']);
});

test('every function returns an empty result without throwing for an empty deliverable list', () => {
  assert.equal(core.getBlockedByRedDependencySet([], minimalWorkflow, TODAY).size, 0);
  assert.equal(core.getRedDependencyEndpointSet([], minimalWorkflow, TODAY).size, 0);
  assert.equal(core.getEffectiveAtRiskSet([], minimalWorkflow, TODAY).size, 0);
  assert.equal(core.getBlockedByRedDependencySet([], [], TODAY).size, 0);
});
