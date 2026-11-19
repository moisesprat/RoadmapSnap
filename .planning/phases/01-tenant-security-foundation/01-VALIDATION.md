---
phase: "1"
slug: "tenant-security-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-19"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`, `node:assert/strict`) for `packages/api`; Vitest 2.1 for `packages/app` |
| **Config file** | none — script in `packages/api/package.json` (`NODE_ENV=test node --test tests/*.test.js`) |
| **Quick run command** | `cd packages/api && NODE_ENV=test node --test tests/<file>.test.js` |
| **Full suite command** | `cd packages/api && npm test && npm run test:tz` |
| **Estimated runtime** | ~20 seconds (current 39 tests take 16 s) |
| **Required services** | Postgres 16 on localhost:5432, NOSUPERUSER `roadmapsnap_app` role, V1–V13 applied; env `DATABASE_URL`, `APP_DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` |

---

## Sampling Rate

- **After every task commit:** Run the single relevant test file (5–15 s)
- **After every plan wave:** Run `cd packages/api && npm test && npm run test:tz`
- **Before `/gsd-verify-work`:** Full API suite + `test:tz` green, `cd packages/app && npx tsc --noEmit && npx vitest run`, root `npm test` green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled in by the planner/executor per task. Requirement → test map from RESEARCH.md:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SEC-01 | Request runs as `roadmapsnap_app`, non-superuser, GUCs set via `set_config` in a tx; no GUC residue after response; 4xx/throw roll back, 2xx commits, aborted COMMIT → 500 | integration + static | `NODE_ENV=test node --test tests/tenant-tx.test.js` | ❌ W0 | ⬜ pending |
| SEC-02 | `build()` refuses superuser / BYPASSRLS / owner-inheriting role and missing `APP_DATABASE_URL`; accepts `roadmapsnap_app` | unit + integration | `NODE_ENV=test node --test tests/boot-checks.test.js` | ❌ W0 | ⬜ pending |
| SEC-03 | Cross-tenant matrix on every route (404/403, 0 rows changed in other org), route-coverage guard, RLS catalog test, audit rows for app-role writes | integration | `NODE_ENV=test node --test tests/tenant-isolation.test.js tests/rls-catalog.test.js` | ❌ W0 | ⬜ pending |
| SEC-04 | New sub not auto-joined (`orgs: []`, tenant route 403 `NO_ORG`); `X-Test-User-Sub` ignored (401); non-member `X-Org-Id` → 403 | integration + static | `NODE_ENV=test node --test tests/no-bypass.test.js` | ❌ W0 | ⬜ pending |
| SEC-05 | Fresh DB + `migrate()` → 0 tenant rows; existing-DB path; `seed:dev` two orgs, idempotent, refuses production | integration | `NODE_ENV=test node --test tests/seed-fresh.test.js tests/seed-dev.test.js` | ❌ W0 | ⬜ pending |
| SEC-06 | Dates round-trip byte-for-byte under `America/Los_Angeles` and `Pacific/Kiritimati`; invalid dates 400; app adapter ISO → `DD/MM/YYYY` | integration + vitest | `npm run test:tz`; `cd packages/app && npx vitest run src/api/client.test.ts` | ❌ W0 | ⬜ pending |
| All | No file under `src/` except `db/` imports `pool`/`query` from `db/client.js` | static | `NODE_ENV=test node --test tests/no-bypass.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/tests/helpers/auth.js` — keypair, `AUTH_TEST_JWKS` wiring, `signToken` (D-09; existing API tests migrate to it)
- [ ] `packages/api/tests/helpers/db.js` — admin pool + app pool, unique-fixture builders, targeted cleanup
- [ ] RED first: cross-tenant test and "stranger is not auto-joined" test against current code, committed failing
- [ ] `tests/tenant-tx.test.js`, `tests/tenant-isolation.test.js`, `tests/rls-catalog.test.js`, `tests/boot-checks.test.js`, `tests/no-bypass.test.js`, `tests/seed-fresh.test.js`, `tests/seed-dev.test.js`, `tests/dates.test.js`
- [ ] `migrate.js` refactor to an exported `migrate()`
- [ ] `packages/app/src/api/client.test.ts` case for the ISO → `DD/MM/YYYY` adapter
- [ ] `api-ci.yml`: add `npm run test:tz`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Compose skeleton boots clean | SEC-02, SEC-05 | Docker orchestration is not in Phase 1 CI scope | `docker compose up --build`; `/health` 200; `organizations` count 0; api log shows boot check passed; run `seed:dev`, check two orgs by hand |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
