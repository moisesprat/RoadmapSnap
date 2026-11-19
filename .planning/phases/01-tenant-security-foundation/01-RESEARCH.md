# Phase 1: Tenant & Security Foundation - Research

**Researched:** 2026-11-19
**Domain:** PostgreSQL row-level security on a Fastify 5 + `pg` API (tenant transaction, identity resolution under FORCE RLS, boot assertions, signed-JWT test auth, seed/migration split, DATE handling), plus a minimal Docker Compose skeleton
**Confidence:** HIGH (the key behaviors were reproduced in throwaway Postgres 16 containers this session; items that were not reproduced are tagged `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seed data & V7-V12**
- **D-01:** Rewrite `V7__seed_projects_from_config.sql`, `V8__add_users_to_seed_org.sql`, `V9__backfill_workspace_workflows.sql`, the seed part of `V10__dependencies_index_and_seed.sql` (keep its indexes), `V11__seed_dependencies_from_config.sql` and `V12__backfill_group_order.sql` as no-op stubs. Keep the filenames, so version names in `schema_migrations` are unchanged. This is safe because `migrate.js` tracks by filename only (no checksum). Each stub carries a comment explaining why. This is a deliberate, documented exception to the "never edit an applied migration" rule. Reversibility: costly - databases created after the change never get the demo rows. Restoring the data means a new seed path, not reverting the files.
- **D-02:** Demo data lives in `packages/api/src/db/seeds/` and runs only through an explicit `npm run seed:dev` (in `packages/api`). Migrations never insert sample program data. A fresh `migrate` yields zero rows in tenant tables.
- **D-03:** Remove the real program data (generated from the user's `js/config*.js`, e.g. the "OneHouse Upgrade Program" workspace and group names) from HEAD only. Do not rewrite git history. The dev seed is a synthetic sample derived from `js/config_base.js` only.
- **D-04:** Leave existing local dev databases that already have `config-seed-org` alone. No V13 cleanup migration. Document in `packages/api/src/db/migrations/README.md` that devs should drop and recreate their local DB, then run `seed:dev`. Rationale: no hosted DB exists yet.
- **D-05:** Delete `packages/api/scripts/generate-config-seed.mjs` (it uses `new Function`) and its `seed:config` npm script. Replace it with a small hand-written dev seed. Phase 3's safe `acorn` importer can later back dev seeding.

**Local dev without bypass**
- **D-06:** `seed:dev` accepts the developer's Auth0 subject (`--sub auth0|...` or `DEV_ADMIN_SUB` in `.env`). It upserts that user and makes them admin of the demo org. It runs as the owner/migration role (`DATABASE_URL`), never at request time.
- **D-07:** `seed:dev` creates two orgs: Org A (demo roadmap from `config_base`) and Org B (a small, different roadmap), so isolation can be checked by hand. Design it so the Phase 7 smoke test can reuse it.
- **D-08:** Research and planning choose how to resolve identity and memberships under FORCE RLS: the policy shape (`org_members` self-select on `user_id = current_user_id`) or narrow `SECURITY DEFINER` functions. Hard constraint: no `BYPASSRLS`, no `row_security = off`, no second connection from `pool` at request time.

**Test / impersonation auth**
- **D-09:** Remove `X-Test-User-Sub` entirely. Tests (and scripted local use) authenticate with real JWTs signed by a locally generated keypair. The API verifies them against a local JWKS that is loaded only when explicitly configured, for example through a test-JWKS env var (the name is up to the planner). This exercises the real `jwtVerify` path. Reversibility: costly - every API test file (`auth`, `projects`, `workspaces`, `rls`) changes its auth helper.
- **D-10:** The API refuses to start when any of these hold:
  - (a) the DB role is a superuser or has `BYPASSRLS` (SEC-02)
  - (b) test auth / the local JWKS is enabled while `NODE_ENV=production`
  - (c) `NODE_ENV` is unset (remove the `development` default in `server.js`)
  - (d) the connected role owns the tenant tables (it could ALTER or DISABLE RLS)
  - (e) `CORS_ORIGIN` is `*` or empty in production
- **D-11:** Split DB credentials. The API uses only `APP_DATABASE_URL` (`roadmapsnap_app`) and refuses to start without it. `migrate` and `seed:dev` use `DATABASE_URL` (owner). Tests use both, with admin for setup and the app role through the API.

**No-org behavior & org resolution**
- **D-12:** An authenticated user with no org membership gets 403 `{ error: 'Forbidden', message: 'No organization', code: 'NO_ORG' }` on tenant-scoped endpoints. `/auth/me` still succeeds and reports `orgs: []`. Phases 4 and 6 route on `code: 'NO_ORG'` to onboarding. Keep the existing `{ error, message }` shape. `code` is an additive field.
- **D-13:** `X-Org-Id` naming an org the user is not a member of returns 403. No silent fallback to another org, which today can make writes land in the wrong tenant. The same applies to `?orgId`.
- **D-14:** With no `X-Org-Id`, the default org is the user's oldest membership (earliest `org_members.created_at`). Remove the "org with the most workspaces" heuristic. Phase 4 may add a remembered last-used org.

**Date contract**
- **D-15:** DATE columns travel as ISO `YYYY-MM-DD` strings in both directions. Register a `pg` type parser so DATE (OID 1082) is never turned into a JS `Date`. Writes accept only `YYYY-MM-DD`. Conversion to Lite's `DD/MM/YYYY` happens at the app or shared-core edge (Phase 2). Prove it with tests run under at least `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati`, including a last-day-of-month date. Reversibility: costly - a published API contract that the app and later the AI/import paths depend on.

### Claude's Discretion
- The transaction helper's shape (e.g. `withTenantTx` vs a Fastify hook pair) and how errors trigger ROLLBACK.
- Env var names for the test JWKS, and the exact boot-check implementation.
- The CI guard against importing `pool` in route handlers (lint rule, grep test or similar).
- Cross-tenant test coverage strategy (per-endpoint matrix vs a catalog test asserting RLS on every tenant table). Both are acceptable as long as SEC-03's "any endpoint" is credibly covered.
- How `audit_trigger_function` keeps working for the app role (research flag).
- Compose skeleton details within the ROADMAP note's scope.

### Deferred Ideas (OUT OF SCOPE)
- Remembered last-used org per user: Phase 4 (ORG-07 org switching).
- Purging the real program data from git history: explicitly declined for now. Revisit only if the repo becomes public or is shared beyond the author.
- Removing the hard-coded `apppassword` from `V4__app_role.sql`: Phase 7 (DEP-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Every API request runs in a transaction that sets the tenant context with parameterized `set_config`, as the NOSUPERUSER app role | "Tenant transaction (hook pair)" pattern, verified in Spike H; failing-behavior evidence F1, F2, F5; pitfalls 1-3 |
| SEC-02 | The API refuses to start if its DB role is a superuser or has BYPASSRLS | Boot-check SQL verified against superuser, app role, and an owner-inheriting role (Spike boot-check); config checks D-10 (b)(c)(e) |
| SEC-03 | A user of org A cannot read or write any row of org B through any endpoint (automated cross-tenant tests) | Policy-shape V13 draft verified (Spikes D2, G); Validation Architecture matrix + catalog test + route-coverage guard |
| SEC-04 | New users are never auto-joined to the seed org, and the dev RLS bypass is removed | Evidence F3/F4; removal list in "Code to delete"; identity-resolution design; `NO_ORG` flow verified |
| SEC-05 | Fresh installs contain no sample program data; dev seed data is separate from schema migrations | Fresh-install spike (stubs V7-V12 yield 0 rows, 2 indexes kept); dev seed design; V2 `postgres` grant finding |
| SEC-06 | Dates round-trip without day shifts in any server timezone | Spike E (default parser shifts, string parser is correct, the `formatPlannedDate` trap); Fastify `format: 'date'` strictness verified; TZ test design |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md`, `./AGENTS.md` and `./.claude/CLAUDE.md`. Treat as locked.

- All changes go through a PR from a branch; never commit to `main`. Commit subjects follow `type(scope): summary`.
- Never commit `js/config.js`, any `js/config_*.js` other than `js/config_base.js`, `.env` files or `.webui_secret_key`; only `.env.example`.
- API route handlers use `request.dbClient`; never open a connection from `pool` directly, or the RLS session vars are missing. (This phase makes `request.dbClient` the transaction-scoped client and enforces the rule with a test.)
- Tenant isolation through RLS is mandatory. AI-proposed changes (later phases) go through the same RLS and role checks.
- Keep Fastify + PostgreSQL + Auth0 (API) and React + TanStack Query + Vite (app). Extend, do not replace.
- Lite must stay backend-free and green (`npm test`, `npm run validate`, `npm run build`). Nothing in this phase touches Lite.
- API code style: 2-space indent, semicolons, single quotes, trailing commas. Errors keep the `{ error: <HTTP reason phrase>, message: <text> }` shape; expected 4xx use `reply.status(n).send(...)` and `return` it.
- API CLI scripts log with a `migrate:`-style prefix (follow the convention, e.g. `seed:`).
- `packages/app`: strict TypeScript, no semicolons; run `npx tsc --noEmit` before pushing (relevant only for the small ISO-date adapter below).
- Migrations: next free `V` number, never edit an applied one (D-01 is the one documented exception).
- GSD workflow: file edits happen through a GSD command, not directly (this research only writes `01-RESEARCH.md`).
- No project skills found (`.claude/skills/`, `.agents/skills/` absent).

## Summary

The research flag asked to confirm the RLS failure first. It is confirmed, and worse than suspected: on the current code the API is both insecure and non-functional depending on the DB role. With the default superuser connection, RLS is simply bypassed and a stranger who signs in is auto-joined to the seed org and sees all six seeded workspaces. With the NOSUPERUSER `roadmapsnap_app` role, nobody can resolve an org at all (the seed-org auto-join `SELECT` is hidden by the `organizations` policy and the membership lookup runs before any org is known), so every authenticated request returns 403. The existing 39 tests pass only because the API runs as the superuser. `SET LOCAL` outside a transaction has no lasting effect and leaves an empty-string residue that crashes policies with `22P02` on pooled-connection reuse.

Recommended design, all pieces verified in spikes against Postgres 16: (1) a per-request transaction implemented as a Fastify hook pair (`preHandler` does `BEGIN` + identity + org resolution using parameterized `set_config(..., true)`; `onSend` does `COMMIT`/`ROLLBACK` before the response is written), exposing the tx-scoped client as `request.dbClient`; (2) identity and membership resolution through the **policy shape**, not `SECURITY DEFINER` (a `users` self policy keyed on the verified JWT `sub`, an `org_members` self-select policy, an `organizations` member-select policy), plus `NULLIF`-safe GUC reader functions used by every policy; (3) boot assertions as plain functions (`assertSafeConfig`, `assertSafeDbRole`) called from `build()`; (4) a local JWKS (`createLocalJWKSet`) selected by an explicit env var, with `algorithms: ['RS256']` pinned, replacing `X-Test-User-Sub`; (5) V7-V12 stubbed per D-01, demo data in a hand-written `seed:dev`; (6) a `pg` DATE type parser returning `YYYY-MM-DD` strings, with the existing `formatPlannedDate` removed (it becomes a day-shift bug the moment the parser is registered).

The riskiest parts for planning: the test-suite rewrite (D-09 touches every API test file, and they run as parallel processes against one shared DB), the silent-`COMMIT`-becomes-`ROLLBACK` trap on aborted transactions, the `formatPlannedDate` trap, and `V2__rls_policies.sql` failing on any Postgres whose superuser is not named `postgres` (found while sizing the compose skeleton). No new npm packages are needed.

**Primary recommendation:** Build in this order: failing cross-tenant tests as the app role (RED) -> V13 policies + tenant tx plugin + signed-JWT auth (GREEN) -> boot checks -> seed/migration split -> DATE contract -> compose skeleton, with the cross-tenant suite, catalog test and grep guard running in `api-ci.yml` (including a second TZ run).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant isolation (row filtering) | Database / Storage (RLS policies) | API (sets context) | Only the DB can make isolation hold even when an API query forgets `WHERE org_id`; FORCE RLS plus a NOSUPERUSER role |
| Tenant context (`set_config`) | API / Backend (tenant plugin) | Database | The API knows the verified identity; the DB consumes it through tx-local GUCs |
| Identity and membership resolution | API / Backend | Database (self-select policies) | Policy shape lets the app role read only its own rows before an org is chosen |
| Authentication (JWT verify) | API / Backend (`jose`) | Auth0 (issuer) | Verification against Auth0 JWKS, or a local JWKS only when explicitly enabled and never in production |
| Authorization (role gate) | API / Backend (`requireRole`) | Database (org scope only) | Roles are an app concern; RLS enforces org scope, not viewer/editor/admin |
| Boot safety assertions | API / Backend (startup) | Database (catalog queries) | The process must refuse to serve when its role or config is unsafe |
| Schema and policy changes | Database / Storage (migrations, owner role) | CI / compose migrate job | Owner role runs migrations; app role never owns tables |
| Sample data | Dev tooling (`seed:dev`, owner role) | - | Never in migrations, never at request time |
| DATE contract | API / Backend (`pg` type parser, schema validation) | Browser/Client edge adapter | API speaks ISO; Lite's `DD/MM/YYYY` is converted at the client/core edge |
| Local orchestration | Compose (postgres, migrate job, api) | - | Skeleton only; full hardening is Phase 7 |

## Standard Stack

No new packages are required. Versions below are the ones the lockfile installs (verified with `npm ci` in a scratch copy) next to the latest registry version.

### Core
| Library | Installed (lockfile) | Latest (registry) | Purpose | Why Standard |
|---------|----------------------|-------------------|---------|--------------|
| `fastify` | 5.7.4 | 5.12.8 | HTTP server, hooks | Already the API framework; `onSend` supports async work before the response is written [CITED: fastify.dev/docs/latest/Reference/Hooks/] |
| `pg` | 8.19.0 | 8.23.1 | Postgres driver; `pg.types.setTypeParser` for DATE | Already used; `COMMIT` on an aborted tx returns `command: 'ROLLBACK'` (verified) |
| `jose` | 5.10.0 | 6.2.18 | JWT verify; `createLocalJWKSet`, `generateKeyPair`, `exportJWK`, `SignJWT` | Already used; the same `jwtVerify` path serves Auth0 and the local test JWKS. Do not take the 5 -> 6 major bump in this phase [VERIFIED: npm registry; installed from packages/api/package-lock.json] |
| `@fastify/env` | 5.0.3 | - | Env schema | Already used; remove defaults that hide misconfiguration |
| Node test runner | built-in | - | API tests (`node --test`) | Existing convention |
| PostgreSQL | 16 (CI image `postgres:16`) | - | RLS, FORCE RLS, `set_config` | Spikes were run on `postgres:16-alpine` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Docker Compose | v5.7.0 (local) | Compose skeleton | The skeleton plan only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Policy shape for identity (recommended) | `SECURITY DEFINER` lookup functions | Definer functions are owned by the migration role. They only bypass RLS when that owner is superuser/BYPASSRLS; on a non-superuser owner under FORCE RLS they stop working, and each one is a privilege-escalation surface needing `search_path` pinning and `REVOKE EXECUTE FROM PUBLIC`. Policy shape needs no privileged object and works for any owner |
| Hook pair `preHandler` + `onSend` (recommended) | A `withTenantTx(fn)` wrapper in each handler | Wrapper requires editing every handler; hooks keep `request.dbClient` and all current handlers unchanged. A wrapper variant is still the right tool for Phase 5's long AI routes (do not hold a client across a 5-60 s LLM call) |
| `pg.types.setTypeParser` (global) | Per-pool `types` option | Global is simpler and also covers test fixture pools in the same process; per-pool isolates better but must be repeated everywhere |

**Installation:** none (`npm install` not needed for this phase).

**Version verification:**
```bash
npm view jose version      # 6.2.18 (installed 5.10.0, keep)
npm view pg version        # 8.23.1 (installed 8.19.0, keep)
npm view fastify version   # 5.12.8 (installed 5.7.4, keep)
```

## Package Legitimacy Audit

No external packages are installed or added by this phase, so the Package Legitimacy Gate was not triggered. `@fastify/jwt` is listed in `packages/api/package.json` but unused (verification uses `jose`); removing it is optional cleanup, not required.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Verified In-Repo Facts (quoted)

These are the discrete values the plans depend on. Each was read with `Read` this session.

| Fact | Source | Verbatim quote |
|------|--------|----------------|
| `NODE_ENV` defaults to `development`; `DATABASE_URL` defaults to a superuser URL; `DEFAULT_ORG_ID` exists | `packages/api/src/server.js:13-25` | `NODE_ENV: { type: 'string', default: 'development' },` / `DATABASE_URL: { type: 'string', default: 'postgresql://postgres:postgres@localhost:5432/roadmapsnap_dev' },` / `DEFAULT_ORG_ID: { type: 'string', default: '' },` |
| Seed-org auto-join | `packages/api/src/plugins/context.js:81-89` | `// Add new user to seed org if it exists so they can see seeded workspaces` / `SELECT o.id, $1, 'admin' FROM organizations o WHERE o.slug = 'config-seed-org' LIMIT 1` |
| Org resolution falls back silently, "most workspaces" heuristic | `context.js:102-140` | `// Resolve org context (priority: X-Org-Id → ?orgId → first org_members row)` / `ORDER BY (SELECT COUNT(*) FROM workspaces w WHERE w.org_id = om.org_id) DESC, om.created_at ASC` |
| Dev bootstrap bypass | `context.js:142-146` | `if (!resolvedOrgId && process.env.NODE_ENV === 'development') {` / `await setupClient.query('SET LOCAL row_security = off');` |
| Test header bypass | `packages/api/src/plugins/auth.js:24-33` | `const testSub = request.headers['x-test-user-sub'];` |
| Policies read the GUC with a bare cast | `packages/api/src/db/migrations/V2__rls_policies.sql:18-31` | `USING (id = current_setting('app.current_org_id', true)::uuid);` |
| V2 grants to a hard-coded role name | `V2__rls_policies.sql:35` | `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;` |
| App role and hard-coded password | `packages/api/src/db/migrations/V4__app_role.sql:3,9-11` | `CREATE ROLE roadmapsnap_app WITH LOGIN PASSWORD 'apppassword' NOSUPERUSER;` / `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roadmapsnap_app;` |
| Migration tracking is by filename only | `packages/api/src/db/migrate.js:77-81` | `const version = file.replace(/\.sql$/i, '');` / `'SELECT 1 FROM schema_migrations WHERE version = $1',` |
| API pool reads `DATABASE_URL` | `packages/api/src/db/client.js:9` | `const url = process.env.DATABASE_URL;` |
| Existing date formatter uses local getters | `packages/api/src/routes/workspaces.js:30-35` | `const d = date instanceof Date ? date : new Date(date);` / `const day = String(d.getDate()).padStart(2, '0');` |
| SPA parses `DD/MM/YYYY` only | `packages/app/src/lib/timeline.ts:50-59` | `const parts = String(dateStr).trim().split('/').map(Number)` |

## Reproduced Failures (confirming the research flag)

All run against `postgres:16-alpine` throwaway containers (removed afterwards), with V1-V12 applied exactly as in the repo, `roadmapsnap_app` pre-created as CI does. `[VERIFIED: local spike]`

| # | Observation | Evidence |
|---|-------------|----------|
| F1 | `SET LOCAL` outside a transaction has no effect and leaves an empty string, not NULL | Next statement saw `current_setting('app.current_org_id', true)` = `""` |
| F2 | The API connects as a superuser today | `postgres`: `rolsuper t, rolbypassrls t`; the API reads only `DATABASE_URL` (default superuser); the 39 existing tests all pass this way |
| F3 | As the app role, no user can resolve an org | Brand-new user via the current API with `DATABASE_URL` = app role: `403 {"error":"Forbidden","message":"No organization context"}` (seed-org auto-join selects 0 rows because `organizations` RLS hides it) |
| F4 | As superuser, a stranger sees all seeded data (SEC-04 failing) | New sub `spike|stranger` -> `200`, 6 workspaces visible (`config-dsmf, config-ple2, config, config-onehouse-full, config-base, config-roadmapsnap`) |
| F5 | Pool reuse crashes policies | After tx with `set_config(..., true)` + COMMIT on a `max: 1` pool, residue is `""`; `select count(*) from workspaces` -> `22P02 invalid input syntax for type uuid: ""` |
| F6 | `COMMIT` of an aborted tx is silently a `ROLLBACK` | `pg` returned `command: 'ROLLBACK'` for `COMMIT` after `select 1/0` |
| F7 | `request.routerPath` does not exist in Fastify 5 | Printed `{ routerPath: undefined, routeUrl: '/x' }`; the `if (request.routerPath === '/health') return;` guard in `context.js` is dead code (use `request.routeOptions.url`) |
| F8 | A token with no `email` crashes user provisioning | `INSERT INTO users (auth0_id, email)` with null -> `23502 null value in column "email" ... violates not-null constraint` (`users.email` is `NOT NULL UNIQUE`) |
| F9 | `V2` fails on any non-`postgres` superuser | Postgres with `POSTGRES_USER=rsadmin`: `migrate: Failed V2__rls_policies` / `role "postgres" does not exist` |

## Architecture Patterns

### System Architecture Diagram

```
                       HTTP request (Authorization: Bearer <JWT>, optional X-Org-Id / ?orgId)
                                          |
                          onRequest/preHandler: authenticate (plugins/auth.js)
                                          |
          +-------------------------------+--------------------------------+
          | JWKS source (chosen once at boot, see boot checks)             |
          |  default:  createRemoteJWKSet(https://AUTH0_DOMAIN/.well-known)|
          |  explicit: createLocalJWKSet(AUTH_TEST_JWKS)  [never in prod]  |
          +-------------------------------+--------------------------------+
                                          | jwtVerify(issuer, audience, algorithms:['RS256'])
                           401 {error,message}  <-- fail      | ok: request.user = {sub, email, name}
                                          |
                    preHandler: setRequestContext (plugins/context.js -> tenant tx)
                                          |
       pool.connect()  (pool = APP_DATABASE_URL = roadmapsnap_app, NOSUPERUSER, no BYPASSRLS)
                                          |
   BEGIN
   Stage 1 identity:  set_config('app.current_auth0_id', sub, true)
                      SELECT users WHERE auth0_id = sub  (policy user_self)   -> INSERT ... ON CONFLICT DO NOTHING if absent
                      set_config('app.current_user_id', user.id, true)
   Stage 2 org:       SELECT org_id, role FROM org_members WHERE user_id = me ORDER BY created_at  (policy member_self_select)
                      X-Org-Id/?orgId given -> must be in list else 403 NOT_A_MEMBER
                      none given            -> oldest membership; none at all -> 403 NO_ORG
                      set_config('app.current_org_id', org, true)
                                          |
                     requireRole(...) preHandler  --(403 Insufficient permissions)-->
                                          |
                   route handler uses request.dbClient (the tx-scoped client)
                          every query filtered by RLS policies (FORCE RLS, org_id = app_current_org_id())
                          row triggers (audit_trigger_function, SECURITY DEFINER) write audit_events in the same tx
                                          |
                    onSend hook: status < 400 (or tenantCommit) -> COMMIT else ROLLBACK
                                 COMMIT returning command 'ROLLBACK' -> destroy client, return 500
                                 client.release()  (release(err) destroys a poisoned connection)
                                          |
                                      response
 onRequestAbort hook: ROLLBACK + release (client went away mid-request)

 Boot (build()):  assertSafeConfig(env)  ->  create pool(APP_DATABASE_URL)  ->  assertSafeDbRole(pool)  ->  register plugins
 Out of band:     migrate (owner DATABASE_URL, schema only)   |   seed:dev (owner DATABASE_URL, explicit, dev only)
```

### Recommended Project Structure
```
packages/api/
├── src/
│   ├── db/
│   │   ├── types.js          # pg.types.setTypeParser(1082, v => v); imported by client.js and by test helpers
│   │   ├── client.js         # createPool(url) factory; lazy app pool on APP_DATABASE_URL; closed on app onClose
│   │   ├── tenant.js         # beginTenantTx / resolveIdentity / selectOrg / finishTenantTx (pure over a pg client)
│   │   ├── bootChecks.js     # assertSafeConfig(config), assertSafeDbRole(pool)
│   │   ├── migrate.js        # refactor: export migrate(url) + CLI guard (server.js pattern); tests need it
│   │   ├── migrations/       # V13__tenant_policies.sql (+ stubs V7-V12, README.md updated)
│   │   └── seeds/            # dev.js (CLI) + data (Org A from config_base, Org B small)
│   ├── lib/dates.js          # isoDateSchema = { type: 'string', format: 'date' }, shared by later routes
│   ├── plugins/
│   │   ├── auth.js           # JWKS selection, algorithms pin, no test header
│   │   ├── context.js        # keep decorator name setRequestContext; now the tenant tx plugin
│   │   └── rbac.js           # unchanged (see cleanup note)
│   └── server.js             # env schema (no defaults for NODE_ENV/DB), boot checks, CORS rule
├── tests/
│   ├── helpers/auth.js       # keypair + signToken({sub,email,name}) + env wiring for the local JWKS
│   ├── helpers/db.js         # adminPool (DATABASE_URL), fixture builders with unique slugs, cleanup
│   ├── tenant-isolation.test.js   # API matrix as the app role
│   ├── rls-catalog.test.js        # every org_id table: RLS enabled + forced + policy
│   ├── boot-checks.test.js
│   ├── dates.test.js              # run under two TZs
│   ├── seed-fresh.test.js         # scratch database, migrate, assert zero rows
│   └── no-bypass.test.js          # header ignored, no `pool` import outside db/, no SET LOCAL interpolation
└── .env.example              # APP_DATABASE_URL, DATABASE_URL (owner, migrate/seed only), DEV_ADMIN_SUB, AUTH_TEST_JWKS
```

### Pattern 1: Tenant transaction as a hook pair (SEC-01)
**What:** `preHandler` acquires a client, `BEGIN`s, resolves identity and org with parameterized `set_config(..., true)`, and exposes `request.dbClient`; `onSend` commits or rolls back before the response is written; `onRequestAbort` is the safety net. Verified in Spike H: `/ok` persisted, `/409` and a thrown error rolled back, and a handler that swallowed a DB error and kept writing produced a loud 500 instead of silent data loss; connections were reused and released.
**When to use:** all authenticated routes (they already compose `[fastify.authenticate, fastify.setRequestContext]`).
**Example:**
```js
// Source: Spike H (verified against postgres:16, Fastify 5.7.4, pg 8.19.0); hook semantics per
// https://fastify.dev/docs/latest/Reference/Hooks/
async function finish(request, commit) {
  const client = request.dbClient;
  if (!client) return;
  request.dbClient = null;
  let destroy;
  try {
    const result = await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    // COMMIT of an aborted tx is silently turned into ROLLBACK by Postgres; pg reports it in `command`.
    if (commit && result.command === 'ROLLBACK') destroy = new Error('COMMIT was turned into ROLLBACK');
  } catch (err) {
    destroy = err;
  } finally {
    client.release(destroy);          // release(err) destroys the connection instead of pooling it
  }
  if (destroy) throw destroy;
}

fastify.addHook('onSend', async (request, reply, payload) => {
  await finish(request, reply.statusCode < 400 || request.tenantCommit === true);
  return payload;
});
fastify.addHook('onRequestAbort', async (request) => { await finish(request, false); });
```
Notes:
- Decorate `dbClient`, `dbUser`, `orgId` with `fastify.decorateRequest(...)` in the same scope (Fastify 5 expects request decorations to be declared up front).
- Hooks are encapsulated per scope [CITED: fastify.dev/docs/latest/Reference/Hooks/]. Register the hooks in the same scope as the routes. Today `authPlugin` registers the routes inside `contextPlugin`'s scope, so hooks added in `contextPlugin` cover them. If route registration moves to `server.js`, move the hooks with it (or wrap with `fastify-plugin`, which is not currently a dependency; avoid adding it).
- Denial paths (`NO_ORG`, `NOT_A_MEMBER`) only performed the idempotent user upsert, so set `request.tenantCommit = true` before replying 403 so the upsert persists (otherwise it re-runs on every request).
- Add `ALTER ROLE roadmapsnap_app SET idle_in_transaction_session_timeout = '30s'` in V13 as a cheap guard against a leaked open tx pinning a pooled connection `[ASSUMED]` (value is a judgment call).
- Set an explicit `max` on the pool and close it in an `onClose` hook (the current pool is never closed on `app.close()`).

### Pattern 2: Identity and membership resolution under FORCE RLS - policy shape (D-08 decision)
**What:** Three small additions plus `NULLIF`-safe GUC readers. No `SECURITY DEFINER`, no `BYPASSRLS`, no second connection. Verified end to end as the app role (Spikes D2, G):
- alice (admin of org A) default org -> A, sees only A's workspace.
- alice with `X-Org-Id` = B (not a member) -> denied before any tenant query (`NOT_A_MEMBER`).
- brand-new user with an email -> user row created, zero memberships -> `NO_ORG`.
- With only the user GUC set (no org), the app role sees exactly its own organizations and memberships and **0** workspaces.
- Alice cannot `UPDATE` org B's workspace (0 rows) and cannot `INSERT` a project or a membership for org B (`42501`).
- `users` is visible only as the caller's own row; `audit_trigger_function` writes an `audit_events` row with the right `user_id` for the app role.
**Why policy shape over SECURITY DEFINER:** works for any owner, including a non-superuser migration owner (a definer function owned by a FORCE-RLS-subject owner would itself be filtered); no privileged function surface; the policies are inspectable in the catalog test.
**Draft migration (V13; the spike applied this against V1-V12 without errors):**
```sql
-- Source: Spike V13_draft (verified on postgres:16). `[VERIFIED: local spike]`
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_current_auth0_id() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_auth0_id', true), '') $$;

-- Replace the bare ::uuid casts (22P02 on pooled-connection residue) on every tenant table.
-- ALTER POLICY ... USING keeps the implicit WITH CHECK = USING for FOR ALL policies.
ALTER POLICY org_isolation ON organizations  USING (id = app_current_org_id());
ALTER POLICY org_isolation ON org_members    USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON workspaces     USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON programs       USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON projects       USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON milestones     USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON budget_periods USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON kpis           USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON risks          USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON dependencies   USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON audit_events   USING (org_id = app_current_org_id());

-- Stage 2: list own memberships/orgs with no org context (permissive policies are OR-ed)
CREATE POLICY member_self_select ON org_members FOR SELECT
  USING (user_id = app_current_user_id());
CREATE POLICY member_orgs_select ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = app_current_user_id()));

-- Stage 1: users get RLS too (closes cross-tenant email enumeration); keyed on the verified JWT sub
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY user_self ON users
  USING (auth0_id = app_current_auth0_id() OR id = app_current_user_id());
CREATE POLICY user_comember_select ON users FOR SELECT
  USING (id IN (SELECT user_id FROM org_members WHERE org_id = app_current_org_id()));
```
Permissive policies combine with OR [CITED: postgresql.org/docs/16/ddl-rowsecurity.html]. No policy recursion: `users` policies read `org_members`, and `org_members` policies reference only GUC functions.

Recommended additions in the same migration (low cost, `[ASSUMED]` that you want them in this phase, see Open Questions):
- `REVOKE ALL ON schema_migrations FROM roadmapsnap_app;` (V4 grants `ON ALL TABLES IN SCHEMA public`, which includes `schema_migrations`, so the app role can currently `DELETE` migration history).
- `REVOKE UPDATE, DELETE ON audit_events FROM roadmapsnap_app;` (the "immutable log" is writable by the app role; the SECURITY DEFINER trigger inserts as its owner, so the app role needs no UPDATE/DELETE). Existing test cleanup uses the admin pool.
- `ALTER FUNCTION audit_trigger_function() SET search_path = public, pg_temp;` (SECURITY DEFINER hardening; the function has none today).

**Org resolution rules to implement (D-12..D-14):** the user's memberships are read once, ordered `created_at ASC`. If `X-Org-Id` (then `?orgId`) is present it must be a valid UUID (reject malformed with 400, not silent fallback) and a member (else 403, code `NOT_A_MEMBER`, `[ASSUMED]` name). Else default to the oldest membership. No memberships -> 403 `{ error: 'Forbidden', message: 'No organization', code: 'NO_ORG' }`. Delete the "most workspaces" ordering.

### Pattern 3: Boot assertions (SEC-02, D-10)
Two pure functions, unit-testable without a server, called from `build()` so a violation makes `build()` reject (and therefore the process exit). Alternatively throw from an `onReady` hook; both were verified to reject (`app.ready()` rejected with the thrown message).

```js
// assertSafeConfig(config): env-only, runs before any DB access
//  (b) config.AUTH_TEST_JWKS set && NODE_ENV === 'production'  -> throw
//  (c) NODE_ENV missing/empty or not in {development,test,production} -> throw  (remove the schema default)
//  (e) NODE_ENV === 'production' && (CORS_ORIGIN is '' or '*')  -> throw
//  APP_DATABASE_URL missing -> throw (D-11)

// assertSafeDbRole(pool): one query, verified for postgres / roadmapsnap_app / role inheriting the owner
const BOOT_CHECK_SQL = `
  SELECT r.rolsuper, r.rolbypassrls,
         current_setting('is_superuser') AS is_superuser_guc,
         EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
                   AND pg_has_role(current_user, c.relowner, 'USAGE')) AS owns_or_inherits_owner
  FROM pg_roles r WHERE r.rolname = current_user`;
// throw if rolsuper || rolbypassrls || is_superuser_guc === 'on' || owns_or_inherits_owner
```
Spike results `[VERIFIED: local spike]`: `postgres` -> `rolsuper t, rolbypassrls t, owns_or_inherits_owner t`; `roadmapsnap_app` -> all false/`off`; a NOSUPERUSER role that is a *member of* the owner role -> `rolsuper f, rolbypassrls f` but `owns_or_inherits_owner t`. **Use `pg_has_role(current_user, c.relowner, 'USAGE')`, not `relowner = r.oid`**, otherwise a role that merely inherits the owner passes check (d) while being able to `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`. Do not skip the check under `NODE_ENV=test`; tests exercise it.

Config validity details: `build()` currently reads `process.env` through `@fastify/env`; remove the defaults for `NODE_ENV` and `DATABASE_URL`, add `APP_DATABASE_URL` and `NODE_ENV` to `required`, delete the dead `DEFAULT_ORG_ID`. `db/client.js` must read `APP_DATABASE_URL` and become a factory (`createPool(url)`), so negative boot tests can pass a superuser URL without relying on a module singleton.

### Pattern 4: Signed-JWT test auth with a local JWKS (D-09)
Env var name (discretion): `AUTH_TEST_JWKS` (JSON string of a JWKS). `authPlugin` uses `createLocalJWKSet(JSON.parse(...))` when set, `createRemoteJWKSet` otherwise, and calls the same `jwtVerify`. Pin `algorithms: ['RS256']` (verified: an HS256 token is rejected with `ERR_JOSE_ALG_NOT_ALLOWED`; a token signed by another key with `ERR_JWS_SIGNATURE_VERIFICATION_FAILED`).
```js
// Source: Spike J (jose 5.10.0) `[VERIFIED: local spike]`; tests/helpers/auth.js
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey); jwk.kid = 'test-key-1'; jwk.alg = 'RS256'; jwk.use = 'sig';
process.env.AUTH_TEST_JWKS = JSON.stringify({ keys: [jwk] });   // set BEFORE build()
export const signToken = ({ sub, email, name }) =>
  new SignJWT({ email, name })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setSubject(sub).setIssuer(`https://${process.env.AUTH0_DOMAIN}/`).setAudience(process.env.AUTH0_AUDIENCE)
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
```
Verification stays strict on issuer and audience. Tests that exercise the real path need a token per user; include `email` (see F8 and Open Question 3).

### Pattern 5: DATE contract (SEC-06, D-15)
- `src/db/types.js`: `pg.types.setTypeParser(1082, (v) => v)`; import it first in `db/client.js` and in `tests/helpers/db.js` so fixture pools behave identically.
- Remove `formatPlannedDate` from `workspaces.js`; `milestones[key]` becomes the raw `YYYY-MM-DD` string or `null` (empty string today for missing dates is not ISO; keep `''`-vs-`null` behavior explicit in the plan).
- **Trap (verified):** with the string parser registered, the *current* `formatPlannedDate` does `new Date('2026-03-31')` (UTC midnight) and reads local getters, giving `30/03/2026` under `America/Los_Angeles`. It must be deleted, not left in place.
- Writes: validate with Fastify's built-in `format: 'date'`. Verified strictness under both zones: accepts `2026-03-31`; rejects `2026-02-30`, `31/03/2026`, `2026-3-1` and `2026-03-31T00:00:00Z` with 400.
- Never pass a JS `Date` as a DATE parameter: with the default parser a `Date` round-trips to `"2026-03-31T07:00:00.000Z"` (LA) / `"2026-03-30T10:00:00.000Z"` (Kiritimati) in JSON.
- **Consumer break to plan for:** `packages/app/src/lib/timeline.ts` `parseDate` accepts only `DD/MM/YYYY`. Switching `GET /workspaces/:id/projects` to ISO breaks the SPA until Phase 2. Add a string-only ISO -> `DD/MM/YYYY` adapter in `getWorkspaceProjects` in `packages/app/src/api/client.ts` (split on `-`, no `Date` objects) with a vitest in `client.test.ts`; Phase 2 replaces it with the shared-core edge adapter.
- The API has no milestone write endpoint yet (Phase 3, EDIT-03). The SEC-06 test writes through the same tenant-tx client with a string parameter (`$1::date`), reads through the real API, and runs under both TZs. Do not add a throwaway write endpoint.

Verified default-parser vs string-parser outputs (Spike E): `[VERIFIED: local spike]`

| TZ | Default parser JSON for `2026-03-31` | String parser JSON | Old `formatPlannedDate` on the string |
|----|----------------------|--------------------|-------------------------------|
| UTC | `"2026-03-31T00:00:00.000Z"` | `"2026-03-31"` | `31/03/2026` |
| America/Los_Angeles | `"2026-03-31T07:00:00.000Z"` | `"2026-03-31"` | `30/03/2026` (trap) |
| Pacific/Kiritimati | `"2026-03-30T10:00:00.000Z"` | `"2026-03-31"` | `31/03/2026` |

Both zones are needed: LA exposes the string-parse trap, Kiritimati exposes the `Date`-serialization shift.

### Pattern 6: Migrations and seed split (SEC-05, D-01..D-05)
- **Stubs:** Replace V7, V8, V9, V11, V12 with a comment-only SQL file. V10 keeps its two `CREATE INDEX IF NOT EXISTS` statements and drops the seed `INSERT`. Verified: a fresh database with stubs applied (plus the V13 draft) has 0 rows in organizations, users, workspaces, projects and audit_events, and both `idx_dependencies_*` indexes exist `[VERIFIED: local spike]`. Existing dev DBs are unaffected because `schema_migrations` already lists those versions and `migrate.js` skips by filename. This also removes ~550 KB of the real program data from HEAD (D-03).
- **Hidden seed side effects being removed:** V7 also inserts a user `seed|config-import` (`config-import@local.dev`) and the org `config-seed-org`; V8 cross-joins all users into that org; V10's seed inserts a dependency when the table is empty. All disappear with the stubs.
- **`V2` fix (new finding F9):** `GRANT ... TO postgres` at `V2__rls_policies.sql:35` fails when the cluster superuser is not named `postgres`. Options: (a) keep the compose skeleton on the default `postgres` user and note the limitation (zero edits); (b) also edit V2 under the D-01 exception to wrap the grant in `DO $$ IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') ...` or delete it (the owner already holds these privileges). Recommend (b), done in the same plan as the stubs, because Phase 7's hosted/compose DB will not necessarily use that name.
- **Refactor `migrate.js`:** it executes on import and calls `process.exit`, so tests cannot reuse it. Export `migrate(databaseUrl, dir?)` and keep a CLI guard like `server.js` (`if (process.argv[1] === fileURLToPath(import.meta.url))`). The fresh-install test and `seed:dev` tests need it.
- **README:** rewrite `migrations/README.md` (it currently documents `seed:config`, V7-V12 seeding and the "prefers an org that has workspaces" heuristic) to state: migrations are schema-only, V7-V12 are stubs and why, drop/recreate local DB then `npm run seed:dev`.
- **Delete:** `packages/api/scripts/generate-config-seed.mjs` and the `seed:config` script (D-05). Remove `DEFAULT_ORG_ID` from `server.js` and `.env.example` (unused).

### Pattern 7: `seed:dev` (D-02, D-06, D-07)
- Entry: `packages/api/src/db/seeds/dev.js`, script `"seed:dev": "node src/db/seeds/dev.js"`; log prefix `seed:`. Accept `--sub` or `DEV_ADMIN_SUB`; refuse when `NODE_ENV=production` or when neither is given; run as the owner role from `DATABASE_URL`.
- Do **not** parse `js/config_base.js` at seed time (it is a classic script `const CONFIG = {...}` with no exports; reading it needs `eval`/`new Function`/`vm`, the thing D-05 removes). Embed a synthetic data module (workflow, labels, 10 deliverables in two groups, ISO dates) copied by hand from `config_base.js`. `config_base.js` has no dependencies, so add two or three hand-written ones so arrows exist.
- One transaction per org. Inside it `set_config('app.current_org_id', <org>, true)` and `set_config('app.current_user_id', <user>, true)` (parameterized) before inserts. This keeps the audit trigger working and user-attributed even if the owner is not a superuser: spike showed that with a non-superuser trigger-function owner under FORCE RLS the trigger succeeds only because the org GUC is set `[VERIFIED: local spike]`.
- Idempotent (`ON CONFLICT` on slug / `(org_id, user_id)` / `(workspace_id, name)`). `users.email` is `NOT NULL UNIQUE`, so accept `--email`/`DEV_ADMIN_EMAIL` with a default such as `dev-admin@local.dev` (`[ASSUMED]` default).
- Two orgs: A (demo roadmap, dev admin = admin), B (3-5 projects, different workflow and group names; owned by a synthetic user such as `dev|org-b-admin`, which cannot sign in through Auth0). Optional `--member-of-b viewer` flag lets the developer eyeball switching with `X-Org-Id`. Keep the module importable (`seedDev({ client, sub, email })`) so the Phase 7 smoke test can reuse it.

### Pattern 8: Compose skeleton (one plan; Phase 7 finishes it)
Scope: `postgres` (image `postgres:16`, matches CI) + `migrate` job (owner `DATABASE_URL`, `npm run migrate`) + `api` (`APP_DATABASE_URL` as `roadmapsnap_app`). Flushes out these concrete problems:
1. **Role problem:** V2 needs a `postgres` role (F9) -> keep `POSTGRES_USER=postgres` or fix V2. The app role is created by V4 with the hard-coded password `apppassword` (DEP-02 removes it later); the skeleton's `APP_DATABASE_URL` uses it.
2. **Seed problem:** after `docker compose up`, `select count(*) from organizations` must be 0; the demo data appears only after an explicit `docker compose run --rm migrate npm run seed:dev -- --sub <sub>` (or an equivalent one-off).
3. **Build-context problem:** there is no Dockerfile for the API today and `packages/api` has its own `package-lock.json` (no workspaces yet; Phase 2 adopts npm workspaces). Use build context `./packages/api` with `npm ci --omit=dev` now; expect to revisit if Phase 2 moves the lockfile to the root. `loadEnv.js` tolerates a missing `.env` (ENOENT is swallowed), so container env comes purely from compose.
4. **Ordering:** `api` depends on `migrate` with `condition: service_completed_successfully`; `migrate` depends on `postgres` with `condition: service_healthy` (`pg_isready` healthcheck).
5. **NODE_ENV:** the skeleton must set it explicitly (`development`; D-10(c) refuses unset, D-10(b) refuses test JWKS under `production`). The local JWKS needs `AUTH_TEST_JWKS` only for scripted verification.
6. **Node base image:** Node 20 is EOL [CITED: nodejs.org/en/about/previous-releases]; Phase 2 owns the version decision (STATE.md). For the skeleton use `node:22-alpine` or `node:24-alpine` `[ASSUMED]` and note it as provisional.
- Verification is scripted/manual (not part of `api-ci.yml`; DEP-06 owns the CI smoke test): `docker compose up --build -d`, `curl :4000/health`, assert 0 org rows, assert the api boot log shows the role check passed, then (optional) one token-authenticated request against the seeded two orgs.

### Anti-Patterns to Avoid
- **`SET LOCAL ... = '${id}'` string interpolation** (current `context.js`): both the injection-shaped risk and the no-tx no-op. Use `SELECT set_config('app.current_org_id', $1, true)`.
- **Catching a DB error inside a handler and continuing to write in the same tx.** Postgres keeps the tx aborted; the final `COMMIT` silently rolls back. The hook detects it (`command === 'ROLLBACK'`) and returns 500; handlers that need partial-failure tolerance must use `SAVEPOINT`. Existing 23505 catches in `projects.js` return immediately, so they are fine.
- **Returning a `Date` for a DATE column**, or `new Date('YYYY-MM-DD')` anywhere in the API.
- **A second connection from `pool` at request time** (the dev bootstrap does this). Enforce with a test.
- **Keeping the superuser URL as an API fallback.** Removing the `DATABASE_URL` default is itself a security fix.
- **Per-request provisioning that can race** unguarded: use `INSERT ... ON CONFLICT (auth0_id) DO NOTHING` then re-`SELECT` (read committed sees the concurrent winner).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification for tests | A custom "trusted header" or fake-token scheme | `jose` `generateKeyPair` + `SignJWT` + `createLocalJWKSet` | Exercises the real `jwtVerify` path; no bypass to leak |
| Tenant filtering | `WHERE org_id = $1` sprinkled in handlers as the primary defense | Postgres RLS (FORCE) with a NOSUPERUSER role | A forgotten filter becomes a data leak; RLS holds regardless |
| Parameterized session variables | String-built `SET LOCAL` | `SELECT set_config(name, $1, true)` | Bind parameters, tx-local |
| Safe-GUC reads in policies | Bare `current_setting(...)::uuid` | `NULLIF(current_setting(name, true), '')::uuid` wrapped in `app_current_*()` functions | Avoids `22P02` on pooled-connection residue |
| Identity lookup before org is known | `SECURITY DEFINER` lookup functions, `BYPASSRLS`, `row_security = off` | Self-select policies on `users`/`org_members`/`organizations` | No privileged objects; works for any owner |
| Date validation | Regex for `YYYY-MM-DD` | Fastify/Ajv `format: 'date'` | Rejects impossible calendar dates (`2026-02-30`) and ISO timestamps |
| Date parsing at the API edge | `new Date(...)` round-trips | `pg.types.setTypeParser(1082, v => v)` | The value never becomes an instant |
| Commit/rollback bookkeeping | Ad hoc try/finally in each route | One hook pair | Single place for the silent-rollback guard and release semantics |
| Migration runner | A new tool | The existing `migrate.js`, refactored to export a function | Filename tracking is what makes D-01 work |

**Key insight:** every shortcut in this domain (header bypass, superuser connection, `row_security = off`, seed-org join) was added to make local dev easier and silently disables the thing being sold. The replacements (real JWTs from a local JWKS, a seed script, self-select policies) are no harder, and each can be asserted by a test.

## Runtime State Inventory

This phase removes seed data and changes how migrations seed, so existing databases matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing local dev DBs hold the org `config-seed-org`, the user `seed|config-import`, 6 workspaces, ~230 projects, ~125 dependencies and ~1240 audit rows (counts from a V1-V12 run) | None in code (D-04). Document drop/recreate + `seed:dev` in the migrations README |
| Live service config | None (no hosted DB exists, per D-04) | None |
| OS-registered state | None | None |
| Secrets/env vars | Developers' local `packages/api/.env` use `DATABASE_URL` for the API; the API will now require `APP_DATABASE_URL` and `NODE_ENV`. V4's `apppassword` stays until DEP-02 | Update `.env.example`; call the env rename out in the README and PR description |
| Build artifacts | `packages/api` has no `node_modules` or Dockerfile in the working tree; nothing stale | None |

## Common Pitfalls

### Pitfall 1: Tests keep passing while RLS is off
**What goes wrong:** the suite is green because the API runs as a superuser.
**Why:** tests build the API with `DATABASE_URL` (superuser) and also use that URL for fixtures.
**How to avoid:** API reads only `APP_DATABASE_URL`; fixtures use an admin pool; a test asserts `current_user` and `current_setting('is_superuser')` through the real request path.
**Warning signs:** removing a policy does not fail any API test.

### Pitfall 2: Parallel test files against one database
**What goes wrong:** `node --test tests/*.test.js` runs files as separate concurrent processes sharing one DB; a "fresh install has zero rows" assertion fails if another file has inserted data, and global cleanup (`DELETE ... LIKE '%-test'`) in one file can delete another file's fixtures.
**How to avoid:** unique slugs/subs per file (existing convention uses `process.pid` + `Date.now()`); the fresh-install test creates its own scratch database (`CREATE DATABASE`) via the admin connection and migrates it; never assert global row counts in the shared DB; never use blanket `LIKE` cleanups.

### Pitfall 3: `formatPlannedDate` becomes a day-shift bug
Covered in Pattern 5 (verified). Delete the function; add the test under `America/Los_Angeles` first.

### Pitfall 4: Silent `COMMIT` -> `ROLLBACK`
Covered in Pattern 1 and F6. Check `result.command`; surface 500; use `SAVEPOINT` for tolerated failures.

### Pitfall 5: `''::uuid` residue
After any tx using `set_config(..., true)` the pooled session returns `''`, not NULL (F1, F5). Every policy must go through `app_current_*()` (NULLIF). Add a catalog assertion that no policy definition contains the bare `current_setting('app.current_` cast.

### Pitfall 6: `/auth/me` for a user with no org
D-12 says `/auth/me` succeeds with `orgs: []`. Currently it returns `role: request.dbUser?.role ?? 'viewer'` and spreads the whole JWT payload. For no-org users return `role: null`; `packages/app/src/hooks/useRole.ts` already does `(data?.role as Role) ?? 'viewer'`, so the SPA tolerates null. `/auth/me` and `PATCH /auth/me` currently use `[authenticate, setRequestContext]`, so the context step must not 403 by itself; only `requireRole`/tenant routes emit `NO_ORG`. Implement `NO_ORG` as "context sets `request.orgId = null`; a shared `requireOrg` check (inside `requireRole` and in the GET handlers that currently hand-check `request.orgId == null`) replies 403 with the code".

### Pitfall 7: Auth0 access tokens often carry no `email`
F8: provisioning crashes with `23502` for such tokens. STATE.md already assigns the Auth0 Action/`/userinfo` question to Phase 4, but Phase 1's success criterion 3 ("a brand-new user who signs in") should not 500 for the real token shape. See Open Question 3.

### Pitfall 8: Two distinct subs, one email
`users.email` is `UNIQUE`; a second Auth0 identity (e.g. social + password) with the same email hits `23505` -> 500. Out of scope for Phase 1; note it for Phase 4 and make sure the user-provisioning error path returns a clean error, not an aborted-tx leak.

### Pitfall 9: Local-dev impersonation disappears
Removing `X-Test-User-Sub` also removes the dev's quick `curl` path. The replacement is real JWTs from the local JWKS (`AUTH_TEST_JWKS`). A tiny `scripts/dev-token.mjs` (generate keypair to a gitignored file, print JWKS + a signed token) is worth it for scripted local use and the compose skeleton check; mark it discretionary.

## Code Examples

### Tenant context resolution (parameterized, verified)
```js
// Source: Spike D2 (verified as roadmapsnap_app on postgres:16) `[VERIFIED: local spike]`
await c.query('BEGIN');
await c.query("select set_config('app.current_auth0_id', $1, true)", [auth0Id]);
let user = (await c.query('select id, email, display_name, preferences from users where auth0_id = $1', [auth0Id])).rows[0];
if (!user) {
  await c.query(
    'insert into users (auth0_id, email, display_name) values ($1, $2, $3) on conflict (auth0_id) do nothing',
    [auth0Id, email, name],
  );
  user = (await c.query('select id, email, display_name, preferences from users where auth0_id = $1', [auth0Id])).rows[0];
}
await c.query("select set_config('app.current_user_id', $1, true)", [user.id]);
const memberships = (await c.query(
  'select org_id, role from org_members where user_id = $1 order by created_at asc', [user.id])).rows;
// choose org per D-12..D-14, then:
await c.query("select set_config('app.current_org_id', $1, true)", [orgId]);
```

### Catalog test (SEC-03 breadth)
```sql
-- every public table with an org_id column must have RLS enabled, forced, and >= 1 policy
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped);
-- plus: users (no org_id) asserted separately; allowlist only schema_migrations.
-- also assert no pg_policy definition matches the bare "current_setting('app.current_" cast.
```

### Dates test skeleton
```js
// run: TZ=America/Los_Angeles node --test tests/dates.test.js ; TZ=Pacific/Kiritimati node --test tests/dates.test.js
// Guard against silently running in UTC:
if (process.env.TZ) assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, process.env.TZ);
// fixtures: '2026-03-31' (month end), '2026-01-01', '2026-12-31', '2024-02-29', '2026-03-08' (LA DST start)
// write through the tenant-tx client with a string param, read via GET /api/v1/workspaces/:id/projects,
// assert milestones[key] === the exact input string.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `request.routerPath` | `request.routeOptions.url` | Fastify 5 | The `/health` guard in `context.js` never matches; delete it |
| `SET LOCAL x = '...'` strings | `set_config(name, $1, true)` inside `BEGIN` | Long-standing Postgres idiom | Parameterized, tx-local |
| Bare `current_setting(...)::uuid` in policies | `NULLIF(...)::uuid` | Needed whenever pooled connections reuse sessions | Prevents `22P02` |
| Node 20 base | Node 22/24 (Node 20 is EOL) [CITED: nodejs.org/en/about/previous-releases] | 2026 | Phase 2 owns the pin |

**Deprecated/outdated in this repo:** `X-Test-User-Sub`, the `row_security = off` dev bootstrap, `scripts/generate-config-seed.mjs` (`new Function`), `DEFAULT_ORG_ID`, the unused `@fastify/jwt` dependency, local copies of `requireRole` in `workspaces.js` and `projects.js` (AGENTS.md says use `fastify.requireRole`; consolidating them is optional cleanup, do it only if a plan already touches those files).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Error code name `NOT_A_MEMBER` and HTTP 400 for a malformed `X-Org-Id`/`?orgId` (D-13 only fixes 403 for non-members) | Pattern 2 | Phases 4/6 route on codes; rename is cheap now, costly later |
| A2 | Adding `REVOKE` on `schema_migrations` and `UPDATE/DELETE` on `audit_events`, plus `search_path` on the audit function, belongs in this phase's V13 | Pattern 2 | Scope creep vs leaving the app role able to tamper with history |
| A3 | Enabling RLS on `users` (self + co-member policies) in Phase 1 rather than leaving it open | Pattern 2 | Phase 4 invite/member-list policies must build on it; leaving it open leaves every user's email readable through any bug |
| A4 | `idle_in_transaction_session_timeout = '30s'` for the app role | Pattern 1 | Too short for slow handlers; too long delays leak recovery |
| A5 | Node 22/24 alpine image for the compose skeleton | Pattern 8 | Rework when Phase 2 fixes the version |
| A6 | Default dev admin email `dev-admin@local.dev` for `seed:dev` | Pattern 7 | Collides if two developers share a DB (unlikely) |
| A7 | Behavior when migrations are owned by a non-superuser (e.g. a managed-DB admin role) beyond the audit-trigger case tested | Pattern 3/8 | Hosted deployment surprises; only the trigger case was spiked |
| A8 | Performance of `app_current_*()` functions in policies (STABLE SQL, inlinable) was not measured | Pattern 2 | Per-row GUC reads on large tables; mitigate with `(SELECT app_current_org_id())` initplan form if needed |
| A9 | A dev-token script is worth building (`scripts/dev-token.mjs`) | Pitfall 9 | Skipping it makes scripted local use harder only |

## Open Questions

1. **Include `users` RLS and the three hardening items (A2/A3) in Phase 1?**
   - What we know: the policy shape works with them and without them; without `users` RLS any SQL/handler bug can read every user's email.
   - What's unclear: whether the user wants this scope in Phase 1 vs Phase 4.
   - Recommendation: include `users` RLS (it is a small, tested addition and Phase 4 builds on it) and the two `REVOKE`s; flag in the plan so the user can drop them.

2. **Edit `V2` (guard the `TO postgres` grant) or pin compose to `POSTGRES_USER=postgres`?**
   - What we know: V2 fails on any other superuser name (F9); editing V2 is another D-01-style exception and harmless for existing DBs.
   - Recommendation: edit V2 and also pin compose to `postgres` for the skeleton. Ask the user to confirm the second exception.

3. **Tokens without `email` (F8).**
   - What we know: provisioning 500s today; real Auth0 access tokens often lack `email` (STATE.md Phase 4 blocker).
   - Options: (a) tests always include `email`, real-token handling deferred to Phase 4 (document the 500 as known); (b) `ALTER TABLE users ALTER COLUMN email DROP NOT NULL` (UNIQUE still allows multiple NULLs) so first sign-in succeeds with an email-less user; Phase 4 fills it from the Action/`/userinfo`.
   - Recommendation: (b) only if the user wants criterion 3 to hold for real tokens now; otherwise (a) with an explicit test documenting current behavior. Needs a user decision.

4. **Seed membership shape for Org B.**
   - Recommendation: dev admin is admin of Org A only (D-06); Org B is owned by a synthetic non-loginable user; optional flag adds the dev admin to B as `viewer` for hand-checking `X-Org-Id` switching.

5. **Route-coverage guard for SEC-03 "any endpoint".**
   - Recommendation: an `onRoute` hook registered at the root of `build()` records every route into a decorated `routeTable`; the isolation test iterates it and fails if a route has no matrix entry or an explicit documented exemption (`/health`, `/`). This makes "any endpoint" credible without relying on reviewers.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API, tests | yes | v26.13.1 (local); CI targets 20 | CI image stays Node 20 until Phase 2; code in this phase uses nothing newer than Node 20 features |
| npm | installs | yes | works (`npm ci` verified) | - |
| Docker | Postgres for tests, compose skeleton | yes | server 29.9.3; Compose v5.7.0 | - |
| PostgreSQL (project instance on `localhost:5432`) | API tests, `npm run migrate` | **no** at research time (only unrelated containers; nothing for RoadmapSnap listening) | - | Start `postgres:16` locally; spikes used throwaway containers (removed) |
| `psql` on host | manual checks | no | - | `docker exec <container> psql ...` |
| Postgres 16 image | spikes, compose | yes (pulled `postgres:16-alpine`) | 16 | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a local project Postgres (start one before running API tests; the plan should document the one-line `docker run` with the pre-created NOSUPERUSER role, mirroring `api-ci.yml`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`), `node:assert/strict` (existing convention) |
| Config file | none; script in `packages/api/package.json` (`"test": "NODE_ENV=test node --test tests/*.test.js"`) |
| Quick run command | `cd packages/api && NODE_ENV=test node --test tests/tenant-isolation.test.js` |
| Full suite command | `cd packages/api && npm test` (plus `npm run test:tz`, see below) |
| Required services | Postgres 16 with the NOSUPERUSER `roadmapsnap_app` role and V1-V13 applied; env `DATABASE_URL` (admin, fixtures/migrate), `APP_DATABASE_URL` (API), `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` |

New scripts: `"test:tz": "NODE_ENV=test TZ=America/Los_Angeles node --test tests/dates.test.js && NODE_ENV=test TZ=Pacific/Kiritimati node --test tests/dates.test.js"`. `api-ci.yml` runs `npm test` then `npm run test:tz`; its env already provides `APP_DATABASE_URL`; add nothing secret.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Inside a real request (ad hoc route with `[authenticate, setRequestContext]`) `current_user` is `roadmapsnap_app`, `is_superuser` is `off`, `app.current_org_id`/`user_id` equal the resolved ids; after the response the GUC residue is `''` and never another org's id; no `SET LOCAL` string interpolation remains in `src/` | integration + static | `NODE_ENV=test node --test tests/tenant-tx.test.js` | Wave 0 |
| SEC-01 | 4xx and thrown errors roll back; 2xx commits; an aborted-tx COMMIT yields 500 | integration | same file | Wave 0 |
| SEC-02 | `build()` rejects with a superuser URL, with a `BYPASSRLS` role, with a role that inherits the owner; accepts `roadmapsnap_app`; env refusals (b)(c)(e) and missing `APP_DATABASE_URL` | unit + integration | `NODE_ENV=test node --test tests/boot-checks.test.js` | Wave 0 |
| SEC-03 | Matrix: user in org A against every route with org B resource ids and `X-Org-Id`/`?orgId` of B (reads 404/403, writes 404/403, 0 rows changed in B verified via admin pool); route-coverage guard; catalog test (RLS enabled + forced + policy on every `org_id` table, `users` RLS, no bare `current_setting` cast in policies); audit row written for app-role writes with the right `user_id` | integration | `NODE_ENV=test node --test tests/tenant-isolation.test.js tests/rls-catalog.test.js` | Wave 0 (existing `rls.test.js` is kept and migrated to `set_config` + signed fixtures) |
| SEC-04 | New sub is not added to any org (`orgs: []`, tenant route -> 403 `NO_ORG`, `/auth/me` 200); `X-Test-User-Sub` is ignored (401); no `row_security`/`config-seed-org`/`dev-default` strings in `src/` | integration + static | `NODE_ENV=test node --test tests/no-bypass.test.js` | Wave 0 |
| SEC-04 | `X-Org-Id` of a non-member org -> 403 (not fallback); default org is the oldest membership | integration | tenant-isolation file | Wave 0 |
| SEC-05 | Scratch database + `migrate()` -> 0 rows in organizations/users/workspaces/projects/milestones/dependencies/audit_events and the two dependency indexes exist; existing-DB path (stubs skipped by filename) covered by a second scratch DB that has V1-V12 recorded | integration | `NODE_ENV=test node --test tests/seed-fresh.test.js` | Wave 0 |
| SEC-05 | `seed:dev` populates two orgs, is idempotent, refuses in production, and Org B data is invisible to Org A's admin through the API | integration | `NODE_ENV=test node --test tests/seed-dev.test.js` | Wave 0 |
| SEC-06 | Date fixtures round-trip byte-for-byte via the API under `America/Los_Angeles` and `Pacific/Kiritimati`; invalid dates rejected with 400 at schema level; app adapter converts ISO -> `DD/MM/YYYY` | integration (+ vitest for the adapter) | `npm run test:tz`; `cd packages/app && npx vitest run src/api/client.test.ts` | Wave 0 |
| All | Static guard: no file under `src/` except `db/` imports `pool`/`query` from `db/client.js` | static (grep in node:test) | `node --test tests/no-bypass.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant test file (about 5-15 s each; the whole suite took 16 s on the current 39 tests).
- **Per wave merge:** `cd packages/api && npm test && npm run test:tz`.
- **Phase gate:** full API suite and `test:tz` green, `cd packages/app && npx tsc --noEmit && npx vitest run`, root `npm test` untouched and green, before `/gsd-verify-work`. The manual compose check (below) is recorded as a verification step.

### Wave 0 Gaps
- [ ] `tests/helpers/auth.js` - keypair, `AUTH_TEST_JWKS` wiring, `signToken` (D-09; all four existing API test files migrate to it)
- [ ] `tests/helpers/db.js` - admin pool + app pool, unique-fixture builders, targeted cleanup (no blanket `LIKE`), imports `db/types.js`
- [ ] RED first: a cross-tenant test and a "stranger is not auto-joined" test written against the current code with the API on `APP_DATABASE_URL`, committed failing, then made green
- [ ] `tests/tenant-tx.test.js`, `tests/tenant-isolation.test.js`, `tests/rls-catalog.test.js`, `tests/boot-checks.test.js`, `tests/no-bypass.test.js`, `tests/seed-fresh.test.js`, `tests/seed-dev.test.js`, `tests/dates.test.js`
- [ ] `migrate.js` refactor to an exported `migrate()` (needed by two tests and by `seed:dev` tests)
- [ ] `packages/app/src/api/client.test.ts` case for the ISO -> `DD/MM/YYYY` adapter
- [ ] `api-ci.yml`: add `npm run test:tz`; the app role pre-creation step stays (V4 also creates it, the `|| true` is fine)

Manual-only verification (justified: Docker orchestration is not in Phase 1's CI scope): `docker compose up --build`, health endpoint 200, organizations count 0, api log shows boot check passed, `seed:dev` then a two-org check by hand.

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `jose` `jwtVerify` with issuer, audience, `algorithms: ['RS256']`; no header bypass; local JWKS only when explicitly enabled and refused in production |
| V3 Session Management | no | Stateless bearer tokens; no server sessions |
| V4 Access Control | yes | Postgres FORCE RLS as NOSUPERUSER app role; `fastify.requireRole`; org membership check before any tenant query |
| V5 Input Validation | yes | Fastify JSON-schema (`format: 'uuid'`, `format: 'date'`), parameterized queries only, parameterized `set_config` |
| V6 Cryptography | yes (limited) | `jose` for JWT; no custom crypto; no secrets committed (`apppassword` is a known debt for DEP-02) |
| V7 Error Handling / Logging | partly | Keep `{ error, message }` shape; do not echo DB error text; structured/redacted logging is DEP-05 |
| V14 Configuration | yes | Boot refusals (D-10), no default NODE_ENV or DB URL, CORS rule in production |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant read/write via forged `X-Org-Id` / `?orgId` | Elevation / Info disclosure | Membership list checked first; non-member -> 403; RLS as backstop |
| API connected as superuser/BYPASSRLS/owner | Elevation | Boot assertion including `pg_has_role(...,'USAGE')` owner-inheritance check |
| Tenant GUC leaking across pooled connections | Info disclosure | `set_config(..., true)` inside a tx; `NULLIF` readers; leak test with `max: 1` pool |
| Impersonation header reachable in a deployed build | Spoofing | Header removed entirely; local JWKS refused when `NODE_ENV=production` |
| JWT algorithm confusion | Spoofing | `algorithms: ['RS256']` (verified rejection of HS256) |
| FK and unique checks bypass RLS (covert channel; cross-org references) | Info disclosure / Tampering | RLS bypass for referential checks is documented behavior [CITED: postgresql.org/docs/16/ddl-rowsecurity.html]; composite `(org_id, id)` FKs are a Phase 3 item (dependencies/milestones writes). Cross-tenant FK test cases belong in Phase 3 |
| `SECURITY DEFINER` audit trigger without pinned `search_path` | Elevation | `ALTER FUNCTION audit_trigger_function() SET search_path = public, pg_temp` (A2) |
| App role can tamper with `audit_events` / `schema_migrations` | Tampering / Repudiation | REVOKE UPDATE/DELETE / ALL (A2) |
| Real program data in repo history | Info disclosure | Removed from HEAD only; accepted risk per D-03 / deferred |
| Seed run against production | Tampering | `seed:dev` refuses `NODE_ENV=production`; runs only from an explicit command |
| SQL injection via identifiers in `SET LOCAL` | Tampering | Removed; `set_config` with bind parameters |

## Sources

### Primary (HIGH confidence)
- Local spikes on `postgres:16-alpine` (throwaway containers, removed): reproduced failures F1-F9, policy-shape flow, audit trigger for the app role (superuser and non-superuser function owner), boot-check query (3 roles), fresh-install stubs, DATE parsers under 3 timezones, Fastify `format: 'date'` strictness, hook-pair transaction, `onReady` rejection, `jose` local JWKS and algorithm pinning. Scripts lived in the session scratchpad, not the repo.
- Repo files read this session (see "Verified In-Repo Facts"): `server.js`, `context.js`, `auth.js`, `rbac.js`, `db/client.js`, `db/migrate.js`, routes, V1-V12 migrations, tests, `api-ci.yml`, `.env.example`, `js/config_base.js`, app `timeline.ts`/`useRole.ts`.
- https://www.postgresql.org/docs/16/ddl-rowsecurity.html - superuser/BYPASSRLS always bypass; owners bypass unless FORCE; permissive policies OR-ed; referential integrity checks bypass RLS; security-definer functions run with their owner's privileges.
- https://fastify.dev/docs/latest/Reference/Hooks/ - hook order; `onSend` async; `onResponse` runs after send; `onRequestAbort`; hooks encapsulated.
- https://nodejs.org/en/about/previous-releases - Node 20 listed EOL; 22/24/26 LTS.
- npm registry (`npm view`) - latest `jose`, `pg`, `fastify`.

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md`, `ARCHITECTURE.md`, `SUMMARY.md` (earlier project research; the claims reused here were re-verified by spike where they drive a decision).

### Tertiary (LOW confidence)
- None relied on without a spike. The postgresql.org COMMIT page does not state the aborted-transaction behavior; that behavior was verified empirically (F6), not from docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions confirmed from lockfile install and registry
- Architecture: HIGH - tenant tx, policy shape, boot check, date handling and fresh-install behavior were each executed
- Pitfalls: HIGH - F1-F9 reproduced; the parallel-test-process pitfall is from reading `package.json` and the test files (not a failure reproduction)
- Compose skeleton: MEDIUM - role/order/context problems identified (one reproduced), but no compose file was built or run

**Research date:** 2026-11-19
**Valid until:** 2026-12-19 (stable domain; re-check only if Postgres major, Fastify major, or the D-xx decisions change)
