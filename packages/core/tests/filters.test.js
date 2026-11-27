import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { complexWorkflow, complexDeliverables } from '../../../tests/fixtures/config.complex.js';
import { minimalWorkflow, minimalDeliverables } from '../../../tests/fixtures/config.minimal.js';

process.env.TZ = 'UTC';

const TODAY = '15/04/2026';
const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' };
const short = (list) => list.map((d) => d.name.slice(0, 12));

function filterCtx(deliverables, workflow, filter, nonFilterableGroups = []) {
  return {
    filter: { ...ALL, ...filter },
    workflow,
    today: TODAY,
    nonFilterableGroups,
    effectiveAtRiskSet: core.getEffectiveAtRiskSet(deliverables, workflow, TODAY),
    redEndpointSet: core.getRedDependencyEndpointSet(deliverables, workflow, TODAY),
  };
}

function sortCtx(deliverables, workflow, sort) {
  return {
    sort,
    workflow,
    today: TODAY,
    effectiveAtRiskSet: core.getEffectiveAtRiskSet(deliverables, workflow, TODAY),
  };
}

function row(name, extra = {}) {
  return { name, atRisk: false, showInTimeline: true, tags: [], milestones: { START: '01/01/2026' }, ...extra };
}

// --- filterDeliverables ---

test('filterDeliverables with every filter off returns every row in order', () => {
  const out = core.filterDeliverables(complexDeliverables, filterCtx(complexDeliverables, complexWorkflow, {}));
  assert.deepEqual(short(out), short(complexDeliverables));
});

test('filterDeliverables with a status filter keeps only rows in that state and drops non-filterable groups', () => {
  const ctx = filterCtx(complexDeliverables, complexWorkflow, { status: 'DEV' }, ['Ops']);
  const out = core.filterDeliverables(complexDeliverables, ctx);
  assert.ok(out.length > 0);
  for (const d of out) {
    assert.equal(core.getCurrentStatus(d, complexWorkflow, TODAY), 'DEV');
    assert.notEqual(d.group, 'Ops');
  }
  const withoutGroups = core.filterDeliverables(complexDeliverables, filterCtx(complexDeliverables, complexWorkflow, { status: 'DEV' }, []));
  assert.ok(withoutGroups.length > out.length, 'the Ops row is only dropped when its group is non-filterable');
});

test('filterDeliverables keeps non-filterable rows when the status filter is ALL', () => {
  const out = core.filterDeliverables(complexDeliverables, filterCtx(complexDeliverables, complexWorkflow, {}, ['Ops']));
  assert.equal(out.length, complexDeliverables.length);
});

test('filterDeliverables riskOnly keeps effective at-risk rows and red dependency endpoints', () => {
  const ctx = filterCtx(complexDeliverables, complexWorkflow, { riskOnly: true });
  const out = core.filterDeliverables(complexDeliverables, ctx);
  for (const d of out) {
    assert.ok(ctx.effectiveAtRiskSet.has(d.name) || ctx.redEndpointSet.has(d.name), d.name);
  }
  assert.equal(out.length, new Set([...ctx.effectiveAtRiskSet, ...ctx.redEndpointSet]).size);
});

test('filterDeliverables descopedOnly keeps only descoped rows', () => {
  const out = core.filterDeliverables(complexDeliverables, filterCtx(complexDeliverables, complexWorkflow, { descopedOnly: true }));
  assert.ok(out.length >= 1);
  assert.ok(out.every((d) => d.descoped));
});

test('filterDeliverables search matches names and tags case-insensitively without trimming', () => {
  const rows = [
    row('Alpha Service', { tags: ['Core'] }),
    row('Beta', { tags: ['edge', 'Messaging'] }),
    row('Gamma'),
  ];
  const run = (search) => core.filterDeliverables(rows, filterCtx(rows, minimalWorkflow, { search })).map((d) => d.name);
  assert.deepEqual(run('ALPHA'), ['Alpha Service']);
  assert.deepEqual(run('messaging'), ['Beta']);
  assert.deepEqual(run('core'), ['Alpha Service']);
  assert.deepEqual(run('alpha '), ['Alpha Service']);
  assert.deepEqual(run('service '), [], 'a trailing space is part of the term, not trimmed');
  assert.deepEqual(run('a s'), ['Alpha Service']);
});

test('filterDeliverables treats a row without tags as a name-only match', () => {
  const rows = [{ name: 'No Tags', atRisk: false, milestones: { START: '01/01/2026' } }];
  assert.equal(core.filterDeliverables(rows, filterCtx(rows, minimalWorkflow, { search: 'tags' })).length, 1);
  assert.equal(core.filterDeliverables(rows, filterCtx(rows, minimalWorkflow, { search: 'zzz' })).length, 0);
});

// --- empty and boundary inputs (VIEW-04) ---

test('edge (empty): an empty search returns every row, a single space only names containing a space, a one-character search is a substring match', () => {
  const rows = [row('Solo'), row('Two Words')];
  const run = (search) => core.filterDeliverables(rows, filterCtx(rows, minimalWorkflow, { search })).map((d) => d.name);
  assert.deepEqual(run(''), ['Solo', 'Two Words']);
  assert.deepEqual(run(' '), ['Two Words']);
  assert.deepEqual(run('s'), ['Solo', 'Two Words']);
  assert.deepEqual(run('w'), ['Two Words']);
});

test('edge (empty): an empty deliverable list yields [] from every filter and sort', () => {
  assert.deepEqual(core.filterDeliverables([], filterCtx([], complexWorkflow, { status: 'DEV', riskOnly: true, search: 'x' })), []);
  assert.deepEqual(core.filterBySearchOnly([], 'x'), []);
  assert.deepEqual(core.sortDeliverables([], sortCtx([], complexWorkflow, { by: 'status', order: 'desc' })), []);
});

test('edge (encoding): search folds case with toLowerCase and applies no Unicode normalization', () => {
  const rows = [row('Ärger Über Ölstand'), row('Plain Row')];
  const run = (search) => core.filterDeliverables(rows, filterCtx(rows, minimalWorkflow, { search })).map((d) => d.name);
  for (const term of ['über', 'ÜBER', 'Ärger', 'ärger']) {
    assert.deepEqual(run(term), ['Ärger Über Ölstand'], term);
  }
  assert.deepEqual(run('uber'), []);
  // A decomposed u + combining diaeresis is not the precomposed letter: no normalization is applied.
  assert.deepEqual(run('über'), []);
});

// --- filterBySearchOnly and hasSearchFilter ---

test('filterBySearchOnly trims the term and ignores every other filter', () => {
  const rows = [row('Alpha', { tags: ['core'] }), row('Beta')];
  assert.deepEqual(core.filterBySearchOnly(rows, '  ALPHA  ').map((d) => d.name), ['Alpha']);
  assert.deepEqual(core.filterBySearchOnly(rows, 'core').map((d) => d.name), ['Alpha']);
});

test('filterBySearchOnly returns the input list itself for a blank term', () => {
  const rows = [row('A')];
  assert.equal(core.filterBySearchOnly(rows, ''), rows);
  assert.equal(core.filterBySearchOnly(rows, '   '), rows);
  assert.equal(core.filterBySearchOnly(rows, undefined), rows);
});

test('hasSearchFilter is true only for a non-blank search', () => {
  assert.equal(core.hasSearchFilter({ search: 'a' }), true);
  assert.equal(core.hasSearchFilter({ search: '  ' }), false);
  assert.equal(core.hasSearchFilter({ search: '' }), false);
  assert.equal(core.hasSearchFilter({}), false);
});

// --- sortDeliverables ---

test('sortDeliverables by name uses localeCompare in both directions', () => {
  const asc = core.sortDeliverables(complexDeliverables, sortCtx(complexDeliverables, complexWorkflow, { by: 'name', order: 'asc' }));
  assert.deepEqual(short(asc).slice(0, 3), ['Admin Portal', 'API Gateway', 'Customer Ins']);
  const desc = core.sortDeliverables(complexDeliverables, sortCtx(complexDeliverables, complexWorkflow, { by: 'name', order: 'desc' }));
  assert.deepEqual(short(desc), short(asc).reverse());
});

test('sortDeliverables by status follows the workflow state order', () => {
  const asc = core.sortDeliverables(complexDeliverables, sortCtx(complexDeliverables, complexWorkflow, { by: 'status', order: 'asc' }));
  const order = core.getStates(complexWorkflow).map((s) => s.key);
  const indexes = asc.map((d) => order.indexOf(core.getCurrentStatus(d, complexWorkflow, TODAY)));
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test('sortDeliverables by m3date puts rows without a last-milestone date last ascending and first descending', () => {
  const rows = [row('No Date'), row('Late', { milestones: { START: '01/01/2026', M3: '30/06/2026' } }), row('Early', { milestones: { START: '01/01/2026', M3: '01/02/2026' } })];
  const wf = core.normalizeWorkflow({});
  const names = (order) => core.sortDeliverables(rows, sortCtx(rows, wf, { by: 'm3date', order })).map((d) => d.name);
  assert.deepEqual(names('asc'), ['Early', 'Late', 'No Date']);
  assert.deepEqual(names('desc'), ['No Date', 'Late', 'Early']);
});

test('sortDeliverables by risk puts effective at-risk rows first ascending', () => {
  const rows = [row('Calm'), row('Risky', { atRisk: true })];
  const wf = core.normalizeWorkflow({});
  const out = core.sortDeliverables(rows, sortCtx(rows, wf, { by: 'risk', order: 'asc' }));
  assert.deepEqual(out.map((d) => d.name), ['Risky', 'Calm']);
});

test('sortDeliverables never mutates its input', () => {
  const before = short(complexDeliverables);
  const out = core.sortDeliverables(complexDeliverables, sortCtx(complexDeliverables, complexWorkflow, { by: 'name', order: 'desc' }));
  assert.notEqual(out, complexDeliverables);
  assert.deepEqual(short(complexDeliverables), before);
});

test('edge (ordering): sortDeliverables is stable for equal keys, for every sort key and both orders', () => {
  const a = row('Row A', { milestones: { START: '01/01/2026', M3: '01/03/2026' } });
  const b = row('Row B', { milestones: { START: '01/01/2026', M3: '01/03/2026' } });
  const wf = core.normalizeWorkflow({});
  for (const by of ['m3date', 'status', 'risk']) {
    for (const order of ['asc', 'desc']) {
      const ctx = sortCtx([a, b], wf, { by, order });
      assert.deepEqual(core.sortDeliverables([a, b], ctx).map((d) => d.name), ['Row A', 'Row B'], `${by} ${order} [A,B]`);
      assert.deepEqual(core.sortDeliverables([b, a], ctx).map((d) => d.name), ['Row B', 'Row A'], `${by} ${order} [B,A]`);
    }
  }
});

test('sortDeliverables with an unknown sort key keeps the input order', () => {
  const out = core.sortDeliverables(minimalDeliverables, sortCtx(minimalDeliverables, minimalWorkflow, { by: 'nope', order: 'asc' }));
  assert.deepEqual(out.map((d) => d.name), minimalDeliverables.map((d) => d.name));
});
