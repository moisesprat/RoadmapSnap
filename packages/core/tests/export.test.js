import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../src/index.js';
import { loadLite } from '../../../tests/helpers/liteRender.js';
import { minimalConfig } from '../../../tests/fixtures/config.minimal.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';
import { roadmapToApi } from '../../../tests/helpers/roadmapToApi.js';

process.env.TZ = 'UTC';

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_FILE = path.resolve(here, '../../../tests/fixtures/lite-export-snapshots.json');
const update = process.env.UPDATE_LITE_SNAPSHOTS === '1';
const NOW = '2026-04-15T12:00:00.000Z';

const FIXTURES = { minimal: minimalConfig, complex: complexConfig };

// Runs one of Lite's window export functions against a config and returns the bytes handed to downloadFile.
async function liteExport(config, fn) {
  await loadLite();
  globalThis.CONFIG = structuredClone(config);
  const captured = [];
  const realBlob = globalThis.Blob;
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  const realCreateElement = globalThis.document.createElement;
  globalThis.Blob = class {
    constructor(parts, opts) {
      this.content = parts.join('');
      this.type = opts && opts.type;
    }
  };
  URL.createObjectURL = (blob) => { captured.push({ content: blob.content, type: blob.type }); return 'blob:stub'; };
  URL.revokeObjectURL = () => {};
  globalThis.document.createElement = () => ({
    click() {},
    set download(name) { captured[captured.length - 1].filename = name; },
    set href(_) {},
  });
  try {
    globalThis.window[fn]();
  } finally {
    globalThis.Blob = realBlob;
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
    globalThis.document.createElement = realCreateElement;
  }
  assert.equal(captured.length, 1, fn + ' downloads exactly one file');
  return captured[0];
}

// exportDate is the only clock-dependent value: replace it, keep key order and the 2-space format.
function pinExportDate(jsonText) {
  const parsed = JSON.parse(jsonText);
  parsed.exportDate = NOW;
  return JSON.stringify(parsed, null, 2);
}

async function liteOutputs(config) {
  const csv = await liteExport(config, 'exportToCSV');
  const json = await liteExport(config, 'exportToJSON');
  return { csv, json: { ...json, content: pinExportDate(json.content) } };
}

// --- Characterization of Lite's bytes (generated against the pre-core code, then guarded) ---
test('lite export snapshots: CSV and JSON bytes for both fixtures match tests/fixtures/lite-export-snapshots.json', async () => {
  const actual = {};
  for (const [name, config] of Object.entries(FIXTURES)) {
    const out = await liteOutputs(config);
    actual[name + '.csv'] = out.csv.content;
    actual[name + '.json'] = out.json.content;
    assert.equal(out.csv.filename, 'deliverables.csv');
    assert.equal(out.csv.type, 'text/csv');
    assert.equal(out.json.filename, 'deliverables.json');
    assert.equal(out.json.type, 'application/json');
  }
  if (update) {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(actual, null, 2) + '\n');
  }
  const expected = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  assert.deepEqual(actual, expected);
});

// --- Core builders ---
test('EXPORT_FILENAMES: frozen, deliverables.csv and deliverables.json', () => {
  assert.deepEqual({ ...core.EXPORT_FILENAMES }, { csv: 'deliverables.csv', json: 'deliverables.json' });
  assert.equal(Object.isFrozen(core.EXPORT_FILENAMES), true);
});

for (const [name, config] of Object.entries(FIXTURES)) {
  test('buildCsv(' + name + ') equals the Lite snapshot', () => {
    const expected = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    assert.equal(core.buildCsv(config, { today: config.TIMELINE.TODAY }), expected[name + '.csv']);
  });

  test('buildJson(' + name + ') equals the Lite snapshot with exportDate set to the injected now', () => {
    const expected = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    const built = core.buildJson(config, { today: config.TIMELINE.TODAY, now: NOW });
    assert.equal(built, expected[name + '.json']);
    assert.equal(JSON.parse(built).exportDate, NOW);
  });
}

test('buildCsv: header row is Name, Group, Current State, Next Milestone, At Risk, Tags, Link then one Date column per milestone', () => {
  const first = core.buildCsv(minimalConfig, { today: '15/04/2026' }).split('\n')[0];
  assert.equal(first, 'Name,Group,Current State,Next Milestone,At Risk,Tags,Link,START Date,M1 Date');
});

// --- SaaS path: API rows through the adapter export the same bytes as Lite over the same canonical config (D-12, VIEW-06) ---
for (const [name, config] of Object.entries(FIXTURES)) {
  test('Lite and core exports are byte-identical over the adapter output (' + name + ')', async () => {
    const today = config.TIMELINE.TODAY;
    const canonical = core.apiToRoadmap(roadmapToApi(config), { today });
    const lite = await liteOutputs(canonical);
    assert.equal(core.buildCsv(canonical, { today }), lite.csv.content);
    assert.equal(core.buildJson(canonical, { today, now: NOW }), lite.json.content);
  });
}
