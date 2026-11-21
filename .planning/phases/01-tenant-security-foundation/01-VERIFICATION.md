---
phase: 01-tenant-security-foundation
verified: 2026-11-21T07:50:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/01-tenant-security-foundation/01-01-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-01-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-02-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-02-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-03-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-03-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-04-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-04-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-05-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-05-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-06-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-06-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-07-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-07-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-08-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-08-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-09-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-09-SUMMARY.md"
  - ".planning/phases/01-tenant-security-foundation/01-10-PLAN.md"
  - ".planning/phases/01-tenant-security-foundation/01-10-SUMMARY.md"
  - "compose.yaml"
  - "packages/api/src/db/bootChecks.js"
  - "packages/api/src/db/client.js"
  - "packages/api/src/db/migrate.js"
  - "packages/api/src/db/migrations/V13__tenant_policies.sql"
  - "packages/api/src/db/seeds/dev.js"
  - "packages/api/src/db/types.js"
  - "packages/api/src/plugins/auth.js"
  - "packages/api/src/plugins/context.js"
  - "packages/api/src/plugins/rbac.js"
  - "packages/api/src/routes/auth.js"
  - "packages/api/src/routes/projects.js"
  - "packages/api/src/routes/workspaces.js"
  - "packages/api/src/server.js"
  - "packages/api/tests/boot-checks.test.js"
  - "packages/api/tests/dates.test.js"
  - "packages/api/tests/db-client.test.js"
  - "packages/api/tests/rbac.test.js"
  - "packages/api/tests/rls-catalog.test.js"
  - "packages/api/tests/tenant-isolation.test.js"
  - "packages/api/tests/tenant-tx.test.js"
covered_digest: "v3:sha256:eecc4123563414806a9cfc2fb5879caad6946b01e7e4a53dd1baedc0c5a5a7b9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Every request runs inside its own tenant transaction, including when the client aborts mid-handler (CR-01, SC2 / SEC-01)"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Tenant & Security Foundation Verification Report

**Phase Goal:** Tenant isolation is enforced and proven on the real API request path, so every later feature can be built multi-org with confidence
**Verified:** 2026-11-21T07:50:00Z
**Status:** passed (with open warnings, listed below)
**Re-verification:** Yes, after gap closure (plans 01-09 and 01-10)

## Goal Achievement

The one gap from the first report (CR-01, client abort breaks the per-request tenant transaction) is closed. I confirmed it three ways: by reading the code, by re-running the previous reproduction with my own handlers, and by running the new regression tests against the pre-fix `context.js` to show they fail there. The other three roadmap truths still hold with no regressions.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user in org A cannot read or write any row of org B through any API endpoint, proven by automated cross-tenant tests running as the NOSUPERUSER app role | VERIFIED | Unchanged since the first report, and the whole suite is green. `tenant-isolation.test.js` forces a matrix entry for every registered route (`app.routeTable`) and attacks by id, `X-Org-Id` and `?orgId`, with an admin-pool snapshot of org B before and after. `build()` refuses to boot on a superuser pool role, so the suite runs as `roadmapsnap_app`. Full API suite: 184/184 on two clean runs. |
| 2 | The API refuses to start when its DB role is a superuser or has BYPASSRLS, and every request runs inside a transaction that sets the tenant context with parameterized `set_config` | VERIFIED (was FAILED partial) | Boot half: `assertSafeConfig` then `assertSafeDbRole` run in `build()` before any listener (`server.js:52-61`). Transaction half: `context.js` uses only `select set_config($1..., true)`, with no `SET LOCAL` in `src/`. The abort path is fixed (see CR-01 below). |
| 3 | A brand-new user who signs in is not added to the seed org, no dev RLS bypass remains, and a fresh install contains no sample program data | VERIFIED | Re-ran greps: no `x-test-user-sub`, `config-seed-org`, `dev-default`, `DEFAULT_ORG_ID` or `SET LOCAL` under `packages/api/src`, `compose.yaml`, `.github`, `.env.example`. The only `INSERT INTO org_members` in `src/` is the explicit `seeds/dev.js`. V7-V12 are 633-747 byte stubs. `seed-fresh.test.js` and `seed-dev.test.js` pass. |
| 4 | A date saved on a roadmap comes back unchanged, with no day shift, under a non-UTC server timezone | VERIFIED | `npm run test:tz` re-run: 14/14 under America/Los_Angeles and 14/14 under Pacific/Kiritimati. |

**Score:** 4/4 roadmap truths verified (0 present-but-behavior-unverified)

### Gap-closure truths (plans 01-09 and 01-10), checked against code, not SUMMARY

CR-01 is behavior-dependent (a cleanup and ordering invariant), so presence alone was not accepted. Each row has a passing behavioral test or my own run.

| Truth | Status | Evidence |
|-------|--------|----------|
| `onRequestAbort` only logs: no ROLLBACK/COMMIT, no release, no `request.dbClient` clearing | VERIFIED | `context.js:218-220` is a single `request.log.info`. The only `client.release` call in the file is `finishTenantTx` (line 85), which sets `request.dbClient = null` before its first `await` (line 71). |
| After an abort mid-handler, later statements stay in the same transaction, tenant and user | VERIFIED | My repro (below): 4 snapshots in one handler all showed org A, user A and a single `txid_current()`. The repo test passes. |
| A follower from another org on a one-connection pool gets 200 with its own org, only after the aborted handler settles | VERIFIED | My repro: follower 200, org B, 924 ms (it waited for the handler). Repo test asserts `followerSeq > settledSeq`. |
| Abort then write stays in org A and does not fail org B's request; abort then throw rolls back | VERIFIED | My repro: exactly 1 row in org A, 0 in org B, follower 200. Repo tests cover write and throw. |
| Handler resolving `undefined` after an abort still finalizes and releases (onRoute settle guard) | VERIFIED | `withTenantSettleGuard` (`context.js:95-106`) is wired through `addHook('onRoute')` before `authPlugin` (lines 235-239). Repo test passes (next request gets 200). My stress run included 7 aborted `silent` and `slow` requests and the pool recovered. |
| WR-01: pool `error` listener and `connectionTimeoutMillis` default 5000 | VERIFIED | `client.js:14-22`. `db-client.test.js` passes. The earlier unreachable-host boot also failed with a 5.0 s connect timeout, not a hang. |
| WR-01: checked-out client carries an `error` listener only while checked out; killing its backend gives 500 and the next request 200 | VERIFIED | `context.js:120` adds it, line 84 removes it before `release`. Repo tests pass. |
| WR-06: `requireRole` fails closed for unknown and inherited-key roles | VERIFIED | My run: `owner`, `VIEWER`, `''`, `null`, `undefined`, `5`, `{}`, `toString`, `__proto__`, `constructor`, `hasOwnProperty`, `valueOf` all 403 even against `requireRole('viewer')`. `requireRole('owner' / 'toString' / '__proto__')` throws at registration. Known roles still allow. |
| WR-08: no `CORS_ORIGIN` schema default; production with unset, blank or `*` refuses before any DB access; dev and test default to `http://localhost:3000` | VERIFIED | My run through the real `build()` with `NODE_ENV=production` and an unreachable DB host: rejected in 15 ms with "CORS_ORIGIN must be an explicit origin when NODE_ENV=production", for both blank and `*`. `assertSafeConfig` and `resolveCorsOrigin` unit-checked. |

### Reproduction of CR-01 (re-run, my own handlers)

Scratch scripts in `/tmp` (outside the repo, not committed) against the real `build({ extraRoutes })`, `APP_DB_POOL_MAX=1`, a real HTTP socket, abort via `req.destroy()` mid-handler.

| Run | Result now | Result in first report |
|-----|-----------|------------------------|
| Trailing `current_setting('app.current_org_id')` (x4 after the abort) | all org A, all user A, one transaction id | returned org B's id |
| Trailing `INSERT` after the abort, org B follower in flight | 1 row in org A, 0 in org B, follower 200 | org B's request failed with 500 |
| Pool afterwards | next request 200 | n/a |

Regression sensitivity: I ran `tests/tenant-tx.test.js` in a scratch copy with the pre-fix `context.js` (from `ed811de`, plus a stub export so the file loads). The two core abort tests ("later statements stay in its own transaction..." and "abort before a write...") FAIL there and PASS on the current code. The "resolves undefined" and "throws" tests pass on both. They guard against a naive "delete the release" fix that leaks, not against the original defect.

Stress run (not part of the repo): 20 concurrent requests on a 3-connection pool across two orgs, mixing slow, silent, throwing and quick routes, a third aborted mid-flight. Result: 0 statements ran under the wrong tenant, the only 500s were the 3 deliberately throwing non-aborted requests, both orgs got 200 afterwards, 0 backends `idle in transaction`, and 0 `roadmapsnap_app` backends remained after `app.close()`.

### Required Artifacts

`verify.artifacts`: plan 01-09 4/4 passed. Plan 01-10 7/8 passed. The miss is a literal-text check on `01-REVIEW-DISPOSITION.md` for `| CR-01 | critical | fixed | 01-09-PLAN.md |`. The review gate regenerated the file and the rows now read `... | 01-09-PLAN.md (not in the current review) |`. CR-01, WR-01, WR-06 and WR-08 are all recorded `fixed`, so the content is correct and only the pattern text drifted. Not a goal gap. Plans 01-01 to 01-08 were verified in the first report (34/34) and the files are unchanged except the files above.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/plugins/context.js` | Tenant tx, log-only abort hook, settle guard | VERIFIED | Read in full |
| `packages/api/src/db/client.js` | Pool with error listener and connect timeout | VERIFIED | Read in full |
| `packages/api/src/plugins/rbac.js` | Own-key role lookup | VERIFIED | Read in full |
| `packages/api/src/db/bootChecks.js`, `server.js` | Production refusal, no CORS default | VERIFIED | Read in full |
| `packages/api/tests/{tenant-tx,db-client,rbac,boot-checks}.test.js` | New regression tests | VERIFIED | All pass, no skip/todo markers (grep) |

### Key Link Verification

`verify.key-links`: plan 01-09 3/3 wired, plan 01-10 2/2 wired. Independent: no route or plugin imports `db/client` or `pg`, and a single `client.release` caller exists in `context.js`.

### Data-Flow Trace (Level 4)

Unchanged from the first report: tenant handlers read `result.rows` from `request.dbClient` under FORCE RLS, and tests compare against admin-pool ground truth. The new abort tests read `current_setting` and `txid_current()` from the live connection.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API suite | `cd packages/api && npm test` | First run 183/184 (see flake), then 184/184 on two reruns | PASS |
| Two-timezone dates | `npm run test:tz` | 14/14 in both zones | PASS |
| Lite suite | `npm test` (root) | 141/141 | PASS |
| App types and tests | `npx tsc --noEmit`; `npx vitest run` | clean; 9/9 | PASS |
| Abort-mid-handler isolation | scratch repro | org A / same tx / follower 200 | PASS |
| Abort tests detect the old defect | tests vs pre-fix `context.js` | 2 core tests fail on old code | PASS |
| requireRole fail-closed matrix | scratch | 12 bad inputs all 403 | PASS |
| Production boot without CORS | scratch via `build()` | refused in 15 ms | PASS |
| Concurrent abort stress | scratch | 0 cross-tenant statements, no leaked backends | PASS |

Known flake: the first full run failed `seed-fresh.test.js` ("fresh install has schema but no rows") with `tuple concurrently updated` raised from `migrate()`. This is the same race logged in `deferred-items.md` (it records `seed-dev.test.js`; the same cause hits `seed-fresh.test.js`). Two reruns were fully green. It is test infrastructure (parallel test files running migrations and role DDL on one Postgres), not a request-path defect. Worth fixing (advisory lock in `migrate()` or `--test-concurrency=1`) before CI relies on it, since a red CI run on a cold database is likely.

### Probe Execution

Step 7c: SKIPPED. No `probe-*.sh` declared by any plan or present under `scripts/`.

### Requirements Coverage

All six IDs appear in PLAN frontmatter. None orphaned (REQUIREMENTS.md maps SEC-01 to SEC-06 to Phase 1 only).

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SEC-01 | 01-01, 01-02, 01-05, 01-09 | Every request in a tenant transaction, parameterized `set_config`, NOSUPERUSER role | SATISFIED | Normal path plus the abort path (CR-01 closed, reproduced and tested) |
| SEC-02 | 01-02, 01-07, 01-10 | API refuses to start under superuser/BYPASSRLS | SATISFIED | `bootChecks.js`, real-role tests, and now production CORS refusal |
| SEC-03 | 01-01, 01-05, 01-08, 01-10 | Org A cannot read or write org B via any endpoint | SATISFIED | Route-forced matrix, org B snapshot unchanged; `requireRole` now fails closed |
| SEC-04 | 01-01, 01-05, 01-08 | No auto-join to seed org; dev RLS bypass removed | SATISFIED | Greps clean, zero-membership test |
| SEC-05 | 01-03, 01-04, 01-07 | Fresh installs have no sample data | SATISFIED | `seed-fresh.test.js`, `seed-dev.test.js`, V7-V12 stubs |
| SEC-06 | 01-06 | Dates round-trip without day shift | SATISFIED | Type parser plus `test:tz` 14/14 x 2 zones |

Bookkeeping that is now stale (not edited by me, per my instructions):
- `.planning/REQUIREMENTS.md`: the SEC-01 to SEC-06 checkboxes are unchecked, and the traceability rows read "Gap fixed in 01-09, pending re-verification" (SEC-01) and "Gaps Found" (SEC-02 to SEC-06). Mark all six Complete. SEC-02 to SEC-06 had no gap in the first report.
- `.planning/ROADMAP.md`: Phase 1 is still `[ ]` in the phase list and its plans line says "2 gap-closure plans pending".

### Decision Coverage

15 of 15 trackable CONTEXT.md decisions honored by shipped artifacts (carried from the first report; the gap-closure changes touched no decision). Non-blocking gate.

### Test Quality Audit

No skipped, todo or disabled tests in `packages/api/tests` (the `skip` grep hits are comments and a `skipped` result field). New tests assert behavior (txid, org and user GUCs, row counts from an admin pool, completion ordering) rather than mock calls. Two of the four abort tests discriminate the original defect (shown above).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/db/migrations/V13__tenant_policies.sql` | 24-34, 39-42 | `FOR ALL` org_isolation lets any member write `org_members`, `organizations`, `audit_events` at the SQL layer (WR-09, still open) | WARNING | Intra-org privilege escalation if SQL ever runs member-influenced. No route reaches it today and it does not breach org A to org B isolation. Not tracked in any later roadmap phase (grep of ROADMAP.md and STATE.md found nothing). Needs a decision before Phase 4 (member management) and Phase 5 (AI apply) |
| `packages/api/src/routes/projects.js` + app renderers | 51, 98, 133, 199 | `external_link` unvalidated, rendered as `href` (CR-02, still open, stored XSS) | WARNING | Pre-existing, outside SEC-01 to SEC-06 and not a roadmap criterion of this phase. Not tracked in any later phase either. Fits Phase 3's validated write path, but only if someone adds it there |
| `packages/api/src/plugins/context.js` + `server.js` | 68-88 / none | No `setErrorHandler`; 5xx responses echo raw pg or pool error text (WR-11, new) | WARNING | Information disclosure (constraint, column, role names) on failure paths that are now more reachable; response also lacks the `{ error, message }` shape. Does not defeat a must-have |
| `packages/api/src/routes/auth.js`, `workspaces.js`, `projects.js` | 8,26 / 27 / 30 | Authentication in `preHandler`, after body parse and schema validation (WR-02, still open) | WARNING | Unauthenticated callers can make the server parse bodies before getting 401 |
| `packages/api/tests/*` + `src/db/migrate.js` | `migrate.js:72` | Parallel test files race on migrations/role DDL: `tuple concurrently updated` (deferred-items.md; hit again in `seed-fresh.test.js`) | WARNING | Intermittent red test run, CI risk |

The remaining open review items (WR-03, WR-04, WR-05, WR-07, WR-10, IN-01 to IN-09 minus those fixed) are robustness, API-contract or CI-hygiene items. I found none that defeats a must-have truth, so they are reported, not gating. WR-01, WR-06, WR-08 and CR-01 are confirmed fixed against the code.

### Human Verification Required

None. This is an infrastructure phase with no user-facing surface, and every success criterion was verified programmatically. The abort-cleanup invariant that would otherwise be behavior-unverified was exercised by tests and by my own reproduction.

Not exercised: `docker compose up` (compose skeleton from 01-07). It is not a Phase 1 success criterion (DEP-* is verified in Phase 7), and I stayed out of the user's other containers.

### Gaps Summary

No gaps block the phase goal. All four roadmap success criteria are verified and CR-01 is closed with evidence that it can no longer be reproduced, and that the new tests would have caught it.

Decisions for the developer, none blocking Phase 2:
1. WR-09 (split the `FOR ALL` policies so a member cannot write `org_members` or `organizations`) and CR-02 (`external_link` validation) are open and tracked in no roadmap phase. Assign them to a phase explicitly (Phase 3 or 4 respectively fits) so they are not forgotten.
2. WR-11 (generic 500 body plus root error handler) is a small fix worth taking early.
3. Fix the `tuple concurrently updated` test race before CI depends on the API suite.
4. Update REQUIREMENTS.md (mark SEC-01 to SEC-06 Complete) and ROADMAP.md (Phase 1 done).

---

_Verified: 2026-11-21T07:50:00Z_
_Verifier: Claude (gsd-verifier)_
