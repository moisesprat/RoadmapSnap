---
phase: 02-shared-core-lite-identical-view
plan: 01
subsystem: shared-core
tags: [npm-workspaces, esm, jsdoc, tsc-declarations, node-test, vite]

requires:
  - phase: 01
    provides: SaaS API, app and tokens packages that this plan turns into workspaces
provides:
  - "npm workspace (packages/*) with one root package-lock.json linking @roadmapsnap/core"
  - "@roadmapsnap/core: private zero-dependency ESM package with canonical DD/MM/YYYY dates (parseDDMMYYYY, formatDDMMYYYY, formatDateDisplay, formatShortDate, isoToLite)"
  - "Lite js/core/timeline.js date functions bound to core; app isoToLiteDate re-exports core isoToLite"
  - "Generated .d.ts types for the app (build:types, git-ignored packages/core/types)"
  - "Purity, export-uniqueness, barrel and Lite-isolation guard tests in the root suite"
  - "15 reserved empty core modules already listed in the barrel for plans 02-04 to 02-11"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-10, 02-11]

actuals:
  tokens: 6500
  tasks: 2
  commits: 3
plan_head_before: c926da533e47f8aaf0cc680a46ef7289e7b3e88d
plan_head_after: 127273d4d43a22d2377c7a7c28d8d6fd2ec00ff4

tech-stack:
  added: []
  patterns:
    - "Shared logic lives in packages/core as plain ESM + JSDoc; Lite binds to it through the bare specifier @roadmapsnap/core, the app through generated .d.ts"
    - "Barrel with one export * line per module, every later core module reserved up front so parallel plans never edit index.js"
    - "Static source-scan guards (purity, Lite isolation) run in the root npm test"

key-files:
  created:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsconfig.build.json
    - packages/core/src/index.js
    - packages/core/src/dates.js
    - packages/core/tests/dates.test.js
    - packages/core/tests/purity.test.js
    - tests/guards/lite-isolation.test.js
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - js/core/timeline.js
    - packages/app/package.json
    - packages/app/src/api/client.ts
    - packages/api/package.json
    - packages/tokens/package.json

key-decisions:
  - "Workspace lockfile was re-pinned to the versions the per-package lockfiles already resolved (auth0-react 2.15.0, react-query 5.90.21, fastify 5.7.4 and others), so the lockfile change is workspace linking only"
  - "formatDateDisplay and formatShortDate validate structure (3 integer parts, month 1..12, day >= 1) and format from the string parts, so 31/04/2026 still prints '31 Apr' as Lite did, while parseDDMMYYYY rolls it over to 1 May (RESEARCH D1/D2)"
  - "Lite isolation guard skips js/config.js and js/config_*.js: they are user data and sample programs, not Lite code"

patterns-established:
  - "Pure core: no window/document/storage/process/AppState/CONFIG/fetch and no clock reads, enforced by packages/core/tests/purity.test.js"
  - "Lite keeps its own function names as thin bindings over core and keeps its empty-input contract (parseDate('') is null)"

requirements-completed: [CORE-01, CORE-03]

coverage:
  - id: D1
    description: "One npm workspace with a single root lockfile; node_modules/@roadmapsnap/core is a symlink recorded with link: true"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "node -e lockfile check on packages['node_modules/@roadmapsnap/core'] (link true, resolved packages/core) and test -L node_modules/@roadmapsnap/core"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonical DD/MM/YYYY parse/format and ISO conversion in core, with malformed input handled (null / empty string) and native day rollover"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/dates.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lite date functions bound to core; all pre-existing Lite tests pass unchanged and npm run build bundles core through the bare specifier"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/core/timeline.test.js (npm test: 180 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D4
    description: "App type-checks against generated core declarations and isoToLiteDate comes from core isoToLite"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "npm -w @roadmapsnap/app run typecheck"
        status: pass
      - kind: unit
        ref: "packages/app/src/api/client.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Core purity, export uniqueness, barrel completeness and Lite isolation (no SaaS import, no network call, no /api/ URL) enforced by tests"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "packages/core/tests/purity.test.js"
        status: pass
      - kind: unit
        ref: "tests/guards/lite-isolation.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "engines node >=24 on root, api, app, core and tokens; private on core and tokens"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "node -e check of engines.node on all five package.json files"
        status: pass
    human_judgment: false

duration: 4 min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 01: Shared core tracer Summary

**npm workspaces plus a private zero-dependency `@roadmapsnap/core` package whose canonical DD/MM/YYYY functions run in Lite's Node tests and Vite bundle and in the app's generated-types type-check, guarded by purity and Lite-isolation tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-26T07:35:06Z
- **Completed:** 2026-11-26T07:39:00Z
- **Tasks:** 2
- **Files modified:** 8 (plus 8 created and 15 reserved modules)

## Accomplishments

- Root `workspaces: ["packages/*"]` with one `package-lock.json`; `node_modules/@roadmapsnap/core` is a symlink and the lockfile records it with `link: true`, `resolved: packages/core`.
- `packages/core` with `dates.js` (the one canonical DD/MM/YYYY implementation), tsconfigs for checkJs and `.d.ts` emission, and a 16-line barrel.
- Lite `parseDate`, `formatDateDisplay` and `formatShortDate` delegate to core; the 141 pre-existing Lite tests pass unchanged (180 in total with the new core and guard tests), and `npm run build` bundles core.
- App `isoToLiteDate` is `isoToLite` from core; `typecheck` generates `packages/core/types` and then runs `tsc --noEmit`.
- Guards in the root suite: purity (forbidden globals, no clock, zero deps), export uniqueness and barrel union, Lite isolation.

## Task Commits

1. **Task 1: Tracer, canonical dates through workspace, Lite build and app types** - `15479b2` (feat)
2. **Task 2 RED: failing purity, export, barrel and Lite isolation guards** - `4edac9b` (test)
3. **Task 2 GREEN: reserved core modules, engines, private tokens** - `127273d` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified

- `packages/core/src/dates.js` - parseDDMMYYYY, formatDDMMYYYY, formatDateDisplay, formatShortDate, isoToLite
- `packages/core/src/index.js` - barrel, one `export *` per module
- `packages/core/src/{timeline,workflow,dependencies,filters,stats,viewModel,export,adapter,defaults,themes,markup,viewState,models,timelineModel,arrows}.js` - reserved empty modules with owner headers
- `packages/core/package.json`, `tsconfig.json`, `tsconfig.build.json` - package, checkJs and declaration build
- `packages/core/tests/dates.test.js`, `purity.test.js` - unit and guard tests
- `tests/guards/lite-isolation.test.js` - Lite isolation guard
- `js/core/timeline.js` - date bindings over core
- `packages/app/src/api/client.ts`, `packages/app/package.json` - isoToLite re-export, typecheck script, workspace deps
- `package.json`, `package-lock.json`, `.gitignore`, `packages/api/package.json`, `packages/tokens/package.json` - workspaces, engines, private, ignored generated types

## Decisions Made

- Re-pinned the single root lockfile to the per-package resolved versions (see deviation 1).
- Core's `formatDateDisplay` and `formatShortDate` format from validated string parts rather than from a parsed Date, which keeps Lite's existing output for day-past-month-end input while returning `''` for malformed input.
- The Lite isolation guard ignores `js/config.js` and `js/config_*.js` (data, not code).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh workspace lockfile drifted dependency versions and broke the app type-check**
- **Found during:** Task 1 (`npm -w @roadmapsnap/app run typecheck`)
- **Issue:** The first root `npm install` re-resolved the app and api trees and bumped direct dependencies (for example `@auth0/auth0-react` 2.15.0 to 2.30.0). That produced `src/hooks/useApi.ts(21,9): TS2322` in an unrelated file. It also contradicted T-02-SC (lockfile change should be workspace linking only).
- **Fix:** Temporarily pinned the 10 drifted direct dependencies in `packages/app` and `packages/api` to the versions from their own lockfiles, ran `npm install --package-lock-only`, restored the original ranges and ran `npm install` again. No dependency was added or renamed, and no `package.json` range changed.
- **Files modified:** `package-lock.json`
- **Verification:** A script comparing direct-dependency versions against the old per-package lockfiles printed no differences; `npm -w @roadmapsnap/app run typecheck` and the client vitest pass.
- **Committed in:** `15479b2`

**2. [Rule 1 - Bug] RED test for the barrel needed its own failing assertion**
- **Found during:** Task 2 (RED)
- **Issue:** The planned "duplicate/union check fails until the barrel lists every module" cannot fail while the module files do not exist; the guard tests would all be unexpected-green.
- **Fix:** Added an explicit test, "barrel: index.js re-exports every reserved core module, dates first", asserting the 16-line barrel and the 16 module files. It failed on the planned deepEqual, and `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (TAP, 9 tests, 1 fail).
- **Files modified:** `packages/core/tests/purity.test.js`
- **Committed in:** `4edac9b`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary for correctness; no scope creep.

## TDD Gate Compliance

Task 2 (`tdd="true"`): RED `4edac9b`, GREEN `127273d`, no refactor commit needed.

- RED: target test "barrel: index.js re-exports every reserved core module, dates first" in `packages/core/tests/purity.test.js` failed on the expected deepEqual (only `./dates.js` listed). Semantic assessment: the target executed and failed on the planned assertion; the 8 other tests are guards over existing code and passed. Classifier verdict: `RED_EVIDENCE_OK`.
- GREEN: 15 reserved modules and the 16-line barrel; 9 of 9 guard tests pass, and temporarily adding `const w = window;` to `arrows.js` made `purity.test.js` exit non-zero (reverted).

## Issues Encountered

- `npm install` prints an install-scripts warning (esbuild, fsevents, browser-tabs-lock postinstall not covered by `allowScripts`). Build, tests and type-check all run, so no action was taken.
- `js/config.js` was absent; the plan's verify step copied it from `js/config_base.js`. It is gitignored and was not committed.

## Known Stubs

- `packages/core/src/{timeline,workflow,dependencies,filters,stats,viewModel,export,adapter,defaults,themes,markup,viewState,models,timelineModel,arrows}.js` each contain only a header and `export {};`. They are intentional reserved modules, filled by plans 02-04, 02-05, 02-07, 02-08, 02-10 and 02-11; they feed no UI today.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 siblings can add to core without touching the barrel. The per-package lockfiles `packages/api/package-lock.json` and `packages/app/package-lock.json` still exist and are removed in 02-03 together with the Dockerfile change.
- Flagged for the verifier (plan note): no edge class was derived for the general CORE-01 claim "Lite and SaaS use the same roadmap logic"; this plan only covers malformed and rollover dates, and the rest rides on 02-02, 02-04 and 02-07.
- Pre-existing uncommitted user work (the `roadmap:update` line in root `package.json` and the staged roadmap files) was left untouched and out of every commit.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED
