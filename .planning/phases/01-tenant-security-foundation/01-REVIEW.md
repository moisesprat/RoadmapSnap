---
phase: 01-tenant-security-foundation
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - .env.example
  - .github/workflows/api-ci.yml
  - .gitignore
  - compose.yaml
  - packages/api/.dockerignore
  - packages/api/.env.example
  - packages/api/.gitignore
  - packages/api/Dockerfile
  - packages/api/package.json
  - packages/api/scripts/dev-token.mjs
  - packages/api/src/db/bootChecks.js
  - packages/api/src/db/client.js
  - packages/api/src/db/migrate.js
  - packages/api/src/db/migrations/README.md
  - packages/api/src/db/migrations/V10__dependencies_index_and_seed.sql
  - packages/api/src/db/migrations/V11__seed_dependencies_from_config.sql
  - packages/api/src/db/migrations/V12__backfill_group_order.sql
  - packages/api/src/db/migrations/V13__tenant_policies.sql
  - packages/api/src/db/migrations/V7__seed_projects_from_config.sql
  - packages/api/src/db/migrations/V8__add_users_to_seed_org.sql
  - packages/api/src/db/migrations/V9__backfill_workspace_workflows.sql
  - packages/api/src/db/seeds/dev.js
  - packages/api/src/db/seeds/devData.js
  - packages/api/src/db/types.js
  - packages/api/src/lib/dates.js
  - packages/api/src/loadEnv.js
  - packages/api/src/plugins/auth.js
  - packages/api/src/plugins/context.js
  - packages/api/src/plugins/rbac.js
  - packages/api/src/routes/auth.js
  - packages/api/src/routes/projects.js
  - packages/api/src/routes/workspaces.js
  - packages/api/src/server.js
  - packages/api/tests/auth.test.js
  - packages/api/tests/boot-checks.test.js
  - packages/api/tests/dates.test.js
  - packages/api/tests/helpers/auth.js
  - packages/api/tests/helpers/db.js
  - packages/api/tests/no-bypass.test.js
  - packages/api/tests/projects.test.js
  - packages/api/tests/rls-catalog.test.js
  - packages/api/tests/rls.test.js
  - packages/api/tests/seed-dev.test.js
  - packages/api/tests/seed-fresh.test.js
  - packages/api/tests/tenant-isolation.test.js
  - packages/api/tests/tenant-tx.test.js
  - packages/api/tests/workspaces.test.js
  - packages/app/src/api/client.test.ts
  - packages/app/src/api/client.ts
findings:
  critical: 2
  warning: 10
  info: 6
  total: 18
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

## Summary

The RLS model is sound in the main path: the app role is non-superuser, tenant GUCs go through parameterized `set_config(..., true)`, org selection is validated against the caller's memberships, and COMMIT-turned-ROLLBACK is detected. Two defects undermine the phase goal. First, the `onRequestAbort` cleanup releases the tenant client while the handler still holds a reference to it, so the handler's later queries can run on a connection already handed to another tenant's request. Second, the API stores `external_link` unvalidated and the app renders it as an `href`, which allows stored XSS by any editor against every other member. Several robustness gaps follow, mainly pool error handling, auth ordering, and unhandled unique violations. The test suite has no coverage of the abort path.

Per instruction, no real `.env` file was read. Structural findings (fallow) were not provided.

## Critical Issues

### CR-01: onRequestAbort releases the tenant client while the handler still uses it

**File:** `packages/api/src/plugins/context.js:186-192` (with `finishTenantTx` at 57-75; handlers in `routes/workspaces.js`, `routes/projects.js`)
**Issue:** When the client disconnects, Fastify fires `onRequestAbort` but does not cancel the handler. The hook runs `ROLLBACK` and `client.release()`, then sets `request.dbClient = null`. Every handler does `const client = request.dbClient` once and keeps issuing queries on that captured reference. `GET /workspaces/:id/projects` runs 4 sequential queries, and the DELETE handlers run 2 to 3. A disconnect between two of those awaits sends the remaining queries to a client that is back in the pool. That client is then either idle in autocommit mode with no GUCs, or checked out by another request inside that request's transaction. In the second case the aborted request's statements run in another tenant's transaction and RLS context. They can interleave with that transaction, and if one errors (for example an RLS WITH CHECK violation) it aborts the other request's transaction and turns it into a 500. An attacker can trigger this by aborting requests on purpose. Writes are limited by RLS to the other tenant's org, but the isolation guarantee this phase is meant to provide does not hold.
**Fix:** Do not release the client from the abort hook. `onSend` and `onResponse` still run once the handler finishes, so the existing cleanup there covers the aborted case. Either delete the `onRequestAbort` hook, or have it only record the abort:
```js
fastify.addHook('onRequestAbort', async (request) => {
  request.log.info('request aborted; tenant transaction will be closed when the handler settles');
});
```
Add a test in `tenant-tx.test.js` with a one-connection pool: a slow route (`pg_sleep` followed by a second query), abort the request mid-handler, then assert the next request sees the correct org and that no query ran on a released client.

### CR-02: `external_link` accepted without validation and rendered as an href (stored XSS)

**File:** `packages/api/src/routes/projects.js:51,98,133,199` (renderers: `packages/app/src/components/timeline/GanttTimeline.tsx:366-369`, `components/projects/ProjectList.tsx:298-300`)
**Issue:** The API schema is `{ type: 'string' }`. The `type="url"` input in `ProjectFormModal.tsx` is client-side only and bypassed by a direct API call. A user with the editor role can store `javascript:...` and the app renders it as `<a href={project.external_link}>` for every member of the org, viewers and admins included. React 18 does not block `javascript:` URLs. Auth0 is configured with `cacheLocation="localstorage"`, so a script running in the app origin can read the access tokens. That is a viewer-to-editor or admin escalation across users, and it is the kind of tenant-security hole this phase should close. The CSV export (`lib/export.ts:73`) also writes the value unescaped.
**Fix:** Validate at the API boundary, which is the trust boundary:
```js
function normalizeExternalLink(value) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  let url;
  try { url = new URL(trimmed); } catch { return undefined; }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
}
```
Return 400 when the result is `undefined`, and add `maxLength` (for example 2048) to the schema. Also guard the `href` in the app (render only when the scheme is http or https), so rows already stored are safe.

## Warnings

### WR-01: Pool has no error handling and no connection timeout

**File:** `packages/api/src/db/client.js:10-15`; `packages/api/src/plugins/context.js:88`
**Issue:** `new Pool({ connectionString, max })` is created with no `pool.on('error')` listener and no `connectionTimeoutMillis`. A Postgres restart or a backend termination of an idle client emits an unhandled `error` event and crashes the process. V13 adds `idle_in_transaction_session_timeout = 30s`, which terminates checked-out sessions that sit idle in a transaction. The error event on a checked-out client with no listener is also fatal. Separately, `pool.connect()` waits indefinitely when all `APP_DB_POOL_MAX` clients are in use, so a saturated pool hangs requests rather than failing fast.
**Fix:**
```js
const pool = new Pool({ connectionString: url, max, connectionTimeoutMillis: 5000 });
pool.on('error', (err) => console.error('pg pool: idle client error', err.message));
```
Also attach a client-level `error` listener in `setRequestContext` (removed again on release), and map a connect timeout to 503.

### WR-02: Authentication runs in preHandler, after body parsing and schema validation

**File:** `packages/api/src/routes/workspaces.js:27`, `routes/projects.js:30`, `routes/auth.js:8,23`
**Issue:** `authenticate` is in `preHandler`, which runs after `preValidation`. Unauthenticated callers therefore get JSON body parsing (up to the 1 MB limit) and detailed 400 validation errors before any 401. This leaks schema details and gives anonymous callers a cheap amplification path.
**Fix:** Move `authenticate` to `onRequest` (or `preValidation`) in the route options. Keep `setRequestContext` in `preHandler` so the DB client is acquired only for requests that are valid and authenticated.

### WR-03: Unique-violation races return 500 in workspace create/update and project rename

**File:** `packages/api/src/routes/workspaces.js:102-125,175-228`; `routes/projects.js:157-212`
**Issue:** Each handler does a SELECT-then-write check for slug or name conflicts. `POST /projects` handles `23505`, but `POST /workspaces`, `PATCH /workspaces/:id` (slug) and `PATCH /projects/:id` (name) do not. Two concurrent requests both pass the check, and the loser gets a 500 with the transaction rolled back.
**Fix:** Wrap the write in `try { ... } catch (err) { if (err.code === '23505') return reply.status(409).send({ error: 'Conflict', message: ... }); throw err; }`, as `POST /projects` already does. Keep the pre-check only as a fast path.

### WR-04: `PATCH /auth/me` persists arbitrary keys into `preferences`

**File:** `packages/api/src/routes/auth.js:25-36,53-54`
**Issue:** The `preferences` schema lists `theme` but has no `additionalProperties: false`, and the handler merges `{ ...current, ...incoming }`. Any authenticated user can store arbitrary JSON (up to the body limit) in their `users.preferences` row. Fastify's default `removeAdditional` only strips keys when `additionalProperties: false` is present.
**Fix:** Add `additionalProperties: false` to the `preferences` object schema (and to the top-level body), or whitelist keys in the handler.

### WR-05: Dev tooling guards fail open when NODE_ENV is unset; seed can take over an existing org

**File:** `packages/api/src/db/seeds/dev.js:195,128-139`; `packages/api/scripts/dev-token.mjs:66`
**Issue:** The server refuses to start without a known `NODE_ENV`, but `seed:dev` and `dev-token` refuse only on the exact string `production`. With `NODE_ENV` unset and a production `DATABASE_URL` in the shell, `seed:dev` runs against it. It also upserts `organizations` on `ON CONFLICT (slug) DO UPDATE` and grants `--sub` admin of whatever org already holds the slug `dev-org-a` or `dev-org-b`, so a real tenant with that slug would be taken over.
**Fix:** Require `NODE_ENV` to be explicitly `development` or `test` in both scripts (refuse when unset). In the seed, refuse when an org with that slug exists and was not created by the seed, or use `ON CONFLICT DO NOTHING` plus a lookup.

### WR-06: requireRole fails open for an unrecognized role value

**File:** `packages/api/src/plugins/rbac.js:31-33`
**Issue:** `ROLE_LEVEL[userRole]` is `undefined` for any role string not in the table, and `undefined < minLevel` is `false`, so the check passes. The `org_members.role` CHECK constraint prevents this today. If a role such as `owner` is ever added to the constraint without updating this table, every `requireRole` call would silently grant access.
**Fix:** `const userLevel = ROLE_LEVEL[userRole] ?? 0;`

### WR-07: `deleteProject` fails on the 204 response, so the UI errors after a successful delete

**File:** `packages/app/src/api/client.ts:140,219-221`
**Issue:** `request()` always ends with `res.json()`. `DELETE /projects/:id` replies 204 with an empty body, so `res.json()` rejects with a `SyntaxError`. The row is deleted, but the mutation reports failure and `onSuccess` (the query invalidation in `useDeleteProject`) never runs, so the list stays stale. The same applies to any other 204 route.
**Fix:**
```ts
if (res.status === 204) return undefined as T
return res.json() as Promise<T>
```
Add a test for it in `client.test.ts`.

### WR-08: Production CORS check is defeated by the schema default

**File:** `packages/api/src/server.js:23`; `packages/api/src/db/bootChecks.js:44-47`
**Issue:** `CORS_ORIGIN` defaults to `http://localhost:3000` in the env schema, so `assertSafeConfig` never sees an empty value in production. A production deploy that forgets `CORS_ORIGIN` boots with localhost as its allowed origin instead of refusing, which contradicts the "no default for unsafe values" intent stated in the same file.
**Fix:** Remove the default and have `assertSafeConfig` require an explicit origin when `NODE_ENV=production`, defaulting to localhost only in development and test.

### WR-09: Tenant-scoped tables allow writes by any member at the SQL layer

**File:** `packages/api/src/db/migrations/V13__tenant_policies.sql:24-34,39-42`
**Issue:** `org_isolation` is `FOR ALL` on `org_members`, `organizations` and `audit_events`. Any request in an org context, including a viewer, can UPDATE `org_members.role` (self-promotion), UPDATE `organizations`, or INSERT forged `audit_events` rows, subject only to route-level RBAC. No route exposes this today, but the phase is meant to be the tenant security foundation, and the first route bug or AI-generated SQL path in a later phase turns this into a privilege escalation. Role enforcement lives only in application code.
**Fix:** Split the policies: SELECT scoped by org, and write policies on `org_members` and `organizations` that require the caller to be an admin member of that org. Remove INSERT on `audit_events` for the app role, since the SECURITY DEFINER trigger writes it.

### WR-10: API CI uses `npm install`, a cache key that ignores the lockfile, and swallows role-creation errors

**File:** `.github/workflows/api-ci.yml:31-35,42-49`
**Issue:** `npm install` can drift from `packages/api/package-lock.json`. The cache key hashes only `package.json`, so a lockfile change reuses stale `node_modules`. `CREATE ROLE ... || true` hides real failures such as connection errors, and the later failures then point at the wrong step. CI also runs Node 20 while the Dockerfile builds on Node 24, so the shipped image is never tested.
**Fix:** Use `npm ci`, key the cache on `packages/api/package-lock.json`, and replace `|| true` with a `DO $$ ... IF NOT EXISTS ... $$` block as in V4. Pin both CI and the Dockerfile to the same Node major.

## Info

### IN-01: Unused dependency and provisional image pin

**File:** `packages/api/package.json:15`; `packages/api/Dockerfile:3`
**Issue:** `@fastify/jwt` is declared but never imported (verification uses `jose`). The Dockerfile pins `node:24-alpine`, with a comment saying it is provisional.
**Fix:** Remove `@fastify/jwt` from dependencies. Align the base image with CI.

### IN-02: CLI listen port ignores validated config

**File:** `packages/api/src/server.js:97`
**Issue:** The CLI uses `Number(process.env.PORT) || 4000` instead of `fastify.config.PORT`, which `@fastify/env` has already validated and defaulted.
**Fix:** `await app.listen({ port: app.config.PORT, host: '0.0.0.0' });`

### IN-03: build() leaks the pool when registration fails after the role check

**File:** `packages/api/src/server.js:52-72`
**Issue:** The pool is ended on `assertSafeDbRole` failure, but if a later `register` throws (for example an invalid `AUTH_TEST_JWKS`), the `onClose` hook never runs and the pool stays open. In tests this can keep the runner alive.
**Fix:** Wrap the remaining registration in try/catch and call `await pool.end()` (or `fastify.close()`) before rethrowing.

### IN-04: Client types do not match API responses

**File:** `packages/app/src/api/client.ts:95-103,207-209`
**Issue:** `CurrentUser.email` and `name` are typed `string`, but `/auth/me` can return `null` for both. `updateMe` is typed to return `CurrentUser`, but `PATCH /auth/me` returns only `sub`, `email`, `name` and `preferences` (no `role`, `orgId` or `orgs`). A caller that trusts the type and writes the result to the cache would drop the org data.
**Fix:** Type `email` and `name` as `string | null`, and give `updateMe` a narrower return type, such as `Pick<CurrentUser, 'sub' | 'email' | 'name' | 'preferences'>`.

### IN-05: The client never sends `X-Org-Id`

**File:** `packages/app/src/api/client.ts:134-144`
**Issue:** The API now resolves the active org from `X-Org-Id` or `?orgId` and defaults to the oldest membership, but `request()` sends neither. Users in several orgs are pinned to their oldest membership in the app. `CurrentUser.orgs` is already typed, so the data to pick an org is available.
**Fix:** Accept an optional active-org id in `ApiClient` and send it as the `X-Org-Id` header, or track this as an explicit later-phase item.

### IN-06: Org-id validation is stricter than route param validation

**File:** `packages/api/src/plugins/context.js:21`
**Issue:** `UUID_REGEX` accepts only versions 1-5 with variants 8, 9, a and b, while route params use ajv's `format: 'uuid'`, which accepts any hex UUID. A valid org id of another version, such as v7, or a hand-assigned id (`0000...0001`), would be rejected with 400 `INVALID_ORG_ID`. `POST /projects` also stores `group_name: ''` as an empty string but `PATCH` normalizes it to `null`.
**Fix:** Use `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. In `POST /projects`, use `group_name?.trim() || null`.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
