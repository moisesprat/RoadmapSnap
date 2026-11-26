// Characterization of Lite behavior that no other test covers (RESEARCH Wave 0). Every expected value below was
// observed from the unrefactored js/ code; these tests describe today's behavior, they do not judge it.
// Tests prefixed LEGACY pin behavior that a later plan changes on purpose (02-07); the OQ1 test was flipped by 02-04.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadLite } from '../helpers/liteRender.js';
import { complexConfig, complexConfigNonFilterable } from '../fixtures/config.complex.js';

const { AppState } = await loadLite();
const w = globalThis; // window === globalThis in the harness, so Lite's window functions are bare globals here

const { validateConfig } = await import('../../js/core/configValidator.js');

function useConfig(config) {
  globalThis.CONFIG = structuredClone(config);
  AppState.reset();
}

function setFilter(patch) {
  AppState.set({ filter: { status: 'ALL', riskOnly: false, descopedOnly: false, search: '', ...patch } });
}

const short = (list) => list.map((d) => d.name.slice(0, 12));

beforeEach(() => {
  useConfig(complexConfig);
});

test('validateConfig accepts the complex fixture with no errors', () => {
  // The fixture is the parity input for later plans, so it must be a valid Lite program.
  assert.deepEqual(validateConfig(complexConfig).errors, []);
});

// --- getUpcomingMilestones ---

test('getUpcomingMilestones returns the nearest future date per milestone key with the effective at-risk flag', () => {
  // Admin Portal has atRisk:false but is blocked by the red Event Bus edge, so its flag is true (effective at risk).
  assert.deepEqual(w.getUpcomingMilestones(), {
    START: { source: 'Admin Portal', date: '01/05/2026', atRisk: true },
    M1: { source: 'Data Lake', date: '25/04/2026', atRisk: true },
    M2: { source: 'Mobile App', date: '02/05/2026', atRisk: false },
    M3: { source: 'Event Bus', date: '30/06/2026', atRisk: true },
  });
});

test('getUpcomingMilestones keeps null for a milestone key with no future date', () => {
  // Every date is before TODAY, so nothing qualifies and each key maps to null.
  useConfig({
    ...complexConfig,
    DELIVERABLES: [{ name: 'Old', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2025', M1: '01/02/2025' } }],
  });
  assert.deepEqual(w.getUpcomingMilestones(), { START: null, M1: null, M2: null, M3: null });
});

test('getUpcomingMilestones includes a milestone dated exactly TODAY (>= today)', () => {
  // The comparison is date >= today, so a date equal to TODAY is upcoming.
  useConfig({
    ...complexConfig,
    DELIVERABLES: [{ name: 'Today Row', atRisk: false, showInTimeline: true, milestones: { START: '15/04/2026' } }],
  });
  assert.deepEqual(w.getUpcomingMilestones().START, { source: 'Today Row', date: '15/04/2026', atRisk: false });
});

test('getUpcomingMilestones skips rows of non-filterable groups', () => {
  // Ops Early is the nearest START (16/04) when Ops is filterable; with Ops non-filterable it is skipped.
  const early = { name: 'Ops Early', atRisk: false, showInTimeline: true, group: 'Ops', milestones: { START: '16/04/2026' } };
  useConfig({ ...complexConfig, DELIVERABLES: [...complexConfig.DELIVERABLES, early] });
  assert.equal(w.getUpcomingMilestones().START.source, 'Ops Early');
  useConfig({ ...complexConfigNonFilterable, DELIVERABLES: [...complexConfig.DELIVERABLES, early] });
  assert.equal(w.getUpcomingMilestones().START.source, 'Admin Portal');
});

// --- filterDeliverables / filterBySearchOnly ---

test('filterDeliverables with a status filter drops rows of non-filterable groups', () => {
  // With status != ALL, non-filterable rows are removed first (Incident Runbook is DEV but its group Ops is non-filterable).
  setFilter({ status: 'DEV' });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Observabilit', 'Mobile App', 'Incident Run']);
  useConfig(complexConfigNonFilterable);
  setFilter({ status: 'DEV' });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Observabilit', 'Mobile App']);
});

test('filterDeliverables keeps non-filterable rows when the status filter is ALL', () => {
  // The non-filterable exclusion only applies once a status is chosen.
  useConfig(complexConfigNonFilterable);
  setFilter({ status: 'ALL' });
  assert.equal(w.filterDeliverables(CONFIG.DELIVERABLES).length, 13);
});

test('filterDeliverables riskOnly keeps effective at-risk rows and red dependency endpoints', () => {
  // Event Bus (atRisk flag + red endpoint), Admin Portal (blocked by red edge), Data Lake (atRisk flag).
  setFilter({ riskOnly: true });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Event Bus', 'Admin Portal', 'Data Lake']);
});

test('filterDeliverables descopedOnly keeps only descoped rows', () => {
  setFilter({ descopedOnly: true });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Observabilit']);
});

test('filterDeliverables search matches names and tags, case-insensitively, without trimming', () => {
  // 'Platform' matches only the tag on Data Lake (group names are not searched); ' platform ' keeps its spaces and matches nothing.
  setFilter({ search: 'Platform' });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Data Lake']);
  setFilter({ search: 'security' });
  assert.deepEqual(short(w.filterDeliverables(CONFIG.DELIVERABLES)), ['Identity Ser']);
  setFilter({ search: ' platform ' });
  assert.deepEqual(w.filterDeliverables(CONFIG.DELIVERABLES), []);
});

test('filterBySearchOnly trims the search term and ignores status, risk and descoped filters', () => {
  // Trimming is the difference from filterDeliverables; status DEV would otherwise remove Data Lake (status DSN).
  setFilter({ search: ' platform ', status: 'DEV', riskOnly: true });
  assert.deepEqual(short(w.filterBySearchOnly(CONFIG.DELIVERABLES)), ['Data Lake']);
});

test('filterBySearchOnly returns the input when the search is blank', () => {
  setFilter({ search: '   ' });
  assert.equal(w.filterBySearchOnly(CONFIG.DELIVERABLES), CONFIG.DELIVERABLES);
});

// --- sortDeliverables ---

const SORTS = {
  'm3date asc': ['Identity Ser', 'API Gateway', 'Web Portal', 'Event Bus', 'Observabilit', 'Admin Portal', 'Mobile App', 'Customer Ins', 'Data Lake', 'Reporting Ma', 'Incident Run', 'Vendor Contr', 'Unscheduled '],
  // Rows without an M3 date sort as 31/12/9999, so they come last ascending and first descending, in input order.
  'm3date desc': ['Observabilit', 'Admin Portal', 'Mobile App', 'Customer Ins', 'Data Lake', 'Reporting Ma', 'Incident Run', 'Vendor Contr', 'Unscheduled ', 'Event Bus', 'Web Portal', 'API Gateway', 'Identity Ser'],
  // localeCompare is case-insensitive at the first level: 'Admin Portal' < 'API Gateway'.
  'name asc': ['Admin Portal', 'API Gateway', 'Customer Ins', 'Data Lake', 'Event Bus', 'Identity Ser', 'Incident Run', 'Mobile App', 'Observabilit', 'Reporting Ma', 'Unscheduled ', 'Vendor Contr', 'Web Portal'],
  'name desc': ['Web Portal', 'Vendor Contr', 'Unscheduled ', 'Reporting Ma', 'Observabilit', 'Mobile App', 'Incident Run', 'Identity Ser', 'Event Bus', 'Data Lake', 'Customer Ins', 'API Gateway', 'Admin Portal'],
  // Status order follows workflow state order (NS, DSN, DEV, QA, LIVE).
  'status asc': ['Admin Portal', 'Unscheduled ', 'Customer Ins', 'Data Lake', 'Vendor Contr', 'Observabilit', 'Mobile App', 'Incident Run', 'Event Bus', 'Reporting Ma', 'Identity Ser', 'API Gateway', 'Web Portal'],
  'status desc': ['Identity Ser', 'API Gateway', 'Web Portal', 'Event Bus', 'Reporting Ma', 'Observabilit', 'Mobile App', 'Incident Run', 'Customer Ins', 'Data Lake', 'Vendor Contr', 'Admin Portal', 'Unscheduled '],
  // Risk ascending puts effective at-risk rows first (comparison is b - a).
  'risk asc': ['Event Bus', 'Admin Portal', 'Data Lake', 'Identity Ser', 'API Gateway', 'Observabilit', 'Web Portal', 'Mobile App', 'Customer Ins', 'Reporting Ma', 'Incident Run', 'Vendor Contr', 'Unscheduled '],
  'risk desc': ['Identity Ser', 'API Gateway', 'Observabilit', 'Web Portal', 'Mobile App', 'Customer Ins', 'Reporting Ma', 'Incident Run', 'Vendor Contr', 'Unscheduled ', 'Event Bus', 'Admin Portal', 'Data Lake'],
};

for (const [label, expected] of Object.entries(SORTS)) {
  test(`sortDeliverables ${label}`, () => {
    const [by, order] = label.split(' ');
    AppState.set({ sort: { by, order } });
    assert.deepEqual(short(w.sortDeliverables(CONFIG.DELIVERABLES)), expected);
  });
}

test('sortDeliverables does not mutate its input', () => {
  const before = short(CONFIG.DELIVERABLES);
  AppState.set({ sort: { by: 'name', order: 'desc' } });
  w.sortDeliverables(CONFIG.DELIVERABLES);
  assert.deepEqual(short(CONFIG.DELIVERABLES), before);
});

test('sortDeliverables is stable: rows with equal keys keep input order, in both input orders and both directions', () => {
  // VIEW-04 ordering. Two rows share the same M3 date and the same status; Array.prototype.sort is stable.
  const a = { name: 'Row A', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026', M3: '01/03/2026' } };
  const b = { name: 'Row B', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026', M3: '01/03/2026' } };
  for (const by of ['m3date', 'status', 'risk']) {
    for (const order of ['asc', 'desc']) {
      AppState.set({ sort: { by, order } });
      assert.deepEqual(w.sortDeliverables([a, b]).map((d) => d.name), ['Row A', 'Row B'], `${by} ${order} [A,B]`);
      assert.deepEqual(w.sortDeliverables([b, a]).map((d) => d.name), ['Row B', 'Row A'], `${by} ${order} [B,A]`);
    }
  }
});

// --- search encoding, empty and boundary inputs (VIEW-04) ---

test('search folds case with toLowerCase and applies no Unicode normalization', () => {
  // 'Ü'.toLowerCase() is 'ü', so 'über' and 'ÜBER' both match; 'uber' does not because accents are not stripped.
  useConfig({
    ...complexConfig,
    DELIVERABLES: [
      { name: 'Ärger Über Ölstand', atRisk: false, showInTimeline: true, tags: [], milestones: { START: '01/01/2026' } },
      { name: 'Plain Row', atRisk: false, showInTimeline: true, tags: [], milestones: { START: '01/01/2026' } },
    ],
  });
  for (const term of ['über', 'ÜBER', 'Ärger', 'ärger']) {
    setFilter({ search: term });
    assert.deepEqual(w.filterDeliverables(CONFIG.DELIVERABLES).map((d) => d.name), ['Ärger Über Ölstand'], term);
  }
  setFilter({ search: 'uber' });
  assert.deepEqual(w.filterDeliverables(CONFIG.DELIVERABLES), []);
});

test('an empty search returns every row and a single-space search returns only names containing a space', () => {
  // '' is falsy so the search clause is skipped; ' ' is truthy and is matched as a literal space (no trimming here).
  useConfig({
    ...complexConfig,
    DELIVERABLES: [
      { name: 'Solo', atRisk: false, showInTimeline: true, tags: [], milestones: { START: '01/01/2026' } },
      { name: 'Two Words', atRisk: false, showInTimeline: true, tags: [], milestones: { START: '01/01/2026' } },
    ],
  });
  setFilter({ search: '' });
  assert.equal(w.filterDeliverables(CONFIG.DELIVERABLES).length, 2);
  setFilter({ search: ' ' });
  assert.deepEqual(w.filterDeliverables(CONFIG.DELIVERABLES).map((d) => d.name), ['Two Words']);
});

test('filterDeliverables, sortDeliverables and calculateStats accept an empty list without throwing', () => {
  assert.deepEqual(w.filterDeliverables([]), []);
  assert.deepEqual(w.sortDeliverables([]), []);
  const stats = w.calculateStats([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.visible, 0);
  assert.equal(stats.atRisk, 0);
  assert.equal(stats.completionPercentage, 0);
  assert.equal(stats.productionReadyPercentage, 0);
  assert.deepEqual(stats.visibleByStatus, { NS: 0, DSN: 0, DEV: 0, QA: 0, LIVE: 0 });
});

test('getCurrentStatus treats a milestone dated exactly TODAY as reached', () => {
  // today >= milestoneDate, so M1 on TODAY moves the row into the state after M1 (DEV) and START on TODAY into DSN; the day after stays NS.
  assert.equal(w.getCurrentStatus({ name: 'x', milestones: { START: '01/01/2026', M1: '15/04/2026' } }), 'DEV');
  assert.equal(w.getCurrentStatus({ name: 'x', milestones: { START: '15/04/2026' } }), 'DSN');
  assert.equal(w.getCurrentStatus({ name: 'x', milestones: { START: '16/04/2026' } }), 'NS');
});

test('calculatePosition maps the first day of the range to 0 and a first-of-month date to its elapsed-day share', () => {
  const months = w.generateMonths();
  assert.equal(months.length, 18);
  assert.equal(w.calculatePosition('01/01/2025', months), 0);
  // Position is elapsed days over total days: 01/03/2025 is day 59 of the 546-day range (Jan 2025 to Jun 2026).
  assert.equal(w.calculatePosition('01/03/2025', months), 10.805860805860807);
});

// --- buildDeliverableViewModel ---

test('buildDeliverableViewModel for a dependency-heavy row matches the recorded view model', () => {
  const months = w.generateMonths();
  const todayPosition = w.calculatePosition(w.getTodayDate(), months);
  assert.equal(todayPosition, 85.8974358974359);
  const eventBus = CONFIG.DELIVERABLES.find((d) => d.name === 'Event Bus');
  const vm = w.buildDeliverableViewModel(eventBus, months, todayPosition, null);
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
  const months = w.generateMonths();
  const pos = w.calculatePosition(w.getTodayDate(), months);
  const classOf = (name) => w.buildDeliverableViewModel(CONFIG.DELIVERABLES.find((d) => d.name === name), months, pos, 'Event Bus').dependencyClass;
  assert.equal(classOf('Event Bus'), 'dependency-active');
  assert.equal(classOf('Identity Service'), 'dependency-highlight'); // inbound of an inbound
  assert.equal(classOf('Admin Portal'), 'dependency-highlight'); // outbound
  assert.equal(classOf('Data Lake'), 'dependency-dimmed');
});

// --- red dependency sets and effective at-risk ---

test('red dependency sets: only the Event Bus to Admin Portal edge is red on the complex fixture', () => {
  // from = Event Bus M3 (30/06/2026) is after Admin Portal START (01/05/2026) and not yet reached. Mobile App is orange, the rest green.
  assert.deepEqual([...w.getBlockedByRedDependencySet()], ['Admin Portal']);
  assert.deepEqual([...w.getRedDependencyEndpointSet()].sort(), ['Admin Portal', 'Event Bus']);
});

test('effective at-risk set is the config atRisk flags plus rows blocked by a red dependency', () => {
  assert.deepEqual([...w.getEffectiveAtRiskSet()].sort(), ['Admin Portal', 'Data Lake', 'Event Bus']);
});

test('dependency colors: red, orange and green on the complex fixture', () => {
  const t = '15/04/2026';
  assert.equal(w.getDependencyColorForDates('30/06/2026', '01/05/2026', t), 'red');
  assert.equal(w.getDependencyColorForDates('25/04/2026', '02/05/2026', t), 'orange'); // unfinished, 7 days of buffer
  assert.equal(w.getDependencyColorForDates('30/09/2025', '01/03/2025', t), 'green'); // from already reached
});

test('OQ1 derived keys: a workflow whose last milestone key is A5 red-blocks the dependent, because the keys come from the workflow', () => {
  // The blocker's last milestone A5 (30/06/2026) is after Q's START (01/05/2026) and not reached, so the edge is red.
  // Resolved OQ1 (02-04): the first and last milestone keys are derived from the workflow.
  // Before 02-04: no red block, because START and M3 were hard-coded, so Lite read milestones.M3 (undefined here),
  // got no from-date and colored the edge green; all three sets below were empty.
  const config = {
    TIMELINE: { TODAY: '15/04/2026', START_MONTH: '01/2026', END_MONTH: '12/2026' },
    WORKFLOW: [
      { type: 'state', key: 'NS', short: 'NS', title: 'Not Started' },
      { type: 'milestone', key: 'START', short: 'GO', title: 'Start' },
      { type: 'state', key: 'DEV', short: 'DEV', title: 'Dev' },
      { type: 'milestone', key: 'A5', short: 'A5', title: 'Last' },
      { type: 'state', key: 'DONE', short: 'DONE', title: 'Done' },
    ],
    DELIVERABLES: [
      { name: 'P', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026', A5: '30/06/2026' } },
      { name: 'Q', atRisk: false, showInTimeline: true, milestones: { START: '01/05/2026', A5: '01/09/2026' }, dependencies: ['P'] },
    ],
  };
  useConfig(config);
  assert.equal(w.getLastMilestoneKey(), 'A5');
  assert.deepEqual([...w.getBlockedByRedDependencySet()], ['Q']);
  assert.deepEqual([...w.getRedDependencyEndpointSet()].sort(), ['P', 'Q']);
  assert.deepEqual([...w.getEffectiveAtRiskSet()], ['Q']);
});

// --- calculateStats ---

test('calculateStats counts effective at-risk rows (flags plus red-blocked) and excludes descoped rows from KPIs', () => {
  // 13 rows, 1 descoped: total 12. Effective at risk: Event Bus, Admin Portal, Data Lake. Descoped is counted from the full set.
  const stats = w.calculateStats();
  assert.equal(stats.total, 12);
  assert.equal(stats.atRisk, 3);
  assert.equal(stats.descoped, 1);
  assert.equal(stats.visible, 11);
  assert.equal(stats.hidden, 1);
  assert.deepEqual(
    { NS: stats.NS, DSN: stats.DSN, DEV: stats.DEV, QA: stats.QA, LIVE: stats.LIVE },
    { NS: 2, DSN: 3, DEV: 2, QA: 2, LIVE: 3 },
  );
  assert.equal(stats.completionPercentage, 25);
  assert.equal(stats.productionReadyPercentage, 42);
});

test('calculateStats excludes rows of NON_FILTERABLE_GROUPS from every count', () => {
  // Incident Runbook (group Ops, DEV) disappears: total 11 and DEV drops from 2 to 1.
  useConfig(complexConfigNonFilterable);
  const stats = w.calculateStats();
  assert.equal(stats.total, 11);
  assert.equal(stats.DEV, 1);
  assert.equal(stats.completionPercentage, 27);
  assert.equal(stats.productionReadyPercentage, 45);
});

test('LEGACY today-override: calculateStats(deliverables, workflow, todayOverride) still reads CONFIG.TIMELINE.TODAY for the red-dependency part of atRisk', () => {
  // With today 15/04/2026 the Event Bus to Admin Portal edge is red, so atRisk would be 1. Lite ignores the override
  // there and uses CONFIG TODAY (set far in the future, so every from-date counts as reached and the edge is green): atRisk 0.
  // 02-07 flips this test.
  const rows = [
    { name: 'Blocker', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026', M3: '30/06/2026' } },
    { name: 'Blocked', atRisk: false, showInTimeline: true, milestones: { START: '01/05/2026' }, dependencies: ['Blocker'] },
  ];
  useConfig({ ...complexConfig, TIMELINE: { ...complexConfig.TIMELINE, TODAY: '01/01/2030' } });
  const stats = w.calculateStats(rows, complexConfig.WORKFLOW, '15/04/2026');
  assert.equal(stats.atRisk, 0);
  // Control: when CONFIG TODAY equals the override the edge is red and the blocked row counts as at risk.
  useConfig(complexConfig);
  assert.equal(w.calculateStats(rows, complexConfig.WORKFLOW, '15/04/2026').atRisk, 1);
});

test('calculateStats counts a row with showInTimeline undefined as visible but files it under hiddenByStatus', () => {
  // visible uses `showInTimeline !== false`, the per-status split uses truthiness: undefined passes the first and fails the second.
  const rows = [
    { name: 'Undefined flag', atRisk: false, milestones: { START: '01/01/2026' } },
    { name: 'True flag', atRisk: false, showInTimeline: true, milestones: { START: '01/01/2026' } },
  ];
  const stats = w.calculateStats(rows, complexConfig.WORKFLOW, '15/04/2026');
  assert.equal(stats.visible, 2);
  assert.equal(stats.hidden, 0);
  assert.equal(stats.visibleByStatus.DSN, 1);
  assert.equal(stats.hiddenByStatus.DSN, 1);
});
