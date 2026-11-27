---
phase: 02-shared-core-lite-identical-view
plan: 10
subsystem: shared-core
tags: [core, view-model, view-state, dashboard, filter-bar, lite-binding, tdd, tracer]

requires:
  - phase: 02-07
    provides: "core themes (THEMES, THEME_LABELS) and the stats, filters and dependencies rules the models compose"
  - phase: 02-08
    provides: "core markup constants (RISK_ICON_SVG) and defaults used by the Lite renderers"
  - phase: 02-02
    provides: "Lite HTML snapshot harness (loadLite, renderLiteHTML) and the minimal/complex fixtures"
provides:
  - "packages/core/src/models.js: selectMonths, buildRoadmapModel, buildDashboardModel, buildFilterBarModel with typedefs RoadmapModel, DashboardModel, FilterBarModel"
  - "packages/core/src/viewState.js: DEFAULT_VIEW_STATE, 15 pure UI transitions and the two outside-click exclusion selector lists"
  - "Lite page, dashboard and filter bar rendered as dumb mappers over the core models"
  - "Lite handlers and AppState defaults/reset on core transitions"
affects: [02-11, 02-12, 02-13, 02-14, 02-16]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: bbd253af409d1f2d653889f4ccf4c8637f59d41b
plan_head_after: b7d96e710315556bebf746c671cd3a79ebeb6479

tech-stack:
  added: []
  patterns:
    - "Model builders take config, view state, today and theme as arguments and return plain data; renderers own markup and escaping"
    - "State transitions are (state, ...args) => nextState, never mutating; Lite applies them as AppState.set(transition(AppState.get(), ...))"
    - "clearStatusFilters returns the same object when there is nothing to clear, so callers can skip the update and the re-render"
    - "Lists of options and buttons are joined with the template's own newline and indentation so markup stays byte-identical"

key-files:
  created:
    - packages/core/tests/viewState.test.js
  modified:
    - packages/core/src/models.js
    - packages/core/src/viewState.js
    - packages/core/tests/models.test.js
    - js/ui/page.js
    - js/ui/dashboard.js
    - js/ui/filterBar.js
    - js/state/appState.js
    - js/app.js

key-decisions:
  - "Lite's dashboard fallbacks ('Items', 'Roadmap Dashboard', 'in scope') stay in the core model, not the config_base defaults, so a Lite config without labels renders exactly as before"
  - "The risk summary model is { count, active, disabled } or null; disabled stands for Lite's grey '0 At Risk' block shown when rows are at risk but none is in the current view"
  - "AppState.reset() is built on core resetViewState (theme kept) and still nulls timelineStart and timelineEnd, so Clear Filters behaves exactly as before"
  - "The generic updateFilter branch (an arbitrary filter key) stays a plain spread in Lite; it is not a UI action, so core has no transition for it"
  - "toggleDependencyGraph, expandAllGroups, collapseAllGroups and toggleGroup exist in core and are tested but are not rewired in Lite; 02-11 owns grouping.js and dependencyArrows.js"

patterns-established:
  - "Tracer: the page model went end to end (core, Lite page.js, snapshots green) before the dashboard and filter bar were moved"
  - "Models compare against the Lite bindings in tests (the byte-exact reference) rather than restating expected values"

requirements-completed: [CORE-01, VIEW-02, VIEW-04]

coverage:
  - id: D1
    description: "buildRoadmapModel makes every page-level decision renderRoadmap made (months per zoom, today position, visible sources, effective at-risk set, search-only KPI branch, stats, upcoming milestones, in-view counts) and Lite's renderPageHTML consumes it"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/models.test.js#buildRoadmapModel matches the Lite page derivations (12 fixture and state combinations)"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildDashboardModel carries every dashboard decision (labels with Lite fallbacks, Today text, risk and descoped summaries, KPI cards with breakdown text, state classes clamped at 7, active flags, progress segments, legend, milestone cards) as plain data; Lite's renderDashboard only maps it to the same markup"
    requirement: VIEW-02
    verification:
      - kind: unit
        ref: "packages/core/tests/models.test.js#buildDashboardModel (10 tests)"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js (18 byte-exact page snapshots, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "viewState exports the defaults and a pure transition for every Lite UI action plus the two outside-click selector lists; Lite's handlers and AppState defaults use them without changing behavior"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/core/tests/viewState.test.js"
        status: pass
      - kind: unit
        ref: "tests/state/appState.test.js (unchanged, nine default keys)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildFilterBarModel carries result counts over filterable rows, scope label, group and active-filter flags, sort, zoom and theme options; renderFilterBar(model) maps them to byte-identical markup"
    requirement: VIEW-02
    verification:
      - kind: unit
        ref: "packages/core/tests/models.test.js#buildFilterBarModel (7 tests)"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "No model field holds markup built from deliverable data (threat T-02-19): models are plain strings, numbers, booleans and arrays, escaping stays in the html template"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/models.test.js#buildDashboardModel holds plain data only and buildFilterBarModel carries the raw search text and holds no markup"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 10: Page, Dashboard and Filter-Bar Models and View-State Transitions in Core Summary

**Core now owns the page, dashboard and filter-bar view models (`buildRoadmapModel`, `buildDashboardModel`, `buildFilterBarModel`) and every Lite UI state transition (`viewState.js`), so Lite's renderers are markup-only mappers and all 18 byte-exact HTML snapshots, characterization tests and appState tests pass unchanged**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-26T16:12Z
- **Completed:** 2026-11-26T16:18Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 9 (1 new)

## Accomplishments

- `buildRoadmapModel({ config, state, today, theme })` replaces the derivations inside `renderPageHTML`: months per zoom (`selectMonths`), today position, visible sources, effective at-risk set, the search-only KPI branch, stats, upcoming milestones and the in-view at-risk and descoped counts. Tests compare it against the Lite bindings for both fixtures across six view states.
- `buildDashboardModel` returns plain data for everything `renderDashboard` computed; `renderDashboard(model)` in `js/ui/dashboard.js` no longer reads `CONFIG` (baseline 4 reads outside comments, now 0) or the workflow helpers.
- `buildFilterBarModel` feeds `renderFilterBar(model)`; option and zoom-button lists keep the template's exact whitespace, so markup is byte-identical.
- `viewState.js` holds the frozen `DEFAULT_VIEW_STATE` and the transitions for search, sort, Gantt, status KPI click, risk and descoped toggles, outside-click clear, reset (theme kept), zoom, group toggle/expand/collapse and dependency-graph toggle/close, plus the two outside-click selector strings verbatim.
- Lite's `updateFilter`, `filterByStatus`, `toggleRiskFilter`, `toggleDescopedFilter`, `clearStatusFilterOnOutsideClick` and `setDateRange` call the core transitions; `AppState` builds its defaults from `DEFAULT_VIEW_STATE` and `reset()` from `resetViewState`.

## Task Commits

1. **Task 1: Tracer, page composed from core `buildRoadmapModel`** - `c989a00` (feat)
   - Tracer gate: `<verify>` re-run end to end (models test, snapshots, characterization, `npm test`) all green; expanded.
2. **Task 2: Dashboard model** (TDD)
   - RED `2b7d6da` (test: `buildDashboardModel is not a function`), GREEN `34ef82d` (feat)
3. **Task 3: View-state transitions and filter-bar model** (TDD)
   - RED `189fed3` (test: viewState and filter-bar tests failing), GREEN `b7d96e7` (feat)
   - REFACTOR: none needed.

## Verification

- `node --test packages/core/tests/viewState.test.js packages/core/tests/models.test.js` 44 pass (50 with the purity guard); Lite snapshots, characterization and appState: 70 pass; root `npm test`: 468 pass, 0 fail.
- `npm run typecheck -w @roadmapsnap/core` clean; `npm run typecheck -w @roadmapsnap/app` clean; `npm run build` succeeds.
- `git diff --exit-code -- tests/fixtures/lite-html-snapshots.json tests/state/appState.test.js` exits 0; `grep -c "buildRoadmapModel(" js/ui/page.js` = 1; `grep -c "applyStatusFilter(" js/ui/filterBar.js` = 1; `grep -c DEFAULT_VIEW_STATE js/state/appState.js` = 2; purity test passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectations corrected after RED, before GREEN passed**
- **Found during:** Task 2 and Task 3 GREEN
- **Issue:** Two of my own RED tests encoded wrong expectations: the "no row at risk" fixture kept a dependency that puts a row at risk by a red edge, and the filter-bar counts for the complex fixture under a DEV filter were guessed (2 of 13) instead of taken from Lite's snapshot (3 of 12).
- **Fix:** The calm fixture also clears dependencies; the counts now match the snapshot's "Showing 3 of 12 workstreams". The implementation was not changed to fit the tests.
- **Files modified:** packages/core/tests/models.test.js
- **Commit:** `34ef82d`, `189fed3`

**2. [Rule 3 - Blocking] Core typedef aliases collided in the barrel**
- **Found during:** Task 1
- **Issue:** Re-declaring `Deliverable`, `RoadmapConfig` and `WorkflowItem` typedefs in models.js made `src/index.js` ambiguous for `tsc` (`export *` conflicts).
- **Fix:** models.js refers to the workflow.js types through `import('./workflow.js')` instead of local aliases.
- **Commit:** `c989a00`

**Total deviations:** 2 auto-fixed (1 test bug, 1 blocking type issue). **Impact:** none on behavior; Lite output is byte-stable.

Notes on scope: the plan's listed field set for `buildRoadmapModel` was extended with `nonFilterableGroups` (needed by the filter-bar model), and the risk summary model gained a `disabled` flag to represent Lite's grey "0 At Risk" block. `toggleDependencyGraph`, `toggleGroup`, `expandAllGroups` and `collapseAllGroups` are tested in core but intentionally not wired into `grouping.js` and `dependencyArrows.js`, which 02-11 rewires.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Threat T-02-19 (markup injection from deliverable data into models) is mitigated: models hold plain data, verified by tests that pass `<b>x</b>` and `"<x>` through unescaped, while Lite's `html` template keeps escaping at render time.

## Next Phase Readiness

Ready for 02-11 (timeline model and arrows): the page model already carries `months`, `todayPosition` and `visibleSources`, and the graph and group transitions are in core awaiting their Lite handlers.

## Self-Check: PASSED

All nine source and test files exist; commits c989a00, 2b7d6da, 34ef82d, 189fed3 and b7d96e7 are on the branch; all task acceptance criteria re-run green.
