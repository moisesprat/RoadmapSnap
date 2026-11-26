---
phase: 02-shared-core-lite-identical-view
plan: 04
subsystem: shared-core
tags: [core, workflow, timeline, dependencies, lite-binding, tdd, oq1]

requires:
  - phase: 02-01
    provides: "@roadmapsnap/core workspace, dates.js, reserved timeline/workflow/dependencies modules, purity guard"
  - phase: 02-02
    provides: "Lite HTML snapshot harness and characterization tests (including the LEGACY OQ1 test)"
provides:
  - "packages/core/src/workflow.js: 17 explicit-argument exports plus typedefs WorkflowItem, Dependency, Deliverable, RoadmapConfig"
  - "packages/core/src/timeline.js: 9 exports plus typedef Month (month generation, zoom windows, header periods, positions)"
  - "packages/core/src/dependencies.js: 13 exports (graph, colors, red sets, effective at-risk) plus typedefs NormalizedDependency, DependencyEdge"
  - "js/core/workflow.js, timeline.js, dependencies.js reduced to bindings that read CONFIG, window and the clock only to supply arguments"
  - "js/roadmap.utils.js deleted"
affects: [02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 24500
  tasks: 3
  commits: 5
plan_head_before: 7cb70874bddfb465aad111a6ed4ed7c9eee116f4
plan_head_after: fc70279bdd485f73c6c9ca7cf2cfcb7f49b8e8ac

tech-stack:
  added: []
  patterns:
    - "Core function takes workflow, deliverables and today explicitly; the Lite binding supplies them from CONFIG and the clock"
    - "Binding default workflow when no CONFIG is loaded is normalizeWorkflow({}), which reproduces the old START..M3 hard-coding for tests that pass only overrides"
    - "Typedefs live once in workflow.js; other core modules reference them with inline import('./workflow.js').X types so index.js does not re-export duplicates"

key-files:
  created:
    - packages/core/tests/workflow.test.js
    - packages/core/tests/timeline.test.js
    - packages/core/tests/dependencies.test.js
  modified:
    - packages/core/src/workflow.js
    - packages/core/src/timeline.js
    - packages/core/src/dependencies.js
    - js/core/workflow.js
    - js/core/timeline.js
    - js/core/dependencies.js
    - js/app.js
    - tests/core/characterization.test.js
    - tests/fixtures/lite-html-snapshots.json
  deleted:
    - js/roadmap.utils.js

key-decisions:
  - "OQ1 applied: red sets and effective at-risk take the first and last milestone keys from the workflow (getFirstMilestoneKey, getLastMilestoneKey) instead of START and M3"
  - "D8 applied: one getMilestoneDate(source, key, firstKey) (key, then START alias for the first key, then startDate) is used for status and for dependency edge dates"
  - "D11 applied: getDependencyGraph uses the passed deliverables for outbound traversal; getOutboundDependencyNames and hasDependencies pass the default deliverables explicitly"
  - "Without a loaded CONFIG the dependency binding uses the default START..M3 workflow, so existing tests that call getEffectiveAtRiskSet with only an override keep their results"
  - "getAllDataSources stays Lite-only (not a core export); core functions take the deliverable list directly"

patterns-established:
  - "Tracer first: workflow went end to end (core, binding, tests, snapshots untouched) before timeline and dependencies were expanded"
  - "A characterization test that pins a behavior a later plan changes is flipped in the RED commit and keeps the old expectation in a comment"

requirements-completed: [CORE-01, VIEW-03, VIEW-04]

coverage:
  - id: D1
    description: "Workflow logic (states, milestones, status, next milestone, non-filterable groups, milestone date with the D8 order) is explicit-argument core code; js/core/workflow.js is a binding"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/workflow.test.js"
        status: pass
      - kind: unit
        ref: "tests/core/workflow.test.js (pre-existing, unedited)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Timeline math (parseMonthYear null on malformed, generateMonths [] on malformed bounds, zoom windows, header periods months/quarters/half-years, positions) is core code; js/roadmap.utils.js is deleted and js/core/timeline.js is a binding"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/timeline.test.js"
        status: pass
      - kind: integration
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dependency graph, colors and red sets are core code with workflow-derived first/last keys (OQ1) and the outbound override fix (D11); the only Lite output change is the documented minimal:riskOnly snapshot"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/tests/dependencies.test.js"
        status: pass
      - kind: unit
        ref: "tests/core/characterization.test.js#OQ1 derived keys"
        status: pass
      - kind: unit
        ref: "tests/ui/liteHtml.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Adjacency edges (VIEW-04): a milestone dated today counts as reached, a from-date equal to today is green, the first day of a month sits on that month's left boundary"
    requirement: VIEW-04
    verification:
      - kind: unit
        ref: "packages/core/tests/workflow.test.js#getCurrentStatus (adjacency)"
        status: pass
      - kind: unit
        ref: "packages/core/tests/dependencies.test.js#getDependencyColorForDates is green when the from-milestone is reached, including exactly today (adjacency)"
        status: pass
      - kind: unit
        ref: "packages/core/tests/timeline.test.js#calculatePosition (adjacency)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-26
status: complete
---

# Phase 02 Plan 04: Workflow, Timeline and Dependency Logic in Core Summary

**Workflow, timeline and dependency rules extracted into `@roadmapsnap/core` as explicit-argument functions with Lite bindings over them, red-dependency keys derived from the workflow (OQ1), the outbound-traversal override bug fixed (D11) and `js/roadmap.utils.js` deleted**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-26T07:50Z
- **Completed:** 2026-11-26T07:56Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 13 (3 new test files, 1 deleted)

## Accomplishments

- `packages/core` now owns the workflow, timeline and dependency rules; each function takes the workflow, the deliverables or today explicitly and the purity guard stays green (no CONFIG, window or clock read in `packages/core/src`).
- `js/core/workflow.js`, `timeline.js` and `dependencies.js` keep every name, signature, optional override and `window` shim, so all pre-existing tests in `tests/core` and `tests/state` pass unedited.
- The red-dependency sets and the effective at-risk set derive their keys from the workflow (resolved OQ1). The characterization test is flipped and renamed to "OQ1 derived keys:" with the old expectation kept in a comment.
- `getDependencyGraph(sourceName, deliverables)` uses the passed list for outbound traversal too (D11); one `getMilestoneDate(source, key, firstKey)` serves status and edge dates (D8).
- `js/roadmap.utils.js` and its import in `js/app.js` are gone; `js/core/timeline.js` already owned those window globals, and `npm run build` is green.

## Task Commits

1. **Task 1: Tracer, workflow into core** - `9016314` (feat)
2. **Task 2: Timeline math into core, utilities file deleted**
   - RED `8e74194` (test), GREEN `4c151ca` (feat)
3. **Task 3: Dependencies into core with derived keys**
   - RED `fa9bcee` (test), GREEN `fc70279` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan).

## TDD Gate Compliance

Tasks 2 and 3 followed RED then GREEN; no REFACTOR commit was needed.

- **Task 2 RED:** `packages/core/tests/timeline.test.js` (25 tests) run with `node --test --test-reporter=tap`: 25 fail, 0 pass. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` / `target_test_failed` for the target test "generateMonths(\"01/2025\", \"06/2026\") returns 18 months...". Semantic assessment: the target executed and failed with `TypeError: core.generateMonths is not a function`, because `packages/core/src/timeline.js` was still the reserved `export {}` stub. The tests import the module as a namespace (`import * as core`) so a missing export fails the test instead of a load error. This is a failure on the planned behavior's absence, not a syntax, fixture or zero-test fault.
- **Task 2 GREEN:** same file, 25 of 25 pass. One test-only adjustment in the GREEN commit: the file pins `process.env.TZ = 'UTC'` because Lite positions are local-time Date differences and a DST zone shifted the exact boundary value by a fraction of a percent (the Lite harness already pins UTC for the same reason).
- **Task 3 RED:** `packages/core/tests/dependencies.test.js` (26 tests): 26 fail, 0 pass; classifier `RED_EVIDENCE_OK` for "OQ1: with milestones START, A0..A5 the default from-key is A5 and the default to-key is START" (same `is not a function` reason). The flipped characterization test `OQ1 derived keys:` was committed in the same RED commit and failed on its own assertion (`[]` versus `['Q']`).
- **Task 3 GREEN:** 26 of 26 pass; characterization test passes.
- Task 1 is a tracer (not `tdd="true"`): core, tests and binding in one commit, with the existing workflow tests and snapshots untouched.

## Files Created/Modified

- `packages/core/src/workflow.js` - normalizeWorkflow, states/milestones lookups, first/last keys, non-filterable group rules, getMilestoneDate (D8), getNextMilestone, getCurrentStatus; typedefs WorkflowItem, Dependency, Deliverable, RoadmapConfig
- `packages/core/src/timeline.js` - parseMonthYear, getMonthName, generateMonths, generateVisibleMonthsForZoom, getHalfYearIndex, getTimelineHeaderPeriods, calculatePosition, isDateInRange, darkenColor
- `packages/core/src/dependencies.js` - dependency normalization and lookups, getDependencyGraph, getDependencyColorForDates, red sets, getEffectiveAtRiskSet
- `packages/core/tests/{workflow,timeline,dependencies}.test.js` - explicit-argument tests (32, 25, 26 tests) including adjacency edges, empty inputs, circular graphs, D8 and OQ1
- `js/core/{workflow,timeline,dependencies}.js` - bindings
- `js/app.js` - drops the `./roadmap.utils.js` import
- `js/roadmap.utils.js` - deleted
- `tests/core/characterization.test.js` - OQ1 test flipped and renamed
- `tests/fixtures/lite-html-snapshots.json` - one entry regenerated (below)

## OQ1 Snapshot Changes

`UPDATE_LITE_SNAPSHOTS=1` changed exactly one of the 18 entries; the other 17 are byte-identical.

| Snapshot key | Change | Reason (OQ1) |
|---|---|---|
| `minimal:riskOnly` | "Showing 1 of 2 items" became "Showing 2 of 2 items"; the group header went from "1 items" to "2 items"; a Task Alpha row (with its outbound dependency icon, "Blocks: Task Beta (M1 -> GO)") now appears | The minimal workflow ends at M1, not M3. The Alpha to Beta edge now reads Alpha M1 (01/06/2026) against Beta START (01/03/2026), unreached on 15/04/2026, so it is red and Alpha joins the red-endpoint set that the risk-only filter keeps. Before, the hard-coded M3 found no date and the edge was green. The at-risk counts do not change because Beta is already flagged `atRisk`. |

No other entry moved, so there is no change that OQ1 does not explain.

## Decisions Made

- Keys for the red sets come from the workflow, not from constants (OQ1); the old behavior is documented in the characterization test comment.
- Binding default workflow without CONFIG is `normalizeWorkflow({})` (START, M0..M3). That keeps `calculateStats(deliverables, workflow, today)` and the other no-CONFIG tests identical to before, since they never pass a workflow into `getEffectiveAtRiskSet`.
- `getAllDataSources` is not a core export; the core takes the deliverable list, and the Lite binding resolves override versus `CONFIG.DELIVERABLES`.
- Core typedefs are defined once in `workflow.js`; `dependencies.js` references them inline because a local `@typedef` alias is re-exported by the barrel and tsc rejects the duplicate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsc rejected duplicate typedef exports**
- **Found during:** Task 3 (core typecheck)
- **Issue:** `@typedef {import('./workflow.js').Deliverable} Deliverable` aliases in `dependencies.js` were re-exported by `index.js`, so `tsc` reported TS2308 for Deliverable, Dependency and WorkflowItem.
- **Fix:** Removed the aliases and used inline `import('./workflow.js').X` types.
- **Files modified:** `packages/core/src/dependencies.js`
- **Verification:** `npm run typecheck -w @roadmapsnap/core` exits 0.
- **Committed in:** `fc70279`

**2. [Rule 1 - Bug] DST made an exact timeline-position assertion machine dependent**
- **Found during:** Task 2 GREEN
- **Issue:** the adjacency test for `calculatePosition` failed (32.865 versus 32.877) in a DST zone because positions use local-time Date differences.
- **Fix:** pinned `process.env.TZ = 'UTC'` at the top of `packages/core/tests/timeline.test.js`, as the Lite harness does.
- **Files modified:** `packages/core/tests/timeline.test.js`
- **Verification:** 25 of 25 pass.
- **Committed in:** `4c151ca`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in the test)
**Impact on plan:** both were needed to keep the typecheck and the exact-value test green; no scope change.

## Issues Encountered

- The first Task 3 verify run showed only `minimal:riskOnly` failing, as the plan predicted for OQ1; it was reviewed line by line before regenerating.
- `gsd_run check tdd-red-evidence` refuses record paths outside the project, so the RED records were written inside `.planning/phases/...` temporarily and removed before committing.

## Known Stubs

None. The three reserved `export {}` modules this plan owned are now filled; the remaining reserved modules belong to later plans.

## Threat Flags

None. The plan's T-02-07 mitigation holds: the OQ1 behavior change is pinned by the renamed characterization test and the one changed snapshot is listed with its reason above. No new network, auth or file-access surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `filters`, `stats` and `viewModel` (02-05 onward) can import `getMilestoneDate`, `getCurrentStatus`, the red sets and `getEffectiveAtRiskSet` from `@roadmapsnap/core` and pass workflow and today explicitly.
- `calculateStats` still calls the binding's `getEffectiveAtRiskSet(allSources)` with CONFIG today (the LEGACY today-override test is flipped in 02-07, not here).
- Flagged assumption, unresolved: D8 adds the START alias to status computation. It changes Lite only when a workflow's first key is not START and a deliverable also has `milestones.START`; no committed sample has that shape, so it is flagged for review.
- `docs/phase0-window-audit.md` and `.planning/codebase/*.md` still mention `js/roadmap.utils.js` (historical); not edited here.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED

- All nine created/modified source and test files exist; `js/roadmap.utils.js` is absent; `js/app.js` has 0 references to it.
- Commits `9016314`, `8e74194`, `4c151ca`, `fa9bcee`, `fc70279` are ancestors of HEAD; `evaluation-scope` resolves all five on this branch.
- Acceptance criteria re-run: `tests/core/workflow.test.js`, `timeline.test.js`, `dependencies.test.js`, `dependencyColoring.test.js` unedited; `purity.test.js` passes; `'M3'` count in core dependencies is 0 and `getLastMilestoneKey(workflow)` count is 1; `OQ1 derived keys:` count 1, `LEGACY OQ1:` count 0.
- Plan verification: `npm test` 319 of 319, `liteHtml` and characterization 55 of 55, core typecheck, `npm run validate` and `npm run build` green.
