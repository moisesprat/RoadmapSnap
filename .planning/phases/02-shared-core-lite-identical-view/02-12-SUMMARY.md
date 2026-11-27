---
phase: 02-shared-core-lite-identical-view
plan: 12
subsystem: ui
tags: [react, golden-markup, dashboard, filter-bar, view-state, vitest, jsdom, tdd, tracer]

requires:
  - phase: 02-10
    provides: "core buildRoadmapModel, buildDashboardModel, buildFilterBarModel and the viewState transitions; Lite renderers as mappers over those models"
  - phase: 02-08
    provides: "core RISK_ICON_SVG constant and canonicalRoadmap test helper"
  - phase: 02-05
    provides: "core THEMES, THEME_LABELS and ThemeName"
provides:
  - "normalizeMarkup / normalizeHtmlString: canonical serializer for golden comparisons between React and Lite markup"
  - "loadLiteRenderers / liteModelFor: Lite's renderers in jsdom with core models for the same inputs, returning dashboard, filter bar, export controls and footer HTML"
  - "LiteDashboard: React render of DashboardModel with Lite's tag tree and classes"
  - "LiteFilterBar: React render of FilterBarModel with debounced search, sort, zoom, group and theme controls"
  - "useLiteViewState: reducer hook over the core viewState transitions with stable action identities"
affects: [02-13, 02-14, 02-15, 02-16, 02-17]

actuals:
  tokens: 11100
  tasks: 2
  commits: 3
plan_head_before: 008e7189e884fb4c60ad46c77b1a982b1a2134ef
plan_head_after: 992ae0e24c6854cafd4cf35d6af99274a32ad381

tech-stack:
  added: []
  patterns:
    - "Golden markup: the React render of a core model is compared with Lite's own renderer for the same model; only on*, role, tabindex, aria-* and data-* are ignored"
    - "Components compare live DOM state (option.selected, input.value) through properties, so markup attributes in Lite and framework-managed state in React look the same"
    - "dangerouslySetInnerHTML only receives core *_ICON_SVG constants; tenant strings are JSX text or attributes"
    - "Uncontrolled search input with a ref timer: same node across renders, focus and caret restored on the debounced commit, external resets copied in unless a keystroke is pending"

key-files:
  created:
    - packages/app/src/test/goldenMarkup.ts
    - packages/app/src/test/liteRenderer.ts
    - packages/app/src/components/lite/LiteDashboard.tsx
    - packages/app/src/components/lite/LiteDashboard.test.tsx
    - packages/app/src/components/lite/LiteFilterBar.tsx
    - packages/app/src/components/lite/LiteFilterBar.test.tsx
    - packages/app/src/hooks/useLiteViewState.ts
    - packages/app/src/hooks/useLiteViewState.test.ts
  modified: []

key-decisions:
  - "The normalizer drops whitespace the way CSS collapses it (edges of a block and next to a block sibling) and keeps one space between inline siblings, so JSX needs {' '} exactly where Lite's templates have inline whitespace"
  - "Select and input values are compared through DOM properties (option.selected, input.value), not attributes, because React sets state through properties while Lite's markup uses attributes"
  - "LiteFilterBar takes a groupNames prop for Expand All and Collapse All: FilterBarModel only says whether groups exist, and the core expandAllGroups transition needs the names (Lite reads them from CONFIG.DELIVERABLES)"
  - "The hook's reset copies the six view fields out of core resetViewState, so the theme (owned outside the hook) is never part of the view state"
  - "The theme select is controlled by the theme prop, the sort selects by the model's selected option; Lite's own markup is the reference for everything else"

patterns-established:
  - "liteModelFor(config, statePatch, theme) is the one entry point later golden tests (02-13 timeline, 02-17 export controls and footer) use to get Lite HTML plus the matching core model"
  - "A patch of filter in liteModelFor must be complete (AppState.set is a shallow merge)"

requirements-completed: [VIEW-02, VIEW-04, VIEW-05]

coverage:
  - id: D1
    description: "LiteDashboard renders core's DashboardModel with the same tag tree, classes, text, title, id and style values as Lite's renderDashboard for the minimal and complex fixtures in the default, status DEV and risk-only states"
    requirement: VIEW-02
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDashboard.test.tsx#LiteDashboard golden markup (6 fixture and state combinations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clickable KPI cards and the risk and descoped summaries are button-like (role, tabIndex 0, Enter and Space) and report the status key or the toggle"
    requirement: VIEW-02
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDashboard.test.tsx#LiteDashboard interactions (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "LiteFilterBar renders Lite's filter bar markup for both fixtures in the default, search, status, zoom 6, sort descending and monochrome-theme states"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteFilterBar.test.tsx#LiteFilterBar golden markup (12 combinations)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Search commits once 150 ms after the last keystroke on the same input node with focus and the caret at the end; the input follows an external reset; the results line reads as Lite's with no plural handling; Expand All, Collapse All and Clear Filters appear only when applicable; the search and sort controls have aria-labels"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteFilterBar.test.tsx#LiteFilterBar behavior (6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The theme select lists the eight core themes with their labels, shows the current one and reports a change through onThemeChange"
    requirement: VIEW-05
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteFilterBar.test.tsx#lists the eight themes with their labels, marks the current one and reports a change"
        status: pass
    human_judgment: false
  - id: D6
    description: "useLiteViewState starts at DEFAULT_VIEW_STATE and changes only through the core transitions, closing the dependency graph where Lite's handlers do; reset returns to the defaults"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/app/src/hooks/useLiteViewState.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Pixel-level look of the dashboard and filter bar against Lite under the real tokens CSS"
    requirement: VIEW-02
    verification: []
    human_judgment: true
    rationale: "The golden test proves tag tree, classes, text and style attributes, not rendering. The first pixel comparison against Lite runs in 02-17 and the full suite in 02-16 (plan objective)."

duration: 7min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 12: Golden Markup Harness, View-State Hook, Dashboard and Filter Bar Summary

**React `LiteDashboard` and `LiteFilterBar` render core's view models with markup equal to Lite's own renderers (proven by a golden-markup test over both fixtures and six states), driven by a `useLiteViewState` reducer that only calls core's viewState transitions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-26T16:27Z
- **Completed:** 2026-11-26T16:34Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 8 (all new)

## Accomplishments

- `normalizeMarkup` and `normalizeHtmlString` serialize a DOM tree canonically (sorted classes and attributes, style pairs from the attribute text, merged text nodes, CSS-style whitespace collapsing, `on*`/`role`/`tabindex`/`aria-*`/`data-*` dropped). A mutation check (renaming one class in the component) turned all six dashboard golden tests red, so the comparison is not vacuous.
- `liteModelFor` loads Lite's modules into jsdom once per test file and returns the core `RoadmapModel` plus Lite's dashboard, filter bar, export controls and footer HTML for the same inputs.
- `LiteDashboard` mirrors `renderDashboard` element for element; the only raw HTML is `RISK_ICON_SVG` (acceptance grep prints 0 for any other `dangerouslySetInnerHTML` use). Clickable blocks get `role="button"`, `tabIndex={0}` and Enter/Space activation, and stop propagation like Lite's handlers.
- `useLiteViewState` delegates every action to a core transition and wraps the filter, sort and zoom actions in `closeDependencyGraph` exactly where Lite's handlers close the graph; `setShowGantt`, group toggles and `clearStatusFilters` leave it open, and `clearStatusFilters` returns the same state object when there is nothing to clear.
- `LiteFilterBar` keeps one uncontrolled search input, commits after 150 ms and restores focus and caret, and copies in an external reset unless a keystroke is pending.

## Task Commits

1. **Task 1: Tracer, dashboard from core `DashboardModel`** - `1cd15a5` (feat)
   - Tracer gate: `<verify>` (golden test plus app typecheck) re-run end to end after the acceptance greps, green; expanded to Task 2.
2. **Task 2: View-state hook and filter bar** (TDD)
   - RED `97c1248` (test: 26 of 29 new tests fail on their assertions against inert stubs of the hook and component)
   - GREEN `992ae0e` (feat)
   - REFACTOR: none needed.

## Files Created/Modified

- `packages/app/src/test/goldenMarkup.ts` - canonical serializer for golden comparisons
- `packages/app/src/test/liteRenderer.ts` - Lite renderers in jsdom plus the core model for the same inputs
- `packages/app/src/components/lite/LiteDashboard.tsx` and `.test.tsx` - dashboard component, golden and interaction tests
- `packages/app/src/components/lite/LiteFilterBar.tsx` and `.test.tsx` - filter bar component, golden and behavior tests
- `packages/app/src/hooks/useLiteViewState.ts` and `.test.ts` - view-state reducer hook and its tests

## Decisions Made

See `key-decisions` above. The two worth remembering: the normalizer reads live DOM properties for `select`/`input` state, and `LiteFilterBar` receives `groupNames` because the model carries only `hasGroups`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Filter bar needs the group names for Expand All and Collapse All**
- **Found during:** Task 2
- **Issue:** The plan's props `{ model, search, actions, theme, onThemeChange }` give the component no way to call `expandAll(groupNames)` / `collapseAll(groupNames)`; `FilterBarModel` only has `hasGroups`, and core's `expandAllGroups` needs the names (Lite reads them from `CONFIG.DELIVERABLES` through `groupNamesOf`).
- **Fix:** Added a `groupNames: string[]` prop; the page that composes the view (02-15) passes `groupNamesOf(config.DELIVERABLES)`.
- **Files modified:** packages/app/src/components/lite/LiteFilterBar.tsx
- **Verification:** the group-controls test checks both buttons call the actions with the given names.
- **Committed in:** `992ae0e`

**2. [Rule 1 - Bug] Wrong expectation in my own RED test**
- **Found during:** Task 2 GREEN
- **Issue:** The results-line test guessed the scope label 'items'; the fixture's label is 'deliverables'.
- **Fix:** The test now overrides the counts to 1 of 1 (the case that proves there is no singular handling) and expects 'Showing 1 of 1 deliverables'. The component was not changed.
- **Files modified:** packages/app/src/components/lite/LiteFilterBar.test.tsx
- **Committed in:** `992ae0e`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test bug). **Impact on plan:** none on scope; the extra prop is required for the plan's own behavior list.

## TDD Gate Compliance

RED commit `97c1248` precedes GREEN `992ae0e`. The RED run used inert stubs so the tests failed on assertions (`expected 'all' to be '6mo'`, `expected [] to deeply equal ['Expand All', 'Collapse All']`, `expected '<div class="filter-bar"></div>' to be ...`) and not on a missing module; three tests that only assert the defaults and action identity passed vacuously. `workflow.tdd_mode` is off in this project. I tried `gsd_run check tdd-red-evidence` with Vitest's `tap` and `tap-flat` reporters; both were rejected as `invalid_record` ("Non-TAP data in report") because Vitest writes its multi-line assertion messages outside TAP's YAML block, so the machine verdict is unavailable and the semantic assessment above is the evidence.

## Issues Encountered

None.

## Known Stubs

None. The stub hook and component of commit `97c1248` were replaced in `992ae0e`.

## Threat Flags

None. T-02-22 (stored XSS through tenant strings) is mitigated in these components: every tenant string is JSX text or an attribute, and the only `dangerouslySetInnerHTML` is `RISK_ICON_SVG`, enforced by the Task 1 acceptance grep. T-02-23 (theme select value) is mitigated: options come from the model's `themeOptions` (core `THEMES`) and `onThemeChange` receives only those values; the page applies `normalizeTheme` in 02-15.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 02-13 (timeline component, on `liteModelFor` and `normalizeMarkup`) and 02-17 (export controls and footer, whose Lite HTML `liteModelFor` already returns). Two things later plans should know: a `filter` patch passed to `liteModelFor` must be complete, and the golden test proves structure, not pixels, so the first rendering comparison is 02-17.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED

All eight source and test files exist; commits 1cd15a5, 97c1248 and 992ae0e are on the branch; both tasks' acceptance greps re-run green; app tests (62), app typecheck and root `npm test` (504) pass.
