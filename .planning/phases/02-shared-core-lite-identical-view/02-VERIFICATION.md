---
phase: 02-shared-core-lite-identical-view
verified: 2026-11-27T20:45:00Z
status: gaps_found
score: 5/7 must-haves verified
covered_files:
  - ".github/workflows/api-ci.yml"
  - ".github/workflows/app-ci.yml"
  - ".github/workflows/ci.yml"
  - ".github/workflows/parity.yml"
  - ".planning/phases/02-shared-core-lite-identical-view/02-01-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-01-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-02-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-02-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-03-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-03-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-04-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-04-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-05-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-05-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-06-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-06-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-07-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-07-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-08-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-08-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-09-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-09-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-10-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-10-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-11-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-11-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-12-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-12-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-13-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-13-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-14-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-14-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-15-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-15-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-16-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-16-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-17-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-17-SUMMARY.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-18-PLAN.md"
  - ".planning/phases/02-shared-core-lite-identical-view/02-18-SUMMARY.md"
  - "css/roadmap.css"
  - "index.html"
  - "js/app.js"
  - "js/core/dependencies.js"
  - "js/core/stats.js"
  - "js/core/timeline.js"
  - "js/core/viewModel.js"
  - "js/core/workflow.js"
  - "js/export/csv.js"
  - "js/export/json.js"
  - "js/state/appState.js"
  - "js/ui/dashboard.js"
  - "js/ui/dependencyArrows.js"
  - "js/ui/exportControls.js"
  - "js/ui/filterBar.js"
  - "js/ui/grouping.js"
  - "js/ui/page.js"
  - "js/ui/timelineGrid.js"
  - "packages/api/Dockerfile"
  - "packages/api/src/lib/links.js"
  - "packages/api/src/lib/themes.js"
  - "packages/api/src/routes/auth.js"
  - "packages/api/src/routes/projects.js"
  - "packages/api/tests/auth.test.js"
  - "packages/api/tests/projects.test.js"
  - "packages/app/index.html"
  - "packages/app/parity-view.html"
  - "packages/app/parity.html"
  - "packages/app/src/api/client.test.ts"
  - "packages/app/src/api/client.ts"
  - "packages/app/src/components/layout/PageStates.tsx"
  - "packages/app/src/components/layout/SaasHeader.test.tsx"
  - "packages/app/src/components/layout/SaasHeader.tsx"
  - "packages/app/src/components/layout/UserMenu.tsx"
  - "packages/app/src/components/lite/LiteDashboard.test.tsx"
  - "packages/app/src/components/lite/LiteDashboard.tsx"
  - "packages/app/src/components/lite/LiteDependencyArrows.test.tsx"
  - "packages/app/src/components/lite/LiteDependencyArrows.tsx"
  - "packages/app/src/components/lite/LiteExportControls.test.tsx"
  - "packages/app/src/components/lite/LiteExportControls.tsx"
  - "packages/app/src/components/lite/LiteFilterBar.test.tsx"
  - "packages/app/src/components/lite/LiteFilterBar.tsx"
  - "packages/app/src/components/lite/LiteFooter.tsx"
  - "packages/app/src/components/lite/LiteRoadmapView.test.tsx"
  - "packages/app/src/components/lite/LiteRoadmapView.tsx"
  - "packages/app/src/components/lite/LiteTimelineGrid.test.tsx"
  - "packages/app/src/components/lite/LiteTimelineGrid.tsx"
  - "packages/app/src/components/lite/download.ts"
  - "packages/app/src/components/projects/DeleteProjectModal.tsx"
  - "packages/app/src/components/projects/ProjectFormModal.tsx"
  - "packages/app/src/components/projects/ProjectModals.test.tsx"
  - "packages/app/src/components/projects/ProjectsDialog.tsx"
  - "packages/app/src/hooks/useDocumentClick.ts"
  - "packages/app/src/hooks/useLiteViewState.test.ts"
  - "packages/app/src/hooks/useLiteViewState.ts"
  - "packages/app/src/hooks/useTheme.test.tsx"
  - "packages/app/src/hooks/useTheme.ts"
  - "packages/app/src/index.css"
  - "packages/app/src/main.tsx"
  - "packages/app/src/pages/DashboardPage.test.tsx"
  - "packages/app/src/pages/DashboardPage.tsx"
  - "packages/app/src/parity/main.tsx"
  - "packages/app/src/parity/view.tsx"
  - "packages/app/src/test/auth0Stub.tsx"
  - "packages/app/src/test/goldenMarkup.ts"
  - "packages/app/src/test/liteArrows.characterization.test.ts"
  - "packages/app/src/test/liteRenderer.ts"
  - "packages/app/src/test/pageIsolation.test.tsx"
  - "packages/app/src/test/prepaint.test.ts"
  - "packages/app/src/test/rectMock.ts"
  - "packages/app/src/test/setup.ts"
  - "packages/app/src/vite-env.d.ts"
  - "packages/app/tailwind.config.ts"
  - "packages/app/vite.config.ts"
  - "packages/core/src/adapter.js"
  - "packages/core/src/arrows.js"
  - "packages/core/src/dates.js"
  - "packages/core/src/defaults.js"
  - "packages/core/src/dependencies.js"
  - "packages/core/src/export.js"
  - "packages/core/src/filters.js"
  - "packages/core/src/index.js"
  - "packages/core/src/markup.js"
  - "packages/core/src/models.js"
  - "packages/core/src/stats.js"
  - "packages/core/src/themes.js"
  - "packages/core/src/timeline.js"
  - "packages/core/src/timelineModel.js"
  - "packages/core/src/viewModel.js"
  - "packages/core/src/viewState.js"
  - "packages/core/src/workflow.js"
  - "packages/core/tests/adapter.test.js"
  - "packages/core/tests/arrows.test.js"
  - "packages/core/tests/dates.test.js"
  - "packages/core/tests/dependencies.test.js"
  - "packages/core/tests/export.test.js"
  - "packages/core/tests/filters.test.js"
  - "packages/core/tests/markup.test.js"
  - "packages/core/tests/models.test.js"
  - "packages/core/tests/purity.test.js"
  - "packages/core/tests/stats.test.js"
  - "packages/core/tests/themes.test.js"
  - "packages/core/tests/timeline.test.js"
  - "packages/core/tests/timelineModel.test.js"
  - "packages/core/tests/viewModel.test.js"
  - "packages/core/tests/viewState.test.js"
  - "packages/core/tests/workflow.test.js"
  - "packages/parity/lib/compare.ts"
  - "packages/parity/lib/lite.ts"
  - "packages/parity/lib/saas.ts"
  - "packages/parity/lib/states.ts"
  - "packages/parity/playwright.config.ts"
  - "packages/parity/scripts/build-targets.mjs"
  - "packages/parity/scripts/docker-test.sh"
  - "packages/parity/scripts/static-server.mjs"
  - "packages/parity/tests/fonts.spec.ts"
  - "packages/parity/tests/interactions.spec.ts"
  - "packages/parity/tests/lite-vs-lite.spec.ts"
  - "packages/parity/tests/png.spec.ts"
  - "packages/parity/tests/saas-vs-lite.spec.ts"
  - "packages/parity/tests/view-vs-lite.spec.ts"
  - "packages/tokens/components.css"
  - "packages/tokens/lite.css"
  - "packages/tokens/tokens.css"
  - "packages/tokens/tokens.js"
  - "tests/core/characterization.test.js"
  - "tests/fixtures/config.complex.js"
  - "tests/guards/ci-config.test.js"
  - "tests/guards/lite-isolation.test.js"
  - "tests/guards/no-app-lib.test.js"
  - "tests/guards/themes.test.js"
  - "tests/helpers/liteRender.js"
  - "tests/helpers/roadmapToApi.js"
  - "tests/ui/liteHtml.test.js"
covered_digest: "v3:sha256:8f13b27065bf9ecdbcfbc877bafba7261ed4404e15a99bd462321dbf56d0dbcc"
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "02-15 plan truth (D-03): the project create, edit and delete modals open from the header, and a successful mutation closes the dialog and refetches the roadmap"
    status: partial
    reason: "Create and edit work (user-verified at the 02-15 checkpoint). Delete does not: DELETE /projects/:id answers 204 with an empty body, ApiClient.request() ends with `return res.json()`, which rejects with 'Unexpected end of JSON input' on an empty body (reproduced in node). The server deletes the row, but the mutation rejects, onSuccess never runs, the dialog stays open with 'Could not delete the project. Try again.' and the ['workspace', id, 'projects'] query is not invalidated. A retry returns 404. ProjectModals.test.tsx stubs every response with `json: async () => r.body ?? {}`, so the 194 green app tests mask it. Predates the phase (request() unchanged on this line), but plan 02-15 re-asserted the delete path as a must-have and the phase surfaces it in the new header dialog."
    artifacts:
      - path: "packages/app/src/api/client.ts"
        issue: "line 166 `return res.json() as Promise<T>` runs for 204 responses"
      - path: "packages/app/src/components/projects/ProjectModals.test.tsx"
        issue: "fetch stub always returns a JSON body, so the 204 path is never exercised"
    missing:
      - "In ApiClient.request(), return undefined for status 204 (or content-length 0) before calling res.json()"
      - "Make the ProjectModals test stub return a real empty 204 Response for delete and assert the dialog closes and the projects query is invalidated"
behavior_unverified_items:
  - truth: "CI gate: the required `parity` check always reports a status and skips the heavy steps when a change cannot affect rendering (README-only PR)"
    test: "Open a README-only PR against main and read the Parity check"
    expected: "The Parity job starts, the Detect step prints 'No relevant files changed', the install, build and Playwright steps are skipped, and the check ends green so the ruleset does not leave it Pending"
    why_human: "The skip path executes only on a real runner against a real base commit. Locally I confirmed that the Detect regex classifies README.md, docs/ and packages/api/ paths as SKIP and packages/core/, js/ paths as RUN, and tests/guards/ci-config.test.js passes, but the conditional branch has never run on GitHub. A defect would block every docs-only PR now that `parity` is a required check (ruleset 28258544)."
---

# Phase 2: Shared Core & Lite-Identical View Verification Report

**Phase Goal:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite, driven by the same shared logic
**Verified:** 2026-11-27
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

The goal is achieved at the level the ROADMAP defines it: all five Success Criteria and all nine requirement IDs hold in the codebase. One plan-level truth (02-15, project delete from the new header dialog) fails against the real API, and one CI-behavior truth has not been exercised. Neither blocks the Lite-parity goal itself, but the delete failure is a real, reproducible defect in a surface this phase rebuilt, so the status is `gaps_found` rather than `passed`.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: Lite and SaaS compute timeline, workflow, dependencies, stats, filters and the view model from the single `packages/core`; `packages/app/src/lib` no longer exists | VERIFIED | `packages/core/src/` holds dates, timeline, timelineModel, workflow, dependencies, stats, filters, models, viewModel, viewState, arrows, export, themes, adapter. Lite `js/core/{timeline,stats,dependencies,workflow,viewModel}.js` are thin bindings (`import * as core from '@roadmapsnap/core'`; timeline.js is 80 lines). `ls packages/app/src/lib` fails (directory absent). `tests/guards/no-app-lib.test.js` passes in the 510/510 root run. App imports `@roadmapsnap/core` in 18 files (DashboardPage, LiteRoadmapView, LiteExportControls, hooks, client). |
| 2 | SC2: Lite unchanged (`npm test`, `validate`, `build` green) and CI runs Lite tests whenever shared code changes | VERIFIED | Re-run this session: `npm test` 510/510 (includes byte-exact Lite HTML snapshots and export snapshots), `npm run typecheck -w @roadmapsnap/core` clean, `npm run validate` "Config is valid", `npm run build` succeeds. `.github/workflows/ci.yml` has `on: push, pull_request, workflow_dispatch` with no `paths:` filter, so a `packages/core` change always runs the Lite tests; `gh pr checks 3` shows `ci` pass. |
| 3 | SC3: for the same data, SaaS timeline/Gantt, KPI dashboard and dependency arrows with tooltips and blocking detection are pixel-identical to Lite, by automated screenshot comparison | VERIFIED (tolerance noted) | `packages/parity` Playwright suite in the pinned image: Lite-vs-Lite baseline, SaaS-vs-Lite over 2 fixtures x 8 themes, and 8 interaction states (search, status, riskOnly, zoom6, collapsed, graphHover, scrolled), each with a negative control that proves a 1px change is detected. `comparePngs` fails above `MAX_DIFF_RATIO = 0.001` (0.1%), the locked D-08 tolerance for anti-aliasing, not literal zero. `gh pr checks 3` shows `parity` pass on a real runner (61/61 per orchestrator, container run 61/61). Arrow geometry, tooltips and blocking detection also covered by `LiteDependencyArrows.test.tsx` (22 tests) and `liteArrows.characterization.test.ts`. App vitest re-run: 194/194. |
| 4 | SC4: filter by name, status and risk, zoom 3/6/12 months or full range, switch among all eight Lite themes | VERIFIED | `buildFilterBarModel` (core `models.js`) emits zoom options `3mo, 6mo, 12mo, all` and `themeOptions` from `THEMES`, which lists exactly light, dark, professional, colorful, blank, monochrome, papallona, evergreen. `LiteFilterBar.tsx` renders them and `useLiteViewState` owns the state. API `PATCH /auth/me` validates the theme enum from the same `THEMES`. Parity covers all 8 themes and the search, status, risk, zoom and theme-switch paths. User manually confirmed theme switching incl. dark and persistence after a theme change. |
| 5 | SC5: user can export the roadmap to PNG, CSV and JSON | VERIFIED | `LiteExportControls.tsx` calls core `buildCsv` / `buildJson` for CSV and JSON and `html2canvas` (scale 2, Lite's options) for PNG (Full Roadmap and Summary Only). `packages/core/tests/export.test.js` plus `tests/fixtures/lite-export-snapshots.json` pin CSV/JSON bytes to Lite's. `png.spec.ts` downloads a PNG per theme in the parity suite. |
| 6 | 02-15 (D-03): the project create, edit and delete modals open from the header and a successful mutation closes the dialog and refetches the roadmap | FAILED for delete (create and edit verified) | See gap. Reproduced: `new Response(null,{status:204}).json()` rejects "Unexpected end of JSON input"; `projects.js:250` returns 204; `client.ts:166` calls `res.json()` unconditionally; `deleteProject` goes through `request()`. User verified Manage projects, Add project and a saved project appearing, but not delete. |
| 7 | The required `parity` check always reports and skips heavy steps when the change cannot affect rendering | PRESENT_BEHAVIOR_UNVERIFIED | Workflow has no path filter, a `Detect relevant changes` step gating every heavy step with the same `if:`, and an `if: always()` Report step. Ruleset `require-parity-on-main` (id 28258544) confirmed via `gh api`. The skip branch has not run on GitHub. See `behavior_unverified_items`. |

**Score:** 5/7 truths verified (1 present, behavior-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/*` (17 modules) | Shared pure rules | VERIFIED | Substantive (3500 lines across core + bindings), wired into Lite and app, `purity.test.js` guards no DOM/state reads. |
| `js/core/*.js`, `js/ui/*.js`, `js/export/*.js` | Lite bindings over core | VERIFIED | Import `@roadmapsnap/core`; Lite HTML snapshots byte-identical. |
| `packages/app/src/components/lite/*` | React render of Lite's markup | VERIFIED | `LiteRoadmapView` composes FilterBar, ExportControls, Dashboard, TimelineGrid, DependencyArrows, Footer from core models. |
| `packages/app/src/pages/DashboardPage.tsx` | Live API to `apiToRoadmap` to `LiteRoadmapView` | VERIFIED | Real `useWorkspaceProjects` query feeds `apiToRoadmap(projectsData, { today })`; loading, error, empty, no-workflow states handled. |
| `packages/parity/*` | Screenshot comparison harness | VERIFIED | Config, matrix, states, negative controls present; passing in CI. |
| `packages/app/src/lib/` | Removed | VERIFIED (absent as required) | Directory does not exist. |
| `packages/app/src/api/client.ts` | Typed client | PARTIAL | Works for JSON responses; breaks on 204 (gap). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `js/core/timeline.js` | `packages/core` | `import * as core` | WIRED | Delegates date and month math. |
| `DashboardPage` | core adapter | `apiToRoadmap` | WIRED | Result memoized and passed as `config`. |
| `LiteRoadmapView` | core models | `buildRoadmapModel`, `buildDashboardModel`, `buildFilterBarModel` | WIRED | |
| `LiteExportControls` | core export | `buildCsv`, `buildJson` | WIRED | |
| `API auth.js` | core themes | `THEMES` enum | WIRED | |
| `DeleteProjectModal` | projects list refresh | `useDeleteProject` onSuccess invalidation | NOT_WIRED on the real API | onSuccess never fires because `request()` rejects on 204. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `LiteRoadmapView` | `config` | `apiToRoadmap(projectsData)` from `GET /workspaces/:id/projects` | Yes (user saw a saved project in the timeline) | FLOWING |
| `LiteDashboard` | `dashboard` | `buildDashboardModel(roadmap)` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Lite + core suite | `npm test` | 510/510 | PASS |
| Core typecheck | `npm run typecheck -w @roadmapsnap/core` | clean | PASS |
| Config validation | `npm run validate` | valid | PASS |
| Lite build | `npm run build` | built | PASS |
| App suite | `npm test -w @roadmapsnap/app` | 194/194 | PASS |
| App typecheck | `npm run typecheck -w @roadmapsnap/app` | clean | PASS |
| 204 handling | node `new Response(null,{status:204}).json()` | rejects | FAIL (confirms gap) |
| Parity, API suite | not re-run (needs Docker and Postgres) | cited: container 61/61, GitHub `parity` pass, API 193/193 | cited |

### Probe Execution

SKIPPED: no `probe-*.sh` declared by the phase plans.

### Requirements Coverage

All nine IDs appear in PLAN frontmatter and map to Phase 2 in REQUIREMENTS.md. No orphaned requirements.

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| CORE-01 | 02-01, 02-02, 02-04, 02-07, 02-08, 02-10, 02-11 | Lite and SaaS share `packages/core` logic | SATISFIED | SC1 evidence. |
| CORE-02 | 02-14, 02-15, 02-16, 02-18 | `app/src/lib` duplicates removed | SATISFIED | Directory gone; `no-app-lib` guard passes. |
| CORE-03 | 02-01, 02-02, 02-03, 02-16 | Lite unchanged; CI runs Lite tests on shared changes | SATISFIED | Re-run green; `ci.yml` unfiltered. |
| VIEW-01 | 02-06, 02-09, 02-11, 02-13, 02-14, 02-16, 02-17 | Timeline pixel-identical to Lite | SATISFIED | Parity matrix, 0.1% D-08 tolerance. |
| VIEW-02 | 02-07, 02-10, 02-12, 02-14, 02-16, 02-17 | KPI dashboard identical | SATISFIED | Dashboard in parity regions and states. |
| VIEW-03 | 02-04, 02-11, 02-13, 02-16 | Dependency arrows, tooltips, blocking | SATISFIED | graphHover state, arrow tests. |
| VIEW-04 | 02-04, 02-07, 02-10, 02-12, 02-14, 02-16 | Filter and zoom as Lite | SATISFIED | Models and parity states. |
| VIEW-05 | 02-05, 02-09, 02-12, 02-14, 02-15, 02-16 | Eight themes | SATISFIED | `THEMES`, API enum, 8-theme matrix. |
| VIEW-06 | 02-08, 02-16, 02-17 | PNG, CSV, JSON export | SATISFIED | Export controls, snapshots, `png.spec.ts`. |

### Anti-Patterns Found

Scanned the 138 source files this phase changed (since `15479b2^`): no `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` or `PLACEHOLDER` markers; no debt-marker blocker.

### Open Code Review Findings, Weighed Against the Goal

The goal is Lite parity driven by shared logic, so each critical is judged by whether Lite and SaaS now disagree, and whether it is a SaaS-only defect.

| Finding | Verdict | Reasoning |
| ------- | ------- | --------- |
| CR-03 zoom month skip on days 29 to 31 | Not a gap | Identical code existed in Lite before the phase (`js/core/timeline.js` at `15479b2^` has the same `setMonth`/`new Date(..., today.getDate())` pattern). Lite and SaaS agree, which is the goal. It is a genuine bug in the canonical rule, but fixing it deliberately changes Lite output and needs its own change with new tests. Recommend a separate fix. |
| CR-01 group named `constructor` / `__proto__` / `toString` throws in `groupDeliverables` | Not a gap against the goal; recommend fixing soon | Reproduced in this session. The pre-phase Lite grouping has the same `groups[groupName]` pattern, so parity holds. It is Lite behavior, but in SaaS the input is editor-controlled, so one editor can blank the page for every viewer of a workspace (stored DoS). The fix is small (`Object.create(null)` or a `Map`, plus a core test) and does not change output for valid names, so it is safe to bundle with gap closure. |
| CR-02 delete 204 | Gap | See above. Plan 02-15 asserted the behavior as a must-have and tests masked it. |
| WR-01 to WR-09, IN-01 to IN-04 | Not gaps | Quality and hardening items; CSV formula injection is already tracked in `deferred-items.md` and accepted for this phase (T-02-16). Dispositions remain `open` in `02-REVIEW-DISPOSITION.md`. |

Other notes:
- D-08 sets a 0.1% pixel tolerance, so "pixel-identical" in the ROADMAP is met as "near-zero tolerance for anti-aliasing", which is the decision recorded in `02-CONTEXT.md`.
- The `parity` path filter excludes `packages/api/`. An API-only change cannot affect the parity render today, but a future API payload change feeding `apiToRoadmap` would not trigger parity.

### Human Verification Required

#### 1. README-only PR keeps the required Parity check green

**Test:** Open a README-only PR against main and read the Parity check.
**Expected:** Job starts, Detect step reports no relevant files, heavy steps skip, check ends green.
**Why human:** Needs a real runner and base commit; blocks docs-only merges if wrong.

### Gaps Summary

One gap blocks a clean pass: project delete from the new header dialog fails against the real API because the client parses an empty 204 body as JSON. Fix is a few lines in `ApiClient.request()` plus a realistic 204 test stub. Recommended to close alongside CR-01 (prototype-key group names), which is a small, output-neutral hardening that matters now that tenant data reaches core. CR-03 and the remaining review items are Lite-inherited or hardening and do not affect the phase goal. After the gap closure, the README-only PR check is the only remaining item, and the status would become `human_needed` until it is observed.

---

_Verified: 2026-11-27_
_Verifier: Claude (gsd-verifier)_
