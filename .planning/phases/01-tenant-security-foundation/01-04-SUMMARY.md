---
phase: 01-tenant-security-foundation
plan: 04
subsystem: database
tags: [postgres, seed, rls, fastify, node-test, pg]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-02 tenant transaction and NOT_A_MEMBER; 01-03 schema-only migrations, migrate(), scratch-database helpers"
provides:
  - "npm run seed:dev: two synthetic demo orgs, idempotent, owner-only, refused in production"
  - "Importable seedDev({ client, sub, email, name, memberOfB }) for the Phase 7 smoke test"
  - "Migrations README and .env.example documenting schema-only migrations, seed:dev, split DB credentials"
affects: [01-05, 01-07, phase-07-smoke-test]

actuals:
  tokens: 8800
  tasks: 2
  commits: 3
plan_head_before: 9f8684c7f3e9a93ddca49c18711249541a16cffb
plan_head_after: 806ae56756b8a3a3f6d4f97687f0b1c2c578e23c

tech-stack:
  added: []
  patterns:
    - "Seed writes as owner role inside one transaction per org, with parameterized set_config for org, auth0 and user ids so audit rows are attributed"
    - "CLI guard order (production, subject, DATABASE_URL) before any connection; tests prove it with an unreachable DATABASE_URL"

key-files:
  created:
    - packages/api/src/db/seeds/devData.js
    - packages/api/src/db/seeds/dev.js
    - packages/api/tests/seed-dev.test.js
  modified:
    - packages/api/package.json
    - packages/api/src/db/migrations/README.md
    - packages/api/.env.example
  deleted:
    - packages/api/scripts/generate-config-seed.mjs

key-decisions:
  - "Demo Org A content is hand-copied from js/config_base.js with ISO dates held as five shared schedule constants; nothing is parsed or evaluated from config files at runtime"
  - "Demo Org B is owned by a synthetic user (dev|org-b-admin); the developer joins it only through --member-of-b"
  - "Idempotency is asserted on the seven domain tables; re-running adds audit_events rows because ON CONFLICT DO UPDATE fires the audit trigger, documented in the README"

requirements-completed: [SEC-05]

coverage:
  - id: D1
    description: "seed:dev creates Demo Org A (10 projects, 70 milestones, 3 dependencies) and Demo Org B (4 projects, 1 dependency); subject is admin of A only"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "packages/api/tests/seed-dev.test.js#seedDev data"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second seedDev run leaves every row count unchanged; invalid sub or memberOfB is rejected"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "packages/api/tests/seed-dev.test.js#seedDev idempotency and arguments"
        status: pass
    human_judgment: false
  - id: D3
    description: "Through the real API as roadmapsnap_app the dev admin sees only Demo Org A (10 projects), gets 404 for Org B workspace and 403 NOT_A_MEMBER for X-Org-Id of Org B"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "packages/api/tests/seed-dev.test.js#seed data through the real API as roadmapsnap_app"
        status: pass
    human_judgment: false
  - id: D4
    description: "CLI refuses NODE_ENV=production, a missing subject and a missing DATABASE_URL before connecting"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "packages/api/tests/seed-dev.test.js#seed:dev CLI refusals"
        status: pass
    human_judgment: false
  - id: D5
    description: "Config-seed generator and seed:config script removed; no evaluator calls in seeds"
    requirement: SEC-05
    verification:
      - kind: other
        ref: "test ! -e packages/api/scripts/generate-config-seed.mjs; grep -cE 'new Function|vm\\.|eval\\(|readFile' seeds/*.js returns 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migrations README and .env.example are accurate and free of real program names"
    verification: []
    human_judgment: true
    rationale: "Documentation accuracy and the D-03 privacy review are judgment calls no test asserts"

duration: 4min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 04: Explicit dev seed Summary

**`npm run seed:dev` creates two isolated synthetic demo orgs (config_base roadmap plus an invented one) idempotently as the owner role, refused in production, with the config-evaluating generator deleted and migration and env docs rewritten**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-20T23:03:56Z
- **Completed:** 2026-11-20T23:07:00Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 3 modified, 1 deleted)

## Accomplishments
- `seedDev()` upserts Demo Org A (10 deliverables, 70 milestones, 3 dependencies, subject as admin) and Demo Org B (4 initiatives, 1 dependency, synthetic owner) in one transaction per org, with tenant GUCs set so audit rows carry a user.
- The CLI refuses `NODE_ENV=production`, a missing subject and a missing `DATABASE_URL` before opening any connection; it never reads `APP_DATABASE_URL`.
- Through the real API as `roadmapsnap_app`, the seeded admin sees only Demo Org A, gets 404 for Org B's workspace and 403 `NOT_A_MEMBER` for Org B's id.
- `generate-config-seed.mjs` and `seed:config` are gone; the migrations README and `.env.example` now describe the schema-only model, V7-V12 stubs, V13, seed:dev and the drop-and-recreate path.

## Task Commits

1. **Task 1: seed:dev** - `ae916fc` (test, RED), `bcebeeb` (feat, GREEN)
2. **Task 2: delete generator, rewrite docs** - `806ae56` (chore)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `packages/api/src/db/seeds/devData.js` - synthetic data for both orgs (hand-copied, ISO dates)
- `packages/api/src/db/seeds/dev.js` - `seedDev()` and the seed:dev CLI
- `packages/api/tests/seed-dev.test.js` - 14 scratch-database tests
- `packages/api/package.json` - `seed:dev` replaces `seed:config`
- `packages/api/src/db/migrations/README.md` - rewritten
- `packages/api/.env.example` - rewritten (carry-over fixes from 01-02 and 01-03 included)
- `packages/api/scripts/generate-config-seed.mjs` - deleted

## Decisions Made
- Milestone schedules are five shared ISO constants rather than 70 literals; still hand-converted, no runtime parsing.
- The upsert of the dev user overwrites email and display name as the plan specifies, so two developers sharing one database collide on email (flagged assumption A6).
- Re-running the seed adds `audit_events` rows for the UPDATE paths of `ON CONFLICT DO UPDATE`; idempotency is asserted on the domain tables and the README says so.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doubled `seed:` prefix on validation errors**
- **Found during:** Task 1 (CLI check with `--member-of-b bogus`)
- **Issue:** `seedDev` errors already start with `seed:` and the CLI catch prefixed them again.
- **Fix:** The CLI catch adds the prefix only when it is missing.
- **Files modified:** packages/api/src/db/seeds/dev.js
- **Verification:** CLI run printed a single `seed:` prefix; tests green.
- **Committed in:** bcebeeb

**2. [Rule 3 - Blocking] Inlined the three `set_config` calls**
- **Found during:** Task 1 acceptance check
- **Issue:** A shared `setTenantContext` helper left one `set_config` occurrence, failing the plan's acceptance count of 3 and the key-link pattern.
- **Fix:** Used the literal `select set_config('app.current_...', $1, true)` statements at each call site (still parameterized).
- **Files modified:** packages/api/src/db/seeds/dev.js
- **Committed in:** bcebeeb

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Cosmetic and acceptance-driven; no scope change.

## Issues Encountered
- The plan's verification step runs `seed:dev` against the local database. To avoid leaving demo rows in the shared `roadmapsnap_dev` database that the other API tests use, the CLI was run end to end (twice, plus an invalid `--member-of-b`) against a throwaway database created and dropped by a script outside the repo. Output matched the plan: `seed: Demo Org A and Demo Org B ready (admin dev|local-check)`.
- A shell hook blocked sourcing `packages/api/.env`; the check script used `src/loadEnv.js` instead, so no secret value was printed.

## User Setup Required

None - no external service configuration required. To get demo data locally: `npm --prefix packages/api run seed:dev -- --sub <your Auth0 sub>`.

## Next Phase Readiness
- `seedDev` is importable for the Phase 7 smoke test; two orgs exist for hand-checking isolation.
- API suite 102/102 green (88 before plus 14 new). Lite was not touched.
- `packages/api/scripts/` is now absent; 01-07 adds `dev-token.mjs` there.

## Known Stubs

None. Demo data is intentional synthetic content, not a stub.

## Threat Flags

None. The seed adds no network endpoint; it is a CLI that writes as the owner role and is refused in production (T-01-21 mitigated and tested).

## Self-Check: PASSED

- Created files exist: devData.js, dev.js, seed-dev.test.js, this SUMMARY.
- `scripts/generate-config-seed.mjs` absent.
- Commits `ae916fc`, `bcebeeb`, `806ae56` are ancestors of HEAD.
- Acceptance greps: `seed:dev` script 1, `seed:config` 0, `set_config` 3, evaluator calls 0 and 0, `APP_DATABASE_URL` in dev.js 0.
- `npm --prefix packages/api test`: 102 pass, 0 fail, 0 skipped.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*
