# Phase 1: Tenant & Security Foundation - Pattern Map

**Mapped:** 2026-11-19
**Files analyzed:** 36 (new or modified)
**Analogs found:** 31 / 36 (all analog paths verified git-tracked via `git ls-files`; the 5 files with no analog are listed at the end)

Conventions that apply to every API file below (from AGENTS.md / .claude/CLAUDE.md): 2-space indent, semicolons, single quotes, trailing commas, relative imports with `.js`, error body `{ error, message }` (additive `code` allowed), `reply.status(n).send(...)` returned for expected 4xx, CLI logs prefixed (`migrate:`, `seed:`). App (`packages/app`): no semicolons.

## File Classification

| New/Modified File (all under `packages/api/` unless noted) | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/plugins/context.js` (rewrite: tenant tx hook pair) | middleware/plugin | request-response (tx) | itself (current) + `src/plugins/rbac.js` for decorator style | rewrite |
| `src/plugins/auth.js` (local JWKS, no header bypass, alg pin) | middleware/plugin | request-response | itself (current) | rewrite |
| `src/plugins/rbac.js` (`NO_ORG` code via shared `requireOrg`) | middleware | request-response | itself | modify |
| `src/db/tenant.js` (new: identity/org resolution over a pg client) | service | CRUD (tx) | `src/plugins/context.js` lines 35-140 (logic to extract) | role-match |
| `src/db/client.js` (factory, `APP_DATABASE_URL`, close on shutdown) | config/utility | pool | itself | modify |
| `src/db/types.js` (new: DATE parser) | utility | transform | none (one-liner) | no analog |
| `src/db/bootChecks.js` (new) | utility | request-response (startup) | `src/plugins/auth.js` lines 12-14 (startup throw) | partial |
| `src/db/migrate.js` (export `migrate()` + CLI guard) | utility/CLI | batch | `src/server.js` lines 65-73 (CLI guard) + itself | role-match |
| `src/db/migrations/V13__tenant_policies.sql` (new) | migration | schema | `V2__rls_policies.sql`, `V4__app_role.sql`, `V6__force_rls.sql` | exact |
| `src/db/migrations/V7,V8,V9,V11,V12` (stubs) + `V10` (keep indexes) | migration | schema | `V10__dependencies_index_and_seed.sql` lines 1-4 | exact |
| `src/db/migrations/V2__rls_policies.sql` (guard `TO postgres`, optional) | migration | schema | itself | modify |
| `src/db/migrations/README.md` | docs | - | itself | modify |
| `src/db/seeds/dev.js` (new `seed:dev`) | CLI/service | batch (tx per org) | `src/db/migrate.js` (CLI shape, `migrate:` prefix) + `src/db/audit.js` (client-taking helper) | role-match |
| `src/lib/dates.js` (new) | utility | transform | none | no analog |
| `src/routes/workspaces.js` (drop `formatPlannedDate`, ISO dates, `NO_ORG`) | route | CRUD | itself | modify |
| `src/routes/projects.js` (`NO_ORG` consolidation) | route | CRUD | itself | modify |
| `src/routes/auth.js` (`orgs: []`, `role: null`) | route | request-response | itself | modify |
| `src/server.js` (env schema, boot checks, CORS rule, remove defaults) | config/entry | startup | itself | modify |
| `.env.example` | config | - | itself | modify |
| `package.json` (`seed:dev`, `test:tz`, drop `seed:config`) | config | - | itself | modify |
| `scripts/generate-config-seed.mjs` | delete | - | - | delete |
| `scripts/dev-token.mjs` (optional) | CLI | transform | `tests/helpers/auth.js` pattern (below) | partial |
| `tests/helpers/auth.js` (new) | test util | transform | RESEARCH Pattern 4 (jose spike) + `tests/workspaces.test.js` `authHeaders` | partial |
| `tests/helpers/db.js` (new) | test util | CRUD | `tests/rls.test.js` lines 1-65 | role-match |
| `tests/tenant-isolation.test.js`, `tests/tenant-tx.test.js` | test | request-response | `tests/workspaces.test.js` + `tests/rls.test.js` | role-match |
| `tests/rls-catalog.test.js` | test | catalog query | `tests/rls.test.js` | role-match |
| `tests/boot-checks.test.js`, `tests/no-bypass.test.js` | test | unit/static | `tests/auth.test.js` | role-match |
| `tests/seed-fresh.test.js`, `tests/seed-dev.test.js` | test | batch | `tests/rls.test.js` (admin pool) | role-match |
| `tests/dates.test.js` | test | request-response | `tests/workspaces.test.js` | role-match |
| `tests/auth.test.js`, `projects.test.js`, `workspaces.test.js`, `rls.test.js` (migrate auth helper) | test | request-response | themselves | modify |
| `.github/workflows/api-ci.yml` (add `test:tz`) | config | CI | itself | modify |
| `compose.yaml` + `packages/api/Dockerfile` (new skeleton) | config | orchestration | none tracked (no docker files in repo) | no analog |
| `packages/app/src/api/client.ts` (ISO -> DD/MM/YYYY adapter) + `client.test.ts` | service/test | transform | `getWorkspaceProjects` (client.ts:144) and `client.test.ts` | role-match |

## Pattern Assignments

### `src/plugins/context.js` (plugin, request-response, tx)

**Analog:** itself (keep decorator name `setRequestContext`; keep `await fastify.register(authPlugin)` at the end so routes stay in this scope and the hooks cover them).

**Decorator + skip pattern to keep** (lines 17-20). Replace the dead `request.routerPath` guard with `request.routeOptions.url` or delete it:
```javascript
async function contextPlugin(fastify) {
  fastify.decorate('setRequestContext', async function setRequestContext(request, reply) {
    if (request.routerPath === '/health') return;   // dead in Fastify 5 (F7)
    if (!request.user?.sub) return;
```
Add `fastify.decorateRequest('dbClient', null)`, same for `dbUser`, `orgId`, `tenantCommit`.

**UUID validation to keep** (lines 11-15): `UUID_REGEX` / `isValidUuid`. Change behavior: malformed `X-Org-Id` -> 400, not silent fallback.

**Lines to delete:** 22-33 (`pool.connect` + `finish`/`close` release, replaced by BEGIN and the `onSend`/`onRequestAbort` hooks), 81-89 (seed-org auto-join), 126-140 ("most workspaces" heuristic; use `ORDER BY created_at ASC`), 142-164 (dev bootstrap, `row_security = off`, second `pool.connect()`), 175-178 (interpolated `SET LOCAL`).

**Replacement core** (RESEARCH "Tenant context resolution" and Pattern 1, verified):
```javascript
await c.query('BEGIN');
await c.query("select set_config('app.current_auth0_id', $1, true)", [auth0Id]);
// SELECT user; INSERT ... ON CONFLICT (auth0_id) DO NOTHING; re-SELECT
await c.query("select set_config('app.current_user_id', $1, true)", [user.id]);
const memberships = (await c.query(
  'select org_id, role from org_members where user_id = $1 order by created_at asc', [user.id])).rows;
await c.query("select set_config('app.current_org_id', $1, true)", [orgId]);
```
Hooks (copy from RESEARCH Pattern 1): `finish(request, commit)` checks `result.command === 'ROLLBACK'`, `client.release(destroy)`; `onSend` commits when `reply.statusCode < 400 || request.tenantCommit`; `onRequestAbort` rolls back. Set `request.tenantCommit = true` before replying 403 `NO_ORG`/`NOT_A_MEMBER` so the user upsert persists.

**Keep (lines 97-100)** the `preferences` default: `row.preferences && typeof row.preferences === 'object' ? row.preferences : { theme: 'light' }`. The `42703` missing-`preferences` fallbacks (44-54, 71-79) can be dropped (V5 is applied everywhere); inside a tx, a caught error would abort it.

### `src/plugins/auth.js` (plugin, request-response)

**Analog:** itself. **Keep** lines 8-18 (config read, startup throw, issuer), 36-50 (Bearer parsing and 401 shapes), 63-69 (401 `Invalid token` with `fastify.log.warn`), 72-77 (route registration).

**Delete** lines 21-34 (the `X-Test-User-Sub` block).

**Change** line 18 and 53-56:
```javascript
const JWKS = fastify.config.AUTH_TEST_JWKS
  ? createLocalJWKSet(JSON.parse(fastify.config.AUTH_TEST_JWKS))
  : createRemoteJWKSet(new URL(jwksUrl));
const { payload } = await jwtVerify(token, JWKS, { issuer, audience, algorithms: ['RS256'] });
```
Also stop spreading raw `...payload` into `request.user` if `/auth/me` should not echo the whole JWT (see `routes/auth.js` line 13 spread).

### `src/plugins/rbac.js` (middleware)

**Analog:** itself, lines 16-38. Change only the first guard (lines 17-22) to the D-12 body:
```javascript
if (request.orgId == null) {
  return reply.status(403).send({ error: 'Forbidden', message: 'No organization', code: 'NO_ORG' });
}
```
Per AGENTS.md, handlers should use `fastify.requireRole`. The duplicated local `requireRole` in `routes/workspaces.js:6-23` and `routes/projects.js` also hard-codes the old message; either delete them in favor of `fastify.requireRole` (RESEARCH: optional cleanup if the plan already touches the file) or update them identically. The hand-checks `if (request.orgId == null)` in handlers (`projects.js` ~line 76) need the same body.

### `src/db/client.js` (utility, pool)

**Analog:** itself (lines 5-35). Keep the lazy-singleton shape and the `pool` facade, but: read `APP_DATABASE_URL` (line 9; error text updated), add `import './types.js'` first, export `createPool(url)` (so boot tests can pass a superuser URL), set explicit `max`, and add `await pool.end()` on Fastify `onClose`. Route files must not import this module (grep guard in `tests/no-bypass.test.js`).

### `src/db/bootChecks.js` (new, utility)

**Analog:** `plugins/auth.js:12-14` startup-throw convention: `throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE must be set');`. Body: copy RESEARCH Pattern 3 (`assertSafeConfig(config)` for D-10 b/c/e and missing `APP_DATABASE_URL`; `assertSafeDbRole(pool)` using `BOOT_CHECK_SQL` with `pg_has_role(current_user, c.relowner, 'USAGE')`). Call from `build()` in `server.js` after `fastifyEnv` and before registering plugins. Log prefix not required (it throws).

### `src/db/migrate.js` (CLI, batch)

**Analog:** itself (lines 55-118 in file: `run()` loop with filename-only version check, `BEGIN`/`COMMIT`/`ROLLBACK` per file) plus the CLI guard from `server.js:65-73`:
```javascript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => { ... })().catch((err) => { console.error(err); process.exit(1); });
}
```
Refactor: `export async function migrate(databaseUrl, dir = MIGRATIONS_DIR)`; replace the unconditional `run().then(() => process.exit(0))` at the bottom with the guard. Keep `migrate:` log prefix and the numeric-sort on `V(\d+)`.

### `src/db/migrations/V13__tenant_policies.sql` (migration)

**Analogs:** `V2__rls_policies.sql` (policy names `org_isolation`, per-table `ALTER ... ENABLE ROW LEVEL SECURITY`), `V4__app_role.sql` (idempotent `DO $$` role guard, `ALTER ROLE roadmapsnap_app SET row_security = on;`), `V6__force_rls.sql` (FORCE RLS). Body: copy the verified draft from RESEARCH Pattern 2 verbatim (`app_current_org_id()` etc., `ALTER POLICY org_isolation ... USING (id = app_current_org_id())` for all 11 tables, `member_self_select`, `member_orgs_select`, `users` RLS + `user_self` + `user_comember_select`), plus the A2 items if confirmed (`REVOKE ... schema_migrations`, `REVOKE UPDATE, DELETE ON audit_events`, `ALTER FUNCTION audit_trigger_function() SET search_path`, `idle_in_transaction_session_timeout`). Idempotent style from V4:
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roadmapsnap_app') THEN
    CREATE ROLE roadmapsnap_app WITH LOGIN PASSWORD 'apppassword' NOSUPERUSER;
  END IF;
END $$;
```
(Do not touch the hard-coded password; DEP-02 in Phase 7.)

### V7, V8, V9, V11, V12 stubs and V10 (migration)

**Analog:** `V10__dependencies_index_and_seed.sql` lines 1-4. Keep exactly:
```sql
CREATE INDEX IF NOT EXISTS idx_dependencies_to_project ON dependencies(to_project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_from_project ON dependencies(from_project_id);
```
and delete the seed `INSERT` (line 6 onward). Other stubs are comment-only SQL with a header explaining D-01 (why: demo data moved to `seed:dev`; filename kept so `schema_migrations` versions are unchanged; documented exception to the immutability rule). Do not re-introduce real program names (D-03).

### `src/db/seeds/dev.js` (CLI, batch)

**Analogs:** `src/db/migrate.js` (CLI guard, `pg.Client` on `DATABASE_URL`, try/finally `client.end()`, prefixed logs) and `src/db/audit.js:22-48` (exported function taking a pg `client`, so the module is importable for the Phase 7 smoke test):
```javascript
export async function emitAuditEvent(client, { orgId, userId, ... }) {
  const res = await client.query(`INSERT INTO audit_events (...) VALUES ($1, ...) RETURNING id`, [...]);
```
Shape: `export async function seedDev({ client, sub, email })`; one tx per org; `select set_config('app.current_org_id', $1, true)` and `app.current_user_id` (parameterized) before inserts; `ON CONFLICT` idempotency; refuse when `NODE_ENV === 'production'` or no sub; log prefix `seed:`. Data embedded by hand from `js/config_base.js` (do not eval it).

### `src/routes/workspaces.js` (route, CRUD)

**Analog:** itself. Delete `formatPlannedDate` (lines 30-38 region; it becomes a day-shift bug once the DATE parser is registered) and pass milestone DATE values through as the raw string or null. Keep `commonPreHandler` composition (line 52): `const commonPreHandler = [fastify.authenticate, fastify.setRequestContext];` and `request.dbClient` usage.

### `src/routes/auth.js` (route)

**Analog:** itself. `GET /auth/me` (lines 9-17) returns `role: request.dbUser?.role ?? 'viewer'`; change to `role: request.dbUser?.role ?? null` and add `orgs` (memberships list from the tenant context). `PATCH /auth/me` keeps `[authenticate, setRequestContext]` and the `request.dbClient.query('UPDATE users SET preferences = ...')` pattern (lines 53-58); with `users` RLS this works because the `user_self` policy matches `id = app_current_user_id()`. The context step must not 403 by itself for these routes (Pitfall 6).

### `src/server.js` (entry)

**Analog:** itself. Env schema (lines 13-25): remove defaults for `NODE_ENV` and `DATABASE_URL` (lines 17, 19), delete `DEFAULT_ORG_ID` (23), add `APP_DATABASE_URL`, optional `AUTH_TEST_JWKS`, add `NODE_ENV`/`APP_DATABASE_URL` to `required` (15). Keep `build()` shape and the CLI guard (65-73). CORS (37-39): keep `origin: fastify.config.CORS_ORIGIN`, with the production refusal living in `assertSafeConfig`.

### `tests/helpers/db.js` (test util)

**Analog:** `tests/rls.test.js` lines 1-53. Reuse the two-pool pattern and unique-fixture idiom:
```javascript
import '../src/loadEnv.js';
import pg from 'pg';
const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const APP_DATABASE_URL = process.env.APP_DATABASE_URL ?? (...replace creds with roadmapsnap_app:apppassword...);
adminClient = new Pool({ connectionString: DATABASE_URL });
appClient = new Pool({ connectionString: APP_DATABASE_URL });
```
and `tests/workspaces.test.js:36-58` for fixtures (unique slug `ws-test-org-${process.pid}-${Date.now()}`, `ON CONFLICT ... DO UPDATE`). Fix rls.test.js's `queryAs` (lines 27-42): it uses interpolated `SET LOCAL app.current_org_id = '${orgId}'`; switch to `select set_config('app.current_org_id', $1, true)`. Import `../../src/db/types.js` first. Do not use blanket `LIKE '%-test'` cleanups (parallel files).

### `tests/helpers/auth.js` (test util)

**Analog:** `tests/workspaces.test.js:22-26` `authHeaders(sub, orgId)` helper (replace `x-test-user-sub` with `authorization: Bearer <signToken(...)>`); signing code from RESEARCH Pattern 4 (`generateKeyPair('RS256')`, `exportJWK`, `SignJWT`, set `process.env.AUTH_TEST_JWKS` before `build()`). Always include `email` in tokens (unique per sub; Pitfall 7).

### Test files (tenant-isolation, tenant-tx, boot-checks, no-bypass, rls-catalog, seed-*, dates)

**Analog:** `tests/workspaces.test.js` / `tests/auth.test.js`. Boilerplate to copy (auth.test.js 1-18):
```javascript
import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'test.auth0.com';
process.env.AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://test.api';
let app;
before(async () => { app = await build(); await app.ready(); });
after(async () => { await app.close(); });
```
Requests via `app.inject({ method, url, headers })`. Gate DB tests with `runWorkspaceTests = Boolean(DATABASE_URL)` style (workspaces.test.js:14). Catalog SQL and dates skeleton: RESEARCH "Catalog test" and "Dates test skeleton". Existing `tests/auth.test.js` line 5-7 sets env after imports; with required `NODE_ENV`/`APP_DATABASE_URL`, move env wiring into the helper.

### `packages/app/src/api/client.ts` + `client.test.ts` (ISO adapter)

**Analog:** `client.ts:144-146`:
```typescript
getWorkspaceProjects(id: string): Promise<WorkspaceWithProjects> {
  return this.request('GET', `/api/v1/workspaces/${id}/projects`)
}
```
Wrap the result, converting milestone ISO strings to `DD/MM/YYYY` by `split('-')` (no `Date`), no semicolons. Test: copy `client.test.ts` lines 1-25 (`vi.stubGlobal('fetch', ...)`, `createApiClient(() => Promise.resolve('header.payload.signature'))`). `lib/timeline.ts:50-59` `parseDate` accepts only `DD/MM/YYYY`, which is why the adapter is needed until Phase 2.

### `.github/workflows/api-ci.yml`

**Analog:** itself. Add after "Run API tests" a step running `npm run test:tz` with the same env block (lines 55-63). The "Pre-create app role" step (lines 44-48) stays.

## Shared Patterns

### Error body shape
**Source:** `src/plugins/rbac.js:17-22`, `src/plugins/auth.js:38-41`
**Apply to:** all plugin and route 4xx responses
```javascript
return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
```
`code` is additive (`NO_ORG`, `NOT_A_MEMBER`).

### `request.dbClient` only
**Source:** `src/routes/auth.js:53`, `src/routes/projects.js:84`
**Apply to:** every route handler (`const client = request.dbClient;`); never import `pool` outside `src/db/` and `src/plugins/context.js`. Enforce with a static grep test.

### preHandler composition
**Source:** `src/routes/workspaces.js:52`
**Apply to:** all route files: `[fastify.authenticate, fastify.setRequestContext]`, then `fastify.requireRole('editor')` for writes.

### Startup refusal convention
**Source:** `src/plugins/auth.js:12-14` (throw at registration); `src/server.js:65-73` (CLI `catch` -> `console.error` + `process.exit(1)`).
**Apply to:** `bootChecks.js`, `seed:dev` guards.

### Idempotent SQL
**Source:** `V4__app_role.sql` (`DO $$ ... IF NOT EXISTS`), `V10` (`CREATE INDEX IF NOT EXISTS`), `tests/workspaces.test.js:40-43` (`ON CONFLICT ... DO UPDATE`)
**Apply to:** V13, seed, test fixtures.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/db/types.js` | utility | transform | New concept; use `pg.types.setTypeParser(1082, (v) => v)` from RESEARCH Pattern 5 |
| `src/lib/dates.js` | utility | transform | No shared schema helpers exist; `{ type: 'string', format: 'date' }` |
| `compose.yaml` | config | orchestration | No tracked compose or Dockerfile exists; follow RESEARCH Pattern 8 (postgres healthcheck, migrate job, api depends_on `service_completed_successfully`) |
| `packages/api/Dockerfile` | config | build | Same; build context `./packages/api`, `npm ci --omit=dev`, Node 22/24 alpine (provisional) |
| `scripts/dev-token.mjs` (optional) | CLI | transform | Only the RESEARCH jose snippet exists |

## Metadata

**Analog search scope:** `packages/api/src`, `packages/api/tests`, `packages/api/src/db/migrations`, `packages/app/src/api`, `.github/workflows`
**Files scanned:** about 20 read; tracked-file check via `git ls-files` (no gitignored mirrors used; no `.gsd/capabilities` paths involved)
**Pattern extraction date:** 2026-11-19
