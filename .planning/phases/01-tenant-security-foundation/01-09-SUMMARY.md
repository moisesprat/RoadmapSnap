---
phase: 01-tenant-security-foundation
plan: 09
subsystem: api
tags: [fastify, pg, pg-pool, rls, tenant-isolation, node-test, gap-closure]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-01 per-request tenant transaction (context.js, finishTenantTx), tenant-tx.test.js harness and helpers/db.js, helpers/auth.js fixtures"
provides:
  - "CR-01 closed: an aborted request keeps its own client until its handler settles; its statements never run in another tenant's transaction"
  - "withTenantSettleGuard onRoute wrapper that finalizes handlers settling with undefined (Fastify skips reply.send and onSend after an abort)"
  - "WR-01: createPool with an idle-client error listener and a 5000 ms connect timeout; per-checkout client error listener (logCheckedOutClientError)"
  - "Abort regression tests over a real socket on a one-connection pool, plus checked-out client error tests and db-client.test.js"
affects: [01-10, phase-04, phase-06, phase-07]

plan_head_before: 59730c3c5931bdbd32ffd38c98349809c9abcacb
plan_head_after: f9f1575371dbecc04105c1ebc123908beb159643

actuals:
  tokens: 5341
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Tenant transaction is finalized only by finishTenantTx (the single caller of client.release), triggered by onSend, the onRoute settle guard or the onResponse net; onRequestAbort only logs"
    - "A checked-out pg client carries an error listener for exactly as long as it is checked out (attach after connect, remove on the line before release)"
    - "Abort tests use app.listen on an ephemeral port plus node:http and destroy(); GET routes only, because Node marks req.aborted only for unread bodies"

key-files:
  created:
    - packages/api/tests/db-client.test.js
  modified:
    - packages/api/src/plugins/context.js
    - packages/api/src/db/client.js
    - packages/api/tests/tenant-tx.test.js

key-decisions:
  - "A client disconnect no longer changes the transaction outcome: commit when the handler ends below 400, rollback otherwise, same as a connected client"
  - "The settle guard goes beyond deleting the abort release: Fastify 5.7.4 skips onSend and onResponse when a handler resolves undefined after an abort, so without the guard that path leaks a connection"
  - "A pool connect timeout stays a generic 500 (mapping to 503 is out of scope)"

patterns-established:
  - "Rejections are never caught by the settle guard: a rejected handler reaches reply.send(err), so onSend rolls it back"
  - "Pool and client error listeners log err.message only, never options or connection strings"

requirements-completed: [SEC-01]

coverage:
  - id: D1
    description: "An aborted org A handler keeps its transaction and tenant context; org B's follower on a one-connection pool gets 200 with its own org, after the aborted handler settles"
    requirement: SEC-01
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#abort mid-handler: the handler's later statements stay in its own transaction, and another org's next request gets 200 with its own org"
        status: pass
    human_judgment: false
  - id: D2
    description: "An aborted write lands only in org A and does not fail org B's concurrent request; a write followed by a throw rolls back"
    requirement: SEC-01
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#abort mid-handler before a write: the write stays in org A and another org's concurrent request still gets 200"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#abort mid-handler, then the handler throws: the write rolls back and the client is released"
        status: pass
    human_judgment: false
  - id: D3
    description: "A handler resolving undefined after its client aborted still has its transaction finalized and its client released"
    requirement: SEC-01
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#abort mid-handler, then the handler resolves undefined: its client is still released"
        status: pass
    human_judgment: false
  - id: D4
    description: "createPool has an idle-client error listener and a 5000 ms default connect timeout; a saturated pool rejects instead of hanging"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "packages/api/tests/db-client.test.js (cases a-d)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A request's client carries the error listener only while checked out; a backend terminated mid-transaction gives 500 and the next request gets 200"
    requirement: SEC-01
    verification:
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#a checked-out client carries the error listener only while the request holds it"
        status: pass
      - kind: integration
        ref: "packages/api/tests/tenant-tx.test.js#terminating a request backend mid-transaction gives that request 500 and the next request 200"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-21
status: complete
---

# Phase 01 Plan 09: Abort-safe tenant transaction and pg error handling Summary

**CR-01 closed by making onRequestAbort log-only and finalizing through an onRoute settle guard, plus WR-01 pool and checked-out client error listeners with a 5 s connect timeout.**

## Performance

- **Duration:** about 30 min (start time was not captured by a persisted variable, so this is an estimate)
- **Completed:** 2026-11-21T06:32Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- An aborted request no longer hands its tenant client to another request. `onRequestAbort` only logs; the transaction commits or rolls back by status when the handler settles, and `finishTenantTx` stays the only caller of `client.release`.
- `withTenantSettleGuard` (installed by an `onRoute` hook before `authPlugin` registers routes) finalizes handlers that settle with `undefined`, the one path where Fastify 5.7.4 runs neither `onSend` nor `onResponse`.
- A pool or checked-out client `error` event is logged instead of crashing the process, and a saturated pool rejects after 5 s instead of waiting forever.
- Four abort regression tests (real socket, one-connection pool), two checked-out client tests and a new `db-client.test.js` were added. API suite: 160 tests, 0 failed, 0 skipped. `test:tz`: 14 pass.

Tracer: `⚡ Tracer verified end-to-end — expanding`. Task 1's `<verify>` (tenant-tx file at 17 passing, abort-hook structural check, full API suite) passed before Task 2 started.

## Task Commits

1. **Task 1 (tracer): abort mid-handler no longer hands the tenant client to another tenant (CR-01)**
   - RED: `8add5f1` (test)
   - GREEN: `3f780b5` (fix)
2. **Task 2: pool and checked-out client error listeners plus a connect timeout (WR-01)**
   - RED: `6e84ae9` (test)
   - GREEN: `f9f1575` (fix)

**Plan metadata:** committed separately (docs: complete plan).

## TDD Gate Compliance

Both tasks followed RED then GREEN with a `test(01-09)` commit before each `fix(01-09)` commit. No REFACTOR commit was needed.

**Task 1 RED** (`8add5f1`), against the old hook:
- "abort mid-handler: the handler's later statements stay in its own transaction..." failed on the trailing-versus-first txid assertion (`'4974' !== '4973'`).
- "abort mid-handler before a write..." failed on `followerSeq > abortProbe.settledSeq`: the follower ran before the aborted handler settled.
- The silent and throw tests passed at HEAD. The plan predicted this: they guard against the leak the fix could introduce.
- Semantic assessment: the target tests executed and failed on the planned isolation and ordering assertions, not on load or fixture faults.

**Task 2 RED** (`6e84ae9`):
- db-client (a) failed with `connectionTimeoutMillis` undefined (expected 5000). (b) failed with 0 pool error listeners (expected 1). (c) failed with "Missing expected rejection": the saturated `connect()` never settled within the test's 3500 ms bound. (d) passed as a regression guard.
- `tenant-tx.test.js` failed to load because `context.js` had no `logCheckedOutClientError` export. This is a load failure rather than an assertion failure, so the RED for cases (e) and (f) is weaker than for the db-client cases. The plan prescribed the named import and predicted this ("the export is missing"). Both cases pass after the fix, but their RED was not observed on an assertion.
- The `gsd_run check tdd-red-evidence` classifier was not run, because the plan is `type: execute`, not `type: tdd`.

## Files Created/Modified

- `packages/api/src/plugins/context.js` - log-only abort hook, `withTenantSettleGuard` plus `onRoute` wiring, exported `logCheckedOutClientError` attached after connect and removed before release, new lifecycle header comment
- `packages/api/src/db/client.js` - `createPool(url, { max, connectionTimeoutMillis = 5000 })` and a `logIdleClientError` pool listener
- `packages/api/tests/tenant-tx.test.js` - Bob and org B fixtures, `abortApp` on a real socket, helpers (`deferred`, `withTimeout`, `nextSeq`, `abortProbe`), six new routes and six new tests (13 existing tests unchanged)
- `packages/api/tests/db-client.test.js` - pool error-listener and connect-timeout tests (cases a-d)

## Decisions Made

- A disconnect does not change the transaction outcome. It commits below 400 and rolls back otherwise, as for a connected client. The old abort rollback fired only when Node set `req.aborted` (unread bodies), so it was never a consistent rule. This is the plan's flagged assumption and is reversible.
- The settle guard returns non-thenable results unchanged, never attaches a rejection handler, and lets a finalize failure reject, so a still-connected client gets a 500.
- `server.js` is untouched: `createPool(url, { max })` inherits the 5000 ms default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bounded the saturated-pool test so the RED run could not hang**
- **Found during:** Task 2 (RED)
- **Issue:** Written as planned, db-client case (c) hung the test process at HEAD (no connect timeout), and the first RED run was killed by the 120 s command timeout. Handing back the second `connect()` client was also needed, otherwise `pool.end()` waited on the client the freed slot was given to.
- **Fix:** The test races the second `connect()` against a 3500 ms timer, so the missing option fails on an assertion. It releases the client that `connect()` eventually resolves with.
- **Files modified:** `packages/api/tests/db-client.test.js`
- **Verification:** RED run fails on "Missing expected rejection" in 3.5 s. GREEN run passes in about 300 ms.
- **Committed in:** `6e84ae9`

---

**Total deviations:** 1 auto-fixed (1 blocking, test design only)
**Impact on plan:** No change to the behavior under test or to production code. No scope creep.

## Issues Encountered

- `docs/roadmap-onepager.html` appeared as an untracked file during the run. It is not part of this plan and was left untouched and unstaged, along with the other pre-existing working-tree changes (`.planning/config.json`, `.planning/milestone.lock`, `.planning/state.json`).

## Verification

- `NODE_ENV=test node --test packages/api/tests/tenant-tx.test.js packages/api/tests/db-client.test.js`: 23 pass, 0 fail, 0 skipped, no "Unhandled 'error' event" on stderr.
- `npm --prefix packages/api test`: 160 pass, 0 fail, 0 skipped.
- `npm --prefix packages/api run test:tz`: 14 pass, 0 fail.
- Structural checks: the abort-hook region has 0 `finishTenantTx` calls, `addHook('onRoute'` and `withTenantSettleGuard` are present, `.release(` occurs once, and `removeListener('error', logCheckedOutClientError)` sits directly above `client.release(failure)`.
- `git log -- packages/api/src/server.js` lists no `01-09` commit.
- The optional manual reproduction of the verifier's scratch flow was not run separately: the regression tests assert the same two outcomes (org A's id on the trailing query, org B's request at 200).

## Known Stubs

None.

## Threat Flags

None. The plan's threats T-01-40 through T-01-46 are mitigated and each high threat has a named test. No new network endpoint, auth path or schema change was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Verification gap CR-01 and WR-01 are closed. 01-10 (WR-06, WR-08, ledger and traceability updates) is independent of this plan.
- No blockers.

## Self-Check: PASSED

- Files: `packages/api/tests/db-client.test.js`, `packages/api/src/plugins/context.js`, `packages/api/src/db/client.js`, `packages/api/tests/tenant-tx.test.js` all exist.
- Commits `8add5f1`, `3f780b5`, `6e84ae9`, `f9f1575` are ancestors of HEAD, and `git rev-list --count` from the recorded base reports 4.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-21*
