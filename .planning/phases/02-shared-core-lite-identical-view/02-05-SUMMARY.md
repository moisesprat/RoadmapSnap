---
phase: 02-shared-core-lite-identical-view
plan: 05
subsystem: api
tags: [themes, core, fastify, ajv, xss, tdd, view-05]

requires:
  - phase: 02-01
    provides: "@roadmapsnap/core workspace with a reserved themes.js re-exported by the barrel, app typecheck that builds core types"
  - phase: 02-02
    provides: "tests/fixtures/lite-html-snapshots.json with Lite's rendered filter bar and theme select"
provides:
  - "packages/core/src/themes.js: THEMES (eight names, Lite order), THEME_LABELS, DEFAULT_THEME, LEGACY_THEME_ALIASES, normalizeTheme, typedef ThemeName"
  - "packages/api/src/lib/themes.js: API copy of THEMES used by the PATCH /auth/me schema enum and merged-preference guard"
  - "PATCH /auth/me persists all eight themes and rejects others with 400; GET /auth/me reads them back"
  - "UserPreferences.theme in the app client is the generated ThemeName union"
  - "tests/guards/themes.test.js: core, API and Lite theme select lists must be equal and in the same order"
  - "packages/api/src/lib/links.js isHttpUrl; POST and PATCH projects reject non-http(s) external_link with 400"
  - "VIEW-05 and ROADMAP Phase 2 criterion 4 list all eight themes"
affects: [02-08, 02-10, 02-13, 02-15]

actuals:
  tokens: 4200
  tasks: 3
  commits: 4
plan_head_before: c1e9e53788e54848539f1b3fdddc74969abd920e
plan_head_after: 4102a5f295f63bd5fd1d2152a9e2051e61425882

tech-stack:
  added: []
  patterns:
    - "API cannot import @roadmapsnap/core (image does not ship it), so shared constants are copied and a root guard test keeps the copies equal"
    - "Guard reads the rendered Lite snapshot rather than the template source, so it survives the option list moving into a model"
    - "Write-time http(s) allowlist for stored links, backed by render-time core safeHttpUrl in later plans"

key-files:
  created:
    - packages/core/tests/themes.test.js
    - packages/api/src/lib/themes.js
    - packages/api/src/lib/links.js
    - tests/guards/themes.test.js
  modified:
    - packages/core/src/themes.js
    - packages/api/src/routes/auth.js
    - packages/api/src/routes/projects.js
    - packages/api/tests/auth.test.js
    - packages/api/tests/projects.test.js
    - packages/app/src/api/client.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Ajv enum receives a spread copy ([...THEMES]) because the shared list is frozen"
  - "Merged-preference guard kept, now using THEMES, so it only repairs legacy stored values and never replaces a valid choice"
  - "PATCH projects validates external_link before the existence SELECT, so an invalid link returns 400 even for a missing project id"

patterns-established:
  - "Theme lists are copied, not imported, into the API and guarded by tests/guards/themes.test.js"

requirements-completed: [VIEW-05]

coverage:
  - id: D1
    description: "PATCH /auth/me persists each of the eight themes and GET /auth/me returns the same value"
    requirement: VIEW-05
    verification:
      - kind: integration
        ref: "packages/api/tests/auth.test.js#PATCH /auth/me persists each of the eight themes and GET /auth/me reads it back"
        status: pass
    human_judgment: false
  - id: D2
    description: "A theme outside the eight returns 400 with an { error, message } body and leaves the stored theme unchanged"
    requirement: VIEW-05
    verification:
      - kind: integration
        ref: "packages/api/tests/auth.test.js#PATCH /auth/me with a theme outside the eight returns 400 and keeps the stored theme"
        status: pass
    human_judgment: false
  - id: D3
    description: "Core exports THEMES, THEME_LABELS, DEFAULT_THEME, LEGACY_THEME_ALIASES and normalizeTheme with the legacy and unknown-value mapping"
    requirement: VIEW-05
    verification:
      - kind: unit
        ref: "packages/core/tests/themes.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "The app UserPreferences.theme type is the eight-name ThemeName union generated from core"
    requirement: VIEW-05
    verification:
      - kind: other
        ref: "npm -w @roadmapsnap/app run typecheck"
        status: pass
    human_judgment: false
  - id: D5
    description: "Core THEMES, API THEMES and Lite's rendered theme select hold the same eight names in the same order"
    requirement: VIEW-05
    verification:
      - kind: unit
        ref: "tests/guards/themes.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "REQUIREMENTS.md VIEW-05 and ROADMAP.md Phase 2 criterion 4 list all eight themes"
    requirement: VIEW-05
    verification:
      - kind: other
        ref: "grep -c 'monochrome, papallona, evergreen' .planning/REQUIREMENTS.md .planning/ROADMAP.md"
        status: pass
    human_judgment: false
  - id: D7
    description: "POST and PATCH projects reject non-http(s) external_link with 400; blank links store null; links are trimmed"
    verification:
      - kind: integration
        ref: "packages/api/tests/projects.test.js#POST /projects: external_link javascript:alert(1) is rejected with 400 and writes no row"
        status: pass
      - kind: integration
        ref: "packages/api/tests/projects.test.js#PATCH /projects: javascript: external_link is rejected with 400 and the stored link is unchanged; null clears it"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 05: Eight Persisted Themes and http(s)-Only Project Links Summary

**All eight Lite themes persist through PATCH /auth/me from one canonical core list (guarded against API and Lite drift), and projects only accept http(s) external links at write time.**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-11-26T08:00:00Z
- **Tasks:** 3 (4 commits: tracer, guard, RED, GREEN)
- **Files modified:** 12

## Accomplishments

- `@roadmapsnap/core` now owns the theme list, labels, default, legacy alias (`dsm-firmenich` to `evergreen`) and `normalizeTheme`; the app's `UserPreferences.theme` is the generated `ThemeName` union and typechecks without call-site changes.
- The API schema enum and merged-preference guard accept the eight names; a theme outside them returns 400 `{ error, message }` and the stored preference is untouched.
- `tests/guards/themes.test.js` fails if core, the API copy or the theme select rendered in the Lite snapshot diverge in names or order (verified by reordering the API list, which made it exit 1, then restoring).
- REQUIREMENTS.md VIEW-05 and ROADMAP.md Phase 2 criterion 4 name all eight themes.
- `external_link` is checked with `isHttpUrl` on POST and PATCH, closing the stored-XSS path (T-02-09) at write time.

## Task Commits

1. **Task 1: Tracer, eight themes through PATCH /auth/me typed from core** - `34e8233` (feat)
2. **Task 2: Theme list guard and requirement texts** - `6f8e403` (test)
3. **Task 3: http(s)-only external_link (TDD)**
   - RED: `2ea46c9` (test)
   - GREEN: `4102a5f` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Gate Compliance (Task 3)

- **RED:** `2ea46c9` adds POST (javascript:, data:) and PATCH (javascript:) cases plus blank, trim and https cases. Three target tests ran and failed on the planned assertion (`201 !== 400`: the invalid link was stored). The passing https, blank and trim cases confirm existing behavior is preserved. Semantic assessment: valid RED, the targets executed and failed for the intended reason (no zero-test, import or fixture fault). The `gsd_run check tdd-red-evidence` classifier was not run because `workflow.tdd_mode` was not requested for this plan; the failure was inspected directly from the Node test output.
- **GREEN:** `4102a5f` adds `isHttpUrl` and the checks; `projects.test.js` 19/19 and the full API suite 193/193.
- **REFACTOR:** none needed.

## Files Created/Modified

- `packages/core/src/themes.js` - canonical theme constants and `normalizeTheme`
- `packages/core/tests/themes.test.js` - covers each theme, the alias, '', null, undefined, 42, 'neon' and prototype-key input
- `packages/api/src/lib/themes.js` - API copy of THEMES
- `packages/api/src/lib/links.js` - `isHttpUrl`
- `packages/api/src/routes/auth.js` - enum and guard use THEMES
- `packages/api/src/routes/projects.js` - link allowlist on POST and PATCH
- `packages/api/tests/auth.test.js`, `packages/api/tests/projects.test.js` - new cases
- `packages/app/src/api/client.ts` - `UserPreferences.theme: ThemeName`
- `tests/guards/themes.test.js` - cross-product list guard
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` - single-line edits to eight themes

## Decisions Made

- The shared list is spread into the Ajv enum because the exported array is frozen.
- The merged-preference guard stays as a repair for legacy stored values (for example a stored `dsm-firmenich`) rather than being removed; it never replaces a valid choice.
- Link validation in PATCH runs before the existence SELECT, so an invalid link yields 400 before any query, even for an unknown project id.

## Deviations from Plan

None - plan executed exactly as written. The plan's Ajv note ("pass `[...THEMES]` if Ajv rejects a frozen array") was applied up front rather than tested.

## Issues Encountered

- One full API suite run reported `pass 172` against `tests 186` with `fail 0`; two reruns gave 186/186 and 193/193 (after the new tests). It was not reproduced and I did not find the cause. I flag it as a possible flaky test, unrelated to this plan's files.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-02-08 (theme enum) and T-02-09 (link allowlist) are implemented and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-08, 02-10, 02-13 can rely on core `THEMES`/`THEME_LABELS`/`normalizeTheme` and on stored links being http(s) only (render-side `safeHttpUrl` still applies).
- 02-15 still maps DashboardPage's theme as light/dark; the type widening required no cast there.
- `packages/core/types/` is gitignored and generated by `npm -w @roadmapsnap/app run typecheck`.

## Self-Check: PASSED

- Files exist: core `themes.js` and its test, API `lib/themes.js` and `lib/links.js`, `tests/guards/themes.test.js`.
- Commits `34e8233`, `6f8e403`, `2ea46c9`, `4102a5f` are ancestors of HEAD.
- Acceptance criteria re-run: no `enum: ['light', 'dark']` in auth.js (0), `THEMES` x3, `ThemeName` x2, `isHttpUrl(` x2, error string in tests x1, `blank, evergreen)` in REQUIREMENTS.md 0, guard exits non-zero when the API list is reordered.
- Plan verification: core themes test 21/21, API suite 193/193, root `npm test` 342/342, app typecheck clean, guard 2/2.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*
