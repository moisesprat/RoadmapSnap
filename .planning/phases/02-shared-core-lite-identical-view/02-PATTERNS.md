# Phase 2: Shared Core & Lite-Identical View - Pattern Map

**Mapped:** 2026-11-22
**Files analyzed:** 38 (new/modified/deleted, grouped by area)
**Analogs found:** 33 / 38 (all cited paths verified git-tracked via `git ls-files`)

Style reminders (from `.claude/CLAUDE.md`): Lite `js/` 4 spaces + semicolons; core (new) follows Lite `js/core` style for moved code but is ESM with explicit `export`, no `window`; API 2 spaces, single quotes, semicolons; app 2 spaces, no semicolons, single quotes, `import type`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/core/package.json`, `tsconfig*.json` | config | n/a | `packages/tokens/package.json` | role-match |
| `packages/core/src/dates.js`, `timeline.js` | utility | transform | `js/core/timeline.js` | exact (move) |
| `packages/core/src/workflow.js` | utility | transform | `js/core/workflow.js` | exact (move) |
| `packages/core/src/dependencies.js` | utility | transform | `js/core/dependencies.js` | exact (move) |
| `packages/core/src/stats.js` | utility | transform | `js/core/stats.js` | exact (move) |
| `packages/core/src/filters.js` | utility | transform | `js/ui/filterBar.js` (lines 13-164) | exact (extract) |
| `packages/core/src/viewModel.js` | utility | transform | `js/core/viewModel.js` | exact (move) |
| `packages/core/src/models.js` (dashboard/timeline/filterBar models) | utility | transform | `js/ui/dashboard.js`, `timelineGrid.js`, `grouping.js` | role-match (extract) |
| `packages/core/src/arrows.js` | utility | transform | `js/ui/dependencyArrows.js` (131-264) | exact (extract) |
| `packages/core/src/export.js` (`buildCsv`, `buildJson`) | utility | transform | `js/export/csv.js`, `json.js` | exact (extract) |
| `packages/core/src/adapter.js` (`apiToRoadmap`) | utility | transform | `packages/app/src/api/client.ts` (`isoToLiteDate`, mapping ~189) | role-match |
| `packages/core/src/defaults.js`, `icons.js` | config | n/a | `js/ui/exportControls.js` (SVGs), `js/ui/dashboard.js` (`riskIconSVG`) | partial |
| `packages/core/tests/*.test.js` (incl. `purity.test.js`) | test | n/a | `tests/core/workflow.test.js` | exact |
| `js/core/{timeline,workflow,dependencies,stats,viewModel}.js` (become bindings) | utility | transform | self | exact |
| `js/ui/{filterBar,dashboard,timelineGrid,grouping,dependencyArrows}.js` (call core models) | component | request-response (string render) | self | exact |
| `js/export/{csv,json}.js` (thin wrappers) | utility | file-I/O | self | exact |
| `js/roadmap.utils.js` (delete) | utility | n/a | n/a | n/a |
| `tests/fixtures/config.complex.js` (author, currently 0 bytes) | test fixture | n/a | `tests/fixtures/config.minimal.js` | exact |
| `tests/core/*.test.js` characterization additions | test | n/a | `tests/core/workflow.test.js` | exact |
| `packages/app/src/components/lite/Lite*.tsx` (7 components) | component | request-response | Lite renderers above + `components/dashboard/KpiCards.tsx` | role-match |
| `packages/app/src/pages/DashboardPage.tsx` (rewrite) | component | request-response | self + `hooks/useApi.ts` | role-match |
| `packages/app/src/components/layout/SaasHeader.tsx` (new) | component | request-response | `components/layout/AppShell.tsx` | partial |
| `packages/app/src/hooks/useTheme.ts` (new) | hook | event-driven | `hooks/useProjectMutations.ts` | role-match |
| `packages/app/index.html` (pre-paint script) | config | n/a | self | exact |
| `packages/app/src/main.tsx` | config | n/a | self | exact |
| `packages/app/src/lib/*` (delete), `ThemeToggle.tsx`, `FloatingTimelineFilterBar`, `FloatingExportMenu`, `TimelineToolbar` (delete) | n/a | n/a | n/a | n/a |
| `packages/app/src/components/projects/*Modal.tsx` (restyle copy only) | component | CRUD | self | exact |
| `packages/app/tailwind.config.ts`, `index.css` | config | n/a | self | exact |
| `packages/app/src/components/lite/*.test.tsx` (golden-markup) | test | n/a | `packages/app/src/api/client.test.ts` | role-match |
| `packages/tokens/tokens.css`, `components.css`, `package.json`, fonts | config | n/a | self + `css/roadmap.css` (theme blocks, line 206+) | exact |
| `packages/api/src/routes/auth.js` (8-theme enum) | route | request-response | self (lines 31, 55) | exact |
| `packages/api/tests/auth.test.js` (theme tests) | test | request-response | self (lines 159-172) | exact |
| `packages/app/src/api/client.ts` (`UserPreferences`) | model | n/a | self (line 85) | exact |
| `packages/parity/*` (Playwright, pixelmatch) | test | batch | none | none |
| `.github/workflows/{ci,app-ci,api-ci}.yml`, parity workflow | config | n/a | `.github/workflows/ci.yml`, `app-ci.yml` | exact |
| root `package.json`, `packages/api/Dockerfile`, `compose.yaml` | config | n/a | self | exact |
| `docs/monorepo.md`, `AGENTS.md`, `.claude/CLAUDE.md`, README | docs | n/a | self | exact |

## Pattern Assignments

### `packages/core/src/workflow.js` (utility, transform) — pure-with-injected-context refactor

**Analog:** `js/core/workflow.js`. Today every function reads `CONFIG` (`getWorkflow` 27-51, `getNonFilterableGroups` 99-101, `getFirstMilestoneKey` 116-124) and `window.parseDate`/`getTodayDate` (142-172). Core takes `workflow`/`config`/`today` explicitly.

**Normalization to keep verbatim** (`js/core/workflow.js` 27-51): the legacy `CONFIG.MILESTONES` fallback. Becomes `normalizeWorkflow(config)`:
```javascript
function getWorkflow() {
    if (CONFIG.WORKFLOW && Array.isArray(CONFIG.WORKFLOW)) {
        return CONFIG.WORKFLOW;
    }
    const legacyMilestones = CONFIG.MILESTONES || [ /* M0..M3 */ ];
    const workflow = [
        { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: 'Pending kickoff' },
        { type: 'milestone', key: 'START', short: 'START', title: 'Start', subtitle: 'Kickoff' },
        ...
```
**Override-param pattern already present** (lines 73-97, 142-172: `workflowOverride`, `todayStr`). Generalize: make `workflow` and `today` required positional args, no defaults that read a clock/global.

**Binding strategy (Lite thin wrapper)** keeps `tests/core/workflow.test.js` unchanged. Tests set `globalThis.CONFIG` (lines 27-35) and import from `../../js/core/workflow.js`, so the binding must keep the same export names and the `window` export block guarded by `typeof window !== 'undefined'` (workflow.js 174-193). Binding shape:
```javascript
import * as core from '@roadmapsnap/core';
export function getMilestones() { return core.getMilestones(getWorkflow()); }  // getWorkflow still reads CONFIG here
if (typeof window !== 'undefined') { window.getMilestones = getMilestones; /* ... */ }
```
**Resolved decision (OQ1):** `getMilestoneDate` first/last keys derive from the workflow, not `'START'`/`'M3'` (`js/core/dependencies.js` 221-222, 249-250). Add a characterization test for old behavior plus a test for the new one.

---

### `packages/core/src/timeline.js` / `dates.js` (utility, transform)

**Analog:** `js/core/timeline.js`. Pure already: `parseDate` (8-12), `formatDateDisplay` (14-19), `formatShortDate` (21-26), `darkenColor` (28-38), `parseMonthYear` (51-54), `getMonthName`. Impure and to rewrite with args: `getTodayDate` (40-49, reads `CONFIG.TIMELINE.TODAY`) and `generateMonths` (61-75, reads `CONFIG.TIMELINE.START_MONTH/END_MONTH`).
```javascript
function generateMonths() {            // core: generateMonths(startMonth, endMonth)
    var start = parseMonthYear(CONFIG.TIMELINE.START_MONTH);
    var end = parseMonthYear(CONFIG.TIMELINE.END_MONTH);
    var current = new Date(start);
    while (current <= end) {
        months.push({ date: new Date(current), name: getMonthName(current),
            daysInMonth: new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate() });
        current.setMonth(current.getMonth() + 1);
    }
```
Return `null`/`[]` for malformed input (project convention: "pure core functions return null or empty, never throw"). One canonical DD/MM/YYYY parse/format lives here (D-15). Keep `Date` local-midnight semantics (no date library). `darkenColor` must stay exported from the Lite binding (only `tests/core/timeline.test.js` uses it).

---

### `packages/core/src/filters.js` (utility, transform)

**Analog:** `js/ui/filterBar.js`. Extract `filterDeliverables` (13-44), `filterBySearchOnly` (47-58), `sortDeliverables` (60-92), and the filter-state transitions (`updateFilter` 94-119, `filterByStatus` 126-135, `toggleRiskFilter` 152-157, `toggleDescopedFilter` 159-164, `clearStatusFilterOnOutsideClick` 137-150) as pure `(state, ...) => nextState`. Today they read `AppState.get()`; core takes `filter`, `sort`, `ctx` (workflow, today, effective at-risk set, red endpoints).
```javascript
// filterBar.js 126-135: transition rule to port as pure fn
if (filter.status === status) {
    AppState.set({ filter: { ...filter, status: 'ALL', riskOnly: false, descopedOnly: false } });
} else {
    AppState.set({ filter: { ...filter, status, riskOnly: false, descopedOnly: false } });
}
```
Note `filterDeliverables` has a duplicated `riskOnly`/`descopedOnly` check (lines 22-27 and 32-33): preserve result, dedupe is safe. Lite `filterBar.js` keeps `window.*` exports (lines 224-233) as shims because inline `onclick` handlers use them.

---

### `packages/core/src/arrows.js` (utility, transform)

**Analog:** `js/ui/dependencyArrows.js` lines 131-264 (color rule 225-239, curve 198-208, title text 260). Signature per RESEARCH Pattern 3: `computeDependencyArrows({ edges, deliverables, workflow, months, today, rects, onlyRed })` returns `{d, color, markerId, title, type}[]`. DOM only measures rects. Side effects to port in the React layer (not core): `toggleDependencyGraph` (11-33) expands groups and resets filter to `{status:'ALL', riskOnly:false, descopedOnly:false, search:''}`; `clearDependencyGraphOnClickOutside` exclusion list (35-47: `.dependency-icon`, `.data-source-row`, `.filter-bar`, `.filter-toggle`, `button`, `select`). Lite sets `container.style.position = 'relative'` at line ~284 only while arrows exist.

---

### `packages/core/src/export.js` (utility, transform)

**Analog:** `js/export/csv.js` 8-36 and `js/export/json.js` 8-27.
```javascript
// csv.js 10-11, 19-27 (headers and row shape; group and link are NOT quote-escaped: preserve, OQ5)
const headers = ['Name', 'Group', 'Current State', 'Next Milestone', 'At Risk', 'Tags', 'Link'];
milestones.forEach(m => headers.push(`${m.key} Date`));
...
`"${(source.name || '').replace(/"/g, '""')}"`, `"${source.group || ''}"`, ...
```
```javascript
// json.js 9-26: key order is load-bearing for byte identity
const exportData = { exportDate: new Date().toISOString(), timeline: CONFIG.TIMELINE, workflow: ..., states: ..., milestones: ...,
    deliverables: CONFIG.DELIVERABLES.map(source => ({ ...source, currentState: ..., nextMilestone: ... })) };
JSON.stringify(exportData, null, 2)
```
Core: `buildCsv({config, today})` and `buildJson({config, today, now})` with `now` injected (no `new Date()`). Filenames stay `deliverables.csv` / `deliverables.json`. Lite `js/export/csv.js` keeps `downloadFile` (38-46) and `window.exportToCSV`, now `downloadFile(buildCsv(...), 'deliverables.csv', 'text/csv')`.

**PNG (not in core; OQ2 resolved: keep `#ffffff`)** `js/export/png.js` 27-32: `h2c(element, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })`. React export copies these options exactly; buttons use `disabled` + `aria-busy` instead of `style.opacity`; filename `${prefix}-${today.replace(/\//g,'-')}.png`. Wait on `document.fonts.ready` first.

---

### `packages/core/src/adapter.js` (`apiToRoadmap`) (utility, transform)

**Analog:** `packages/app/src/api/client.ts` `isoToLiteDate` (line 25) and the project mapping near line 189.
```typescript
export function isoToLiteDate(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [yyyy, mm, dd] = value.split('-')
  return `${dd}/${mm}/${yyyy}`
}
```
Move to core as plain JS (`isoToLite`), and make `client.ts` import it from `@roadmapsnap/core` (or drop the mapping from client). Full `apiToRoadmap` body is in RESEARCH "Code Examples". Null dates are omitted keys (not `''`). Default timeline range when `start_month`/`end_month` absent: min/max milestone months, else current calendar year (resolved OQ4). Test helper `roadmapToApi(cfg)` + round-trip test lives in test utilities, not core `src`.

---

### `packages/core/package.json`, `tsconfig.json`, `tsconfig.build.json` (config)

**Analog:** `packages/tokens/package.json` (name, `"type": "module"`, `exports` map). Use the exact `exports` + scripts block from RESEARCH "`.d.ts` generation" (types -> `./types/index.d.ts`, default -> `./src/index.js`; scripts `typecheck`, `build:types`, `test`). Add `packages/core/types/` to `.gitignore`. Zero dependencies; `src/` must contain no `CONFIG`, `window`, `document`, `localStorage`, `process`, `AppState`, `fetch` (enforced by `purity.test.js`).

---

### `packages/core/tests/*.test.js` and `tests/core/*` characterization (test)

**Analog:** `tests/core/workflow.test.js` (1-35) and `tests/fixtures/config.minimal.js`.
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minimalWorkflow, minimalDeliverables, minimalConfig } from '../fixtures/config.minimal.js';
function withMinimalConfig(fn) {
  const prev = globalThis.CONFIG;
  globalThis.CONFIG = minimalConfig;
  try { fn(); } finally { globalThis.CONFIG = prev; }
}
```
Tests use 2-space indentation (differs from `js/` 4 spaces). Core tests pass args explicitly; no `globalThis.CONFIG`. Root `test` script must widen to `node --test tests/**/*.test.js packages/core/tests/*.test.js`.

**`tests/fixtures/config.complex.js`:** mirror `config.minimal.js` export layout (`complexWorkflow`, `complexDeliverables`, `complexConfig` with `TIMELINE: { TODAY, START_MONTH, END_MONTH }`). Must cover the OQ8 list (groups, ungrouped, non-filterable group, descoped, hidden, links, tags, 60+ char name, 40+ char state title, no-date row, inbound/outbound dependencies with and without `from`/`to`, range over 12 months). Author in adapter-canonical key order.

---

### `packages/app/src/components/lite/*.tsx` (component, request-response)

**Analogs:** the Lite renderer for each component (table in UI-SPEC "Lite Parity Component Map"); markup reference e.g. `js/ui/filterBar.js` 175-220 and `js/ui/exportControls.js` 12-19. Convert `html```, `onclick="..."` and `${cond ? [html`...`] : []}` to JSX with the same tag tree and class names. Existing React using Lite class names: `packages/app/src/components/dashboard/KpiCards.tsx` (`summary-dashboard`, `summary-header`, `kpi-card`) — refactor onto core models, replace its `toLocaleDateString` (line 15) with core `formatShortDate`.

**Filter bar JSX translation sample** (from `filterBar.js` 176-191):
```tsx
<div className="filter-bar">
  <div className="filter-group">
    <input type="text" className="filter-input" placeholder="Search by name..." defaultValue={...} onChange={...} />
  </div>
  <div className="filter-group">
    <span className="filter-label">Sort:</span>
    <select className="filter-select" value={sort.by} onChange={...}>
      <option value="name">Name</option> ...
```
Search input must keep identity across renders (no remount) and refocus with caret at end after the 150 ms debounce (`filterBar.js` 94-107). Register document click listeners once on mount (`useEffect`), remove on unmount. SVG icons: constant strings from core `icons.js` (the only permitted `dangerouslySetInnerHTML`). Link `href` uses core `safeHttpUrl()` (http/https allowlist). Keep `.filter-bar` a direct child of `.lite-area`.

---

### `packages/app/src/pages/DashboardPage.tsx` and header (component, request-response)

**Analogs:** current `DashboardPage.tsx` (data loading via hooks), `hooks/useApi.ts`, `hooks/useWorkspace.ts`, `hooks/useRole.ts`, `components/layout/AppShell.tsx` (workspace switcher). Data flow: `useApi()` -> TanStack Query -> `apiToRoadmap()` -> `LiteRoadmapView`. Hook pattern to copy for any new query/mutation (`hooks/useProjectMutations.ts` 1-16):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from './useApi'

export function useCreateProject(workspaceId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateProjectBody) => api.createProject(workspaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'projects'] })
    },
  })
}
```
`useTheme` copies this shape: `useMutation` calling `api.updateMe({ preferences: { theme } })` (client.ts line 207), optimistic apply of `data-theme` + `localStorage`, no rollback on error, show notice. Do not carry over the hardcoded Auth0 domain 401 hint in `DashboardPage.tsx`.

**Modals** (`DeleteProjectModal.tsx` 11-34): keep the native `<dialog>` + `showModal()` effect pattern and `handleDialogClick` backdrop close; change only copy (`Keep project` default focus, `Deleting…`), tokens (remove `bg-risk` delete button), and error text.

---

### `packages/app/index.html` + `main.tsx` (config, theme bridge)

**Analog:** `packages/app/src/main.tsx` 6-15 (current `readStoredTheme`/`applyThemeClassToDocument`) and `packages/app/src/lib/themeStorage.ts` (storage key `roadmapsnap-theme`, try/catch around localStorage). Replace with the blocking inline script from RESEARCH ("Pre-paint theme script") in `index.html`; delete `themeStorage.ts` and the `main.tsx` lines 6 and 11-15. Mapping must match Lite `js/state/appState.js` lines 1-12 (`dsm-firmenich` -> `evergreen`). Keep the `Auth0Provider`/`QueryClientProvider` wrapper (main.tsx 21-37). The parity entry is a separate non-default HTML entry (never in default build inputs).

---

### `packages/app/tailwind.config.ts`, `index.css` (config)

**Analog:** self. Change line 8 `darkMode: 'class'` to `darkMode: ['selector', '[data-theme="dark"]']`, add `corePlugins: { preflight: false }`. Remove `html.dark` rules and body `overflow-x: hidden; overflow-y: auto`. Tailwind color map (lines 12-17) already derives from `@roadmapsnap/tokens` `colors` and `var(--color-*)`.

---

### `packages/tokens/tokens.css`, `components.css` (config, theme CSS move)

**Analog:** `css/roadmap.css` (8 `[data-theme]` blocks, e.g. `[data-theme="evergreen"]` at 206, `[data-theme="evergreen"] body` at 234). Move blocks verbatim (hex values stay, UI-SPEC note 8), keep order: `:root`, theme variable blocks, component rules, theme component overrides. Add `:where(.lite-area) *` reset and shared `body, .lite-area` selector lists (RESEARCH Pattern 5). Add `--color-accent`, `--color-on-accent`, `--color-danger` per theme from the UI-SPEC table. `packages/tokens/package.json` `exports` already lists `./css` and `./components.css`; add new asset paths there if new CSS files/fonts are added.

---

### `packages/api/src/routes/auth.js` (route, request-response) — 8-theme enum

**Analog:** self. Lines 31 and 55:
```javascript
theme: { type: 'string', enum: ['light', 'dark'] },
...
if (nextPreferences.theme !== 'light' && nextPreferences.theme !== 'dark') {
  nextPreferences.theme = 'light';
}
```
Replace with one `THEMES` constant (UPPER_SNAKE_CASE module-level lookup, per conventions) used in both the schema enum and the guard (`!THEMES.includes(...)`). Error body shape stays `{ error, message }`. Update `UserPreferences['theme']` in `packages/app/src/api/client.ts` line 86 to the 8-value union (a `type` derived from a const array, shared if possible).

**Test analog:** `packages/api/tests/auth.test.js` 159-172 (PATCH with `signToken` + `bearer`, `app.inject`, `assert.equal(body.preferences.theme, ...)`). Add a loop over the 8 themes with a read-back via `GET /auth/me`, and an invalid theme returning 400 (schema enum rejects). Reuse `fx.aliceSub`, `signToken`, `bearer` from `./helpers/auth.js`.

---

### `.github/workflows/*.yml`, root `package.json`, Dockerfile, compose (config)

**Analog:** `.github/workflows/ci.yml` (1-41) and `app-ci.yml` (1-40). Changes: delete `paths-ignore` (ci.yml 4-9), `node-version: '24'`, replace `npm ci` with `npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root` (OQ6: `--workspaces=false` does not link core), app job `npm ci -w @roadmapsnap/app`, cache key `package-lock.json` at root (app-ci.yml 20 points at the app lockfile), run `npm run build:types -w @roadmapsnap/core` before `tsc --noEmit`. Keep the `cp js/config_base.js js/config.js` step and the placeholder `VITE_*` env block. Parity job: `container: mcr.microsoft.com/playwright:v1.64.1-noble`, always runs, steps no-op when the diff touches none of core/tokens/app/css/js (no `paths:` filter, Pitfall 3).

**Dockerfile** (`packages/api/Dockerfile`): currently `COPY package.json package-lock.json ./` + `npm ci --omit=dev` from the `packages/api` context. Move build context to repo root, copy root `package.json`/lockfile and `packages/api/package.json`, run `npm ci -w @roadmapsnap/api --omit=dev`; update `compose.yaml` `build:` accordingly. Root `package.json`: add `"workspaces": ["packages/*"]`, `engines`, widen `test` script (`"test": "node --test tests/**/*.test.js"` today), delete per-package lockfiles.

---

## Shared Patterns

### Core purity (applies to every `packages/core/src/*` file)
**Source:** `js/core/workflow.js` override-param style (73-97, 142-172) + project rule "`js/core/` is pure: no DOM, no state access".
Explicit args only; `today` always injected; return `null`/empty for bad input; no module-scope `window.*` assignment (Lite bindings keep the guarded `typeof window !== 'undefined'` block from workflow.js 174-193). Enforced by `packages/core/tests/purity.test.js`.

### Strangler binding for Lite `js/core/*`
**Source:** RESEARCH Pattern 1/4, existing tests `tests/core/*.test.js`.
Same export names, still read `CONFIG`/`window` only inside the binding, delegate to `@roadmapsnap/core`. All 141 existing tests must stay green and unchanged after each module. Never fix a bug in the binding only.

### Lite style
**Source:** `js/core/workflow.js` / `js/ui/filterBar.js`. 4 spaces, semicolons, `var`/`const` mixed per file, `/** */` header comment stating purpose and `window` dependencies. Update headers to say "depends on @roadmapsnap/core".

### App style and API client errors
**Source:** `packages/app/src/api/client.test.ts` (Vitest, `vi.stubGlobal('fetch', ...)`, `ApiError`), `hooks/useProjectMutations.ts`. 2 spaces, no semicolons, `import type`, strict TS with `noUnusedLocals`. Do not wrap `mutateAsync` in try/catch unless the UI needs a distinct message.

### API route + test conventions
**Source:** `packages/api/src/routes/auth.js`, `packages/api/tests/auth.test.js`. Handlers use `request.dbClient`; `preHandler: [fastify.authenticate, fastify.setRequestContext]`; tests `build()` from `../src/server.js`, `before`/`after` with `createUser`/`createOrg`/`cleanup`/`closePools` from `./helpers/db.js`.

### Golden-markup test (new)
**Source:** `packages/app/src/api/client.test.ts` (Vitest layout) + `packages/app/src/test/setup.ts` (jest-dom setup) + `packages/app/vite.config.ts` test block (`environment: 'jsdom'`, `globals: true`). Render Lite `js/ui/*` strings with `window`/`CONFIG`/`localStorage` stubs, render React with RTL, normalize (ignore `on*`, `role`, `tabindex`, `aria-*`, `data-*`), compare tag tree + `class` + text + `title`/SVG `<title>`.

### Commit/branch policy
All changes via PR from a branch; subjects `type(scope): summary`; never commit `js/config.js`, `js/config_*.js` (except `config_base.js`) or `.env`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/parity/**` (Playwright config, `parity.spec.ts`, pixelmatch diff, base-vs-head Lite diff script, parity HTML entry) | test | batch | No Playwright or e2e code in repo. Use RESEARCH Pattern 6 sketch. Pin `@playwright/test@1.64.1`, `pixelmatch@8.0.0`, `pngjs@7.0.0` behind a `checkpoint:human-verify` |
| `packages/core/src/models.js` (`buildDashboardModel`, `buildTimelineModel`, `buildFilterBarModel`, `buildRoadmapModel`) | utility | transform | Derivation logic is embedded in `js/ui/*` and `js/app.js` `renderRoadmap` (94-127); extract case by case, no existing model-builder file. Closest shape: `js/core/viewModel.js` `buildDeliverableViewModel` |
| Self-hosted DM Sans `@font-face` in tokens | config | n/a | No fonts in repo (currently Google Fonts `<link>`); use RESEARCH options (`@fontsource/dm-sans` or vendored woff2) |
| `tests/guards/*.test.js` (ci-config, no-app-lib) | test | n/a | No static-guard tests exist; follow the `node:test` + `node:assert/strict` layout of `tests/core/workflow.test.js` and read files with `node:fs` |
| Pre-paint script unit test (`vm` context) | test | n/a | New; read script text from `packages/app/index.html` and run in `node:vm` with stub `localStorage`/`document` |

## Metadata

**Analog search scope:** `js/`, `tests/`, `packages/app/src`, `packages/api/src/routes`, `packages/api/tests`, `packages/tokens`, `.github/workflows`, `packages/api/Dockerfile`
**Files read:** about 25; tracked-ness verified for all cited paths via `git ls-files` (no `.gsd` mirrors involved)
**Pattern extraction date:** 2026-11-22
