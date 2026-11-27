import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES,
  THEME_LABELS,
  DEFAULT_THEME,
  LEGACY_THEME_ALIASES,
  normalizeTheme,
} from '../src/index.js';

const EIGHT = ['light', 'dark', 'professional', 'colorful', 'blank', 'monochrome', 'papallona', 'evergreen'];

test('THEMES lists the eight Lite themes in select order', () => {
  assert.deepEqual([...THEMES], EIGHT);
  assert.ok(Object.isFrozen(THEMES));
});

test('THEME_LABELS has a capitalised label for every theme', () => {
  assert.deepEqual(Object.keys(THEME_LABELS), EIGHT);
  assert.equal(THEME_LABELS.papallona, 'Papallona');
  assert.ok(Object.isFrozen(THEME_LABELS));
});

test('DEFAULT_THEME is light and LEGACY_THEME_ALIASES maps dsm-firmenich to evergreen', () => {
  assert.equal(DEFAULT_THEME, 'light');
  assert.deepEqual({ ...LEGACY_THEME_ALIASES }, { 'dsm-firmenich': 'evergreen' });
});

for (const name of EIGHT) {
  test(`normalizeTheme: ${name} is returned unchanged`, () => {
    assert.equal(normalizeTheme(name), name);
  });
}

test('normalizeTheme: the legacy dsm-firmenich value maps to evergreen', () => {
  assert.equal(normalizeTheme('dsm-firmenich'), 'evergreen');
});

for (const bad of [undefined, null, '', 42, 'neon', 'LIGHT', {}, [], 'constructor']) {
  test(`normalizeTheme: ${JSON.stringify(bad)} falls back to light`, () => {
    assert.equal(normalizeTheme(bad), 'light');
  });
}
