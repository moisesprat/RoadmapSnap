---
phase: 02-shared-core-lite-identical-view
plan: 09
subsystem: ui
tags: [css, tokens, themes, fontsource, dm-sans, playwright, parity, view-05, view-01]
status: complete

requires:
  - phase: 02-06
    provides: "Lite-vs-Lite pixel harness with BASE_REF support and @fontsource/dm-sans 5.3.0 in packages/tokens"
provides:
  - "packages/tokens/lite.css (exported as @roadmapsnap/tokens/lite.css): every Lite page and component rule moved verbatim, body rules as shared .lite-area selector lists, zero-specificity :where(.lite-area) reset"
  - "css/roadmap.css reduced to three token imports plus Lite's universal reset (10 lines, was 703)"
  - "No class-based dark alias left in tokens.css or components.css; [data-theme=\"dark\"] only (D-07)"
  - "--color-accent, --color-on-accent and --color-danger for all eight themes (five blocks in tokens.css, three in lite.css) and colors.accent, onAccent, danger in tokens.js"
  - "Shared keyboard-only :focus-visible ring on the eight UI-SPEC targets"
  - "DM Sans 400/500/600/700 and 400 italic self-hosted via tokens.css; Google Fonts links removed from index.html"
  - "packages/parity/tests/fonts.spec.ts: offline DM Sans load check under evergreen"
affects: [02-10, 02-13, 02-15]

actuals:
  tokens: 12955
  tasks: 3
  commits: 3
plan_head_before: 4ca90280449307bd5d0b02641ff26c02b89fa1d8
plan_head_after: f206acc30fc42074d2cb93029f97e6cc83ef45f9

tech-stack:
  added: []
  patterns:
    - "Shared selector lists (body, .lite-area) so the SaaS wrapper gets Lite's page rules without changing Lite's cascade"
    - "Zero-specificity :where(.lite-area) reset instead of a second universal reset"
    - "Each CSS refactor step is gated by BASE_REF=HEAD Lite-vs-Lite parity run before the commit"
    - "Font files bundled through CSS @import of per-weight @fontsource files; Vite emits hashed assets"

key-files:
  created:
    - packages/tokens/lite.css
    - packages/parity/tests/fonts.spec.ts
  modified:
    - css/roadmap.css
    - packages/tokens/package.json
    - packages/tokens/tokens.css
    - packages/tokens/components.css
    - packages/tokens/tokens.js
    - index.html

key-decisions:
  - "Hex values in the moved CSS stay verbatim (UI-SPEC Planner Note 8); the #0065ff count is 3 before and after the move"
  - "lite.css gets accent tokens only for professional, colorful and blank; monochrome, papallona and evergreen already live in tokens.css and lite.css's copies of those blocks do not redefine accent, so tokens.css values apply"
  - "Selector lists are written on one line (body, .lite-area) so the plan's grep acceptance counts them"

patterns-established:
  - "Lite refactors are verified by comparing the committed pre-change build with the working tree, never against stored screenshots"

requirements-completed: [VIEW-05, VIEW-01]

coverage:
  - id: D1
    description: "All theme CSS and Lite component rules live in packages/tokens (tokens.css, components.css, lite.css); css/roadmap.css only imports them and keeps Lite's universal reset"
    requirement: VIEW-05
    verification:
      - kind: other
        ref: "grep -c '^@import' css/roadmap.css prints 3; wc -l < css/roadmap.css prints 10"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lite rendered before and after the CSS move differs in at most 0.1% of pixels for both fixtures under all eight themes"
    requirement: VIEW-01
    verification:
      - kind: e2e
        ref: "BASE_REF=HEAD npm -w @roadmapsnap/parity run test:docker -- tests/lite-vs-lite.spec.ts (18 passed after Task 1 and again after Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No selector in tokens.css or components.css uses the dark class alias; the [data-theme=\"dark\"] halves remain"
    requirement: VIEW-05
    verification:
      - kind: other
        ref: "grep -cE '(^|[ ,])\\.dark([ ,{]|$)' prints 0 for tokens.css and components.css"
        status: pass
    human_judgment: false
  - id: D4
    description: "--color-accent, --color-on-accent and --color-danger exist for all eight themes with the UI-SPEC values; tokens.js exposes accent, onAccent, danger"
    requirement: VIEW-05
    verification:
      - kind: other
        ref: "grep -c '--color-accent:' prints 5 (tokens.css) and 3 (lite.css); node import check of tokens.js exits 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "A shared :focus-visible ring (2px solid var(--color-accent), offset 2px) applies to the eight keyboard-reachable Lite controls and only on keyboard focus"
    requirement: VIEW-05
    verification:
      - kind: e2e
        ref: "Lite-vs-Lite parity unchanged after the rule was added (screenshots are taken without keyboard focus)"
        status: pass
    human_judgment: true
    rationale: "No automated test asserts the ring renders on keyboard focus; the rule is a plain CSS declaration and its visual quality needs a human look at Tab navigation"
  - id: D6
    description: "DM Sans is self-hosted through tokens and loads offline under evergreen; Google Fonts links are gone from index.html"
    requirement: VIEW-05
    verification:
      - kind: e2e
        ref: "packages/parity/tests/fonts.spec.ts#DM Sans loads offline under evergreen from the token package"
        status: pass
      - kind: other
        ref: "ls dist/assets | grep -c dm-sans prints 20; grep -c fonts.googleapis index.html prints 0"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-11-26
---

# Phase 2 Plan 09: Shared stylesheet set, chrome tokens and self-hosted DM Sans Summary

**All Lite theme and component CSS now lives in `packages/tokens` (new `lite.css` with `.lite-area` selector lists), the class-based dark alias is gone, every theme carries accent/danger chrome tokens plus a shared keyboard focus ring, and DM Sans is bundled from `@fontsource/dm-sans` instead of Google Fonts, with Lite proven pixel-neutral at each step.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-11-26
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `css/roadmap.css` went from 703 lines to 10: three `@import`s and Lite's `*` reset. Everything else moved verbatim to `packages/tokens/lite.css`, with the four `body` selectors (base, evergreen, dark, print) turned into `body, .lite-area` style lists and a leading `:where(.lite-area)` reset.
- Tracer gate: Lite built from the commit before the move versus the working tree gave 18 passed (16 fixture x theme cases, matrix check, negative control). Logged "Tracer verified end-to-end, expanding" and continued.
- 40 dark-class members removed from `components.css` and the `.dark` alias removed from `tokens.css`; 18 parity tests still pass against the previous commit.
- Accent, on-accent and danger tokens for all eight themes, `tokens.js` exports, and the focus ring on `.kpi-card.clickable`, `.risk-summary.clickable`, `.descoped-summary.clickable`, `.zoom-btn`, `.export-btn`, `.filter-toggle`, `.filter-clear`, `.group-control-btn`.
- DM Sans 400/500/600/700 and 400 italic imported at the top of `tokens.css`; Lite build emits 20 DM Sans assets; Google Fonts preconnect and stylesheet links removed (T-02-18 mitigated). `fonts.spec.ts` passes with external requests blocked and fails against the pre-task build (checked with `LITE_B_DIR=.out/lite-base`), so it is not vacuous.
- The seven non-evergreen themes are pixel-identical before and after Task 3 (15 passed with evergreen and the negative control excluded).

## Task Commits

1. **Task 1: Tracer, Lite styles from packages/tokens/lite.css** - `1b4c4a4` (feat)
2. **Task 2: Dark alias removed, chrome tokens and focus ring** - `26da6dd` (feat)
3. **Task 3: DM Sans self-hosted, Google Fonts removed** - `f206acc` (feat)

**Plan metadata:** committed separately after this summary.

## Files Created/Modified

- `packages/tokens/lite.css` - Lite page and component rules moved from `css/roadmap.css`, `.lite-area` selector lists, accent tokens for professional/colorful/blank
- `css/roadmap.css` - three token imports plus the universal reset
- `packages/tokens/package.json` - export `./lite.css`
- `packages/tokens/tokens.css` - font imports, dark selector without the alias, accent/on-accent/danger in five blocks
- `packages/tokens/components.css` - dark-class selectors deleted, header reworded, focus-visible rule appended
- `packages/tokens/tokens.js` - `accent`, `onAccent`, `danger` in `colors` and the three names in `colorVarNames`
- `index.html` - Google Fonts links removed
- `packages/parity/tests/fonts.spec.ts` - offline DM Sans check

## Decisions Made

See key-decisions in the frontmatter. In addition, the font spec asserts three independent facts (a declared DM Sans face is `loaded`, `document.fonts.check` is true, body `font-family` starts with DM Sans) plus that no request to a Google font host was made, because `document.fonts.check` alone returns true when no face matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] tokens.js name list and a stale comment**
- **Found during:** Task 2
- **Issue:** `colorVarNames` documents every `--color-*` custom property on `:root`; leaving the three new names out would let it drift from `tokens.css`. The `darkColors` doc comment still named the removed `.dark` class.
- **Fix:** Added `color-accent`, `color-on-accent`, `color-danger` to `colorVarNames` and reworded the comment to `[data-theme="dark"]`.
- **Files modified:** packages/tokens/tokens.js
- **Verification:** `node -e import(...)` check exits 0; no other file reads `colorVarNames` or `darkColors`.
- **Committed in:** 26da6dd

**2. [Plan inconsistency] Task 3 test-count threshold**
- **Found during:** Task 3
- **Issue:** The `fails_when` text says fewer than 17 passed tests fails. The Task 3 command uses `--grep-invert "evergreen|negative"`, which removes the two evergreen cases and the negative control from the 18, so the maximum possible is 15.
- **Fix:** Treated the threshold as applying to the full-run tasks (1 and 2: 18 passed each). Task 3's lite-vs-lite run reported 15 passed, 0 failed, which is every test the filter leaves.
- **Files modified:** none
- **Verification:** run output captured above; `fonts.spec.ts` ran separately (1 passed).

---

**Total deviations:** 2 (1 missing-critical consistency fix, 1 plan inconsistency). **Impact on plan:** none on outputs, no scope creep.

## Authentication Gates

None.

## Issues Encountered

- The packages/app still toggles a `.dark` class in `src/index.css` and `src/lib/themeStorage.ts`. With the alias removed from the shared tokens, the app's dark colors depend on those files being moved to `data-theme` (UI-SPEC D-07, `index.css` count of 11 is called out there). Out of scope here and outside this plan's `files_modified`; the app typecheck is not part of this plan's verify, but `npm run build -w @roadmapsnap/app` and `npm run typecheck -w @roadmapsnap/core` still pass.
- User-owned uncommitted work (`roadmap:update` line in root `package.json`, `.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`, `docs/roadmap-onepager.html`, `docs/roadmap/`, `scripts/roadmap-update.mjs`) was left untouched and unstaged.

## Known Stubs

None.

## Threat Flags

None. T-02-18 (Google Fonts disclosure) is mitigated as planned; no new network surface was added.

## Next Phase Readiness

- Later plans can import `@roadmapsnap/tokens/lite.css` in the app and wrap the Lite-equivalent view in `.lite-area`.
- The app theme switch from the `.dark` class to `data-theme` (and Tailwind `darkMode`) must land before the SaaS dark theme can match Lite again.

## Self-Check: PASSED

- Created files exist: `packages/tokens/lite.css`, `packages/parity/tests/fonts.spec.ts`.
- Commits `1b4c4a4`, `26da6dd`, `f206acc` are ancestors of HEAD; `git rev-list --count` from the ledger base gives 3.
- Acceptance criteria re-run: `^@import` count 3, `css/roadmap.css` 10 lines, `body, .lite-area` 2, `:where(.lite-area)` 2, `#0065ff` 3 in lite.css and 3 in the base commit's `css/roadmap.css`; dark-alias count 0 and 0; accent count 5 and 3; tokens.js check exits 0; `fonts.googleapis` count 0; `@fontsource/dm-sans` count 5; `dist/assets` DM Sans files 20.
- Plan verification: Lite base-vs-HEAD parity 18 passed (Task 1), 18 passed (Task 2), 15 passed excluding evergreen and the negative control (Task 3); fonts.spec 1 passed; root `npm test` 424 pass, 0 fail.
