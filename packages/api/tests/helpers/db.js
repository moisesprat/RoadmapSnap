/**
 * Test DB helper: admin pool (DATABASE_URL, fixtures and cleanup) and app pool
 * (APP_DATABASE_URL, the role the API itself runs as), unique fixture builders and an
 * ordered cleanup that is safe for test files running in parallel against one database.
 * All SQL is parameterized; there are no row-security toggles.
 */

import '../../src/loadEnv.js';
import pg from 'pg';

const { Pool } = pg;

let admin = null;
let app = null;
let counter = 0;

export function requireDbEnv() {
  const missing = ['DATABASE_URL', 'APP_DATABASE_URL'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(' and ')} must be set for the API tests (see packages/api/.env.example); tests fail rather than skip.`
    );
  }
}

export function adminPool() {
  if (!admin) admin = new Pool({ connectionString: process.env.DATABASE_URL });
  return admin;
}

export function appPool() {
  if (!app) app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  return app;
}

/** Unique per process, per millisecond and per call. Never ends in "-test" (rls.test.js cleans those). */
export function uniq(prefix) {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}`;
}

export async function createUser({ sub, email, name }) {
  const res = await adminPool().query(
    'INSERT INTO users (auth0_id, email, display_name) VALUES ($1, $2, $3) RETURNING *',
    [sub, email, name ?? null]
  );
  return res.rows[0];
}

export async function createOrg({ name, slug }) {
  const res = await adminPool().query(
    `INSERT INTO organizations (name, slug, plan) VALUES ($1, $2, 'trial') RETURNING *`,
    [name, slug]
  );
  return res.rows[0];
}

export async function addMember(orgId, userId, role) {
  const res = await adminPool().query(
    'INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
    [orgId, userId, role]
  );
  return res.rows[0];
}

export async function createWorkspace(orgId, createdBy, { name, slug }) {
  const res = await adminPool().query(
    'INSERT INTO workspaces (org_id, name, slug, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
    [orgId, name, slug, createdBy]
  );
  return res.rows[0];
}

export async function createProject(orgId, workspaceId, { name, groupName }) {
  const res = await adminPool().query(
    'INSERT INTO projects (org_id, workspace_id, name, group_name) VALUES ($1, $2, $3, $4) RETURNING *',
    [orgId, workspaceId, name, groupName ?? null]
  );
  return res.rows[0];
}

/** plannedDate is an ISO date string or null. */
export async function createMilestone(orgId, projectId, key, plannedDate) {
  const res = await adminPool().query(
    'INSERT INTO milestones (org_id, project_id, milestone_key, planned_date) VALUES ($1, $2, $3, $4) RETURNING *',
    [orgId, projectId, key, plannedDate ?? null]
  );
  return res.rows[0];
}

export async function createDependency(orgId, fromProjectId, toProjectId) {
  const res = await adminPool().query(
    'INSERT INTO dependencies (org_id, from_project_id, to_project_id) VALUES ($1, $2, $3) RETURNING *',
    [orgId, fromProjectId, toProjectId]
  );
  return res.rows[0];
}

export async function userIdBySub(sub) {
  const res = await adminPool().query('SELECT id FROM users WHERE auth0_id = $1', [sub]);
  return res.rows[0]?.id ?? null;
}

export async function countMemberships(userId) {
  const res = await adminPool().query(
    'SELECT count(*)::int AS n FROM org_members WHERE user_id = $1',
    [userId]
  );
  return res.rows[0].n;
}

/**
 * One admin transaction. Order matters: audit triggers fire while the first deletes run, and
 * audit_events.org_id has no ON DELETE CASCADE, so audit_events goes after them and before
 * organizations.
 */
export async function cleanup({ orgIds = [], userIds = [], subs = [] } = {}) {
  const client = await adminPool().connect();
  try {
    await client.query('BEGIN');
    for (const table of ['dependencies', 'milestones', 'projects', 'workspaces', 'org_members']) {
      await client.query(`DELETE FROM ${table} WHERE org_id = ANY($1)`, [orgIds]);
    }
    await client.query('DELETE FROM audit_events WHERE org_id = ANY($1)', [orgIds]);
    await client.query('DELETE FROM organizations WHERE id = ANY($1)', [orgIds]);
    await client.query('DELETE FROM users WHERE id = ANY($1) OR auth0_id = ANY($2)', [userIds, subs]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Same URL with only the database path replaced (WHATWG URL, so credentials and query survive). */
function withDatabase(urlString, name) {
  const url = new URL(urlString);
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Create an empty scratch database for tests that migrate from nothing. Uses the admin pool,
 * so the admin role must be allowed to CREATE DATABASE. Returns { name, ownerUrl, appUrl }.
 */
export async function createScratchDatabase(prefix) {
  const name = `${prefix}_${process.pid}_${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const sql = `CREATE DATABASE ${pg.escapeIdentifier(name)}`;
  try {
    await adminPool().query(sql);
  } catch (err) {
    // 55006: template1 briefly in use by another CREATE DATABASE running in parallel.
    if (err.code !== '55006') throw err;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await adminPool().query(sql);
  }
  return {
    name,
    ownerUrl: withDatabase(process.env.DATABASE_URL, name),
    appUrl: withDatabase(process.env.APP_DATABASE_URL, name),
  };
}

export async function dropScratchDatabase(name) {
  await adminPool().query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(name)} WITH (FORCE)`);
}

export async function closePools() {
  const pools = [admin, app].filter(Boolean);
  admin = null;
  app = null;
  await Promise.all(pools.map((p) => p.end()));
}
