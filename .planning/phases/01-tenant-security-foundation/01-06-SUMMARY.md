---
phase: 01-tenant-security-foundation
plan: 06
subsystem: api
tags: [postgres, pg, dates, timezone, fastify, ajv, vitest, ci]

requires:
  - phase: 01-tenant-security-foundation
    provides: "build({ extraRoutes }) tenant-transaction seam, db/client.js pool factory, requireRole (01-02, 01-05)"
provides:
  - "pg type parser keeping Postgres DATE (OID 1082) as a YYYY-MM-DD string process-wide"
  - "isoDateSchema, the shared write contract for every DATE column"
  - "GET /workspaces/:workspaceId/projects returns milestones as ISO strings or null"
  - "npm run test:tz and a CI step running the date tests under America/Los_Angeles and Pacific/Kiritimati"
  - "SPA isoToLiteDate edge adapter and typed CurrentUser (nullable role, orgId, orgs)"
affects: [phase-02-shared-core, phase-03-write-routes, ai-and-import-paths]

actuals:
  tokens: 3564
  tasks: 2
  commits: 4
plan_head_before: 57d5941db3ebc8c59835b9b5296679a26661c720
plan_head_after: 71cc5e602d6639460d5310a3e39c6601a763a658
commits: 4

tech-stack:
  added: []
  patterns:
    - "DATE columns travel as ISO strings both ways; no JS Date between Postgres and JSON"
    - "Shared JSON-schema fragment (lib/dates.js) reused by every DATE write route"
    - "Client edge adapter converts ISO to Lite DD/MM/YYYY with string operations only"

key-files:
  created:
    - packages/api/src/db/types.js
    - packages/api/src/lib/dates.js
    - packages/api/tests/dates.test.js
  modified:
    - packages/api/src/db/client.js
    - packages/api/src/routes/workspaces.js
    - packages/api/package.json
    - .github/workflows/api-ci.yml
    - packages/app/src/api/client.ts
    - packages/app/src/api/client.test.ts

key-decisions:
  - "Missing planned_date is JSON null on the wire (was ''); the SPA adapter maps null back to '' so rendering is unchanged"
  - "isoToLiteDate returns non-ISO strings unchanged rather than blanking them, so unexpected values surface in the UI"
  - "Rely on Fastify's built-in Ajv date format for validation instead of a hand-rolled regex"

patterns-established:
  - "Two-timezone test runs (test:tz) guard any code that touches dates; the first test asserts the process really runs in the requested TZ"

requirements-completed: [SEC-06]

coverage:
  - id: D1
    description: "Milestone dates round-trip byte-for-byte (including 2026-03-31, 2024-02-29 and the Los Angeles DST start) under America/Los_Angeles and Pacific/Kiritimati; NULL dates serialize as JSON null"
    requirement: SEC-06
    verification:
      - kind: integration
        ref: "NODE_ENV=test TZ=America/Los_Angeles node --test packages/api/tests/dates.test.js"
        status: pass
      - kind: integration
        ref: "NODE_ENV=test TZ=Pacific/Kiritimati node --test packages/api/tests/dates.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "isoDateSchema rejects impossible dates, DD/MM/YYYY, unpadded dates, timestamps and the empty string with 400 and writes no row"
    requirement: SEC-06
    verification:
      - kind: integration
        ref: "packages/api/tests/dates.test.js#invalid date ... is rejected with 400 and nothing is written"
        status: pass
    human_judgment: false
  - id: D3
    description: "CI runs the date tests under two non-UTC timezones on every API change"
    requirement: SEC-06
    verification:
      - kind: other
        ref: "npm --prefix packages/api run test:tz (workflow step wired in .github/workflows/api-ci.yml, not yet observed running on GitHub)"
        status: pass
    human_judgment: true
    rationale: "The workflow step cannot be exercised locally; a human or the first CI run must confirm it executes on GitHub"
  - id: D4
    description: "SPA getWorkspaceProjects converts ISO milestones to Lite DD/MM/YYYY (null to '') without Date objects; CurrentUser typed to the /auth/me shape"
    verification:
      - kind: unit
        ref: "TZ=Pacific/Kiritimati npm --prefix packages/app test -- src/api/client.test.ts"
        status: pass
      - kind: other
        ref: "cd packages/app && npx tsc --noEmit"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-21
status: complete
---

# Phase 1 Plan 06: DATE contract Summary

**Postgres DATE kept as YYYY-MM-DD strings end to end via a global pg type parser and a shared Ajv `isoDateSchema`, proven under America/Los_Angeles and Pacific/Kiritimati locally and in CI, with an SPA edge adapter back to Lite DD/MM/YYYY.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-11-21
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- DATE (OID 1082) never becomes a JS Date in the API; the local-getter `formatPlannedDate` helper (a day-shift bug once the string parser is registered) is deleted and milestones are `YYYY-MM-DD` or `null`.
- `isoDateSchema` (`lib/dates.js`) is the single write contract; 2026-02-29, 2026-02-30, 2026-04-31, 31/03/2026, 2026-3-1, a timestamp and '' all return 400 and write no row.
- `dates.test.js` (14 tests) is green under both extreme timezones, includes a guard that the process really runs in the requested TZ, and is wired into `api-ci.yml` through `npm run test:tz`.
- The SPA keeps rendering: `getWorkspaceProjects` maps ISO strings to DD/MM/YYYY with string operations only, and `CurrentUser` now matches `/auth/me` (nullable `role`, `orgId`, `orgs`).

## Task Commits

1. **Task 1: DATE as ISO strings end to end** - `10b0a6e` (test, RED: failing two-timezone round trip with `isoDateSchema`), `8765ab9` (feat, GREEN: type parser, formatter removed), `3acb503` (refactor: keep the schema literal single in dates.js)
2. **Task 2: CI timezone run and SPA adapter** - `71cc5e6` (feat)

**Plan metadata:** docs commits follow this summary.

## Files Created/Modified
- `packages/api/src/db/types.js` - `setTypeParser(1082, v => v)`
- `packages/api/src/db/client.js` - side-effect import of `./types.js` as first import
- `packages/api/src/lib/dates.js` - `isoDateSchema`
- `packages/api/src/routes/workspaces.js` - formatter deleted; `milestones[key] = planned_date ?? null`
- `packages/api/tests/dates.test.js` - round-trip, NULL, rejection and TZ-guard tests
- `packages/api/package.json` - `test:tz` script
- `.github/workflows/api-ci.yml` - "Run date tests under non-UTC timezones" step
- `packages/app/src/api/client.ts` - `isoToLiteDate`, `ApiMilestoneMap`, `OrgMembership`, widened `CurrentUser`
- `packages/app/src/api/client.test.ts` - adapter and `getWorkspaceProjects` tests

## Decisions Made
- A missing date is `null` on the wire (previously `''`). Phase 2's shared core consumes `null` directly; the SPA adapter hides it until then.
- Non-ISO strings pass through `isoToLiteDate` unchanged so an unexpected value is visible rather than silently blank.
- Validation relies on Fastify's built-in Ajv `date` format rather than a custom regex.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance grep matched a code comment**
- **Found during:** Task 1 acceptance check
- **Issue:** The `dates.js` header comment quoted the schema literal, so `grep -c "format: 'date'"` returned 2 instead of the required 1.
- **Fix:** Reworded the comment so only the schema line matches.
- **Files modified:** packages/api/src/lib/dates.js
- **Verification:** grep returns 1; dates tests re-run green under Kiritimati.
- **Committed in:** `3acb503`

Ordering note (not a deviation of behavior): `lib/dates.js` was committed together with the RED test, because the test imports `isoDateSchema` and the plan's RED run must fail on the formatter output rather than on a missing module.

---

**Total deviations:** 1 auto-fixed (1 bug-level acceptance mismatch)
**Impact on plan:** None on scope or behavior.

## Issues Encountered
None. The `/auth/me` shape the plan referenced from 01-08 (`role` nullable, `orgId`, `orgs`) was already present in `routes/auth.js`, so the SPA types match the live API.

## Verification Results
- `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati` dates.test.js: 14/14 each, 0 skipped
- `npm --prefix packages/api test`: 150/150; `npm --prefix packages/api run test:tz`: green
- `npm --prefix packages/app test` (also under TZ=Pacific/Kiritimati): 9/9; `npx tsc --noEmit`: exit 0
- Root `npm test`: 141/141 (Lite untouched; `validate` and `build` were not re-run since no Lite file changed)

## Known Stubs
None.

## Threat Flags
None. No new endpoints or trust boundaries; `/__test/milestones` exists only inside the test file's `extraRoutes`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 write routes can reuse `isoDateSchema` directly for any DATE column.
- Phase 2's shared-core edge adapter replaces `isoToLiteDate` and should consume `null` milestones as-is.
- The new CI step has not yet run on GitHub; confirm it on the first push of this branch.

## Self-Check: PASSED
- Files exist: `packages/api/src/db/types.js`, `packages/api/src/lib/dates.js`, `packages/api/tests/dates.test.js` found.
- Commits `10b0a6e`, `8765ab9`, `3acb503`, `71cc5e6` are ancestors of HEAD.
- All task acceptance criteria re-run and passing.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-21*
