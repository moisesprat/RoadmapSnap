---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# Codebase Structure

**Analysis Date:** 2026-10-24

## Directory Layout

```
RoadmapSnap/                         # repo root (Lite product lives here)
├── index.html                       # Lite page; loads js/config.js then js/app.js
├── css/roadmap.css                  # Lite styles and [data-theme] variants
├── js/                              # Lite runtime (ES modules + globals)
│   ├── app.js                       # Lite entry: init, AppState subscription, renderRoadmap
│   ├── config_base.js               # Committed sample config (copy to js/config.js)
│   ├── roadmap.utils.js             # Shared helpers exposed on window
│   ├── core/                        # Pure logic (no DOM, no AppState)
│   ├── state/appState.js            # Single UI state store
│   ├── ui/                          # HTML-string renderers
│   ├── export/                      # CSV, JSON, PNG export
│   └── workers/dependencyWorker.js  # Not wired (no Worker() caller found)
├── schema/config.schema.json        # JSON Schema for CONFIG
├── types/roadmapsnap.d.ts           # Type declarations for the config shape
├── scripts/                         # Node CLIs: validate-config, generate-docs
├── tests/                           # node:test suites for Lite
│   ├── core/                        # Unit tests for js/core
│   ├── state/                       # AppState tests
│   └── fixtures/                    # config.minimal.js, config.complex.js
├── docs/                            # config-reference.md, monorepo.md, previews
├── packages/                        # SaaS product
│   ├── api/                         # Fastify + PostgreSQL backend
│   ├── app/                         # React + Vite frontend
│   └── tokens/                      # Shared CSS/JS design tokens
├── vite.config.js                   # Lite build config
├── package.json                     # Lite scripts (test, validate, build, dev)
├── .github/workflows/               # ci.yml (Lite), api-ci.yml, app-ci.yml
├── _bmad-output/                    # BMad planning artifacts (not runtime)
└── .planning/codebase/              # Generated codebase map documents
```

## Directory Purposes

**`js/core/`:**
- Purpose: Pure functions for timeline math, dependencies, stats, workflow, config validation, view models.
- Contains: `timeline.js`, `dependencies.js` (largest core module, ~310 lines), `workflow.js`, `stats.js`, `viewModel.js`, `configValidator.js`.
- Key files: `js/core/timeline.js` (`generateMonths`, `calculatePosition`), `js/core/viewModel.js` (`buildDeliverableViewModel`), `js/core/configValidator.js` (`validateConfig`).

**`js/state/`:**
- Purpose: The single store for UI state.
- Contains: `appState.js` only.
- Key files: `js/state/appState.js`.

**`js/ui/`:**
- Purpose: Section renderers returning HTML strings through `html`` ` and `raw()` from `js/ui/renderer.js`.
- Contains: `renderer.js` (helpers), `dashboard.js`, `filterBar.js`, `grouping.js`, `timelineGrid.js`, `dependencyArrows.js`, `exportControls.js`.
- Key files: `js/ui/renderer.js`, `js/ui/timelineGrid.js`.

**`js/export/`:**
- Purpose: Export current view.
- Contains: `csv.js`, `json.js`, `png.js`.

**`js/workers/`:**
- Purpose: Intended off-thread dependency computation.
- Contains: `dependencyWorker.js`. Not referenced by current Lite modules.

**`tests/`:**
- Purpose: Lite unit and state tests run by `node --test`.
- Contains: `tests/core/*.test.js`, `tests/state/appState.test.js`, `tests/fixtures/*.js`.

**`schema/`:**
- Purpose: Config contract consumed by the validator and documented in `schema/README.md`.

**`packages/api/src/`:**
- Purpose: API server source.
- Contains: `server.js`, `loadEnv.js`, `plugins/`, `routes/`, `db/`.

**`packages/api/src/plugins/`:**
- Purpose: Fastify plugins that decorate requests.
- Contains: `auth.js` (JWT), `context.js` (DB client, user, org, RLS vars), `rbac.js` (role guard).

**`packages/api/src/routes/`:**
- Purpose: HTTP handlers grouped by resource.
- Contains: `auth.js` (`/auth/me`), `workspaces.js`, `projects.js`.

**`packages/api/src/db/`:**
- Purpose: Connection pool, migration runner, audit helper, SQL migrations.
- Contains: `client.js`, `migrate.js`, `audit.js`, `migrations/` (`V1__core_schema.sql` through `V12__backfill_group_order.sql`, plus `README.md`).

**`packages/api/scripts/`:**
- Purpose: Dev utilities. `generate-config-seed.mjs` produces seed data (`npm run seed:config`).

**`packages/api/tests/`:**
- Purpose: API tests against the local Docker PostgreSQL: `auth`, `health`, `projects`, `rls`, `workspaces`.

**`packages/app/src/`:**
- Purpose: React application.
- Contains:
  - `main.tsx`, `App.tsx`, `index.css`, `vite-env.d.ts`
  - `api/` (`client.ts` and its test)
  - `auth/` (`AuthGuard.tsx`)
  - `hooks/` (TanStack Query and role hooks)
  - `lib/` (pure logic mirroring `js/core/`, plus `themeStorage.ts`, `export.ts`)
  - `pages/` (`LoginPage`, `CallbackPage`, `DashboardPage`)
  - `components/layout/`, `components/projects/`, `components/dashboard/`, `components/timeline/`
  - `test/setup.ts` (Vitest and Testing Library setup)

**`packages/tokens/`:**
- Purpose: Design tokens used by the React app and by Lite theming.
- Contains: `tokens.css`, `components.css`, `tokens.js`, `package.json` (exports `.`, `./css`, `./components.css`).

**`_bmad-output/`:**
- Purpose: Planning artifacts from the BMad method. Not imported by code.

**`.planning/codebase/`:**
- Purpose: Output of codebase mapping for GSD commands.
- Generated: Yes. Committed: Decided by the orchestrator.

## Key File Locations

**Entry Points:**
- `index.html`: Lite HTML entry.
- `js/app.js`: Lite JS entry.
- `packages/api/src/server.js`: API `build()` and standalone listener.
- `packages/app/src/main.tsx`: React entry.

**Configuration:**
- `js/config.js`: Lite user data (gitignored; never commit). Created by copying `js/config_base.js`.
- `js/config_*.js` (other than `config_base.js`): sample programs for testing (never commit).
- `schema/config.schema.json`: Lite config schema.
- `packages/api/.env.example`, `packages/app/.env.example`: env templates (copy to `.env`; never commit `.env`).
- `packages/api/src/loadEnv.js`: loads `packages/api/.env`.
- `vite.config.js` (root), `packages/app/vite.config.ts`, `packages/app/tailwind.config.ts`, `packages/app/tsconfig.json`.

**Core Logic:**
- `js/core/*.js`: Lite pure logic.
- `packages/app/src/lib/*.ts`: SaaS client-side logic mirroring Lite.
- `packages/api/src/plugins/context.js`: request-scoped DB and tenant context.

**Testing:**
- Lite: `tests/core/*.test.js`, `tests/state/appState.test.js`.
- API: `packages/api/tests/*.test.js`.
- App: `packages/app/src/api/client.test.ts` and other `*.test.*` files under `packages/app/src/`.

**Database:**
- `packages/api/src/db/migrations/`: ordered SQL migrations (`V<n>__<name>.sql`).

## Naming Conventions

**Files:**
- Lite JS modules: `camelCase.js` (`appState.js`, `configValidator.js`, `viewModel.js`); exceptions `roadmap.utils.js`, `config_base.js`.
- API modules: `camelCase.js` for plugins and DB helpers; resource names for routes (`projects.js`).
- React components: `PascalCase.tsx` (`ProjectFormModal.tsx`, `GanttTimeline.tsx`).
- React lib and hooks: `camelCase.ts` (`timelineSort.ts`, `useProjectMutations.ts`).
- Tests: `*.test.js` (Lite and API), `*.test.ts` (app), placed in `tests/` at root, `packages/api/tests/`, or next to source in `packages/app/src/`.
- Migrations: `V<number>__<snake_case_description>.sql`.

**Directories:**
- Lowercase, single word (`core`, `state`, `ui`, `routes`, `plugins`).
- React component folders grouped by feature area (`timeline`, `projects`, `dashboard`, `layout`).

**Identifiers:**
- Lite globals: `CONFIG`, `AppState`, `window.*` helper functions.
- API role names: lowercase strings `viewer`, `editor`, `admin`.
- Theme names: `data-theme` values and CSS classes match theme ids such as `evergreen`.

## Where to Add New Code

**New Lite feature (logic):**
- Pure computation: `js/core/<topic>.js`, export named functions; add tests in `tests/core/<topic>.test.js`.
- Mirror in SaaS if the rule applies there: `packages/app/src/lib/<topic>.ts`.

**New Lite UI section:**
- Renderer: `js/ui/<section>.js` returning `html`` ` strings; wire it into `renderRoadmap()` in `js/app.js`.
- State: add defaults to `DEFAULT_STATE` in `js/state/appState.js`; update via `AppState.set`.
- Do not patch the DOM directly.

**New Lite config field:**
- Schema: `schema/config.schema.json`; validation: `js/core/configValidator.js`; docs: `docs/config-reference.md`; types: `types/roadmapsnap.d.ts`; sample: `js/config_base.js`.

**New Lite test:**
- `tests/core/<name>.test.js` for core functions, `tests/state/` for state. Run one file with `node --test tests/core/timeline.test.js`.

**New API endpoint:**
- Handler: `packages/api/src/routes/<resource>.js`. Register it in `server.js` if it is a new route module (the existing route modules are wired from the workspace, project and auth route files; check their `register*` exports before adding).
- Guard: `preHandler: [...commonPreHandler, requireRole('editor')]`.
- Data access: `request.dbClient` only.
- Tests: `packages/api/tests/<resource>.test.js`; use the `X-Test-User-Sub` header in test mode.

**New API schema change:**
- Add `packages/api/src/db/migrations/V<next>__<description>.sql`; include RLS policy updates when a table carries `org_id`. Run `npm run migrate` against the local Docker PostgreSQL.

**New React feature:**
- Page: `packages/app/src/pages/<Name>Page.tsx`, route in `App.tsx`.
- Feature component: `packages/app/src/components/<area>/<Name>.tsx`.
- Server data: hook in `packages/app/src/hooks/use<Name>.ts` using TanStack Query; request function in `packages/app/src/api/client.ts`.
- Pure logic: `packages/app/src/lib/<name>.ts`, mirrored in `js/core/` if it is a Lite rule.

**Shared design tokens:**
- `packages/tokens/tokens.css` (variables), `packages/tokens/components.css` (component classes), `packages/tokens/tokens.js` (JS values). Lite themes read `[data-theme]` in `css/roadmap.css`.

**Utilities:**
- Lite shared helpers: `js/roadmap.utils.js`.
- React helpers: `packages/app/src/lib/`.

## Special Directories

**`_bmad-output/`:**
- Purpose: BMad planning documents (PRDs, stories, architecture notes).
- Generated: Partly by BMad agents.
- Committed: Yes.

**`dist/` (created by `npm run build`):**
- Purpose: Vite output plus a copy of `js/config.js`.
- Generated: Yes. Committed: No (build output).

**`packages/*/node_modules/`:**
- Each package has its own lockfile (`package-lock.json`) and install; install inside each package directory.
- Generated: Yes. Committed: No.

**`.planning/`:**
- Purpose: GSD planning state and this codebase map.
- Generated: Yes. Committed: Per orchestrator.

**`js/config.js`:**
- Purpose: User roadmap data.
- Generated: Copied from `js/config_base.js`. Committed: Never (gitignored).

---

*Structure analysis: 2026-10-24*
