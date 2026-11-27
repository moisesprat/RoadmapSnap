/**
 * Static guards against bypass code in packages/api/src, plus the NO_ORG refusal that the
 * shared requireRole preHandler gives a caller with no membership.
 *
 * The forbidden literals below appear only in this file, never in src comments. SQL migrations
 * are not scanned (V4 legitimately configures the app role's row security). These tests never
 * skip: a missing database env fails the NO_ORG case instead.
 */

import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTestAuth, signToken, bearer } from './helpers/auth.js';
import { requireDbEnv, uniq, cleanup, closePools } from './helpers/db.js';

const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

const FORBIDDEN_LITERALS = [
  { literal: 'x-test-user-sub', ignoreCase: true },
  { literal: 'row_security', ignoreCase: false },
  { literal: 'config-seed-org', ignoreCase: false },
  { literal: 'dev-default', ignoreCase: false },
  { literal: 'SET LOCAL', ignoreCase: false },
];

/** Every .js file under src, as { rel: 'routes/auth.js' (posix), text }. */
function srcFiles() {
  return readdirSync(SRC_DIR, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.js'))
    .map((p) => ({
      rel: p.split(sep).join('/'),
      text: readFileSync(join(SRC_DIR, p), 'utf8'),
    }));
}

/** Import specifiers: static imports, re-exports and dynamic import() calls, comments stripped. */
function importSpecifiers(text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const specs = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) specs.push(m[1]);
  return specs;
}

const importsDbClient = (spec) => /db\/client/.test(spec);

test('src/ is found and holds the files the guards depend on', () => {
  const rels = srcFiles().map((f) => f.rel);
  for (const needed of ['server.js', 'plugins/context.js', 'plugins/rbac.js', 'routes/workspaces.js']) {
    assert.ok(rels.includes(needed), `expected src/${needed} to be scanned; found ${rels.length} files`);
  }
});

test('no .js file under src contains a bypass literal', () => {
  const offenders = [];
  for (const { rel, text } of srcFiles()) {
    for (const { literal, ignoreCase } of FORBIDDEN_LITERALS) {
      const found = ignoreCase ? text.toLowerCase().includes(literal.toLowerCase()) : text.includes(literal);
      if (found) offenders.push(`src/${rel} contains "${literal}"`);
    }
  }
  assert.deepEqual(offenders, [], `bypass literals found:\n${offenders.join('\n')}`);
});

test('routes and plugins import neither db/client nor pg', () => {
  const offenders = [];
  for (const { rel, text } of srcFiles()) {
    if (!rel.startsWith('routes/') && !rel.startsWith('plugins/')) continue;
    for (const spec of importSpecifiers(text)) {
      if (importsDbClient(spec)) offenders.push(`src/${rel} imports "${spec}"`);
      if (spec === 'pg') offenders.push(`src/${rel} imports "pg"`);
    }
  }
  assert.deepEqual(offenders, [], `routes and plugins must use request.dbClient:\n${offenders.join('\n')}`);
});

test('only src/server.js and src/db/** import db/client', () => {
  const importers = srcFiles()
    .filter(({ text }) => importSpecifiers(text).some(importsDbClient))
    .map(({ rel }) => rel);
  const unexpected = importers.filter((rel) => rel !== 'server.js' && !rel.startsWith('db/'));
  assert.deepEqual(unexpected, [], `unexpected db/client importers: ${unexpected.join(', ')}`);
  assert.ok(importers.includes('server.js'), 'server.js is expected to import db/client');
});

test('the CLI block in src/server.js calls build() with no argument', () => {
  const server = readFileSync(join(SRC_DIR, 'server.js'), 'utf8');
  const marker = 'process.argv[1] === fileURLToPath(import.meta.url)';
  const at = server.indexOf(marker);
  assert.ok(at >= 0, `src/server.js must keep the CLI guard "${marker}"`);
  const block = server.slice(at + marker.length);
  const calls = [...block.matchAll(/\bbuild\(([^)]*)\)/g)];
  assert.ok(calls.length > 0, 'the CLI block must call build()');
  for (const call of calls) {
    assert.equal(call[1].trim(), '', `the CLI block calls build(${call[1]}); it must pass no argument`);
  }
  assert.ok(block.includes('await build()'), 'the CLI block must contain "await build()"');
});

// --- NO_ORG: the behavior half of the shared requireRole consolidation -------------------------

let app;
const strangerSub = uniq('nobypass-stranger');

before(async () => {
  requireDbEnv();
  await initTestAuth();
  app = await build();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  await cleanup({ subs: [strangerSub] });
  await closePools();
});

test('a caller with no membership gets 403 NO_ORG from GET /api/v1/workspaces', async () => {
  const token = await signToken({ sub: strangerSub, email: `${strangerSub}@example.com`, name: 'Stranger' });
  const res = await app.inject({ method: 'GET', url: '/api/v1/workspaces', headers: bearer(token) });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.json(), { error: 'Forbidden', message: 'No organization', code: 'NO_ORG' });
});
