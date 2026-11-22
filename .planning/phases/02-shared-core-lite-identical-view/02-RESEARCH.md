# Phase 2: Shared Core & Lite-Identical View - Research

**Researched:** 2026-11-22
**Domain:** Monorepo logic extraction (vanilla-JS core to shared ESM package), React re-implementation of a vanilla-CSS page with pixel parity, Playwright visual parity, npm workspaces and CI
**Confidence:** MEDIUM-HIGH (repo facts are read from source this session; tooling behaviors were verified with scratch experiments; a few browser-level behaviors are `[ASSUMED]` and listed in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SaaS rendering**
- **D-01:** React components render core view models and emit the same DOM structure and CSS class names as Lite's `js/ui/*` renderers. Do not mount Lite's HTML strings in React (no `dangerouslySetInnerHTML` of tenant data). A golden-markup test guards structural parity. — **Reversibility:** costly — every view component is built on this choice.
- **D-02:** Page layout is a thin SaaS header (workspace switcher, user menu, entry point to the existing project modals) above an area that is exactly Lite's page: Lite header, dashboard, filter bar and timeline. Screenshot parity applies to the Lite area only.
- **D-03:** Keep the existing project create, edit and delete modals working, opened from outside the Lite area (header or toolbar). They are not part of the parity area. Phase 3 replaces them. The current `AppShell`/`ProjectList` layout gives way to D-02.
- **D-04:** Display config that the DB doesn't store yet (`ENTITY_LABELS`, `DASHBOARD_TEXT`, page title, etc.) comes from workspace data where it exists (stored workflow, workspace name), with the rest coming from `config_base`-equivalent defaults defined in core. No schema change in this phase. Phase 3 decides where these live.

**Themes**
- **D-05:** SaaS offers all 8 Lite themes: light, dark, professional, colorful, blank, monochrome, papallona, evergreen. Update VIEW-05 in REQUIREMENTS.md to list all 8. All theme CSS moves into `packages/tokens` and is consumed by both Lite and the app.
- **D-06:** The theme is saved per user in `users.preferences` (through `PATCH /auth/me`) and cached in localStorage key `roadmapsnap-theme` (the same key as Lite, including the legacy `dsm-firmenich` → `evergreen` mapping). It is applied before first paint to avoid a flash.
- **D-07:** The theme applies to the whole SaaS page through `data-theme` on `<html>`, exactly like Lite. The SaaS header and modals use the same tokens. Remove the `html.dark` class mechanism (`packages/app/src/lib/themeStorage.ts`, `index.css` `html.dark` rules).

**Parity verification**
- **D-08:** Playwright screenshot comparison of Lite vs SaaS uses a near-zero tolerance (about 0.1% of pixels, for anti-aliasing only). Both run in the same pinned Playwright Docker image with fixed fonts, a fixed viewport and a frozen "today" date.
- **D-09:** Coverage is all 8 themes against `tests/fixtures/config.minimal.js` and `tests/fixtures/config.complex.js`, plus specific states: a filter applied, a non-default zoom level, collapsed groups, and a dependency tooltip open. That is roughly 20–25 screenshots. Not the full theme × state cross product.
- **D-10:** No committed baselines. Lite is the oracle. Playwright renders Lite from the fixture config and renders SaaS with API responses stubbed from the same fixture (converted through the core adapter in D-15), then diffs the two live. No DB or Auth0 is needed for the parity suite.
- **D-11:** The parity suite is a required, blocking CI check on PRs that touch `packages/core`, `packages/tokens`, `packages/app`, `css/` or `js/`.
- **D-12:** CSV and JSON export builders move into `packages/core`, and tests assert byte-identical output between Lite and SaaS for the same fixture. PNG uses `html2canvas` on the Lite area with the same options as Lite. It is smoke-tested under every theme, not pixel-diffed.

**Core packaging & Lite delivery**
- **D-13:** Lite imports `@roadmapsnap/core`, and the Vite build (`dist/`) is how Lite is delivered. `npm run dev` keeps working. Serving the raw repo root without a build is no longer supported, and README/`docs/monorepo.md` must say so. Lite stays backend-free with no runtime dependency on SaaS. — **Reversibility:** costly — Lite users who served the raw source tree must switch to `dist/`.
- **D-14:** `packages/core` is plain ESM JavaScript with JSDoc types, type-checked with `tsc --checkJs`. `.d.ts` files are generated for the app. Lite's Node tests import it directly with no compile step. Zero runtime dependencies. No DOM, `window`, `CONFIG`, `AppState`, `process`, DB or network access.
- **D-15:** Core functions operate on Lite's config shape (DD/MM/YYYY milestone dates, group strings). `packages/core` provides an `apiToRoadmap` adapter that converts API rows with ISO `YYYY-MM-DD` dates (Phase 1 D-15) into that shape. The app and the parity test both use it. One canonical DD/MM/YYYY parse and format lives in core.
- **D-16:** Standardize on Node 24 LTS across all three CI workflows, `engines` and (later) Docker images. Adopt npm workspaces with one root lockfile, replacing the `file:` dependencies. Lite CI must stay light (for example `npm ci --workspaces=false` or similar). Fix the root CI's `paths-ignore: packages/**` so shared-code changes run Lite tests (CORE-03).

### Claude's Discretion
- The extraction order and strangler mechanics (module by module, with Lite `js/core/*` becoming thin bindings over core), including pulling `filterDeliverables` out of `js/ui/filterBar.js` and the theme-dependent bits out of `js/core/viewModel.js`.
- Tailwind preflight scoping or removal strategy, and font loading parity.
- Exact layout and contents of the thin SaaS header, within D-02.
- Playwright image version, diff tooling details, and how "today" is frozen in both Lite and SaaS.
- Whether `window.*` globals remain as Lite shims (inline handlers depend on them).
- How `.d.ts` files are generated and where they are checked in CI.

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Lite and SaaS use the same roadmap logic from `packages/core` (timeline, workflow, dependencies, stats, filters, view model) | Impurity Inventory (per-function lists), Drift Inventory, Core API proposal, strangler wave order, `.d.ts` spike, purity guard test |
| CORE-02 | The `packages/app/src/lib` duplicates are removed | Drift Inventory (what must be absorbed before deletion), list of `lib` importers, deletion check test |
| CORE-03 | Lite keeps working unchanged (`npm test`, `validate`, `build` green), and CI runs Lite tests when shared code changes | Bindings strategy keeps the 141 existing tests as characterization, workspace install matrix (verified), `paths-ignore` + required-check finding, Docker/lockfile blast radius |
| VIEW-01 | Timeline/Gantt pixel-identical to Lite for the same data | Parity harness design, CSS isolation (`:where` reset, preflight off), theme CSS move, fixtures gap (complex fixture is empty) |
| VIEW-02 | KPI dashboard identical to Lite | Core dashboard model, golden-markup scope, drift items D13/D14 |
| VIEW-03 | Dependency arrows and tooltips with blocking detection identical to Lite | Pure `computeDependencyArrows` in core, red-set impurity (hard-coded keys), tooltip screenshot limitation |
| VIEW-04 | Filter by name/status/risk, zoom 3/6/12/all | Pure filter-state helpers and `filterDeliverables` in core, zoom naming drift, search focus behavior |
| VIEW-05 | Switch among all Lite themes (8 per D-05) | Theme CSS move, `data-theme` bridge, pre-paint script, API enum extension (verified lines), doc edits |
| VIEW-06 | Export to PNG, CSV and JSON | Core CSV/JSON builders, byte-identity pitfalls (`exportDate`, key order), html2canvas notes, PNG background conflict |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `/Users/moises/Documents/Code/RoadmapSnap/CLAUDE.md`, `AGENTS.md` and `.claude/CLAUDE.md`. Treated with the authority of locked decisions.

- All changes go through a PR from a branch; never commit to `main`. Commit subjects follow `type(scope): summary`.
- Never commit `js/config.js` or any `js/config_*.js` other than `js/config_base.js`. Never commit `.env` files or `.webui_secret_key`.
- Lite must stay backend-free; `npm test`, `npm run validate`, `npm run build` stay green. Sharing code must not add a runtime dependency on SaaS.
- `npm run validate` and `npm run build` read `js/config.js` and fail without it (copy `js/config_base.js`). Root CI runs on Node (currently 20; D-16 moves to 24). `build:check` is not run by CI.
- Lite: state changes trigger a full `renderRoadmap()`; do not patch the DOM. UI modules return HTML strings via `html` template and `raw()`. `js/core/` must be pure.
- API handlers use `request.dbClient`; never open a connection from `pool`. AI/edits go through RLS and role checks.
- Stack: keep Fastify + PostgreSQL + Auth0, React + TanStack Query + Vite, vanilla ES modules for Lite. Extend, do not replace. Research also says: do not upgrade Vite, Vitest, Tailwind or React in this milestone.
- Style: Lite 4 spaces, semicolons, match the file style (`var`/`function` in `js/core`, `js/ui`). API 2 spaces, semicolons, single quotes. App 2 spaces, no semicolons, single quotes, `import type`, `strict` + `noUnusedLocals` + `noUnusedParameters`; run `npx tsc --noEmit` in `packages/app`.
- Error body shape for API routes is `{ error, message }`. Core functions return `null` or empty values for invalid input rather than throwing.
- Tokens: do not hardcode colors that exist as tokens (but UI-SPEC Planner Note 8: keep Lite's hardcoded hex values verbatim when moving theme CSS).
- "Fix logic bugs in both" rule (AGENTS.md, `.claude/CLAUDE.md`, `docs/monorepo.md`) must be retired once `packages/app/src/lib` is deleted.
- Package manager: npm, lockfileVersion 3. Never edit an applied migration (this phase needs none).
- GSD workflow enforcement: file edits happen through GSD commands, not directly.

## Summary

The phase has two halves with very different risk profiles. The core-extraction half is mechanical but larger than the roadmap implies: `js/core/` has about 40 call sites that read `CONFIG`, `window.*` or `document` (inventory below), several functions that silently ignore an explicitly passed `today` (so a pure refactor will *change* behavior unless characterized first), and two hard-coded milestone keys (`'START'`, `'M3'`) in the red-dependency logic. The existing TypeScript copies in `packages/app/src/lib` have drifted from Lite in at least 20 concrete ways (inventory below), including missing features (quarter/half-year timeline headers, non-filterable groups, effective at-risk in KPIs), different output shapes, locale-dependent date formatting and different export formats. Deleting `lib` is safe only after those differences are resolved in favor of Lite.

The view half is dominated by one structural risk: **Lite is the oracle, and after the CSS moves into `packages/tokens` both products consume the same CSS**, so a regression introduced by the CSS move is invisible to a Lite-vs-SaaS diff. The plan needs a one-time Lite(base ref) vs Lite(HEAD) comparison for the CSS-move plan. The rest of the view risk is containable: disable Tailwind preflight, scope Lite's `* {margin:0; padding:0; box-sizing:border-box}` reset with `:where(.lite-area) *` (zero specificity, so cascade order is unchanged), keep the SaaS header non-sticky, render React from core view models with the Lite class names, and draw dependency arrows from a pure core function so Lite and SaaS cannot diverge.

Three findings change the plan as written in CONTEXT/STACK and are surfaced as open questions: (1) `npm ci --workspaces=false` does **not** create the `@roadmapsnap/core` symlink, so a Lite that imports the bare specifier fails to resolve under it (verified in a scratch repo); use `npm ci -w packages/core --include-workspace-root` instead. (2) `tests/fixtures/config.complex.js` is a 0-byte file, so the parity fixtures must be authored in Wave 0. (3) A required GitHub status check whose workflow is skipped by path filtering stays "Pending" and blocks merges, so D-11 and CORE-03 need an always-run workflow, not `paths:` filters.

**Primary recommendation:** Characterize Lite's current behavior with tests first, then extract `packages/core` bottom-up with Lite `js/core/*` as thin bindings (existing tests stay green untouched), move view-derivation logic out of `js/ui/*` into core model builders so both renderers are dumb mappers, move all theme CSS to tokens verified by a base-vs-head Lite diff, and build the Playwright parity harness (live Lite vs live SaaS, pixelmatch, one pinned image) in the same phase as the React view.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timeline/workflow/dependency/stats/filter/view-model/export-builder logic | Shared core (`packages/core`, pure JS) | — | Single source of truth for both products; no DOM, no state, no globals (D-14) |
| API-row to Lite-config shape conversion (`apiToRoadmap`) | Shared core | App (calls it at the data edge) | One canonical DD/MM/YYYY parse/format (D-15); the parity test uses the same function |
| Lite HTML rendering (`html` template strings) | Lite UI (`js/ui`) | — | Oracle; consumes core models; markup unchanged |
| SaaS rendering (React components emitting Lite markup) | Browser / Client (`packages/app`) | — | D-01: React maps core models to the same DOM and classes |
| Dependency arrow geometry, color, tooltip text | Shared core (pure, takes measured rects) | Browser (measures rects, draws SVG) | Only the measuring is DOM; everything decided is pure, so VIEW-03 cannot diverge |
| Theme CSS, fonts, design tokens | CDN/Static (`packages/tokens`, bundled by Vite) | — | Both products import the same CSS (D-05) |
| Theme persistence | API (`PATCH /auth/me`, `users.preferences`) | Browser (localStorage cache, pre-paint script) | D-06; API must accept 8 values |
| PNG export | Browser (html2canvas on the DOM) | — | DOM-bound; not in core |
| Screenshot parity | CI (Playwright in pinned image) | — | D-08..D-11 |
| Workspace/lockfile/Node alignment | Repo tooling (root `package.json`, workflows, Dockerfile) | — | D-16 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `packages/core` (`@roadmapsnap/core`) | new, `1.0.0` | Pure shared logic, plain ESM JS + JSDoc | Locked by D-14. `.d.ts` generation verified by scratch spike (below) |
| npm workspaces | npm 11.x (local 11.20.0) | One root lockfile, workspace linking | Locked by D-16. Install matrix verified in scratch repo |
| TypeScript | `^5.7` (installed 5.9.3 in app) | `tsc --checkJs` for core, `emitDeclarationOnly` for `.d.ts` | Already the repo's type checker; do not adopt TS 7 (registry shows 7.0.2) this milestone |
| Tailwind CSS | 3.4.19 (installed) | SaaS chrome utilities only | Existing; `darkMode: ['selector', ...]` exists since 3.4.1 `[CITED: v3.tailwindcss.com/docs/dark-mode]`; `corePlugins.preflight: false` `[CITED: v3.tailwindcss.com/docs/preflight]` |
| Vite | root `^7.3.1`, app `^5.4.0` (installed 5.4.21) | Lite build, app build | Do not upgrade (research constraint) |
| Vitest + jsdom + RTL | 2.1.9 / 25 / 16 (installed) | App unit tests and golden-markup test | Existing |
| html2canvas | 1.4.1 | PNG export | Same version in Lite (CDN) and app (npm) |

### Supporting (new dev dependencies for the parity suite)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | exact pin `1.64.1` (published 2026-10-14; `latest` is 1.65.1, published 2026-11-13) | Browser automation, `page.route`, `page.clock` | Parity suite, in a new private workspace `packages/parity` so Lite/API installs never pull it |
| `pixelmatch` | `8.0.0` (ESM, default export) | Per-pixel diff of two PNG buffers | Playwright has no baseline-free two-image compare (`toHaveScreenshot` is baseline-based); Playwright itself uses pixelmatch `[CITED: playwright.dev/docs/test-snapshots]` |
| `pngjs` | `7.0.0` (CJS) | Decode PNG buffers to RGBA for pixelmatch | `[ASSUMED]` package name came from a web search; gate with a human-verify checkpoint |
| `@fontsource/dm-sans` | `5.3.0` (OFL-1.1) | Self-hosted DM Sans woff2 for both products | `[ASSUMED]` from training knowledge, seam says OK. Alternative: vendor woff2 files into `packages/tokens/fonts/` (no dependency) |
| Docker image | `mcr.microsoft.com/playwright:v1.64.1-noble` | Pinned browser + fonts for parity | `[VERIFIED: docker manifest inspect]` tags `v1.64.1-noble` and `v1.65.1-noble` exist. Image tag must equal the npm package version `[CITED: playwright.dev/docs/docker]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@roadmapsnap/core` bare import in Lite | root `package.json` `"imports": {"#core": ...}` subpath alias, or relative `../../packages/core/src/index.js` | Zero-install resolution (works under `--workspaces=false`), but diverges from D-13 wording. Use only if install weight matters more than the locked wording |
| pixelmatch + pngjs | `odiff`, `looks-same` | Faster or font-tolerant, but extra unfamiliar tooling; the live same-container diff has no cross-OS font drift, so pixelmatch is enough |
| Committed baselines | — | Rejected by D-10 |
| `html2canvas` 1.4.1 | `html2canvas-pro` | Fork adds modern color functions (`oklch`). Not needed: Tailwind 3 and Lite CSS emit hex/rgb. Revisit only on a Tailwind 4 move |

**Installation (target state):**
```bash
# repo root, after adding "workspaces": ["packages/*"] and deleting the 3 per-package lockfiles
npm install                                             # regenerates the one root package-lock.json
npm install -D -w @roadmapsnap/parity --save-exact @playwright/test@1.64.1 pixelmatch@8.0.0 pngjs@7.0.0
npm install -w @roadmapsnap/tokens @fontsource/dm-sans   # optional; or vendor woff2
```

**Version verification (this session):** `npm view` returned `@playwright/test` 1.65.1 (latest) with `time["1.64.1"]` = `2026-10-14T11:58:13.696Z`; `pixelmatch` 8.0.0 (`"type": "module"`); `pngjs` 7.0.0 (engines `node >=14.19.0`); `@fontsource/dm-sans` 5.3.0 (`license` `OFL-1.1`); `html2canvas` 1.4.1.

## Package Legitimacy Audit

Run via `gsd_run query package-legitimacy check --ecosystem npm ...` this session.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@playwright/test` | npm | latest published 2026-11-13; 1.64.1 published 2026-10-14 | 139M/wk | github.com/microsoft/playwright | SUS (`too-new`, applies to `latest` 1.65.1) | Flagged. `@playwright/test` [WARNING: flagged as suspicious — verify before using.] Recommendation: pin the older `1.64.1`; planner still adds `checkpoint:human-verify` before the install |
| `pixelmatch` | npm | 11 yrs (created 2015) | 16.9M/wk | github.com/mapbox/pixelmatch | OK | Approved |
| `pngjs` | npm | 14 yrs | 113M/wk | github.com/pngjs/pngjs | OK | Approved, but tag `[ASSUMED]` (found by web search); gate behind a human-verify checkpoint |
| `@fontsource/dm-sans` | npm | latest 2026-07-19 | 1.16M/wk | github.com/fontsource/font-files | OK | Approved, tag `[ASSUMED]` (training knowledge); optional (vendoring woff2 avoids it) |
| `html2canvas` | npm | already a dependency of `packages/app` | 27M/wk | github.com/niklasvh/html2canvas | OK | Approved (existing) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@playwright/test` (age signal only; pin 1.64.1). `postinstall` check: seam reports `postinstall: null` for all five.

## Architecture Patterns

### System Architecture Diagram

```
                        DATA EDGE                           CORE (pure, no DOM/globals)                    RENDERERS
Lite   js/config.js (CONFIG global)                                                                    
         |  Lite binding reads CONFIG + AppState                                                         
         v                                                                                               
   explicit args --------------------------->  packages/core  ---------------------------------->  js/ui/* (html`` strings)  --> document.body
SaaS   GET /api/v1/workspaces/:id/projects          ^  dates.js  timeline.js  workflow.js                       ^
         | ISO dates, snake_case, null dates         |  dependencies.js  stats.js  filters.js                    | same class names / DOM tree
         v                                           |  viewModel.js  models.js (dashboard/timeline/filterBar)   | (golden-markup test)
   apiToRoadmap() --- Lite config shape ------------>|  arrows.js (pure geometry+color+title from rects)         |
                                                     |  export.js (buildCsv/buildJson)  defaults.js  icons.js    v
                                                     +---------------------------------------------------->  packages/app LiteRoadmapView (React)
                                                                                                                |  measures DOM rects (useLayoutEffect)
Theme:  users.preferences.theme <-- PATCH /auth/me    localStorage 'roadmapsnap-theme'  <-->  <html data-theme>  |  html2canvas (PNG)
CSS:    packages/tokens/{tokens.css, components.css, fonts}  --imported by-->  Lite (css/roadmap.css) AND app (index.css)

Parity (CI, pinned Playwright image):
  fixture --> [route js/config.js => "const CONFIG = {...}"] --> Lite preview ---screenshot---\
  fixture --> roadmapToApi() stub --> [route /api/*] --> SaaS parity entry ---screenshot-------+--> pixelmatch <= 0.1% px
```

### Recommended Project Structure
```
packages/
├── core/                      # @roadmapsnap/core  (plain ESM JS + JSDoc, zero deps)
│   ├── package.json           # "type":"module", exports {".": {types, default}}, scripts: test, typecheck, build:types
│   ├── tsconfig.json          # allowJs, checkJs, strict, noEmit
│   ├── tsconfig.build.json    # extends above; declaration, emitDeclarationOnly, outDir types (git-ignored)
│   ├── src/                   # index.js re-exports: dates, timeline, workflow, dependencies, stats, filters,
│   │                          #   viewModel, models, arrows, export, adapter, defaults, icons
│   └── tests/                 # node:test files, run by root `npm test` too
├── tokens/                    # + all 8 theme blocks, component theme overrides, fonts/
├── app/                       # components/lite/* (LiteFilterBar, LiteExportControls, LiteDashboard,
│                              #   LiteTimelineGrid, LiteDependencyArrows, LiteFooter, LiteRoadmapView), thin header
├── parity/                    # private: Playwright config, parity entry, golden-markup helpers
└── api/                       # + theme enum extension only
```

### Pattern 1: Pure core function with injected context (replaces `CONFIG`/`window` reads)
**What:** every function takes the data it needs, including `today`. No default that reads a global.
**When to use:** all of `workflow`, `dependencies`, `stats`, `filters`, `viewModel`.
```javascript
// packages/core/src/workflow.js  (JSDoc types drive tsc --checkJs and the generated .d.ts)
/** @typedef {{type:'state'|'milestone', key:string, short:string, title:string, description?:string, subtitle?:string}} WorkflowItem */

/** @param {WorkflowItem[]} workflow @returns {WorkflowItem[]} */
export function getMilestones(workflow) { return workflow.filter((i) => i.type === 'milestone'); }

/** Lite semantics: first key from the workflow, never a global. @param {WorkflowItem[]} workflow */
export function getFirstMilestoneKey(workflow) { return getMilestones(workflow)[0]?.key || 'START'; }
export function getLastMilestoneKey(workflow) { return getMilestones(workflow).at(-1)?.key || 'M4'; }
```
```javascript
// js/core/workflow.js  — Lite thin binding (keeps tests/core/workflow.test.js green UNCHANGED)
import * as core from '@roadmapsnap/core';
export function getMilestones() { return core.getMilestones(getWorkflow()); }   // getWorkflow still reads CONFIG here
export function getLastMilestoneKey() { return core.getLastMilestoneKey(getWorkflow()); }
if (typeof window !== 'undefined') { window.getMilestones = getMilestones; /* ... */ }
```

### Pattern 2: Move derivation out of renderers into core model builders
**What:** `js/ui/timelineGrid.js`, `dashboard.js`, `filterBar.js`, `grouping.js`, `dependencyArrows.js` and `js/app.js renderRoadmap` embed decisions (tooltip strings, dependency tooltip text, group ordering and stats, KPI breakdown text, milestone-card content, `atRiskInView`, `descopedInView`, month selection, KPI-from-search-only sources, header periods, grid-line percentages). Move each into `buildDashboardModel`, `buildTimelineModel`, `buildFilterBarModel`, `buildRoadmapModel` in core. Lite UI and React both map the model to markup.
**Why:** this is what makes pixel parity enforceable by construction; otherwise every embedded rule is a second copy waiting to drift (the exact failure of `packages/app/src/lib`).

### Pattern 3: Pure dependency-arrow computation, DOM only measures
```javascript
// core: no DOM. rects come from the caller (Lite DOM code, or React useLayoutEffect).
/** @returns {{d:string,color:string,markerId:string,title:string,type:'inbound'|'outbound'}[]} */
export function computeDependencyArrows({ edges, deliverables, workflow, months, today, rects, onlyRed }) { /* geometry, color rule, title text from dependencyArrows.js:131-264 */ }
```
Lite `drawDependencyArrows` and React `LiteDependencyArrows` both become: measure, call this, emit `<svg id="dependency-arrows-svg">` with `<g><path hover/><path class="dependency-arrow-{type}"/><title/></g>`. Hover width/opacity (`3`/`1`, `2`/`0.8`) is JS in Lite; reproduce with React state or CSS, and note `container.style.position = 'relative'` is set by JS only while arrows exist (`js/ui/dependencyArrows.js:284`).

### Pattern 4: Strangler with bindings (extraction order)
1. **Wave 0 (before any refactor):** workspaces + Node 24 + CI fixes + core skeleton + author `config.complex.js` + **characterization tests** for untested Lite behavior (see Validation Architecture).
2. **Wave 1:** `dates`/`timeline` -> `workflow` -> `dependencies` (explicit workflow keys and `today`) -> `stats` -> `filters` (extract `filterDeliverables`, `filterBySearchOnly`, `sortDeliverables`, filter-state transitions out of `filterBar.js`) -> `viewModel` (theme param) -> `export` builders. Lite `js/core/*` become bindings; run the 141 existing tests after every module.
3. **Wave 2:** model builders, `arrows`, icons/defaults; Lite `js/ui/*` call them. Lite output must be byte-stable (assert Lite HTML before/after with a snapshot string for both fixtures).
4. **Wave 3 (parallelizable with 1-2):** tokens CSS move + fonts + `html.dark` removal, verified by base-vs-head Lite diff; API theme enum; Node/workspaces/CI/Docker.
5. **Wave 4:** `apiToRoadmap`, React `components/lite/*`, page composition, theme bridge, delete `packages/app/src/lib` and superseded components.
6. **Wave 5:** golden-markup test, Playwright parity, CI parity job, docs (README, `docs/monorepo.md`, AGENTS.md, `.claude/CLAUDE.md`, ROADMAP/REQUIREMENTS theme count).

### Pattern 5: CSS isolation without changing the cascade
```css
/* packages/tokens/components.css (or a new lite-area.css imported before components.css) */
:where(.lite-area) *, :where(.lite-area) { margin: 0; padding: 0; box-sizing: border-box; }
body, .lite-area {                       /* shared selector list: Lite's body rules and the SaaS wrapper */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: var(--color-bg-page); color: var(--color-text-dark); line-height: 1.4; padding: 20px;
}
[data-theme="evergreen"] body, [data-theme="evergreen"] .lite-area { font-family: 'DM Sans', -apple-system, /* ... */ sans-serif; }
```
`:where()` has 0 specificity `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/:where]`, the same as Lite's bare `*`, so no existing rule wins or loses differently. A plain `.lite-area *` (0,1,0) would tie with `.kpi-card` and make source order decide (and would beat any element-only selector in `components.css`).
```ts
// packages/app/tailwind.config.ts
export default {
  darkMode: ['selector', '[data-theme="dark"]'],   // was 'class'
  corePlugins: { preflight: false },
  // ...
}
```

### Pattern 6: Parity harness (live Lite vs live SaaS)
```typescript
// packages/parity/tests/parity.spec.ts (sketch)
import { test, expect } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

async function shot(page, selector: string) { return PNG.sync.read(await page.locator(selector).screenshot()) }

test(`parity ${fixture} ${theme}`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 3000 }, timezoneId: 'UTC', locale: 'en-US' })
  await ctx.route(/^https?:\/\/(?!(localhost|127\.0\.0\.1))/, (r) => r.abort())         // no CDN / Google Fonts
  const lite = await ctx.newPage()
  await lite.clock.setFixedTime(new Date('2026-04-15T12:00:00Z'))                       // timers keep running
  await lite.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `const CONFIG = ${JSON.stringify(fixture)};` }))
  await lite.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await lite.goto(LITE_URL)
  const saas = await ctx.newPage()
  await saas.clock.setFixedTime(new Date('2026-04-15T12:00:00Z'))
  await saas.route('**/api/v1/**', (r) => r.fulfill({ json: stubFor(r.request().url()) }))   // from roadmapToApi(fixture)
  await saas.addInitScript((t) => localStorage.setItem('roadmapsnap-theme', t), theme)
  await saas.goto(SAAS_PARITY_URL)
  const a = await shot(lite, 'body'), b = await shot(saas, '.lite-area')
  expect([a.width, a.height]).toEqual([b.width, b.height])
  const diff = new PNG({ width: a.width, height: a.height })
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
  expect(bad / (a.width * a.height)).toBeLessThanOrEqual(0.001)                          // D-08
})
```
`page.clock.setFixedTime` freezes `Date` while timers keep running `[CITED: playwright.dev/docs/clock]` (do not use `clock.install` here: Lite draws arrows in `setTimeout`, which would never fire). Attach `diff` to the test output on failure.

### Anti-Patterns to Avoid
- **Shipping an auth bypass in the production bundle.** The parity SaaS entry must be a separate HTML entry served only by `vite --mode parity` or a `vite build --mode parity` into a different `outDir`, never part of the default `build` inputs. Phase 1 deliberately removed the API-side `X-Test-User-Sub` bypass.
- **Re-implementing a rule in React "because it is simple".** Every embedded rule in `js/ui` is a drift risk; move it to core.
- **Letting `todayStr` default to a global.** Several current functions ignore a passed `today` (inventory). A pure core has no defaults that read the clock; callers pass it.
- **A sticky SaaS header** (breaks Lite's `.filter-bar {position: sticky; top: 10px}` parity) and **`body { overflow-x: hidden; overflow-y: auto }`** from the app's current `index.css` (can turn `body` into the sticky scroll container; remove it or verify propagation).
- **Per-package `npm install`** after the migration: `npm ci` run inside `packages/app` installs the whole workspace tree (verified), so the old `cd packages/x && npm install` steps and `actions/cache` paths are wrong.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image diff | A custom pixel loop | `pixelmatch` (+ `pngjs` to decode) | Handles AA detection (`includeAA:false` default), threshold math; Playwright itself uses it |
| Time freezing | Monkey-patching `Date` in `addInitScript` | `page.clock.setFixedTime` | Covers `Date`/`performance`, keeps timers alive `[CITED: playwright.dev/docs/clock]` |
| Network isolation | Offline Docker flags | `context.route(non-localhost, abort)` | Deterministic, per-test, blocks CDN html2canvas and Google Fonts |
| `.d.ts` for the core | Hand-written `.d.ts` | `tsc -p tsconfig.build.json` (`emitDeclarationOnly`) | Verified spike below; JSDoc stays the single source |
| Pre-paint theme flash | React effect | Blocking inline script in `packages/app/index.html` | Runs before first paint (UI-SPEC) |
| CSS isolation | Shadow DOM / iframe | `:where(.lite-area)` reset + preflight off | Keeps the same DOM/CSS (D-01), html2canvas and getBoundingClientRect keep working |
| Self-hosting fonts | Hand-rolled downloader | `@fontsource/dm-sans` or vendored woff2 + `@font-face` in tokens | OFL font, hashed by Vite for both products |
| Date handling | A date library | Core `dates.js` (string ops + local `Date`) | Lite semantics are local-midnight `new Date(y, m-1, d)`; a library would change DST/rollover behavior |
| HTML escaping in React | A custom escaper | JSX text/attrs | React escapes; only constant SVG strings (icons) may use `dangerouslySetInnerHTML` |

**Key insight:** the bug source in this phase is *two copies of a rule*, not a missing library. Every "simple" re-implementation in React or in the harness recreates the drift problem the phase exists to remove.

## Impurity Inventory: `js/core/` (concrete, per function)

All `[VERIFIED: file:lines]` from files read this session. "Global" means a read of `CONFIG`, `window.*` or `document`, or a bare implicit global.

**`js/core/timeline.js`**
- `getTodayDate` (40-49): reads `CONFIG.TIMELINE.TODAY` (41-42), then `new Date()` (44).
- `generateMonths` (61-75): reads `CONFIG.TIMELINE.START_MONTH` / `END_MONTH` (63-64).
- Module scope (198-209): unconditional `window.* = ...` (throws without a `window`; tests set `globalThis.window = {}`).
- Pure already: `parseDate`, `formatDateDisplay`, `formatShortDate`, `darkenColor`, `parseMonthYear`, `getMonthName`, `generateVisibleMonthsForZoom(today, count)`, `getHalfYearIndex`, `getTimelineHeaderPeriods(months)`, `calculatePosition(dateStr, months)`, `isDateInRange(dateStr, months)`. (`darkenColor` is referenced only by `tests/core/timeline.test.js`; keep it exported from the binding.)

**`js/core/workflow.js`**
- `getWorkflow` (27-51): `CONFIG.WORKFLOW`, `CONFIG.MILESTONES` legacy fallback building a synthetic workflow (31-49). Core needs `normalizeWorkflow(config)` carrying this fallback.
- `getStates`, `getMilestones`, `getStateByKey`, `getMilestoneByKey` (53-71): via `getWorkflow()` (CONFIG).
- `getStateAfterMilestone`, `getFirstState`, `getLastState` (73-97): optional `workflowOverride`, else CONFIG.
- `getNonFilterableGroups` (99-101): `CONFIG.NON_FILTERABLE_GROUPS`; `isGroupNonFilterable`, `isDeliverableNonFilterable` (103-110) via it.
- `getFilterableDeliverables` (112-114): `CONFIG.DELIVERABLES`.
- `getFirstMilestoneKey` (116-119) / `getLastMilestoneKey` (121-124): via CONFIG; fallbacks `'START'` and `'M4'`.
- `getMilestoneDate` (126-140): derives `firstKey` from CONFIG inside `try/catch` (falls back to `'START'`), **even when a `workflowOverride` is in play** in its callers. Variant semantics: `milestones[key]` else (`key === firstKey` and `startDate`). No `milestones.START` alias here (the dependency module has one).
- `getNextMilestone`, `getCurrentStatus` (142-172): `parseDate` via `window.parseDate`, today via `window.getTodayDate()` or local fallback; `workflowOverride` optional else CONFIG; `getMilestoneDate` inside uses the CONFIG-derived `firstKey`.
- Module scope (175-193): guarded by `typeof window !== 'undefined'`.

**`js/core/dependencies.js`**
- `getTodayDateLocal` (23-32): `CONFIG.TIMELINE.TODAY` else `new Date()`.
- `getAllDataSources` (36-40): `CONFIG.DELIVERABLES` when no override.
- `getOutboundDependencyNames(source)` (101) and `hasDependencies(source)` (106): **no override parameter**, always read CONFIG.
- `getDependencyGraph(sourceName, override)` (125-187): the override is honored for `sourceMap`, but `traverseOutbound` calls `getOutboundDependencies(current)` **without the override** (line 168), so with an override the outbound half still reads CONFIG.
- `getBlockedByRedDependencySet` / `getRedDependencyEndpointSet` (218-272): hard-coded milestone keys, quoted verbatim:
  - lines 221-222: `const firstMilestoneKey = 'START';` / `const lastMilestoneKey = 'M3';`
  - lines 249-250: the same two constants.
  They ignore the workflow, and take today only from `getTodayDateLocal()`.
- `getEffectiveAtRiskSet(override)` (275-283): pure given `override`, but inherits the red-set today/keys.
- Module scope (286-301): guarded.

**`js/core/stats.js`**
- `getVisibleDataSources` (11-16): `CONFIG.DELIVERABLES`, **bare globals** `filterDeliverables`, `sortDeliverables` (only defined via `window` from `js/ui/filterBar.js`).
- `getAllVisibleDataSources` (19-21): `CONFIG.DELIVERABLES`.
- `getFilterableDeliverablesFrom` (23-27): falls back to `CONFIG.NON_FILTERABLE_GROUPS`.
- `calculateStats` (31-105): every default reads CONFIG / `window.getTodayDate` / `getWorkflow()` (32-35). **Behavioral trap:** `getEffectiveAtRiskSet(allSources)` (38) uses `getTodayDateLocal()`, so a `todayStr` passed to `calculateStats` is **ignored for the red-dependency part of the at-risk KPI**.
- `getUpcomingMilestones` (108-139): bare globals `parseDate`, `getTodayDate`, `isGroupNonFilterable` (none imported; only `getCurrentStatus, getStates, getLastState, getWorkflow, getMilestones, getMilestoneDate` are), plus `getMilestones()` and `getAllVisibleDataSources()` (CONFIG). It cannot run in plain Node, so it has **no tests today**.
- Inconsistency to preserve (characterize it): `visibleSources` uses `showInTimeline !== false` (41) but the per-status split uses a truthy check `if (source.showInTimeline)` (83), so a deliverable with `showInTimeline` undefined counts as visible in `visible` but as hidden in `visibleByStatus`/`hiddenByStatus`.

**`js/core/viewModel.js`**
- `isMonochromeTheme` / `isPapallonaTheme` / `isEvergreenTheme` (34-47): `document.documentElement.getAttribute('data-theme')`.
- `resolveStateColor` (49-64): theme via those + `getStates()` (CONFIG). Palette order is monochrome, papallona, evergreen, else the light palette (dark/professional/colorful/blank use the light palette in Lite).
- `buildMilestoneMarkers`, `buildGanttSegments` (80-159): `getFirstMilestoneKey()`, `getMilestoneDate`, `getMilestoneByKey` (CONFIG).
- `buildDependencyClass` (161-167): `getDependencyGraph(activeDependencyGraph)` (CONFIG).
- `buildDeliverableViewModel` (169-196): `getCurrentStatus(source)`, `getStateByKey`, `getStates`, `getMilestones`, `getEffectiveAtRiskSet()` default, `getDependencyType`, `getInboundDependencies`, `getOutboundDependencies` (all CONFIG/today globals).
- Module scope (198-200): **unguarded** `window.* =`.
- `stateColor`/`stateTextColor` are produced but **no renderer consumes them** (grep over `js`, `packages/app/src`, `tests`: only `viewModel.js` mentions them; the UI uses `state-N` CSS classes). Keep them with an explicit `theme` parameter; they carry no parity risk.

**Outside `js/core/` but extraction targets (read CONFIG/AppState/window/DOM):**
- `js/ui/filterBar.js`: `filterDeliverables` (13-44), `filterBySearchOnly` (47-58), `sortDeliverables` (60-92) read `AppState` + CONFIG; `updateFilter` (94-119), `filterByStatus`, `clearStatusFilterOnOutsideClick`, `toggleRiskFilter`, `toggleDescopedFilter` embed the filter-state transition rules; `renderFilterBar` reads `CONFIG.ENTITY_LABELS` (171) and `window.escapeHtmlAttr` (177).
- `js/ui/grouping.js`: `expandAllGroups`, `collapseAllGroups`, `expandGroupsForDependencyGraph` read `CONFIG.DELIVERABLES` + `AppState`; `groupDeliverables`, `hasAnyGroups`, `getGroupStats` (uses raw `s.atRisk`, not effective) are pure.
- `js/ui/dashboard.js` (23-26): `CONFIG.ENTITY_LABELS`, `CONFIG.DASHBOARD_TEXT`; reads global `riskIconSVG`.
- `js/ui/timelineGrid.js` (109, 121): `CONFIG.ENTITY_LABELS`, `CONFIG.GROUP_ORDER`; `AppState.get()` inside row rendering; tooltip, dependency-tooltip, group-order and group-stats logic is embedded here.
- `js/ui/dependencyArrows.js`: DOM drawing with decisions embedded (arrow color rule 225-239, curve 198-208, title text 260).
- `js/export/csv.js`, `json.js`: read `CONFIG.DELIVERABLES`, `CONFIG.TIMELINE`; JSON uses `new Date().toISOString()`.
- `js/app.js` `renderRoadmap` (94-127): month selection, `todayPosition`, `atRiskInView`, `descopedInView`, KPI-from-search-only branch; `setDateRange` (46-58) mutates `CONFIG.TIMELINE.START_MONTH/END_MONTH`.
- `js/roadmap.utils.js`: duplicate IIFE of `parseDate`, `formatDateDisplay`, `formatShortDate`, `darkenColor`, `getTodayDate`; delete after the binding exists.

## Drift Inventory: `js/core` (+ `js/ui`/`js/export`) vs `packages/app/src/lib` (concrete)

Read this session. "Resolution" is the recommended core behavior (Lite wins; where Lite is internally inconsistent, noted). Files: `lib/timeline.ts`, `stats.ts`, `projectFilters.ts`, `timelineSort.ts`, `dependencyGraph.ts`, `export.ts`, `themeStorage.ts`.

| # | Area | Lite | App `lib` | Resolution |
|---|------|------|-----------|------------|
| D1 | `parseDate` | no validation, always returns a `Date` (rollover; `Invalid Date` on garbage) | returns `null` for month outside 1..12, day < 1, non-finite; `timeline.ts` requires `parts.length < 3` fails, `stats.ts` requires `!== 3` (TS copies disagree) | Canonical `parseDDMMYYYY`: `null` for malformed, native rollover for day > month length. Lite tests only cover valid, empty, null, undefined |
| D2 | `formatDateDisplay` / `formatShortDate` malformed input | `parseInt` of garbage gives `NaN undefined`-style strings | returns `''` | `''` on malformed |
| D3 | `parseMonthYear` malformed | `Invalid Date` | silently falls back to January of the *current year* (nondeterministic) | `null`; `generateMonths` returns `[]` |
| D4 | today | `getTodayDate` honors `CONFIG.TIMELINE.TODAY` | `getTodayStr()` always real now; `GanttTimeline` passes `new Date()` to zoom | `today` is an explicit argument everywhere; adapter option can carry a fixed `TODAY` |
| D5 | `isDateInRange` | takes a `DD/MM/YYYY` string | takes a `Date` | string (Lite); Date variant internal |
| D6 | header periods | `getTimelineHeaderPeriods`: months if <= 12, quarters if 13-36, half-years if > 36 | absent; monthly columns always | Port from Lite; this alone breaks parity for ranges > 12 months (e.g. `config_base` 05/2025-07/2026 is 15 months) |
| D7 | zoom | values `'3mo'`,`'6mo'`,`'12mo'`,`'all'`; `'all'` = `CONFIG.TIMELINE` range | `'3m'`,`'6m'`,`'12m'`,`'all'`; `'all'` uses `settings.start_month ?? '01/2026'`, `end_month ?? '12/2026'` | Lite values; see Open Question 4 for the missing-settings default |
| D8 | milestone date fallback | three variants inside Lite (`workflow.js`: key then `startDate`; `dependencies.js`: key, `milestones.START` alias, `startDate`) | `stats.ts`: key then `START` alias; `timeline.ts`: key, `startDate`, `START`; `projectFilters.ts`: `START` alias only | One `getMilestoneDate(source, key, firstKey)` = key, then (if first) `START` alias, then `startDate`. Differs from Lite only when first key is not `START` and `milestones.START` exists |
| D9 | red-dependency keys | hard-coded `'START'`/`'M3'` (`dependencies.js:221-222, 249-250`), while the arrows code uses real workflow keys (`dependencyArrows.js:109, 143-145`) | derives first/last from the workflow | **Open Question 1.** Recommended: derive from workflow |
| D10 | red-dependency today | `CONFIG.TIMELINE.TODAY` else now | real now at midnight | explicit `today` |
| D11 | dependency graph | `nodes` is an `Array`; edges carry `null` milestones; self-dependency included; `traverseOutbound` ignores the override | `nodes` is a `Set`; edges `undefined`; outbound skips `p.id === current.id` | Array + `null` (Lite); consumers use `indexOf` (`viewModel.js:165`) |
| D12 | dependency type | `'none'` when no deps | `null` | `'none'` |
| D13 | KPI stats | `calculateStats` returns `total, visible, hidden, atRisk (effective), descoped, visibleByStatus, hiddenByStatus, stateKeys, per-state counts at top level, completionPercentage, productionReadyPercentage`; excludes `NON_FILTERABLE_GROUPS`; at-risk counts effective (config OR red-blocked); rebuilt from search-filtered sources when a name search is active | returns `total, atRisk (raw at_risk only), descoped, completionPercentage, visibleByStatus (counts ALL non-descoped), stateKeys`; no groups, no `visible/hidden/hiddenByStatus/productionReady` | Lite shape and formulas |
| D14 | upcoming milestones | every milestone key present (`null` when none); skips non-filterable groups; `atRisk` is effective; date compare `>= today` | omits keys with no match; no group exclusion; raw `at_risk` | Lite |
| D15 | filters | `filterDeliverables`: non-filterable groups dropped when status != ALL; risk-only = effective at-risk OR red endpoints; search over name and tags, untrimmed (a trimmed variant `filterBySearchOnly` exists for KPIs) | `applyProjectFilters`: no group rule; `trim()` only for the emptiness check; list/timeline "mode" concept | Lite |
| D16 | sort | `m3date` uses `getMilestoneDate(a, lastKey)` incl. `startDate` fallback; far-future `new Date(9999, 11, 31)` for missing | reads `milestones[last]` only | Lite; stable sort so API row order is the tie-breaker |
| D17 | grouping | groups sorted by `GROUP_ORDER` else `Object.keys(groups).sort()`; **ungrouped rows render after all groups**; group header shows `N items` and `(M at risk)` using raw `atRisk` | `group_name ?? '(No group)'` is sorted *as a group*; order from `settings.group_order` | Lite; adapter maps `settings.group_order` to `GROUP_ORDER` |
| D18 | CSV | headers `Name, Group, Current State, Next Milestone, At Risk, Tags, Link, <KEY> Date...`; file `deliverables.csv`; group/link not quote-escaped | headers without `Next Milestone`, plus `Descoped`; file `roadmap-projects.csv` | Lite builder, Lite filename |
| D19 | JSON | `{exportDate, timeline, workflow, states, milestones, deliverables:[{...source, currentState, nextMilestone}]}`; file `deliverables.json` | `{exportDate, workspace, workflow, states, milestones, projects}`; file `roadmap-projects.json` | Lite builder; `exportDate` injected |
| D20 | PNG | `html2canvas(el, {scale:2, backgroundColor:'#ffffff', logging:false, useCORS:true})`, file `${prefix}-${today with / replaced by -}.png`, disables `.export-btn` with `opacity 0.6` | same options | see Open Question 2 (UI-SPEC wants the resolved page color) |
| D21 | key milestones date text | `formatShortDate` -> `15 Mar 2026` | `KeyMilestones.tsx` uses `toLocaleDateString(undefined, ...)` (locale dependent) | core `formatShortDate` |
| D22 | field and view-model shapes | `atRisk`, `showInTimeline`, `group`, `link`; segments `{left, width, segmentClass, isFuture}`; has `buildDeliverableViewModel`, `dependencyClass` | `at_risk`, `show_in_timeline`, `group_name`, `external_link`; segments `{startPct, widthPct, ...}`; no view model | Lite shapes; the adapter (D-15) is the only snake_case boundary |
| D23 | theme | 8 themes via `data-theme` | `html.dark` for light/dark only | D-05/D-07 |
| D24 | `getEffectiveAtRiskSet` | at-risk OR red-blocked | same in `timelineSort.ts`, but `stats.ts` ignores it | Lite everywhere |

`packages/app/src` files importing `lib/*` (must all be rewritten or deleted): `components/dashboard/KpiCards.tsx`, `layout/ThemeToggle.tsx`, `projects/ProjectList.tsx`, `timeline/{DependencyArrows,FloatingTimelineFilterBar,GanttBar,GanttTimeline,KeyMilestones,MilestoneMarker,TimelineToolbar}.tsx`, `main.tsx`, `pages/DashboardPage.tsx` `[VERIFIED: grep this session]`.

## Runtime State Inventory

This phase is partly a migration (lockfiles, theme mechanism). Answers per category:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `users.preferences` JSONB default `{"theme":"light"}` (`V5__user_preferences.sql`); existing values are only `light`/`dark`, both valid in the new 8-value set | Code edit only (API enum, client type). No data migration |
| Live service config | None. No external service stores theme or paths | None |
| OS-registered state | None | None |
| Secrets/env vars | None changed. The parity harness needs no secrets | None |
| Build artifacts / installed packages | Three per-package `package-lock.json` files (root, `packages/api`, `packages/app`) become one root lockfile. `packages/api/Dockerfile` does `COPY package.json package-lock.json ./` + `npm ci --omit=dev` from the `packages/api` context; `compose.yaml` uses `build: ./packages/api`; `packages/api/.dockerignore` lives in that context. CI caches key off `packages/api/package.json` and `packages/app/package-lock.json`. Stale `dist/` and nested `node_modules` | Code edit: Dockerfile + compose build context to repo root, CI install commands/caches, `.gitignore` for `packages/core/types`; delete old lockfiles and reinstall |
| Browser state | localStorage `roadmapsnap-theme` (both products already use this key; existing `light`/`dark` values remain valid; Lite also maps legacy `dsm-firmenich`) | Pre-paint script must allowlist the 8 values and map the legacy value |

## Common Pitfalls

### Pitfall 1: The CSS move can regress Lite invisibly
**What goes wrong:** Theme blocks move from `css/roadmap.css` (after the `@import`s) into `packages/tokens`. Relative order against `components.css` changes, and equal-specificity rules can flip. Lite-vs-SaaS parity passes because both use the same CSS.
**Why:** the oracle shares the thing under change.
**How to avoid:** for the CSS-move plan, build Lite at the base commit and at HEAD (a `git worktree`) and diff them with the same harness (8 themes x 2 fixtures). Keep `:root`, then theme variable blocks, then component rules, then theme component overrides in that order. Keep hard-coded hex values verbatim (UI-SPEC Planner Note 8).
**Warning signs:** any pixel diff in a Lite-vs-Lite run.

### Pitfall 2: `npm ci --workspaces=false` does not link workspace packages
**What goes wrong:** Verified in a scratch repo: with `--workspaces=false` only root dependencies install and `node_modules/@x/core` does not exist, **even when the root `package.json` lists the workspace package as a dependency**. A Lite that imports `@roadmapsnap/core` (D-13) fails to resolve in CI and in `node --test`.
**How to avoid:** Lite CI uses `npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root` (verified to link `core`, install root devDependencies, and skip app/api). API CI: `npm ci -w @roadmapsnap/api` (verified pattern: installs the workspace and linked siblings, omits root devDependencies). App CI: `npm ci -w @roadmapsnap/app`.
**Warning signs:** `ERR_MODULE_NOT_FOUND: @roadmapsnap/core` in the Lite job.

### Pitfall 3: Required check + path filter = merge blocked
**What goes wrong:** D-11 makes parity a required check on PRs touching specific paths. GitHub leaves a required check "Pending" when its workflow is skipped by path filtering, which blocks merging `[CITED: docs.github.com troubleshooting-required-status-checks (search result summary); community discussion 44490]`. CORE-03's fix of `ci.yml` has the same shape.
**How to avoid:** no `paths:`/`paths-ignore:` on required workflows. Run always; the first step computes changed files (`git diff --name-only origin/$BASE...HEAD`) and short-circuits the heavy steps, so the job still reports success. A job skipped by an `if:` reports success and does not block `[CITED: same docs]`.

### Pitfall 4: Native `title` tooltips are not in screenshots
**What goes wrong:** D-09 lists "a dependency tooltip open". Lite's tooltips are native `title` attributes and SVG `<title>` children; OS-rendered tooltips are not part of the page raster `[ASSUMED]`.
**How to avoid:** pixel-compare the *active dependency graph* state (arrows drawn, rows `dependency-active/highlight/dimmed`, optionally hovered arrow), and assert tooltip text through DOM equality (golden-markup test compares `title` text and SVG `<title>` text). See Open Question 3.

### Pitfall 5: Byte-identical export needs canonical fixtures
**What goes wrong:** Lite JSON spreads `...source` (all keys, config order) and embeds `timeline: CONFIG.TIMELINE` and `exportDate: new Date().toISOString()`. The SaaS path goes fixture -> API rows -> `apiToRoadmap`, so key order, absent-vs-present keys (`link`, `startDate`, `descoped`), `TIMELINE.TODAY` and the date break byte equality.
**How to avoid:** inject `now` into `buildJson`; author fixtures in adapter-canonical form (same keys, same order); add a round-trip property test `apiToRoadmap(roadmapToApi(cfg))` deep-equals `cfg`. `roadmapToApi` lives in test utilities. Null API dates map to omitted keys (UI-SPEC).

### Pitfall 6: Lite filter bar `position: sticky` and the wrapper
**What goes wrong:** sticky sticks within its containing block. With `.lite-area` as the parent the bar sticks for the whole area, matching Lite's `body`. A scroll container between them (for example `body {overflow-y:auto}` plus `html` overflow) breaks it.
**How to avoid:** keep `.filter-bar` a direct child of `.lite-area`; do not set overflow on `html`/`body`/`#root`; use a tall fixed viewport in screenshots (no scrolling), and add one explicit scrolled-state parity check.

### Pitfall 7: `evergreen` font rule targets `body`
`[data-theme="evergreen"] body { font-family: 'DM Sans', ... }` (`css/roadmap.css:234-235`). If `.lite-area` sets its own `font-family`, the rule never reaches it. Use shared selector lists (Pattern 5), and add `[data-theme="dark"] body` equivalents.

### Pitfall 8: Search input identity and focus
Lite re-renders `document.body.innerHTML` on every change and restores focus with the caret at the end after a 150 ms debounce (`filterBar.js:94-107`). In React the input must keep its identity across renders (do not remount `LiteFilterBar` on state change); drive focus restore only when the debounced commit fires.

### Pitfall 9: Document-level click handlers
`clearStatusFilterOnOutsideClick` and `clearDependencyGraphOnClickOutside` are `document` listeners with different exclusion lists (`filterBar.js:137-150`, `dependencyArrows.js:35-47`). Register once on mount, remove on unmount, and port both exclusion lists exactly (UI-SPEC lists them). Also port `toggleDependencyGraph` side effects: expand groups containing graph nodes and **reset the filter** to `{status:'ALL', riskOnly:false, descopedOnly:false, search:''}` (`dependencyArrows.js:23-25`).

### Pitfall 10: html2canvas specifics
- Lite loads html2canvas from a CDN (`index.html`); the app bundles 1.4.1. Offline Playwright aborts the CDN, so Lite PNG is untestable in the parity run (acceptable: PNG is smoke-tested on SaaS only).
- 1.4.1 cannot parse modern color functions such as `oklch()` `[CITED: github.com/niklasvh/html2canvas issues 3150, 3269 via search]`. Tailwind 3.4 and Lite CSS emit hex/rgb/gradients, so this is fine; it blocks any Tailwind 4 upgrade.
- Wait for `document.fonts.ready` before capture so DM Sans is not substituted in the canvas.
- Smoke test per theme: trigger the download, assert PNG signature and non-zero size, sample the corner pixel against the resolved `--color-bg-page` (UI-SPEC requirement).

### Pitfall 11: Unsafe tenant data in markup
`info-link href="${vm.link}"` in Lite allows any URL scheme. In SaaS, `external_link` is tenant data and the API accepts any string (`packages/api/src/routes/projects.js:51`: `external_link: { type: 'string' }`). React 18 does not block `javascript:` URLs `[ASSUMED]`. Allowlist `http:`/`https:` in a core helper used by the React component; validate on write in the API as well (small change, the project modals exist today).

### Pitfall 12: Playwright/pixelmatch mechanics
`pixelmatch` throws on size mismatch: assert equal dimensions first. Screenshot Lite `body` against SaaS `.lite-area` (both carry the 20px padding and page background). Block external requests. Pass `timezoneId` and `locale`. `Playwright` image tag must match the npm version exactly. The `v1.65.1-noble` image installs Node 26 (`Dockerfile.noble`: `ARG NODE_VERSION=26`) `[CITED: raw.githubusercontent.com/microsoft/playwright/v1.65.1/utils/docker/Dockerfile.noble]`, independent of D-16's Node 24 for the other jobs.

## Code Examples

### `.d.ts` generation and consumption (spike verified with TS 5.9.3)
```json
// packages/core/package.json
{ "name": "@roadmapsnap/core", "version": "1.0.0", "type": "module",
  "exports": { ".": { "types": "./types/index.d.ts", "default": "./src/index.js" } },
  "scripts": { "typecheck": "tsc -p tsconfig.json", "build:types": "tsc -p tsconfig.build.json", "test": "node --test tests/*.test.js" } }
// tsconfig.json: {"compilerOptions":{"allowJs":true,"checkJs":true,"noEmit":true,"strict":true,"target":"ES2022","module":"ESNext","moduleResolution":"bundler"},"include":["src"]}
// tsconfig.build.json: {"extends":"./tsconfig.json","compilerOptions":{"noEmit":false,"declaration":true,"emitDeclarationOnly":true,"outDir":"types"}}
```
Spike result: `tsc -p tsconfig.json` and `tsc -p tsconfig.build.json` both exit 0, emit `types/index.d.ts` with JSDoc typedefs, and an app file importing the package through a workspace symlink type-checks, and a deliberate wrong-argument call is caught `[VERIFIED: scratch experiment this session]`. Add `packages/core/types/` to `.gitignore`; app CI runs `npm run build:types -w @roadmapsnap/core` before `tsc --noEmit` (a `typecheck` script in the app can chain both).

### `apiToRoadmap` shape (D-15)
```javascript
/** @param {{workspace: ApiWorkspace, projects: ApiProject[]}} payload @param {{today?: string}} [opts] */
export function apiToRoadmap({ workspace, projects }, opts = {}) {
  const s = workspace.settings ?? {};
  return {
    TIMELINE: { START_MONTH: s.start_month, END_MONTH: s.end_month, ...(opts.today ? { TODAY: opts.today } : {}) },
    ENTITY_LABELS: { ...DEFAULT_ENTITY_LABELS, ...workspace.entity_labels },
    DASHBOARD_TEXT: { ...DEFAULT_DASHBOARD_TEXT, ...workspace.dashboard_text },
    WORKFLOW: workspace.workflow_definition,
    GROUP_ORDER: Array.isArray(s.group_order) ? s.group_order : undefined,
    DELIVERABLES: projects.map((p) => ({             // keep API order: display_order, name
      name: p.name, atRisk: p.at_risk, descoped: p.descoped, showInTimeline: p.show_in_timeline,
      group: p.group_name ?? undefined, tags: p.tags, link: p.external_link ?? undefined,
      milestones: Object.fromEntries(Object.entries(p.milestones ?? {}).filter(([, v]) => v).map(([k, v]) => [k, isoToLite(v)])),
      dependencies: (p.dependencies ?? []).map((d) => (d.from || d.to ? { task: d.task, ...(d.from && { from: d.from }), ...(d.to && { to: d.to }) } : d.task)),
    })),
  };
}
```
API facts behind it `[VERIFIED: packages/api/src/routes/workspaces.js:289-296, 321-342]`: workspace payload has `id, name, workflow_definition, entity_labels, dashboard_text, settings`; projects have `id, name, group_name, at_risk, descoped, show_in_timeline, tags, external_link, display_order, milestones{key: planned_date|null}, dependencies[{task, from?, to?}]`, ordered by `p.display_order, p.name`. The dev seed settings use `start_month`, `end_month`, `group_order` (`db/seeds/devData.js:78-82`). `NON_FILTERABLE_GROUPS` has no DB source today; default `[]` (D-04). Do not invent keys in `settings` this phase.

### Pre-paint theme script (`packages/app/index.html`)
```html
<script>
  (function () {
    var ok = ['light','dark','professional','colorful','blank','monochrome','papallona','evergreen'], t = 'light';
    try { t = localStorage.getItem('roadmapsnap-theme') || 'light'; if (t === 'dsm-firmenich') t = 'evergreen'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', ok.indexOf(t) === -1 ? 'light' : t);
  })();
</script>
```
Matches Lite's `readStoredTheme` mapping (`js/state/appState.js:1-12`). Unit-test it by reading the script text from `index.html` and running it in a `vm` context with a stub `localStorage`/`document`.

### Theme API change `[VERIFIED: packages/api/src/routes/auth.js]`
- line 31: `theme: { type: 'string', enum: ['light', 'dark'] },`
- line 55: `if (nextPreferences.theme !== 'light' && nextPreferences.theme !== 'dark') {` (then line 56 resets to `'light'`)
Replace both with one shared 8-value constant, and update `UserPreferences['theme']` in `packages/app/src/api/client.ts` (currently `theme: 'light' | 'dark'`). Add an API test that PATCHes each of the 8 themes and reads it back, plus an invalid value returning 400. `GET /auth/me` already defaults to `{ theme: 'light' }`.

### CI shapes (targets)
```yaml
# ci.yml  (always runs; no paths filters)
- uses: actions/setup-node@v4
  with: { node-version: '24', cache: 'npm' }
- run: npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root
- run: cp js/config_base.js js/config.js
- run: npm test && npm run validate && npm run build
# parity job (required; always runs, steps no-op unless the diff touches core/tokens/app/css/js)
container: mcr.microsoft.com/playwright:v1.64.1-noble
```
Root `npm test` must also run core tests: `node --test tests/**/*.test.js packages/core/tests/*.test.js` (baseline: 141 pass in ~0.16 s).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `darkMode: 'class'` | `darkMode: ['selector', '[data-theme="dark"]']` | Tailwind 3.4.1 | Matches `data-theme`; Tailwind wraps it in `:where()` |
| Node 20 in CI | Node 24 (D-16). Release schedule: Node 24 entered Maintenance on 2026-10-20, Node 26 became LTS on 2026-10-28 `[CITED: nodejs/Release schedule.json]` | 2026 | D-16 stays locked at 24 (supported until 2028-04-30). Local machine and the Playwright image already run Node 26 |
| Per-package `file:` deps and 3 lockfiles | npm workspaces, one root lockfile | this phase | Dockerfile/compose/CI cache keys must change |
| `html.dark` class | `[data-theme]` attribute | this phase | 41 `.dark` occurrences in `components.css`, 11 in `index.css`, 2 in `tokens.css` (UI-SPEC counts) |

**Deprecated/outdated:** `js/roadmap.utils.js` (duplicate of core timeline functions); `packages/app/src/lib/*`; `FloatingTimelineFilterBar`, `FloatingExportMenu`, `TimelineToolbar`, `ThemeToggle`, `AppShell` tabs (UI-SPEC "Removed from the app"). TypeScript 7.0.2, Vite 8.3.8, Vitest 5.1.1, jsdom 31.0.1 exist on the registry; deliberately not adopted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pngjs` is the right decoder for pixelmatch input (name found via web search; registry and seam OK) | Standard Stack | Low; swap for any PNG decoder |
| A2 | `@fontsource/dm-sans` provides usable per-weight woff2 with OFL license (training knowledge; `npm view` license OFL-1.1) | Standard Stack | Low; vendor woff2 instead |
| A3 | Native `title` tooltips are not captured by Playwright screenshots | Pitfall 4 | Medium; if captured, D-09's "tooltip open" could be literal |
| A4 | React 18 renders `javascript:` hrefs without blocking | Pitfall 11 | Low; allowlist is correct either way |
| A5 | html2canvas 1.4.1 renders `:where()`-scoped rules, CSS variables and the 8 themes correctly (computed styles resolve `var()`) | Pitfall 10 | Medium; covered by the per-theme PNG smoke test, may need fallback options |
| A6 | `Auth0Context` (exported by `@auth0/auth0-react` 2.15.0, verified export) can be provided with a stub value to drive `useAuth0` in the parity entry | Pattern/harness | Medium; fallback: parity entry renders `LiteRoadmapView` straight from the adapter output |
| A7 | `v1.64.1-noble` image behaves like the v1.65.1 Dockerfile (Node major unverified for 1.64.1) | Pitfall 12 | Low |
| A8 | Hover styling of arrows (`stroke-width 3`, `opacity 1`) can be reproduced via React state without pixel change | Pattern 3 | Low; covered by a hover parity shot |
| A9 | Fixing the `'START'`/`'M3'` hard-coding is acceptable to the user (behavior change for some configs) | Open Question 1 | Medium; needs user confirmation |
| A10 | `npm ci -w @roadmapsnap/api` is sufficient for the API CI and Docker image (verified pattern for the scratch app workspace; not run against the real api package) | CI shapes | Low |

## Open Questions

1. **Hard-coded `'START'`/`'M3'` in Lite's red-dependency logic (`dependencies.js:221-222, 249-250`).**
   - Known: Lite's blocked-by-red set and effective at-risk use these constants, while Lite's own arrow drawing and the app's TS copy use real workflow keys. With a workflow whose last milestone is not `M3` (for example `config_base`, last milestone `A5`) and dependencies without explicit `from`, today's Lite computes no red block from them.
   - Unclear: whether the user considers that a bug to fix or behavior to preserve ("Lite works unchanged").
   - Recommendation: derive keys from the workflow (consistent with arrows and SaaS), add a characterization test that documents the old behavior, and confirm with the user before merge. Both choices pass parity; the fix is safer for SaaS workspaces with custom workflows.

2. **PNG background: UI-SPEC vs D-12.**
   - UI-SPEC: canvas background is the resolved `--color-bg-page` of the active theme. D-12 and Lite: `backgroundColor: '#ffffff'` (`js/export/png.js`).
   - Recommendation: follow UI-SPEC in SaaS (PNG is smoke-tested, not diffed); optionally make the same one-line change in Lite so exports match across products. Needs a decision because it changes Lite output.

3. **"Dependency tooltip open" in D-09.** Not screenshot-able (Pitfall 4). Recommendation: interpret as "dependency graph active + one arrow hovered" for pixels, plus DOM text equality for tooltips. Confirm the interpretation.

4. **Timeline range when `settings.start_month`/`end_month` are absent.** D-04 says defaults come from `config_base`-equivalents (`05/2025`-`07/2026`), which is meaningless for a new workspace; the current app uses `01/2026`-`12/2026`. Recommendation: derive from the min/max milestone dates (month-padded), falling back to the current calendar year. Phase 3 can then store explicit values. Confirm.

5. **CSV formula injection.** Tenant strings starting with `=`, `+`, `-`, `@` are written unescaped into CSV (Lite does the same). Fixing it changes Lite output (small). Recommendation: keep byte-identical this phase, record it as a deferred security item, or fix once in the shared builder with a user OK.

6. **Install command in D-16** (`npm ci --workspaces=false`) breaks bare-specifier resolution (Pitfall 2). Recommendation: the `-w ... --include-workspace-root` form. D-16 says "or similar", so no decision reopened; surfaced for awareness.

7. **Doc and requirement edits that the planner must schedule:** REQUIREMENTS.md VIEW-05 and ROADMAP.md Phase 2 success criterion 4 still list six themes (UI-SPEC Planner Note 3); AGENTS.md, `.claude/CLAUDE.md` and `docs/monorepo.md` ("fix logic bugs in both" rule, "no changes to js/ for SaaS", per-package CI text, "Root CI: Lite only"); README (raw-root serving no longer supported, `npm install` at root).

8. **Fixture content.** `tests/fixtures/config.complex.js` is 0 bytes `[VERIFIED: ls -la]`. It must cover: groups and ungrouped rows, non-filterable group, descoped, at-risk, hidden (`showInTimeline:false`), links, tags, a name over 60 chars, a state title over 40 chars, a row with no milestone dates, inbound/outbound/both dependencies with and without `from`/`to`, red/orange/green arrows, a range over 12 months (header quarters). `config_base.js` has no dependencies at all.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes (local) | 26.13.1 (CI target 24, Playwright image 26) | CI pins 24 |
| npm | workspaces | yes | 11.20.0 | — |
| Docker daemon | parity image, API image | yes | 29.9.3 (`linux/aarch64`) | CI container job; local parity needs Docker. Playwright image not pulled locally |
| Playwright image `mcr.microsoft.com/playwright:v1.64.1-noble` / `v1.65.1-noble` | parity | tags exist (`docker manifest inspect`) | — | — |
| Playwright browsers (host cache) | optional local debugging | yes (`chromium-1255`) | — | use the container for real runs (fonts/Chromium differ) |
| PostgreSQL (localhost:5432) | API theme test | not probed (`pg_isready` absent from PATH); Phase 1 CI uses a `postgres:16` service | — | API CI service |
| `gh` CLI | CI/PR work | yes | 2.103.0 | — |
| Baseline suites | regression | yes | root `npm test`: 141 pass; app `vitest`: 9 pass; app `tsc --noEmit`: clean | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** local Postgres not confirmed (API CI covers it).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (root Lite, new `packages/core`, API); Vitest 2.1.9 + jsdom (app, golden-markup); Playwright `@playwright/test` 1.64.1 + pixelmatch (parity); `tsc` (`--checkJs` in core, `--noEmit` in app) |
| Config file | root `package.json` `test` script; `packages/app/vite.config.ts` (vitest block); new `packages/core/tsconfig*.json`; new `packages/parity/playwright.config.ts` |
| Quick run command | `node --test tests/**/*.test.js packages/core/tests/*.test.js` (baseline 141 tests, about 0.2 s before additions) |
| Full suite command | `npm test && npm run typecheck -w @roadmapsnap/core && npm run validate && npm run build && npm -w @roadmapsnap/app run build && npm -w @roadmapsnap/app test` then the parity job in the container; API: `npm -w @roadmapsnap/api test` (needs Postgres) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | Core functions take explicit args; results equal Lite's for both fixtures | unit | `node --test packages/core/tests/*.test.js` | Wave 0 |
| CORE-01 | `packages/core/src` contains no `CONFIG`, `window`, `document`, `localStorage`, `process`, `AppState`, `fetch` references | static guard | `node --test packages/core/tests/purity.test.js` | Wave 0 |
| CORE-01 | JSDoc types check and `.d.ts` generate | typecheck | `npm run typecheck -w @roadmapsnap/core && npm run build:types -w @roadmapsnap/core` | Wave 0 |
| CORE-01 | Characterization of untested Lite behavior before refactor (`getUpcomingMilestones`, `filterDeliverables`, `sortDeliverables`, `buildDeliverableViewModel`, red sets, effective at-risk KPI, `showInTimeline` undefined quirk) | unit | `node --test tests/core/*.test.js` | Wave 0 |
| CORE-02 | `packages/app/src/lib` does not exist and nothing imports it | static guard + tsc | `node --test packages/app/../../tests/guards/no-app-lib.test.js` (or an app vitest) and `npx tsc --noEmit -p packages/app` | Wave 0 |
| CORE-03 | Existing 141 Lite tests unchanged and green; `validate` and `build` green | regression | `npm test && npm run validate && npm run build` | yes |
| CORE-03 | `ci.yml` has no `paths-ignore` of `packages/**` and installs with `-w ... --include-workspace-root` | static guard | `node --test tests/guards/ci-config.test.js` | Wave 0 |
| VIEW-01 | Timeline/Gantt markup identical (tag tree, classes, text, normalized style, `title`/`href`) | golden-markup | `npm -w @roadmapsnap/app test -- golden` | Wave 0 |
| VIEW-01 | Pixel parity, 8 themes x 2 fixtures, <= 0.1% differing pixels | e2e | `npx playwright test -c packages/parity` (container) | Wave 0 |
| VIEW-02 | KPI dashboard markup + pixels (incl. `Today:` frozen, `shown + hidden`, milestone cards) | golden + e2e | same | Wave 0 |
| VIEW-03 | Arrow geometry/color/title from `computeDependencyArrows`; blocking detection; active-graph state pixels | unit + e2e | `node --test packages/core/tests/arrows.test.js`; parity | Wave 0 |
| VIEW-04 | Filter-state transitions, search/status/risk filtering, sort, zoom month generation | unit | `node --test packages/core/tests/filters.test.js` | Wave 0 |
| VIEW-04 | Interaction parity: type in search (debounce + focus), click KPI, risk toggle, zoom 3/6/12/all, expand/collapse groups, outside-click clears | e2e (post-interaction diff) + RTL | parity; `npm -w @roadmapsnap/app test` | Wave 0 |
| VIEW-05 | 8 themes render and switch; pre-paint script maps legacy value; no flash | e2e + unit | parity; app test for the script | Wave 0 |
| VIEW-05 | API accepts and persists each of the 8 themes, rejects others | integration | `npm -w @roadmapsnap/api test` (Postgres) | extend `packages/api/tests/auth.test.js` |
| VIEW-06 | CSV and JSON byte-identical between Lite path and SaaS path (injected `now`); filenames | unit | `node --test packages/core/tests/export.test.js` | Wave 0 |
| VIEW-06 | PNG smoke under all 8 themes (download occurs, PNG signature, corner pixel equals page color, buttons `aria-busy` during capture) | e2e | parity (SaaS only) | Wave 0 |
| (CSS move) | Lite(base ref) vs Lite(HEAD) identical for 8 themes x 2 fixtures | e2e, one-off per CSS plan | harness with two preview URLs | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/**/*.test.js packages/core/tests/*.test.js` (under 10 s) plus `npx tsc --noEmit` in `packages/app` when app files change.
- **Per wave merge:** root `npm test && npm run validate && npm run build`, app vitest + build, core typecheck. Parity run at wave 4 and 5 merges.
- **Phase gate:** everything above green, parity job green in the pinned container, golden-markup green, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/config.complex.js` is empty: author it (Open Question 8) in adapter-canonical key order, plus `roadmapToApi(config)` helper and the round-trip test.
- [ ] Characterization tests for currently untested Lite behavior (list above) written and green against the *unrefactored* code, before any extraction.
- [ ] `packages/core` skeleton: `package.json`, tsconfigs, `tests/`, `purity.test.js`; root `test` script extended.
- [ ] Root `package.json` `workspaces`, one lockfile, `engines: { node: '>=24' }` everywhere, CI/Docker/compose updates (Dockerfile build context at repo root, `npm ci -w @roadmapsnap/api --omit=dev`).
- [ ] Golden-markup harness (vitest in `packages/app`, importing Lite `js/ui/*` with `window`, `CONFIG`, `localStorage` stubs and a normalizer that ignores `on*`, `role`, `tabindex`, `aria-*`, `data-*`).
- [ ] `packages/parity` workspace: Playwright config, parity entry (separate HTML entry, parity mode only), servers, base-vs-head Lite diff script, pinned container job.
- [ ] Theme CSS and font assets inventory in tokens (8 theme blocks, theme component overrides, DM Sans woff2).
- [ ] API test extension for 8 themes.

## Security Domain

`security_enforcement` is enabled (ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Auth0 JWT unchanged. The parity entry must never ship in the production build (separate entry, not in rollup inputs) |
| V3 Session Management | no change | Auth0 SDK `cacheLocation="localstorage"` unchanged |
| V4 Access Control | yes | Viewers do not see `Add project`/Edit/Delete (`useRole`); the API remains the enforcement point (`fastify.requireRole`). No new endpoints this phase |
| V5 Input Validation | yes | Fastify/Ajv enum for `preferences.theme` (8 values); `http(s)` allowlist for `external_link` at render and on write; theme allowlist in the pre-paint script and localStorage reader |
| V6 Cryptography | no | none |
| V14 Configuration | partial | No new secrets; parity needs none; Docker/CI changes keep `.env` untracked |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via tenant strings in markup | Tampering | React JSX escaping; no `dangerouslySetInnerHTML` except constant SVG icon strings from core (D-01) |
| Stored XSS via `external_link` (`javascript:` URL) | Tampering | Core `safeHttpUrl()` allowlist in the React link; API write validation |
| CSV formula injection in exports | Tampering | Open Question 5 (shared builder; parity vs fix) |
| `data-theme` / localStorage poisoning | Tampering | Allowlist of 8 values everywhere before setting the attribute |
| Test auth bypass reaching production | Elevation of privilege | Parity harness as a non-default Vite entry/mode; assert in a build test that the default `dist` contains no parity entry and no stub context |
| Supply chain (new dev packages) | Tampering | Pinned exact versions, legitimacy audit above, human-verify checkpoint for `@playwright/test`, `pngjs`, `@fontsource/dm-sans` |
| Lite inline handlers with unescaped group names (`onclick="toggleGroup('...')"`, `escapeHtml` does not escape `'`) | Tampering | Lite-only, own trusted config; React has no inline handlers (reason for D-01). Do not copy `escapeHtmlAttr` into the app |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `js/core/{timeline,workflow,dependencies,stats,viewModel,configValidator}.js`, `js/ui/*.js`, `js/export/*.js`, `js/app.js`, `js/state/appState.js`, `js/roadmap.utils.js`, `packages/app/src/lib/*.ts`, `packages/app/src/api/client.ts`, `packages/app/src/pages/DashboardPage.tsx`, `packages/app/{tailwind.config.ts,vite.config.ts,index.html,src/main.tsx,src/index.css}`, `packages/api/src/routes/{auth,workspaces,projects}.js`, `packages/api/Dockerfile`, `compose.yaml`, `.github/workflows/*.yml`, `tests/**`, `.planning/**` (CONTEXT, UI-SPEC, REQUIREMENTS, STATE, research docs).
- Scratch experiments (this session): npm workspaces install matrix (`--workspaces=false`, full `ci`, `-w core --include-workspace-root`, `ci` inside a workspace dir, `-w @x/app`); `tsc --checkJs` + `emitDeclarationOnly` + workspace consumption; baseline `npm test` (141 pass), app vitest (9 pass), app `tsc --noEmit` (clean).
- `gsd-tools package-legitimacy check` and `npm view` for versions/dates.
- `docker manifest inspect` for the Playwright image tags.
- [Playwright Docker docs](https://playwright.dev/docs/docker), [Playwright snapshots](https://playwright.dev/docs/test-snapshots), [Playwright clock](https://playwright.dev/docs/clock)
- [Tailwind v3 preflight](https://v3.tailwindcss.com/docs/preflight), [Tailwind v3 dark mode](https://v3.tailwindcss.com/docs/dark-mode)
- [MDN :where()](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)
- [pixelmatch README](https://raw.githubusercontent.com/mapbox/pixelmatch/main/README.md)
- [Playwright v1.65.1 Dockerfile.noble](https://raw.githubusercontent.com/microsoft/playwright/v1.65.1/utils/docker/Dockerfile.noble)
- [Node.js release schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)

### Secondary (MEDIUM confidence)
- [GitHub: troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) and [community discussion 44490](https://github.com/orgs/community/discussions/44490) (via search summary; direct page fetch 404'd on one URL variant)
- [html2canvas issues 3150 / 3269](https://github.com/niklasvh/html2canvas/issues/3269) (`oklch` unsupported in 1.4.1), via search

### Tertiary (LOW confidence)
- Third-party tutorials on pixelmatch/pngjs usage (used only to choose the decoder; see A1)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH. Versions and legitimacy verified; `pngjs` and `@fontsource/dm-sans` name provenance is `[ASSUMED]`.
- Architecture: HIGH for the core extraction and impurity/drift inventories (read from source); MEDIUM for the React/CSS parity mechanics (reasoned and partly verified, final proof is the parity suite).
- Pitfalls: HIGH for workspace, CI, fixture and cascade findings (verified); MEDIUM for html2canvas and tooltip behavior (assumed, covered by smoke tests).

**Research date:** 2026-11-22
**Valid until:** about 2026-12-20 (Playwright releases weekly; re-check the pinned image tag and `@playwright/test` age before installing)
