---
phase: 02-shared-core-lite-identical-view
plan: 02
subsystem: lite-characterization
tags: [node-test, snapshot, characterization, fixtures, lite]

requires:
  - phase: 02-01
    provides: "@roadmapsnap/core workspace; Lite js/core/timeline.js already bound to core dates"
provides:
  - "js/ui/page.js: renderPageHTML(state) and renderFooter(), the single Lite page composer used by js/app.js and by Node tests"
  - "tests/helpers/liteRender.js: loadLite() and renderLiteHTML(config, statePatch, { theme }) Node harness (window === globalThis, UTC-pinned)"
  - "tests/fixtures/lite-html-snapshots.json: 18 byte-exact page snapshots (minimal and complex fixtures, nine view states each); UPDATE_LITE_SNAPSHOTS=1 regenerates"
  - "tests/fixtures/config.complex.js: valid 13-deliverable synthetic parity fixture (complexWorkflow, complexDeliverables, complexConfig, complexConfigNonFilterable)"
  - "tests/core/characterization.test.js: 37 tests pinning untested Lite rules, with LEGACY OQ1 and LEGACY today-override markers"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-10, 02-11]

actuals:
  tokens: 139000
  tasks: 2
  commits: 3
plan_head_before: 0353df2526c7fc165467c32a23f86ea5e2cc1004
plan_head_after: e1825afb79da6021955703c219d57fb383fa018c

tech-stack:
  added: []
  patterns:
    - "Lite page HTML comes from one exported function so the browser and Node render the same string"
    - "Byte-exact HTML snapshots in one JSON file, rewritten only with UPDATE_LITE_SNAPSHOTS=1"
    - "Node harness for Lite pins process.env.TZ to UTC so DST never changes timeline positions"
    - "Characterization tests describe observed behavior and carry a LEGACY prefix when a later plan changes it on purpose"

key-files:
  created:
    - js/ui/page.js
    - tests/helpers/liteRender.js
    - tests/ui/liteHtml.test.js
    - tests/fixtures/lite-html-snapshots.json
    - tests/core/characterization.test.js
  modified:
    - js/app.js
    - tests/fixtures/config.complex.js

key-decisions:
  - "Harness imports js/app.js with a stub document instead of re-declaring escapeHtmlAttr, infoIconSVG and riskIconSVG, so the globals are the browser's own"
  - "Harness pins TZ to UTC: Lite positions come from local Date differences and a snapshot recorded in a DST zone failed under UTC (CI)"
  - "A deliverable with no milestone dates is { START: '' } in the fixture, because validateConfig rejects milestones: {} (first milestone key is required)"
  - "Characterize what Lite actually does for showInTimeline undefined: counted in visible and in hiddenByStatus"

patterns-established:
  - "UPDATE_LITE_SNAPSHOTS=1 node --test tests/ui/liteHtml.test.js regenerates snapshots; a plain run compares byte for byte and fails on a missing key"

requirements-completed: [CORE-01, CORE-03]

coverage:
  - id: D1
    description: "Lite page composition moved verbatim into js/ui/page.js (renderPageHTML, renderFooter); js/app.js renderRoadmap calls it; npm run build still bundles"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/ui/liteHtml.test.js (npm test: 235 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Byte-exact Lite HTML for minimal and complex fixtures across default, search, status, riskOnly, zoom 6mo, collapsed, active graph, sort-desc and monochrome states"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/ui/liteHtml.test.js (18 cases, identical under TZ=UTC, America/New_York, Pacific/Auckland); one-character mutation of a snapshot made the test exit 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "config.complex.js is non-empty, passes validateConfig with zero errors and covers the required shapes (groups, ungrouped, group outside GROUP_ORDER, descoped, at-risk, hidden, links, tags, long name, long state title, row with no dates, red/orange/green edges, 18-month range)"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "tests/core/characterization.test.js#validateConfig accepts the complex fixture with no errors"
        status: pass
      - kind: other
        ref: "node -e fixture shape check (>=12 rows, name >60, state title >40) exits 0; wc -c 5756"
        status: pass
    human_judgment: false
  - id: D4
    description: "Characterization of getUpcomingMilestones, filterDeliverables, filterBySearchOnly, sortDeliverables (all keys, both directions), buildDeliverableViewModel, red-dependency sets, effective at-risk KPIs and the showInTimeline-undefined quirk; passes against unrefactored code"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/core/characterization.test.js (37 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edge VIEW-04: stable sort for equal keys (both input orders, both directions) and non-ASCII case folding without normalization are pinned"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/core/characterization.test.js#sortDeliverables is stable and #search folds case with toLowerCase"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two named LEGACY tests record behavior later plans change deliberately (OQ1 hard-coded START/M3; calculateStats today override ignored for the red part)"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/core/characterization.test.js#LEGACY OQ1, #LEGACY today-override"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 02: Lite characterization Summary

**Lite's page HTML now comes from one exported `renderPageHTML(state)`, rendered in Node by a UTC-pinned harness and frozen byte for byte for two fixtures across nine view states, alongside a valid complex parity fixture and 37 characterization tests for previously untested Lite rules**

## Performance

- **Duration:** about 8 min (first task commit 07:41Z, last commit about 07:46Z)
- **Tasks:** 2
- **Files:** 5 created, 2 modified (`js/app.js`, `tests/fixtures/config.complex.js` from 0 bytes)

## Accomplishments

- `js/ui/page.js` holds `renderFooter()` and the page composition moved verbatim out of `renderRoadmap()`; `js/app.js` now does `document.body.innerHTML = renderPageHTML(state)` followed by the unchanged arrow draw or clear branch. The two unused named imports in `app.js` became side-effect imports so module load order is unchanged.
- The Node harness loads every Lite module (including `js/app.js` with a stub `document`) with `window === globalThis` and renders any config and state through `renderPageHTML`.
- `lite-html-snapshots.json` pins 18 pages. A plain run compares with `assert.equal` and fails on a missing key; mutating one character in a snapshot makes the suite fail.
- `config.complex.js`: 13 synthetic deliverables over Platform (4), Apps (4), Data (2), Ops (outside `GROUP_ORDER`), 2 ungrouped; one descoped, two at risk, one hidden; three https links; a 87-character name; a 49-character state title; a row with only START and a row with no dates; with TODAY 15/04/2026 the edges are red (Event Bus to Admin Portal), orange (Data Lake M1 to Mobile App M2, 7 days) and green; range 01/2025 to 06/2026 (18 months).
- Characterization covers upcoming milestones (null, `>=` today, non-filterable skip, effective at-risk flag), filter rules, all four sort keys in both directions plus stability, case folding on `Ärger Über Ölstand`, empty inputs, TODAY-equality in `getCurrentStatus`, first-of-month position, a full view-model deep-equal, red sets and stats.

## Task Commits

1. **Task 1: Tracer, renderPageHTML, Node harness, minimal snapshots** - `bb6eb8c` (feat)
2. **Task 1 fix: harness timezone pinned to UTC, snapshots regenerated** - `778f341` (fix)
3. **Task 2: complex fixture, complex snapshots, characterization tests** - `e1825af` (test)

**Plan metadata:** committed separately (docs: complete plan)

The tracer gate ran in `end-of-phase` mode with an automated-only `<verify>`: `node --test tests/ui/liteHtml.test.js && npm test` was re-run end to end and passed, so execution continued (no checkpoint).

## Files Created/Modified

- `js/ui/page.js` - `renderPageHTML`, `renderFooter`
- `js/app.js` - `renderRoadmap` calls `renderPageHTML(AppState.get())`
- `tests/helpers/liteRender.js` - `loadLite`, `renderLiteHTML`
- `tests/ui/liteHtml.test.js` - 18 snapshot cases
- `tests/fixtures/lite-html-snapshots.json` - recorded HTML
- `tests/fixtures/config.complex.js` - complex fixture
- `tests/core/characterization.test.js` - 37 characterization tests

## Decisions Made

- The harness imports `js/app.js` with a stub `document` (`addEventListener` no-op, theme attribute getter) rather than duplicating `escapeHtmlAttr`, `infoIconSVG` and `riskIconSVG`. The plan said to exclude `app.js`; importing it is safe because its top level only sets the theme attribute and registers a listener, and it keeps the globals identical to the browser.
- `process.env.TZ = 'UTC'` at the top of the harness (see deviation 1).
- Fixture "no milestone dates" row is `milestones: { START: '' }` (see deviation 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Snapshots depended on the machine time zone**
- **Found during:** Task 2 (cross-zone check of the Task 1 snapshots)
- **Issue:** Lite computes timeline positions from local-time `Date` differences, so DST shifts them by fractions of a percent. Snapshots recorded in a DST zone (CET) failed 8 of 9 under `TZ=UTC` and `TZ=Pacific/Auckland`; CI runs UTC.
- **Fix:** Pin `process.env.TZ = 'UTC'` in `tests/helpers/liteRender.js` and regenerate the minimal snapshots. All 18 snapshots and the 37 characterization tests now pass under UTC, America/New_York, Europe/Madrid and Pacific/Auckland.
- **Files modified:** `tests/helpers/liteRender.js`, `tests/fixtures/lite-html-snapshots.json`
- **Commit:** `778f341`

**2. [Rule 1 - Bug] Plan's `milestones: {}` row fails Lite validation**
- **Found during:** Task 2 (authoring the fixture)
- **Issue:** `validateConfig` requires the first milestone key (START) in every deliverable's `milestones`, so `milestones: {}` produces an error and contradicts "zero errors".
- **Fix:** The no-dates row uses `milestones: { START: '' }` (empty string passes the key check and `getMilestoneDate` treats it as no date). Documented in the fixture header.
- **Files modified:** `tests/fixtures/config.complex.js`
- **Commit:** `e1825af`

**3. [Plan wording corrected] showInTimeline-undefined quirk**
- **Found during:** Task 2
- **Issue:** The plan says such a row is "missing from visibleByStatus/hiddenByStatus". Lite actually counts it in `visible` (`!== false`) and in `hiddenByStatus` (truthiness check), so `visible` and the per-status split disagree.
- **Fix:** The test records the observed behavior (`visible` 2, `visibleByStatus.DSN` 1, `hiddenByStatus.DSN` 1). Later plans that port `calculateStats` should treat this as the value to reproduce or deliberately change.
- **Commit:** `e1825af`

---

**Total deviations:** 3 (2 auto-fixed bugs, 1 plan-wording correction)
**Impact on plan:** No scope change. The harness imports `app.js` (decision above) instead of excluding it.

## Issues Encountered

None beyond the deviations.

## Verification

- `node --test tests/core/characterization.test.js tests/ui/liteHtml.test.js`: 55 pass, 0 fail.
- `npm test`: 235 pass, 0 fail. `npm run validate`: config valid. `npm run build`: succeeds.
- `git diff --stat -- js/` after Task 2: empty (characterization only). Across the plan only `js/app.js` and `js/ui/page.js` changed under `js/`.
- Acceptance checks: `renderPageHTML(` appears once in `js/app.js`; `export { renderPageHTML, renderFooter }` once in `page.js`; every minimal snapshot contains `roadmap-export`; complex fixture 5756 bytes; one `LEGACY OQ1:` and one `LEGACY today-override:`.

## Known Stubs

None.

## Threat Flags

None. Fixture data is synthetic (T-02-03): no read of `js/config.js` or `js/config_*.js`, snapshots come only from the two committed fixtures. No package was installed (T-02-SC).

## Flagged for later plans

- `NON_FILTERABLE_GROUPS` and `startDate` are characterized on the Lite side only (`complexConfigNonFilterable`, inline cases) and excluded from the parity fixture, as planned.
- Sorting by name relies on `localeCompare`, so the name-sort expectations assume an English-like ICU locale (true in CI and in the default Node build).

## Next Phase Readiness

Ready for 02-03 onward. Any later change to `js/` or to core logic that Lite consumes can be checked with `npm test`: a byte difference in `lite-html-snapshots.json` or a changed characterization value means Lite's behavior moved. 02-04 flips `LEGACY OQ1:` and 02-07 flips `LEGACY today-override:`.

## Self-Check: PASSED

- FOUND: js/ui/page.js, tests/helpers/liteRender.js, tests/ui/liteHtml.test.js, tests/fixtures/lite-html-snapshots.json, tests/fixtures/config.complex.js, tests/core/characterization.test.js
- FOUND commits: bb6eb8c, 778f341, e1825af
