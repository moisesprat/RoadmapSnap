---
phase: 02-shared-core-lite-identical-view
plan: 13
subsystem: ui
tags: [react, golden-markup, timeline-grid, dependency-arrows, svg-portal, tooltips, vitest, jsdom, tdd, tracer]

requires:
  - phase: 02-11
    provides: "core TimelineModel (roadmapModel.timeline), computeDependencyArrows, ARROW_MARKERS, ARROW_STROKE, the jsdom arrow characterization"
  - phase: 02-12
    provides: "normalizeMarkup, normalizeHtmlString, loadLiteRenderers, liteModelFor and useLiteViewState actions"
  - phase: 02-10
    provides: "GRAPH_OUTSIDE_CLICK_EXCLUSIONS, STATUS_OUTSIDE_CLICK_EXCLUSIONS, getDependencyGraph"
provides:
  - "LiteTimelineGrid: React render of core's TimelineModel with Lite's tag tree, classes, inline styles and title attributes"
  - "LiteDependencyArrows: arrow overlay measured in useLayoutEffect, drawn from core computeDependencyArrows, portaled into .roadmap-content"
  - "useDocumentClick: one document click listener for the component lifetime, latest handler kept in a ref"
  - "rectMock.installRectMock: shared deterministic getBoundingClientRect for jsdom arrow tests"
  - "liteModelFor now also returns Lite's timeline HTML (liteHtml.timeline)"
affects: [02-14, 02-15, 02-16, 02-17]

actuals:
  tokens: 11200
  tasks: 2
  commits: 3
plan_head_before: d37d81ef048c332c54ea02cdc00a5dd506124bda
plan_head_after: 0f96a07820305760a0aab7c8edb129b2ffc50ae7

tech-stack:
  added: []
  patterns:
    - "Golden markup extended to the timeline: the React render of core's TimelineModel equals Lite's renderTimelineGrid over both fixtures and six view states"
    - "Tooltip text (resolved OQ3) is asserted as the ordered list of [title] values plus every SVG <title> text, since native tooltips cannot be screenshotted"
    - "The arrow overlay measures after commit, stores the core result in state and renders it through a portal; core owns geometry, color, arrowhead and title"
    - "Overlay-owned side effects are reversible: .roadmap-content gets position: relative while the overlay is active and is reset on cleanup (Lite never needed this because it rebuilt the body)"

key-files:
  created:
    - packages/app/src/components/lite/LiteTimelineGrid.tsx
    - packages/app/src/components/lite/LiteTimelineGrid.test.tsx
    - packages/app/src/components/lite/LiteDependencyArrows.tsx
    - packages/app/src/components/lite/LiteDependencyArrows.test.tsx
    - packages/app/src/hooks/useDocumentClick.ts
    - packages/app/src/test/rectMock.ts
  modified:
    - packages/app/src/test/liteRenderer.ts
    - packages/app/src/test/liteArrows.characterization.test.ts

key-decisions:
  - "LiteDependencyArrows takes a months prop (TimelineModel.months) and builds the graph with core getDependencyGraph(graphName, deliverables); the plan's prop list had neither, but 02-11's real computeDependencyArrows signature needs months and an edge graph"
  - "The chevron and the three dependency icons are JSX svg elements, not strings: they live only in Lite's renderer (not in core), and the plan allows raw HTML only for core *_ICON_SVG constants; the golden test guards drift against Lite's path data"
  - "Two useDocumentClick registrations (status filters first, then graph), as Lite registers two listeners in that order, so each rule keeps its own lifetime and handler"
  - "The deterministic rectangle mock moved from the 02-11 characterization test into test/rectMock.ts (with an adjustable firstRowTop for resize tests) and both suites import it; the recorded lite-arrows.json is unchanged"
  - "The overlay renders whenever a graph is open or riskOnly is on, even with zero arrows (as Lite draws an SVG with only defs), and resets the container position on cleanup"
  - "Groups and dependency icons get role=button, tabIndex 0 and Enter/Space activation; the normalizer ignores role, tabindex and aria-*, so markup equality is unaffected"

patterns-established:
  - "A component that draws over React-owned DOM finds the container after commit with useLayoutEffect, never during render, and renders into it with createPortal"
  - "Test layout through one shared getBoundingClientRect mock so Lite's imperative draw and the React draw are compared on identical rectangles"

requirements-completed: [VIEW-01, VIEW-03]

coverage:
  - id: D1
    description: "LiteTimelineGrid renders core's TimelineModel with the same tag tree, classes, text, inline left/width styles and titles as Lite's renderTimelineGrid for both fixtures in the default, collapsed-group, active-graph, zoom 6mo, riskOnly and Gantt-off states"
    requirement: VIEW-01
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteTimelineGrid.test.tsx#LiteTimelineGrid golden markup (12 combinations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Row, gantt-bar, status-indicator and dependency-icon title attributes equal Lite's in value and order, multi-line gantt tooltips keep their newlines, and the overlay replaces the bars when the Gantt is off"
    requirement: VIEW-01
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteTimelineGrid.test.tsx#LiteTimelineGrid tooltips (OQ3) (8 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The .info-link href is the core safeLink: javascript:, data: and relative links render no anchor, an https link renders with target _blank, rel noopener noreferrer and title More info"
    requirement: VIEW-01
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteTimelineGrid.test.tsx#LiteTimelineGrid links (T-02-24)"
        status: pass
    human_judgment: false
  - id: D4
    description: "For identical mocked rectangles the normalized SVG of LiteDependencyArrows equals the SVG Lite's drawDependencyArrows builds (marker defs, paths, classes, hover paths, titles) for three graphs, a collapsed group, zoom 6mo and riskOnly; blocked, tight and reached edges carry the red, orange and green arrowheads"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDependencyArrows.test.tsx#LiteDependencyArrows equals Lite drawDependencyArrows (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Arrows draw only red edges with riskOnly and no graph, nothing otherwise, and .roadmap-content is positioned only while the overlay exists; hover widens the visible path to 3 and opacity 1 and restores 2 and 0.8"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDependencyArrows.test.tsx#LiteDependencyArrows visibility and hover (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Arrows re-measure on window resize and when layoutKey changes (and not when nothing changed); the resize listener is removed on unmount"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDependencyArrows.test.tsx#LiteDependencyArrows re-measure (3 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A document click outside GRAPH_OUTSIDE_CLICK_EXCLUSIONS closes the graph and one outside STATUS_OUTSIDE_CLICK_EXCLUSIONS clears the status filters; the two listeners register once on mount, survive re-renders, always call the latest handler and are removed on unmount"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteDependencyArrows.test.tsx#LiteDependencyArrows document clicks (7 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Pixel and real-layout look of the grid, the active-graph arrows and the hovered-arrow state against Lite under the real tokens CSS and a real browser layout"
    requirement: VIEW-01
    verification: []
    human_judgment: true
    rationale: "Golden markup and mocked rectangles prove structure, text and geometry from identical inputs, not real layout or rendering. The pixel comparison of the active-graph and hovered-arrow states is planned for 02-16 (plan objective, OQ3)."

duration: 7min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 13: React Timeline Grid and Dependency-Arrow Overlay Summary

**React `LiteTimelineGrid` renders core's TimelineModel and `LiteDependencyArrows` measures rows after commit and draws core's `computeDependencyArrows` result, both proven equal to Lite's own output (golden markup, tooltip text, and the arrow SVG on identical mocked rectangles), with Lite's two document-click rules in a `useDocumentClick` hook**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-26T16:34Z
- **Completed:** 2026-11-26T16:41Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 8 (6 new, 2 modified)

## Accomplishments

- `LiteTimelineGrid` mirrors `renderTimelineGrid` element for element: legend and range, header periods, today pointer, group headers with chevron and stats, source rows (risk indicator, name, info link, dependency icon, status indicator), track with grid lines, Gantt bars or the tooltip overlay, today line and milestone markers. A mutation check (renaming a class, the info-link title) turned 19 of 23 tests red, so the comparison is not vacuous.
- Tooltips are asserted as the ordered list of every `[title]` value, equal to Lite's for six states, with newlines preserved in multi-line Gantt tooltips. The `.info-link` exists only for core's `safeLink`; `javascript:`, `data:` and relative links produce no anchor and no trace in the HTML.
- `LiteDependencyArrows` measures the container, each `.data-source-row` and its `.timeline-track` in `useLayoutEffect` exactly as Lite does, calls core, and portals `svg#dependency-arrows-svg` (defs from `ARROW_MARKERS`, hover path, visible path, `<title>`, hover widths from `ARROW_STROKE`) into `.roadmap-content`. For six states its normalized SVG equals the SVG Lite's imperative `drawDependencyArrows` builds on the same mocked rectangles. Changing two marker/stroke attributes turned 6 of 22 tests red.
- The overlay re-measures on window resize and when `layoutKey` changes, sets `position: relative` only while active and resets it on cleanup.
- `useDocumentClick` adds one `click` listener per use for the component lifetime and calls the latest handler through a ref; the overlay uses it twice (status filters, then graph), matching Lite's two listeners.

## Task Commits

1. **Task 1: Tracer, timeline grid from core `TimelineModel`** - `cb876ad` (feat)
   - Tracer gate: `<verify>` (grid tests plus app typecheck) re-run end to end after the acceptance greps, green; `⚡ Tracer verified end-to-end — expanding`.
2. **Task 2: Dependency-arrow overlay** (TDD)
   - RED `d7b4358` (test: 19 of 22 new tests fail on their assertions against inert stubs of the component and the hook)
   - GREEN `0f96a07` (feat)
   - REFACTOR: none needed.

**Plan metadata:** the docs commits that follow this summary.

## Files Created/Modified

- `packages/app/src/components/lite/LiteTimelineGrid.tsx` and `.test.tsx` - grid component, golden, tooltip, link and interaction tests (23)
- `packages/app/src/components/lite/LiteDependencyArrows.tsx` and `.test.tsx` - overlay component and its tests (22)
- `packages/app/src/hooks/useDocumentClick.ts` - single-listener document click hook
- `packages/app/src/test/rectMock.ts` - shared jsdom layout mock (`installRectMock`)
- `packages/app/src/test/liteRenderer.ts` - `liteHtml.timeline` added
- `packages/app/src/test/liteArrows.characterization.test.ts` - imports the shared mock instead of defining it (recorded SVGs unchanged)

## Decisions Made

See `key-decisions` above. The two worth remembering: the overlay takes `months` because 02-11's real core signature needs it, and the chevron and dependency icons are JSX svg elements because only core `*_ICON_SVG` constants may be raw HTML.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Overlay needs the months (and builds the graph itself)**
- **Found during:** Task 2
- **Issue:** The plan's prop list for `LiteDependencyArrows` (`graphName, riskOnly, deliverables, workflow, today, layoutKey, ...`) lacks the months, which 02-11's `computeDependencyArrows` requires (the dispatch note states the same), and core takes a graph object rather than a name.
- **Fix:** Added a `months: Month[]` prop (the page passes `roadmapModel.timeline.months`) and the component calls core `getDependencyGraph(graphName, deliverables)`.
- **Files modified:** packages/app/src/components/lite/LiteDependencyArrows.tsx
- **Verification:** the six SVG equality tests pass.
- **Committed in:** `0f96a07` (stubbed with the prop in `d7b4358`)

**2. [Rule 3 - Blocking] Chevron and dependency icons are not core constants**
- **Found during:** Task 1
- **Issue:** Lite defines the chevron and the inbound, outbound and both icons locally in `js/ui/timelineGrid.js`; core has no constant for them, yet the plan's acceptance criterion allows `dangerouslySetInnerHTML` only with `_ICON_SVG` values.
- **Fix:** They are JSX svg elements with Lite's path data; the golden test compares them with Lite's markup. Moving them to core would have changed Lite files outside this plan.
- **Files modified:** packages/app/src/components/lite/LiteTimelineGrid.tsx
- **Verification:** acceptance grep prints 0; golden tests pass for all states with dependency icons.
- **Committed in:** `cb876ad`

**3. [Scope addition] Shared rectangle mock**
- The plan says to "reuse the same mock function"; it was local to the 02-11 test, so it moved to `test/rectMock.ts` (with a `firstRowTop` knob for the resize tests) and the characterization test imports it. The recorded `lite-arrows.json` is byte-identical (`git diff --exit-code` exits 0) and its 15 tests pass.
- **Committed in:** `d7b4358`

---

**Total deviations:** 2 auto-fixed (2 blocking), 1 scope addition. **Impact on plan:** none on behavior; one extra prop (`months`) that 02-15 must pass.

## TDD Gate Compliance

RED commit `d7b4358` precedes GREEN `0f96a07`. The RED run used inert stubs (the component returned null, the hook did nothing), so 19 of 22 tests failed on assertions (`expected null not to be null`, `expected "spy" to be called 1 times, but got 0 times`, `expected +0 to be 2`) and not on a missing module; the three that passed assert absence (no SVG with neither graph nor riskOnly) and so pass vacuously on the stub. `workflow.tdd_mode` is off in this project, and as in 02-12 the Vitest TAP reporters are not accepted by `gsd_run check tdd-red-evidence`, so the semantic assessment above is the RED evidence. One GREEN iteration: the first implementation used a single document listener for both rules and the listener-count test expected two; the implementation was changed to two `useDocumentClick` uses (the plan and Lite register two), not the test.

## Issues Encountered

None.

## Known Stubs

None. The stub component and hook of `d7b4358` were replaced in `0f96a07`.

## Threat Flags

None. T-02-24 is mitigated: the anchor's `href` is core `safeLink` only, and a test with `javascript:`, `data:` and a relative link finds no `.info-link` and no such string in the HTML. T-02-25 is mitigated: titles, SVG `<title>` and path data are JSX attributes or text, the only `dangerouslySetInnerHTML` values are core `INFO_ICON_SVG` and `RISK_ICON_SVG` (acceptance grep prints 0 for any other).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 02-14 and 02-15 (page composition): pass `roadmapModel.timeline` to `LiteTimelineGrid` with `toggleGroup` and `toggleGraph` from `useLiteViewState` (the graph action needs `groupNamesForNodes(getDependencyGraph(name, deliverables).nodes, deliverables)`), and render `LiteDependencyArrows` as a sibling with `graphName`, `riskOnly`, `deliverables`, `workflow`, `today`, `months`, a `layoutKey` that includes zoom, sort, filter and collapsed groups, `closeGraph` and `clearStatusFilters`. The golden tests prove structure, text and geometry from identical inputs, not real browser layout; the first pixel comparison (active graph, hovered arrow) is 02-16.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED

All six new and two modified files exist; commits cb876ad, d7b4358 and 0f96a07 are on the branch; both tasks' acceptance greps re-run green (`safeLink` 2, `row.link` 0, non-icon `dangerouslySetInnerHTML` 0, `computeDependencyArrows(` 1, `useLayoutEffect` 3, color words 0); app tests (107), root `npm test` (504), app typecheck and core typecheck pass after the last commit.
