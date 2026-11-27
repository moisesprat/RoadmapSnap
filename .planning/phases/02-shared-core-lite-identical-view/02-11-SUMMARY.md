---
phase: 02-shared-core-lite-identical-view
plan: 11
subsystem: shared-core
tags: [core, timeline-model, dependency-arrows, lite-binding, jsdom-characterization, tdd, tracer]

requires:
  - phase: 02-10
    provides: "buildRoadmapModel and the viewState transitions (toggleGroup, expandAllGroups, collapseAllGroups, toggleDependencyGraph, closeDependencyGraph, GRAPH_OUTSIDE_CLICK_EXCLUSIONS)"
  - phase: 02-07
    provides: "buildDeliverableViewModel (gantt segments, milestone markers, dependency type and class)"
  - phase: 02-08
    provides: "safeHttpUrl and the markup constants"
  - phase: 02-04
    provides: "getDependencyGraph, getDependencyColorForDates, getMilestoneDate, getTimelineHeaderPeriods"
provides:
  - "packages/core/src/timelineModel.js: buildTimelineModel, groupDeliverables, hasAnyGroups, getGroupStats, groupNamesForNodes, groupNamesOf, typedef TimelineModel"
  - "packages/core/src/arrows.js: computeDependencyArrows, ARROW_MARKERS, ARROW_STROKE, typedefs ArrowRects and Arrow"
  - "buildRoadmapModel(...).timeline"
  - "Lite renderTimelineGrid(model), drawDependencyArrows and the group and graph handlers as DOM and markup layers over core"
  - "jsdom arrow characterization (seven recorded SVGs) plus handler tests"
affects: [02-12, 02-13, 02-14, 02-16]

actuals:
  tokens: 26000
  tasks: 3
  commits: 5
plan_head_before: 161e9d1a91f77c73c6cf61c4d6f3220ec4a87f18
plan_head_after: f713687dfd61a162f0366c5ec4f5eff569fc789c

tech-stack:
  added: []
  patterns:
    - "Arrow geometry is a pure function of rectangles measured by the caller; the caller owns measuring and drawing"
    - "Characterization before refactor: the SVG is recorded with mocked rectangles from the old code, then must stay byte-identical"
    - "Core models hold plain strings, numbers, booleans and arrays; Lite escapes at render time and React renders titles as text"
    - "Lite handlers are AppState.set(coreTransition(AppState.get(), ...))"

key-files:
  created:
    - packages/core/tests/timelineModel.test.js
    - packages/core/tests/arrows.test.js
    - packages/app/src/test/liteArrows.characterization.test.ts
    - packages/app/src/test/__fixtures__/lite-arrows.json
  modified:
    - packages/core/src/timelineModel.js
    - packages/core/src/arrows.js
    - packages/core/src/models.js
    - js/ui/timelineGrid.js
    - js/ui/grouping.js
    - js/ui/page.js
    - js/ui/dependencyArrows.js

key-decisions:
  - "computeDependencyArrows also takes the visible months, and rects.rows entries carry trackLeft and trackWidth; the plan's rects.milestones map is not used because Lite derives the arrow x from the milestone date's percent of the track (not from the marker, which the overlap rule can merge or hide), and byte-identical output requires the same rule"
  - "Rows of collapsed groups stay in the TimelineModel (section.collapsed carries the flag) and mappers decide to hide them; arrows skip any edge without a measured row, which is how collapsed groups drop out"
  - "Section stats are { count, atRisk } from raw s.atRisk (the plan's shape) while getGroupStats keeps Lite's { total, atRisk }"
  - "The model carries legend, rangeStart and rangeEnd so renderTimelineGrid no longer reads the workflow; the dependency icon SVG strings stay in the Lite renderer"
  - "Opening a dependency graph is one AppState.set (graph, expanded groups, cleared filters) instead of three sets, so Lite re-renders once"

patterns-established:
  - "Tracer: the timeline grid went end to end (core model, Lite renderer, 18 snapshots green) before the arrows were touched"
  - "Core tests compare geometry, marker and title against the SVG recorded from the old Lite code, so core and Lite cannot drift"

requirements-completed: [CORE-01, VIEW-01, VIEW-03]

coverage:
  - id: D1
    description: "buildTimelineModel carries every decision renderTimelineGrid and grouping.js made (header periods, grid lines, today, section order by GROUP_ORDER then alphabetical with ungrouped last, collapsed flags, group stats from raw atRisk, row classes, segments, markers, tooltips, status text, dependency icon and tooltip, risk flag, link and safeLink); Lite's renderTimelineGrid(model) only maps it to markup"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/timelineModel.test.js (18 tests)"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js (18 byte-exact page snapshots, unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeDependencyArrows returns each arrow's path, color, marker id, type and title from measured rectangles only, with Lite's curve, color and title rules and no DOM access in core"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/core/tests/arrows.test.js (18 tests, including six comparisons with the pre-refactor SVG recording)"
        status: pass
      - kind: unit
        ref: "packages/core/tests/purity.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lite's drawDependencyArrows measures the rows, calls computeDependencyArrows and builds the same SVG; the jsdom recording made before the refactor is unchanged"
    requirement: VIEW-01
    verification:
      - kind: automated_ui
        ref: "packages/app/src/test/liteArrows.characterization.test.ts (7 recorded SVGs, hover and positioning checks)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lite's group and dependency-graph handlers use the core transitions and GRAPH_OUTSIDE_CLICK_EXCLUSIONS"
    requirement: VIEW-01
    verification:
      - kind: automated_ui
        ref: "packages/app/src/test/liteArrows.characterization.test.ts#Lite group and dependency-graph handlers (4 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Blocking detection matches Lite on the complex fixture: unfinished and behind is red, reached is green, unfinished with a small positive buffer is orange"
    requirement: VIEW-03
    verification:
      - kind: unit
        ref: "packages/core/tests/arrows.test.js#blocking detection: an unfinished dependency behind its dependent is red, a reached one green, a tight unfinished one orange"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 11: Timeline Grid Model and Dependency Arrows in Core Summary

**Core now owns the timeline grid model (`buildTimelineModel`: grouping, rows, tooltips, safe links) and the dependency-arrow geometry, color and titles (`computeDependencyArrows` from measured rectangles), so Lite's timeline, grouping and arrow modules are markup and DOM layers; all 18 HTML snapshots and the pre-refactor jsdom arrow recording are byte-identical**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-26T16:19:30Z
- **Completed:** 2026-11-26T16:27:08Z
- **Tasks:** 3 (1 tracer, 1 TDD, 1 auto)
- **Files modified:** 11 (4 new)

## Accomplishments

- `buildTimelineModel(roadmapModel)` returns the header (column label, quarter and half-year header periods, grid-line percentages, today position, Gantt switch, legend, range labels) and the sections: groups ordered by `GROUP_ORDER` (groups missing from it alphabetically after, plain alphabetical without `GROUP_ORDER`), ungrouped rows last, each with its collapsed flag and `{ count, atRisk }` stats from the raw flag. A row holds the state index, class flags, gantt segments, milestone markers with display dates, the gantt tooltip, status short and title, the dependency icon (`type`, `active`, tooltip text), the effective at-risk flag, the raw `link` and `safeLink` (`safeHttpUrl`, null for `javascript:`). `buildRoadmapModel` now exposes it as `timeline`.
- `renderTimelineGrid(model)` is a mapper: it no longer reads `CONFIG` or `AppState` (`AppState.get()` outside comments: 3 before, 0 now) and `grouping.js` re-exports the three pure rules from core.
- `computeDependencyArrows({ graph, deliverables, workflow, today, months, rects, onlyRed })` moves the curve (straight under 5px, else a quadratic bulging right of the larger x), the red/orange/green rule (via `getDependencyColorForDates`), the arrowhead id and the title text out of `drawArrow`. Edges with an unmeasured row (collapsed group) or a milestone outside the visible months are skipped, as Lite did. `ARROW_MARKERS` and `ARROW_STROKE` hold the marker defs and the 2/0.8 and 3/1 hover widths.
- Lite's `drawDependencyArrows` measures the rows and tracks, calls core and builds the same SVG elements (marker defs, hover path, visible path, `<title>`, hover listeners, `container.style.position = 'relative'`).
- `toggleGroup`, `expandAllGroups`, `collapseAllGroups`, `expandGroupsForDependencyGraph`, `toggleDependencyGraph`, `closeDependencyGraph` and `clearDependencyGraphOnClickOutside` apply the 02-10 core transitions and `GRAPH_OUTSIDE_CLICK_EXCLUSIONS`.

## Task Commits

1. **Task 1: Tracer, timeline grid from core `buildTimelineModel`** - `c7416be` (feat)
   - Tracer gate: `<verify>` re-run end to end (timeline model test, snapshots, characterization, `npm test`) all green; expanded.
2. **Task 2: Arrows in core from measured rectangles** (TDD)
   - Characterization recorded from the old code first: `3b4973e` (test)
   - RED `1f56e8c` (test), GREEN `1252d04` (feat)
   - REFACTOR: none needed.
3. **Task 3: Group and graph handlers on core transitions** - `f713687` (refactor)

**Plan metadata:** the docs commits that follow this summary.

## Verification

- `node --test packages/core/tests/timelineModel.test.js` 18 pass; `arrows.test.js` 18 pass; purity test 6 pass.
- `node --test tests/ui/liteHtml.test.js tests/core/characterization.test.js` 55 pass; root `npm test` 504 pass, 0 fail.
- `npm -w @roadmapsnap/app test`: 24 pass (15 in the arrow suite, run via the filtered command too).
- `npm run typecheck -w @roadmapsnap/core` and `-w @roadmapsnap/app` clean; `npm run validate` and `npm run build` succeed.
- Acceptance: `git diff --exit-code -- tests/fixtures/lite-html-snapshots.json packages/app/src/test/__fixtures__/lite-arrows.json` exits 0; `buildTimelineModel(` in models.js = 1; `computeDependencyArrows(` in dependencyArrows.js = 1; `document|getBoundingClientRect` in core arrows.js = 0; `GRAPH_OUTSIDE_CLICK_EXCLUSIONS` in dependencyArrows.js = 2.

## TDD Gate Compliance

- **RED (Task 2):** `packages/core/tests/arrows.test.js`, 18 tests all discovered and failing because `computeDependencyArrows`, `ARROW_MARKERS` and `ARROW_STROKE` did not exist (the reserved module was empty): `Cannot read properties of undefined (reading 'map')` and `is not a function`. Evidence record classified `RED_EVIDENCE_OK` (`target_test_failed`, 18 tests, 0 pass, 18 fail). Semantic assessment: every target test ran and failed on the planned behavior being absent, not on a syntax, import or fixture fault (the suite imports the namespace so a missing export fails the test, not the load).
- **GREEN:** `1252d04`; 18 of 18 pass after fixing one wrong test expectation (see Deviations).
- **REFACTOR:** none.
- Gate commits: `test(02-11)` before `feat(02-11)` present for Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Arrow input needs the months and track fields**
- **Found during:** Task 2
- **Issue:** The plan's `rects.milestones[name][key]` (measured x) cannot reproduce Lite: its arrow x is the milestone date's percent of the track, and the marker the user sees may be merged or hidden by the overlap rule. The visibility test also needs the months.
- **Fix:** `computeDependencyArrows` takes `months`, and `rects.rows[name]` carries `trackLeft` and `trackWidth` (falling back to the row's own `left` and `width`). Core computes the x from the date and the measured track, with the same expression order as before, so the output is byte-identical.
- **Files modified:** packages/core/src/arrows.js, js/ui/dependencyArrows.js
- **Verification:** all seven recorded SVGs and the six core comparisons against them pass.
- **Committed in:** `1252d04`

**2. [Rule 2 - Missing Critical] Row lookup must ignore inherited properties**
- **Found during:** Task 2
- **Issue:** `rects.rows[name]` on a plain object returns a function for a deliverable named like an `Object.prototype` member (for example `constructor`), which would draw a bogus arrow.
- **Fix:** core uses `Object.prototype.hasOwnProperty.call`; Lite builds `rows` with `Object.create(null)`.
- **Files modified:** packages/core/src/arrows.js, js/ui/dependencyArrows.js
- **Committed in:** `1252d04`

**3. [Rule 1 - Bug] Wrong expectation in my own RED test**
- **Found during:** Task 2 GREEN
- **Issue:** The title test expected `01 May`; Lite's `formatDateDisplay` gives `1 May` (the recording agrees).
- **Fix:** corrected the test, the implementation was not bent to it.
- **Files modified:** packages/core/tests/arrows.test.js
- **Committed in:** `1252d04`

**4. [Rule 3 - Blocking] jsdom characterization needed environment shims**
- **Found during:** Task 2
- **Issue:** Node 26 defines a global `localStorage` getter that yields `undefined` and hides jsdom's, so `AppState` crashed at import; the app has no `@types/node`; `new URL(import.meta.url)` is jsdom's URL, which `fileURLToPath` rejects.
- **Fix:** the test installs an in-memory `localStorage`, reaches `process` and `node:fs` through `any` and a variable module name, and derives the fixture path from `import.meta.url` as a string. No package was installed.
- **Files modified:** packages/app/src/test/liteArrows.characterization.test.ts
- **Committed in:** `3b4973e`

**5. [Scope addition] Extra model fields and exports**
- `buildTimelineModel` also returns `legend`, `rangeStart` and `rangeEnd` (needed so the Lite renderer stops reading the workflow), and core exports `groupNamesOf` (every group, for the expand-all and collapse-all handlers). The arrow suite also gained four handler tests beyond the plan's two files' stated scope (same file).

---

**Total deviations:** 4 auto-fixed (1 blocking design, 1 missing-critical, 1 test bug, 1 blocking test environment), 1 scope addition. **Impact:** none on Lite output; the signature differs from the plan's in `months` and the track fields, which 02-13 should follow when it calls `computeDependencyArrows` from React.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None.

## Threat Flags

None. T-02-20 is mitigated as planned: arrow titles and timeline model fields are plain strings (core test passes `<b>"x"</b>` through unchanged), Lite sets the SVG title with `textContent` and escapes through `html`, and `safeLink` is computed in core and is null for `javascript:` links.

## Next Phase Readiness

Ready for 02-12 and 02-13: the React side can render `roadmapModel.timeline` and call `computeDependencyArrows` with rectangles it measures (pass `months` and, per row, `trackLeft` and `trackWidth`), using `ARROW_MARKERS` and `ARROW_STROKE` for the defs and hover. Lite is now fully a mapper over core for page, dashboard, filter bar, timeline and arrows.

## Self-Check: PASSED

All created and modified files exist; commits c7416be, 3b4973e, 1f56e8c, 1252d04 and f713687 are on the branch; acceptance criteria and plan-level verification re-run green after the last commit.
