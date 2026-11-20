---
phase: 01-tenant-security-foundation
verified: 2026-11-21T01:00:00Z
status: gaps_found
score: 3/4 must-haves verified
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
  - "packages/api/tests/dates.test.js"
  - "packages/api/tests/rls-catalog.test.js"
  - "packages/api/tests/tenant-isolation.test.js"
  - "packages/api/tests/tenant-tx.test.js"
covered_digest: "v3:sha256:77a9a668f8bd39942f4390f8254b6a312cdbb8fc3a4d2d7bf09227c049838a5c"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Every request runs inside a transaction that sets the tenant context with parameterized set_config (SC2, SEC-01): holds on the normal path but not when the client aborts mid-handler"
    status: partial
    reason: "context.js onRequestAbort hook ROLLBACKs and releases the tenant client while the handler still holds a captured reference (const client = request.dbClient) and keeps querying. The handler's remaining statements then run on a pooled connection that another tenant's request may already own. Reproduced: an org A request aborted mid-handler had its trailing query execute under org B's tenant context; when that query was a write, RLS WITH CHECK rejected it (no cross-tenant data written) but it aborted org B's open transaction and org B's request returned 500. Any authenticated tenant can trigger this at will, and no test covers the abort path."
    artifacts:
      - path: "packages/api/src/plugins/context.js"
        issue: "lines 186-192: onRequestAbort calls finishTenantTx (ROLLBACK, client.release(), request.dbClient = null) while the handler is still running; routes/workspaces.js and routes/projects.js capture the client once and keep using it"
      - path: "packages/api/tests/tenant-tx.test.js"
        issue: "no abort-mid-handler case; the one-connection serialApp pool is the right harness for it"
    missing:
      - "Do not release the client from onRequestAbort; let onSend/onResponse release it once the handler settles (delete the hook or make it log only)"
      - "Add a tenant-tx.test.js case on the one-connection pool: slow route (pg_sleep then a second query), abort mid-handler over a real socket, then assert the next request sees its own org, gets 200, and no statement ran on a released client"
deferred: []
---

# Phase 1: Tenant & Security Foundation Verification Report

**Phase Goal:** Tenant isolation is enforced and proven on the real API request path, so every later feature can be built multi-org with confidence
**Verified:** 2026-11-21T01:00:00Z
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

The core of the phase is real: the API runs as the NOSUPERUSER `roadmapsnap_app` role, RLS is forced on every tenant table, org selection is validated against memberships, and a cross-tenant matrix forced by `app.routeTable` covers every route by id, header and query string. One defect in the per-request transaction lifecycle (CR-01 from the code review) undermines the "every request runs in its own tenant transaction" guarantee. It is reproduced below, so it is a gap and not a judgment call.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user in org A cannot read or write any row of org B through any API endpoint, proven by automated cross-tenant tests running as the NOSUPERUSER app role | VERIFIED | `tests/tenant-isolation.test.js`: route-coverage test fails if a registered route lacks a MATRIX/SHAPES entry (so all 11 tenant routes are attacked); attacks by id, `X-Org-Id` and `?orgId`; an admin-pool snapshot of org B is compared before and after; 20 interleaved parallel requests; audit rows carry the right user/org. `build()` refuses to start unless the pool role is non-superuser, so the suite necessarily runs as `roadmapsnap_app` (tenant-tx `whoami` asserts `current_user = roadmapsnap_app`). Suite: 150/150 pass, re-run by me. |
| 2 | The API refuses to start when its DB role is a superuser or has BYPASSRLS, and every request runs inside a transaction that sets the tenant context with parameterized `set_config` | FAILED (partial) | Boot half VERIFIED: `bootChecks.js` `assertSafeDbRole` (superuser, BYPASSRLS, owner/inheritor of public tables) is called in `build()` before any listener; `boot-checks.test.js` drives it with real roles. Parameterized half VERIFIED on the normal path: `context.js` uses only `select set_config($1..., true)` inside BEGIN, COMMIT for status < 400, ROLLBACK otherwise, COMMIT-turned-ROLLBACK surfaces as 500; no `SET LOCAL` literal in `src/` (guarded by `no-bypass.test.js`). Client-abort path FAILS: see Gaps. |
| 3 | A brand-new user who signs in is not added to the seed org, no dev RLS bypass remains, and a fresh install's database contains no sample program data | VERIFIED | `grep` finds no `x-test-user-sub`, `config-seed-org`, `dev-default`, `DEFAULT_ORG_ID`, `SET LOCAL` anywhere under `packages/api/src`, `compose.yaml`, CI or `.env.example`. The only `INSERT INTO org_members` in `src/` is the explicit `seeds/dev.js`. `context.js` provisions a `users` row only; the stranger test asserts zero memberships and 403 `NO_ORG`. V7-V12 are empty/index-only stubs (filenames kept); `seed-fresh.test.js` migrates a scratch DB and asserts 0 rows in all 12 tenant tables plus migrate idempotency. Seed lives in `npm run seed:dev` (refuses `NODE_ENV=production`). |
| 4 | A date saved on a roadmap comes back unchanged, with no day shift, when the API runs under a non-UTC server timezone | VERIFIED | `db/types.js` sets pg type parser 1082 to identity, imported by `db/client.js`; no `new Date` on any date path in `src/`; writes validated by `isoDateSchema` (`format: 'date'`) and cast `$n::date`. I ran `npm run test:tz` (TZ=America/Los_Angeles and Pacific/Kiritimati): 14/14 pass in each, including a guard that the process really runs in the requested TZ. CI runs `test:tz` (`api-ci.yml:68`). |

**Score:** 3/4 truths verified (0 present-but-behavior-unverified)

### Reproduction of CR-01 (deterministic evidence)

Run from a scratch script outside the repo (deleted afterwards, test rows cleaned up), against `build({ extraRoutes })` with `APP_DB_POOL_MAX=1`, a real HTTP socket, and the request aborted with `req.destroy()` mid-handler.

| Run | Handler's trailing query | Result |
|-----|--------------------------|--------|
| 1 | `select current_setting('app.current_org_id', true)` after abort | returned org B's id: the aborted org A request ran inside org B's tenant context |
| 2 | `INSERT INTO workspaces (org_id = org A, ...)` after abort | Postgres 42501 (RLS WITH CHECK) so no cross-tenant write, but org B's transaction was aborted and org B's `GET` returned **500** ("current transaction is aborted, commands ignored") |

Assessment: RLS holds at the database layer, so I found no path to read or write another tenant's rows. But the guarantee this phase exists to provide, that each request's statements run only inside its own tenant transaction, breaks on an attacker-controlled event, and one tenant can fail another tenant's requests. The race window grows with handler length, and Phases 3 and 5 add multi-statement atomic writes and AI applies. The fix is small (delete the hook), so it should land before Phase 2.

### Required Artifacts

`verify.artifacts` across all 8 plans: 34/34 passed (6, 5, 4, 4, 4, 4, 4, 3). Spot reads confirmed they are substantive (context.js, V13, bootChecks.js, seeds/dev.js, routes, tests read in full).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/plugins/context.js` | Tenant tx per request | PARTIAL | Correct on the normal path; abort hook defect (gap) |
| `packages/api/src/db/migrations/V13__tenant_policies.sql` | NULLIF-safe readers, identity-stage policies, users RLS, app-role hardening | VERIFIED | Applied; `rls-catalog.test.js` asserts enabled+forced RLS, policies, no direct `current_setting('app.current_...')`, the single pinned SECURITY DEFINER, role hardening |
| `packages/api/src/db/bootChecks.js` | Boot refusal | VERIFIED | Wired in `server.js` before DB use |
| `packages/api/src/db/seeds/dev.js` | Explicit two-org seed | VERIFIED | Not run at request time or by migrations |
| `packages/api/src/db/types.js` | DATE as string | VERIFIED | Imported by `client.js` |
| `compose.yaml`, `Dockerfile`, `scripts/dev-token.mjs` | Compose skeleton, dev token CLI | PRESENT, NOT RUN | Static read is consistent (api gets only `APP_DATABASE_URL`, migrate holds the owner URL). I did not run `docker compose`, to stay out of the user's containers; not a roadmap success criterion for this phase |

### Key Link Verification

`verify.key-links` across all 8 plans: 22/22 wired (3, 3, 2, 3, 2, 3, 3, 3). Independent checks: routes use `fastify.requireRole` and `request.dbClient`; `no-bypass.test.js` proves routes/plugins import neither `db/client` nor `pg` and that the CLI calls `build()` with no argument (the `extraRoutes` seam is unreachable from env or HTTP).

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `/api/v1/workspaces*` handlers | `result.rows` | `request.dbClient` queries under FORCE RLS | Yes (tests read admin-pool ground truth) | FLOWING |
| `/auth/me` | `orgs`, `role` | `request.memberships` from `org_members` join | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API suite | `cd packages/api && npm test` | 150 tests, 150 pass, 0 fail, 0 skipped | PASS |
| Two-timezone dates | `npm run test:tz` | 14/14 in both zones | PASS |
| Lite suite | `npm test` (root) | 141/141 | PASS |
| App types and tests | `npx tsc --noEmit`; `npx vitest run` | clean; 9/9 | PASS |
| Abort-mid-handler isolation | scratch repro (above) | Cross-request contamination reproduced | FAIL |
| WR-09 at SQL layer | app-role txn with viewer membership | `UPDATE org_members SET role='admin'` updated 1 row; `UPDATE organizations` updated 1 row (rolled back) | Confirmed, no API route reaches it |

### Probe Execution

Step 7c: SKIPPED. No `probe-*.sh` declared by the plans or present under `scripts/`.

### Requirements Coverage

All six IDs appear in PLAN frontmatter; none orphaned (REQUIREMENTS.md maps SEC-01..06 to Phase 1 only).

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SEC-01 | 01-01, 01-02, 01-05 | Every request in a tenant transaction, parameterized `set_config`, NOSUPERUSER role | PARTIAL | Holds on normal path; broken when a client aborts mid-handler (CR-01) |
| SEC-02 | 01-02, 01-07 | API refuses to start under superuser/BYPASSRLS role | SATISFIED | `bootChecks.js` + `boot-checks.test.js` with real bypass/inherit roles; no skip flag |
| SEC-03 | 01-01, 01-05, 01-08 | Org A cannot read or write org B via any endpoint, automated tests | SATISFIED | Route-coverage-forced matrix by id/header/query; org B snapshot unchanged |
| SEC-04 | 01-01, 01-05, 01-08 | No auto-join to seed org; dev RLS bypass removed | SATISFIED | Greps clean; header bypass removed with tests moved to signed JWTs; zero-membership test |
| SEC-05 | 01-03, 01-04, 01-07 | Fresh installs have no sample data; seed separate from migrations | SATISFIED | `seed-fresh.test.js`, `seed-dev.test.js`, V7-V12 stubs |
| SEC-06 | 01-06 | Dates round-trip without day shift in any server timezone | SATISFIED | Type parser + `test:tz` 14/14 under two zones |

REQUIREMENTS.md currently marks SEC-01 `[x] Complete`. That should be reopened or annotated until the gap is closed.

### Decision Coverage

15 of 15 trackable CONTEXT.md decisions honored by shipped artifacts (non-blocking gate).

### Test Quality Audit

No skipped, todo or disabled tests in `packages/api/tests`. Tests assert value-level and behavioral outcomes against admin-pool ground truth (not circular). One coverage hole: no abort-path test, which is exactly where CR-01 lives.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/plugins/context.js` | 186-192 | Releases tenant client while handler still uses it (CR-01) | BLOCKER | Gap above |
| `packages/api/src/db/migrations/V13__tenant_policies.sql` | 24-34, 39-42 | `FOR ALL` org_isolation lets any member write `org_members`, `organizations`, `audit_events` at SQL layer (WR-09) | WARNING | Confirmed by repro, but no route exposes it today; role enforcement is application-only. Fix before any phase adds a path that runs member-influenced SQL (Phase 4 member management, Phase 5 AI apply) |
| `packages/api/src/routes/projects.js` + app renderers | 51, 98, 133, 199 | `external_link` unvalidated, rendered as `href` (CR-02, stored XSS) | WARNING | Real, but pre-existing code outside SEC-01..06 and not a phase truth. Not deferred in any roadmap criterion, so triage explicitly (fits Phase 3's validated write path) |
| `packages/api/src/db/client.js` | 10-15 | No pool `error` listener, no `connectionTimeoutMillis` (WR-01) | WARNING | Idle-client error can crash the process; `idle_in_transaction_session_timeout=30s` from V13 makes this more likely |
| `packages/api/src/server.js` / `bootChecks.js` | 23 / 44-47 | `CORS_ORIGIN` schema default defeats the production check (WR-08) | WARNING | Production would boot with a localhost origin instead of refusing |
| `packages/api/src/db/seeds/dev.js`, `scripts/dev-token.mjs` | 195 / 66 | Guards refuse only `production`, fail open when `NODE_ENV` unset; seed upserts an existing org slug (WR-05) | WARNING | Dev tooling hazard, not request path |
| `packages/api/src/plugins/rbac.js` | 32 | Role lookup yields `undefined` for unknown role string (WR-06) | WARNING | The current code reads `userRole ? ROLE_LEVEL[userRole] : 0`, which still passes for an unknown non-empty string (`undefined < n` is false); CHECK constraint prevents it today |

WR-02, WR-03, WR-04, WR-07, WR-10 and IN-01..IN-06 from `01-REVIEW.md` are robustness, API-contract or CI-hygiene items. I did not find them to defeat a must-have truth, so they are reported, not gating. All 18 review findings are still `open` in `01-REVIEW-DISPOSITION.md`.

### Human Verification Required

None. Infrastructure and foundation phase with no user-facing elements; every success criterion is verifiable programmatically. The one invariant that would otherwise be behavior-unverified (abort cleanup) was exercised and failed, so it is a gap, not a human item.

### Gaps Summary

One gap, with a small fix:

1. **CR-01, client abort breaks the per-request tenant transaction (SC2 / SEC-01).** Remove the `client.release()` path from `onRequestAbort` in `packages/api/src/plugins/context.js` (keep the hook only to log). `onSend`/`onResponse` already release once the handler settles, including after an abort. Add the abort regression test to `tenant-tx.test.js` on the one-connection pool, using a real socket (`app.inject` cannot abort) with a slow multi-query route, and assert the next request gets its own org and 200.

Everything else the phase promised is present, wired, and exercised by tests I re-ran. Suggest `/gsd-plan-phase 1 --gaps` for CR-01, and consider bundling WR-01 (pool error handler, same file family), WR-06 (one-line `?? 0`) and WR-08 (CORS default) while touching these files. Decide WR-09 (split `FOR ALL` policies) and CR-02 (`external_link` validation) deliberately: pull into this gap round or assign to Phases 3/4 in the roadmap, because they are not currently tracked anywhere.

Housekeeping: ROADMAP.md still shows Phase 1 as `[ ]` in the phase list although all 8 plans are checked.

---

_Verified: 2026-11-21T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
