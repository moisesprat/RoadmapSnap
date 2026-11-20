/**
 * Direct RLS checks as roadmapsnap_app, without the API in between. Tenant context is set the
 * way the API sets it: parameterized set_config(name, $1, true) inside one transaction.
 *
 * Fixtures are created once, with unique names, and removed by id, so this file can run in
 * parallel with the other test files against the same database without touching their rows.
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireDbEnv,
  adminPool,
  appPool,
  uniq,
  createUser,
  createOrg,
  addMember,
  createWorkspace,
  createProject,
  cleanup,
  closePools,
} from './helpers/db.js';

const fx = {};

/**
 * Run one statement as the app role inside a rolled-back transaction with the given tenant
 * context. orgId null or '' means "no org chosen". userId and auth0Id set the identity-stage
 * variables when given.
 */
async function queryAs(orgId, sql, params = [], { userId, auth0Id } = {}) {
  const client = await appPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.current_org_id', $1, true)", [orgId ?? '']);
    if (userId !== undefined) {
      await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
    }
    if (auth0Id !== undefined) {
      await client.query("select set_config('app.current_auth0_id', $1, true)", [auth0Id]);
    }
    const result = await client.query(sql, params);
    await client.query('ROLLBACK');
    return result.rows;
  } finally {
    client.release();
  }
}

before(async () => {
  requireDbEnv();

  const sub = uniq('rls-user');
  fx.user = await createUser({ sub, email: `${sub}@example.com`, name: 'RLS Test User' });
  const memberSub = uniq('rls-member');
  fx.member = await createUser({ sub: memberSub, email: `${memberSub}@example.com`, name: 'RLS Member' });
  const otherSub = uniq('rls-other');
  fx.other = await createUser({ sub: otherSub, email: `${otherSub}@example.com`, name: 'RLS Other' });

  fx.orgA = await createOrg({ name: 'RLS Test Org Alpha', slug: uniq('rls-org-alpha') });
  fx.orgB = await createOrg({ name: 'RLS Test Org Beta', slug: uniq('rls-org-beta') });

  fx.wsA = await createWorkspace(fx.orgA.id, fx.user.id, { name: 'Workspace Alpha', slug: uniq('ws-alpha') });
  fx.wsB = await createWorkspace(fx.orgB.id, fx.user.id, { name: 'Workspace Beta', slug: uniq('ws-beta') });
  fx.projA = await createProject(fx.orgA.id, fx.wsA.id, { name: 'Project Alpha' });
  fx.projB = await createProject(fx.orgB.id, fx.wsB.id, { name: 'Project Beta' });

  // member belongs to both orgs; other only to org B. Identity-stage cases must not see other.
  await addMember(fx.orgA.id, fx.member.id, 'admin');
  await addMember(fx.orgB.id, fx.member.id, 'viewer');
  await addMember(fx.orgB.id, fx.other.id, 'viewer');
});

after(async () => {
  try {
    await cleanup({
      orgIds: [fx.orgA?.id, fx.orgB?.id].filter(Boolean),
      userIds: [fx.user, fx.member, fx.other].map((u) => u?.id).filter(Boolean),
    });
  } finally {
    await closePools();
  }
});

test('Org A sees only its own projects', async () => {
  const rows = await queryAs(fx.orgA.id, 'SELECT * FROM projects');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].org_id, fx.orgA.id);
  assert.equal(rows[0].name, 'Project Alpha');
});

test('Org B sees only its own projects', async () => {
  const rows = await queryAs(fx.orgB.id, 'SELECT * FROM projects');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].org_id, fx.orgB.id);
  assert.equal(rows[0].name, 'Project Beta');
});

test('Org A cannot read Org B project by explicit ID', async () => {
  const rows = await queryAs(fx.orgA.id, 'SELECT * FROM projects WHERE id = $1', [fx.projB.id]);
  assert.equal(rows.length, 0);
});

test('Org B cannot read Org A project by explicit ID', async () => {
  const rows = await queryAs(fx.orgB.id, 'SELECT * FROM projects WHERE id = $1', [fx.projA.id]);
  assert.equal(rows.length, 0);
});

test('No org context set — appClient sees zero projects', async () => {
  const rows = await queryAs(null, 'SELECT * FROM projects');
  assert.equal(rows.length, 0);
});

test('Org A sees only its own workspaces', async () => {
  const rows = await queryAs(fx.orgA.id, 'SELECT * FROM workspaces');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].org_id, fx.orgA.id);
});

test('Org B cannot read Org A workspace by explicit ID', async () => {
  const rows = await queryAs(fx.orgB.id, 'SELECT * FROM workspaces WHERE id = $1', [fx.wsA.id]);
  assert.equal(rows.length, 0);
});

test('audit_events are scoped by org_id', async () => {
  await adminPool().query(
    `INSERT INTO audit_events (org_id, action, entity_type) VALUES ($1, 'TEST', 'project')`,
    [fx.orgA.id]
  );

  const rows = await queryAs(fx.orgA.id, 'SELECT * FROM audit_events');
  assert.ok(rows.length >= 1);
  rows.forEach((row) => assert.equal(row.org_id, fx.orgA.id));

  const rows2 = await queryAs(fx.orgB.id, 'SELECT * FROM audit_events');
  rows2.forEach((row) => assert.equal(row.org_id, fx.orgB.id));
  assert.equal(rows2.filter((r) => r.org_id === fx.orgA.id).length, 0, 'org_b must not see org_a audit events');
});

test('with only app.current_user_id set, the app role sees its own memberships and organizations and no workspaces', async () => {
  const opts = { userId: fx.member.id };

  const memberships = await queryAs(null, 'SELECT user_id, org_id FROM org_members', [], opts);
  assert.equal(memberships.length, 2);
  for (const row of memberships) assert.equal(row.user_id, fx.member.id);
  assert.deepEqual(memberships.map((r) => r.org_id).sort(), [fx.orgA.id, fx.orgB.id].sort());

  const orgs = await queryAs(null, 'SELECT id FROM organizations', [], opts);
  assert.deepEqual(orgs.map((r) => r.id).sort(), [fx.orgA.id, fx.orgB.id].sort());

  const workspaces = await queryAs(null, 'SELECT id FROM workspaces', [], opts);
  assert.equal(workspaces.length, 0);
});

test('with only app.current_auth0_id set, the app role sees exactly its own users row', async () => {
  const rows = await queryAs(null, 'SELECT id, auth0_id FROM users', [], { auth0Id: fx.member.auth0_id });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, fx.member.id);
  assert.equal(rows[0].auth0_id, fx.member.auth0_id);
});
