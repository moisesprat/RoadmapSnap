/**
 * Cross-tenant matrix. Signed-JWT requests go through the real API as roadmapsnap_app.
 *
 * Coverage is forced by app.routeTable (the onRoute hook in src/server.js): every registered
 * route except GET /, GET /health and the CORS preflight must have a MATRIX entry and a SHAPES
 * entry, and a MATRIX entry for a route that no longer exists fails too. A new route therefore
 * fails this file until someone writes its cross-tenant attack.
 *
 * Alice (org A) attacks org B by id, by X-Org-Id header and by ?orgId query string. An
 * admin-pool snapshot of org B (and bob's preferences) must be identical afterwards.
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
  createWorkspace,
  createProject,
  createMilestone,
  createDependency,
  userIdBySub,
  countMemberships,
  cleanup,
  closePools,
} from './helpers/db.js';

let app;
const fx = {};
const strangerSub = uniq('stranger');
const strangerEmail = `${strangerSub}@example.com`;
const stranger = { sub: strangerSub, email: strangerEmail, name: 'Stranger' };

const person = (label, name) => {
  const sub = uniq(label);
  return { sub, email: `${sub}@example.com`, name };
};

async function call(who, method, url, { headers = {}, body } = {}) {
  const token = await signToken({ sub: who.sub, email: who.email, name: who.name });
  return app.inject({
    method,
    url,
    headers: { ...bearer(token), ...headers },
    ...(body === undefined ? {} : { payload: body }),
  });
}

async function get(url, { sub, email, name, headers = {} }) {
  return call({ sub, email, name }, 'GET', url, { headers });
}

/** Everything of org B that an org A caller must never be able to change, as one string. */
async function snapshotB() {
  const pool = adminPool();
  const orgId = fx.orgB.id;
  const workspaces = await pool.query(
    `SELECT id, name, slug, settings, workflow_definition FROM workspaces WHERE org_id = $1 ORDER BY id`,
    [orgId]
  );
  const projects = await pool.query(
    `SELECT id, name, group_name, at_risk, descoped, show_in_timeline, tags, external_link, display_order
       FROM projects WHERE org_id = $1 ORDER BY id`,
    [orgId]
  );
  const milestones = await pool.query('SELECT count(*)::int AS n FROM milestones WHERE org_id = $1', [orgId]);
  const dependencies = await pool.query('SELECT count(*)::int AS n FROM dependencies WHERE org_id = $1', [orgId]);
  const prefs = await pool.query('SELECT preferences FROM users WHERE id = $1', [fx.bob.id]);
  return JSON.stringify({
    workspaces: workspaces.rows,
    projects: projects.rows,
    milestones: milestones.rows[0].n,
    dependencies: dependencies.rows[0].n,
    bobPreferences: prefs.rows[0]?.preferences ?? null,
  });
}

async function unchangedB(attack) {
  const before = await snapshotB();
  await attack();
  const after = await snapshotB();
  assert.equal(after, before, 'org B data changed after an org A caller attacked it');
}

function assertNotAMember(res, label) {
  assert.equal(res.statusCode, 403, `${label}: expected 403, got ${res.statusCode} ${res.body}`);
  assert.equal(res.json().code, 'NOT_A_MEMBER', `${label}: expected code NOT_A_MEMBER`);
}

before(async () => {
  requireDbEnv();
  await initTestAuth();

  fx.alice = { ...person('alice', 'Alice') };
  fx.bob = { ...person('bob', 'Bob') };
  fx.vic = { ...person('vic', 'Vic') };
  fx.dave = { ...person('dave', 'Dave') };
  fx.carol = { ...person('carol', 'Carol') };
  for (const who of [fx.alice, fx.bob, fx.vic, fx.dave, fx.carol]) {
    const row = await createUser({ sub: who.sub, email: who.email, name: who.name });
    who.id = row.id;
  }
  // Keep the tracer's names for the fields it reads.
  fx.aliceSub = fx.alice.sub;
  fx.bobSub = fx.bob.sub;

  fx.orgA = await createOrg({ name: 'Tracer Org A', slug: uniq('tracer-org-a') });
  fx.orgB = await createOrg({ name: 'Tracer Org B', slug: uniq('tracer-org-b') });
  await addMember(fx.orgA.id, fx.alice.id, 'admin');
  await addMember(fx.orgA.id, fx.vic.id, 'viewer');
  await addMember(fx.orgB.id, fx.bob.id, 'admin');

  fx.wsA = await createWorkspace(fx.orgA.id, fx.alice.id, { name: 'WS A', slug: uniq('ws-a') });
  fx.wsB = await createWorkspace(fx.orgB.id, fx.bob.id, { name: 'WS B', slug: uniq('ws-b') });
  fx.A1 = await createProject(fx.orgA.id, fx.wsA.id, { name: uniq('A1'), groupName: 'Group A' });
  fx.A2 = await createProject(fx.orgA.id, fx.wsA.id, { name: uniq('A2'), groupName: 'Group A' });
  fx.B1 = await createProject(fx.orgB.id, fx.wsB.id, { name: uniq('B1'), groupName: 'Group B' });
  fx.B2 = await createProject(fx.orgB.id, fx.wsB.id, { name: uniq('B2'), groupName: 'Group B' });
  await createMilestone(fx.orgA.id, fx.A1.id, 'START', '2026-04-01');
  await createMilestone(fx.orgB.id, fx.B1.id, 'START', '2026-05-01');
  await createDependency(fx.orgA.id, fx.A1.id, fx.A2.id);
  await createDependency(fx.orgB.id, fx.B1.id, fx.B2.id);

  // dave: oldest membership is A. carol: identical created_at in A and B (tie-break case).
  await addMember(fx.orgA.id, fx.dave.id, 'editor');
  await addMember(fx.orgB.id, fx.dave.id, 'editor');
  await addMember(fx.orgA.id, fx.carol.id, 'editor');
  await addMember(fx.orgB.id, fx.carol.id, 'editor');
  const setCreatedAt = (orgId, userId, at) =>
    adminPool().query('UPDATE org_members SET created_at = $3 WHERE org_id = $1 AND user_id = $2', [
      orgId,
      userId,
      at,
    ]);
  await setCreatedAt(fx.orgA.id, fx.dave.id, '2026-01-01T00:00:00Z');
  await setCreatedAt(fx.orgB.id, fx.dave.id, '2026-02-01T00:00:00Z');
  await setCreatedAt(fx.orgA.id, fx.carol.id, '2026-01-01T00:00:00Z');
  await setCreatedAt(fx.orgB.id, fx.carol.id, '2026-01-01T00:00:00Z');

  app = await build();
  await app.ready();
});

after(async () => {
  await cleanup({
    orgIds: [fx.orgA?.id, fx.orgB?.id].filter(Boolean),
    userIds: [fx.alice, fx.bob, fx.vic, fx.dave, fx.carol].map((u) => u?.id).filter(Boolean),
    subs: [strangerSub],
  });
  if (app) await app.close();
  await closePools();
});

// --- Tracer cases (01-01) ------------------------------------------------------------------

test('org A member lists only org A workspaces', async () => {
  const res = await get('/api/v1/workspaces', { sub: fx.aliceSub, email: fx.alice.email });
  assert.equal(res.statusCode, 200);
  const { workspaces } = res.json();
  assert.ok(workspaces.length >= 1);
  for (const ws of workspaces) assert.equal(ws.org_id, fx.orgA.id);
  assert.ok(workspaces.some((w) => w.id === fx.wsA.id), 'wsA must be listed');
  assert.ok(!workspaces.some((w) => w.id === fx.wsB.id), 'wsB must not be listed');
});

test('org A member cannot read an org B workspace by id (RLS, handler has no org filter)', async () => {
  const res = await get(`/api/v1/workspaces/${fx.wsB.id}`, { sub: fx.aliceSub, email: fx.alice.email });
  assert.equal(res.statusCode, 404);
});

test('X-Org-Id naming an org the caller is not a member of returns 403 NOT_A_MEMBER', async () => {
  const res = await get('/api/v1/workspaces', {
    sub: fx.aliceSub,
    email: fx.alice.email,
    headers: { 'x-org-id': fx.orgB.id },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().code, 'NOT_A_MEMBER');
});

test('a malformed X-Org-Id returns 400 INVALID_ORG_ID', async () => {
  const res = await get('/api/v1/workspaces', {
    sub: fx.aliceSub,
    email: fx.alice.email,
    headers: { 'x-org-id': 'not-a-uuid' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 'INVALID_ORG_ID');
});

test('a brand-new subject is provisioned with zero memberships and tenant routes answer 403', async () => {
  const res = await get('/api/v1/workspaces', { sub: strangerSub, email: strangerEmail, name: 'Stranger' });
  assert.equal(res.statusCode, 403);
  const userId = await userIdBySub(strangerSub);
  assert.ok(userId, 'the users row for the stranger must exist');
  assert.equal(await countMemberships(userId), 0);
});

// --- Cross-tenant matrix ----------------------------------------------------------------------

/**
 * Concrete request per route, aimed at org B's resources. Used by the header and query loops,
 * where the context step must refuse before any handler runs.
 */
const SHAPES = {
  'GET /auth/me': () => ({ url: '/auth/me' }),
  'PATCH /auth/me': () => ({ url: '/auth/me', body: { preferences: { theme: 'dark' } } }),
  'GET /api/v1/workspaces': () => ({ url: '/api/v1/workspaces' }),
  'GET /api/v1/workspaces/:workspaceId': () => ({ url: `/api/v1/workspaces/${fx.wsB.id}` }),
  'POST /api/v1/workspaces': () => ({
    url: '/api/v1/workspaces',
    body: { name: 'x', slug: uniq('x') },
  }),
  'PATCH /api/v1/workspaces/:workspaceId': () => ({
    url: `/api/v1/workspaces/${fx.wsB.id}`,
    body: { name: 'x' },
  }),
  'DELETE /api/v1/workspaces/:workspaceId': () => ({ url: `/api/v1/workspaces/${fx.wsB.id}` }),
  'GET /api/v1/workspaces/:workspaceId/projects': () => ({ url: `/api/v1/workspaces/${fx.wsB.id}/projects` }),
  'POST /api/v1/workspaces/:workspaceId/projects': () => ({
    url: `/api/v1/workspaces/${fx.wsB.id}/projects`,
    body: { name: 'x' },
  }),
  'PATCH /api/v1/projects/:projectId': () => ({
    url: `/api/v1/projects/${fx.B1.id}`,
    body: { name: 'x' },
  }),
  'DELETE /api/v1/projects/:projectId': () => ({ url: `/api/v1/projects/${fx.B1.id}` }),
};

const MATRIX = {
  'GET /auth/me': async () => {
    const res = await call(fx.alice, 'GET', '/auth/me', { headers: { 'x-org-id': fx.orgB.id } });
    assertNotAMember(res, 'GET /auth/me with x-org-id B');
  },
  'PATCH /auth/me': async () => {
    const denied = await call(fx.alice, 'PATCH', '/auth/me', {
      headers: { 'x-org-id': fx.orgB.id },
      body: { preferences: { theme: 'dark' } },
    });
    assertNotAMember(denied, 'PATCH /auth/me with x-org-id B');
    // The route only ever updates the caller's own row; bob's preferences stay as they were.
    const own = await call(fx.alice, 'PATCH', '/auth/me', { body: { preferences: { theme: 'dark' } } });
    assert.equal(own.statusCode, 200);
    assert.equal(own.json().preferences.theme, 'dark');
  },
  'GET /api/v1/workspaces': async () => {
    const res = await call(fx.alice, 'GET', '/api/v1/workspaces');
    assert.equal(res.statusCode, 200);
    for (const ws of res.json().workspaces) assert.equal(ws.org_id, fx.orgA.id);
  },
  'GET /api/v1/workspaces/:workspaceId': async () => {
    const res = await call(fx.alice, 'GET', `/api/v1/workspaces/${fx.wsB.id}`);
    assert.equal(res.statusCode, 404);
  },
  'POST /api/v1/workspaces': async () => {
    const res = await call(fx.alice, 'POST', '/api/v1/workspaces', {
      headers: { 'x-org-id': fx.orgB.id },
      body: { name: 'x', slug: uniq('x') },
    });
    assert.equal(res.statusCode, 403);
  },
  'PATCH /api/v1/workspaces/:workspaceId': async () => {
    const res = await call(fx.alice, 'PATCH', `/api/v1/workspaces/${fx.wsB.id}`, { body: { name: 'x' } });
    assert.equal(res.statusCode, 404);
  },
  'DELETE /api/v1/workspaces/:workspaceId': async () => {
    const res = await call(fx.alice, 'DELETE', `/api/v1/workspaces/${fx.wsB.id}`);
    assert.equal(res.statusCode, 404);
  },
  'GET /api/v1/workspaces/:workspaceId/projects': async () => {
    const res = await call(fx.alice, 'GET', `/api/v1/workspaces/${fx.wsB.id}/projects`);
    assert.equal(res.statusCode, 404);
  },
  'POST /api/v1/workspaces/:workspaceId/projects': async () => {
    const res = await call(fx.alice, 'POST', `/api/v1/workspaces/${fx.wsB.id}/projects`, {
      body: { name: 'x' },
    });
    assert.equal(res.statusCode, 404);
  },
  'PATCH /api/v1/projects/:projectId': async () => {
    const res = await call(fx.alice, 'PATCH', `/api/v1/projects/${fx.B1.id}`, { body: { name: 'x' } });
    assert.equal(res.statusCode, 404);
  },
  'DELETE /api/v1/projects/:projectId': async () => {
    const res = await call(fx.alice, 'DELETE', `/api/v1/projects/${fx.B1.id}`);
    assert.equal(res.statusCode, 404);
  },
};

const EXEMPT = new Set(['GET /', 'GET /health', 'OPTIONS *']);

function registeredRoutes() {
  return [
    ...new Set(
      app.routeTable.filter(({ method }) => method !== 'HEAD').map(({ method, url }) => `${method} ${url}`)
    ),
  ];
}

function tenantRoutes() {
  return registeredRoutes().filter((key) => !EXEMPT.has(key));
}

test('route coverage: every tenant route has a MATRIX entry and every entry names a live route', () => {
  const routes = tenantRoutes();
  const uncovered = routes.filter((key) => !(key in MATRIX));
  const stale = Object.keys(MATRIX).filter((key) => !routes.includes(key));
  assert.deepEqual(
    { uncovered, stale },
    { uncovered: [], stale: [] },
    `routes without a cross-tenant MATRIX entry: [${uncovered.join(', ')}]; ` +
      `MATRIX entries for routes that no longer exist: [${stale.join(', ')}]`
  );
});

for (const key of Object.keys(MATRIX)) {
  test(`matrix by id: ${key}`, async () => {
    await unchangedB(MATRIX[key]);
  });
}

test('matrix by header: every tenant route refuses X-Org-Id of an org the caller is not in', async () => {
  await unchangedB(async () => {
    for (const key of tenantRoutes()) {
      assert.ok(SHAPES[key], `no SHAPES entry for ${key}; add its request shape`);
      const { url, body } = SHAPES[key]();
      const [method] = key.split(' ');
      const res = await call(fx.alice, method, url, { headers: { 'x-org-id': fx.orgB.id }, body });
      assertNotAMember(res, `${key} with x-org-id B`);
    }
  });
});

test('matrix by query string: every tenant route refuses ?orgId of an org the caller is not in', async () => {
  await unchangedB(async () => {
    for (const key of tenantRoutes()) {
      assert.ok(SHAPES[key], `no SHAPES entry for ${key}; add its request shape`);
      const { url, body } = SHAPES[key]();
      const [method] = key.split(' ');
      const res = await call(fx.alice, method, `${url}?orgId=${fx.orgB.id}`, { body });
      assertNotAMember(res, `${key} with ?orgId=B`);
    }
  });
});

// --- NO_ORG, roles, default org, concurrency, audit -------------------------------------------

test('a caller with no membership gets 403 NO_ORG on every tenant route, and 200 with orgs [] on /auth/me', async () => {
  const noOrg = { error: 'Forbidden', message: 'No organization', code: 'NO_ORG' };
  const cases = [
    ['GET', '/api/v1/workspaces'],
    ['GET', `/api/v1/workspaces/${fx.wsA.id}`],
    ['GET', `/api/v1/workspaces/${fx.wsA.id}/projects`],
    ['POST', '/api/v1/workspaces', { name: 'x', slug: uniq('x') }],
    ['POST', `/api/v1/workspaces/${fx.wsA.id}/projects`, { name: 'x' }],
    ['PATCH', `/api/v1/projects/${fx.A1.id}`, { name: 'x' }],
    ['DELETE', `/api/v1/projects/${fx.A1.id}`],
  ];
  for (const [method, url, body] of cases) {
    const res = await call(stranger, method, url, { body });
    assert.equal(res.statusCode, 403, `${method} ${url}`);
    assert.deepEqual(res.json(), noOrg, `${method} ${url}`);
  }

  const me = await call(stranger, 'GET', '/auth/me');
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json().orgs, []);
  assert.equal(me.json().role, null);
});

test('a viewer can read but is refused writes with Insufficient permissions', async () => {
  const read = await call(fx.vic, 'GET', '/api/v1/workspaces');
  assert.equal(read.statusCode, 200);
  const write = await call(fx.vic, 'POST', '/api/v1/workspaces', { body: { name: 'x', slug: uniq('x') } });
  assert.equal(write.statusCode, 403);
  assert.equal(write.json().message, 'Insufficient permissions');
});

test('default org is the oldest membership, and X-Org-Id switches to the other org (D-14)', async () => {
  const byDefault = await call(fx.dave, 'GET', '/api/v1/workspaces');
  assert.equal(byDefault.statusCode, 200);
  const defaultList = byDefault.json().workspaces;
  assert.ok(defaultList.some((w) => w.id === fx.wsA.id), 'dave sees wsA by default');
  for (const ws of defaultList) assert.equal(ws.org_id, fx.orgA.id);

  const named = await call(fx.dave, 'GET', '/api/v1/workspaces', { headers: { 'x-org-id': fx.orgB.id } });
  assert.equal(named.statusCode, 200);
  const namedList = named.json().workspaces;
  assert.ok(namedList.some((w) => w.id === fx.wsB.id), 'dave sees wsB with x-org-id B');
  for (const ws of namedList) assert.equal(ws.org_id, fx.orgB.id);
});

test('equal created_at memberships resolve to the org with the smaller org_id (tie-break)', async () => {
  const expected = [fx.orgA.id, fx.orgB.id].sort()[0];
  const res = await call(fx.carol, 'GET', '/api/v1/workspaces');
  assert.equal(res.statusCode, 200);
  const { workspaces } = res.json();
  assert.ok(workspaces.length >= 1);
  for (const ws of workspaces) assert.equal(ws.org_id, expected);
});

test('20 interleaved parallel requests from org A and org B callers each see only their own org', async () => {
  const jobs = Array.from({ length: 20 }, (_, i) => {
    const who = i % 2 === 0 ? fx.alice : fx.bob;
    const orgId = i % 2 === 0 ? fx.orgA.id : fx.orgB.id;
    return call(who, 'GET', '/api/v1/workspaces').then((res) => ({ res, orgId }));
  });
  const results = await Promise.all(jobs);
  for (const { res, orgId } of results) {
    assert.equal(res.statusCode, 200);
    const { workspaces } = res.json();
    assert.ok(workspaces.length >= 1);
    for (const ws of workspaces) assert.equal(ws.org_id, orgId);
  }
});

test('a write through an app-role request is audited with the caller user_id and org_id', async () => {
  const res = await call(fx.alice, 'POST', `/api/v1/workspaces/${fx.wsA.id}/projects`, {
    body: { name: uniq('audited') },
  });
  assert.equal(res.statusCode, 201);
  const projectId = res.json().project.id;
  const audit = await adminPool().query(
    `SELECT user_id, org_id FROM audit_events
      WHERE entity_id = $1 AND action = 'INSERT' AND entity_type = 'projects'`,
    [projectId]
  );
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].user_id, fx.alice.id);
  assert.equal(audit.rows[0].org_id, fx.orgA.id);
});
