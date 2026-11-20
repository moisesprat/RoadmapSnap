/**
 * Tenant-transaction plugin. Every authenticated request runs on one client from the app-role
 * pool inside BEGIN ... COMMIT/ROLLBACK, and tenant context reaches Postgres only through
 * parameterized set_config(name, $1, true), which the RLS policies read via app_current_*().
 *
 * Request flow (setRequestContext):
 *   1. BEGIN, set app.current_auth0_id from the verified JWT subject.
 *   2. Find the users row (provision it in its own short transaction if missing).
 *   3. Set app.current_user_id, read the caller's memberships (member_self_select policy).
 *   4. Choose the active org: X-Org-Id, then ?orgId, else the oldest membership. A named org
 *      must be a valid UUID and one of the caller's memberships; nothing falls back silently.
 *   5. Set app.current_org_id; route handlers then run on request.dbClient under FORCE RLS.
 * onSend commits for statuses below 400 and rolls back otherwise; onRequestAbort and
 * onResponse release the client if the request never reached onSend.
 * Nobody is added to an organization here: membership comes only from seed tooling or an
 * explicit admin action.
 */

import { pool } from '../db/client.js';
import authPlugin from './auth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return value != null && UUID_REGEX.test(String(value));
}

/**
 * Pick the active org from the caller's memberships.
 * `requested` is the raw X-Org-Id / ?orgId value (or null/undefined when the caller named none).
 * Returns { status: 'ok', membership } where membership is null when the caller has none,
 * { status: 'invalid' } for a malformed id, or { status: 'not_a_member' }.
 */
export function selectOrg(memberships, requested) {
  const list = Array.isArray(memberships) ? memberships : [];
  const named = typeof requested === 'string' ? requested.trim() : requested;

  if (named == null || named === '') {
    return { status: 'ok', membership: list[0] ?? null };
  }
  if (typeof named !== 'string' || !isValidUuid(named)) {
    return { status: 'invalid' };
  }
  const wanted = named.toLowerCase();
  const membership = list.find((m) => String(m.org_id).toLowerCase() === wanted);
  if (!membership) return { status: 'not_a_member' };
  return { status: 'ok', membership };
}

function requestedOrgId(request) {
  const header = request.headers['x-org-id'];
  if (typeof header === 'string' && header.trim() !== '') return header;
  const query = request.query?.orgId;
  if (typeof query === 'string' && query.trim() === '') return null;
  return query ?? null;
}

async function finishTenantTx(request, commit) {
  const client = request.dbClient;
  if (!client) return;
  request.dbClient = null;
  let failure;
  try {
    const result = await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    // Postgres turns COMMIT of an aborted transaction into a ROLLBACK; pg reports it here.
    if (commit && result.command === 'ROLLBACK') {
      failure = new Error('COMMIT was turned into ROLLBACK');
    }
  } catch (err) {
    failure = err;
  } finally {
    // release(err) destroys the connection instead of returning a poisoned one to the pool.
    client.release(failure);
  }
  if (failure) throw failure;
}

async function contextPlugin(fastify) {
  fastify.decorateRequest('dbClient', null);
  fastify.decorateRequest('dbUser', null);
  fastify.decorateRequest('orgId', null);
  fastify.decorateRequest('memberships', null);

  fastify.decorate('setRequestContext', async function setRequestContext(request, reply) {
    if (!request.user?.sub) return;

    const auth0Id = request.user.sub;
    const client = await pool.connect();
    request.dbClient = client;
    await client.query('BEGIN');
    await client.query("select set_config('app.current_auth0_id', $1, true)", [auth0Id]);

    const selectUser = () =>
      client.query(
        'SELECT id, email, display_name, preferences FROM users WHERE auth0_id = $1',
        [auth0Id]
      );

    let userRes = await selectUser();
    if (userRes.rowCount === 0) {
      if (!request.user.email) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Token has no email claim',
          code: 'EMAIL_REQUIRED',
        });
      }
      // No conflict target: a duplicate email from a second identity must not abort the tx.
      await client.query(
        `INSERT INTO users (auth0_id, email, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [auth0Id, request.user.email, request.user.name ?? null]
      );
      userRes = await selectUser();
      if (userRes.rowCount === 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already linked to another account',
          code: 'EMAIL_IN_USE',
        });
      }
      // Provisioning commits in its own short transaction so a later 4xx in the route cannot
      // roll back the new user row.
      await client.query('COMMIT');
      await client.query('BEGIN');
      await client.query("select set_config('app.current_auth0_id', $1, true)", [auth0Id]);
    }

    const user = userRes.rows[0];
    await client.query("select set_config('app.current_user_id', $1, true)", [user.id]);

    const membershipRes = await client.query(
      `SELECT om.org_id, om.role, o.name
       FROM org_members om
       JOIN organizations o ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY om.created_at ASC, om.org_id ASC`,
      [user.id]
    );

    const selection = selectOrg(membershipRes.rows, requestedOrgId(request));
    if (selection.status === 'invalid') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid organization id',
        code: 'INVALID_ORG_ID',
      });
    }
    if (selection.status === 'not_a_member') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Not a member of this organization',
        code: 'NOT_A_MEMBER',
      });
    }

    const chosen = selection.membership;
    if (chosen) {
      await client.query("select set_config('app.current_org_id', $1, true)", [chosen.org_id]);
      request.orgId = chosen.org_id;
    }

    request.dbUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: chosen?.role ?? null,
      preferences:
        user.preferences && typeof user.preferences === 'object'
          ? user.preferences
          : { theme: 'light' },
    };
    request.memberships = membershipRes.rows.map((m) => ({
      id: m.org_id,
      name: m.name,
      role: m.role,
    }));
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    await finishTenantTx(request, reply.statusCode < 400);
    return payload;
  });

  fastify.addHook('onRequestAbort', async (request) => {
    try {
      await finishTenantTx(request, false);
    } catch (err) {
      request.log.error({ err }, 'tenant transaction cleanup failed after abort');
    }
  });

  // Leak safety net: a client still attached here never reached onSend.
  fastify.addHook('onResponse', async (request) => {
    if (!request.dbClient) return;
    try {
      await finishTenantTx(request, false);
    } catch (err) {
      request.log.error({ err }, 'tenant transaction cleanup failed after response');
    }
  });

  await fastify.register(authPlugin);
}

export default contextPlugin;
