---
phase: 01-tenant-security-foundation
plan: 10
subsystem: api
tags: [fastify, rbac, cors, boot-checks, node-test, gap-closure, security]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-02 bootChecks.js (assertSafeConfig, assertSafeDbRole) and the boot-checks.test.js harness; 01-09 CR-01 and WR-01 fixes recorded in the ledger by Task 3"
provides:
  - "WR-06 closed: requireRole fails closed for any role that is not an own key of the frozen ROLE_LEVEL table, at request time and at registration"
  - "WR-08 closed: no CORS_ORIGIN schema default; resolveCorsOrigin falls back to http://localhost:3000 only under development and test, and production refuses before any database access"
  - "Database-free rbac.test.js and extended boot-checks.test.js (withEnv deletes undefined overrides, injectWithEnv helper)"
  - "Review ledger shows CR-01, WR-01, WR-06 and WR-08 fixed (open 14 of 18); SEC-01 traceability reads pending re-verification"
affects: [phase-01-reverification, phase-04, phase-07]

plan_head_before: 0a2ef490aba3c2190cf17bf1fec0f601691ee682
plan_head_after: d0513113d904eba070609e638665245d78dc3330

actuals:
  tokens: 4983
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Role lookups use Object.hasOwn on a frozen table and return level 0 for anything else, so a plain-object prototype key can never satisfy a role check"
    - "Security-relevant env settings carry no schema default; a resolver function applies a development-only fallback and refuses otherwise"

key-files:
  created:
    - packages/api/tests/rbac.test.js
    - .planning/phases/01-tenant-security-foundation/deferred-items.md
  modified:
    - packages/api/src/plugins/rbac.js
    - packages/api/src/db/bootChecks.js
    - packages/api/src/server.js
    - packages/api/tests/boot-checks.test.js
    - packages/api/.env.example
    - .planning/REQUIREMENTS.md
    - .planning/phases/01-tenant-security-foundation/01-REVIEW-DISPOSITION.md

key-decisions:
  - "WR-06 uses an own-property lookup, not the review's nullish fallback, because 'toString' and '__proto__' resolve to non-numbers that never compare below a level and would still be granted"
  - "WR-08 reverses 01-02's flagged assumption that CORS_ORIGIN keeps its localhost default; the localhost value survives only for development and test"
  - "resolveCorsOrigin also refuses '*' under production, matching assertSafeConfig, so it stays fail-closed if ever called first"
  - "CR-02 and WR-09 ledger rows stay open (not deferred) because this round records fixes only"

requirements-completed: [SEC-02, SEC-03]

coverage:
  - id: D1
    description: "requireRole denies unknown, case-variant, blank, null, undefined and inherited-key roles with 403 'Insufficient permissions', keeps the viewer < editor < admin hierarchy and the NO_ORG and 'User not found' bodies, rejects inherited keys at registration, and decides parallel calls independently"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "packages/api/tests/rbac.test.js (17 cases)"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js and tenant-isolation.test.js (44 cases, route-level roles unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production boot without an explicit CORS_ORIGIN is refused before any database access (unreachable APP_DATABASE_URL still yields the CORS message); development and test serve http://localhost:3000; an explicit origin is used trimmed"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "packages/api/tests/boot-checks.test.js#build() refuses a missing CORS_ORIGIN under production before touching the database"
        status: pass
      - kind: unit
        ref: "packages/api/tests/boot-checks.test.js (resolveCorsOrigin cases, assertSafeConfig undefined origin)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Review ledger and requirements traceability record the gap round without overstating it: four findings fixed, CR-02 and WR-09 still open, SEC-01 unchecked and pending re-verification"
    verification:
      - kind: other
        ref: "Task 3 grep gates: 'ledger ok' and 'traceability ok'"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-21
status: complete
---

# Phase 01 Plan 10: Gap Closure Round 2 Summary

**requireRole now fails closed for every role that is not an own key of a frozen table (WR-06), the API refuses a production boot without an explicit CORS_ORIGIN before touching the database (WR-08), and the review ledger records four fixed findings with SEC-01 left pending re-verification.**

## Performance

- **Duration:** about 9 min (start time was not captured at spawn; estimated from the first commit and the reading phase)
- **Started:** 2026-11-21T06:27Z (approximate)
- **Completed:** 2026-11-21T06:36:21Z
- **Tasks:** 3
- **Files modified:** 9 (8 tracked files in the plan commits plus the new deferred-items.md)

## Accomplishments

- WR-06: `requireRole` validates the minimum role and the caller's role with `Object.hasOwn` on a frozen `ROLE_LEVEL`; 'owner', 'superadmin', 'VIEWER', '', null, undefined and the inherited keys 'toString', '__proto__', 'constructor', 'hasOwnProperty' and 'valueOf' all get 403, and `requireRole('toString')` and `requireRole('__proto__')` throw at registration like 'owner' does.
- WR-08: `CORS_ORIGIN` lost its schema default. `resolveCorsOrigin(config)` in `bootChecks.js` returns the trimmed explicit origin, falls back to `DEV_CORS_ORIGIN` under development and test, and throws the existing CORS refusal otherwise. `server.js` registers CORS through it, and the refusal happens at `assertSafeConfig`, before `createPool`.
- Task 3 recorded the round: CR-01 and WR-01 (01-09) and WR-06 and WR-08 (01-10) are `fixed` in `01-REVIEW-DISPOSITION.md` (open 14, total 18), and the SEC-01 traceability row reads "Gap fixed in 01-09, pending re-verification". Nothing was marked done; the SEC-01 checkbox stays unchecked and SEC-02 to SEC-06 rows are unchanged.

## TDD Evidence

- **WR-06 RED** (`d622b13`): 11 of 17 cases failed on the planned assertions at HEAD: 'owner', 'superadmin', 'VIEWER' and the five inherited keys returned 200 instead of 403, the non-string role case was granted, `requireRole('toString')` did not throw ("Missing expected exception"), and the parallel case granted 'owner'. The 6 cases that passed were the ones already correct at HEAD ('', null, undefined, hierarchy, NO_ORG, User not found). Semantic assessment: the target tests executed and failed on the planned behavior, not on setup or import faults. The `gsd_run check tdd-red-evidence` classifier was not run, because the plan is `type: execute` rather than `type: tdd`.
- **WR-06 GREEN** (`43ce3f1`): 17 of 17 pass; `tenant-tx.test.js` and `tenant-isolation.test.js` still pass (44 of 44).
- **WR-08 RED** (`8063e76`): 6 of 26 failed: the three `resolveCorsOrigin` unit cases, the production missing-origin case (rejected with `connect ECONNREFUSED 127.0.0.1:1` instead of the CORS message, proving the schema default let boot reach the database), the `CORS_ORIGIN: ''` case under test, and the padded explicit-origin case. The development-unset case passed at HEAD because the schema default produced the same localhost origin, which is the behavior the fix preserves.
- **WR-08 GREEN** (`1464b69`): 43 of 43 pass across `boot-checks.test.js` and `rbac.test.js`.
- No REFACTOR commit; no cleanup was needed.

## Task Commits

1. **Task 1: WR-06 requireRole fails closed** - `d622b13` (test, RED), `43ce3f1` (fix, GREEN)
2. **Task 2: WR-08 production requires an explicit CORS_ORIGIN** - `8063e76` (test, RED), `1464b69` (fix, GREEN)
3. **Task 3: ledger and SEC-01 traceability** - `d051311` (docs)

**Plan metadata:** the SUMMARY commit follows this file (docs: complete plan).

## Files Created/Modified

- `packages/api/src/plugins/rbac.js` - frozen `ROLE_LEVEL`, `roleLevel()` own-property lookup, registration check with `Object.hasOwn`
- `packages/api/tests/rbac.test.js` - 17 database-free unit cases with `replyStub` and `decide` helpers
- `packages/api/src/db/bootChecks.js` - `DEV_CORS_ORIGIN`, `resolveCorsOrigin`, header comment
- `packages/api/src/server.js` - `CORS_ORIGIN` schema entry without a default, CORS registered through `resolveCorsOrigin(fastify.config)`
- `packages/api/tests/boot-checks.test.js` - `withEnv` deletes `undefined` overrides, `injectWithEnv`, resolver, production-refusal, dev-default and explicit-origin cases
- `packages/api/.env.example` - CORS_ORIGIN comment documents the production requirement
- `.planning/REQUIREMENTS.md` - SEC-01 traceability row
- `.planning/phases/01-tenant-security-foundation/01-REVIEW-DISPOSITION.md` - four rows and entries `fixed`, `open: 14`
- `.planning/phases/01-tenant-security-foundation/deferred-items.md` - the out-of-scope test race below

## Decisions Made

- Own-property lookup instead of `?? 0` for WR-06 (stronger guarantee, same fail-closed intent), as the plan flagged.
- This reverses 01-02's flagged assumption that CORS_ORIGIN keeps its localhost default, per the user's scope decision for this round. The localhost value is kept for development and test so local behavior is unchanged. Root `.env.example`, `compose.yaml` and CI are untouched (compose runs with NODE_ENV=development, CI with test).
- `requirements-completed` lists SEC-02 and SEC-03 as the template requires, but REQUIREMENTS.md checkboxes were deliberately not marked: Phase 1 awaits re-verification, and the plan says this round marks nothing done.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resolveCorsOrigin returned '*' under production**
- **Found during:** Task 2 (GREEN run)
- **Issue:** The plan's action text returns any non-empty trimmed origin, but its `<behavior>` requires the resolver to throw for '*' under production. My first implementation followed the action text and my '*' unit case failed.
- **Fix:** Under production a '*' origin falls through to the refusal, so the resolver stays fail-closed on its own.
- **Files modified:** `packages/api/src/db/bootChecks.js`
- **Verification:** `boot-checks.test.js` 43 of 43 with `rbac.test.js`.
- **Committed in:** `1464b69`

**2. [Test design] Namespace import for the RED resolver tests**
- **Found during:** Task 2 (RED)
- **Issue:** The plan's RED step imports `resolveCorsOrigin` and `DEV_CORS_ORIGIN` by name, which makes the whole test file fail to load at HEAD, so no target test fails on an assertion.
- **Fix:** Resolver cases read them through `import * as bootChecks`, so the file loads and the production missing-origin case fails on its planned assertion. `assertSafeConfig` and `assertSafeDbRole` keep their named import.
- **Files modified:** `packages/api/tests/boot-checks.test.js`
- **Committed in:** `8063e76`

---

**Total deviations:** 2 (1 Rule 1 bug against the plan's own action text, 1 test-design choice for a valid RED)
**Impact on plan:** No scope change; both keep the plan's stated behavior intact.

## Issues Encountered

- `npm --prefix packages/api test` is intermittently red or cancelled on a full run because of `tuple concurrently updated` raised from `migrate()` inside `seed-dev.test.js` (seen on 3 of 11 full runs; every rerun went green: 184 of 184, 0 failed, 0 skipped). It is a pre-existing race between parallel test files sharing one database, unrelated to this plan's files. Logged in `deferred-items.md`, not fixed (scope boundary).

## Plan-Level Verification

- `rbac.test.js` plus `boot-checks.test.js`: 43 of 43, 0 skipped.
- `npm --prefix packages/api test`: 184 of 184, 0 failed, 0 skipped on a clean run (see Issues Encountered for the flake).
- `npm --prefix packages/api run test:tz`: 14 of 14 in both timezones, 0 skipped.
- Gates: "rbac lookup ok", "cors config ok", "ledger ok", "traceability ok" all printed.
- Acceptance: `grep -cE "server.js|helpers/db" tests/rbac.test.js` is 0; no `01-10` commit touches `compose.yaml` or the root `.env.example`; the Task 3 commit lists exactly the two planned files.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or trust-boundary surface; T-01-47 and T-01-48 are mitigated and covered by tests, T-01-50 by the Task 3 gates.

## User Setup Required

None - no external service configuration required. Operators deploying with NODE_ENV=production must now set CORS_ORIGIN explicitly or the API refuses to start.

## Next Phase Readiness

- WR-06 and WR-08 are closed; Phase 1 is ready for re-verification. CR-02 (Phase 3) and WR-09 (Phase 4) remain open by the user's decision, along with WR-02 to WR-05, WR-07, WR-10 and IN-01 to IN-06.
- The test-suite migration race in `deferred-items.md` should be fixed before CI reruns lean on `npm test` being deterministic.

## TDD Gate Compliance

Plan type is `execute` with `tdd="true"` tasks. Both tasks have a `test(01-10)` RED commit that precedes its `fix(01-10)` GREEN commit (`d622b13` then `43ce3f1`, `8063e76` then `1464b69`). Both fix commits use the plan's prescribed `fix` type rather than `feat`.

## Self-Check: PASSED

- Created and modified files found on disk: rbac.test.js, rbac.js, bootChecks.js, server.js, boot-checks.test.js, .env.example.
- Commits found in HEAD ancestry: d622b13, 43ce3f1, 8063e76, 1464b69, d051311.
- `commits: 5` measured with `git rev-list --count 0a2ef49..HEAD` before this file was committed.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-21*
