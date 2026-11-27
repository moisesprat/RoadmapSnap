import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';

const {
  DEFAULT_VIEW_STATE, setSearch, setSortBy, setSortOrder, setShowGantt, applyStatusFilter, toggleRiskOnly,
  toggleDescopedOnly, clearStatusFilters, resetViewState, setZoom, toggleGroup, expandAllGroups, collapseAllGroups,
  toggleDependencyGraph, closeDependencyGraph, STATUS_OUTSIDE_CLICK_EXCLUSIONS, GRAPH_OUTSIDE_CLICK_EXCLUSIONS,
} = core;

const clone = (value) => JSON.parse(JSON.stringify(value));
const fresh = () => clone(DEFAULT_VIEW_STATE);

test('DEFAULT_VIEW_STATE holds Lite defaults and is frozen all the way down', () => {
  assert.deepEqual(clone(DEFAULT_VIEW_STATE), {
    filter: { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' },
    sort: { by: 'm3date', order: 'asc' },
    zoom: 'all',
    showGantt: true,
    groupCollapsed: {},
    activeDependencyGraph: null,
  });
  assert.equal(Object.isFrozen(DEFAULT_VIEW_STATE), true);
  assert.equal(Object.isFrozen(DEFAULT_VIEW_STATE.filter), true);
  assert.equal(Object.isFrozen(DEFAULT_VIEW_STATE.sort), true);
  assert.equal(Object.isFrozen(DEFAULT_VIEW_STATE.groupCollapsed), true);
});

test('setSearch, setSortBy, setSortOrder and setShowGantt change one field and keep the rest', () => {
  const state = fresh();
  assert.equal(setSearch(state, 'abc').filter.search, 'abc');
  assert.equal(setSearch(state, 'abc').filter.status, 'ALL');
  assert.deepEqual(setSortBy(state, 'name').sort, { by: 'name', order: 'asc' });
  assert.deepEqual(setSortOrder(state, 'desc').sort, { by: 'm3date', order: 'desc' });
  assert.equal(setShowGantt(state, false).showGantt, false);
  assert.equal(setShowGantt(state, false).zoom, 'all');
});

test('applyStatusFilter sets the status, clears the risk and descoped toggles, and toggles back to ALL on the same status', () => {
  const state = { ...fresh(), filter: { status: 'ALL', riskOnly: true, descopedOnly: false, search: 'x' } };
  const dev = applyStatusFilter(state, 'DEV');
  assert.deepEqual(dev.filter, { status: 'DEV', riskOnly: false, descopedOnly: false, search: 'x' });
  assert.equal(applyStatusFilter(dev, 'DEV').filter.status, 'ALL');
  assert.equal(applyStatusFilter(dev, 'QA').filter.status, 'QA');
});

test('toggleRiskOnly flips riskOnly and clears descopedOnly; toggleDescopedOnly is symmetric', () => {
  const both = { ...fresh(), filter: { status: 'DEV', riskOnly: false, descopedOnly: true, search: '' } };
  const risk = toggleRiskOnly(both);
  assert.deepEqual(risk.filter, { status: 'DEV', riskOnly: true, descopedOnly: false, search: '' });
  assert.equal(toggleRiskOnly(risk).filter.riskOnly, false);
  const descoped = toggleDescopedOnly(risk);
  assert.deepEqual(descoped.filter, { status: 'DEV', riskOnly: false, descopedOnly: true, search: '' });
  assert.equal(toggleDescopedOnly(descoped).filter.descopedOnly, false);
});

test('clearStatusFilters keeps the search and resets the other three fields; with nothing to clear it returns the same object', () => {
  const state = { ...fresh(), filter: { status: 'DEV', riskOnly: true, descopedOnly: false, search: 'keep' } };
  assert.deepEqual(clearStatusFilters(state).filter, { status: 'ALL', riskOnly: false, descopedOnly: false, search: 'keep' });
  const clean = { ...fresh(), filter: { ...DEFAULT_VIEW_STATE.filter, search: 'keep' } };
  assert.equal(clearStatusFilters(clean), clean);
});

test('resetViewState equals the defaults plus the current theme, with fresh nested objects', () => {
  const state = { ...fresh(), theme: 'dark', zoom: '6mo', groupCollapsed: { A: true }, filter: { status: 'DEV', riskOnly: true, descopedOnly: false, search: 'q' } };
  const reset = resetViewState(state);
  assert.deepEqual(reset, { ...clone(DEFAULT_VIEW_STATE), theme: 'dark' });
  assert.notEqual(reset.filter, DEFAULT_VIEW_STATE.filter);
  assert.notEqual(reset.groupCollapsed, DEFAULT_VIEW_STATE.groupCollapsed);
  assert.equal(Object.isFrozen(reset.filter), false);
});

test('setZoom stores "<n>mo" or "all" and closes the dependency graph', () => {
  const state = { ...fresh(), activeDependencyGraph: 'Task A' };
  assert.equal(setZoom(state, 6).zoom, '6mo');
  assert.equal(setZoom(state, 6).activeDependencyGraph, null);
  assert.equal(setZoom(state, 'all').zoom, 'all');
  assert.equal(setZoom(state, 'all').activeDependencyGraph, null);
});

test('toggleGroup flips one group flag and keeps the others', () => {
  const state = { ...fresh(), groupCollapsed: { A: true } };
  assert.deepEqual(toggleGroup(state, 'A').groupCollapsed, { A: false });
  assert.deepEqual(toggleGroup(state, 'B').groupCollapsed, { A: true, B: true });
});

test('expandAllGroups and collapseAllGroups set every listed group, keeping unlisted flags', () => {
  const state = { ...fresh(), groupCollapsed: { Z: true } };
  assert.deepEqual(expandAllGroups(state, ['A', 'B']).groupCollapsed, { Z: true, A: false, B: false });
  assert.deepEqual(collapseAllGroups({ ...state, groupCollapsed: { A: false, Z: false } }, ['A', 'B']).groupCollapsed, { Z: false, A: true, B: true });
});

test('toggleDependencyGraph opens a graph, expands the given groups and resets the filter; the same name closes it', () => {
  const state = {
    ...fresh(),
    groupCollapsed: { Platform: true, Apps: true },
    filter: { status: 'DEV', riskOnly: true, descopedOnly: false, search: 'q' },
  };
  const open = toggleDependencyGraph(state, 'Event Bus', ['Platform']);
  assert.equal(open.activeDependencyGraph, 'Event Bus');
  assert.deepEqual(open.groupCollapsed, { Platform: false, Apps: true });
  assert.deepEqual(open.filter, { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' });
  const closed = toggleDependencyGraph(open, 'Event Bus', ['Platform']);
  assert.equal(closed.activeDependencyGraph, null);
  assert.deepEqual(closed.filter, open.filter);
  assert.equal(closeDependencyGraph(open).activeDependencyGraph, null);
});

test('transitions never mutate their input', () => {
  const state = { ...fresh(), groupCollapsed: { A: true }, activeDependencyGraph: 'X' };
  const before = JSON.stringify(state);
  setSearch(state, 'q'); setSortBy(state, 'name'); setSortOrder(state, 'desc'); setShowGantt(state, false);
  applyStatusFilter(state, 'DEV'); toggleRiskOnly(state); toggleDescopedOnly(state); clearStatusFilters(state);
  resetViewState(state); setZoom(state, 3); toggleGroup(state, 'A'); expandAllGroups(state, ['A']);
  collapseAllGroups(state, ['B']); toggleDependencyGraph(state, 'Y', ['A']); closeDependencyGraph(state);
  assert.equal(JSON.stringify(state), before);
});

test('the outside-click exclusion lists are the selectors Lite used, verbatim', () => {
  assert.equal(STATUS_OUTSIDE_CLICK_EXCLUSIONS, '.kpi-card.clickable, .risk-summary.clickable, .descoped-summary.clickable, .filter-bar, .export-controls, .info-link, .data-source-row');
  assert.equal(GRAPH_OUTSIDE_CLICK_EXCLUSIONS, '.dependency-icon, .data-source-row, .filter-bar, .filter-toggle, button, select');
});
