# Phase 2: Shared Core & Lite-Identical View - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract Lite's pure roadmap logic (timeline, workflow, dependencies, stats, filters, view model, plus CSV/JSON export builders) into one shared `packages/core`, used by both Lite and the SaaS app. Then rebuild the SaaS roadmap view on that core so that, for the same data, it is pixel-identical to Lite: timeline/Gantt, KPI dashboard, dependency arrows with tooltips and blocking detection, filters (name/status/risk), zoom (3/6/12 months, all), all Lite themes, and PNG/CSV/JSON export. Lite must keep working (`npm test`, `validate`, `build` green). The `packages/app/src/lib` duplicates are deleted.

Not in this phase: new editing capabilities (Phase 3), schema for Lite display config (Phase 3), Lite config import (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### SaaS rendering
- **D-01:** React components render core view models and emit the same DOM structure and CSS class names as Lite's `js/ui/*` renderers. Do not mount Lite's HTML strings in React (no `dangerouslySetInnerHTML` of tenant data). A golden-markup test guards structural parity. — **Reversibility:** costly — every view component is built on this choice.
- **D-02:** Page layout is a thin SaaS header (workspace switcher, user menu, entry point to the existing project modals) above an area that is exactly Lite's page: Lite header, dashboard, filter bar and timeline. Screenshot parity applies to the Lite area only.
- **D-03:** Keep the existing project create, edit and delete modals working, opened from outside the Lite area (header or toolbar). They are not part of the parity area. Phase 3 replaces them. The current `AppShell`/`ProjectList` layout gives way to D-02.
- **D-04:** Display config that the DB doesn't store yet (`ENTITY_LABELS`, `DASHBOARD_TEXT`, page title, etc.) comes from workspace data where it exists (stored workflow, workspace name), with the rest coming from `config_base`-equivalent defaults defined in core. No schema change in this phase. Phase 3 decides where these live.

### Themes
- **D-05:** SaaS offers all 8 Lite themes: light, dark, professional, colorful, blank, monochrome, papallona, evergreen. Update VIEW-05 in REQUIREMENTS.md to list all 8. All theme CSS moves into `packages/tokens` and is consumed by both Lite and the app.
- **D-06:** The theme is saved per user in `users.preferences` (through `PATCH /auth/me`) and cached in localStorage key `roadmapsnap-theme` (the same key as Lite, including the legacy `dsm-firmenich` → `evergreen` mapping). It is applied before first paint to avoid a flash.
- **D-07:** The theme applies to the whole SaaS page through `data-theme` on `<html>`, exactly like Lite. The SaaS header and modals use the same tokens. Remove the `html.dark` class mechanism (`packages/app/src/lib/themeStorage.ts`, `index.css` `html.dark` rules).

### Parity verification
- **D-08:** Playwright screenshot comparison of Lite vs SaaS uses a near-zero tolerance (about 0.1% of pixels, for anti-aliasing only). Both run in the same pinned Playwright Docker image with fixed fonts, a fixed viewport and a frozen "today" date.
- **D-09:** Coverage is all 8 themes against `tests/fixtures/config.minimal.js` and `tests/fixtures/config.complex.js`, plus specific states: a filter applied, a non-default zoom level, collapsed groups, and a dependency tooltip open. That is roughly 20–25 screenshots. Not the full theme × state cross product.
- **D-10:** No committed baselines. Lite is the oracle. Playwright renders Lite from the fixture config and renders SaaS with API responses stubbed from the same fixture (converted through the core adapter in D-15), then diffs the two live. No DB or Auth0 is needed for the parity suite.
- **D-11:** The parity suite is a required, blocking CI check on PRs that touch `packages/core`, `packages/tokens`, `packages/app`, `css/` or `js/`.
- **D-12:** CSV and JSON export builders move into `packages/core`, and tests assert byte-identical output between Lite and SaaS for the same fixture. PNG uses `html2canvas` on the Lite area with the same options as Lite. It is smoke-tested under every theme, not pixel-diffed.

### Core packaging & Lite delivery
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 2" — goal, success criteria, research flag (CSS isolation, theme bridge, html2canvas, Playwright), notes (Node version, workspaces, AGENTS.md/monorepo.md update)
- `.planning/REQUIREMENTS.md` — CORE-01..03, VIEW-01..06 (VIEW-05 to be updated per D-05)
- `.planning/PROJECT.md` — Core Value and constraints (Lite backend-free, no upgrades)

### Prior decisions
- `.planning/phases/01-tenant-security-foundation/01-CONTEXT.md` — D-15 date contract (ISO strings from the API, conversion at the core/app edge)

### Research
- `.planning/research/SUMMARY.md` — shared-core architecture, no-HTML-embed rationale (XSS), workspaces, Node choice, Playwright parity
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md` — details behind the summary

### Codebase maps and docs
- `.planning/codebase/CONCERNS.md` — the duplication between `js/core/` and `packages/app/src/lib/`
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`
- `docs/monorepo.md` — to be updated (Lite delivery via build, no duplicate-fix rule)
- `docs/config-reference.md` — the Lite config shape that core operates on
- `docs/phase0-window-audit.md` — inventory of `window.*` globals Lite relies on
- `AGENTS.md` — the "fix logic bugs in both" rule to retire once duplicates are gone

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/core/{timeline,workflow,dependencies,stats,viewModel}.js`: the source of truth to extract. Lite behavior wins over the TS copies when they differ.
- `js/ui/{dashboard,filterBar,grouping,timelineGrid,dependencyArrows}.js`: the markup and class-name reference that React components must reproduce.
- `js/export/{csv,json,png}.js`: export logic. CSV and JSON builders move to core.
- `tests/core/*.test.js` and `tests/fixtures/config.{minimal,complex}.js`: the existing test suite and the parity fixtures.
- `packages/app/src/components/{dashboard,timeline}/*`: partial React re-implementation that already uses some Lite class names (`summary-dashboard`, `kpi-card`). Refactor these onto core view models.
- `packages/tokens/{tokens.css,components.css}`: destination for all theme CSS.

### Established Patterns
- `js/core/` is not pure today. It reads `CONFIG` and `window.*`, and `viewModel.js` reads the theme from `document`. The work is refactoring to explicit arguments first, then moving the code.
- `filterDeliverables` lives in `js/ui/filterBar.js` and reads `AppState`. It needs extraction too.
- Lite themes are `[data-theme]` blocks in `css/roadmap.css` (8 themes). The app uses `html.dark` with Tailwind preflight applied globally (`packages/app/src/index.css`).
- Lite loads `js/config.js` as a classic script and then `js/app.js` as a module. `html2canvas` comes from a CDN in `index.html`, while the app bundles it.

### Integration Points
- `packages/app/src/pages/DashboardPage.tsx`: where the Lite-identical view is composed.
- `packages/app/src/main.tsx`: pre-paint theme application (switch to `data-theme`).
- `PATCH /auth/me` and `users.preferences` (`packages/api/src/routes/auth.js`): theme persistence.
- `.github/workflows/ci.yml` (`paths-ignore: packages/**`, Node 20), `app-ci.yml`, `api-ci.yml`: Node 24, path filters and the new parity job.
- Root `package.json`, `packages/app/package.json` (`file:../tokens`): workspaces migration.

</code_context>

<specifics>
## Specific Ideas

- Lite is the oracle for parity. SaaS is diffed live against Lite rendered from the same fixture, so changing Lite's CSS automatically raises the bar for SaaS.
- The theme picker in SaaS must match Lite's exactly, including all 8 entries.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

</deferred>

---

*Phase: 02-shared-core-lite-identical-view*
*Context gathered: 2026-11-21*
