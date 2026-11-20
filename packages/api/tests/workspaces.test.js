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
  cleanup,
  closePools,
} from './helpers/db.js';

let app;
let testOrgId;
let adminUserId;
let viewerUserId;
let createdWorkspaceId;

const adminSub = uniq('ws-admin');
const adminEmail = `${adminSub}@example.com`;
const viewerSub = uniq('ws-viewer');
const viewerEmail = `${viewerSub}@example.com`;

async function authHeaders(sub, email, orgId) {
  const token = await signToken({ sub, email });
  const h = { ...bearer(token) };
  if (orgId) h['x-org-id'] = orgId;
  return h;
}

before(async () => {
  requireDbEnv();
  await initTestAuth();

  const admin = await createUser({ sub: adminSub, email: adminEmail, name: 'WS Admin' });
  adminUserId = admin.id;
  const viewer = await createUser({ sub: viewerSub, email: viewerEmail, name: 'WS Viewer' });
  viewerUserId = viewer.id;

  const org = await createOrg({ name: 'Workspace Test Org', slug: uniq('ws-test-org') });
  testOrgId = org.id;
  await addMember(testOrgId, adminUserId, 'admin');
  await addMember(testOrgId, viewerUserId, 'viewer');

  app = await build();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  await cleanup({
    orgIds: [testOrgId].filter(Boolean),
    userIds: [adminUserId, viewerUserId].filter(Boolean),
  });
  await closePools();
});

test('GET /api/v1/workspaces without auth returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/workspaces',
    headers: {},
  });
  assert.equal(res.statusCode, 401);
});

test('GET /api/v1/workspaces returns workspaces scoped to current org', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/workspaces',
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.workspaces));
  assert.ok(
    body.workspaces.every((w) => w.org_id === testOrgId),
    'all workspaces must belong to test org'
  );
});

test('POST /api/v1/workspaces creates workspace and returns 201', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/workspaces',
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
    payload: { name: 'Test Workspace', slug: 'test-workspace' },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.ok(body.workspace);
  assert.ok(body.workspace.id);
  assert.equal(body.workspace.org_id, testOrgId);
  assert.equal(body.workspace.name, 'Test Workspace');
  assert.equal(body.workspace.slug, 'test-workspace');
  createdWorkspaceId = body.workspace.id;
});

test('POST /api/v1/workspaces with duplicate slug returns 409', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/workspaces',
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
    payload: { name: 'Another', slug: 'test-workspace' },
  });
  assert.equal(res.statusCode, 409);
  const body = res.json();
  assert.equal(body.error, 'Conflict');
});

test('GET /api/v1/workspaces/:id returns the created workspace', async () => {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/workspaces/${createdWorkspaceId}`,
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.workspace.id, createdWorkspaceId);
  assert.equal(body.workspace.name, 'Test Workspace');
  assert.ok(Array.isArray(body.workspace.workflow_definition));
  assert.ok(typeof body.workspace.entity_labels === 'object');
  assert.ok(typeof body.workspace.dashboard_text === 'object');
});

test('PATCH /api/v1/workspaces/:id updates name', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/v1/workspaces/${createdWorkspaceId}`,
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
    payload: { name: 'Test Workspace Updated' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.workspace.name, 'Test Workspace Updated');
  assert.equal(body.workspace.slug, 'test-workspace');
});

test('GET /api/v1/workspaces/:id/projects returns workspace + empty projects array', async () => {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/workspaces/${createdWorkspaceId}/projects`,
    headers: await authHeaders(adminSub, adminEmail, testOrgId),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.workspace);
  assert.equal(body.workspace.id, createdWorkspaceId);
  assert.ok(Array.isArray(body.projects));
  assert.equal(body.projects.length, 0);
});

test('Viewer role cannot POST /api/v1/workspaces (returns 403)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/workspaces',
    headers: await authHeaders(viewerSub, viewerEmail, testOrgId),
    payload: { name: 'Viewer Workspace', slug: 'viewer-workspace' },
  });
  assert.equal(res.statusCode, 403);
  const body = res.json();
  assert.equal(body.error, 'Forbidden');
});
