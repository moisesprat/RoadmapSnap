---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
<!-- refreshed: 2026-10-24 -->

# Architecture

**Analysis Date:** 2026-10-24

## System Overview

The repository holds two products that share a repo but not a runtime:

- **Lite** (repo root: `index.html`, `js/`, `css/`) is a backend-free, config-driven roadmap dashboard. It runs as a static page with vanilla ES modules and a classic `js/config.js` script.
- **SaaS** (`packages/api`, `packages/app`, `packages/tokens`) is a multi-tenant system under development: a Fastify API over PostgreSQL with Auth0 JWT authentication and row-level security, and a React + TanStack Query frontend.

```text
 LITE (static, client-side only)
┌────────────────────────────────────────────────────────────────────┐
│ index.html                                                          │
│   <script src="./js/config.js">  (classic, user data, gitignored)   │
│   <script type="module" src="js/app.js">                            │
└───────────────┬────────────────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────┐
│ js/app.js  (entry, DOMContentLoaded → validateConfig → AppState)   │
│   AppState.subscribe(→ renderRoadmap())                             │
└───────┬───────────────────────┬───────────────────────┬────────────┘
        ▼                       ▼                       ▼
 js/core/* (pure logic)   js/state/appState.js    js/ui/* (HTML strings)
 timeline, dependencies,  get/set/reset/subscribe  renderer.js html``
 stats, workflow,                                  dashboard, filterBar,
 viewModel, configValid.                           timelineGrid, grouping
                                                       │
                                                       ▼
                                          document.body.innerHTML  (full re-render)

 SAAS (client/server)
┌─────────────────────────────┐   Bearer JWT    ┌──────────────────────────────────┐
│ packages/app (React/Vite)    │ ─────────────▶ │ packages/api (Fastify 5)          │
│  Auth0Provider → App.tsx     │                │  server.js → plugins: env, cors,  │
│  routes: /login /callback    │ ◀───────────── │  context.js, rbac.js              │
│  /dashboard (AuthGuard)      │   JSON         │  auth.js (jose JWKS verification) │
│  TanStack Query → api/client │                │  routes/*.js → request.dbClient   │
└──────────────┬──────────────┘                └───────────────┬──────────────────┘
               │ imports                                        ▼
               ▼                                  PostgreSQL (RLS on app.current_org_id)
 packages/tokens (CSS tokens) ◀── also used by Lite css/ theme variables
```

## Pattern Overview

**Overall (Lite):** Client-side single-page render from a configuration object. State is a single store; every state change re-renders the whole page from HTML strings.

**Overall (SaaS):** Layered HTTP API with a request-scoped database client. Tenancy is enforced in PostgreSQL through RLS policies keyed on session variables set per request, with role checks in Fastify `preHandler` hooks.

**Key Characteristics (Lite):**
- No build-time framework; `js/app.js` is the only module entry. Several `js/*` files also attach globals to `window` (for example `window.AppState`, `window.validateConfig`, `window.buildDeliverableViewModel`) because inline handlers in HTML strings call them.
- `js/core/` is pure: no DOM and no `AppState` access (per project policy in `AGENTS.md`).
- Any state change calls `renderRoadmap()`, which rebuilds `document.body.innerHTML`. DOM patching is intentionally not used.
- Config is validated against `schema/config.schema.json` before first render; errors replace the page with a list.

**Key Characteristics (SaaS):**
- Auth is per-request: `packages/api/src/plugins/auth.js` verifies Auth0 JWTs against the tenant JWKS (`jose`), with an `X-Test-User-Sub` bypass only when `NODE_ENV` is `test` or `development`.
- `packages/api/src/plugins/context.js` acquires a pooled client per request, provisions the `users` row on first login, resolves the active org, and runs `SET LOCAL app.current_org_id` and `SET LOCAL app.current_user_id`. It exposes `request.dbClient`, `request.dbUser`, and `request.orgId`.
- `packages/api/src/plugins/rbac.js` exposes `fastify.requireRole(minRole)` with levels `viewer=1`, `editor=2`, `admin=3`. Route files also define a local `requireRole` helper with the same semantics.
- The frontend mirrors pure logic from Lite in `packages/app/src/lib/` (`timeline.ts`, `stats.ts`, `dependencyGraph.ts`, `projectFilters.ts`, `timelineSort.ts`, `export.ts`). Logic bugs must be fixed in both trees.

## Layers

### Lite

**Config layer:**
- Purpose: Declares programs, deliverables, milestones, dependencies, workflow and timeline.
- Location: `js/config.js` (user copy, gitignored; created from `js/config_base.js`). Sample programs for testing: `js/config_*.js` except `config_base.js`.
- Contains: Plain JS object assigned to global `CONFIG`.
- Depends on: Nothing at runtime.
- Used by: `js/core/configValidator.js`, `js/app.js`, all `js/core/*` and `js/ui/*` functions.

**Validation layer:**
- Purpose: Structural and semantic checks on `CONFIG`.
- Location: `js/core/configValidator.js` (exports `validateConfig`); schema at `schema/config.schema.json`; CLI at `scripts/validate-config.mjs`.
- Contains: Date parsing helpers (`isDDMMYYYY`, `parseMonthYear`, `parseDDMMYYYY`) and `validateConfig(config)`.
- Depends on: `CONFIG` shape.
- Used by: `js/app.js` on `DOMContentLoaded`; `npm run validate`.

**State layer:**
- Purpose: Holds UI state (filters, sort, zoom, collapsed groups, theme, active dependency graph, timeline bounds).
- Location: `js/state/appState.js`
- Contains: Closure-scoped store with `get()`, `set(patch)`, `reset()`, `subscribe(fn)`. Exports `AppState` as default and sets `window.AppState`. Reads the theme from `localStorage` key `roadmapsnap-theme`, mapping the legacy value `dsm-firmenich` to `evergreen`.
- Depends on: `localStorage` only.
- Used by: `js/app.js`, `js/ui/*`.

**Core logic layer (pure):**
- Purpose: Timeline math, dependency analysis, stats, workflow state, view-model building.
- Location: `js/core/timeline.js`, `js/core/dependencies.js`, `js/core/stats.js`, `js/core/workflow.js`, `js/core/viewModel.js`, `js/roadmap.utils.js`
- Contains: Functions such as `parseDate`, `getTodayDate`, `generateMonths`, `calculatePosition`, `getEffectiveAtRiskSet`, `buildDeliverableViewModel`, `resolveStateColor`.
- Depends on: `CONFIG` passed in or read as a global; `viewModel.js` also reads the active theme via `document` attributes (`isMonochromeTheme`, `isPapallonaTheme`, `isEvergreenTheme`).
- Used by: `js/app.js`, `js/ui/*`, `js/export/*`.

**UI layer:**
- Purpose: Produce HTML strings for each section of the page.
- Location: `js/ui/renderer.js` (template helpers), `js/ui/dashboard.js`, `js/ui/filterBar.js`, `js/ui/grouping.js`, `js/ui/timelineGrid.js`, `js/ui/dependencyArrows.js`, `js/ui/exportControls.js`
- Contains: Pure string-returning render functions using `html` and `raw` from `renderer.js`.
- Depends on: `js/core/*`, `AppState`, `CONFIG`.
- Used by: `renderRoadmap()` in `js/app.js`.

**Export layer:**
- Purpose: CSV, JSON and PNG export of the current view.
- Location: `js/export/csv.js`, `js/export/json.js`, `js/export/png.js` (PNG uses `html2canvas` loaded from CDN in `index.html`).

**Worker (not wired):**
- `js/workers/dependencyWorker.js` exists, but no `new Worker(` reference was found under `js/`. Treat it as dormant until a caller is added.

### SaaS API (`packages/api`)

**Server composition:**
- Location: `packages/api/src/server.js` (`build()` returns a Fastify instance; the file listens only when run directly).
- Registers: `@fastify/env` (schema: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` required; `DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `DEFAULT_ORG_ID`), `@fastify/cors`, `contextPlugin`, `rbacPlugin`.
- Built-in routes: `GET /` (service descriptor), `GET /health` (no auth, no DB).

**Plugins:**
- `packages/api/src/plugins/auth.js`: `fastify.authenticate` decorator; JWKS verification with issuer `https://${AUTH0_DOMAIN}/`.
- `packages/api/src/plugins/context.js`: `fastify.setRequestContext` decorator; DB user lookup or insert, org resolution (`X-Org-Id` header, then `?orgId`, then first `org_members` row), `SET LOCAL` session variables, and client release on response `finish`/`close`.
- `packages/api/src/plugins/rbac.js`: `fastify.requireRole(minimumRole)`.

**Database access:**
- Location: `packages/api/src/db/client.js` (lazy `pg.Pool` singleton, `query`, `testConnection`, and a `pool` facade), `packages/api/src/db/audit.js`, `packages/api/src/db/migrate.js`.
- Rule: route handlers must use `request.dbClient`. Opening a connection from `pool` bypasses the session variables that RLS depends on.

**Routes:**
- `packages/api/src/routes/auth.js`: `GET /auth/me`, `PATCH /auth/me`
- `packages/api/src/routes/workspaces.js`: `GET /workspaces`, `GET /workspaces/:workspaceId`, `POST /workspaces` (editor), `PATCH /workspaces/:workspaceId` (editor), `DELETE /workspaces/:workspaceId` (admin), `GET /workspaces/:workspaceId/projects` (returns projects with inbound dependencies)
- `packages/api/src/routes/projects.js`: `POST /workspaces/:workspaceId/projects` (editor), `PATCH /projects/:projectId` (editor), `DELETE /projects/:projectId` (editor)

### SaaS Frontend (`packages/app`)

**Bootstrap:**
- `packages/app/src/main.tsx`: applies stored theme class before paint, imports `@roadmapsnap/tokens/css` and `components.css`, creates `QueryClient` (`staleTime` 30 s, `retry` 1), wraps the app in `Auth0Provider` (`cacheLocation="localstorage"`) and `QueryClientProvider`.
- `packages/app/src/App.tsx`: `BrowserRouter` routes `/login`, `/callback`, `/dashboard` (wrapped in `AuthGuard`), and `*` to `/dashboard`. Has a 12 s loading timeout fallback.

**Data access:**
- `packages/app/src/api/client.ts`: typed fetch wrapper and DTO interfaces (`Project`, `ProjectDependency`, `WorkspaceSummary`, `WorkflowItem`).
- `packages/app/src/hooks/useApi.ts`, `useWorkspace.ts`, `useProjectMutations.ts`, `useRole.ts`: TanStack Query hooks; `useRole` mirrors the server's role levels.

**Presentation:**
- `packages/app/src/pages/DashboardPage.tsx` composes `components/layout/AppShell.tsx`, `components/projects/*` (list and modals), `components/dashboard/*` (KPI cards, progress bar), and `components/timeline/*` (Gantt bars, milestones, dependency arrows, toolbar, floating filter and export menus).
- `packages/app/src/lib/*`: pure logic mirroring `js/core/`.

**Shared tokens:**
- `packages/tokens/` exports `tokens.js`, `tokens.css`, `components.css` (package `@roadmapsnap/tokens`, consumed as `file:../tokens`).

## Data Flow

### Lite: Page Render

1. Browser loads `index.html`; classic script defines `CONFIG` from `js/config.js` (`index.html:18`).
2. `js/app.js` imports core, UI and export modules, which attach their functions to `window` (`js/app.js:1-22`).
3. On `DOMContentLoaded`, `validateConfig(CONFIG)` runs. Errors replace `document.body` with an error list and stop initialization (`js/app.js:~143`).
4. `AppState.subscribe` is registered; theme changes update `data-theme` on `<html>` and `localStorage`; every state change calls `renderRoadmap()` (`js/app.js:~153`).
5. `AppState.set({})` triggers the first render.
6. `renderRoadmap()` computes months (`generateMonths` or `generateVisibleMonthsForZoom`), stats, upcoming milestones and at-risk sets, then builds HTML from `renderFilterBar`, `renderExportControls`, `renderDashboard`, `renderTimelineGrid`, and `renderFooter` (`js/app.js:94-120`).
7. The HTML is assigned to `document.body.innerHTML`. If a dependency graph is active or risk-only filtering is on, `drawDependencyArrows()` runs on the next tick (`js/app.js:121-125`).

**User interaction:** Inline `onclick` attributes in generated HTML call `window.*` functions (for example `window.setDateRange`), which call `AppState.set`, which triggers step 6 again.

### SaaS: Authenticated API Request

1. Frontend obtains an Auth0 access token for `VITE_AUTH0_AUDIENCE` and sends `Authorization: Bearer <jwt>`.
2. `authenticate` verifies the JWT and sets `request.user` (`packages/api/src/plugins/auth.js`).
3. `setRequestContext` acquires a pooled client, upserts the user row by `auth0_id`, resolves the org, runs `SET LOCAL app.current_org_id` and `app.current_user_id`, and sets `request.dbUser`, `request.orgId`, `request.dbClient` (`packages/api/src/plugins/context.js`).
4. `requireRole('editor')` (or `admin`) checks the membership role before the handler runs (`packages/api/src/plugins/rbac.js`; route-local copies in `routes/projects.js` and `routes/workspaces.js`).
5. The handler queries through `request.dbClient`. RLS policies such as `org_isolation` (`packages/api/src/db/migrations/V2__rls_policies.sql`) filter rows by `current_setting('app.current_org_id')`. An audit trigger (`V3__audit_trigger.sql`) records changes.
6. The client is released when the response finishes.

**State Management:**
- Lite: single mutable object in `appState.js`, replaced immutably on each `set`; the DOM is derived from it.
- SaaS server: no in-process cache; state lives in PostgreSQL and is scoped per request by session variables.
- SaaS client: server state in TanStack Query (30 s stale time); auth state in Auth0 React SDK; theme class on `<html>`.

## Key Abstractions

**`CONFIG` (Lite):**
- Purpose: The entire dataset and display configuration for a roadmap.
- Examples: `js/config_base.js`, `tests/fixtures/config.minimal.js`, `tests/fixtures/config.complex.js`
- Pattern: Global object validated against `schema/config.schema.json`; documented in `docs/config-reference.md`.

**`AppState` (Lite):**
- Purpose: Single UI-state store.
- Examples: `js/state/appState.js`
- Pattern: Closure store with listener set; subscribers receive `(state, prevState)`.

**Deliverable view model (Lite):**
- Purpose: Precomputed presentation data for one deliverable row.
- Examples: `js/core/viewModel.js` (`buildDeliverableViewModel`)
- Pattern: Pure function from source, months, today position and dependency graph to a plain object consumed by UI string builders.

**Request context (SaaS):**
- Purpose: Per-request DB client, user, org and role.
- Examples: `packages/api/src/plugins/context.js`
- Pattern: Fastify decorators (`setRequestContext`, `authenticate`, `requireRole`) composed into `preHandler` arrays (`commonPreHandler` in route files).

**Hierarchy (SaaS data model):**
- Organizations → workspaces → projects → milestones and dependencies. Migrations are in `packages/api/src/db/migrations/V1__core_schema.sql` onward; seed data is introduced by `V7`, `V8`, `V11`.

## Entry Points

**Lite page:**
- Location: `index.html` (loads `js/config.js` then `js/app.js`)
- Triggers: Browser load; `npm run dev` (Vite) or `npm run build` (output copies `js/config.js` into `dist/js/`).
- Responsibilities: Validate config, subscribe to state, render.

**API server:**
- Location: `packages/api/src/server.js`
- Triggers: `npm start` or `npm run dev` in `packages/api` (`node --watch`). Exports `build()` for tests.
- Responsibilities: Env validation, CORS, plugin registration, health endpoints, route mounting.

**Migrations:**
- Location: `packages/api/src/db/migrate.js`, run via `npm run migrate` in `packages/api`.

**Frontend app:**
- Location: `packages/app/src/main.tsx` (rendered into `#root` from `packages/app/index.html`)
- Triggers: Vite dev server (`npm run dev`, port 3001) or built static assets.

## Architectural Constraints

- **Threading:** Lite runs on the browser main thread (the dependency worker is not wired). The API is a single Node.js event loop with an async `pg` pool.
- **Global state (Lite):** `window.AppState`, `window.CONFIG` (read), and several `window.*` function exports from `js/app.js`, `js/core/viewModel.js`, `js/core/configValidator.js`, `js/ui/*`, and `js/export/*`. Inline HTML handlers depend on these globals, so renaming them breaks the UI.
- **Global state (API):** `packages/api/src/db/client.js` holds a lazily created module-level `Pool`.
- **Circular imports:** None were identified in the files read.
- **Tenancy boundary:** Tenant isolation depends on RLS plus the `SET LOCAL` values in `context.js`. Code that bypasses `request.dbClient` or runs as a superuser role will bypass it. The DB role used by the app must be `NOSUPERUSER` (see `AGENTS.md` and `.github/workflows/api-ci.yml`).
- **Theme coupling:** Lite theme is `[data-theme]` on `<html>` (`css/roadmap.css`); SaaS uses CSS classes. Both consume `packages/tokens`.
- **Logic duplication:** `js/core/` and `packages/app/src/lib/` implement the same rules. A change in one must be ported to the other.

## Anti-Patterns

### Patching the Lite DOM incrementally

**What happens:** Code updates individual elements after a state change instead of re-rendering.
**Why it's wrong:** The render pipeline assumes `renderRoadmap()` rebuilds everything; partial updates drift from `AppState`, and event handlers embedded as strings get lost.
**Do this instead:** Change state with `AppState.set(...)` and let the subscriber in `js/app.js` call `renderRoadmap()`. Return HTML from a `js/ui/*` function (see `js/ui/dashboard.js`).

### Opening DB connections outside `request.dbClient`

**What happens:** A route calls `pool.instance.query(...)` or the `query` export from `packages/api/src/db/client.js`.
**Why it's wrong:** `SET LOCAL app.current_org_id` and `app.current_user_id` are set only on the request client, so the query runs without the RLS context and either returns nothing or, under misconfiguration, sees data across orgs.
**Do this instead:** Read `request.dbClient` in the handler, after `preHandler: [...commonPreHandler, requireRole('editor')]`, as in `packages/api/src/routes/projects.js`.

### Interpolating identifiers into `SET LOCAL`

**What happens:** `packages/api/src/plugins/context.js` builds `SET LOCAL app.current_org_id = '${resolvedOrgId}'` and the user id the same way.
**Why it's wrong:** `SET` does not accept bind parameters, so string interpolation is the usual pattern here, but any value that is not a validated UUID would be an injection vector.
**Do this instead:** Keep the `isValidUuid` check on every value that reaches a `SET LOCAL`. Use `set_config($1, $2, true)` with bind parameters if the code is touched.

## Error Handling

**Strategy (Lite):** Validate once at startup; on errors, render an error list and stop. Runtime rendering assumes valid config.

**Strategy (API):** Return JSON `{ error, message }` with explicit status codes from preHandlers (`401` for auth, `403` for org/role failures). Unhandled errors bubble to Fastify's default handler. `context.js` releases the client and rethrows on user-lookup errors.

**Patterns:**
- JWT failure logs a warning and returns `401 Invalid token` (`auth.js`).
- Missing org or user returns `403` from `rbac.js`.
- Missing `preferences` column is tolerated for backward-compatible user queries (`context.js`).

## Cross-Cutting Concerns

**Logging:** Lite uses `console.warn` for non-blocking config warnings. API uses Fastify's built-in logger (`logger: true` in `server.js`) and `fastify.log.warn` in `auth.js`.
**Validation:** Lite: `js/core/configValidator.js` against the JSON schema. API: `@fastify/env` schema at startup; per-route validation is defined in route files.
**Authentication:** Lite has none (static, local data). API uses Auth0 JWTs verified with `jose`; the client uses `@auth0/auth0-react` with `AuthGuard` in `packages/app/src/auth/AuthGuard.tsx`.

---

*Architecture analysis: 2026-10-24*
