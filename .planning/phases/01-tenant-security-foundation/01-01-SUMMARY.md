---
phase: 01-tenant-security-foundation
plan: 01
subsystem: api
tags: [postgres, rls, fastify, jose, rs256, tenant-isolation, node-test]

requires:
  - phase: none
    provides: first plan of the first phase
provides:
  - V13 tenant policies (NULLIF-safe app_current_*() readers, self-select policies, users RLS, app-role hardening)
  - Per-request tenant transaction plugin running as roadmapsnap_app with parameterized set_config
  - Exported selectOrg(memberships, requested) with NOT_A_MEMBER and INVALID_ORG_ID outcomes
  - RS256-pinned JWT verification with an AUTH_TEST_JWKS local key set (refused under production)
  - Shared API test helpers (tests/helpers/auth.js, tests/helpers/db.js) and the tracer cross-tenant test
affects: [01-02, 01-03, 01-04, 01-05, 01-08, phase-03, phase-04, phase-06]

plan_head_before: 19996dfdb97f78edd0c6453d80edb5e43eeafd2e
plan_head_after: 01a7e0a319caf290c26050adbcc0e643d61923d4

actuals:
  tokens: 8200
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tenant context only via select set_config('app.current_*', $1, true) inside BEGIN; policies read it through app_current_*()"
    - "Identity and membership resolved under FORCE RLS through self-select policies, no SECURITY DEFINER lookup"
    - "Provisioning commits in its own short transaction; route writes commit only for statuses below 400"
    - "Test tokens signed by a local RS256 keypair published as AUTH_TEST_JWKS"

key-files:
  created:
    - packages/api/src/db/migrations/V13__tenant_policies.sql
    - packages/api/tests/helpers/auth.js
    - packages/api/tests/helpers/db.js
    - packages/api/tests/tenant-isolation.test.js
  modified:
    - packages/api/src/plugins/context.js
    - packages/api/src/plugins/auth.js
    - packages/api/src/db/client.js

key-decisions:
  - "selectOrg returns a status object ({status:'ok'|'invalid'|'not_a_member', membership}) so it stays pure and the plugin maps it to 400/403"
  - "A token with no subject claim is rejected with 401 in authenticate (extra guard; request.user.sub is the identity anchor)"
  - "The API pool is not closed in an onClose hook in this plan; the plan did not ask for it and a module-level singleton would break repeated build() in one process"

patterns-established:
  - "Error body shape { error, message, code } for new tenant errors: NOT_A_MEMBER 403, INVALID_ORG_ID 400, EMAIL_REQUIRED 403, EMAIL_IN_USE 409"
  - "Test fixtures use uniq() slugs and subs plus an ordered admin cleanup(); never blanket LIKE cleanups"

requirements-completed: [SEC-01, SEC-03, SEC-04]

coverage:
  - id: D1
    description: "A signed-JWT request runs as roadmapsnap_app in one tenant transaction; an org A member sees only org A workspaces and gets 404 for an org B workspace id (RLS enforced, handler has no org filter)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#org A member lists only org A workspaces"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#org A member cannot read an org B workspace by id (RLS, handler has no org filter)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A foreign X-Org-Id returns 403 NOT_A_MEMBER and a malformed one returns 400 INVALID_ORG_ID, with no fallback to another org"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#X-Org-Id naming an org the caller is not a member of returns 403 NOT_A_MEMBER"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#a malformed X-Org-Id returns 400 INVALID_ORG_ID"
        status: pass
    human_judgment: false
  - id: D3
    description: "A brand-new subject is provisioned with a users row and zero memberships and is never auto-joined to any org; tenant routes answer 403"
    requirement: "SEC-04"
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-isolation.test.js#a brand-new subject is provisioned with zero memberships and tenant routes answer 403"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pre-existing auth, projects and workspaces tests still pass on the app role (44/44 API tests) and root Lite npm test stays green (141/141)"
    verification:
      - kind: integration
        ref: "npm --prefix packages/api test"
        status: pass
      - kind: unit
        ref: "npm test (repo root)"
        status: pass
    human_judgment: false
  - id: D5
    description: "V13 hardening (REVOKEs, audit_trigger_function search_path pin, idle_in_transaction_session_timeout) and users RLS are in place; behavior is asserted by the later catalog tests in 01-05, not here"
    verification: []
    human_judgment: true
    rationale: "No test in this plan inspects the catalog for these settings; 01-05 owns that assertion, so a reviewer should confirm V13 contents until then"

duration: 8min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 01: Tenant Isolation Tracer Summary

**Signed-JWT requests now run as the non-superuser `roadmapsnap_app` inside one transaction with parameterized tenant GUCs; V13 policies make identity, membership and org isolation work under FORCE RLS, and a stranger is never auto-joined.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-20T22:43:34Z
- **Completed:** 2026-11-20T22:51:50Z
- **Tasks:** 1 (tracer, RED then GREEN)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Tenant isolation is proven through the real request path: the same handler SQL that has no org filter returns 404 for another tenant's workspace id, because RLS runs for the app role (before this plan the suite only passed through the superuser bypass).
- Seed-org auto-join, the "most workspaces" org heuristic, the development bootstrap (second connection plus a row-security change) and string-built `SET LOCAL` statements are deleted from `context.js`.
- Org resolution is explicit: X-Org-Id, then `?orgId`, else the oldest membership. A non-member gets 403 `NOT_A_MEMBER`, a malformed value 400 `INVALID_ORG_ID`, an empty header counts as absent, and a token without email for an unknown subject gets 403 `EMAIL_REQUIRED` instead of a 500.
- JWT verification pins RS256, limits `request.user` to `{ sub, email, name }`, and supports `AUTH_TEST_JWKS` for tests, refused at registration under `NODE_ENV=production`.

## Task Commits

1. **Task 1 RED: failing cross-tenant tracer test** - `7893830` (test)
2. **Task 1 GREEN: tenant transaction as the app role** - `01a7e0a` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `packages/api/src/db/migrations/V13__tenant_policies.sql` - app_current_*() readers, org_isolation rewritten onto them, member_self_select, member_orgs_select, users RLS (user_self, user_comember_select), REVOKEs, search_path pin, idle-in-transaction timeout
- `packages/api/src/plugins/context.js` - tenant-transaction plugin, exported `selectOrg`, `finishTenantTx`, onSend/onRequestAbort/onResponse hooks
- `packages/api/src/plugins/auth.js` - RS256 pin, local JWKS support, narrowed `request.user`, missing-subject guard
- `packages/api/src/db/client.js` - pool reads `APP_DATABASE_URL`
- `packages/api/tests/helpers/auth.js` - local RS256 keypair, AUTH_TEST_JWKS wiring, token signers
- `packages/api/tests/helpers/db.js` - admin/app pools, unique fixture builders, ordered cleanup
- `packages/api/tests/tenant-isolation.test.js` - five tracer cases

## Decisions Made

- `selectOrg` returns a status object instead of replying itself, keeping it a pure, unit-testable function; the plugin maps statuses to 400/403.
- Added a guard that a verified token must carry a non-empty `sub` (401 otherwise), since every later step keys on it.
- Did not add an `onClose` pool shutdown (not in the plan; the singleton pool would be unusable after a second `build()` in one process).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Reject verified tokens that carry no subject**
- **Found during:** Task 1 (auth.js changes)
- **Issue:** With `request.user` narrowed to `{ sub, email, name }`, a validly signed token without `sub` would reach route handlers with no `dbClient` because `setRequestContext` returns early when `sub` is missing.
- **Fix:** `authenticate` throws inside the verify block when `payload.sub` is not a non-empty string, so the caller gets the existing 401 Invalid token.
- **Files modified:** packages/api/src/plugins/auth.js
- **Verification:** full API suite green; tracer cases unaffected
- **Committed in:** 01a7e0a

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Small hardening on the same file; no scope creep.

## Issues Encountered

- The RED run exits only after the test-runner timeout. With no local JWKS path yet, each request tries to fetch `https://test.auth0.com/.well-known/jwks.json`, and the unresolved sockets keep the process alive. The assertions still fail with 401 as intended, and the hang disappears once `AUTH_TEST_JWKS` is honored (GREEN run completes in seconds).
- The local environment guard blocks shell commands that name `packages/api/.env`, so that file was created with the Write tool instead of `cp`/`sed`. It stays gitignored and uncommitted.
- Local test setup: container `roadmapsnap-pg` (postgres:16) and the `roadmapsnap_app` NOSUPERUSER role were created as described in the plan; migrations V1-V13 applied.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. AUTH_TEST_JWKS, the org-resolution path and the users RLS surface are all covered by the plan's threat model (T-01-02 to T-01-11).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-02 can move `AUTH_TEST_JWKS` onto `fastify.config` and add the boot refusal; 01-05 can grow `tenant-isolation.test.js` into the full matrix and add the NO_ORG code; 01-08 can remove the `X-Test-User-Sub` path and move the existing tests to signed JWTs against a green suite.
- The `X-Test-User-Sub` block is intentionally still in `auth.js` (01-08 removes it in the same commit that migrates the header-based tests).
- Concern carried forward: real Auth0 access tokens with no email claim cannot sign in until Phase 4 (they now get a clean 403 `EMAIL_REQUIRED`, not a 500).

## Self-Check: PASSED

- Created files exist: V13 migration, context.js, auth.js, client.js, helpers/auth.js, helpers/db.js, tenant-isolation.test.js (all FOUND).
- Commits `7893830` and `01a7e0a` are ancestors of HEAD (FOUND); RED precedes GREEN in history.
- Acceptance criteria re-run: tracer 5 pass / 0 skipped; set_config 5 lines; SET LOCAL 0; row_security 0; config-seed-org 0; pool.connect 1; onRequestAbort 2; RS256 pin 1; createLocalJWKSet 2; `...payload` 0; APP_DATABASE_URL 3; V13 policy-name grep 5; `npm --prefix packages/api test` 44/44; root `npm test` 141/141.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*
