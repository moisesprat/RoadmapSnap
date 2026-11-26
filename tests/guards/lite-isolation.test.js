import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALLOWED_BARE_SPECIFIER = '@roadmapsnap/core';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

// js/config.js and js/config_*.js are user data and sample programs, not Lite code.
const isConfigData = (file) => /^config(_.*)?\.js$/.test(path.basename(file));

const liteFiles = walk(path.join(repoRoot, 'js')).filter((f) => !isConfigData(f));
const coreFiles = walk(path.join(repoRoot, 'packages', 'core', 'src'));

function bareSpecifiers(code) {
  const found = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g, // static import/export ... from '...'
    /\bimport\s*['"]([^'"]+)['"]/g, // side-effect import '...'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('...')
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      if (!m[1].startsWith('.')) found.push(m[1]);
    }
  }
  return found;
}

test('lite isolation: Lite files exist to scan', () => {
  assert.ok(liteFiles.length > 10);
});

test('lite isolation: the only bare import specifier under js/ is @roadmapsnap/core', () => {
  for (const file of liteFiles) {
    const specs = bareSpecifiers(stripComments(fs.readFileSync(file, 'utf8')));
    for (const spec of specs) {
      assert.equal(spec, ALLOWED_BARE_SPECIFIER, `${path.relative(repoRoot, file)} imports "${spec}"`);
    }
  }
});

test('lite isolation: no network call and no /api/ URL under js/ or packages/core/src', () => {
  for (const file of [...liteFiles, ...coreFiles]) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(repoRoot, file);
    assert.equal(code.includes('fetch('), false, `${rel} calls fetch(`);
    assert.equal(code.includes('XMLHttpRequest'), false, `${rel} references XMLHttpRequest`);
    assert.equal(code.includes('/api/'), false, `${rel} contains /api/`);
  }
});
