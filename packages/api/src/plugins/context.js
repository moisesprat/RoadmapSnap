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
 * Finalizing (commit for statuses below 400, rollback otherwise; then release the client):
 *   - onSend finalizes every request that sends a response.
 *   - An onRoute settle guard finalizes a handler that ends without a response: Fastify sends
 *     nothing when an async handler resolves undefined after the client disconnected.
 *   - onResponse is the leak net for anything that reached neither of the above.
 *   - onRequestAbort only logs. The handler may still be using its client, so releasing it there
 *     would hand a tenant's connection to another request. A disconnect does not change the
 *     outcome: the transaction ends when the handler settles.
 * Nobody is added to an organization here: membership comes only from seed tooling or an
 * explicit admin action.
 */

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

/** pg-pool drops its own listener while a client is checked out; an unhandled 'error' would crash. */
export function logCheckedOutClientError(err) {
  console.error('pg client: error on a checked-out client:', err.message);
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
    // pg-pool re-adds its idle listener synchronously inside release, so there is no gap.
    client.removeListener('error', logCheckedOutClientError);
    client.release(failure);
  }
  if (failure) throw failure;
}

/**
 * Wraps a route handler so a handler that settles with `undefined` (Fastify then skips
 * reply.send, and therefore onSend, when the client is gone) still finalizes its transaction.
 * Rejections are left alone: Fastify sends the error, so onSend rolls it back.
 */
function withTenantSettleGuard(handler) {
  return function tenantSettleGuard(request, reply) {
    const result = handler.call(this, request, reply);
    if (!result || typeof result.then !== 'function') return result;
    return result.then(async (payload) => {
      if (payload === undefined && request.dbClient) {
        await finishTenantTx(request, reply.statusCode < 400);
      }
      return payload;
    });
  };
}

async function contextPlugin(fastify, opts) {
  const { pool } = opts;
  fastify.decorateRequest('dbClient', null);
  fastify.decorateRequest('dbUser', null);
  fastify.decorateRequest('orgId', null);
  fastify.decorateRequest('memberships', null);

  fastify.decorate('setRequestContext', async function setRequestContext(request, reply) {
    if (!request.user?.sub) return;

    const auth0Id = request.user.sub;
    const client = await pool.connect();
    client.on('error', logCheckedOutClientError);
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
    request.log.info('request aborted; the tenant transaction is finalized when the handler settles');
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

  // Registered before authPlugin so every route it declares (auth, workspaces, projects and
  // extraRoutes) gets the settle guard. Hooks are encapsulated: the root and /health routes are
  // outside this scope and have no tenant transaction.
  fastify.addHook('onRoute', (routeOptions) => {
    routeOptions.handler = withTenantSettleGuard(routeOptions.handler);
  });

  await fastify.register(authPlugin, { extraRoutes: opts.extraRoutes });
}

export default contextPlugin;
