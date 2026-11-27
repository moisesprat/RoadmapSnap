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
  cleanup,
  closePools,
} from './helpers/db.js';

let app;
let testOrgId;
let testWorkspaceId;
let editorUserId;
let viewerUserId;
let createdProjectId;

const editorSub = uniq('proj-editor');
const editorEmail = `${editorSub}@example.com`;
const viewerSub = uniq('proj-viewer');
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

  const editor = await createUser({ sub: editorSub, email: editorEmail, name: 'Proj Editor' });
  editorUserId = editor.id;
  const viewer = await createUser({ sub: viewerSub, email: viewerEmail, name: 'Proj Viewer' });
  viewerUserId = viewer.id;

  const org = await createOrg({ name: 'Project Test Org', slug: uniq('proj-test-org') });
  testOrgId = org.id;
  await addMember(testOrgId, editorUserId, 'editor');
  await addMember(testOrgId, viewerUserId, 'viewer');

  // Create a workspace to attach projects to
  const ws = await createWorkspace(testOrgId, editorUserId, {
    name: 'Test Workspace',
    slug: uniq('test-ws'),
  });
  testWorkspaceId = ws.id;

  app = await build();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  await cleanup({
    orgIds: [testOrgId].filter(Boolean),
    userIds: [editorUserId, viewerUserId].filter(Boolean),
  });
  await closePools();
});

// POST /api/v1/workspaces/:workspaceId/projects

test('POST /projects — creates project as editor', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: 'My First Project', group_name: 'Group A', tags: ['beta'] },
  });
  assert.equal(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.ok(body.project.id);
  assert.equal(body.project.name, 'My First Project');
  assert.equal(body.project.group_name, 'Group A');
  assert.deepEqual(body.project.tags, ['beta']);
  assert.equal(body.project.at_risk, false);
  assert.equal(body.project.show_in_timeline, true);
  assert.deepEqual(body.project.milestones, {});
  createdProjectId = body.project.id;
});

test('POST /projects — 409 on duplicate name', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: 'My First Project' },
  });
  assert.equal(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.equal(body.error, 'Conflict');
});

test('POST /projects — 400 on empty name', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: '   ' },
  });
  assert.equal(res.statusCode, 400);
});

test('POST /projects — 403 for viewer', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(viewerSub, viewerEmail, testOrgId),
    payload: { name: 'Viewer Project' },
  });
  assert.equal(res.statusCode, 403);
});

test('POST /projects — 404 for unknown workspace', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/workspaces/00000000-0000-0000-0000-000000000000/projects',
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: 'Orphan Project' },
  });
  assert.equal(res.statusCode, 404);
});

// PATCH /api/v1/projects/:projectId

test('PATCH /projects — updates name and at_risk', async () => {
  assert.ok(createdProjectId, 'need a created project from earlier test');
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: 'Renamed Project', at_risk: true },
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.project.name, 'Renamed Project');
  assert.equal(body.project.at_risk, true);
});

test('PATCH /projects — no-op if no fields', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: {},
  });
  assert.equal(res.statusCode, 200);
});

test('PATCH /projects — 404 for missing project', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/v1/projects/00000000-0000-0000-0000-000000000000',
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload: { name: 'Ghost' },
  });
  assert.equal(res.statusCode, 404);
});

test('PATCH /projects — 403 for viewer', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(viewerSub, viewerEmail, testOrgId),
    payload: { name: 'Viewer Rename' },
  });
  assert.equal(res.statusCode, 403);
});

// DELETE /api/v1/projects/:projectId

test('DELETE /projects — 403 for viewer', async () => {
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(viewerSub, viewerEmail, testOrgId),
  });
  assert.equal(res.statusCode, 403);
});

test('DELETE /projects — deletes project as editor', async () => {
  assert.ok(createdProjectId, 'need a created project from earlier test');
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
  });
  assert.equal(res.statusCode, 204);
});

test('DELETE /projects — 404 after deletion', async () => {
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/v1/projects/${createdProjectId}`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
  });
  assert.equal(res.statusCode, 404);
});

// external_link write-time allowlist: only http(s) URLs are stored (stored-XSS defense in depth)

const LINK_ERROR = 'external_link must be an http or https URL';

async function postProject(payload) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
    payload,
  });
}

async function listProjectNames() {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/workspaces/${testWorkspaceId}/projects`,
    headers: await authHeaders(editorSub, editorEmail, testOrgId),
  });
  assert.equal(res.statusCode, 200);
  return JSON.parse(res.body).projects.map((p) => p.name);
}

for (const bad of ['javascript:alert(1)', 'data:text/html,x']) {
  test(`POST /projects: external_link ${bad} is rejected with 400 and writes no row`, async () => {
    const name = uniq('link-bad');
    const res = await postProject({ name, external_link: bad });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Bad Request', message: LINK_ERROR });
    assert.ok(!(await listProjectNames()).includes(name), 'no row may be written');
  });
}

test('POST /projects: an https external_link is stored', async () => {
  const res = await postProject({ name: uniq('link-ok'), external_link: 'https://example.com/a' });
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(res.body).project.external_link, 'https://example.com/a');
});

for (const blank of ['', '   ']) {
  test(`POST /projects: a blank external_link ${JSON.stringify(blank)} is stored as null`, async () => {
    const res = await postProject({ name: uniq('link-blank'), external_link: blank });
    assert.equal(res.statusCode, 201);
    assert.equal(JSON.parse(res.body).project.external_link, null);
  });
}

test('POST /projects: external_link is trimmed before it is stored', async () => {
  const res = await postProject({ name: uniq('link-trim'), external_link: '  https://example.com  ' });
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(res.body).project.external_link, 'https://example.com');
});

test('PATCH /projects: javascript: external_link is rejected with 400 and the stored link is unchanged; null clears it', async () => {
  const created = await postProject({ name: uniq('link-patch'), external_link: 'https://example.com/keep' });
  assert.equal(created.statusCode, 201);
  const id = JSON.parse(created.body).project.id;
  const headers = await authHeaders(editorSub, editorEmail, testOrgId);

  const bad = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${id}`,
    headers,
    payload: { external_link: 'javascript:alert(1)' },
  });
  assert.equal(bad.statusCode, 400);
  assert.deepEqual(JSON.parse(bad.body), { error: 'Bad Request', message: LINK_ERROR });

  const unchanged = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${id}`,
    headers,
    payload: { at_risk: false },
  });
  assert.equal(JSON.parse(unchanged.body).project.external_link, 'https://example.com/keep');

  const cleared = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${id}`,
    headers,
    payload: { external_link: null },
  });
  assert.equal(cleared.statusCode, 200);
  assert.equal(JSON.parse(cleared.body).project.external_link, null);
});
