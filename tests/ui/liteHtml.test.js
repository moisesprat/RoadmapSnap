import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLiteHTML } from '../helpers/liteRender.js';
import { minimalConfig } from '../fixtures/config.minimal.js';
import { complexConfig } from '../fixtures/config.complex.js';

const snapshotFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'lite-html-snapshots.json');

// Each case renders Lite's whole page for a fixture and a view state; the HTML is compared byte for byte.
const filter = (patch) => ({ filter: { status: 'ALL', riskOnly: false, descopedOnly: false, search: '', ...patch } });

const cases = [
  { key: 'minimal:default', config: minimalConfig, state: {} },
  { key: 'minimal:search', config: minimalConfig, state: filter({ search: 'Alpha' }) },
  { key: 'minimal:status', config: minimalConfig, state: filter({ status: 'DEV' }) },
  { key: 'minimal:riskOnly', config: minimalConfig, state: filter({ riskOnly: true }) },
  { key: 'minimal:zoom6', config: minimalConfig, state: { zoom: '6mo' } },
  { key: 'minimal:collapsed', config: minimalConfig, state: { groupCollapsed: { 'Group A': true } } },
  { key: 'minimal:graph', config: minimalConfig, state: { activeDependencyGraph: 'Task Beta' } },
  { key: 'minimal:sortDesc', config: minimalConfig, state: { sort: { by: 'name', order: 'desc' } } },
  { key: 'minimal:monochrome', config: minimalConfig, state: {}, theme: 'monochrome' },
  { key: 'complex:default', config: complexConfig, state: {} },
  { key: 'complex:search', config: complexConfig, state: filter({ search: 'Platform' }) },
  { key: 'complex:status', config: complexConfig, state: filter({ status: 'DEV' }) },
  { key: 'complex:riskOnly', config: complexConfig, state: filter({ riskOnly: true }) },
  { key: 'complex:zoom6', config: complexConfig, state: { zoom: '6mo' } },
  { key: 'complex:collapsed', config: complexConfig, state: { groupCollapsed: { Platform: true } } },
  // Event Bus has both inbound (API Gateway) and outbound (Admin Portal) dependencies.
  { key: 'complex:graph', config: complexConfig, state: { activeDependencyGraph: 'Event Bus' } },
  { key: 'complex:sortDesc', config: complexConfig, state: { sort: { by: 'name', order: 'desc' } } },
  { key: 'complex:monochrome', config: complexConfig, state: {}, theme: 'monochrome' },
];

const update = process.env.UPDATE_LITE_SNAPSHOTS === '1';

const actual = {};
for (const c of cases) {
  actual[c.key] = await renderLiteHTML(c.config, c.state, { theme: c.theme || 'light' });
}

if (update) {
  const sorted = Object.fromEntries(Object.keys(actual).sort().map((k) => [k, actual[k]]));
  fs.writeFileSync(snapshotFile, JSON.stringify(sorted, null, 2) + '\n');
}

const snapshots = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));

for (const c of cases) {
  test(`Lite HTML snapshot ${c.key}`, () => {
    assert.ok(c.key in snapshots, `snapshot missing for ${c.key}`);
    assert.ok(actual[c.key].trimStart().startsWith('<div class="filter-bar">'), 'page starts with the filter bar');
    assert.equal(actual[c.key], snapshots[c.key]);
  });
}
