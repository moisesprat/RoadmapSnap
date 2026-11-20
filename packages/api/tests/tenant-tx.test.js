/**
 * Per-request transaction guarantees (SEC-01) and the shared NO_ORG refusal (D-12), proven
 * through ad hoc routes passed to build({ extraRoutes }) so they run behind the real
 * authenticate, setRequestContext and requireRole hooks. serialApp has a one-connection pool, so
 * any leaked client or tenant context residue shows up on the very next request.
 */

import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initTestAuth, signToken, bearer } from './helpers/auth.js';
import {
  requireDbEnv,
  adminPool,
  uniq,
  createUser,
  createOrg,
  addMember,
  cleanup,
  closePools,
} from './helpers/db.js';

async function testRoutes(fastify) {
  const asViewer = [fastify.authenticate, fastify.setRequestContext, fastify.requireRole('viewer')];
  const asEditor = [fastify.authenticate, fastify.setRequestContext, fastify.requireRole('editor')];
  const noRoleCheck = [fastify.authenticate, fastify.setRequestContext];

  const insertWorkspace = (request) =>
    request.dbClient.query(
      'INSERT INTO workspaces (org_id, name, slug, created_by) VALUES ($1, $2, $3, $4)',
      [request.orgId, 'tenant-tx workspace', request.body.slug, request.dbUser.id]
    );

  fastify.get('/__test/whoami', { preHandler: asViewer }, async (request) => {
    const res = await request.dbClient.query(
      `SELECT current_user AS who,
              current_setting('is_superuser') AS is_superuser,
              current_setting('app.current_org_id', true) AS org,
              current_setting('app.current_user_id', true) AS usr`
    );
    return res.rows[0];
  });

  fastify.get('/__test/context-only', { preHandler: noRoleCheck }, async (request) => {
    const res = await request.dbClient.query(
      `SELECT current_setting('app.current_org_id', true) AS org`
    );
    return res.rows[0];
  });

  fastify.post('/__test/write-commit', { preHandler: asEditor }, async (request, reply) => {
    await insertWorkspace(request);
    return reply.status(201).send({ ok: true });
  });

  fastify.post('/__test/write-then-409', { preHandler: asEditor }, async (request, reply) => {
    await insertWorkspace(request);
    return reply.status(409).send({ error: 'Conflict', message: 'forced' });
  });

  fastify.post('/__test/write-then-throw', { preHandler: asEditor }, async (request) => {
    await insertWorkspace(request);
    throw new Error('forced failure after write');
  });

  // Swallows a database error and answers 200: COMMIT of an aborted tx becomes ROLLBACK, which
  // must surface as a 500 rather than a silent rollback.
  fastify.post('/__test/swallow-error', { preHandler: asEditor }, async (request) => {
    try {
      await request.dbClient.query('select 1/0');
    } catch (_) {
      // intentionally ignored
    }
    return { ok: true };
  });
}

let serialApp;
let parallelApp;
const fx = {};
const extraSubs = [];

async function buildWithPool(max) {
  const previous = process.env.APP_DB_POOL_MAX;
  process.env.APP_DB_POOL_MAX = String(max);
  try {
    const app = await build({ extraRoutes: testRoutes });
    await app.ready();
    return app;
  } finally {
    if (previous === undefined) delete process.env.APP_DB_POOL_MAX;
    else process.env.APP_DB_POOL_MAX = previous;
  }
}

async function call(app, { method = 'GET', url, sub, email, name, payload }) {
  const token = await signToken({ sub, email, name });
  return app.inject({ method, url, headers: bearer(token), payload });
}

function newSubject(prefix) {
  const sub = uniq(prefix);
  extraSubs.push(sub);
  return { sub, email: `${sub}@example.com` };
}

async function workspaceCount(slug) {
  const res = await adminPool().query('SELECT count(*)::int AS n FROM workspaces WHERE slug = $1', [slug]);
  return res.rows[0].n;
}

before(async () => {
  requireDbEnv();
  await initTestAuth();

  fx.aliceSub = uniq('alice');
  fx.aliceEmail = `${fx.aliceSub}@example.com`;
  fx.alice = await createUser({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice' });
  fx.orgA = await createOrg({ name: 'Tenant Tx Org A', slug: uniq('tx-org-a') });
  await addMember(fx.orgA.id, fx.alice.id, 'admin');

  fx.loneSub = uniq('lone');
  fx.lone = await createUser({ sub: fx.loneSub, email: `${fx.loneSub}@example.com`, name: 'Lone' });

  serialApp = await buildWithPool(1);
  parallelApp = await buildWithPool(5);
});

after(async () => {
  if (serialApp) await serialApp.close();
  if (parallelApp) await parallelApp.close();
  await cleanup({
    orgIds: [fx.orgA?.id].filter(Boolean),
    userIds: [fx.alice?.id, fx.lone?.id].filter(Boolean),
    subs: extraSubs,
  });
  await closePools();
});

const alice = () => ({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice' });

test('request context: app role, not a superuser, with the resolved org and user GUCs', async () => {
  const res = await call(serialApp, { url: '/__test/whoami', ...alice() });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.who, 'roadmapsnap_app');
  assert.equal(body.is_superuser, 'off');
  assert.equal(body.org, fx.orgA.id);
  assert.equal(body.usr, fx.alice.id);
});

test('a 2xx response commits the request transaction', async () => {
  const slug = uniq('tx-commit');
  const res = await call(serialApp, {
    method: 'POST',
    url: '/__test/write-commit',
    ...alice(),
    payload: { slug },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(await workspaceCount(slug), 1);
});

test('a 4xx response rolls the request transaction back', async () => {
  const slug = uniq('tx-409');
  const res = await call(serialApp, {
    method: 'POST',
    url: '/__test/write-then-409',
    ...alice(),
    payload: { slug },
  });
  assert.equal(res.statusCode, 409);
  assert.equal(await workspaceCount(slug), 0);
});

test('a thrown error returns 500 and rolls the request transaction back', async () => {
  const slug = uniq('tx-throw');
  const res = await call(serialApp, {
    method: 'POST',
    url: '/__test/write-then-throw',
    ...alice(),
    payload: { slug },
  });
  assert.equal(res.statusCode, 500);
  assert.equal(await workspaceCount(slug), 0);
});

test('a handler that swallows a database error and returns 200 produces a 500, not a silent rollback', async () => {
  const res = await call(serialApp, {
    method: 'POST',
    url: '/__test/swallow-error',
    ...alice(),
    payload: { slug: uniq('tx-swallow') },
  });
  assert.equal(res.statusCode, 500);
});

test('a brand-new subject with no organization gets 403 NO_ORG from requireRole', async () => {
  const stranger = newSubject('newcomer');
  const res = await call(serialApp, { url: '/__test/whoami', ...stranger });
  assert.equal(res.statusCode, 403);
  const body = res.json();
  assert.equal(body.code, 'NO_ORG');
  assert.equal(body.message, 'No organization');
  assert.equal(body.error, 'Forbidden');
});

test('adjacency: the next request on the same pooled connection never sees the previous org', async () => {
  const first = await call(serialApp, { url: '/__test/whoami', ...alice() });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().org, fx.orgA.id);

  const second = await call(serialApp, {
    url: '/__test/context-only',
    sub: fx.loneSub,
    email: `${fx.loneSub}@example.com`,
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().org, '');
});

test('five sequential requests on a one-connection pool all complete (every request releases its client)', async () => {
  for (let i = 0; i < 5; i += 1) {
    const res = await call(serialApp, { url: '/__test/whoami', ...alice() });
    assert.equal(res.statusCode, 200, `request ${i + 1}`);
  }
});

test('error paths release the connection: a 409 and a 403 are followed by a healthy request', async () => {
  const slug = uniq('tx-release');
  const conflict = await call(serialApp, {
    method: 'POST',
    url: '/__test/write-then-409',
    ...alice(),
    payload: { slug },
  });
  assert.equal(conflict.statusCode, 409);
  const forbidden = await call(serialApp, { url: '/__test/whoami', ...newSubject('noorg') });
  assert.equal(forbidden.statusCode, 403);
  const ok = await call(serialApp, { url: '/__test/whoami', ...alice() });
  assert.equal(ok.statusCode, 200);
});

test('parallel first requests by one brand-new subject create exactly one users row and no 500', async () => {
  const subject = newSubject('race');
  const results = await Promise.all(
    Array.from({ length: 4 }, () => call(parallelApp, { url: '/__test/context-only', ...subject }))
  );
  const codes = results.map((r) => r.statusCode);
  assert.ok(!codes.includes(500), `status codes: ${codes.join(',')}`);
  assert.deepEqual(codes, [200, 200, 200, 200]);
  const rows = await adminPool().query('SELECT count(*)::int AS n FROM users WHERE auth0_id = $1', [subject.sub]);
  assert.equal(rows.rows[0].n, 1);
});

test('a brand-new subject with no email claim gets 403 EMAIL_REQUIRED', async () => {
  const sub = uniq('noemail');
  extraSubs.push(sub);
  const res = await call(serialApp, { url: '/__test/context-only', sub });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().code, 'EMAIL_REQUIRED');
});

test('a second new subject using an existing email gets 409 EMAIL_IN_USE and the app keeps serving', async () => {
  const sub = uniq('dupemail');
  extraSubs.push(sub);
  const res = await call(serialApp, { url: '/__test/context-only', sub, email: fx.aliceEmail });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().code, 'EMAIL_IN_USE');

  const next = await call(serialApp, { url: '/__test/whoami', ...alice() });
  assert.equal(next.statusCode, 200);
});

test('routeTable lists registered routes, including the extra test routes', () => {
  const has = (method, url) => serialApp.routeTable.some((r) => r.method === method && r.url === url);
  assert.ok(has('GET', '/health'));
  assert.ok(has('GET', '/__test/whoami'));
  assert.ok(has('POST', '/__test/write-commit'));
});
