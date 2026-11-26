import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES as CORE_THEMES } from '../../packages/core/src/themes.js';
import { THEMES as API_THEMES } from '../../packages/api/src/lib/themes.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Option values of the select whose class list contains theme-select, read from the rendered
 * Lite filter bar (not the source template) so the guard survives the option list moving into a model.
 */
function liteThemeOptions() {
  const snapshots = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'lite-html-snapshots.json'), 'utf8'),
  );
  const markup = snapshots['minimal:default'];
  assert.equal(typeof markup, 'string', 'minimal:default snapshot must exist');
  const selects = [...markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)];
  const themeSelect = selects.find(([, attrs]) => /class="[^"]*\btheme-select\b[^"]*"/.test(attrs));
  assert.ok(themeSelect, 'the filter bar must render a theme-select');
  return [...themeSelect[2].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((m) => m[1]);
}

test('core THEMES and the API THEMES copy hold the same names in the same order', () => {
  assert.deepEqual([...API_THEMES], [...CORE_THEMES]);
});

test("Lite's rendered theme select offers exactly the core THEMES in order", () => {
  assert.deepEqual(liteThemeOptions(), [...CORE_THEMES]);
});
