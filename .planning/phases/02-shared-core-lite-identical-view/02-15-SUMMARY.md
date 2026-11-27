---
phase: 02-shared-core-lite-identical-view
plan: 15
subsystem: ui
tags: [react, tailwind, saas-header, dialogs, theme, prepaint, css-isolation, sticky, tdd, tracer]

requires:
  - phase: 02-09
    provides: "tokens lite.css (.lite-area page rules, sticky filter bar) and the accent, on-accent and danger tokens"
  - phase: 02-14
    provides: "DashboardPage, LiteRoadmapView, useTheme, PageStates, Auth0TestProvider"
provides:
  - "SaasHeader (48px, non-sticky) with the Workspace select, Manage projects, Add project (editors and admins) and UserMenu; ProjectsDialog titled 'Projects ({n})' opening the existing form and delete modals"
  - "Project form and delete dialogs on the UI-SPEC copy, pending and failure states and token classes (accent, danger), no Cancel button"
  - "Blocking pre-paint script in packages/app/index.html that sets data-theme from roadmapsnap-theme (eight themes, dsm-firmenich to evergreen, light fallback), tested in node:vm against core THEMES"
  - "html.dark mechanism gone (themeStorage.ts, ThemeToggle.tsx, AppShell.tsx deleted); Tailwind darkMode selector on data-theme and preflight off"
  - "main.tsx imports @roadmapsnap/tokens/lite.css; index.css reduced to body margin 0 and padding 0 plus a zero-specificity chrome reset, so the Lite filter bar can stick"
affects: [02-16, 02-18]

actuals:
  tokens: 12700
  tasks: 3
  commits: 5
plan_head_before: 0709c330787d762dafdbc7c3e16848cb9e4fea34
plan_head_after: 2279a486aaa652606ccd51652446d50866f0afd0

tech-stack:
  added: []
  patterns:
    - "Chrome reset is scoped with :where(.saas-header, .saas-notice, .saas-state, dialog) so it has zero specificity and every Tailwind utility still wins; it restores box-sizing, border-style, heading margins and button/input fonts that preflight used to provide"
    - "Dialog errors come from the mutation state (role=alert with the fixed copy plus the API message), with onSuccess closing the dialog; no try/catch around mutateAsync"
    - "Static CSS guards: a test parses index.css and walks the rendered ancestors of .lite-area for overflow or transform, because jsdom cannot measure a sticky scroll"

key-files:
  created:
    - packages/app/src/components/layout/SaasHeader.tsx
    - packages/app/src/components/layout/SaasHeader.test.tsx
    - packages/app/src/components/layout/UserMenu.tsx
    - packages/app/src/components/projects/ProjectsDialog.tsx
    - packages/app/src/components/projects/ProjectModals.test.tsx
    - packages/app/src/test/prepaint.test.ts
    - packages/app/src/test/pageIsolation.test.tsx
  modified:
    - packages/app/src/pages/DashboardPage.tsx
    - packages/app/src/components/projects/ProjectFormModal.tsx
    - packages/app/src/components/projects/DeleteProjectModal.tsx
    - packages/app/src/components/layout/PageStates.tsx
    - packages/app/index.html
    - packages/app/src/main.tsx
    - packages/app/tailwind.config.ts
    - packages/app/src/index.css
    - packages/app/src/api/client.ts
    - packages/app/src/test/setup.ts
  deleted:
    - packages/app/src/components/layout/AppShell.tsx
    - packages/app/src/components/layout/ThemeToggle.tsx
    - packages/app/src/lib/themeStorage.ts

key-decisions:
  - "A successful create now closes the form dialog like an edit does (must_haves: a successful mutation closes the dialog and the roadmap refetches). The old keep-adding flow and its 'N projects added' counter are gone."
  - "index.css keeps only body margin 0 and padding 0 and the scoped chrome reset. Every other legacy rule went, not just the html.dark ones, because class rules such as .filter-bar { position: relative } restyled Lite's own classes and defeated position: sticky."
  - "The chrome reset uses :where() so its specificity is zero; utilities on chrome elements always win and the reset can never reach .lite-area."
  - "ProjectModals take ProjectRow (a project without milestones) so the raw API payload feeds them (Task 1)."

patterns-established:
  - "Page-state roots carry the saas-state class so the scoped reset covers them now that preflight is off"

requirements-completed: [CORE-02, VIEW-05]

coverage:
  - id: D1
    description: "The SaaS header sits above .lite-area with RoadmapSnap, the Workspace select, Manage projects, Add project (editor and admin only) and the account menu; the select reads 'No workspaces' and is disabled with zero workspaces; the projects dialog title shows the count"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "packages/app/src/components/layout/SaasHeader.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "The project form and delete dialogs follow the UI-SPEC copy: Discard changes and Keep project instead of Cancel, 'Enter a project name.' on blur, submit disabled for an empty Name, Adding/Saving/Deleting pending labels with both buttons disabled, failure alerts with the API message, Keep project focused first, danger fill"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "packages/app/src/components/projects/ProjectModals.test.tsx (13 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The index.html pre-paint script sets data-theme for all eight themes, maps dsm-firmenich to evergreen, falls back to light for unknown, empty, missing and throwing storage, runs before any stylesheet or module script, and its allowlist equals core THEMES"
    requirement: "VIEW-05"
    verification:
      - kind: unit
        ref: "packages/app/src/test/prepaint.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "html.dark, themeStorage.ts, ThemeToggle.tsx and AppShell.tsx are gone; Tailwind uses darkMode selector on data-theme and preflight off; index.css has no overflow, no html.dark and no rule on Lite classes; lite.css is imported after components.css; no ancestor of .lite-area has overflow or transform"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "packages/app/src/test/pageIsolation.test.tsx (9 tests)"
        status: pass
      - kind: other
        ref: "npm -w @roadmapsnap/app run build (built CSS holds .filter-bar position: sticky; top: 10px and body{margin:0;padding:0} with no overflow rule)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Lite filter bar sticks at 10px while the page scrolls in the running app, and the header, dialogs and chrome look right with preflight off"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout, so sticky and the visual result of disabling preflight cannot be asserted automatically; the user reported the bar not sticking at the Task 1 checkpoint and the cause (missing lite.css import, body overflow, a position: relative override) is fixed here, so the user must re-check in the running app"

duration: 6min (continuation; Task 1 time was not recorded by the first executor)
completed: 2026-11-27
status: complete
---

# Phase 2 Plan 15: SaaS header, project dialogs, pre-paint theme and CSS isolation Summary

**The SaaS page is now a thin header (workspace select, Manage projects, Add project, account menu) over the Lite area, with UI-SPEC project dialogs, a blocking pre-paint script that applies data-theme before first paint, the html.dark mechanism removed, Tailwind preflight off, and an app stylesheet that no longer restyles the Lite area or breaks its sticky filter bar.**

## Performance

- **Duration:** 6 min for this continuation (Tasks 2 and 3 and this summary); Task 1 was done by the previous executor and its time was not recorded
- **Started:** continuation at 2026-11-27T00:05Z (Task 1 committed 2026-11-26)
- **Completed:** 2026-11-27T00:12Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 20 under packages/app (three deleted)

## Accomplishments

- Tracer (Task 1): header, user menu and projects dialog outside the Lite area; the user confirmed that Manage projects opens "Projects (n)", Add project opens the form and a saved project appears in the timeline.
- Task 2: both dialogs match the UI-SPEC copy, pending and failure states and tokens; a create now closes the dialog.
- Task 3: the theme is applied before first paint; `html.dark`, `themeStorage.ts`, `ThemeToggle.tsx` and `AppShell.tsx` are gone; preflight is off with a zero-specificity chrome reset; `lite.css` is imported; `index.css` has no overflow and no rule on Lite classes.
- The tracked checkpoint failure (the Lite filter bar did not stick) has three causes, all fixed in Task 3: `main.tsx` did not import `lite.css`, so the sticky rule never loaded; `body { overflow-y: auto }` made body a scroll container; and `index.css` re-declared `.filter-bar { position: relative; z-index: 20 }`, which would override the sticky rule once `lite.css` was loaded.

## Task Commits

1. **Task 1: Tracer, header, account menu and projects dialog** - `ed3b520` (feat)
2. **Task 2: Project dialogs follow the UI-SPEC** - RED `dbe1f2a` (test), GREEN `a911bb0` (feat)
3. **Task 3: Pre-paint theme, html.dark removed, preflight off, Lite area isolated** - RED `9e548a2` (test), GREEN `2279a48` (feat)

**Plan metadata:** the docs commit following this summary.

## TDD notes

- Task 2 RED: 13 of 13 tests in `ProjectModals.test.tsx` failed on the planned assertions (heading 'Add Project' versus 'Add project', 'Done' and 'Cancel' buttons, no Discard changes, no Keep project, bg-risk fill). The machine classifier `gsd_run check tdd-red-evidence` returned `INVALID_RED / invalid_record` because Vitest's TAP reporter emits Testing Library's multi-line error messages unindented ("Non-TAP data in report"); it did not reach a verdict about the assertions. The semantic assessment was done by reading the report: every failure was an assertion about the new copy and states, with no import, syntax or fixture failure. Treat the RED evidence as manually assessed.
- Task 3 RED: 16 of 16 prepaint tests and 7 of 9 isolation tests failed on the planned assertions (no inline script, no lite.css import, body overflow, html.dark rules, preflight on). The two isolation tests that passed (the lite.css sticky rule and the ancestor walk) already held at HEAD by design and are regression guards.
- GREEN for both tasks passed the full app suite: 193 tests, typecheck and build green.

## Files Created/Modified

- `packages/app/src/components/layout/SaasHeader.tsx`, `UserMenu.tsx`, `components/projects/ProjectsDialog.tsx` - header, account menu and projects dialog (Task 1)
- `packages/app/src/components/projects/ProjectFormModal.tsx`, `DeleteProjectModal.tsx` - UI-SPEC copy, mutation-state errors, token classes (Task 2)
- `packages/app/src/components/projects/ProjectModals.test.tsx` - 13 tests for the dialog contract
- `packages/app/index.html` - blocking pre-paint script
- `packages/app/src/main.tsx` - drops the themeStorage pre-paint block, imports `lite.css` between components.css and index.css
- `packages/app/tailwind.config.ts` - `darkMode: ['selector', '[data-theme="dark"]']`, `corePlugins.preflight: false`
- `packages/app/src/index.css` - reduced from 376 lines to the body reset and the scoped chrome reset
- `packages/app/src/components/layout/PageStates.tsx` - `saas-state` class on the two page-state roots
- `packages/app/src/test/prepaint.test.ts`, `pageIsolation.test.tsx` - script and CSS guards
- Deleted: `AppShell.tsx` (Task 1), `ThemeToggle.tsx` and `lib/themeStorage.ts` (Task 3)

## Decisions Made

See `key-decisions` in the frontmatter. The two with user-visible effect are that a create now closes the dialog, and that the app stylesheet no longer carries any rule for classes the Lite area owns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The app stylesheet overrode Lite's sticky filter bar**
- **Found during:** Task 3 (from the Task 1 checkpoint failure)
- **Issue:** besides the missing `lite.css` import and the body overflow rules the plan lists, `index.css` re-declared `.filter-bar { position: relative; z-index: 20 }` and other Lite class names (`.export-btn`, `.progress-bar-container`, `.summary-dashboard`, and more), which would have overridden `lite.css` once imported.
- **Fix:** removed every legacy rule from `index.css`, not only the html.dark and floating-component rules the plan names. Only the body reset and the scoped chrome reset remain.
- **Files modified:** `packages/app/src/index.css`
- **Verification:** `pageIsolation.test.tsx` asserts no overflow, no html.dark and no Lite class selector in index.css; the built CSS holds `.filter-bar{...position:sticky;top:10px...}` and `body{margin:0;padding:0}`.
- **Committed in:** `2279a48`

**2. [Rule 3 - Blocking] Page states fell outside the scoped reset**
- **Found during:** Task 3
- **Issue:** the plan scopes the reset to `.saas-header, .saas-notice, dialog`, but the loading skeleton and the error, session, empty and workflow states (from 02-14) are none of those, and with preflight off their headings and buttons would lose margin, font and border resets.
- **Fix:** added a `saas-state` class to the two page-state roots in `PageStates.tsx` and to the reset selector; the reset uses `:where()` so it stays at zero specificity.
- **Files modified:** `packages/app/src/components/layout/PageStates.tsx`, `packages/app/src/index.css`
- **Verification:** `PageStates` and `DashboardPage` tests unchanged and green.
- **Committed in:** `2279a48`

**3. [Rule 2 - Missing critical] Automated guard for the sticky filter bar**
- **Found during:** Task 3 (requested with the checkpoint result)
- **Issue:** the failure was caught only by a human; nothing in the suite would catch a recurrence.
- **Fix:** added `src/test/pageIsolation.test.tsx`: index.css has no overflow, transform or containment on html, body, #root or .lite-area; `lite.css` is imported after components.css and before index.css; `lite.css` still declares `.filter-bar` sticky at `top: 10px`; no ancestor of the rendered `.lite-area` carries overflow or transform.
- **Files modified:** `packages/app/src/test/pageIsolation.test.tsx` (not in the plan's file list)
- **Committed in:** `9e548a2`, `2279a48`

**4. [Rule 4-adjacent, taken from the plan] A create now closes the dialog**
- **Found during:** Task 2
- **Issue:** the old form stayed open after a create and counted added projects; the must_haves say a successful mutation closes the dialog and refetches.
- **Fix:** both modes close on success and the counter is removed. Noted because it changes behavior that existed before this plan.
- **Files modified:** `packages/app/src/components/projects/ProjectFormModal.tsx`
- **Committed in:** `a911bb0`

---

**Total deviations:** 4 (1 bug, 1 blocking, 1 missing critical, 1 behavior change that the plan specifies)
**Impact on plan:** no scope creep beyond what the sticky failure and the preflight change required.

## Issues Encountered

- The checkpoint failure above (filter bar not sticking) is fixed in code and covered by structural tests, but jsdom cannot measure a sticky scroll. **The user must re-check in the running app:** scroll the page and confirm the filter bar sticks 10px from the top while the SaaS header scrolls away. The running Vite server hot-reloads, so no restart is needed.
- Turning preflight off also needs a visual look at the header, user menu, dialogs and page states, because the scoped reset replaces what preflight provided.
- `gsd_run check tdd-red-evidence` cannot parse Vitest's TAP output when Testing Library errors span lines (see TDD notes).

## Authentication Gates

None.

## Known Stubs

None. The stub scan of the files created or modified found no hardcoded empty values flowing to the UI, no placeholder copy and no unwired data sources.

## Threat Flags

None. T-02-29 (pre-paint allowlist) is covered by `prepaint.test.ts` including a throwing localStorage; T-02-30 (role gating) by the viewer tests in `SaasHeader.test.tsx`, with the API unchanged as the enforcement point.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-16 can assert that `packages/app/src/lib` no longer exists once 02-18 deletes the six remaining modules (`dependencyGraph`, `export`, `projectFilters`, `stats`, `timeline`, `timelineSort`); `themeStorage.ts` is already gone.
- `ProjectList.tsx` still imports the modals and still type-checks; 02-18 removes it.
- The user's re-check of the sticky filter bar and the preflight-off chrome is outstanding.

## Self-Check: PASSED

- Files: `SaasHeader.tsx`, `UserMenu.tsx`, `ProjectsDialog.tsx`, `ProjectModals.test.tsx`, `prepaint.test.ts` and `pageIsolation.test.tsx` exist; `AppShell.tsx`, `ThemeToggle.tsx` and `lib/themeStorage.ts` are absent.
- Commits `ed3b520`, `dbe1f2a`, `a911bb0`, `9e548a2` and `2279a48` are ancestors of HEAD; the ledger count from `0709c33` is 5.
- Acceptance criteria: `<SaasHeader` appears once in DashboardPage; no `sticky|fixed top` in SaasHeader; `Close projects dialog` once; no `>Cancel<` in either modal; `Discard changes` and `Keep project` present; `html.dark` 0 in index.css; `preflight: false` 1; `darkMode: ['selector'` 1; `overflow-(x|y)` 0; `roadmapsnap-theme` 1 in index.html.
- Plan verification: `npm -w @roadmapsnap/app test` 193 passed (15 files), `typecheck` and `build` green.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-27*

## Post-checkpoint fix (user re-check)

- **Add project hidden after a theme change.** Found by the user in the running app. `useTheme` (02-14) wrote the `PATCH /auth/me` answer (sub, email, name, preferences only) over the cached `['me']` record, dropping `role`, `orgId` and `orgs`; `useRole` then fell back to viewer. Fixed in `2ab2842` by merging only `preferences` into the cache, with a test that mocks the real PATCH shape (the old mock returned the full record). App suite 194/194, typecheck clean.
