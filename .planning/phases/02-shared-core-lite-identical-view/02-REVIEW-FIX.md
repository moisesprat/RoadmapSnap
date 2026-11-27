---
phase: 02-shared-core-lite-identical-view
fixed_at: 2026-11-27T21:00:00Z
review_path: .planning/phases/02-shared-core-lite-identical-view/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-11-27
**Source review:** .planning/phases/02-shared-core-lite-identical-view/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, CR-02, CR-03; WR-* and IN-* were out of scope for this run and stay open)
- Fixed: 3
- Skipped: 0

Each fix was written test-first: the new tests failed before the change (RED) and passed after it (GREEN).

## Fixed Issues

### CR-01: Group name equal to an Object.prototype key crashes the whole timeline

**Files modified:** `packages/core/src/timelineModel.js`, `packages/core/src/viewState.js`, `packages/core/tests/timelineModel.test.js`
**Commit:** e4aca35
**Applied fix:** `groupDeliverables` now builds `groups` with `Object.create(null)`, so `constructor`, `toString`, `valueOf`, `hasOwnProperty` and `__proto__` are ordinary groups. Checking sibling code in `packages/core` for the same pattern found two more places keyed by group name on plain objects, both of which misbehaved (did not throw) for those names: `state.groupCollapsed` read in `buildTimelineModel` and `toggleGroup` returned the inherited function (a truthy "collapsed" flag, so the group rendered collapsed and could not be toggled), and `collapseAllGroups`/`expandAllGroups` assigned through the `__proto__` setter, which silently drops the write. Both now read own properties only (`Object.hasOwn`) and write with spread/`Object.fromEntries`. `arrows.js` already guards its `rows` lookup with `hasOwnProperty`, `dependencies.js` uses `Map`/`Set`, and the workflow-key collisions in `stats.js` are WR-01 (workflow keys, not group or deliverable names), so they were left alone. Output for ordinary group names is unchanged.
**Tests added (3, in `packages/core/tests/timelineModel.test.js`):** `groupDeliverables` with all five names; `buildRoadmapModel` renders each as a normal, uncollapsed section; toggle/collapse-all/expand-all round-trip for each name.

### CR-02: Deleting a project always reports failure and never refreshes the list

**Files modified:** `packages/app/src/api/client.ts`, `packages/app/src/api/client.test.ts`, `packages/app/src/components/projects/ProjectModals.test.tsx`
**Commit:** 533b281
**Applied fix:** `ApiClient.request()` returns `undefined` for a 204 (or `content-length: 0`) response instead of calling `res.json()`. The check uses `res.headers?.get(...)` so the older hand-rolled fetch mocks that have no `headers` keep working. Other responses parse JSON exactly as before, and the error path is untouched.
**Tests added/changed:** `client.test.ts` gains three tests (204 resolves `undefined` and sends `DELETE`, a 200 body still parses, a 404 still throws `ApiError`). The `ProjectModals.test.tsx` fetch stub now returns real `Response` objects, so a 204 has the empty body of the real API. The delete test now uses a 204, asserts the dialog closes with no error alert, and asserts `invalidateQueries({ queryKey: ['workspace', id, 'projects'] })` ran, which is the refetch.

### CR-03: Zoom months skip a month and overshoot the end when today is on the 29th to 31st

**Files modified:** `packages/core/src/timeline.js`, `packages/core/tests/timeline.test.js`
**Commit:** 1e1bed4
**Applied fix:** `generateVisibleMonthsForZoom` adds the zoom months to the first of the month, clamps the end day to the target month's length, and starts the loop at the first of today's month (so `setMonth` can no longer overflow). The trailing `setDate(1)` is no longer needed. Lite delegates this function to core (`js/core/timeline.js`), so Lite and the SaaS app get the same correction. No existing Lite HTML snapshot changed and none was regenerated (the snapshots are pinned to 15/04, a day that was never affected).
**Tests added (6, in `packages/core/tests/timeline.test.js`):** today 31/01/2026, 30/01/2026, 29/01/2027 (non-leap) at zoom 3; 29, 30, 31 January 2028 at zoom 1 ending on 29 February (and 29/01/2027 clamping to 28 February); 31 August 2026 at zoom 6 and 12; and an exhaustive sweep of every start day of 2026 and 2028 at zoom 3, 6 and 12 checking consecutive months and the clamped last-month length.

## Verification

Gates ran in the main checkout (not a worktree: the project's gates need the installed `node_modules`, the dev servers and the Docker parity run use this tree, and the caller asked for commits directly on `chore/gsd-onboarding`). Results are reproducible from this checkout at HEAD `1e1bed4`.

| Gate | After CR-01 | After CR-02 | After CR-03 (final) |
|------|-------------|-------------|---------------------|
| `npm test` (root, incl. Lite HTML and export snapshot characterization) | 513 pass, 0 fail | 513 pass, 0 fail | 519 pass, 0 fail |
| `npm run validate` | valid | valid | valid |
| `npm run build` | ok | ok | ok |
| `npm run typecheck -w @roadmapsnap/core` | ok | ok | ok |
| `npm -w @roadmapsnap/app test` | 194 pass | 197 pass | 197 pass (15 files) |
| `npm -w @roadmapsnap/app run typecheck` | ok | ok | ok |

Baseline before any change: `npm test` 510 pass. Parity suite after all three fixes: `npm -w @roadmapsnap/parity run test:docker` gave 61 passed.

---

_Fixed: 2026-11-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
