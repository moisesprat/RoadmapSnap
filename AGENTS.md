<!-- bmad:context -->
<!-- Verified 2026-09-29 against a5bb5ba. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## RoadmapSnap

Two products in one repo. Lite (root: `index.html`, `js/`, `css/`) is a static, config-driven roadmap dashboard in vanilla ES modules, with no backend and no framework. SaaS (`packages/api` Fastify + PostgreSQL + Auth0, `packages/app` React + TanStack Query, `packages/tokens` shared CSS tokens) is under development. Reference docs in `docs/`, BMad planning artifacts in `_bmad-output/`.

## Policy

- All changes go through a PR from a branch; never commit to `main`. Commit subjects follow `type(scope): summary`, as in history.
- Never commit `js/config.js` (gitignored user data) or any `js/config_*.js` other than `js/config_base.js` — they are sample programs used for testing.
- Never commit `.env` files or `.webui_secret_key`; only `.env.example`.

## Where things are

- Lite data flow: `js/config.js` → `js/core/configValidator.js` (schema: `schema/config.schema.json`) → `AppState` (`js/state/appState.js`) → `js/core/` → `js/ui/` → DOM. Config reference: `docs/config-reference.md`.
- SaaS request lifecycle: `packages/api/src/plugins/auth.js` (Auth0 JWT) → `context.js` (DB user, org, RLS session vars) → route handlers.
- Multi-tenant model: organizations → workspaces → projects → milestones/dependencies; roles `viewer < editor < admin`, enforced with `fastify.requireRole('editor')`.

## Running and verifying

- `js/config.js` is created by copying `js/config_base.js`. `npm run validate` and `npm run build` read it and fail without it.
- Iterate on one Lite test file: `node --test tests/core/timeline.test.js`.
- Root CI runs `npm test`, `npm run validate` and `npm run build` on Node 20. `build:check` is not run by CI.
- `packages/api` tests and `npm run migrate` need the local Docker PostgreSQL (localhost:5432) and a `roadmapsnap_app` role created NOSUPERUSER, which RLS depends on (see `.github/workflows/api-ci.yml`).
- `packages/app` CI runs `npx tsc --noEmit`, then tests, then build.

## Conventions that differ from defaults

- Lite state changes trigger a full `renderRoadmap()` re-render; do not patch the DOM. UI modules return HTML strings via the `html`` ` tagged template, and `raw()` for unescaped content.
- `js/core/` is pure functions: no DOM, no state access.
- API route handlers use `request.dbClient`; never open a connection from `pool` directly, or the RLS session vars are missing.
- `packages/app/src/lib/` mirrors `js/core/` (timeline, stats, dependencies, filters). Fix logic bugs in both.
- Lite themes are `[data-theme]` on `<html>` (`css/roadmap.css`); the app uses CSS classes. Both consume `packages/tokens`.

<!-- /bmad:context -->
