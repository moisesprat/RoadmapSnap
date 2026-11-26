import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWorkflow,
  getStates,
  getMilestones,
  getStateByKey,
  getMilestoneByKey,
  getStateAfterMilestone,
  getFirstState,
  getLastState,
  getFirstMilestoneKey,
  getLastMilestoneKey,
  getNonFilterableGroups,
  isGroupNonFilterable,
  isDeliverableNonFilterable,
  getFilterableDeliverables,
  getMilestoneDate,
  getNextMilestone,
  getCurrentStatus,
} from '../src/index.js';
import { minimalWorkflow, minimalDeliverables } from '../../../tests/fixtures/config.minimal.js';
import { complexWorkflow, complexConfig, complexConfigNonFilterable } from '../../../tests/fixtures/config.complex.js';

test('normalizeWorkflow returns the WORKFLOW array of the config unchanged', () => {
  assert.equal(normalizeWorkflow({ WORKFLOW: minimalWorkflow }), minimalWorkflow);
});

test('normalizeWorkflow builds a synthetic workflow from the default legacy milestones M0..M3', () => {
  const wf = normalizeWorkflow({});
  assert.deepEqual(getMilestones(wf).map((m) => m.key), ['START', 'M0', 'M1', 'M2', 'M3']);
  assert.deepEqual(getStates(wf).map((s) => s.key), ['NS', 'DEV', 'S1', 'S2', 'S3', 'DONE']);
  assert.equal(getStates(wf).find((s) => s.key === 'S1').title, 'Phase 2');
});

test('normalizeWorkflow builds the synthetic workflow from a config MILESTONES list', () => {
  const wf = normalizeWorkflow({ MILESTONES: [{ key: 'A', short: 'A', title: 'Alpha' }, { key: 'B', short: 'B', title: 'Beta' }] });
  assert.deepEqual(getMilestones(wf).map((m) => m.key), ['START', 'A', 'B']);
  assert.equal(wf[wf.length - 1].key, 'DONE');
});

test('normalizeWorkflow ignores a WORKFLOW that is not an array', () => {
  const wf = normalizeWorkflow({ WORKFLOW: 'nope' });
  assert.equal(wf[0].key, 'NS');
});

test('getStates and getMilestones split a workflow by type in order', () => {
  assert.deepEqual(getStates(minimalWorkflow).map((s) => s.key), ['NS', 'DEV', 'DONE']);
  assert.deepEqual(getMilestones(minimalWorkflow).map((m) => m.key), ['START', 'M1']);
  assert.deepEqual(getStates(complexWorkflow).map((s) => s.key), ['NS', 'DSN', 'DEV', 'QA', 'LIVE']);
  assert.deepEqual(getMilestones(complexWorkflow).map((m) => m.key), ['START', 'M1', 'M2', 'M3']);
});

test('getStates and getMilestones return empty arrays for an empty workflow', () => {
  assert.deepEqual(getStates([]), []);
  assert.deepEqual(getMilestones([]), []);
});

test('getStateByKey and getMilestoneByKey find by key and return null otherwise', () => {
  assert.equal(getStateByKey(minimalWorkflow, 'DEV').title, 'In Development');
  assert.equal(getStateByKey(minimalWorkflow, 'START'), null);
  assert.equal(getMilestoneByKey(minimalWorkflow, 'M1').title, 'Done');
  assert.equal(getMilestoneByKey(minimalWorkflow, 'DEV'), null);
  assert.equal(getMilestoneByKey([], 'M1'), null);
});

test('getStateAfterMilestone returns the next state and null for an unknown or trailing milestone', () => {
  assert.equal(getStateAfterMilestone(minimalWorkflow, 'START').key, 'DEV');
  assert.equal(getStateAfterMilestone(minimalWorkflow, 'M1').key, 'DONE');
  assert.equal(getStateAfterMilestone(minimalWorkflow, 'NOPE'), null);
  assert.equal(getStateAfterMilestone([{ type: 'milestone', key: 'X', short: 'X', title: 'X' }], 'X'), null);
});

test('getFirstState and getLastState return the end states, with defaults for an empty workflow', () => {
  assert.equal(getFirstState(minimalWorkflow).key, 'NS');
  assert.equal(getLastState(minimalWorkflow).key, 'DONE');
  assert.equal(getFirstState([]).key, 'NS');
  assert.equal(getLastState([]).key, 'DONE');
});

test('getFirstMilestoneKey and getLastMilestoneKey read the workflow, with START and M4 as fallbacks', () => {
  assert.equal(getFirstMilestoneKey(complexWorkflow), 'START');
  assert.equal(getLastMilestoneKey(complexWorkflow), 'M3');
  assert.equal(getLastMilestoneKey(minimalWorkflow), 'M1');
  assert.equal(getFirstMilestoneKey([]), 'START');
  assert.equal(getLastMilestoneKey([]), 'M4');
});

test('the first and last keys follow a workflow whose milestones are not START and M3', () => {
  const wf = [
    { type: 'state', key: 'NS', short: 'NS', title: 'NS' },
    { type: 'milestone', key: 'K0', short: 'K0', title: 'K0' },
    { type: 'state', key: 'S', short: 'S', title: 'S' },
    { type: 'milestone', key: 'A5', short: 'A5', title: 'A5' },
  ];
  assert.equal(getFirstMilestoneKey(wf), 'K0');
  assert.equal(getLastMilestoneKey(wf), 'A5');
});

test('non-filterable group helpers use the config array, an empty list when it is missing', () => {
  assert.deepEqual(getNonFilterableGroups(complexConfigNonFilterable), ['Ops']);
  assert.deepEqual(getNonFilterableGroups(complexConfig), []);
  assert.deepEqual(getNonFilterableGroups({ NON_FILTERABLE_GROUPS: 'Ops' }), []);
  assert.equal(isGroupNonFilterable(['Ops'], 'Ops'), true);
  assert.equal(isGroupNonFilterable(['Ops'], 'Apps'), false);
  assert.equal(isGroupNonFilterable([], 'Ops'), false);
});

test('isDeliverableNonFilterable is false for a deliverable without a group', () => {
  assert.equal(isDeliverableNonFilterable(['Ops'], { group: 'Ops' }), true);
  assert.equal(isDeliverableNonFilterable(['Ops'], { group: 'Apps' }), false);
  assert.equal(isDeliverableNonFilterable(['Ops'], {}), false);
  assert.equal(isDeliverableNonFilterable(['Ops'], { group: '' }), false);
});

test('getFilterableDeliverables drops the rows of non-filterable groups', () => {
  const all = complexConfig.DELIVERABLES.length;
  assert.equal(getFilterableDeliverables(complexConfig).length, all);
  const filtered = getFilterableDeliverables(complexConfigNonFilterable);
  assert.ok(filtered.length < all);
  assert.ok(filtered.every((d) => d.group !== 'Ops'));
  assert.deepEqual(getFilterableDeliverables({ DELIVERABLES: [] }), []);
});

test('getMilestoneDate prefers the entry for the key', () => {
  assert.equal(getMilestoneDate({ milestones: { START: '01/01/2026', M1: '15/03/2026' } }, 'M1', 'START'), '15/03/2026');
});

test('getMilestoneDate falls back to startDate for the first key', () => {
  assert.equal(getMilestoneDate({ startDate: '01/01/2026' }, 'START', 'START'), '01/01/2026');
  assert.equal(getMilestoneDate({ startDate: '01/01/2026', milestones: {} }, 'START', 'START'), '01/01/2026');
});

test('getMilestoneDate returns null for a missing key and does not apply startDate to other keys', () => {
  assert.equal(getMilestoneDate({ milestones: { START: '01/01/2026' } }, 'M1', 'START'), null);
  assert.equal(getMilestoneDate({ startDate: '01/01/2026' }, 'M1', 'START'), null);
  assert.equal(getMilestoneDate({}, 'START', 'START'), null);
});

test('getMilestoneDate (D8): a first key other than START falls back to milestones.START, then startDate', () => {
  const src = { milestones: { START: '02/02/2026' }, startDate: '03/03/2026' };
  assert.equal(getMilestoneDate(src, 'K0', 'K0'), '02/02/2026');
  assert.equal(getMilestoneDate({ startDate: '03/03/2026' }, 'K0', 'K0'), '03/03/2026');
  assert.equal(getMilestoneDate({ milestones: { K0: '01/01/2026', START: '02/02/2026' } }, 'K0', 'K0'), '01/01/2026');
  // START is only an alias for the first key
  assert.equal(getMilestoneDate(src, 'M1', 'K0'), null);
});

test('getNextMilestone returns the first milestone after today, null when all have passed', () => {
  const source = minimalDeliverables[0]; // START 01/01/2026, M1 01/06/2026
  assert.equal(getNextMilestone(source, minimalWorkflow, '01/01/2026').key, 'M1');
  assert.equal(getNextMilestone(source, minimalWorkflow, '31/12/2025').key, 'START');
  assert.equal(getNextMilestone(source, minimalWorkflow, '01/06/2026'), null);
  assert.equal(getNextMilestone({ milestones: {} }, minimalWorkflow, '01/01/2026'), null);
});

test('getNextMilestone returns null when today is malformed', () => {
  assert.equal(getNextMilestone(minimalDeliverables[0], minimalWorkflow, 'garbage'), null);
});

test('getCurrentStatus walks the workflow as milestones are reached', () => {
  const source = minimalDeliverables[0]; // START 01/01/2026, M1 01/06/2026
  assert.equal(getCurrentStatus(source, minimalWorkflow, '31/12/2025'), 'NS');
  assert.equal(getCurrentStatus(source, minimalWorkflow, '15/04/2026'), 'DEV');
  assert.equal(getCurrentStatus(source, minimalWorkflow, '02/06/2026'), 'DONE');
});

test('getCurrentStatus (adjacency): a milestone dated exactly today counts as reached', () => {
  const source = { milestones: { START: '01/01/2026', M1: '15/04/2026' } };
  assert.equal(getCurrentStatus(source, minimalWorkflow, '15/04/2026'), 'DONE');
  assert.equal(getCurrentStatus(source, minimalWorkflow, '14/04/2026'), 'DEV');
  assert.equal(getCurrentStatus({ milestones: { START: '15/04/2026' } }, minimalWorkflow, '15/04/2026'), 'DEV');
});

test('getCurrentStatus returns the first state for a deliverable with no milestones and for an empty workflow', () => {
  assert.equal(getCurrentStatus({ milestones: {} }, minimalWorkflow, '15/04/2026'), 'NS');
  assert.equal(getCurrentStatus({}, minimalWorkflow, '15/04/2026'), 'NS');
  assert.equal(getCurrentStatus({ milestones: { START: '01/01/2026' } }, [], '15/04/2026'), 'NS');
});

test('getCurrentStatus returns the first state when today is malformed', () => {
  assert.equal(getCurrentStatus(minimalDeliverables[0], minimalWorkflow, ''), 'NS');
});

test('getCurrentStatus uses the START alias when the first key is not START (D8)', () => {
  const wf = [
    { type: 'state', key: 'NS', short: 'NS', title: 'NS' },
    { type: 'milestone', key: 'K0', short: 'K0', title: 'K0' },
    { type: 'state', key: 'DEV', short: 'DEV', title: 'DEV' },
  ];
  assert.equal(getCurrentStatus({ milestones: { START: '01/01/2026' } }, wf, '15/04/2026'), 'DEV');
});

test('getCurrentStatus on the complex workflow matches the recorded states for the fixture', () => {
  const byName = Object.fromEntries(complexConfig.DELIVERABLES.map((d) => [d.name, d]));
  assert.equal(getCurrentStatus(byName['Event Bus'], complexWorkflow, '15/04/2026'), 'QA');
  assert.equal(getCurrentStatus(byName['Admin Portal'], complexWorkflow, '15/04/2026'), 'NS');
});
