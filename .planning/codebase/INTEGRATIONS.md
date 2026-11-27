---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# External Integrations

**Analysis Date:** 2026-10-24

## APIs & External Services

**Identity:**
- Auth0 - Authentication for the SaaS app and API
  - SDK (app): `@auth0/auth0-react` in `packages/app/src/main.tsx`, `packages/app/src/auth/AuthGuard.tsx`, `packages/app/src/pages/CallbackPage.tsx`, `packages/app/src/pages/LoginPage.tsx`
  - Verification (API): `jose` against `https://${AUTH0_DOMAIN}/.well-known/jwks.json`, issuer `https://${AUTH0_DOMAIN}/`, audience `AUTH0_AUDIENCE` in `packages/api/src/plugins/auth.js`
  - Auth: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, optional `VITE_AUTH0_REDIRECT_URI` (app); `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` (API)
  - Callback route: `/callback`, redirect URI defaults to `window.location.origin + '/callback'`

**CDN Scripts (Lite):**
- Google Fonts - `DM Sans` font loaded from `https://fonts.googleapis.com/css2?family=DM+Sans...` with preconnect to `fonts.gstatic.com` in `index.html`
- cdnjs - `html2canvas` 1.4.1 loaded from `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` in `index.html`, used by `js/export/png.js`
  - Note: Lite has no npm dependency on html2canvas; it relies on the global loaded from the CDN

**Other client-side libraries:**
- `html2canvas` `^1.4.1` (npm) in the app, used in `packages/app/src/lib/export.ts` for PNG export

## Data Storage

**Databases:**
- PostgreSQL (SaaS only)
  - Connection: `DATABASE_URL` (API; fallback default in `packages/api/src/server.js`); `APP_DATABASE_URL` is listed in `packages/api/.env.example` for the app role
  - Client: `pg` `^8.13.0`, single lazy `Pool` in `packages/api/src/db/client.js`
  - Migrations: plain SQL files `packages/api/src/db/migrations/V1__core_schema.sql` through `V12__backfill_group_order.sql`, run by `packages/api/src/db/migrate.js` (`npm run migrate`); applied versions recorded in `schema_migrations`
  - Tenancy: row-level security policies (`V2__rls_policies.sql`, `V6__force_rls.sql`), audit trigger (`V3__audit_trigger.sql`, `packages/api/src/db/audit.js`), app role (`V4__app_role.sql`)
  - Session vars: `packages/api/src/plugins/context.js` sets DB session variables used by RLS; route handlers use `request.dbClient`
  - Core tables (V1): `organizations`, `users`, `org_members`, `workspaces`, `programs`, `projects`, `milestones`, `budget_periods`, `kpis`, `risks`, `dependencies`, `audit_events`; later migrations add user preferences (V5) and workflow/settings seeds (V7, V9, V10, V11)

**File Storage:**
- Local filesystem only. Lite exports are generated in the browser (`js/export/csv.js`, `js/export/json.js`, `js/export/png.js`). No cloud object storage detected.

**Caching:**
- None on the server. Client-side caching via TanStack Query in `packages/app/src/hooks/useApi.ts`
- Browser `localStorage` for theme preference only: `packages/app/src/lib/themeStorage.ts`. Lite state is kept in memory in `js/state/appState.js`

## Authentication & Identity

**Auth Provider:**
- Auth0 (see above)
  - Implementation: SPA login via Auth0 React SDK; the app sends `Authorization: Bearer <access token>` on every API call from `packages/app/src/api/client.ts` (the client rejects tokens that are not three dot-separated segments before sending)
  - API side: `fastify.authenticate` preHandler verifies the JWT, then `packages/api/src/plugins/context.js` maps `sub` and `email` to a DB user and org, and sets RLS session vars
  - Role model: `viewer < editor < admin`, enforced via `fastify.requireRole` in `packages/api/src/plugins/rbac.js`
- Test bypass: `X-Test-User-Sub` header accepted only when `NODE_ENV` is `test` or `development` (`packages/api/src/plugins/auth.js`). Must not be enabled in production

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or similar SDK in any `package.json`)

**Logs:**
- API: Fastify built-in logger (`Fastify({ logger: true })` in `packages/api/src/server.js`), output to stdout
- Lite: browser `console`

**Audit:**
- Database-level audit trail: `audit_events` table, populated by trigger (`packages/api/src/db/migrations/V3__audit_trigger.sql`) and helper in `packages/api/src/db/audit.js`

## CI/CD & Deployment

**Hosting:**
- Not configured in the repo. No Dockerfile, Procfile, `vercel.json`, `netlify.toml`, or Terraform detected

**CI Pipeline (GitHub Actions in `.github/workflows/`):**
- `ci.yml` - Lite: `npm ci`, `cp js/config_base.js js/config.js`, `npm test`, `npm run validate`, `npm run build` on Node 20. Skips when only `packages/**` changes
- `app-ci.yml` - App: `npm install` in `packages/app`, `npx tsc --noEmit`, `npm test` (with placeholder `VITE_*` env), `npm run build`
- `api-ci.yml` - API: Postgres 16 service container, pre-creates `roadmapsnap_app` role, `npm install`, `npm run migrate`, `npm test` with `NODE_ENV=test`. Runs only on changes under `packages/api/**`

**Dev proxy:**
- `packages/app/vite.config.ts` proxies `/api` and `/auth` to `VITE_API_URL` (default `http://localhost:4000`)

## Environment Configuration

**Required env vars (API, `packages/api/.env`):**
- `AUTH0_DOMAIN` - Auth0 tenant domain (required by schema)
- `AUTH0_AUDIENCE` - Auth0 API identifier (required by schema)
- `DATABASE_URL` - PostgreSQL connection string
- `CORS_ORIGIN` - allowed browser origin (default `http://localhost:3000`; app dev server runs on 3001, so set accordingly)
- `PORT` (default 4000), `NODE_ENV`, `DEFAULT_ORG_ID` (optional)

**Required env vars (App, `packages/app/.env`):**
- `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_API_URL`
- `VITE_AUTH0_REDIRECT_URI` (optional)

**Required for Lite:**
- `js/config.js` (copy of `js/config_base.js`); no environment variables

**Secrets location:**
- `.env` files (gitignored, local only). Template files `packages/api/.env.example` and `packages/app/.env.example` are tracked. Values are not recorded in this document
- `.webui_secret_key` is gitignored

## Webhooks & Callbacks

**Incoming:**
- None detected. The API exposes `/`, `/health`, and `/api/v1` routes (`packages/api/src/routes/`: `auth.js`, `projects.js`, `workspaces.js`) for the SPA; no third-party webhook receivers were found

**Outgoing:**
- None detected. No outbound HTTP from the API besides fetching Auth0 JWKS (via `jose`)
- Auth0 redirect back to `/callback` in the app

---

*Integration audit: 2026-10-24*
