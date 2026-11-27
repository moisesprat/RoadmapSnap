---
phase: 01-tenant-security-foundation
plan: 02
subsystem: api
tags: [fastify, postgres, rls, boot-checks, rbac, transactions, node-test]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-01 per-request tenant transaction plugin and signed-JWT test helpers; 01-08 Bearer-only auth and signed-JWT API tests"
provides:
  - "assertSafeConfig, assertSafeDbRole and BOOT_CHECK_SQL: build() refuses to start as a superuser, BYPASSRLS or owner-inheriting role, and on unsafe NODE_ENV, APP_DATABASE_URL, AUTH_TEST_JWKS or CORS_ORIGIN"
  - "createPool(url, { max }) pool factory; one pool per app instance, ended on app.close()"
  - "Env schema without a DATABASE_URL default, a NODE_ENV default or DEFAULT_ORG_ID; APP_DB_POOL_MAX and AUTH_TEST_JWKS added"
  - "fastify.requireRole visible to route plugins (skip-override) and answering 403 NO_ORG for a caller with no organization"
  - "build({ extraRoutes }) code-only test seam and app.routeTable ({ method, url } for every route)"
  - "Tests proving commit, rollback, swallowed-error 500, GUC residue, connection release and single-row provisioning under a race"
affects: [01-05, 01-06, 01-07, phase-03, phase-04]

plan_head_before: 594167e3b57a2627ad14a9e8b5396d50548f4c9c
plan_head_after: dfef1827e2dcc2f0f0888f63d4e914aa1f8a1455

actuals:
  tokens: 8000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Boot refusal in build(): config checks first, then one role-check query on the app pool, pool.end() before rethrowing"
    - "Plugins receive the pool through register options; nothing imports the DB module"
    - "Route-level tests mount ad hoc routes through build({ extraRoutes }) so they run behind the real tenant hooks"
    - "Symbol.for('skip-override') on a plugin function (fastify-plugin mechanism, no dependency) to share a decorator with route plugins"

key-files:
  created:
    - packages/api/src/db/bootChecks.js
    - packages/api/tests/boot-checks.test.js
    - packages/api/tests/tenant-tx.test.js
  modified:
    - packages/api/src/server.js
    - packages/api/src/db/client.js
    - packages/api/src/plugins/context.js
    - packages/api/src/plugins/auth.js
    - packages/api/src/plugins/rbac.js

key-decisions:
  - "BOOT_CHECK_SQL is the RESEARCH query plus one extra column (r.rolname AS role) so refusal messages and the returned { role } name the connected role"
  - "NODE_ENV must be development, test or production; a typo such as 'prod' is refused instead of silently skipping the production-only checks"
  - "rbac plugin registers before the context plugin and is not encapsulated, so routes registered under it see fastify.requireRole"

patterns-established:
  - "Error bodies keep { error, message, code }: NO_ORG 403 'No organization'"
  - "Env-dependent tests set process.env per case and restore it; an unset value is simulated with the empty string because loadEnv fills missing keys from the local .env"

requirements-completed: [SEC-01, SEC-02]

coverage:
  - id: D1
    description: "build() rejects with 'Refusing to start' for a superuser role, a NOSUPERUSER BYPASSRLS role and a NOSUPERUSER role that inherits the table owner, and when the database is unreachable; it resolves for roadmapsnap_app"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() rejects for the superuser role"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() rejects for a NOSUPERUSER BYPASSRLS role"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() rejects for a role that inherits the table owner"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() rejects when the database is unreachable instead of starting unchecked"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() resolves for roadmapsnap_app and app.close() ends the pool"
        status: pass
    human_judgment: false
  - id: D2
    description: "Config refusals: NODE_ENV empty or unknown, APP_DATABASE_URL missing, AUTH_TEST_JWKS under production (before any DB access) and CORS_ORIGIN '*' or empty under production; valid development, test and production configs are accepted"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "packages/api/tests/boot-checks.test.js#assertSafeConfig refuses a NODE_ENV outside development, test and production"
        status: pass
      - kind: unit
        ref: "packages/api/tests/boot-checks.test.js#assertSafeConfig refuses CORS_ORIGIN \"*\" or empty under production, trimmed"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() refuses AUTH_TEST_JWKS under production before touching the database"
        status: pass
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() resolves under production with a pinned CORS origin and no test JWKS"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 2xx commits the request transaction, a 4xx or a thrown error rolls it back, and a handler that swallows a database error and returns 200 yields a 500; requests run as roadmapsnap_app (not superuser) with the resolved org and user GUCs"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#a 2xx response commits the request transaction"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#a 4xx response rolls the request transaction back"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#a handler that swallows a database error and returns 200 produces a 500, not a silent rollback"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#request context: app role, not a superuser, with the resolved org and user GUCs"
        status: pass
    human_judgment: false
  - id: D4
    description: "On a one-connection pool the next request never sees the previous org, every request releases its client (five sequential, error paths followed by a healthy request), and parallel first requests by one new subject create exactly one users row with no 500"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#adjacency: the next request on the same pooled connection never sees the previous org"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#five sequential requests on a one-connection pool all complete (every request releases its client)"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#parallel first requests by one brand-new subject create exactly one users row and no 500"
        status: pass
    human_judgment: false
  - id: D5
    description: "fastify.requireRole is callable from route plugins and answers a caller with no membership with 403 { error: 'Forbidden', message: 'No organization', code: 'NO_ORG' }; app.routeTable lists every registered route"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#a brand-new subject with no organization gets 403 NO_ORG from requireRole"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#routeTable lists registered routes, including the extra test routes"
        status: pass
    human_judgment: false
  - id: D6
    description: "A client that disconnects mid-request gets its transaction rolled back and its pooled connection released by the onRequestAbort and onResponse hooks"
    requirement: "SEC-01"
    verification: []
    human_judgment: true
    rationale: "The plan marks this statement as a backstop (verification: backstop); no test aborts a request mid-flight, so a reviewer should confirm the hooks in context.js"

duration: 2min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 02: Boot refusal and transaction guarantees Summary

**build() now refuses to start under a superuser, BYPASSRLS or owner-inheriting database role or an unsafe config, and the per-request transaction is proven to commit, roll back, release and isolate tenant context, with `requireRole` shared with routes and a `NO_ORG` refusal.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-20T22:59:49Z
- **Completed:** 2026-11-20T23:02:14Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `assertSafeConfig` runs before any database access (NODE_ENV, APP_DATABASE_URL, AUTH_TEST_JWKS and CORS_ORIGIN under production) and `assertSafeDbRole` runs once inside `build()` on the app pool; both run under NODE_ENV=test too, with no switch to skip or soften them. An unreachable database makes `build()` reject, and the pool is ended before the error is rethrown.
- The env schema no longer defaults to a superuser `DATABASE_URL` or to `NODE_ENV=development`; `DEFAULT_ORG_ID` and the dotenv option are gone, and `src/loadEnv.js` is the single `.env` loader. `db/client.js` is a `createPool` factory and `contextPlugin` receives the pool through options, so no plugin imports the DB module.
- Transaction guarantees have tests: commit on 201, rollback on 409 and on a thrown error, a swallowed `select 1/0` turns into a 500 (COMMIT-became-ROLLBACK detection), no GUC residue between requests on a one-connection pool, every request releases its client, and four parallel first requests by one new subject leave exactly one users row.
- `rbacPlugin` is marked `Symbol.for('skip-override')` and registered before the context plugin, so route plugins can call `fastify.requireRole`; a caller with no membership gets 403 `NO_ORG`. `build({ extraRoutes })` and `app.routeTable` give later plans a way to test real hooks and check route coverage.

## Task Commits

1. **Task 1 RED: failing boot refusal tests** - `feebba9` (test)
2. **Task 1 GREEN: refuse to start on unsafe role or config** - `d63b29c` (feat)
3. **Task 2 RED: failing tenant transaction, residue, release and NO_ORG tests** - `d8d8b30` (test)
4. **Task 2 GREEN: share requireRole, emit NO_ORG, extraRoutes seam, routeTable** - `dfef182` (feat)

**Plan metadata:** recorded in the following docs commit.

## Files Created/Modified

- `packages/api/src/db/bootChecks.js` - `BOOT_CHECK_SQL`, `assertSafeConfig`, `assertSafeDbRole`
- `packages/api/src/db/client.js` - `createPool(url, { max })` replaces the lazy singleton, `query`, `testConnection` and `pool`
- `packages/api/src/server.js` - env schema, boot checks, per-app pool with onClose, `routeTable`, `extraRoutes`, plugin order
- `packages/api/src/plugins/context.js` - pool from options, forwards `extraRoutes`
- `packages/api/src/plugins/auth.js` - reads `AUTH_TEST_JWKS` and `NODE_ENV` from `fastify.config`, registers `extraRoutes` after the built-in routes
- `packages/api/src/plugins/rbac.js` - skip-override, `NO_ORG` body
- `packages/api/tests/boot-checks.test.js` - 19 cases, unit and integration, with real throwaway roles
- `packages/api/tests/tenant-tx.test.js` - 13 cases through ad hoc routes on one- and five-connection pools

## Decisions Made

- Added `r.rolname AS role` to the verbatim RESEARCH boot query so refusal messages and the returned `{ role }` can name the connected role; the checks themselves are unchanged (`pg_has_role(current_user, c.relowner, 'USAGE')`).
- Kept the stricter NODE_ENV allow-list the plan flagged (development, test, production) instead of refusing only unset.
- Tenant-tx tests build two apps (`APP_DB_POOL_MAX` 1 and 5) in one process, setting the variable before each `build()` and restoring it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The local secret guard blocks shell reads of `packages/api/.env`, so the environment was exercised only through the tests and the plan's manual negative check, never by printing that file.
- `packages/api/.env.example` still lists `DEFAULT_ORG_ID` and has no `APP_DB_POOL_MAX`; neither file is in this plan's scope, so it was left for the plan that owns the env template.
- `src/loadEnv.js` still says "so db/client.js ... see DATABASE_URL" in its header comment; cosmetic and out of scope.

## Verification

- `NODE_ENV=test node --test packages/api/tests/boot-checks.test.js packages/api/tests/tenant-tx.test.js`: 32 pass, 0 fail, 0 skipped.
- `npm --prefix packages/api test`: 88 pass, 0 fail, 0 skipped (56 before, plus 19 and 13 new).
- Root `npm test` (Lite): 141 pass, 0 fail.
- Manual negative check (`NODE_ENV=test`, superuser `APP_DATABASE_URL`): stderr shows `Refusing to start: database role "postgres" is a superuser`, exit code 1.
- Acceptance greps: `default: 'development'` 0, `DEFAULT_ORG_ID` 0 in server.js, `assertSafeDbRole` 2, `pg_has_role(...'USAGE')` 1, `export function createPool` 1, `db/client` in context.js 0, `skip-override` 1, `NO_ORG` 1, `routeTable` 4, `extraRoutes` in auth.js 1+, `const app = await build();` 1.

## Known Stubs

None.

## Threat Flags

None. The `extraRoutes` seam (T-01-16) and every other new surface are covered by the plan's threat model; the CLI guard still calls `build()` with no argument.

## User Setup Required

None - no external service configuration required. A local `packages/api/.env` must define `APP_DATABASE_URL` (and `NODE_ENV` unless the caller sets it), since the server schema no longer defaults them.

## Next Phase Readiness

- 01-05 can add the route-coverage guard on `app.routeTable`, delete the local `requireRole` copies in `workspaces.js` and `projects.js` in favor of `fastify.requireRole`, and add the static "no DB module import" guard.
- 01-06 can reuse `build({ extraRoutes })` for the dates tests.
- 01-07's compose check can grep the `boot: database role check passed` log line; CI already supplies `NODE_ENV` and `APP_DATABASE_URL`.

## Self-Check: PASSED

- Created files exist: bootChecks.js, boot-checks.test.js, tenant-tx.test.js (all FOUND).
- Commits `feebba9`, `d63b29c`, `d8d8b30`, `dfef182` are ancestors of HEAD (FOUND); each RED precedes its GREEN.
- Acceptance criteria and plan-level verification re-run (see Verification): all pass.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*
