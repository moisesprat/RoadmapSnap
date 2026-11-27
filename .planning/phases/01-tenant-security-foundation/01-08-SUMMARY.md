---
phase: 01-tenant-security-foundation
plan: 08
subsystem: api
tags: [auth, jwt, rs256, fastify, node-test, tenant-isolation]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-01 signed-JWT test helpers (helpers/auth.js, helpers/db.js), request.memberships and request.dbUser.role from setRequestContext"
provides:
  - "Bearer-only authentication: no request header other than Authorization authenticates a caller (D-09)"
  - "GET /auth/me reports orgId, orgs [{ id, name, role }] and a nullable role, with no raw JWT claims (D-12)"
  - "PATCH /auth/me response built from the updated row: { sub, email, name, preferences }"
  - "auth, projects and workspaces API tests on locally signed RS256 JWTs and shared uniq fixtures, no skips"
affects: [01-05, phase-04, phase-06]

plan_head_before: 3ff5cc4be55dbc62a7ee4a2215325cfc17ed2f5e
plan_head_after: 1776550f81728992e76aba837148493f5b351f5d

actuals:
  tokens: 7700
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "API tests authenticate with await signToken(...) + bearer(...) plus an optional x-org-id header; fixtures come from helpers/db.js builders with uniq values and are removed with cleanup()"
    - "Response bodies that leave the server are built field by field, never by spreading request.user"

key-files:
  created: []
  modified:
    - packages/api/src/plugins/auth.js
    - packages/api/src/routes/auth.js
    - packages/api/tests/auth.test.js
    - packages/api/tests/projects.test.js
    - packages/api/tests/workspaces.test.js

key-decisions:
  - "The header deletion and the move of all three test files to signed JWTs landed in one commit, so no commit leaves the suite red"
  - "Kept every pre-existing test name and expectation; header-based cases now authenticate with a signed token for the same subject"

requirements-completed: [SEC-03, SEC-04]

coverage:
  - id: D1
    description: "A request with only the x-test-user-sub header gets 401, and the header next to a valid token is ignored so the token subject wins; no code path authenticates from a request header"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "packages/api/tests/auth.test.js#GET /auth/me with only the x-test-user-sub header returns 401"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#x-test-user-sub next to a valid token is ignored and the token subject wins"
        status: pass
    human_judgment: false
  - id: D2
    description: "JWTs verify only with RS256 against the configured key set; foreign-key, HS256, expired and wrong-audience tokens get 401"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "packages/api/tests/auth.test.js#a token signed by a foreign key returns 401"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#an HS256 token returns 401"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#an expired token returns 401"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#a token for the wrong audience returns 401"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /auth/me reports orgId, orgs [{ id, name, role }] and role; a user with no membership gets 200 with orgs [] and role null; neither /auth/me route echoes raw JWT claims"
    requirement: "SEC-04"
    verification:
      - kind: integration
        ref: "packages/api/tests/auth.test.js#GET /auth/me for a member reports orgId, orgs and role"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#GET /auth/me for a brand-new subject returns 200 with orgs [] and role null"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#GET /auth/me does not echo raw JWT claims"
        status: pass
      - kind: integration
        ref: "packages/api/tests/auth.test.js#PATCH /auth/me returns only sub, email, name and preferences"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every pre-existing projects and workspaces test name and expectation still holds when authenticated with signed RS256 JWTs, with no skipped tests"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "NODE_ENV=test node --test packages/api/tests/auth.test.js packages/api/tests/projects.test.js packages/api/tests/workspaces.test.js (37 pass, 0 fail, 0 skipped)"
        status: pass
      - kind: integration
        ref: "npm --prefix packages/api test (56 pass, 0 fail, 0 skipped)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 08: Remove the impersonation header, report orgs from /auth/me Summary

**Bearer-only auth with the X-Test-User-Sub path deleted, /auth/me reporting orgId, orgs and a nullable role, and the auth, projects and workspaces API tests running on locally signed RS256 JWTs.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-20T22:50:00Z (approximate)
- **Completed:** 2026-11-20T22:58:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- `plugins/auth.js` no longer reads any header except `Authorization`; the X-Test-User-Sub block and its comment are gone (D-09). A header-only request gets 401, and the header next to a valid token is ignored.
- `GET /auth/me` is built field by field: `sub`, `email`, `name`, `preferences`, `role` (null without membership), `orgId` and `orgs: [{ id, name, role }]` taken from `request.memberships`. `PATCH /auth/me` returns `{ sub, email, name, preferences }` from the updated row. Neither route spreads the JWT payload (D-12).
- `auth.test.js` covers header-only 401, header ignored next to a token, members and brand-new users on `/auth/me`, and foreign-key, HS256, expired and wrong-audience tokens. `projects.test.js` and `workspaces.test.js` build uniq fixtures through the `helpers/db.js` builders, authenticate with `await signToken` + `bearer`, and clean up with `cleanup()`; the string-built `SET LOCAL`, the row-security toggle and every `skip:` option are gone.

## Task Commits

1. **Task 1: Remove the impersonation header and move auth, projects and workspaces tests to signed JWTs** - `1776550` (feat)

**Plan metadata:** recorded in the following docs commit.

## Files Created/Modified

- `packages/api/src/plugins/auth.js` - Bearer-only authentication, header block deleted
- `packages/api/src/routes/auth.js` - `/auth/me` with orgId, orgs and nullable role; PATCH response built from the row
- `packages/api/tests/auth.test.js` - signed-JWT auth cases and `/auth/me` membership cases
- `packages/api/tests/projects.test.js` - signed JWTs, uniq fixtures, no skips
- `packages/api/tests/workspaces.test.js` - signed JWTs, uniq fixtures, no skips

## Decisions Made

- Header deletion and the test move landed in a single commit so no commit has a red suite or a test that depends on a removed path.
- Existing test names were kept; header-based cases now sign a token for the same subject. `signToken` is async in the 01-01 helper, so the plan's `bearer(signToken(...))` shorthand became `bearer(await signToken(...))` in a small `authHeaders` helper.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Acceptance greps: x-test-user-sub 0 in `plugins/auth.js`, `projects.test.js`, `workspaces.test.js` (and 0 in `packages/api/src`); `skip:` 0; `SET LOCAL` 0; `...request.user` 0; `orgs` and `request.memberships` present in `routes/auth.js`; `signHs256Token` present in `auth.test.js`.

## Verification

- `NODE_ENV=test node --test packages/api/tests/auth.test.js packages/api/tests/projects.test.js packages/api/tests/workspaces.test.js`: 37 pass, 0 fail, 0 skipped.
- `npm --prefix packages/api test`: 56 pass, 0 fail, 0 skipped.
- Root `npm test` (Lite): 141 pass, 0 fail.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths or schema changes; the change removes an authentication path and narrows two response bodies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every API test now authenticates through the real `jwtVerify` path, so 01-05's no-bypass guard can assert the header literal never returns to `packages/api/src`.
- `/auth/me` gives Phases 4 and 6 the `orgs` list and nullable `role` they route on; the SPA's `useRole` already tolerates a null role.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*

## Self-Check: PASSED

- FOUND: packages/api/src/plugins/auth.js, packages/api/src/routes/auth.js, packages/api/tests/auth.test.js, packages/api/tests/projects.test.js, packages/api/tests/workspaces.test.js
- FOUND: commit 1776550
