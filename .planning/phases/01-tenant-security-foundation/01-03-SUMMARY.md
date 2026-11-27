---
phase: 01-tenant-security-foundation
plan: 03
subsystem: database
tags: [postgres, migrations, seed-data, node-test, scratch-database]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-01 test helpers (adminPool, closePools, uniq) and the app-role test environment"
provides:
  - "Importable migrate(databaseUrl, { dir, log }) returning { applied, skipped }, with the CLI behind an argv guard"
  - "Non-overriding loadEnv: variables already in the environment win over packages/api/.env"
  - "createScratchDatabase / dropScratchDatabase test helpers"
  - "seed-fresh.test.js proving a fresh install has zero tenant rows and that migrate is idempotent"
  - "V7, V8, V9, V11, V12 reduced to comment-only stubs; V10 keeps only its two indexes"
affects: [01-04, 01-07, phase-02, phase-07]

plan_head_before: 210c8a8af34fdb469deb65ed913f97e5890927df
plan_head_after: af202348e0ff1d97c62739d4381a7b3a7a814375

actuals:
  tokens: 4100
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Migration runner is a pure exported function; process.exit lives only in the CLI guard"
    - "Tests that migrate from nothing use a per-process scratch database and drop it WITH (FORCE)"
    - "Seed data lives outside migrations; migration files that once seeded are kept as stubs so filename-only version tracking skips them on existing databases"

key-files:
  created:
    - packages/api/tests/seed-fresh.test.js
  modified:
    - packages/api/src/db/migrate.js
    - packages/api/src/loadEnv.js
    - packages/api/src/db/migrations/V7__seed_projects_from_config.sql
    - packages/api/src/db/migrations/V8__add_users_to_seed_org.sql
    - packages/api/src/db/migrations/V9__backfill_workspace_workflows.sql
    - packages/api/src/db/migrations/V10__dependencies_index_and_seed.sql
    - packages/api/src/db/migrations/V11__seed_dependencies_from_config.sql
    - packages/api/src/db/migrations/V12__backfill_group_order.sql
    - packages/api/tests/helpers/db.js

key-decisions:
  - "Stub files keep their names (D-01/D-04): migrate.js tracks versions by filename only, so existing databases skip them and keep their data"
  - "loadEnv now follows dotenv semantics (environment wins over .env), which lets a child process force NODE_ENV=production regardless of a developer's .env"
  - "The idempotency test runs its own first migrate when selected alone, so it passes under --test-name-pattern as the plan's verify command requires"

patterns-established:
  - "Scratch database name is prefix_pid_timestamp, lowercased to [a-z0-9_], created through pg.escapeIdentifier with one retry on SQLSTATE 55006"

requirements-completed: [SEC-05]

coverage:
  - id: D1
    description: "Migrating an empty database applies every migration file and leaves zero rows in all twelve tenant tables, with both dependency indexes present"
    requirement: "SEC-05"
    verification:
      - kind: integration
        ref: "packages/api/tests/seed-fresh.test.js#fresh install has schema but no rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second migrate on the same database applies nothing, skips every file and changes no row counts"
    requirement: "SEC-05"
    verification:
      - kind: integration
        ref: "packages/api/tests/seed-fresh.test.js#migrate is idempotent on an existing database"
        status: pass
    human_judgment: false
  - id: D3
    description: "An existing dev database that already recorded V7-V12 is left unchanged: npm run migrate applies nothing and skips every version"
    requirement: "SEC-05"
    verification:
      - kind: other
        ref: "npm --prefix packages/api run migrate (local database, output contains only Skip lines and 'All migrations completed.')"
        status: pass
    human_judgment: false
  - id: D4
    description: "migrate() is importable without connecting or exiting, and loadEnv no longer overwrites variables set in the real environment"
    verification:
      - kind: other
        ref: "node -e import of migrate.js prints 'migrate export ok'; NODE_ENV=production import of loadEnv.js prints production"
        status: pass
    human_judgment: false
  - id: D5
    description: "No tracked SQL migration contains real program, workspace or group data or the old seed organization"
    requirement: "SEC-05"
    verification:
      - kind: other
        ref: "grep -cvE '^[[:space:]]*(--|$)' on V7/V8/V9/V11/V12 returns 0; git grep config-seed-org over migrations/*.sql prints nothing"
        status: pass
    human_judgment: false

duration: 1min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 03: Schema-only Migrations Summary

**A fresh database now migrates to schema, policies and indexes with zero tenant rows (V7/V8/V9/V11/V12 are comment-only stubs, V10 keeps its two indexes), behind an importable `migrate()` and a non-overriding `.env` loader, with existing databases skipping the stubs by filename.**

## Performance

- **Duration:** 1 min (wall clock between recorded start and end timestamps)
- **Started:** 2026-11-20T22:54:03Z
- **Completed:** 2026-11-20T22:55:18Z
- **Tasks:** 2
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments

- `migrate(databaseUrl, { dir, log })` is exported and returns `{ applied, skipped }`. Importing the module no longer exits or connects; `npm run migrate` still works through an argv guard modelled on `server.js`.
- `loadEnv.js` assigns a `.env` value only when the variable is undefined, so a real environment variable wins. `NODE_ENV=production` now stays `production` even when `.env` says development.
- `seed-fresh.test.js` migrates a scratch database and asserts zero rows in organizations, users, org_members, workspaces, programs, projects, milestones, budget_periods, kpis, risks, dependencies and audit_events, plus the two `idx_dependencies_*` indexes and one `schema_migrations` row per file.
- The five seed migrations went from about 530 KB of SQL (V7 448 KB, V11 80 KB) to 633 bytes each, and V10 from 17 lines to its two `CREATE INDEX IF NOT EXISTS` statements.
- Local dev database untouched: `npm run migrate` printed only Skip lines.

## TDD Record

- **RED:** `fresh install has schema but no rows` failed on the planned assertion with real seed rows in the actual counts (organizations 1, users 1, org_members 1, workspaces 6, projects 230, milestones 991, dependencies 125, audit_events 1240). The failure was the intended one (seed migrations still inserting), not an import or setup error; the idempotency case was green in the same run. Semantic assessment: target test executed and failed on the count comparison for the intended reason.
- **GREEN:** stubbing V7/V8/V9/V11/V12 (Task 2) turned both cases green.
- The plan is `type: execute` with a `tdd="true"` task, not `type: tdd`, so the TDD gate-record tooling was not run.

## Task Commits

1. **Task 1 (test): fresh-install test and scratch-database helpers** - `ef6733d` (test)
2. **Task 1 (refactor): export migrate(), non-overriding loadEnv, V10 trimmed** - `7dab4f3` (refactor)
3. **Task 2: seed migrations as no-op stubs** - `af20234` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `packages/api/src/db/migrate.js` - exported runner, CLI guard, imports `../loadEnv.js` instead of a private parser
- `packages/api/src/loadEnv.js` - non-overriding assignment, header updated
- `packages/api/tests/helpers/db.js` - added `createScratchDatabase` and `dropScratchDatabase` (additive only)
- `packages/api/tests/seed-fresh.test.js` - fresh-install zero-rows and idempotency cases
- `packages/api/src/db/migrations/V7, V8, V9, V11, V12` - comment-only stubs referencing D-01 and D-04
- `packages/api/src/db/migrations/V10__dependencies_index_and_seed.sql` - indexes only, header explains the D-01 exception

## Decisions Made

- Followed the plan as specified. One small choice: the idempotency test performs its own first `migrate` when run in isolation (the plan's verify command selects it by name pattern), and is a no-op addition when the zero-rows test already ran.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A first attempt to inspect `DATABASE_URL` in `packages/api/.env` was blocked by the local secret-read guard. It was not needed; the helpers derive URLs from `process.env` with `URL`, and no secret was read.
- `migrations/README.md` still describes V7-V11 as seeding data and is referenced by the new stub comments ("see migrations/README.md"). It is not in this plan's file list; the plan's flagged assumptions assign the README update to 01-04. Until then the README is stale relative to the stubs.

## Authentication Gates

None.

## Known Stubs

The five migration files are deliberate comment-only stubs (D-01), not UI or data stubs; they do not prevent the plan's goal. No other stubs found.

## Threat Flags

None. The change removes data exposure (T-01-18, T-01-20) and adds no endpoints, auth paths or trust-boundary schema. The scratch-database helper uses `pg.escapeIdentifier` for the generated name and runs only against the configured test server.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-04 can build `seed:dev` on top of the schema-only migrations and should update `migrations/README.md` (V7-V11 sections) and document the `postgres` role literal in V2.
- Existing databases keep their old demo rows; only newly created databases are clean.
- Git history still contains the old seed data (D-03 defers a history purge).
- Full suites at completion: API 46/46 (44 prior plus 2 new), Lite 141/141.

## Self-Check: PASSED

- Created and modified files exist (migrate.js, loadEnv.js, helpers/db.js, seed-fresh.test.js, V7-V13 SQL): FOUND.
- Commits `ef6733d`, `7dab4f3`, `af20234` are ancestors of HEAD: FOUND; RED test commit precedes the GREEN stub commit.
- Acceptance criteria re-run: `export async function migrate` count 1; import prints "migrate export ok"; V10 non-comment lines 2; `NODE_ENV=production` loadEnv prints `production`; V7/V8/V9/V11/V12 non-comment lines 0 and each 633 bytes (under 1024); `git grep config-seed-org` over migrations prints nothing; seed-fresh 2/2 pass with 0 skipped; `npm --prefix packages/api run migrate` applied nothing.
- Plan verification: `npm --prefix packages/api test` 46/46; root `npm test` 141/141.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*
