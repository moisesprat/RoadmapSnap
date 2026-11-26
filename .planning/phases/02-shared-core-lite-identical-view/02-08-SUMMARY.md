---
phase: 02-shared-core-lite-identical-view
plan: 08
subsystem: shared-core
tags: [core, export, adapter, markup, safe-links, lite-binding, tdd, tracer]

requires:
  - phase: 02-04
    provides: "core workflow (normalizeWorkflow, getCurrentStatus, getNextMilestone, getMilestoneDate) and the Lite binding pattern"
  - phase: 02-01
    provides: "core dates (isoToLite, parseDDMMYYYY) and the purity guard"
  - phase: 02-02
    provides: "Lite HTML snapshot harness, loadLite helper and the minimal/complex parity fixtures"
provides:
  - "packages/core/src/export.js: buildCsv, buildJson, EXPORT_FILENAMES (today and now injected)"
  - "packages/core/src/adapter.js: apiToRoadmap, deriveTimelineRange, typedefs ApiWorkspace, ApiProject, ApiDependency"
  - "packages/core/src/defaults.js: DEFAULT_ENTITY_LABELS, DEFAULT_DASHBOARD_TEXT (config_base values)"
  - "packages/core/src/markup.js: INFO_ICON_SVG, RISK_ICON_SVG, EXPORT_ICON_SVGS, safeHttpUrl"
  - "tests/helpers/roadmapToApi.js: test-only roadmapToApi and canonicalRoadmap for the parity suite"
  - "tests/fixtures/lite-export-snapshots.json: Lite CSV and JSON bytes for both fixtures"
affects: [02-09, 02-10, 02-11, 02-13, 02-16]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6
plan_head_before: e9b879e6abd8e8566c076a6dba5ff8e2af25d922
plan_head_after: e2de630860b3452aad15fc826c2e3cce07a40cc5

tech-stack:
  added: []
  patterns:
    - "Export builders take today and the export timestamp as arguments; the Lite binding keeps the clock read and the Blob download"
    - "The adapter orders milestone keys by the workflow and deliverable keys canonically, so output bytes do not depend on how the API orders rows"
    - "Constant icon markup is pinned by SHA-256 in tests instead of repeating the strings"

key-files:
  created:
    - packages/core/tests/export.test.js
    - packages/core/tests/adapter.test.js
    - packages/core/tests/markup.test.js
    - tests/helpers/roadmapToApi.js
    - tests/fixtures/lite-export-snapshots.json
    - .planning/phases/02-shared-core-lite-identical-view/deferred-items.md
  modified:
    - packages/core/src/export.js
    - packages/core/src/adapter.js
    - packages/core/src/defaults.js
    - packages/core/src/markup.js
    - js/export/csv.js
    - js/export/json.js
    - js/app.js
    - js/ui/exportControls.js

key-decisions:
  - "Export bytes are unchanged: the Lite snapshot was generated against the pre-core code in the RED commit and both Lite and core match it (CSV formula injection stays, deferred per OQ5)"
  - "apiToRoadmap falls back to the default workflow when workflow_definition is empty or missing, so an unconfigured workspace still renders instead of failing in getFirstState"
  - "A null planned date removes the key, so Lite's { START: '' } 'no dates' row becomes milestones {} after the adapter"
  - "Milestone keys follow the workflow order (unknown keys after), because the API returns them ordered by key name"

patterns-established:
  - "Tracer first: CSV and JSON went end to end (core, Lite binding, snapshots) before the adapter and markup were added"
  - "canonicalRoadmap(config) is the common input for comparing the Lite path and the SaaS path"

requirements-completed: [CORE-01, VIEW-06]

coverage:
  - id: D1
    description: "buildCsv and buildJson reproduce Lite's exportToCSV and exportToJSON bytes for both fixtures (JSON with the injected now); Lite downloads them with the same filenames and mime types"
    requirement: VIEW-06
    verification:
      - kind: unit
        ref: "packages/core/tests/export.test.js#lite export snapshots, buildCsv(*), buildJson(*)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSV and JSON over apiToRoadmap(roadmapToApi(fixture)) are byte-identical between the Lite path and core, so SaaS and Lite exports match"
    requirement: VIEW-06
    verification:
      - kind: unit
        ref: "packages/core/tests/export.test.js#Lite and core exports are byte-identical over the adapter output"
        status: pass
    human_judgment: false
  - id: D3
    description: "apiToRoadmap converts API rows (ISO dates, snake_case, null columns) into the Lite config shape with config_base defaults and the OQ4 default range, never throwing on missing input"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/adapter.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Constant icons and safeHttpUrl live in core; Lite renders identically (HTML snapshots unchanged) and only http/https links pass the allowlist"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/markup.test.js"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edge cases of CSV/JSON export (VIEW-06): quotes in names, empty tags, rows without group or dates, descoped rows and legacy MILESTONES configs are covered by byte equality on both fixtures and the legacy canonical test"
    requirement: VIEW-06
    verification:
      - kind: unit
        ref: "packages/core/tests/export.test.js (complex fixture rows) and adapter.test.js#legacy MILESTONES config"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 08: Export Builders, API Adapter and Markup Constants in Core Summary

**CSV and JSON export builders, the single `apiToRoadmap` API-to-Lite adapter with config_base defaults and a derived timeline range, and constant icons plus an http/https link allowlist now live in `@roadmapsnap/core`, with Lite's export bytes and HTML snapshots unchanged**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-26T16:02Z
- **Completed:** 2026-11-26T16:08Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 14 (6 new)

## Accomplishments

- `buildCsv(config, { today })` and `buildJson(config, { today, now })` produce exactly the bytes Lite produced before this plan (guarded by `tests/fixtures/lite-export-snapshots.json`, generated against the pre-core code); `js/export/csv.js` and `json.js` are bindings that keep the window shims, the clock read and `downloadFile`.
- `apiToRoadmap` is the one API edge: ISO dates to DD/MM/YYYY, null dates, groups and links omitted, bare dependencies as strings, settings to TIMELINE and GROUP_ORDER, labels and texts merged over the config_base defaults, range derived from the milestones (or January to December of today's year).
- For both fixtures, the Lite export path and the core builders agree byte for byte over `apiToRoadmap(roadmapToApi(fixture))`.
- `safeHttpUrl` allows only http and https; the three icon groups are constants pinned by SHA-256, and `npm run build` plus `tests/fixtures/lite-html-snapshots.json` (no diff) confirm Lite renders identically.
- CSV formula injection is recorded in `deferred-items.md` with the suggested fix; CSV bytes stay identical (resolved OQ5).

## Task Commits

1. **Task 1: Tracer, CSV and JSON builders in core, Lite downloads them**
   - RED `c0c0a08` (test: Lite export snapshots, failing core builder tests), GREEN `a4fdc75` (feat)
2. **Task 2: apiToRoadmap adapter, defaults, default range, inverse test adapter**
   - RED `a195021` (test), GREEN `97c1d86` (feat)
3. **Task 3: Icons and the URL allowlist in core, CSV injection deferred**
   - RED `a1cd8b5` (test), GREEN `e2de630` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan).

## TDD Gate Compliance

Tasks 2 and 3 followed RED then GREEN; no REFACTOR commit was needed. Task 1 is a tracer (characterization first, then core and the binding).

- **Task 1 tracer:** the characterization test ran against the untouched Lite code with `UPDATE_LITE_SNAPSHOTS=1` and passed (4 snapshot entries); the six core assertions failed with `core.buildCsv is not a function` / `core.EXPORT_FILENAMES` undefined (the reserved `export {}` stub). GREEN: 7 of 7, root suite 397 of 397 with the tracer verify re-run end to end.
- **Task 2 RED:** `adapter.test.js` and the extended `export.test.js` failed to load (`apiToRoadmap`, `DEFAULT_*` not exported, `tests/helpers/roadmapToApi.js` imports `apiToRoadmap`): 2 files, 0 tests passed. GREEN: 29 of 29, root suite 419.
- **Task 3 RED:** `markup.test.js` failed (`safeHttpUrl` not a function, constants undefined). GREEN: 5 of 5; root suite 424 of 424, Lite HTML snapshots unchanged, `npm run build` green.

## Files Created/Modified

- `packages/core/src/export.js` - buildCsv, buildJson, EXPORT_FILENAMES (copied from Lite with CONFIG replaced by the config argument)
- `packages/core/src/adapter.js` - apiToRoadmap, deriveTimelineRange, API typedefs
- `packages/core/src/defaults.js` - frozen config_base labels and dashboard text
- `packages/core/src/markup.js` - icon constants and safeHttpUrl
- `packages/core/tests/{export,adapter,markup}.test.js` - 9 export, 20 adapter and 5 markup tests
- `tests/helpers/roadmapToApi.js` - test-only inverse adapter and canonicalizer (not exported from core)
- `tests/fixtures/lite-export-snapshots.json` - minimal/complex CSV and JSON bytes (exportDate pinned)
- `js/export/csv.js`, `js/export/json.js` - bindings over core builders
- `js/app.js`, `js/ui/exportControls.js` - import the icon constants from core
- `.planning/phases/02-shared-core-lite-identical-view/deferred-items.md` - CSV formula injection

## Decisions Made

- Lite's export output is the contract: the snapshots were recorded before the refactor, and the plan's tracer proves Lite still downloads the same bytes through core.
- The adapter returns the default workflow (not an empty array) when the workspace has none, because `getFirstState` on `[]` fails downstream; the API returns `[]` for an unconfigured workspace.
- Milestone keys come out in workflow order, because the API returns them ordered by key name (`M1, M2, START`), which would change the JSON export key order against a Lite config authored in workflow order.
- Group and link are omitted for empty strings as well as null (a blank string has no meaning in the UI).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Round trip of the "Unscheduled Spike" row cannot deep-equal the fixture**
- **Found during:** Task 2 (writing the round-trip test)
- **Issue:** the plan requires `apiToRoadmap(roadmapToApi(complexConfig))` to deep-equal `complexConfig`, and also that a null planned date removes its key. The fixture row "Unscheduled Spike" is `milestones: { START: '' }` (kept because `validateConfig` rejects `{}`), which becomes `{ START: null }` in the API shape and `{}` after the adapter. Both requirements cannot hold for that row.
- **Fix:** kept the explicit behavior (null date removes the key) and made the round-trip test compare against `complexConfig` with empty-string dates removed. The idempotence test (`canonicalRoadmap(canonicalRoadmap(x))` equals `canonicalRoadmap(x)`) runs on both fixtures unchanged.
- **Files modified:** `packages/core/tests/adapter.test.js`
- **Verification:** `node --test packages/core/tests/adapter.test.js` 20 of 20.
- **Committed in:** `a195021`
- **Downstream note (02-16 parity):** a SaaS row with no dates renders from `milestones: {}`, Lite from `{ START: '' }`; the parity suite should compare Lite over `canonicalRoadmap(config)`, not over the raw fixture.

**2. [Rule 2 - Missing Critical] Empty workflow fallback and non-string date guard in the adapter**
- **Found during:** Task 2
- **Issue:** the plan sets `WORKFLOW = workspace.workflow_definition`, but the API sends `[]` for an unconfigured workspace and `normalizeWorkflow` returns an empty array as is, which breaks `getFirstState`. Non-string dates would also pass through `isoToLite` as numbers.
- **Fix:** an empty or missing workflow falls back to `normalizeWorkflow({})`; only non-empty strings are converted as dates.
- **Files modified:** `packages/core/src/adapter.js`
- **Verification:** the "never throws" adapter test covers `undefined`, `null`, `{}` and partial payloads.
- **Committed in:** `97c1d86`

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical). **Impact:** none on Lite behavior; one plan truth (deep-equal round trip) is met modulo empty-string dates, documented for 02-16.

## Authentication Gates

None.

## Issues Encountered

- A `sed -i` (BSD) invocation to reword a comment failed silently and the comment containing `NON_FILTERABLE_GROUPS` landed in the GREEN commit; fixed with an amend of the unpushed commit (`97c1d86`) before moving on.

## Known Stubs

None.

## Threat Flags

None. T-02-15 is mitigated by `safeHttpUrl` (consumed by the React link in 02-13); T-02-16 is accepted and recorded in `deferred-items.md`; T-02-17 is covered by the adapter null-safety test.

## Next Phase Readiness

Ready for 02-09. The SaaS app (02-13, 02-16) can call `apiToRoadmap`, `buildCsv`, `buildJson`, `safeHttpUrl` and the icon constants directly from `@roadmapsnap/core`.

## Self-Check: PASSED

- Created files exist: `packages/core/tests/{export,adapter,markup}.test.js`, `tests/helpers/roadmapToApi.js`, `tests/fixtures/lite-export-snapshots.json`, `deferred-items.md` (verified below).
- Commits `c0c0a08`, `a4fdc75`, `a195021`, `97c1d86`, `a1cd8b5`, `e2de630` are ancestors of HEAD.
- `npm test` 424 of 424, `npm run typecheck -w @roadmapsnap/core`, `npm run validate`, `npm run build` green; `tests/fixtures/lite-html-snapshots.json` has no diff.
