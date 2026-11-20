/**
 * RoadmapSnap API — explicit dev seed (ES module), `npm run seed:dev -- --sub <auth0 sub>`.
 * Creates two synthetic demo orgs (see devData.js): the subject becomes admin of Demo Org A, and
 * Demo Org B is owned by a synthetic user. Idempotent: every write is an upsert or WHERE NOT EXISTS.
 *
 * Runs only as the owner role from DATABASE_URL, from a developer's shell, and never at request
 * time (D-06, D-11). Refused when NODE_ENV=production (D-02). The tenant GUCs are set inside each
 * org transaction so the audit trigger attributes the rows. Importable as seedDev() for reuse by
 * the Phase 7 smoke test; running the file directly is the CLI.
 */

import '../../loadEnv.js';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_ADMIN_EMAIL, DEMO_ORG_A, DEMO_ORG_B } from './devData.js';

const MEMBER_ROLES = ['viewer', 'editor', 'admin'];

async function upsertUser(client, { sub, email, name }) {
  await client.query("select set_config('app.current_auth0_id', $1, true)", [sub]);
  const res = await client.query(
    `INSERT INTO users (auth0_id, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (auth0_id) DO UPDATE
       SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
     RETURNING id`,
    [sub, email, name]
  );
  await client.query("select set_config('app.current_user_id', $1, true)", [res.rows[0].id]);
  return res.rows[0].id;
}

async function upsertMember(client, orgId, userId, role) {
  await client.query(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [orgId, userId, role]
  );
}

async function upsertWorkspace(client, orgId, createdBy, ws) {
  const res = await client.query(
    `INSERT INTO workspaces
       (org_id, name, slug, workflow_definition, entity_labels, dashboard_text, settings, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
     ON CONFLICT (org_id, slug) DO UPDATE
       SET name = EXCLUDED.name,
           workflow_definition = EXCLUDED.workflow_definition,
           entity_labels = EXCLUDED.entity_labels,
           dashboard_text = EXCLUDED.dashboard_text,
           settings = EXCLUDED.settings
     RETURNING id`,
    [
      orgId,
      ws.name,
      ws.slug,
      JSON.stringify(ws.workflow_definition),
      JSON.stringify(ws.entity_labels),
      JSON.stringify(ws.dashboard_text),
      JSON.stringify(ws.settings),
      createdBy,
    ]
  );
  return res.rows[0].id;
}

async function upsertProjects(client, orgId, workspaceId, projects) {
  const ids = new Map();
  for (const p of projects) {
    const res = await client.query(
      `INSERT INTO projects
         (org_id, workspace_id, name, group_name, at_risk, show_in_timeline, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, name) DO UPDATE
         SET group_name = EXCLUDED.group_name,
             at_risk = EXCLUDED.at_risk,
             show_in_timeline = EXCLUDED.show_in_timeline,
             display_order = EXCLUDED.display_order
       RETURNING id`,
      [orgId, workspaceId, p.name, p.group_name, p.at_risk, p.show_in_timeline, p.display_order]
    );
    const projectId = res.rows[0].id;
    ids.set(p.name, projectId);
    for (const [key, isoDate] of Object.entries(p.milestones)) {
      // ISO string cast on the server, never a JS Date, so no timezone can shift the day.
      await client.query(
        `INSERT INTO milestones (org_id, project_id, milestone_key, planned_date)
         VALUES ($1, $2, $3, $4::date)
         ON CONFLICT (project_id, milestone_key) DO UPDATE SET planned_date = EXCLUDED.planned_date`,
        [orgId, projectId, key, isoDate]
      );
    }
  }
  return ids;
}

async function insertDependencies(client, orgId, projectIds, dependencies) {
  for (const d of dependencies) {
    await client.query(
      `INSERT INTO dependencies (org_id, from_project_id, to_project_id, from_milestone_key, to_milestone_key)
       SELECT $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
       WHERE NOT EXISTS (
         SELECT 1 FROM dependencies
          WHERE org_id = $1::uuid AND from_project_id = $2::uuid AND to_project_id = $3::uuid
            AND from_milestone_key IS NOT DISTINCT FROM $4::text
            AND to_milestone_key IS NOT DISTINCT FROM $5::text
       )`,
      [
        orgId,
        projectIds.get(d.from),
        projectIds.get(d.to),
        d.from_milestone_key ?? null,
        d.to_milestone_key ?? null,
      ]
    );
  }
}

/**
 * Seed one org in its own transaction. `admin` is the user who owns it; `extraMembers` are
 * { userId, role } rows added after the admin.
 */
async function seedOrg(client, org, admin, extraMembers = []) {
  await client.query('BEGIN');
  try {
    const orgRes = await client.query(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [org.name, org.slug]
    );
    const orgId = orgRes.rows[0].id;
    await client.query("select set_config('app.current_org_id', $1, true)", [orgId]);

    const adminUserId = await upsertUser(client, admin);
    await upsertMember(client, orgId, adminUserId, 'admin');
    for (const m of extraMembers) await upsertMember(client, orgId, m.userId, m.role);

    const workspaceId = await upsertWorkspace(client, orgId, adminUserId, org.workspace);
    const projectIds = await upsertProjects(client, orgId, workspaceId, org.projects);
    await insertDependencies(client, orgId, projectIds, org.dependencies);
    await client.query('COMMIT');
    return { id: orgId, workspaceId, adminUserId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Seed Demo Org A (the subject is admin) and Demo Org B (owned by a synthetic user).
 * @param {object} opts
 * @param {import('pg').Client} opts.client - connected pg client on the owner URL
 * @param {string} opts.sub - Auth0 subject of the developer
 * @param {string} [opts.email]
 * @param {string} [opts.name]
 * @param {null|'viewer'|'editor'|'admin'} [opts.memberOfB] - also join Demo Org B with this role
 * @returns {Promise<{ orgA: {id, workspaceId}, orgB: {id, workspaceId}, adminUserId: string }>}
 */
export async function seedDev({
  client,
  sub,
  email = DEFAULT_ADMIN_EMAIL,
  name = 'Dev Admin',
  memberOfB = null,
}) {
  if (typeof sub !== 'string' || sub.trim() === '') {
    throw new Error('seed: sub is required');
  }
  if (memberOfB !== null && !MEMBER_ROLES.includes(memberOfB)) {
    throw new Error(`seed: memberOfB must be null or one of ${MEMBER_ROLES.join(', ')}`);
  }

  const orgA = await seedOrg(client, DEMO_ORG_A, { sub, email, name });
  const extraMembers = memberOfB ? [{ userId: orgA.adminUserId, role: memberOfB }] : [];
  const orgB = await seedOrg(client, DEMO_ORG_B, DEMO_ORG_B.admin, extraMembers);

  return {
    orgA: { id: orgA.id, workspaceId: orgA.workspaceId },
    orgB: { id: orgB.id, workspaceId: orgB.workspaceId },
    adminUserId: orgA.adminUserId,
  };
}

function fail(message) {
  console.error(`seed: ${message}`);
  process.exit(1);
}

async function main() {
  // Guards run in this order and before any connection is opened.
  if (process.env.NODE_ENV === 'production') fail('refusing to run with NODE_ENV=production');

  const { values } = parseArgs({
    options: {
      sub: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      'member-of-b': { type: 'string' },
    },
  });

  const sub = values.sub || process.env.DEV_ADMIN_SUB;
  if (!sub) fail('--sub or DEV_ADMIN_SUB is required');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL (owner role) is required');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await seedDev({
      client,
      sub,
      email: values.email || process.env.DEV_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
      name: values.name || 'Dev Admin',
      memberOfB: values['member-of-b'] || null,
    });
    console.log(`seed: Demo Org A and Demo Org B ready (admin ${sub})`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message.startsWith('seed:') ? err.message : `seed: ${err.message}`);
    process.exit(1);
  });
}
