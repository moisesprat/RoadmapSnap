---
phase: 02-shared-core-lite-identical-view
plan: 06
subsystem: testing
tags: [playwright, pixelmatch, pngjs, docker, parity, screenshots, view-01]
status: complete

requires:
  - phase: 02-01
    provides: "npm workspaces layout (packages/*) and Node 24 engines baseline"
  - phase: 02-02
    provides: "tests/fixtures/config.minimal.js and config.complex.js, TIMELINE.TODAY 15/04/2026"
provides:
  - "Private workspace @roadmapsnap/parity (test, test:docker) with exact pins @playwright/test 1.64.1, pixelmatch 8.0.0, pngjs 7.0.0"
  - "lib/compare.ts: comparePngs(a, b) and MAX_DIFF_RATIO 0.001 (D-08)"
  - "lib/lite.ts: openLite, liteConfigScript, THEME_MATRIX (8 themes), FIXTURES, newIsolatedContext, FIXED_NOW"
  - "scripts/build-targets.mjs --lite-head and --lite-base <ref>; scripts/docker-test.sh on mcr.microsoft.com/playwright:v1.64.1-noble"
  - "Lite-vs-Lite spec: 16 fixture x theme cases, a matrix-size check and a one-pixel negative control (18 tests), passing at HEAD and with BASE_REF=HEAD"
  - "@fontsource/dm-sans 5.3.0 as a dependency of @roadmapsnap/tokens (not yet used by any CSS)"
affects: [02-09, 02-13, 02-15]

actuals:
  tokens: 3900
  tasks: 3
  commits: 2
plan_head_before: 717d629555dfa5fdda2cdfb9e24d7df299d9e5a3
plan_head_after: f7a34fc23adc4fa6bd52c5d97a877ff417b0c9f0

tech-stack:
  added: ["@playwright/test 1.64.1", "pixelmatch 8.0.0", "pngjs 7.0.0", "@fontsource/dm-sans 5.3.0"]
  patterns:
    - "Baseline-free parity: two live renders compared with pixelmatch, never committed screenshots (D-10)"
    - "Hermetic render: context.route aborts every non-localhost request, page.clock.setFixedTime freezes Date while timers keep running, UTC and en-US"
    - "Host builds Lite with vite, container only serves static files and runs Chromium; host node_modules shadowed by anonymous volumes"
    - "Base-vs-HEAD comparison through a temporary git worktree removed in a finally block"

key-files:
  created:
    - packages/parity/package.json
    - packages/parity/playwright.config.ts
    - packages/parity/scripts/static-server.mjs
    - packages/parity/scripts/build-targets.mjs
    - packages/parity/scripts/docker-test.sh
    - packages/parity/lib/compare.ts
    - packages/parity/lib/lite.ts
    - packages/parity/tests/lite-vs-lite.spec.ts
  modified:
    - packages/tokens/package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "Task 1 legitimacy checkpoint approved by the user before any install; all four packages installed with --save-exact"
  - "@playwright/test pinned to 1.64.1 (not the flagged latest) and the Docker tag v1.64.1-noble equals the npm version"
  - "Theme list in lib/lite.ts is a literal copy of the eight names in Lite order rather than an import of @roadmapsnap/core, so the parity workspace needs no dependency on shipped packages"

patterns-established:
  - "Every view plan compares live renders through openLite plus comparePngs with MAX_DIFF_RATIO"
  - "BASE_REF=<ref> sets LITE_A_DIR=.out/lite-base so a refactor can be verified against the previous Lite"

requirements-completed: []

coverage:
  - id: D1
    description: "Two independent Lite renders differ in at most 0.1% of pixels for both fixtures under all eight themes"
    requirement: VIEW-01
    verification:
      - kind: e2e
        ref: "packages/parity/tests/lite-vs-lite.spec.ts#Lite A and Lite B render identically"
        status: pass
    human_judgment: false
  - id: D2
    description: "An injected one-pixel style change is detected, so the diff is not vacuous"
    requirement: VIEW-01
    verification:
      - kind: e2e
        ref: "packages/parity/tests/lite-vs-lite.spec.ts#negative control: a one-pixel style change is detected"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lite at a base git ref builds and compares against HEAD with the same harness"
    requirement: VIEW-01
    verification:
      - kind: e2e
        ref: "BASE_REF=HEAD npm -w @roadmapsnap/parity run test:docker -- tests/lite-vs-lite.spec.ts (18 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "@fontsource/dm-sans 5.3.0 is a dependency of @roadmapsnap/tokens"
    requirement: VIEW-01
    verification:
      - kind: other
        ref: "node -e check of packages/tokens/package.json dependencies"
        status: pass
    human_judgment: false

duration: not measured (continuation run, about 25 min)
completed: 2026-11-26
---

# Phase 2 Plan 06: Screenshot parity harness Summary

**Private `packages/parity` Playwright + pixelmatch harness in the pinned `v1.64.1-noble` image, proving Lite renders are reproducible across 8 themes x 2 fixtures and that a 1px change is detected; DM Sans 5.3.0 installed into tokens.**

## Performance

- **Started:** continuation of an earlier run that stopped at the Task 1 checkpoint
- **Completed:** 2026-11-26
- **Tasks:** 3 (Task 1 human checkpoint approved, Tasks 2 and 3 executed)
- **Files modified:** 11

## Accomplishments

- A deterministic, baseline-free parity harness exists: no screenshots are committed (D-10) and none are needed.
- Lite is rendered from a fixture by routing `**/js/config.js`, with the clock frozen at 2026-04-15T12:00:00Z, viewport 1440x3000, UTC, en-US, and every non-localhost request aborted (D-08).
- 18 tests pass at HEAD and again with `BASE_REF=HEAD`: 16 matrix cases, the matrix-size assertion, and the negative control.
- The temporary base worktree is removed after the base build (`git worktree list` shows only the main tree).

## Task Commits

1. **Task 1: Verify the four new packages** - human checkpoint, approved by the user (no commit)
2. **Task 2: Tracer** - `26dfe73` (feat)
3. **Task 3: Matrix, negative control, base-vs-HEAD, DM Sans** - `f7a34fc` (feat)

**Plan metadata:** committed separately after this summary.

## Files Created/Modified

- `packages/parity/package.json` - private workspace, exact dev pins, `test` and `test:docker`
- `packages/parity/playwright.config.ts` - viewport, timezone, locale, two static-server web servers on 4301 and 4302
- `packages/parity/scripts/static-server.mjs` - zero-dependency static server with traversal guard
- `packages/parity/scripts/build-targets.mjs` - `--lite-head`, `--lite-base <ref>` (temporary worktree)
- `packages/parity/scripts/docker-test.sh` - pinned-image runner with host node_modules shadowed
- `packages/parity/lib/compare.ts`, `lib/lite.ts` - comparator and Lite page helpers
- `packages/parity/tests/lite-vs-lite.spec.ts` - matrix, matrix-size check, negative control
- `packages/tokens/package.json` - `@fontsource/dm-sans` 5.3.0
- `package-lock.json`, `.gitignore` - lockfile entries and ignored outputs

## Decisions Made

See key-decisions in the frontmatter. In addition, `npm ci -w @roadmapsnap/parity --ignore-scripts` is used inside the container so no install script runs there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] First `npm install -D -w` run only linked the workspace**
- **Found during:** Task 2
- **Issue:** The first install invocation reported "added 1 package" and wrote no dependencies; `node_modules/@playwright` was missing.
- **Fix:** Re-ran the same install with the long-form flags (`--save-dev --save-exact --workspace=@roadmapsnap/parity`) and the same exact versions; the pins landed in `packages/parity/package.json`. No package substitution occurred.
- **Files modified:** packages/parity/package.json, package-lock.json
- **Commit:** 26dfe73

**2. [Plan ordering] `--lite-base` was implemented in Task 2, not Task 3**
- **Found during:** Task 2
- **Issue:** The plan adds `--lite-base` to `build-targets.mjs` in Task 3 but also lists the file under Task 2 and the Docker script references `BASE_REF` from the start.
- **Fix:** Wrote the complete script once in Task 2, so Task 3 did not need to touch it.
- **Commit:** 26dfe73

**Total deviations:** 2 (1 blocking-tool quirk, 1 ordering). **Impact:** none on outputs.

## Authentication Gates

None.

## Issues Encountered

- `npm` printed an install-scripts warning (esbuild, browser-tabs-lock, fsevents). These are pre-existing packages, not part of the four vetted ones, and the four new packages declare no install scripts (`npm view @playwright/test@1.64.1 scripts` is empty; `@fontsource/dm-sans` likewise).
- Plan flagged assumption A7 (Node major in the 1.64.1 image) was not needed: the suite runs with the image's Node and `npm ci` succeeded.
- User-owned uncommitted work (`roadmap:update` line in root `package.json`, `.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`, `docs/roadmap-onepager.html`, `docs/roadmap/`, `scripts/roadmap-update.mjs`) was left untouched and unstaged. The installs did not alter root `package.json`.

## Known Stubs

None.

## Threat Flags

None. The container mount is covered by T-02-11 (host node_modules shadowed, non-localhost requests aborted, no `.env` or `js/config.js` copied or printed); `js/config.js` is only read by the host vite build and is never written by `build-targets.mjs` when it exists.

## Next Phase Readiness

- 02-09 can move theme CSS into tokens and verify with `BASE_REF=<ref> npm -w @roadmapsnap/parity run test:docker`.
- `requirements-completed` is left empty: VIEW-01 (identical view) is only enabled by this harness and is completed by later plans (Lite-vs-SaaS comparison).

## Self-Check: PASSED

- Created files verified on disk; commits `26dfe73` and `f7a34fc` are ancestors of HEAD.
- Acceptance criteria re-run: pins and private flag, `v1.64.1-noble` count 1, no tracked PNGs, no shipped package depends on parity, `MAX_DIFF_RATIO = 0.001` count 1, tokens dependency 5.3.0, no parity worktree left.
- Plan verification: both Docker runs reported 18 passed, 0 failed. Root `npm test` still passes (342 pass).
