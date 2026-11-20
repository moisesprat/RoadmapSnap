/**
 * Tracer: a signed-JWT request goes through the real API as roadmapsnap_app and sees only its
 * own organization. 01-05 grows this file into the full cross-tenant matrix.
 */

import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initTestAuth, signToken, bearer } from './helpers/auth.js';
import {
  requireDbEnv,
  uniq,
  createUser,
  createOrg,
  addMember,
  createWorkspace,
  userIdBySub,
  countMemberships,
  cleanup,
  closePools,
} from './helpers/db.js';

let app;
const fx = {};
const strangerSub = uniq('stranger');
const strangerEmail = `${strangerSub}@example.com`;

async function get(url, { sub, email, name, headers = {} }) {
  const token = await signToken({ sub, email, name });
  return app.inject({ method: 'GET', url, headers: { ...bearer(token), ...headers } });
}

before(async () => {
  requireDbEnv();
  await initTestAuth();

  fx.aliceSub = uniq('alice');
  fx.bobSub = uniq('bob');
  fx.alice = await createUser({ sub: fx.aliceSub, email: `${fx.aliceSub}@example.com`, name: 'Alice' });
  fx.bob = await createUser({ sub: fx.bobSub, email: `${fx.bobSub}@example.com`, name: 'Bob' });
  fx.orgA = await createOrg({ name: 'Tracer Org A', slug: uniq('tracer-org-a') });
  fx.orgB = await createOrg({ name: 'Tracer Org B', slug: uniq('tracer-org-b') });
  await addMember(fx.orgA.id, fx.alice.id, 'admin');
  await addMember(fx.orgB.id, fx.bob.id, 'admin');
  fx.wsA = await createWorkspace(fx.orgA.id, fx.alice.id, { name: 'WS A', slug: uniq('ws-a') });
  fx.wsB = await createWorkspace(fx.orgB.id, fx.bob.id, { name: 'WS B', slug: uniq('ws-b') });

  app = await build();
  await app.ready();
});

after(async () => {
  await cleanup({
    orgIds: [fx.orgA?.id, fx.orgB?.id].filter(Boolean),
    userIds: [fx.alice?.id, fx.bob?.id].filter(Boolean),
    subs: [strangerSub],
  });
  if (app) await app.close();
  await closePools();
});

test('org A member lists only org A workspaces', async () => {
  const res = await get('/api/v1/workspaces', { sub: fx.aliceSub, email: `${fx.aliceSub}@example.com` });
  assert.equal(res.statusCode, 200);
  const { workspaces } = res.json();
  assert.ok(workspaces.length >= 1);
  for (const ws of workspaces) assert.equal(ws.org_id, fx.orgA.id);
  assert.ok(workspaces.some((w) => w.id === fx.wsA.id), 'wsA must be listed');
  assert.ok(!workspaces.some((w) => w.id === fx.wsB.id), 'wsB must not be listed');
});

test('org A member cannot read an org B workspace by id (RLS, handler has no org filter)', async () => {
  const res = await get(`/api/v1/workspaces/${fx.wsB.id}`, {
    sub: fx.aliceSub,
    email: `${fx.aliceSub}@example.com`,
  });
  assert.equal(res.statusCode, 404);
});

test('X-Org-Id naming an org the caller is not a member of returns 403 NOT_A_MEMBER', async () => {
  const res = await get('/api/v1/workspaces', {
    sub: fx.aliceSub,
    email: `${fx.aliceSub}@example.com`,
    headers: { 'x-org-id': fx.orgB.id },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().code, 'NOT_A_MEMBER');
});

test('a malformed X-Org-Id returns 400 INVALID_ORG_ID', async () => {
  const res = await get('/api/v1/workspaces', {
    sub: fx.aliceSub,
    email: `${fx.aliceSub}@example.com`,
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
