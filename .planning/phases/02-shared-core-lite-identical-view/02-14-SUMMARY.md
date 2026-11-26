---
phase: 02-shared-core-lite-identical-view
plan: 14
subsystem: ui
tags: [react, tanstack-query, theme, parity, golden-markup, tdd, tracer, page-states]

requires:
  - phase: 02-05
    provides: "ApiClient updateMe and the API theme preference"
  - phase: 02-08
    provides: "roadmapToApi and canonicalRoadmap test helpers"
  - phase: 02-09
    provides: "tokens lite.css (.lite-area page rules)"
  - phase: 02-12
    provides: "LiteFilterBar, LiteDashboard, useLiteViewState, golden-markup helpers"
  - phase: 02-13
    provides: "LiteTimelineGrid and LiteDependencyArrows"
  - phase: 02-17
    provides: "parity preview, LiteExportControls, LiteFooter, view-vs-lite spec"
provides:
  - "LiteRoadmapView: the whole Lite area (filter bar, export controls, #roadmap-export with dashboard and timeline grid, dependency arrows, footers) from a RoadmapConfig, remounted by resetKey"
  - "DashboardPage rewritten on the raw ISO payload: useWorkspaces and useWorkspaceProjects, core apiToRoadmap, LiteRoadmapView, no AppShell, tabs or lib imports"
  - "useTheme: data-theme, roadmapsnap-theme cache, optimistic PATCH /auth/me, one-time server reconcile, 6 second save-failure notice"
  - "PageStates: LoadingSkeleton, LoadError, SessionExpired, NoWorkspaces, WorkflowNotConfigured, NoticeRegion"
  - "getWorkspaceProjects returns the raw API payload; ApiProject and ApiWorkspaceWithProjects exported"
  - "Auth0TestProvider test helper"
  - "The first full-area React-vs-Lite pixel check (minimal / light, 0.1% budget) in the pinned container"
affects: [02-15, 02-16, 02-18]

actuals:
  tokens: 17500
  tasks: 3
  commits: 5
plan_head_before: af42c1f5647bc0c07e75bcb6dc6824cb68fa2fa7
plan_head_after: 24c02b048791d0f183a72e40875227f45f6287a1

tech-stack:
  added: []
  patterns:
    - "A keyed inner component (LiteRoadmapArea key=resetKey) resets every piece of view state on a workspace switch without an effect-based reset"
    - "Page states are plain components returned before the Lite area; the notice region is one role=status aria-live=polite element above .lite-area that renders only when a notice exists"
    - "Skeleton pulse is Tailwind motion-safe:animate-[pulse_1.5s_ease-in-out_infinite], so prefers-reduced-motion: reduce disables it without new CSS"

key-files:
  created:
    - packages/app/src/components/lite/LiteRoadmapView.tsx
    - packages/app/src/components/lite/LiteRoadmapView.test.tsx
    - packages/app/src/components/layout/PageStates.tsx
    - packages/app/src/hooks/useTheme.ts
    - packages/app/src/hooks/useTheme.test.tsx
    - packages/app/src/pages/DashboardPage.test.tsx
    - packages/app/src/test/auth0Stub.tsx
  modified:
    - packages/app/src/pages/DashboardPage.tsx
    - packages/app/src/api/client.ts
    - packages/app/src/api/client.test.ts
    - packages/app/src/parity/view.tsx
    - packages/parity/tests/view-vs-lite.spec.ts

key-decisions:
  - "The Lite-side timeline hiding in view-vs-lite.spec.ts is removed: the preview now renders the timeline, so the region tests compare against Lite's full page (02-17 carry-forward resolved)."
  - "A workspace select labelled Workspace appears in DashboardPage only when more than one workspace exists. It is an interim switcher so switching and its view-state reset work now; 02-15's SaasHeader replaces it."
  - "useTheme treats a theme chosen before /auth/me arrives as newer than the record: the reconcile is skipped once the user has picked a theme."
  - "A workspace whose projects query never runs (non-UUID id) shows the load-error state rather than an endless skeleton."
  - "Workflow-not-configured is decided from the raw workspace.workflow_definition, because core apiToRoadmap falls back to the default workflow for an empty one."

patterns-established:
  - "DashboardPage tests stub fetch by path and render inside Auth0TestProvider and QueryClientProvider; fake only Date so TanStack Query and waitFor keep working"

requirements-completed: [CORE-02, VIEW-01, VIEW-02, VIEW-04, VIEW-05]

coverage:
  - id: D1
    description: "The dashboard page loads workspaces and projects through TanStack Query, converts the raw ISO payload with core apiToRoadmap and renders LiteRoadmapView in div.lite-area in Lite's order; the minimal fixture's .lite-area equals Lite's renderPageHTML"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "packages/app/src/pages/DashboardPage.test.tsx#DashboardPage golden page"
        status: pass
    human_judgment: false
  - id: D2
    description: "The whole React .lite-area of the minimal fixture under the light theme has Lite's body dimensions and differs in at most 0.1% of pixels, in the pinned container"
    requirement: "VIEW-01"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/view-vs-lite.spec.ts#the whole React Lite area matches Lite: minimal / light (npm -w @roadmapsnap/parity run test:docker)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getWorkspaceProjects returns ISO dates unchanged; the only ISO-to-Lite conversion is core apiToRoadmap"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "packages/app/src/api/client.test.ts#getWorkspaceProjects"
        status: pass
    human_judgment: false
  - id: D4
    description: "Theme change applies data-theme, writes roadmapsnap-theme and sends PATCH /auth/me optimistically; a failed PATCH keeps the theme and shows the notice for 6 seconds or until dismissed; a differing stored theme replaces the cache once with no PATCH"
    requirement: "VIEW-05"
    verification:
      - kind: unit
        ref: "packages/app/src/hooks/useTheme.test.tsx (11 tests); DashboardPage.test.tsx#DashboardPage theme and #DashboardPage notices"
        status: pass
    human_judgment: false
  - id: D5
    description: "Switching workspace resets filter, sort, zoom, collapsed groups and the dependency graph and keeps the theme"
    requirement: "VIEW-04"
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteRoadmapView.test.tsx#returns filter, sort, zoom and groups to their defaults; DashboardPage.test.tsx#DashboardPage workspace switching"
        status: pass
    human_judgment: false
  - id: D6
    description: "Loading skeleton (56, 240 and 320 px blocks, motion-safe pulse), load error with Retry loading, 401 session-expired with Sign in, no workspaces, zero projects (editor and viewer notices), workflow not configured, PNG failure notice, undated project parity, with no tenant domain in copy"
    requirement: "VIEW-02"
    verification:
      - kind: unit
        ref: "packages/app/src/pages/DashboardPage.test.tsx (loading, load errors, empty states, notices)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The page states and notices look right in a real browser (spacing, typography, pulse)"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout or CSS; the header, notice spacing and page CSS isolation land in 02-15 and are reviewed in its human-check"

duration: 15min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 14: Lite-identical view on live data Summary

**The SaaS dashboard page now renders the whole Lite area from live API data through core `apiToRoadmap` into `LiteRoadmapView`, with a persisted per-user theme and the UI-SPEC loading, error, empty and notice states, and the full React Lite area matches Lite's pixels in the pinned container.**

## Performance

- **Duration:** about 15 min (start time was not recorded; estimated from the first test run)
- **Completed:** 2026-11-26T16:57:00Z
- **Tasks:** 3
- **Files:** 12 changed, 5 commits

## Accomplishments

- `LiteRoadmapView` composes Lite's page in Lite's order inside `div.lite-area`, with `.filter-bar` a direct child, the dashboard and timeline grid inside `#roadmap-export`, the arrow overlay and the footers. It takes `months` from `roadmap.timeline.months` and `groupNames` from core `groupNamesOf`, and remounts on `resetKey`.
- `DashboardPage` fetches through the existing hooks and converts the raw payload with `apiToRoadmap(projectsData, { today })`. It imports nothing from `lib/` or the superseded components, and the Auth0 domain hint is gone.
- `getWorkspaceProjects` returns the raw ISO payload; the golden test proves the minimal fixture's `.lite-area` markup equals Lite's `renderPageHTML` end to end through mocked API responses.
- The 02-17 preview renders `LiteRoadmapView`. `view-vs-lite.spec.ts` passes 4 of 4 in the pinned image: both fixtures region by region against Lite's full page (the timeline-hiding workaround is removed), the new whole-area minimal / light test (Lite `body` against `.lite-area`, same dimensions, within 0.1%), and the negative control. The first run was already green, so no timeline-model or markup drift was found.
- `useTheme` owns the theme (cache, `data-theme`, optimistic PATCH, one-time reconcile, 6 second dismissable failure notice). `PageStates` covers every documented state.

## Task Commits

1. **Task 1 (tracer): live data into LiteRoadmapView, pixel-checked** - `901252d` (feat)
2. **Task 2 RED: failing tests for useTheme** - `b5cc2bf` (test)
3. **Task 2 GREEN: useTheme** - `e2fc884` (feat)
4. **Task 3 RED: failing tests for the page states** - `05a2f33` (test)
5. **Task 3 GREEN: PageStates and the page wiring** - `24c02b0` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## TDD Gate Compliance

Plan type is `execute`; Tasks 2 and 3 are `tdd="true"`. Both have a RED `test(02-14)` commit before the GREEN `feat(02-14)` commit, and REFACTOR was not needed.

- **Task 2 RED:** a behavior-free `useTheme` stub made the tests compile and fail on assertions (10 of 11 failed). `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target "setTheme applies data-theme, writes the cache and PATCHes the preference" (`expected 'light' to be 'papallona'`). Semantic assessment: the target ran and failed on the planned assertion, with no load or fixture fault. A first RED run was INVALID_RED because the Node global `localStorage` getter hid jsdom's; the test installs an in-memory store (as `liteRenderer.ts` does).
- **Task 3 RED:** 9 of 14 tests failed against the old page; the five that passed already characterize unchanged behavior (golden page, theme, undated project, workspace switch). `RED_EVIDENCE_OK` for "shows three fixed-height blocks that pulse only without reduced motion" (`expected [] to have a length of 3`). Semantic assessment: zero skeleton blocks rendered, the planned assertion. Reports whose failure messages carried multi-line DOM dumps are not valid TAP, so the evidence run targeted that single-line assertion with `-t`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fake-timer test created its timer before faking timers**
- **Found during:** Task 2 GREEN
- **Issue:** The 6 second notice test enabled fake timers after the real `setTimeout` was set, so the notice never cleared in the test.
- **Fix:** Fake only `setTimeout` and `clearTimeout` before the action and advance inside `act` with `advanceTimersByTimeAsync`.
- **Files modified:** `packages/app/src/hooks/useTheme.test.tsx`
- **Commit:** `e2fc884`

**2. [Rule 2 - Missing critical functionality] Interim workspace select**
- **Found during:** Task 1
- **Issue:** The plan removes AppShell (the only workspace switcher) and adds the header in 02-15, which would leave multi-workspace users unable to switch in the meantime, and the "switching workspace resets view state" truth untestable.
- **Fix:** `DashboardPage` renders a plain `<select aria-label="Workspace">` only when there is more than one workspace. 02-15's `SaasHeader` replaces it.
- **Files modified:** `packages/app/src/pages/DashboardPage.tsx`
- **Commit:** `901252d`, kept in `24c02b0`

**3. [Rule 2 - Missing critical functionality] Non-UUID workspace id never loads**
- **Found during:** Task 3
- **Issue:** `useWorkspaceProjects` is disabled for a non-UUID id, so the page would have rendered nothing or an endless skeleton.
- **Fix:** That case shows the load-error state with a retry.
- **Files modified:** `packages/app/src/pages/DashboardPage.tsx`
- **Commit:** `24c02b0`

**Added beyond the plan's file list (tests only):** `LiteRoadmapView.test.tsx`, which asserts the `resetKey` remount and Lite's child order directly, because the page-level switch test cannot tell a remount from the skeleton replacing the area.

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical). **Impact:** none on scope; the interim select is deleted by 02-15.

## Authentication Gates

None.

## Known Stubs

None. The interim workspace select is a working control, not a stub, and is replaced in 02-15.

## Issues Encountered

- Node 26's global `localStorage` getter yields undefined without a file, hiding jsdom's. `useTheme.test.tsx` installs an in-memory store; `DashboardPage.test.tsx` relies on the one `loadLiteRenderers` installs.
- `AppShell`, `ThemeToggle`, the old components and `lib/` modules are intentionally left unreferenced on disk (02-15 and 02-18 delete them); `main.tsx` still imports `lib/themeStorage` and the app's `index.css` does not yet import `lite.css`, so the live page is not styled like Lite until 02-15.

## Next Phase Readiness

Ready for 02-15 (SaasHeader, dialogs, `lite.css` import, pre-paint theme script, CSS isolation) and 02-18 (deletion of superseded files). Carry-forward for 02-15: the real page needs `html body { margin: 0; padding: 0 }` as in the parity preview, and it should delete the interim `Workspace` select in `DashboardPage.tsx` when `SaasHeader` takes over workspace selection.

## Self-Check: PASSED

- Created files present: `LiteRoadmapView.tsx`, `LiteRoadmapView.test.tsx`, `PageStates.tsx`, `useTheme.ts`, `useTheme.test.tsx`, `DashboardPage.test.tsx`, `auth0Stub.tsx` (verified with `[ -f ]`).
- Commits `901252d`, `b5cc2bf`, `e2fc884`, `05a2f33`, `24c02b0` are ancestors of HEAD.
- Acceptance greps: `apiToRoadmap(` in DashboardPage 1; `isoToLiteDate(date)` in client.ts 0; `className="lite-area"` 1; `<LiteRoadmapView` in view.tsx 1; `lib/` imports 0 in both files; `normalizeTheme` 4, `roadmapsnap-theme` 1, save-failure string in `useTheme.ts` 1; `Retry loading`, `No workspaces yet`, `aria-live="polite"` 1 each; `auth0.com|AUTH0_DOMAIN` in non-test TSX 0.
- Verification: `npm -w @roadmapsnap/app test` 143 passed in 11 files; `typecheck` and `build` clean; `npm -w @roadmapsnap/parity run test:docker -- tests/view-vs-lite.spec.ts` 4 passed.
