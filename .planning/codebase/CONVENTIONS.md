---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# Coding Conventions

**Analysis Date:** 2026-10-24

RoadmapSnap is two products in one repo. Conventions differ between them, so each section names the product it applies to.

- **Lite** (repo root: `index.html`, `js/`, `css/`, `tests/`) is vanilla ES modules with no framework and no build step beyond Vite.
- **SaaS API** (`packages/api`) is Fastify 5 on Node ESM with PostgreSQL via `pg`.
- **SaaS app** (`packages/app`) is React 18 + TypeScript (strict) + TanStack Query + react-router.
- **Tokens** (`packages/tokens`) holds shared CSS tokens (`tokens.css`, `components.css`) and `tokens.js`.

No ESLint, Prettier, or Biome config is present anywhere in the repo. Style is therefore enforced only by convention and by the TypeScript compiler (`packages/app`) and by `scripts/validate-config.mjs` (Lite config).

## Naming Patterns

**Files:**
- Lite modules are camelCase: `js/core/timeline.js`, `js/core/configValidator.js`, `js/state/appState.js`, `js/ui/dependencyArrows.js`, `js/export/png.js`.
- Lite worker: `js/workers/dependencyWorker.js`.
- Lite tests mirror the source name with `.test.js`: `tests/core/timeline.test.js`, `tests/core/configValidator.test.js`, `tests/state/appState.test.js`.
- API route modules are lowercase nouns: `packages/api/src/routes/projects.js`, `workspaces.js`, `auth.js`. Plugins are nouns in `packages/api/src/plugins/` (`auth.js`, `context.js`, `rbac.js`).
- API migrations are versioned SQL: `packages/api/src/db/migrations/V{n}__{snake_case_description}.sql` (for example `V2__rls_policies.sql`, `V11__seed_dependencies_from_config.sql`). Add new migrations with the next free `V` number; never edit an applied one.
- App React components are PascalCase `.tsx`: `packages/app/src/components/timeline/GanttBar.tsx`, `packages/app/src/components/projects/ProjectFormModal.tsx`, `packages/app/src/pages/DashboardPage.tsx`.
- App hooks are `use`-prefixed camelCase `.ts`: `packages/app/src/hooks/useApi.ts`, `useProjectMutations.ts`, `useRole.ts`, `useWorkspace.ts`.
- App logic modules are camelCase `.ts` in `packages/app/src/lib/` (`timeline.ts`, `stats.ts`, `dependencyGraph.ts`, `projectFilters.ts`, `timelineSort.ts`, `export.ts`, `themeStorage.ts`).
- App colocated tests use `.test.ts`: `packages/app/src/api/client.test.ts`.

**Functions:**
- Lite: camelCase, plain `function` declarations, attached to `window` for the legacy global surface. Example in `js/core/timeline.js`: `parseDate`, `formatDateDisplay`, `generateMonths`, `calculatePosition`.
- API: camelCase named async functions. Route registration functions are `registerXRoutes`, for example `registerAuthRoutes` in `packages/api/src/routes/auth.js`. The plugin factory is `async function rbacPlugin(fastify)`.
- App: camelCase. React components are named exports (`export function useCreateProject`). Hook factories return the TanStack mutation or query object.

**Variables:**
- Lite core and UI use `var` and `function` declarations (see `js/core/timeline.js`, `js/ui/dashboard.js`). Newer Lite code, such as `js/state/appState.js`, uses `let` and `const`. Match the style of the file you are editing rather than rewriting it.
- API and app use `const` by default and `let` only when reassigned.

**Constants:**
- UPPER_SNAKE_CASE for module-level lookup tables: `ROLE_LEVEL` in `packages/api/src/plugins/rbac.js`, `DEFAULT_STATE` in `js/state/appState.js`, `EXPECTED_DEFAULT_KEYS` in `tests/state/appState.test.js`.
- The Lite global config object is `CONFIG` (`js/config.js`, built from `js/config_base.js`). Read it through guards such as `typeof CONFIG !== 'undefined' && CONFIG.TIMELINE && ...` as in `js/core/timeline.js`.

**Types:**
- App: `interface` for object shapes, exported next to the client: `export interface Project`, `export interface WorkspaceSummary` in `packages/app/src/api/client.ts`. Use `type` for unions and body shapes derived from others (for example `CreateProjectBody`).
- Shared type declarations for the Lite surface live in `types/roadmapsnap.d.ts`.

## Code Style

**Formatting (no formatter configured):**
- Lite `js/core/` and `js/ui/` use 4-space indentation and semicolons (see `js/core/timeline.js`). `js/state/appState.js` and `js/app.js` use 4 spaces and single quotes. Keep 4 spaces in Lite.
- API uses 2-space indentation, semicolons, and single quotes (`packages/api/src/routes/auth.js`, `packages/api/src/plugins/rbac.js`).
- App uses 2-space indentation, no semicolons, and single quotes (`packages/app/src/hooks/useProjectMutations.ts`, `packages/app/src/api/client.ts`). Note that `packages/app/src/api/client.ts` also omits semicolons, while `packages/app/src/lib/` files should be checked before adding them.
- Trailing commas appear in multi-line object and argument lists in the API and app.

**Linting:**
- Not configured. Do not add lint-only changes in unrelated files.
- Strict type checking is the de facto lint for the app. `packages/app/tsconfig.json` sets `"strict": true`, `"noUnusedLocals": true`, and `"noUnusedParameters": true`. Run `npx tsc --noEmit` in `packages/app` before pushing.

## Import Organization

**Lite (browser ES modules):**
- Imports are relative with the `.js` extension and listed at the top of the file. `js/app.js` imports every core and UI module in dependency order, and each module attaches itself to `window` when loaded.
- Node tests set up `globalThis.window = globalThis.window || {}` before dynamically importing the module under test (`tests/core/timeline.test.js`).

**API (Node ESM):**
- Order: Node built-ins and package imports first (`jose`, `pg`, `fastify`), then local relative imports with `.js` extensions.
- Tests import `build` from `../src/server.js` and `node:test` / `node:assert/strict`.

**App (TypeScript):**
- Order: third-party packages (`@tanstack/react-query`, `@auth0/auth0-react`), then local modules. Type-only imports use `import type` (`packages/app/src/hooks/useProjectMutations.ts`).
- Relative imports, no path alias configured.

**Path Aliases:**
- None detected for the app or the API. Use relative paths.

## Error Handling

**API routes return explicit status objects; they do not throw for expected failures:**

```js
// packages/api/src/routes/projects.js
if (request.orgId == null) {
  return reply.status(403).send({ error: 'Forbidden', message: 'No organization context' });
}
```

- Error body shape is always `{ error: <HTTP reason phrase>, message: <human text> }`. Keep this shape for new routes.
- Use `reply.status(n).send(...)` and `return` it; do not mix with a raw `throw` for expected 4xx cases.
- Authorization is a preHandler, not inline checks: `fastify.requireRole('editor')` (`packages/api/src/plugins/rbac.js`). `requireRole` throws at registration time on an unknown role name, so typos fail fast.
- Unhandled errors are logged in `packages/api/src/server.js` (`console.error(err)`), then the generic error handler responds.
- Configuration errors throw at startup: `packages/api/src/plugins/auth.js` throws `'AUTH0_DOMAIN and AUTH0_AUDIENCE must be set'`.

**App:**
- API failures are normalized to `ApiError` (with `status` and `message`) by the client in `packages/app/src/api/client.ts`. Components catch `ApiError`, not raw `Response` objects.
- Mutations surface errors through TanStack Query's `useMutation` state. Do not add local try/catch around `mutateAsync` unless the UI needs a different message.

**Lite:**
- Pure core functions return `null` or empty values for invalid input rather than throwing: `parseDate('')` returns `null` (`js/core/timeline.js`), `formatDateDisplay('')` returns `''`.
- Export failures log with `console.error` and return early, for example `js/export/png.js`.
- Config validation collects warnings and logs them: `console.warn('RoadmapSnap config warnings:', validation.warnings)` in `js/app.js`.

## Logging

**Lite:** `console.warn` and `console.error` only, for config and export problems. No logging in `js/core/`.

**API:**
- `console.error` for unhandled request errors (`packages/api/src/server.js`).
- `console.log` and `console.error` in migration tooling (`packages/api/src/db/migrate.js`) with a `migrate:` prefix on each message. Follow that prefix convention for new CLI scripts.
- Audit trail for data changes is written by the database trigger (`packages/api/src/db/migrations/V3__audit_trigger.sql`) and `packages/api/src/db/audit.js`, not by application logging.

**App:** No logging framework. Use `console` only during development and remove it before committing.

## Comments

**When to comment:**
- File header block comments describe purpose and dependencies. Examples: `js/core/timeline.js` (what it exports and where it was copied from), `js/ui/dashboard.js` (the `window` globals it depends on), `packages/api/src/plugins/auth.js` (what Fastify decorator it adds).
- Inline comments explain non-obvious rules, such as the test-only header bypass in `packages/api/src/plugins/auth.js` (`X-Test-User-Sub` is allowed only when `NODE_ENV` is `test` or `development`).
- Test files comment why a stub exists: `// Client validates JWT shape (three segments) before fetch` in `packages/app/src/api/client.test.ts`.

**JSDoc/TSDoc:**
- Lite and API use `/** ... */` block headers on modules and on public helpers (`js/core/timeline.js`, `packages/api/src/routes/auth.js`). Describe parameters in prose when useful.
- App uses `/** ... */` for exported interfaces (`packages/app/src/api/client.ts`). Do not add per-parameter TSDoc to internal hooks.

## Function Design

**Size:** Lite and API functions are short. Large Lite rendering code is split across `js/ui/` modules, one per panel (`dashboard.js`, `filterBar.js`, `timelineGrid.js`, `dependencyArrows.js`).

**Parameters:**
- Lite core takes explicit inputs and does not read `CONFIG` or `AppState` directly where a pure function is possible. `js/core/` must stay free of DOM and state access (AGENTS.md).
- API route handlers read request data from `request.body`, `request.params`, and `request.dbClient`. Never open a connection from `pool` directly, because RLS session variables would be missing.
- App hooks take the workspace id as an argument: `useCreateProject(workspaceId: string)`.

**Return Values:**
- Lite core returns plain objects or arrays (for example `generateMonths()` returns `{ date, name, daysInMonth }[]`).
- API routes return plain objects (Fastify serializes them) or call `reply.send`.
- App API methods return typed promises: `api.createProject(workspaceId, body)`.

## Module Design

**Lite exports:** Modules attach public functions to `window` so the classic-script UI and inline `onclick` handlers can reach them. In `js/core/timeline.js` the last block assigns to `window`. Keep this pattern for Lite modules that the HTML calls directly. Tests use the same modules through `await import(...)`.

**API exports:** Each route file exports one `register...Routes(fastify)` function. Plugins export a default async plugin function registered through `fastify.register`.

**App exports:** Named exports only. Components and hooks are named, and there are no default exports in `packages/app/src/`.

**Barrel Files:** Not used. Import from the specific module path.

## Cross-Product Rules (from AGENTS.md)

- Lite UI state changes call a full `renderRoadmap()`. Do not patch the DOM for a state change. UI modules return HTML strings built with the `html` tagged template in `js/ui/renderer.js`. Use `raw()` only for content that is already escaped or trusted, such as SVG icon strings (`riskIconSVG` in `js/ui/dashboard.js`).
- Logic in `packages/app/src/lib/` mirrors `js/core/` (timeline, stats, dependencies, filters). Fix a logic bug in both places.
- Lite themes are set with `[data-theme]` on `<html>` and styled in `css/roadmap.css`. App themes are CSS classes. Both consume `packages/tokens`. Do not hardcode colors that exist as tokens.
- Never commit `js/config.js`, any `js/config_*.js` other than `js/config_base.js`, `.env` files, or `.webui_secret_key`.
- Commit subjects follow `type(scope): summary` (for example `chore(agents): adopt AGENTS.md project context, fix CI/config drift`).

---

*Convention analysis: 2026-10-24*
