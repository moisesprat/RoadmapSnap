---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# Technology Stack

**Analysis Date:** 2026-10-24

## Languages

**Primary:**
- JavaScript (ES modules, `"type": "module"`) - Lite app in `js/`, root tooling in `scripts/`, `tests/`, and API in `packages/api/src/`
- TypeScript 5.7+ - React SPA in `packages/app/src/` (strict checks via `packages/app/tsconfig.json`, type-checked with `tsc --noEmit`)
- TSX/JSX - React components in `packages/app/src/components/`, `packages/app/src/pages/`

**Secondary:**
- SQL (PostgreSQL dialect) - Schema and seed migrations in `packages/api/src/db/migrations/` (V1 through V12)
- CSS - Lite styles in `css/roadmap.css`; app styles in `packages/app/src/index.css`; shared tokens in `packages/tokens/tokens.css` and `packages/tokens/components.css`
- JSON Schema - Lite config validation in `schema/config.schema.json`
- Plain-JS config file - `js/config_base.js` is the tracked template for `js/config.js` (a classic script, `var`-style global `CONFIG` object)
- TypeScript declarations - `types/roadmapsnap.d.ts` (root)

## Runtime

**Environment:**
- Node.js 20 is the CI target (`.github/workflows/ci.yml`, `.github/workflows/app-ci.yml`, `.github/workflows/api-ci.yml` all use `node-version: '20'`)
- No `.nvmrc`, `.node-version`, or `engines` field is declared in any `package.json`
- Lite also runs as static files in any browser (no Node runtime needed at runtime; `index.html` loads `js/app.js` as an ES module)

**Package Manager:**
- npm (lockfileVersion 3)
- Lockfiles present: `package-lock.json` (root), `packages/api/package-lock.json`, `packages/app/package-lock.json`
- `packages/tokens` has no lockfile and is consumed as `file:../tokens` by the app

## Frameworks

**Lite (static dashboard):**
- No runtime framework. Vanilla ES modules with a `html` tagged-template UI layer in `js/ui/` and pure logic in `js/core/`
- Web Worker: `js/workers/dependencyWorker.js` (native `Worker`, no library)

**API (`packages/api`):**
- Fastify 5 (`^5.0.0`) - HTTP server; entry `packages/api/src/server.js`
- `@fastify/jwt` `^9.0.0` - listed as dependency; JWT verification in code is done with `jose` instead (see `packages/api/src/plugins/auth.js`)
- `@fastify/cors` `^10.0.0` - CORS, origin from `CORS_ORIGIN`
- `@fastify/env` `^5.0.0` - env schema validation, `packages/api/src/server.js`

**App (`packages/app`):**
- React 18.3 (`react`, `react-dom`) - UI
- React Router 6.28 (`react-router-dom`) - routing (`packages/app/src/App.tsx`)
- TanStack React Query 5.62 (`@tanstack/react-query`) - server state; hooks in `packages/app/src/hooks/`
- Auth0 React SDK 2.2 (`@auth0/auth0-react`) - login, token retrieval (`packages/app/src/main.tsx`, `packages/app/src/auth/AuthGuard.tsx`)
- Tailwind CSS 3.4 - utility classes, config in `packages/app/tailwind.config.ts`, PostCSS in `packages/app/postcss.config.js`

**Testing:**
- Lite: Node built-in test runner (`node --test`), files in `tests/core/`, `tests/state/`, fixtures in `tests/fixtures/`
- API: Node built-in test runner (`node --test tests/*.test.js`), files in `packages/api/tests/` (health, auth, rls, projects, workspaces)
- App: Vitest 2.1 (`vitest run`), jsdom 25, `@testing-library/react` 16, `@testing-library/jest-dom` 6, `@testing-library/user-event` 14; setup in `packages/app/src/test/setup.ts`; test config inside `packages/app/vite.config.ts`

**Build/Dev:**
- Vite 7.3 (root, `^7.3.1`) - Lite dev server (port 3000, `vite.config.js`) and `npm run build` into `dist/`
- Vite 5.4 (`packages/app`, `^5.4.0`) - app dev server (port 3001, proxies `/api` and `/auth` to `http://localhost:4000`), build to `dist/`
- `@vitejs/plugin-react` 4.3 - React fast refresh and JSX in `packages/app/vite.config.ts`
- TypeScript 5.7 (`packages/app`) - `tsc --noEmit` type checks; `tsconfig.node.json` for config files
- PostCSS 8.4 and Autoprefixer 10.4 - `packages/app/postcss.config.js`
- Node scripts in root `scripts/`: `validate-config.mjs` (Ajv schema check), `generate-docs.mjs` (docs generation, not run by CI)

## Key Dependencies

**Critical (root, Lite):**
- `ajv` `^8.18.0` (devDependency) - JSON Schema validation for `js/config.js` against `schema/config.schema.json`; used by `scripts/validate-config.mjs`
- `vite` `^7.3.1` (devDependency) - build tooling only; the Lite runtime has no bundled npm dependencies

**Critical (API):**
- `fastify` `^5.0.0` - HTTP framework
- `pg` `^8.13.0` - PostgreSQL client; pool in `packages/api/src/db/client.js`
- `jose` `^5.9.0` - Auth0 JWT verification against the JWKS endpoint (`createRemoteJWKSet`, `jwtVerify`) in `packages/api/src/plugins/auth.js`

**Critical (App):**
- `@auth0/auth0-react` `^2.2.4` - authentication
- `@tanstack/react-query` `^5.62.0` - data fetching and cache
- `@roadmapsnap/tokens` (`file:../tokens`) - shared design tokens
- `html2canvas` `^1.4.1` - PNG export of the timeline (`packages/app/src/lib/export.ts`)

**Shared design system:**
- `@roadmapsnap/tokens` (`packages/tokens/package.json`) - exports `./` (`tokens.js`), `./css` (`tokens.css`), `./components.css`. The Lite theme in `css/roadmap.css` and the app both derive from these values

**Infrastructure:**
- PostgreSQL 16 in CI (`postgres:16` service in `.github/workflows/api-ci.yml`); local dev default `postgresql://postgres:postgres@localhost:5432/roadmapsnap_dev` (fallback in `packages/api/src/server.js`)
- Row-level security depends on a non-superuser role `roadmapsnap_app` (created in migration `V4__app_role.sql`, pre-created in CI)

## Configuration

**Lite:**
- `js/config.js` is user data and gitignored. Create it by copying `js/config_base.js`. Loaded as a classic script from `index.html` before `js/app.js`
- Schema: `schema/config.schema.json`; reference doc: `docs/config-reference.md`
- Export helpers: `js/export/csv.js`, `js/export/json.js`, `js/export/png.js`

**API environment (`packages/api`):**
- Template: `packages/api/.env.example`. Variables: `NODE_ENV`, `PORT`, `DATABASE_URL`, `APP_DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `CORS_ORIGIN`, `DEFAULT_ORG_ID`
- Loaded by `packages/api/src/loadEnv.js` (manual parser for `packages/api/.env`) and validated by `@fastify/env` in `packages/api/src/server.js`
- `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` are required. `PORT` defaults to 4000
- Test-only auth bypass via `X-Test-User-Sub` header is active only when `NODE_ENV` is `test` or `development` (`packages/api/src/plugins/auth.js`)

**App environment (`packages/app`):**
- Template: `packages/app/.env.example`. Vite-exposed variables: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_API_URL`, optional `VITE_AUTH0_REDIRECT_URI`
- Typed in `packages/app/src/vite-env.d.ts`; read via `import.meta.env` in `packages/app/src/main.tsx`

**Build:**
- Root: `vite.config.js` (Lite), `package.json` scripts `build`, `build:check`, `validate`, `test`
- App: `packages/app/vite.config.ts`, `packages/app/tsconfig.json`, `packages/app/tailwind.config.ts`
- Lite CI prerequisite: `js/config.js` must exist (CI runs `cp js/config_base.js js/config.js`)
- Secrets: `.env` files and `.webui_secret_key` are gitignored; only `.env.example` files are tracked

## Platform Requirements

**Development:**
- Node.js 20+ (CI uses 20; local toolchain on the analysis machine is Node 26)
- npm, with separate `npm install` in root, `packages/api`, and `packages/app`
- Docker PostgreSQL on `localhost:5432` with a `roadmapsnap_app` NOSUPERUSER role for API tests and `npm run migrate`
- Auth0 tenant with an application (client ID) and an API (audience) for the SaaS app

**Production:**
- Lite: static hosting of `dist/` (Vite output) plus `js/config.js`; no server required. Vite build output is `dist/` and `build` copies `js/config.js` into `dist/js/`
- API: Node.js process running `node src/server.js`, listening on `0.0.0.0` with `PORT`; requires PostgreSQL and Auth0 reachable. No Dockerfile or deployment manifest was detected in the repo
- App: static build (`packages/app/dist/`), served alongside the API; no deployment target configured in the repo

---

*Stack analysis: 2026-10-24*
