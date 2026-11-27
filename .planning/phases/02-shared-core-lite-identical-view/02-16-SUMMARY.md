---
phase: 02-shared-core-lite-identical-view
plan: 16
subsystem: testing
tags: [parity, playwright, ci, github-actions, vite-mode, react, guards, docs, tracer]

requires:
  - phase: 02-06
    provides: "parity harness (openLite, comparePngs, MAX_DIFF_RATIO, static server, docker-test.sh)"
  - phase: 02-08
    provides: "roadmapToApi and canonicalRoadmap test helpers"
  - phase: 02-15
    provides: "the real SaaS DashboardPage, SaasHeader, useTheme"
  - phase: 02-17
    provides: "the --mode parity build into dist-parity, build-targets --saas, the 4303 server"
  - phase: 02-18
    provides: "packages/app/src/lib deleted (the CORE-02 guard asserts it stays gone)"
provides:
  - "Parity-only SaaS page entry (parity.html, src/parity/main.tsx: DashboardPage with a stub Auth0 context) built only by vite build --mode parity"
  - "lib/saas.ts (installApiStubs, openSaas, recordedPatches), lib/states.ts (STATES) and canonicalLiteConfig in lib/lite.ts"
  - "saas-vs-lite.spec.ts (16 fixture x theme comparisons, 9 state comparisons, theme switch, negative control), interactions.spec.ts, png.spec.ts (8 themes)"
  - "Always-reporting Parity workflow with in-job change detection, pinned to mcr.microsoft.com/playwright:v1.64.1-noble"
  - "tests/guards/no-app-lib.test.js (CORE-02) and parity checks in tests/guards/ci-config.test.js"
  - "AGENTS.md and docs/monorepo.md describe packages/core as the single source, data-theme for both products and the parity suite"
affects: [phase-02-verification, branch-protection]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3
plan_head_before: c1b5d72268e5bcebfef1b2013911ff19d8bcb52c
plan_head_after: 2b14af24bac346d1a4e9d654acc1bac2b2513b7f

tech-stack:
  added: []
  patterns:
    - "The SaaS page is compared with Lite through stubbed API routes built by roadmapToApi(fixture); Lite gets canonicalRoadmap(fixture) with the first milestone key re-added"
    - "Interaction states are shared step functions applied to both pages; a SaaS offset (header height) keeps the scroll state showing the same content"
    - "The suite asserts its own case count and has a page-level negative control, so a skipped theme or state, or a blind diff, fails"
    - "A required CI check never uses a path filter: the job always starts, a first step computes changed files and later steps are gated with if: steps.changes.outputs.run"

key-files:
  created:
    - packages/app/parity.html
    - packages/app/src/parity/main.tsx
    - packages/parity/lib/saas.ts
    - packages/parity/lib/states.ts
    - packages/parity/tests/saas-vs-lite.spec.ts
    - packages/parity/tests/interactions.spec.ts
    - packages/parity/tests/png.spec.ts
    - .github/workflows/parity.yml
    - tests/guards/no-app-lib.test.js
  modified:
    - packages/app/vite.config.ts
    - packages/parity/lib/lite.ts
    - packages/parity/tests/view-vs-lite.spec.ts
    - tests/guards/ci-config.test.js
    - AGENTS.md
    - docs/monorepo.md

key-decisions:
  - "The stub Auth0Context (initialContext spread with isAuthenticated, user and a three-segment token) satisfies useAuth0, so the RESEARCH A6 fallback was not needed: the parity entry renders the real DashboardPage"
  - "canonicalLiteConfig moved from view-vs-lite.spec.ts into lib/lite.ts so both specs share the START: '' re-add on the Lite side (02-17 note)"
  - "The scroll state uses a 700px viewport and scrollY 400 on Lite, 400 plus the measured header height on the SaaS page, and the spec asserts both scroll positions so the state cannot degrade into a second default screenshot"
  - "Pointer is parked at (1,1) after every state except graphHover, so a hover style cannot differ between the two layouts"

patterns-established:
  - "openSaas(context, { config, theme }) mirrors openLite: frozen clock, theme init script, stubbed API, fonts and two frames, build-version hidden"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, CORE-02, CORE-03]

coverage:
  - id: D1
    description: "The SaaS page matches Lite within 0.1% of pixels for the minimal and complex fixtures under all eight themes, in the pinned container with a frozen date and no network"
    requirement: "VIEW-01"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/saas-vs-lite.spec.ts (npm -w @roadmapsnap/parity run test:docker, 61 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The SaaS page matches Lite after search, status click, risk toggle, 6mo zoom, Collapse All, an open dependency graph with a hovered arrow, a scrolled page with the sticky filter bar, and (graph, risk) under dark"
    requirement: "VIEW-03"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/saas-vs-lite.spec.ts#the SaaS page matches Lite after <state>"
        status: pass
    human_judgment: false
  - id: D3
    description: "Switching the theme in the SaaS select sets data-theme, writes localStorage, sends PATCH /auth/me with { preferences: { theme } }, and then matches Lite under dark"
    requirement: "VIEW-04"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/saas-vs-lite.spec.ts#switching the theme in the SaaS select"
        status: pass
    human_judgment: false
  - id: D4
    description: "After a debounced search both pages keep focus in the search input with the caret at the end, and a click outside the exclusion list clears an active status filter in both"
    requirement: "VIEW-03"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/interactions.spec.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Export Full Roadmap under each of the eight themes downloads Full-Roadmap-15-04-2026.png with the PNG signature and an opaque white pixel (0,0)"
    requirement: "VIEW-06"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/png.spec.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Long project name and long workflow state title render identically in Lite and SaaS (complex fixture rows and KPI cards)"
    requirement: "VIEW-01"
    verification:
      - kind: e2e
        ref: "packages/parity/tests/saas-vs-lite.spec.ts#the SaaS page matches Lite: complex / <theme>"
        status: pass
    human_judgment: false
  - id: D7
    description: "The default app build contains no parity.html, parity-view.html or marker; dist-parity contains parity.html and the marker"
    verification:
      - kind: other
        ref: "npm -w @roadmapsnap/app run build; test ! -f dist/parity.html; grep __ROADMAPSNAP_PARITY__ in dist (none) and dist-parity (found)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Parity workflow has no path filter, the image tag equals the pinned Playwright version, and the heavy steps are gated by steps.changes.outputs.run"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "tests/guards/ci-config.test.js#parity.yml"
        status: pass
    human_judgment: false
  - id: D9
    description: "packages/app/src/lib does not exist, no app import points into a lib directory and no app file declares a core rule name"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/guards/no-app-lib.test.js"
        status: pass
    human_judgment: false
  - id: D10
    description: "Parity is a required status check on main and a README-only pull request reports success without the heavy steps"
    requirement: "CORE-03"
    verification: []
    human_judgment: true
    rationale: "Branch protection is a GitHub repository setting changed by a human with admin rights; the workflow shape is guarded, the setting is not verifiable from the repo"

duration: 30min
completed: 2026-11-27
status: complete
---

# Phase 2 Plan 16: Lite-vs-SaaS parity matrix, Parity CI gate and CORE-02 guard Summary

**The real SaaS page (DashboardPage with a stub Auth0 context, fed by stubbed API routes) is pixel-compared with live Lite across 2 fixtures x 8 themes, 9 interaction states, a theme switch and a PNG-export smoke (61 passing tests in the pinned container), enforced by an always-reporting Parity workflow, with a CORE-02 guard and docs naming packages/core the single source.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-11-27
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `parity.html` and `src/parity/main.tsx` render the real `DashboardPage` (header, TanStack Query hooks, `useTheme`) with a stub `Auth0Context`; the entry joins `view` in the `mode === 'parity'` input map, so the default build still emits only `index.html` (verified: no parity.html, parity-view.html or marker in `dist`; both present in `dist-parity`).
- The tracer passed on the first run: minimal / light, Lite body against SaaS `.lite-area`, equal dimensions and within 0.1% of pixels.
- The full run is 61 passed: 18 Lite-vs-Lite, 4 view-vs-lite, 28 saas-vs-lite (case-count test, 16 matrix, 9 states, theme switch, negative control), 2 interactions, 8 PNG, plus 1 fonts. No screenshot baseline is committed and `MAX_DIFF_RATIO` stays 0.001.
- `Parity` workflow: no path filter, container `mcr.microsoft.com/playwright:v1.64.1-noble`, first step `changes` computes changed files and every heavy step is gated on `steps.changes.outputs.run`, so the job always reports.
- `tests/guards/no-app-lib.test.js` (CORE-02) and a parity block in `ci-config.test.js`; root `npm test` is 510 passing, app tests 194 passing, core typecheck clean.
- AGENTS.md drops "Fix logic bugs in both" and points to `packages/core`; the themes bullet and the parity command are updated; `docs/monorepo.md` gains a parity section and the workflow row.

## Task Commits

1. **Task 1: Tracer, SaaS page matches Lite through stubbed API routes** - `094fb76` (feat)
2. **Task 2: matrix, states, theme switch, interactions, PNG smoke** - `e731633` (test)
3. **Task 3: Parity workflow, CORE-02 guard, docs** - `2b14af2` (ci)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Tracer Feedback Gate

Task 1 is `type="tracer"` with an automated-only `<verify>` and `human_verify_mode: end-of-phase`; the verify was re-run end to end (container spec, default build, isolation greps) and passed, so expansion proceeded: "Tracer verified end-to-end - expanding".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Page-level negative control and scroll-position assertions**
- **Found during:** Task 2
- **Issue:** The plan lists no negative control for the page-level diff and nothing proves the `scrolled` state really scrolls; both would let a blind or degenerate comparison pass silently.
- **Fix:** Added a negative control (an injected `letter-spacing` change on the SaaS page must be detected) and asserted `scrollY` 400 (Lite) and 400 plus header height (SaaS) in the scrolled case.
- **Files modified:** `packages/parity/tests/saas-vs-lite.spec.ts`
- **Verification:** full container run, 61 passed.
- **Committed in:** `e731633`

**2. [Rule 1 - Duplication] Shared canonicalLiteConfig**
- **Found during:** Task 1
- **Issue:** The Lite-side `START: ''` re-add lived inside `view-vs-lite.spec.ts`; the new spec needs the same step.
- **Fix:** Moved it to `lib/lite.ts` as `canonicalLiteConfig` and made `view-vs-lite.spec.ts` import it (a file the plan's `files_modified` does not list).
- **Files modified:** `packages/parity/lib/lite.ts`, `packages/parity/tests/view-vs-lite.spec.ts`
- **Verification:** view-vs-lite 4 of 4 still pass.
- **Committed in:** `094fb76`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 duplication/consistency)
**Impact on plan:** None on scope; one extra test and one small refactor. The RESEARCH A6 fallback was not needed.

## Issues Encountered

None. Every comparison passed on the first full run.

## Known Stubs

None. The stub Auth0 context and API routes exist only in the parity build and harness by design (T-02-31).

## Threat Flags

None beyond the plan's register. T-02-31 is covered by the non-vacuous isolation check, T-02-32 by `ci-config.test.js`.

## Human Verification Pending (outward-facing, not done by the executor)

1. In GitHub branch protection for `main`, mark the `parity` job (workflow Parity) as a required status check, confirm with `gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks.contexts'`, then open a pull request that touches only `README.md` and confirm Parity reports success without running the heavy steps.
2. End-of-phase visual header review (02-15).
3. The workflow itself has not run on GitHub yet; its first run (container `--user 1001`, `npm ci` for four workspaces) is untested outside the local Docker image.

## Self-Check: PASSED

- Files: parity.html, src/parity/main.tsx, lib/saas.ts, lib/states.ts, the three specs, parity.yml and no-app-lib.test.js all exist.
- Commits `094fb76`, `e731633`, `2b14af2` are ancestors of HEAD.
