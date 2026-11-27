/**
 * Per-request transaction guarantees (SEC-01) and the shared NO_ORG refusal (D-12), proven
 * through ad hoc routes passed to build({ extraRoutes }) so they run behind the real
 * authenticate, setRequestContext and requireRole hooks. serialApp has a one-connection pool, so
 * any leaked client or tenant context residue shows up on the very next request.
 */

import { build } from '../src/server.js';
import { logCheckedOutClientError } from '../src/plugins/context.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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


function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Rejects with a named error so a leaked connection fails the test instead of hanging it. */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let seq = 0;
function nextSeq() {
  seq += 1;
  return seq;
}

let lastClient = null;
const terminateProbe = { pid: deferred(), go: deferred() };

let abortProbe;
function resetAbortProbe() {
  abortProbe = { entered: deferred(), settled: deferred(), observed: null, settledSeq: 0 };
}
resetAbortProbe();

const TENANT_SNAPSHOT_SQL = `SELECT txid_current()::text AS tx,
       current_setting('app.current_org_id', true) AS org,
       current_setting('app.current_user_id', true) AS usr`;

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

  // Abort regression routes. GET on purpose: Node only marks req.aborted (which fires
  // onRequestAbort) for requests whose body was not fully read. Each handler keeps the client it
  // was given at the start, the way real handlers hold on to request.dbClient across awaits.
  fastify.get('/__test/slow-org', { preHandler: asViewer }, async (request) => {
    const probe = abortProbe;
    const client = request.dbClient;
    try {
      const first = (await client.query(TENANT_SNAPSHOT_SQL)).rows[0];
      probe.entered.resolve();
      await client.query('select pg_sleep(0.5)');
      // Gives a released client time to be picked up by the follower request.
      await sleep(100);
      const trailing = (await client.query(TENANT_SNAPSHOT_SQL)).rows[0];
      probe.observed = { first, trailing };
      return trailing;
    } finally {
      probe.settledSeq = nextSeq();
      probe.settled.resolve();
    }
  });

  fastify.get('/__test/slow-write', { preHandler: asEditor }, async (request, reply) => {
    const probe = abortProbe;
    const client = request.dbClient;
    try {
      probe.entered.resolve();
      await client.query('select pg_sleep(0.5)');
      await sleep(100);
      await client.query(
        'INSERT INTO workspaces (org_id, name, slug, created_by) VALUES ($1, $2, $3, $4)',
        [request.orgId, 'tenant-tx abort workspace', request.query.slug, request.dbUser.id]
      );
      return reply.status(201).send({ ok: true });
    } finally {
      probe.settledSeq = nextSeq();
      probe.settled.resolve();
    }
  });

  // Ends without a value and without reply.send: after an abort Fastify then sends nothing, so
  // neither onSend nor onResponse runs for this request.
  fastify.get('/__test/slow-silent', { preHandler: asViewer }, async (request) => {
    const probe = abortProbe;
    const client = request.dbClient;
    try {
      probe.entered.resolve();
      await client.query('select pg_sleep(0.4)');
    } finally {
      probe.settledSeq = nextSeq();
      probe.settled.resolve();
    }
  });

  fastify.get('/__test/slow-throw', { preHandler: asEditor }, async (request) => {
    const probe = abortProbe;
    const client = request.dbClient;
    try {
      await client.query(
        'INSERT INTO workspaces (org_id, name, slug, created_by) VALUES ($1, $2, $3, $4)',
        [request.orgId, 'tenant-tx abort workspace', request.query.slug, request.dbUser.id]
      );
      probe.entered.resolve();
      await client.query('select pg_sleep(0.4)');
      throw new Error('forced failure after abort');
    } finally {
      probe.settledSeq = nextSeq();
      probe.settled.resolve();
    }
  });

  fastify.get('/__test/client-listener', { preHandler: asViewer }, async (request) => {
    lastClient = request.dbClient;
    return { attached: request.dbClient.listeners('error').includes(logCheckedOutClientError) };
  });

  // Holds the request mid-transaction so the test can terminate its backend while it is idle.
  fastify.get('/__test/terminated-mid-tx', { preHandler: asViewer }, async (request) => {
    const client = request.dbClient;
    const res = await client.query('select pg_backend_pid() AS pid');
    terminateProbe.pid.resolve(res.rows[0].pid);
    await terminateProbe.go.promise;
    await client.query('select 1');
    return { ok: true };
  });
}

let serialApp;
let parallelApp;
let abortApp;
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

  fx.bobSub = uniq('bob');
  fx.bobEmail = `${fx.bobSub}@example.com`;
  fx.bob = await createUser({ sub: fx.bobSub, email: fx.bobEmail, name: 'Bob' });
  fx.orgB = await createOrg({ name: 'Tenant Tx Org B', slug: uniq('tx-org-b') });
  await addMember(fx.orgB.id, fx.bob.id, 'admin');

  serialApp = await buildWithPool(1);
  parallelApp = await buildWithPool(5);

  // app.inject cannot abort a request, so this app listens on a real socket.
  abortApp = await buildWithPool(1);
  await abortApp.listen({ port: 0, host: '127.0.0.1' });
});

after(async () => {
  try {
    if (abortApp) {
      await withTimeout(
        abortApp.close(),
        5000,
        'abortApp.close() timed out: a pooled client was never released'
      );
    }
  } finally {
    if (serialApp) await serialApp.close();
    if (parallelApp) await parallelApp.close();
    await cleanup({
      orgIds: [fx.orgA?.id, fx.orgB?.id].filter(Boolean),
      userIds: [fx.alice?.id, fx.bob?.id, fx.lone?.id].filter(Boolean),
      subs: extraSubs,
    });
    await closePools();
  }
});

const alice = () => ({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice' });
const bob = () => ({ sub: fx.bobSub, email: fx.bobEmail, name: 'Bob' });

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

async function startAbortableRequest(path, claims) {
  const token = await signToken(claims);
  const req = http.request({
    host: '127.0.0.1',
    port: abortApp.server.address().port,
    path,
    method: 'GET',
    headers: bearer(token),
    agent: false,
  });
  // Destroying the request raises ECONNRESET on the client side.
  req.on('error', () => {});
  req.end();
  return req;
}

/**
 * Alice's request starts on the one-connection abortApp, her socket is destroyed while the
 * handler is inside pg_sleep, and Bob's request is issued right away.
 */
async function abortAliceThenCallBob(path) {
  resetAbortProbe();
  const req = await startAbortableRequest(path, alice());
  await withTimeout(abortProbe.entered.promise, 5000, 'aborted handler never started');
  req.destroy();

  let followerSeq = 0;
  const followerCall = call(abortApp, { url: '/__test/whoami', ...bob() }).then((res) => {
    followerSeq = nextSeq();
    return res;
  });
  const follower = await withTimeout(
    followerCall,
    8000,
    'follower never got a connection: the aborted request did not release its client'
  );
  await withTimeout(abortProbe.settled.promise, 5000, 'aborted handler never settled');
  return { follower, followerSeq };
}

async function orgIdsForSlug(slug) {
  const res = await adminPool().query('SELECT org_id FROM workspaces WHERE slug = $1', [slug]);
  return res.rows.map((r) => r.org_id);
}

test("abort mid-handler: the handler's later statements stay in its own transaction, and another org's next request gets 200 with its own org", { timeout: 20000 }, async () => {
  const { follower, followerSeq } = await abortAliceThenCallBob('/__test/slow-org');
  assert.equal(follower.statusCode, 200);
  assert.equal(follower.json().org, fx.orgB.id);
  assert.equal(follower.json().usr, fx.bob.id);

  const { first, trailing } = abortProbe.observed;
  assert.equal(trailing.tx, first.tx, 'trailing statement ran in a different transaction');
  assert.equal(trailing.org, fx.orgA.id);
  assert.equal(trailing.usr, fx.alice.id);
  assert.equal(first.org, fx.orgA.id);
  assert.ok(
    followerSeq > abortProbe.settledSeq,
    'follower completed before the aborted handler settled and released its connection'
  );
});

test('abort mid-handler before a write: the write stays in org A and another org\'s concurrent request still gets 200', { timeout: 20000 }, async () => {
  const slug = uniq('abort-write');
  const { follower, followerSeq } = await abortAliceThenCallBob(`/__test/slow-write?slug=${slug}`);
  assert.equal(follower.statusCode, 200);
  assert.equal(follower.json().org, fx.orgB.id);
  assert.ok(followerSeq > abortProbe.settledSeq);

  assert.deepEqual(await orgIdsForSlug(slug), [fx.orgA.id]);
  const inB = await adminPool().query('SELECT count(*)::int AS n FROM workspaces WHERE org_id = $1', [fx.orgB.id]);
  assert.equal(inB.rows[0].n, 0);
});

test('abort mid-handler, then the handler resolves undefined: its client is still released', { timeout: 20000 }, async () => {
  const { follower } = await abortAliceThenCallBob('/__test/slow-silent');
  assert.equal(follower.statusCode, 200);
  assert.equal(follower.json().org, fx.orgB.id);
});

test('abort mid-handler, then the handler throws: the write rolls back and the client is released', { timeout: 20000 }, async () => {
  const slug = uniq('abort-throw');
  const { follower } = await abortAliceThenCallBob(`/__test/slow-throw?slug=${slug}`);
  assert.equal(follower.statusCode, 200);
  assert.equal(follower.json().org, fx.orgB.id);
  assert.deepEqual(await orgIdsForSlug(slug), []);
});

test('a checked-out client carries the error listener only while the request holds it', async () => {
  const res = await call(serialApp, { url: '/__test/client-listener', ...alice() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().attached, true);
  assert.ok(lastClient, 'the route never ran');
  assert.equal(lastClient.listeners('error').includes(logCheckedOutClientError), false);
});

test('terminating a request backend mid-transaction gives that request 500 and the next request 200', { timeout: 20000 }, async () => {
  const inflight = call(serialApp, { url: '/__test/terminated-mid-tx', ...alice() });
  const pid = await withTimeout(terminateProbe.pid.promise, 5000, 'terminated-mid-tx handler never started');

  await adminPool().query('select pg_terminate_backend($1)', [pid]);
  const deadline = Date.now() + 2000;
  for (;;) {
    const res = await adminPool().query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (res.rows[0].n === 0 || Date.now() > deadline) break;
    await sleep(25);
  }
  // The client receives the FATAL while it is idle, which is the case that needs an error listener.
  await sleep(100);
  terminateProbe.go.resolve();

  const res = await withTimeout(inflight, 8000, 'the request with a terminated backend never answered');
  assert.equal(res.statusCode, 500);

  const next = await call(serialApp, { url: '/__test/whoami', ...alice() });
  assert.equal(next.statusCode, 200);
});
