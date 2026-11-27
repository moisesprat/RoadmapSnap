---
phase: 01-tenant-security-foundation
plan: 05
subsystem: testing
tags: [rls, postgres, fastify, node-test, rbac, tenant-isolation]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-01 NULLIF-safe RLS policies and V13 hardening; 01-02 build({ extraRoutes }), app.routeTable, fastify.requireRole with NO_ORG; 01-08 signed-JWT auth helpers and /auth/me orgs"
provides:
  - "workspaces.js and projects.js authorized only through fastify.requireRole (viewer/editor/admin), one NO_ORG body for every no-org caller"
  - "no-bypass.test.js: static guards for bypass literals, forbidden imports and the CLI build() call"
  - "tenant-isolation.test.js: per-route cross-tenant MATRIX forced complete by app.routeTable, header and query-string attacks, NO_ORG, default-org, tie-break, parallel and audit cases"
  - "rls-catalog.test.js: catalog assertions for forced RLS, policy shape, app-role hardening and definer functions"
  - "rls.test.js on parameterized set_config with parallel-safe fixtures and identity-stage cases"
affects: [01-06, 01-07, phase-03-write-paths, phase-04-onboarding]

actuals:
  tokens: 10900
  tasks: 3
  commits: 4
plan_head_before: f8e50a8961ec40eeaaf10631f658431931f152a3
plan_head_after: 33efbfc39ae3a8c116ef98f0097a2d3ffe7709e6

tech-stack:
  added: []
  patterns:
    - "Route-coverage guard: MATRIX keys must equal the non-exempt app.routeTable keys, so a new route fails the suite until its cross-tenant attack exists"
    - "Before/after admin-pool snapshot of the victim org around every attack"
    - "Catalog tests assert database shape (RLS flags, policy expressions, role attributes) so schema drift fails closed"
    - "Static source scans for bypass literals and import boundaries, with literals kept out of src comments"

key-files:
  created:
    - packages/api/tests/no-bypass.test.js
    - packages/api/tests/rls-catalog.test.js
  modified:
    - packages/api/src/routes/workspaces.js
    - packages/api/src/routes/projects.js
    - packages/api/tests/tenant-isolation.test.js
    - packages/api/tests/rls.test.js

key-decisions:
  - "Route files use [...commonPreHandler, fastify.requireRole(role)] on every tenant route including reads (viewer), so the NO_ORG refusal comes from one place"
  - "SHAPES (concrete request per route) is kept next to MATRIX; the header and query loops iterate the live route table and fail on a route with no SHAPES entry, so the loops cannot silently skip a new route"
  - "Import scan strips comments before matching specifiers so JSDoc import('pg') types in src/db do not trip the guard, while the literal scan runs on raw text"

requirements-completed: [SEC-01, SEC-03, SEC-04]

coverage:
  - id: D1
    description: "workspaces.js and projects.js authorize only through fastify.requireRole; local role helpers and in-handler org checks are gone; no-org callers get 403 NO_ORG on every tenant route"
    requirement: SEC-04
    verification:
      - kind: unit
        ref: "packages/api/tests/no-bypass.test.js#a caller with no membership gets 403 NO_ORG from GET /api/v1/workspaces"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#a caller with no membership gets 403 NO_ORG on every tenant route, and 200 with orgs [] on /auth/me"
        status: pass
    human_judgment: false
  - id: D2
    description: "Static guards fail if a bypass literal, a db/client or pg import in routes/plugins, an extra db/client importer or an argument to build() in the CLI block appears in packages/api/src"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "packages/api/tests/no-bypass.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every tenant route is attacked cross-tenant by id, X-Org-Id and ?orgId with unchanged org B snapshots, and a route without a MATRIX entry or a stale entry fails closed"
    requirement: SEC-03
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#route coverage"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#matrix by id / by header / by query string"
        status: pass
    human_judgment: false
  - id: D4
    description: "Default org is the oldest membership, equal created_at resolves to the smaller org_id, 20 interleaved parallel requests stay isolated, and an app-role write is audited with the caller user_id and org_id"
    requirement: SEC-03
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#default org / tie-break / parallel / audit"
        status: pass
    human_judgment: false
  - id: D5
    description: "Catalog proves forced RLS and a policy on every public table except schema_migrations, no direct GUC reads in policies, a hardened roadmapsnap_app and a single pinned SECURITY DEFINER function"
    requirement: SEC-03
    verification:
      - kind: integration
        ref: "packages/api/tests/rls-catalog.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "rls.test.js keeps its eight tests on parameterized set_config with parallel-safe fixtures and adds identity-stage cases for current_user_id and current_auth0_id"
    requirement: SEC-03
    verification:
      - kind: integration
        ref: "packages/api/tests/rls.test.js"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-21
status: complete
---

# Phase 1 Plan 05: Cross-tenant matrix, RLS catalog and no-bypass guards Summary

**Every tenant route now authorizes through the shared `fastify.requireRole`, and three suites prove it: a route-table-driven cross-tenant matrix, a database catalog test for forced RLS and app-role hardening, and static guards that fail if bypass code or a direct DB import returns.**

## Performance

- **Duration:** about 25 min (start time was not captured by the run; estimated from the work done)
- **Completed:** 2026-11-20T23:11:41Z (UTC clock at last task commit)
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `workspaces.js` and `projects.js` lose their local `ROLE_LEVEL` and `requireRole` copies and every in-handler org check. All 9 tenant routes use `fastify.requireRole('viewer' | 'editor' | 'admin')`, so a caller with no membership gets the single `403 { error: 'Forbidden', message: 'No organization', code: 'NO_ORG' }` body (D-12).
- `no-bypass.test.js` scans every `.js` file under `packages/api/src` for the impersonation header, the row-security toggle, the old seed org slug, the dev-default slug and `SET LOCAL`, forbids `db/client` and `pg` imports in routes and plugins, restricts `db/client` importers to `server.js` and `src/db`, and asserts the CLI block calls `build()` with no argument.
- `tenant-isolation.test.js` grows from 5 to 25 tests. `MATRIX` has an entry for each of the 11 non-exempt routes in `app.routeTable`; header and query-string loops attack every route with org B; org B workspaces, projects, milestone and dependency counts and bob's preferences are compared before and after.
- NO_ORG on seven tenant routes plus `/auth/me` 200 with `orgs: []`, viewer refusal, default org by oldest membership (dave), equal `created_at` tie-break by smaller `org_id` (carol), 20 interleaved parallel requests, and audit attribution for an app-role write.
- `rls-catalog.test.js` (6 tests) asserts the catalog state V13 established so a future table or policy that regresses it fails.
- `rls.test.js` keeps its eight test names, drops the string-built session statements, the fixed slugs and the LIKE-suffix deletes, and adds two identity-stage cases.

## Task Commits

1. **Task 1: requireRole consolidation and static no-bypass guard**
   - `d9df76b` test(01-05): static guards plus the failing NO_ORG case (RED)
   - `e0642ed` refactor(01-05): authorize routes with fastify.requireRole (GREEN)
2. **Task 2: cross-tenant matrix** - `f905ef0` (test)
3. **Task 3: RLS catalog and parallel-safe rls.test.js** - `33efbfc` (test)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `packages/api/src/routes/workspaces.js` - six routes on `fastify.requireRole`; local helper and org checks removed
- `packages/api/src/routes/projects.js` - three mutations on `fastify.requireRole('editor')`; local helper and org checks removed
- `packages/api/tests/no-bypass.test.js` - static source guards and the NO_ORG case
- `packages/api/tests/tenant-isolation.test.js` - MATRIX, SHAPES, route-coverage guard, snapshotB and the behavior cases
- `packages/api/tests/rls-catalog.test.js` - catalog assertions
- `packages/api/tests/rls.test.js` - parameterized set_config, unique fixtures, two new cases

## Decisions Made

- Reads get `requireRole('viewer')` instead of a bare org check, so there is exactly one place that emits NO_ORG.
- A `SHAPES` map sits beside `MATRIX`. The header and query loops iterate the live route table and assert a SHAPES entry exists, so they cannot quietly skip a route the coverage test would also flag.
- The import scan strips comments first; the literal scan does not. This avoids false positives from JSDoc `import('pg')` type references while still catching a forbidden literal anywhere, comments included.

## Deviations from Plan

None - plan executed exactly as written.

The acceptance criterion that asks to comment out one MATRIX entry was run once on a temporary copy of the test file (not the committed file). Removing the `DELETE /api/v1/projects/:projectId` entry failed the route-coverage test with `uncovered: [ 'DELETE /api/v1/projects/:projectId' ]`. The copy was deleted afterwards.

## Issues Encountered

- Fastify validates the body and params schema before `preHandler`, so an invalid body gets 400 before the NO_ORG or role check runs. The matrix and NO_ORG cases therefore send schema-valid bodies and real UUIDs. This is existing behavior, not changed here.
- The plan's start time was not captured when execution began, so the duration above is an estimate.

## Verification

- `NODE_ENV=test node --test` on the four files: 47 tests, 0 failed, 0 skipped.
- `npm --prefix packages/api test` run twice back to back: 136 of 136 pass, 0 skipped (parallel-safety check).
- Root `npm test` (Lite): 141 of 141 pass.
- Acceptance greps: `function requireRole`, `ROLE_LEVEL` and `No organization context` return 0 in both route files; `fastify.requireRole('viewer')` returns 3 in `workspaces.js`; `SET LOCAL`, `LIKE '%-test'` and `skip:` return 0 in `rls.test.js`.

## Known Stubs

None.

## Threat Flags

None - no new network endpoint, auth path or schema change was introduced; the plan adds tests and removes duplicated authorization code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-06 can change the date handling in `GET /workspaces/:workspaceId/projects` without touching authorization; that block was left alone.
- Phase 3 write paths must add a MATRIX entry and a SHAPES entry for each new route or the suite fails.
- Edge probe SEC-04 stays flagged as an unresolved assumption for the verifier, as the plan states. The zero-membership case is covered by the NO_ORG tests.

## Self-Check: PASSED

- Created files exist: `no-bypass.test.js`, `rls-catalog.test.js`, `01-05-SUMMARY.md` (this file).
- Commits `d9df76b`, `e0642ed`, `f905ef0`, `33efbfc` are ancestors of HEAD; `git rev-list --count f8e50a8..HEAD` is 4.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-21*
