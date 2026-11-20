/**
 * Catalog assertions: RLS stays enabled and forced on every tenant table, every policy reads
 * the app GUCs only through the NULLIF-safe app_current_*() readers, and the app role stays
 * hardened. Admin pool only, no API. Failure messages list the offending objects. This file
 * never skips: a missing database env fails it.
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireDbEnv, adminPool, closePools } from './helpers/db.js';

const APP_ROLE = 'roadmapsnap_app';
// The only public table allowed to have no RLS: it is migration bookkeeping the app role cannot read.
const NO_RLS_ALLOWLIST = new Set(['schema_migrations']);

before(() => {
  requireDbEnv();
});

after(async () => {
  await closePools();
});

async function rows(sql, params = []) {
  return (await adminPool().query(sql, params)).rows;
}

test('every public table except schema_migrations has RLS enabled and forced, and at least one policy', async () => {
  const tables = await rows(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
            (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`
  );
  assert.ok(tables.length > 5, `expected the tenant schema, found ${tables.length} tables`);
  const offenders = tables
    .filter((t) => !NO_RLS_ALLOWLIST.has(t.relname))
    .filter((t) => !t.relrowsecurity || !t.relforcerowsecurity || t.policies < 1)
    .map(
      (t) =>
        `${t.relname} (enabled=${t.relrowsecurity}, forced=${t.relforcerowsecurity}, policies=${t.policies})`
    );
  assert.deepEqual(offenders, [], `tables without enabled+forced RLS and a policy: ${offenders.join('; ')}`);
});

test('every table with an org_id column has an org_isolation policy', async () => {
  const missing = await rows(
    `SELECT c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM pg_attribute a
                     WHERE a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped)
        AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'org_isolation')
      ORDER BY c.relname`
  );
  assert.deepEqual(
    missing.map((r) => r.relname),
    [],
    `org_id tables without an org_isolation policy: ${missing.map((r) => r.relname).join(', ')}`
  );
});

test('the identity-stage policies exist on users, org_members and organizations', async () => {
  const expected = [
    ['users', 'user_self'],
    ['users', 'user_comember_select'],
    ['org_members', 'member_self_select'],
    ['organizations', 'member_orgs_select'],
  ];
  const present = await rows(
    `SELECT c.relname, p.polname
       FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'`
  );
  const have = new Set(present.map((r) => `${r.relname}.${r.polname}`));
  const missing = expected.map(([t, p]) => `${t}.${p}`).filter((k) => !have.has(k));
  assert.deepEqual(missing, [], `missing policies: ${missing.join(', ')}`);
});

test("no policy expression reads current_setting('app.current_...') directly", async () => {
  const policies = await rows(
    `SELECT c.relname, p.polname,
            coalesce(pg_get_expr(p.polqual, p.polrelid), '') AS using_expr,
            coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS check_expr
       FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'`
  );
  assert.ok(policies.length > 0, 'expected policies to inspect');
  const needle = "current_setting('app.current_";
  const offenders = policies
    .filter((p) => p.using_expr.includes(needle) || p.check_expr.includes(needle))
    .map((p) => `${p.relname}.${p.polname}`);
  assert.deepEqual(offenders, [], `policies that bypass the app_current_*() readers: ${offenders.join(', ')}`);
});

test('roadmapsnap_app is a plain, hardened role', async () => {
  const [role] = await rows(
    'SELECT rolsuper, rolbypassrls, rolconfig FROM pg_roles WHERE rolname = $1',
    [APP_ROLE]
  );
  assert.ok(role, `role ${APP_ROLE} must exist`);
  assert.equal(role.rolsuper, false, `${APP_ROLE} must not be superuser`);
  assert.equal(role.rolbypassrls, false, `${APP_ROLE} must not have BYPASSRLS`);

  const privilege = async (table, kind) =>
    (await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [APP_ROLE, table, kind]))[0].allowed;
  assert.equal(await privilege('schema_migrations', 'SELECT'), false, `${APP_ROLE} must not read schema_migrations`);
  assert.equal(await privilege('audit_events', 'UPDATE'), false, `${APP_ROLE} must not UPDATE audit_events`);
  assert.equal(await privilege('audit_events', 'DELETE'), false, `${APP_ROLE} must not DELETE audit_events`);

  const config = role.rolconfig ?? [];
  assert.ok(
    config.includes('idle_in_transaction_session_timeout=30s'),
    `rolconfig lacks idle_in_transaction_session_timeout=30s: ${JSON.stringify(config)}`
  );
  assert.ok(config.includes('row_security=on'), `rolconfig lacks row_security=on: ${JSON.stringify(config)}`);
});

test('the only SECURITY DEFINER function in public is audit_trigger_function, with a pinned search_path', async () => {
  const definers = await rows(
    `SELECT p.proname, p.proconfig
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
      ORDER BY p.proname`
  );
  const names = definers.map((d) => d.proname);
  assert.deepEqual(
    [...new Set(names)],
    ['audit_trigger_function'],
    `unexpected SECURITY DEFINER functions in public: ${names.join(', ')}`
  );
  for (const fn of definers) {
    assert.ok(
      (fn.proconfig ?? []).includes('search_path=public, pg_temp'),
      `${fn.proname} lacks search_path=public, pg_temp: ${JSON.stringify(fn.proconfig)}`
    );
  }
});
