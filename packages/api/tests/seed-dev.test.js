/**
 * seed:dev (SEC-05, D-02, D-05..D-07): two synthetic demo orgs, idempotent, owner-only, refused in
 * production. Runs on a scratch database so it cannot disturb the shared test database.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { build } from '../src/server.js';
import { migrate } from '../src/db/migrate.js';
import { seedDev } from '../src/db/seeds/dev.js';
import { initTestAuth, signToken, bearer } from './helpers/auth.js';
import {
  requireDbEnv,
  uniq,
  createScratchDatabase,
  dropScratchDatabase,
  closePools,
} from './helpers/db.js';

const SEED_CLI = fileURLToPath(new URL('../src/db/seeds/dev.js', import.meta.url));

// Tables the seed writes, with the counts one run must produce.
const EXPECTED = {
  organizations: 2,
  workspaces: 2,
  projects: 14,
  milestones: 82,
  dependencies: 4,
};

let scratch;
let client;
let app;
let savedAppUrl;
let result;
const sub = uniq('dev|seed');

async function counts() {
  const out = {};
  for (const table of [...Object.keys(EXPECTED), 'org_members', 'users']) {
    const res = await client.query(`SELECT count(*)::int AS n FROM ${pg.escapeIdentifier(table)}`);
    out[table] = res.rows[0].n;
  }
  return out;
}

async function membershipRole(slug, userId) {
  const res = await client.query(
    `SELECT m.role FROM org_members m JOIN organizations o ON o.id = m.org_id
      WHERE o.slug = $1 AND m.user_id = $2`,
    [slug, userId]
  );
  return res.rows[0]?.role ?? null;
}

async function get(url, headers = {}) {
  const token = await signToken({ sub, email: 'dev-admin@local.dev' });
  return app.inject({ method: 'GET', url, headers: { ...bearer(token), ...headers } });
}

function runCli(args, overrides) {
  return spawnSync(process.execPath, [SEED_CLI, ...args], {
    // An unreachable database URL proves the guard fires before any connection is attempted.
    env: { ...process.env, DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none', ...overrides },
    encoding: 'utf8',
  });
}

before(async () => {
  requireDbEnv();
  scratch = await createScratchDatabase('rs_seed');
  await migrate(scratch.ownerUrl, { log: () => {} });
  client = new pg.Client({ connectionString: scratch.ownerUrl });
  await client.connect();

  result = await seedDev({ client, sub, email: 'dev-admin@local.dev', name: 'Seed Test Admin' });

  savedAppUrl = process.env.APP_DATABASE_URL;
  process.env.APP_DATABASE_URL = scratch.appUrl;
  await initTestAuth();
  app = await build();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (savedAppUrl === undefined) delete process.env.APP_DATABASE_URL;
  else process.env.APP_DATABASE_URL = savedAppUrl;
  if (client) await client.end();
  if (scratch) await dropScratchDatabase(scratch.name);
  await closePools();
});

describe('seedDev data', () => {
  it('creates two orgs with the expected workspaces, projects, milestones and dependencies', async () => {
    const c = await counts();
    for (const [table, n] of Object.entries(EXPECTED)) {
      assert.equal(c[table], n, `${table} count`);
    }
    const orgs = await client.query('SELECT slug FROM organizations ORDER BY slug');
    assert.deepEqual(orgs.rows.map((r) => r.slug), ['dev-org-a', 'dev-org-b']);

    const wsA = await client.query(
      `SELECT w.slug, w.settings, w.workflow_definition,
              (SELECT count(*)::int FROM projects p WHERE p.workspace_id = w.id) AS projects,
              (SELECT count(*)::int FROM milestones m JOIN projects p ON p.id = m.project_id
                WHERE p.workspace_id = w.id) AS milestones,
              (SELECT count(*)::int FROM dependencies d JOIN projects p ON p.id = d.from_project_id
                WHERE p.workspace_id = w.id) AS dependencies
         FROM workspaces w WHERE w.id = $1`,
      [result.orgA.workspaceId]
    );
    const a = wsA.rows[0];
    assert.equal(a.slug, 'demo-roadmap');
    assert.equal(a.projects, 10);
    assert.equal(a.milestones, 70);
    assert.equal(a.dependencies, 3);
    assert.equal(a.workflow_definition.length, 15);
    assert.deepEqual(a.settings, {
      start_month: '05/2025',
      end_month: '07/2026',
      group_order: ['Team A', 'Team B'],
    });

    const wsB = await client.query(
      `SELECT w.slug,
              (SELECT count(*)::int FROM projects p WHERE p.workspace_id = w.id) AS projects,
              (SELECT count(*)::int FROM dependencies d JOIN projects p ON p.id = d.from_project_id
                WHERE p.workspace_id = w.id) AS dependencies
         FROM workspaces w WHERE w.id = $1`,
      [result.orgB.workspaceId]
    );
    assert.equal(wsB.rows[0].slug, 'launch-plan');
    assert.equal(wsB.rows[0].projects, 4);
    assert.equal(wsB.rows[0].dependencies, 1);
  });

  it('stores milestone dates as ISO dates and flags the at-risk deliverables', async () => {
    const res = await client.query(
      `SELECT to_char(m.planned_date, 'YYYY-MM-DD') AS d
         FROM milestones m JOIN projects p ON p.id = m.project_id
        WHERE p.workspace_id = $1 AND p.name = 'Deliverable 1' AND m.milestone_key = 'A2'`,
      [result.orgA.workspaceId]
    );
    assert.equal(res.rows[0].d, '2025-09-15');
    const risk = await client.query(
      'SELECT name FROM projects WHERE workspace_id = $1 AND at_risk ORDER BY name',
      [result.orgA.workspaceId]
    );
    assert.deepEqual(risk.rows.map((r) => r.name), ['Deliverable 3', 'Deliverable 7']);
  });

  it('makes the subject admin of Demo Org A only', async () => {
    assert.equal(await membershipRole('dev-org-a', result.adminUserId), 'admin');
    assert.equal(await membershipRole('dev-org-b', result.adminUserId), null);
  });

  it('attributes every audit row written by the seed to a user', async () => {
    const res = await client.query('SELECT count(*)::int AS n FROM audit_events WHERE user_id IS NULL');
    assert.equal(res.rows[0].n, 0);
  });
});

describe('seedDev idempotency and arguments', () => {
  it('a second run leaves every row count unchanged', async () => {
    const before = await counts();
    const again = await seedDev({ client, sub, email: 'dev-admin@local.dev', name: 'Seed Test Admin' });
    assert.deepEqual(await counts(), before);
    assert.equal(again.adminUserId, result.adminUserId);
    assert.equal(again.orgA.id, result.orgA.id);
    assert.equal(again.orgB.workspaceId, result.orgB.workspaceId);
  });

  it('rejects an empty subject and an unknown memberOfB role', async () => {
    await assert.rejects(() => seedDev({ client, sub: '' }), /sub/);
    await assert.rejects(() => seedDev({ client, sub, memberOfB: 'owner' }), /memberOfB/);
  });
});

describe('seed data through the real API as roadmapsnap_app', () => {
  it('lists only Demo Org A workspace', async () => {
    const res = await get('/api/v1/workspaces');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().workspaces.map((w) => w.slug), ['demo-roadmap']);
  });

  it('returns 10 projects for the demo roadmap', async () => {
    const res = await get(`/api/v1/workspaces/${result.orgA.workspaceId}/projects`);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().projects.length, 10);
  });

  it('returns 404 for Demo Org B workspace id', async () => {
    const res = await get(`/api/v1/workspaces/${result.orgB.workspaceId}`);
    assert.equal(res.statusCode, 404);
  });

  it('returns 403 NOT_A_MEMBER for X-Org-Id of Demo Org B', async () => {
    const res = await get('/api/v1/workspaces', { 'x-org-id': result.orgB.id });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, 'NOT_A_MEMBER');
  });
});

describe('seed:dev CLI refusals', () => {
  it('refuses NODE_ENV=production before connecting', () => {
    const res = runCli(['--sub', 'refusal-check'], { NODE_ENV: 'production', DEV_ADMIN_SUB: '' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /seed: refusing to run with NODE_ENV=production/);
  });

  it('refuses when no subject is given', () => {
    const res = runCli([], { NODE_ENV: 'test', DEV_ADMIN_SUB: '' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /seed: --sub or DEV_ADMIN_SUB is required/);
  });

  it('refuses when DATABASE_URL is missing', () => {
    const res = runCli(['--sub', 'x'], { NODE_ENV: 'test', DEV_ADMIN_SUB: '', DATABASE_URL: '' });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /seed: DATABASE_URL \(owner role\) is required/);
  });
});

describe('seedDev memberOfB', () => {
  it('adds the subject to Demo Org B as viewer only when asked', async () => {
    assert.equal(await membershipRole('dev-org-b', result.adminUserId), null);
    await seedDev({ client, sub, email: 'dev-admin@local.dev', name: 'Seed Test Admin', memberOfB: 'viewer' });
    assert.equal(await membershipRole('dev-org-b', result.adminUserId), 'viewer');
    assert.equal(await membershipRole('dev-org-a', result.adminUserId), 'admin');
  });
});
