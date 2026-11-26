---
phase: 02-shared-core-lite-identical-view
plan: 07
subsystem: shared-core
tags: [core, filters, stats, view-model, lite-binding, tdd]

requires:
  - phase: 02-04
    provides: "core workflow, timeline and dependencies modules (getCurrentStatus, getMilestoneDate, red sets, getEffectiveAtRiskSet)"
  - phase: 02-02
    provides: "Lite HTML snapshot harness and characterization tests (including the LEGACY today-override test)"
provides:
  - "packages/core/src/filters.js: filterDeliverables, filterBySearchOnly, hasSearchFilter, sortDeliverables plus typedefs FilterState and SortState"
  - "packages/core/src/stats.js: getAllVisibleDataSources, getFilterableDeliverablesFrom, getVisibleDataSources, calculateStats, getUpcomingMilestones"
  - "packages/core/src/viewModel.js: resolveStateColor (theme argument), resolveStateTextColor, buildMilestoneMarkers, buildGanttSegments, buildDependencyClass, buildDeliverableViewModel"
  - "js/ui/filterBar.js, js/core/stats.js and js/core/viewModel.js reduced to bindings that keep every name and window shim"
affects: [02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 20500
  tasks: 3
  commits: 5
plan_head_before: a1c99262c69db379f50c0a146dec11b145eb6bca
plan_head_after: c2c71f164028425521c3990ddff9db1e0d4c56ef

tech-stack:
  added: []
  patterns:
    - "Core filter/sort/stats take the filter, sort, workflow, today, non-filterable groups and risk sets as explicit arguments; the Lite binding builds that context from AppState, CONFIG and the clock"
    - "Only the Lite view-model binding reads data-theme from the document; core takes a theme string"
    - "A binding that must load in Node without localStorage or window reads window.AppState lazily instead of importing appState.js"

key-files:
  created:
    - packages/core/tests/filters.test.js
    - packages/core/tests/stats.test.js
    - packages/core/tests/viewModel.test.js
  modified:
    - packages/core/src/filters.js
    - packages/core/src/stats.js
    - packages/core/src/viewModel.js
    - js/ui/filterBar.js
    - js/core/stats.js
    - js/core/viewModel.js
    - tests/core/characterization.test.js

key-decisions:
  - "calculateStats honors the today it is given for the red-dependency part of atRisk (D13/D14); Lite in the browser always passes CONFIG today, so its output is unchanged"
  - "buildDependencyClass(graph, sourceName) identifies the active node as graph.nodes[0], which getDependencyGraph always sets to the queried deliverable; buildDeliverableViewModel's ctx carries the active node's name (as Lite did) and builds the graph itself"
  - "The Lite stats binding reads window.AppState and CONFIG.TIMELINE.TODAY directly instead of importing appState.js and timeline.js, so tests/core/stats.test.js keeps loading in Node untouched"
  - "The Lite risk sets for filtering stay computed over every CONFIG deliverable (not the rows being filtered), exactly as before"

patterns-established:
  - "Tracer first: filters went end to end (core, tests, binding, snapshots untouched) before stats and the view model were expanded"
  - "A characterization test that pins a behavior a later plan changes is flipped in the RED commit, with the old expectation kept in a comment"

requirements-completed: [CORE-01, VIEW-02, VIEW-04]

coverage:
  - id: D1
    description: "Filtering, search and sorting (status, risk, descoped, search folded with toLowerCase and no normalization, stable sort with the 31/12/9999 default) are explicit-argument core code; js/ui/filterBar.js keeps its window functions as bindings"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/core/tests/filters.test.js"
        status: pass
      - kind: unit
        ref: "tests/core/characterization.test.js#filterDeliverables / sortDeliverables"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "KPI statistics and upcoming milestones are core code with an honored today and no bare-global calls; js/core/stats.js is a binding and tests/core/stats.test.js passes unedited"
    requirement: VIEW-02
    verification:
      - kind: unit
        ref: "packages/core/tests/stats.test.js"
        status: pass
      - kind: unit
        ref: "tests/core/stats.test.js (pre-existing, unedited)"
        status: pass
      - kind: unit
        ref: "tests/core/characterization.test.js#today override honored"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-row view model and state colors are core code taking the theme as an argument; only js/core/viewModel.js reads data-theme"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/viewModel.test.js"
        status: pass
      - kind: unit
        ref: "tests/core/characterization.test.js#buildDeliverableViewModel"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edge cases (VIEW-04): empty and one-character search, empty deliverable lists, non-ASCII case folding without normalization, and stable ordering for every sort key and order"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/core/tests/filters.test.js#edge (empty), edge (encoding), edge (ordering)"
        status: pass
      - kind: unit
        ref: "packages/core/tests/stats.test.js#edge (empty)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 07: Filters, Statistics and View Model in Core Summary

**Filtering, sorting, KPI statistics, upcoming milestones and the per-row view model extracted into `@roadmapsnap/core` as explicit-argument functions (theme and today passed in), with Lite bindings that keep every name and window shim and unchanged HTML snapshots**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-26T15:50Z
- **Completed:** 2026-11-26T15:59Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 10 (3 new test files)

## Accomplishments

- `packages/core` now owns filtering, search, sorting, KPI statistics, upcoming milestones and the per-row view model; the purity guard and the core typecheck stay green (no CONFIG, window, document or clock read in `packages/core/src`).
- `js/ui/filterBar.js`, `js/core/stats.js` and `js/core/viewModel.js` keep their names, signatures and `window` shims, so `tests/core/stats.test.js` and every other pre-existing test pass unedited and `tests/fixtures/lite-html-snapshots.json` has no diff.
- `calculateStats` uses the today it is given for the red-dependency part of `atRisk`. The LEGACY test is rewritten as "today override honored:" with the old expectation kept in a comment.
- `js/core/stats.js` has no bare-global calls left (it used to call `filterDeliverables`, `sortDeliverables`, `parseDate`, `getTodayDate` and `isGroupNonFilterable` as window globals).
- `resolveStateColor` takes the theme as an argument; only `js/core/viewModel.js` reads `data-theme`.

## Task Commits

1. **Task 1: Tracer, filters and sorting into core through the filter-bar binding** - `b0da9d3` (feat)
2. **Task 2: KPI statistics and upcoming milestones with an honored today**
   - RED `c59dad9` (test), GREEN `80cf9c6` (feat)
3. **Task 3: Per-row view model with the theme as an argument**
   - RED `a6f6538` (test), GREEN `c2c71f1` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan).

## TDD Gate Compliance

Tasks 2 and 3 followed RED then GREEN; no REFACTOR commit was needed.

- **Task 2 RED:** `packages/core/tests/stats.test.js` (14 tests) run with `node --test --test-reporter=tap`: 14 fail, 0 pass. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` / `target_test_failed` for "calculateStats on the complex fixture counts effective at-risk rows and excludes descoped rows from the KPIs". Semantic assessment: the target executed and failed with `core.calculateStats is not a function` because `packages/core/src/stats.js` was still the reserved `export {}` stub (tests import the barrel as a namespace so a missing export fails the test, not the load). The flipped characterization test "today override honored:" was committed in the same RED commit and failed on its own assertion (Lite still ignored the override, so `atRisk` was 0, not 1).
- **Task 2 GREEN:** stats tests 14 of 14; root suite 376 of 376.
- **Task 3 RED:** `packages/core/tests/viewModel.test.js` (14 tests): 14 fail, 0 pass; classifier `RED_EVIDENCE_OK` for "buildDeliverableViewModel for a dependency-heavy row matches the recorded Lite view model" (same `is not a function` reason). The first attempt returned `INVALID_RED / invalid_record` because an `assert.doesNotThrow` test emitted a TAP block with duplicate YAML keys (malformed report); the test was rewritten to assert on the result and the RED was recorded again, valid.
- **Task 3 GREEN:** viewModel tests 14 of 14; root suite 390 of 390. One test expectation was wrong in the RED commit (evergreen QA color is `#6cbe4c`, I had written the LIVE color); it was corrected in the GREEN commit.
- Task 1 is a tracer (not `tdd="true"`): core, tests and binding in one commit with snapshots untouched.

## Files Created/Modified

- `packages/core/src/filters.js` - filterDeliverables, filterBySearchOnly, hasSearchFilter, sortDeliverables; typedefs FilterState, SortState
- `packages/core/src/stats.js` - visible-source helpers, getVisibleDataSources, calculateStats, getUpcomingMilestones
- `packages/core/src/viewModel.js` - palettes, resolveStateColor/resolveStateTextColor, marker and segment builders, buildDependencyClass, buildDeliverableViewModel
- `packages/core/tests/{filters,stats,viewModel}.test.js` - explicit-argument tests (20, 14, 14 tests)
- `js/ui/filterBar.js` - three window functions are bindings over `getFilterContext()`; handlers, window block and renderFilterBar untouched
- `js/core/stats.js` - binding; defaults filled from CONFIG, `window.AppState` and the clock
- `js/core/viewModel.js` - binding; theme from `document.documentElement.getAttribute('data-theme')`
- `tests/core/characterization.test.js` - LEGACY today-override test rewritten as "today override honored:"

## Decisions Made

- The given today now drives `calculateStats`' red-dependency part of `atRisk` (the one accepted behavior change, pinned by the renamed test; Lite in the browser always passes CONFIG today).
- `buildDependencyClass(graph, sourceName)` treats `graph.nodes[0]` as the active node. `getDependencyGraph` always inserts the queried name first, and it returns `nodes: []` only when that name is not in the list, in which case no rendered row can carry it, so the output matches Lite's name comparison.
- `getVisibleDataSources` computes the risk sets over all deliverables given, not only the visible ones, as Lite did through its bare defaults.
- The stats binding reads `window.AppState` and `CONFIG.TIMELINE.TODAY` itself (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stats binding could not import appState.js or timeline.js**
- **Found during:** Task 2 GREEN
- **Issue:** `tests/core/stats.test.js` (must pass untouched) imports `js/core/stats.js` in Node. A static import of `js/state/appState.js` threw (`localStorage` undefined) and of `js/core/timeline.js` threw (unguarded `window.parseDate = ...`).
- **Fix:** the binding reads `window.AppState` lazily inside `getVisibleDataSources` and resolves today from `CONFIG.TIMELINE.TODAY` or the clock directly (the same rule `getTodayDate` uses).
- **Files modified:** `js/core/stats.js`
- **Verification:** `npm test` 376 of 376; `tests/core/stats.test.js` has no diff.
- **Committed in:** `80cf9c6`

**2. [Rule 1 - Bug] Dead theme helpers removed from the view-model binding**
- **Found during:** Task 3
- **Issue:** the plan said `isMonochromeTheme`/`isPapallonaTheme`/`isEvergreenTheme` stay in `js/core/viewModel.js`, but once the theme is passed to core nothing calls them (not exported, not on `window`, no other reference in the repo).
- **Fix:** replaced by a single `getCurrentTheme()` that reads `data-theme` (default `light`), so the `getAttribute('data-theme')` acceptance criterion still holds.
- **Files modified:** `js/core/viewModel.js`
- **Verification:** snapshots and characterization unchanged, including the monochrome snapshot.
- **Committed in:** `c2c71f1`

**3. [Rule 3 - Blocking] tsc rejected nullable positions**
- **Found during:** Task 3 (core typecheck)
- **Issue:** `calculatePosition` returns `number | null`; the marker builder assigned it to a `number` field.
- **Fix:** typed casts, valid because `isDateInRange` already guarantees a parseable date.
- **Files modified:** `packages/core/src/viewModel.js`
- **Verification:** `npm run typecheck -w @roadmapsnap/core` exits 0.
- **Committed in:** `c2c71f1`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 dead-code cleanup)
**Impact on plan:** none on behavior or interfaces; all were needed to keep existing tests loading, the typecheck green and the binding free of dead code.

## Issues Encountered

- `gsd_run check tdd-red-evidence` rejected the first Task 3 RED record as `invalid_record`: a `doesNotThrow` assertion makes Node's TAP reporter emit duplicate YAML keys. Rewriting that test fixed the evidence, not the classifier.
- The plan's `must_haves` mention a `LEGACY today-override:` comment marker; the file header comment in the characterization test was reworded to say the test was flipped by 02-07 (the acceptance count of `LEGACY today-override:` is 0).

## Known Stubs

None. The three reserved `export {}` modules this plan owned (`filters`, `stats`, `viewModel`) are filled; the remaining reserved modules belong to later plans.

## Threat Flags

None. T-02-14 holds: characterization tests and the byte-exact Lite snapshots pass unchanged, and the only behavior change (honored today) is pinned by the renamed test. No new network, auth or file-access surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans (`02-08` onward) can import `filterDeliverables`, `sortDeliverables`, `calculateStats`, `getUpcomingMilestones`, `getVisibleDataSources` and `buildDeliverableViewModel` from `@roadmapsnap/core` and pass workflow, today and theme explicitly.
- `js/ui/filterBar.js` handlers (`updateFilter`, `filterByStatus`, toggles) are untouched; 02-10 moves their transitions.
- `packages/app/src/lib/` still has its own copies of these rules; porting the SaaS app onto core is for the later plans in this phase.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED

- All ten created/modified source and test files exist.
- Commits `b0da9d3`, `c59dad9`, `80cf9c6`, `a6f6538`, `c2c71f1` are ancestors of HEAD.
- Acceptance criteria re-run: `git diff --exit-code` on `tests/core/stats.test.js` and `tests/fixtures/lite-html-snapshots.json` exits 0; `from '@roadmapsnap/core'` count in `js/ui/filterBar.js` is 1; `today override honored:` count 1, `LEGACY today-override:` count 0; `getAttribute('data-theme')` count 1 in `js/core/viewModel.js`, `getAttribute` count 0 in `packages/core/src/viewModel.js`; `purity.test.js` passes.
- Plan verification: `npm test` 390 of 390, `liteHtml` and characterization 55 of 55, core typecheck, `npm run validate` and `npm run build` green.
