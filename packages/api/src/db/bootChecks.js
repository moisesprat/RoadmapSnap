/**
 * Startup refusal checks (SEC-02, D-10). build() runs assertSafeConfig on the env first, then
 * assertSafeDbRole on the app pool, so the process never serves under a role that could bypass
 * row-level security or under a config that exposes test auth or an open CORS policy.
 * There is deliberately no flag, env var or NODE_ENV value that skips or softens either check.
 */

const KNOWN_ENVS = ['development', 'test', 'production'];

/**
 * One row about the connected role. pg_has_role(..., 'USAGE') is used instead of comparing owner
 * oids so a role that only inherits the table owner is caught: it could run
 * ALTER TABLE ... DISABLE ROW LEVEL SECURITY. The role name column is added for error messages.
 */
export const BOOT_CHECK_SQL = `
  SELECT r.rolname AS role, r.rolsuper, r.rolbypassrls,
         current_setting('is_superuser') AS is_superuser_guc,
         EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                   AND pg_has_role(current_user, c.relowner, 'USAGE')) AS owns_or_inherits_owner
  FROM pg_roles r WHERE r.rolname = current_user`;

function refuse(reason) {
  return new Error(`Refusing to start: ${reason}`);
}

/**
 * Env-only checks, no database access. `config` is fastify.config (or any object with the same keys).
 */
export function assertSafeConfig(config) {
  const env = config.NODE_ENV;
  if (typeof env !== 'string' || !KNOWN_ENVS.includes(env)) {
    throw refuse(`NODE_ENV must be one of ${KNOWN_ENVS.join(', ')} (got ${JSON.stringify(env ?? null)})`);
  }
  const dbUrl = config.APP_DATABASE_URL;
  if (typeof dbUrl !== 'string' || dbUrl.trim() === '') {
    throw refuse('APP_DATABASE_URL must be set to the roadmapsnap_app connection string');
  }
  if (env === 'production') {
    const jwks = config.AUTH_TEST_JWKS;
    if (typeof jwks === 'string' && jwks !== '') {
      throw refuse('AUTH_TEST_JWKS must not be set when NODE_ENV=production');
    }
    const origin = typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN.trim() : '';
    if (origin === '' || origin === '*') {
      throw refuse('CORS_ORIGIN must be an explicit origin when NODE_ENV=production');
    }
  }
}

/**
 * Checks the role behind `pool` and returns { role } when it is safe to serve as.
 */
export async function assertSafeDbRole(pool) {
  const { rows } = await pool.query(BOOT_CHECK_SQL);
  const row = rows[0];
  if (!row) throw refuse('could not read the database role');
  const name = row.role;
  if (row.rolsuper || row.is_superuser_guc === 'on') {
    throw refuse(`database role "${name}" is a superuser`);
  }
  if (row.rolbypassrls) {
    throw refuse(`database role "${name}" has BYPASSRLS`);
  }
  if (row.owns_or_inherits_owner) {
    throw refuse(`database role "${name}" owns or inherits the owner of public tables`);
  }
  return { role: name };
}
