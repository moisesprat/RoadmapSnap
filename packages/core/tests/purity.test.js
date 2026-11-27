import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, '..');
const srcDir = path.join(coreRoot, 'src');

// Modules in barrel order: dates first, then one reserved module per later plan (02-04 ... 02-11).
const EXPECTED_MODULES = [
  'dates', 'timeline', 'workflow', 'dependencies', 'filters', 'stats', 'viewModel', 'export',
  'adapter', 'defaults', 'themes', 'markup', 'viewState', 'models', 'timelineModel', 'arrows',
];

const FORBIDDEN_IDENTIFIERS = [
  'window', 'document', 'localStorage', 'sessionStorage', 'process',
  'AppState', 'CONFIG', 'fetch', 'XMLHttpRequest',
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function moduleFiles() {
  return fs.readdirSync(srcDir).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
}

test('purity: no browser, storage, env, app-state, config or network identifier in packages/core/src', () => {
  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'))) {
    const code = stripComments(fs.readFileSync(path.join(srcDir, file), 'utf8'));
    for (const id of FORBIDDEN_IDENTIFIERS) {
      assert.equal(new RegExp('\\b' + id + '\\b').test(code), false, `${file} references forbidden identifier ${id}`);
    }
  }
});

test('purity: core never reads the clock (no new Date() without arguments, no Date.now)', () => {
  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'))) {
    const code = stripComments(fs.readFileSync(path.join(srcDir, file), 'utf8'));
    assert.equal(/new\s+Date\s*\(\s*\)/.test(code), false, `${file} calls new Date() with no arguments`);
    assert.equal(/Date\s*\.\s*now\s*\(/.test(code), false, `${file} calls Date.now(`);
  }
});

test('purity: packages/core/package.json has no dependencies key (zero runtime deps)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(coreRoot, 'package.json'), 'utf8'));
  assert.equal('dependencies' in pkg, false);
});

test('exports: no export name is defined by two modules', async () => {
  const owners = new Map();
  for (const file of moduleFiles()) {
    const ns = await import(pathToFileURL(path.join(srcDir, file)).href);
    for (const name of Object.keys(ns)) {
      assert.equal(owners.has(name), false, `export "${name}" is defined by both ${owners.get(name)} and ${file}`);
      owners.set(name, file);
    }
  }
});

test('exports: names exported by index.js equal the union of every module export', async () => {
  const union = [];
  for (const file of moduleFiles()) {
    const ns = await import(pathToFileURL(path.join(srcDir, file)).href);
    union.push(...Object.keys(ns));
  }
  const barrel = await import(pathToFileURL(path.join(srcDir, 'index.js')).href);
  assert.deepEqual(Object.keys(barrel).sort(), union.sort());
});

test('barrel: index.js re-exports every reserved core module, dates first', () => {
  const lines = fs.readFileSync(path.join(srcDir, 'index.js'), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('export * from'));
  assert.deepEqual(lines, EXPECTED_MODULES.map((m) => `export * from './${m}.js';`));
  assert.deepEqual(
    moduleFiles().map((f) => f.replace(/\.js$/, '')).sort(),
    [...EXPECTED_MODULES].sort(),
  );
});
