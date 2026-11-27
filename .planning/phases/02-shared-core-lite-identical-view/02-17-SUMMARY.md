---
phase: 02-shared-core-lite-identical-view
plan: 17
subsystem: testing
tags: [parity, playwright, vite-mode, react, html2canvas, golden-markup, tdd, tracer, docker]

requires:
  - phase: 02-06
    provides: "parity harness (openLite, comparePngs, MAX_DIFF_RATIO, static server, docker-test.sh)"
  - phase: 02-08
    provides: "roadmapToApi and canonicalRoadmap test helpers"
  - phase: 02-09
    provides: "tokens lite.css (.lite-area page rules)"
  - phase: 02-12
    provides: "LiteFilterBar, LiteDashboard, useLiteViewState, golden-markup helpers"
provides:
  - "Parity-only preview entry (parity-view.html, src/parity/view.tsx) built by vite build --mode parity into dist-parity, with the build:parity script"
  - "build-targets.mjs --saas, static server 4303 (SAAS_DIR) and docker-test.sh always building the SaaS target"
  - "tests/view-vs-lite.spec.ts: early React-vs-Lite element pixel comparison of .filter-bar, .export-controls, #summary-section and .page-footer on both fixtures, plus a negative control"
  - "LiteExportControls (CSV/JSON/PNG with Lite's html2canvas options and a busy state), LiteFooter, download.ts"
  - "Build-time constants __APP_VERSION__ and __BUILD_DATE__ via vite define"
affects: [02-14, 02-15, 02-16]

actuals:
  tokens: 8200
  tasks: 3
  commits: 4
plan_head_before: 2d6c433e60a3e38b8dedd97925cfa387cfda4642
plan_head_after: aaa3da0106d0680533522988c3c4829ee7f29aeb

tech-stack:
  added: []
  patterns:
    - "Parity preview is a separate Vite input selected only by mode === 'parity'; the default build input stays index.html, and a marker string proves the isolation is not vacuous"
    - "Early parity check compares element screenshots of the React preview against live Lite on the same fixture routed through roadmapToApi and apiToRoadmap, with no committed baselines"
    - "Icon plus label of an export button is one constant innerHTML string, because Lite puts the svg directly inside the button and a wrapper element would change the tag tree"

key-files:
  created:
    - packages/app/parity-view.html
    - packages/app/src/parity/view.tsx
    - packages/parity/tests/view-vs-lite.spec.ts
    - packages/app/src/components/lite/LiteExportControls.tsx
    - packages/app/src/components/lite/LiteExportControls.test.tsx
    - packages/app/src/components/lite/LiteFooter.tsx
    - packages/app/src/components/lite/download.ts
  modified:
    - packages/app/vite.config.ts
    - packages/app/package.json
    - packages/app/src/vite-env.d.ts
    - .gitignore
    - packages/parity/playwright.config.ts
    - packages/parity/scripts/build-targets.mjs
    - packages/parity/scripts/docker-test.sh

key-decisions:
  - "Preview body reset is `html body { margin: 0; padding: 0 }`: lite.css gives body the Lite page padding and loads after an inline `body` rule, so the plan's plain `body` rule left 40px of double padding. 02-15's real page needs the same higher-specificity rule."
  - "Lite is compared with its #timeline-section hidden: the preview has no timeline yet, and a fractional-height timeline above the footer shifted the footer by one pixel row (48 vs 49 px). 02-14 adds the timeline to the preview and the full-area test removes this."
  - "The Lite side of the complex fixture re-adds the empty first milestone key (START: '') that the adapter drops, because Lite's validator rejects a deliverable without it. Both forms mean no date."
  - "Unmet export target elements log console.error and return without onExportError, as Lite's exportToPNG does; only a failed capture calls onExportError."

patterns-established:
  - "openView(context, { config, theme }) in view-vs-lite.spec.ts mirrors openLite for the preview (route payload, frozen clock, theme init script, fonts and two frames)"

requirements-completed: [VIEW-01, VIEW-02, VIEW-06]

coverage:
  - id: D1
    description: "The React filter bar, export controls, dashboard and footers, built in parity mode from both fixtures through apiToRoadmap, match Lite's element pixels within 0.1% in the pinned container"
    requirement: "VIEW-01"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/view-vs-lite.spec.ts (npm -w @roadmapsnap/parity run test:docker)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An injected one-pixel style change in the preview is detected, so the early check is not vacuous"
    requirement: "VIEW-02"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/view-vs-lite.spec.ts#negative control: a one-pixel style change in the preview is detected"
        status: pass
    human_judgment: false
  - id: D3
    description: "The default app build contains no parity-view.html and no parity marker; dist-parity contains the marker"
    verification:
      - kind: other
        ref: "npm -w @roadmapsnap/app run build; test ! -f packages/app/dist/parity-view.html; grep for __ROADMAPSNAP_PARITY__ in dist and dist-parity"
        status: pass
    human_judgment: false
  - id: D4
    description: "LiteExportControls and LiteFooter emit Lite's tag tree, classes, text and attributes (version text excluded)"
    requirement: "VIEW-06"
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteExportControls.test.tsx#golden markup"
        status: pass
    human_judgment: false
  - id: D5
    description: "CSV and JSON download core output; PNG capture uses Lite's html2canvas options, Lite's file names, a busy state with aria-busy, and reports failures"
    requirement: "VIEW-06"
    verification:
      - kind: unit
        ref: "packages/app/src/components/lite/LiteExportControls.test.tsx#downloads, #PNG export"
        status: pass
    human_judgment: false
  - id: D6
    description: "A real browser PNG capture under each theme"
    requirement: "VIEW-06"
    verification: []
    human_judgment: true
    rationale: "html2canvas is mocked in the unit tests; the real-browser PNG smoke stays in 02-16 (RESEARCH A5)"

duration: 25min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 17: Early React-vs-Lite parity preview and export controls Summary

**A parity-only Vite build of the React Lite area (filter bar, export controls, dashboard, footers) is pixel-compared with live Lite on both fixtures in the pinned Playwright container, alongside LiteExportControls with Lite's CSV/JSON/PNG behavior and LiteFooter.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-11-26T16:23:00Z
- **Completed:** 2026-11-26T16:48:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- `vite build --mode parity` produces `packages/app/dist-parity` from `parity-view.html` only; the default build has no parity entry and no marker (checked with a grep that also requires the marker in `dist-parity`).
- The preview fetches `/parity-view/payload.json` (served by the harness from `roadmapToApi(fixture)`), converts it with `apiToRoadmap`, and renders LiteFilterBar, LiteExportControls, LiteDashboard and LiteFooter in Lite's order with only the shared tokens CSS.
- `tests/view-vs-lite.spec.ts` passes 3 of 3 in the pinned container: minimal and complex (light theme) over `.filter-bar`, `.export-controls`, `#summary-section` and `.page-footer`, plus a negative control that detects an injected `letter-spacing: 1px`.
- LiteExportControls: CSV and JSON bytes from core `buildCsv` and `buildJson`, PNG through html2canvas with `{ scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }` after `document.fonts.ready`, buttons disabled with `aria-busy` during a capture, `console.error` plus `onExportError` on failure.

## Task Commits

1. **Task 1: Tracer, React filter bar and dashboard match Lite's pixels** - `7aaf56e` (feat)
2. **Task 2 RED: failing tests for export controls and footers** - `2149566` (test)
3. **Task 2 GREEN: LiteExportControls, LiteFooter, download helpers, vite constants** - `6726b00` (feat)
4. **Task 3: preview gains export controls and footers; both fixtures, four regions, negative control** - `aaa3da0` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## TDD Gate Compliance

Task 2 is the only `tdd="true"` task (plan type is `execute`).

- **RED:** `LiteExportControls.test.tsx` (9 tests) against stub components that render `null`. The target test `golden markup > minimal: LiteExportControls equals Lite's renderExportControls` ran and failed on `expected null not to be null` (the stub renders no `.export-controls`), exit 1. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the TAP report of the target run (`-t` filter, so the other eight tests are reported as skipped; the unfiltered run failed all nine tests on missing elements, but its multi-line Testing Library messages are not parseable TAP). Semantic assessment: the target executed and failed on the planned assertion for the intended reason, with no import, syntax or fixture fault.
- **GREEN:** the implementation made all 9 tests pass on the first run; the whole app suite is 116 passing tests.
- **REFACTOR:** none needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Body padding doubled in the preview**
- **Found during:** Task 1
- **Issue:** The plan's `body { margin: 0; padding: 0 }` lost to lite.css's `body, .lite-area { padding: 20px }` (same specificity, later in the cascade), so the preview filter bar was 1360 px wide against Lite's 1400 px.
- **Fix:** `html body { margin: 0; padding: 0 }` in `parity-view.html`.
- **Files modified:** `packages/app/parity-view.html`
- **Verification:** the Task 1 spec passed in the pinned container.
- **Committed in:** `7aaf56e`

**2. [Rule 3 - Blocking] Complex fixture does not render in Lite through `canonicalRoadmap`**
- **Found during:** Task 3
- **Issue:** The adapter drops the empty `START` milestone of `Unscheduled Spike`; Lite's validator then replaces the page with an error list, so `.summary-dashboard` never appears (30 s timeout).
- **Fix:** `liteConfigFor(fixture)` in the spec re-adds the first milestone key as `''` on the Lite side only.
- **Files modified:** `packages/parity/tests/view-vs-lite.spec.ts`
- **Verification:** complex / light passes with all four regions.
- **Committed in:** `aaa3da0`

**3. [Rule 3 - Blocking] One-pixel footer height difference from fractional layout**
- **Found during:** Task 3
- **Issue:** `.page-footer` screenshots were 1400x48 in Lite and 1400x49 in the preview, because the timeline above the footer in Lite has a fractional height the preview lacks; `comparePngs` rejects unequal dimensions.
- **Fix:** the spec hides `#timeline-section` on the Lite page (`openLiteWithoutTimeline`). Tolerance, regions and fixtures are unchanged. 02-14's full-area test removes the need.
- **Files modified:** `packages/parity/tests/view-vs-lite.spec.ts`
- **Verification:** all four regions match on both fixtures.
- **Committed in:** `aaa3da0`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** None on scope. `MAX_DIFF_RATIO` stays 0.001, no screenshots are committed and no fixture or region is skipped.

## Issues Encountered

- The unfiltered RED run could not be fed to the TAP classifier because Testing Library's multi-line error messages break the report; the filtered target run was used (see TDD Gate Compliance).

## Known Stubs

None.

## Threat Flags

None. The preview entry (T-02-34) is covered by the isolation check; export icons come only from core constants (T-02-35, directory-wide grep prints 0).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-14 swaps the preview composition for LiteRoadmapView, adds the timeline to the preview, can drop the `openLiteWithoutTimeline` workaround and must update the spec's test count (the suite is exactly 3 tests now).
- 02-15 and 02-16 need the `html body { margin: 0; padding: 0 }` rule (not plain `body`) on the real page, and 02-16 keeps the real-browser PNG smoke under every theme.
- `canonicalRoadmap` drops an empty milestone key; later Lite-side comparisons of fixtures with unscheduled items need the same re-add.

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*

## Self-Check: PASSED

- Files: parity-view.html, src/parity/view.tsx, view-vs-lite.spec.ts, LiteExportControls.tsx, LiteFooter.tsx, download.ts, LiteExportControls.test.tsx all present.
- Commits 7aaf56e, 2149566, 6726b00, aaa3da0 are ancestors of HEAD.
