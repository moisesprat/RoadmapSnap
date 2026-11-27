---
phase: 02-shared-core-lite-identical-view
plan: 18
subsystem: ui
tags: [deletion, cleanup, react, core-02, tracer]

requires:
  - phase: 02-14
    provides: "DashboardPage rewritten onto components/lite and @roadmapsnap/core, so nothing imports the old views or lib modules"
  - phase: 02-15
    provides: "removal of AppShell, ThemeToggle and lib/themeStorage, so packages/app/src/lib could disappear entirely"
provides:
  - "The superseded React timeline, KPI, progress and project-list views are deleted"
  - "The six duplicated packages/app/src/lib logic modules are deleted; the directory no longer exists"
affects: [02-16]

requirements-completed: [CORE-02]

actuals:
  tokens: 28300
  tasks: 3
  commits: 3
plan_head_before: 918ef2ced8fce8a1d4238d540605462e472e5967
plan_head_after: 346348a1a3fb67ad3bd178afb395f4e0b50564da

tech-stack:
  added: []
  patterns:
    - "Deletion-only plan: components deleted before the lib modules they import, so every intermediate state type-checks, tests and builds"

key-files:
  created: []
  modified: []
  deleted:
    - packages/app/src/components/timeline/ (8 files)
    - packages/app/src/components/dashboard/KpiCards.tsx
    - packages/app/src/components/dashboard/ProgressBar.tsx
    - packages/app/src/components/projects/ProjectList.tsx
    - packages/app/src/lib/dependencyGraph.ts
    - packages/app/src/lib/export.ts
    - packages/app/src/lib/projectFilters.ts
    - packages/app/src/lib/stats.ts
    - packages/app/src/lib/timeline.ts
    - packages/app/src/lib/timelineSort.ts

key-decisions:
  - "No decisions beyond the plan: deletion order was components first, then lib modules."

duration: 1 min
completed: 2026-11-27
status: complete
---

# Phase 2 Plan 18: Delete the superseded React views and duplicated lib modules Summary

17 files and 2989 lines of the old React re-implementation (timeline, KPI cards, progress bar, project list and six duplicated logic modules) are removed, so roadmap rules now live only in `@roadmapsnap/core` (CORE-02).

## Performance

- **Duration:** 1 min (2026-11-27T19:10Z to 19:11Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files deleted:** 17

## Accomplishments

- Task 1 (tracer): the eight files under `components/timeline` were removed with the app typecheck, 194 tests and Vite build green; the tracer verify passed, so expansion continued.
- Task 2: `KpiCards`, `ProgressBar` and `ProjectList` removed; `components/dashboard` is gone, and `ProjectFormModal` and `DeleteProjectModal` are untouched.
- Task 3: the six `lib` modules removed. 02-15 had already deleted `themeStorage.ts`, so `packages/app/src/lib` no longer exists, which is what 02-16's no-app-lib guard asserts.

## Task Commits

1. Task 1: delete the timeline view family - `d9f440f`
2. Task 2: delete KPI, progress and project list views - `5f8f65a`
3. Task 3: delete the six duplicated lib modules - `346348a`

## Verification

- Pre-deletion grep showed no importer outside the deleted files for any of the three groups.
- After each task: `npm -w @roadmapsnap/app run typecheck`, `npm -w @roadmapsnap/app test` (15 files, 194 tests passed) and, for Tasks 1 and 3, `npm -w @roadmapsnap/app run build` all passed.
- All acceptance criteria passed: `components/timeline`, `components/dashboard` and `lib` are absent from disk and from `git ls-files`; the two project modals still exist.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None. No code was authored.

## Threat Flags

None. T-02-36 is mitigated: the second implementation is deleted and tsc proved nothing imports it.

## Next Phase Readiness

Ready for 02-16 (guards and full-area parity). `packages/app/src/lib` is already absent.

## Self-Check: PASSED

- Commits `d9f440f`, `5f8f65a`, `346348a` exist on the branch.
- All 17 listed paths are absent; `packages/app/src/lib` does not exist.
