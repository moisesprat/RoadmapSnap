# Phase 1: Tenant & Security Foundation - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make tenant isolation real and proven on the actual API request path (SEC-01..SEC-06):

- Every authenticated request runs in one transaction on `request.dbClient`, with tenant context set through parameterized `set_config(..., true)`, as the NOSUPERUSER `roadmapsnap_app` role.
- The API refuses to start under unsafe DB or auth configuration.
- Automated cross-tenant tests through the real API, running as the app role.
- The seed-org auto-join, the dev "Dev Default" bootstrap (`row_security = off`) and the `X-Test-User-Sub` impersonation header are removed.
- Fresh installs get schema only. Demo data moves to an explicit dev seed.
- DATE values round-trip with no day shift in any server timezone.
- A minimal compose skeleton (postgres + migrate job + api as the app role) is one plan in this phase (ROADMAP note). DEP-* requirements are verified in Phase 7, not here.

Not in this phase: self-serve signup / own-org provisioning (Phase 4), the org switcher (Phase 4), the full compose hardening (Phase 7), the shared core (Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Seed data & V7–V12
- **D-01:** Rewrite `V7__seed_projects_from_config.sql`, `V8__add_users_to_seed_org.sql`, `V9__backfill_workspace_workflows.sql`, the seed part of `V10__dependencies_index_and_seed.sql` (keep its indexes), `V11__seed_dependencies_from_config.sql` and `V12__backfill_group_order.sql` as no-op stubs. Keep the filenames, so version names in `schema_migrations` are unchanged. This is safe because `migrate.js` tracks by filename only (no checksum). Each stub carries a comment explaining why. This is a deliberate, documented exception to the "never edit an applied migration" rule. — **Reversibility:** costly — databases created after the change never get the demo rows. Restoring the data means a new seed path, not reverting the files.
- **D-02:** Demo data lives in `packages/api/src/db/seeds/` and runs only through an explicit `npm run seed:dev` (in `packages/api`). Migrations never insert sample program data. A fresh `migrate` yields zero rows in tenant tables.
- **D-03:** Remove the real program data (generated from the user's `js/config*.js`, e.g. the "OneHouse Upgrade Program" workspace and group names) from HEAD only. Do not rewrite git history. The dev seed is a synthetic sample derived from `js/config_base.js` only.
- **D-04:** Leave existing local dev databases that already have `config-seed-org` alone. No V13 cleanup migration. Document in `packages/api/src/db/migrations/README.md` that devs should drop and recreate their local DB, then run `seed:dev`. Rationale: no hosted DB exists yet.
- **D-05:** Delete `packages/api/scripts/generate-config-seed.mjs` (it uses `new Function`) and its `seed:config` npm script. Replace it with a small hand-written dev seed. Phase 3's safe `acorn` importer can later back dev seeding.

### Local dev without bypass
- **D-06:** `seed:dev` accepts the developer's Auth0 subject (`--sub auth0|...` or `DEV_ADMIN_SUB` in `.env`). It upserts that user and makes them admin of the demo org. It runs as the owner/migration role (`DATABASE_URL`), never at request time.
- **D-07:** `seed:dev` creates two orgs: Org A (demo roadmap from `config_base`) and Org B (a small, different roadmap), so isolation can be checked by hand. Design it so the Phase 7 smoke test can reuse it.
- **D-08:** Research and planning choose how to resolve identity and memberships under FORCE RLS: the policy shape (`org_members` self-select on `user_id = current_user_id`) or narrow `SECURITY DEFINER` functions. Hard constraint: no `BYPASSRLS`, no `row_security = off`, no second connection from `pool` at request time.

### Test / impersonation auth
- **D-09:** Remove `X-Test-User-Sub` entirely. Tests (and scripted local use) authenticate with real JWTs signed by a locally generated keypair. The API verifies them against a local JWKS that is loaded only when explicitly configured, for example through a test-JWKS env var (the name is up to the planner). This exercises the real `jwtVerify` path. — **Reversibility:** costly — every API test file (`auth`, `projects`, `workspaces`, `rls`) changes its auth helper.
- **D-10:** The API refuses to start when any of these hold:
  - (a) the DB role is a superuser or has `BYPASSRLS` (SEC-02)
  - (b) test auth / the local JWKS is enabled while `NODE_ENV=production`
  - (c) `NODE_ENV` is unset (remove the `development` default in `server.js`)
  - (d) the connected role owns the tenant tables (it could ALTER or DISABLE RLS)
  - (e) `CORS_ORIGIN` is `*` or empty in production
- **D-11:** Split DB credentials. The API uses only `APP_DATABASE_URL` (`roadmapsnap_app`) and refuses to start without it. `migrate` and `seed:dev` use `DATABASE_URL` (owner). Tests use both, with admin for setup and the app role through the API.

### No-org behavior & org resolution
- **D-12:** An authenticated user with no org membership gets 403 `{ error: 'Forbidden', message: 'No organization', code: 'NO_ORG' }` on tenant-scoped endpoints. `/auth/me` still succeeds and reports `orgs: []`. Phases 4 and 6 route on `code: 'NO_ORG'` to onboarding. Keep the existing `{ error, message }` shape. `code` is an additive field.
- **D-13:** `X-Org-Id` naming an org the user is not a member of returns 403. No silent fallback to another org, which today can make writes land in the wrong tenant. The same applies to `?orgId`.
- **D-14:** With no `X-Org-Id`, the default org is the user's oldest membership (earliest `org_members.created_at`). Remove the "org with the most workspaces" heuristic. Phase 4 may add a remembered last-used org.

### Date contract
- **D-15:** DATE columns travel as ISO `YYYY-MM-DD` strings in both directions. Register a `pg` type parser so DATE (OID 1082) is never turned into a JS `Date`. Writes accept only `YYYY-MM-DD`. Conversion to Lite's `DD/MM/YYYY` happens at the app or shared-core edge (Phase 2). Prove it with tests run under at least `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati`, including a last-day-of-month date. — **Reversibility:** costly — a published API contract that the app and later the AI/import paths depend on.

### Claude's Discretion
- The transaction helper's shape (e.g. `withTenantTx` vs a Fastify hook pair) and how errors trigger ROLLBACK.
- Env var names for the test JWKS, and the exact boot-check implementation.
- The CI guard against importing `pool` in route handlers (lint rule, grep test or similar).
- Cross-tenant test coverage strategy (per-endpoint matrix vs a catalog test asserting RLS on every tenant table). Both are acceptable as long as SEC-03's "any endpoint" is credibly covered.
- How `audit_trigger_function` keeps working for the app role (research flag).
- Compose skeleton details within the ROADMAP note's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` §"Phase 1: Tenant & Security Foundation": goal, success criteria, research flag, compose-skeleton note
- `.planning/REQUIREMENTS.md` §"Security & Tenancy Foundation": SEC-01..SEC-06
- `.planning/PROJECT.md`: constraints (RLS mandatory, `request.dbClient` only, Lite must not break)
- `.planning/STATE.md` §"Blockers/Concerns" [Phase 1]: RLS likely unenforced; V7–V12 immutability

### Research
- `.planning/research/SUMMARY.md` §"Phase 1: Tenant and Security Foundation": `withTenantTx`, two-stage org resolution, boot assertion
- `.planning/research/PITFALLS.md`: Pitfalls 1, 2, 3 (RLS bypass, chicken-and-egg identity, seed-org auto-join), the DATE/timezone pitfall (~line 165), Pitfall 13 (role/seed part), the security table (~line 450)
- `.planning/codebase/CONCERNS.md` §"Security Considerations", §"Fragile Areas": `SET LOCAL` interpolation, `SET LOCAL` outside a tx, test-auth header, migration backfills

### Code (current state to change)
- `packages/api/src/plugins/context.js`: request context, seed-org auto-join, dev bootstrap, interpolated `SET LOCAL`, org resolution
- `packages/api/src/plugins/auth.js`: JWKS verification, `X-Test-User-Sub` bypass, route registration
- `packages/api/src/plugins/rbac.js`: `requireRole`
- `packages/api/src/db/client.js`: lazy pool on `DATABASE_URL`
- `packages/api/src/db/migrate.js`: filename-only version tracking (enables D-01)
- `packages/api/src/server.js`: env schema, `NODE_ENV` default, CORS
- `packages/api/src/db/migrations/V1__core_schema.sql`, `V2__rls_policies.sql`, `V3__audit_trigger.sql`, `V4__app_role.sql`, `V6__force_rls.sql`: schema, policies, app role, FORCE RLS
- `packages/api/src/db/migrations/V7`–`V12` and `README.md`: seed migrations to stub, and docs to update
- `packages/api/scripts/generate-config-seed.mjs`: to delete (D-05)
- `packages/api/tests/rls.test.js`, `auth.test.js`, `projects.test.js`, `workspaces.test.js`: existing tests to migrate to signed JWTs
- `.github/workflows/api-ci.yml`: Postgres service plus pre-created NOSUPERUSER app role
- `packages/api/.env.example`: add `APP_DATABASE_URL`, `DEV_ADMIN_SUB`, test JWKS vars

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `jose` (`createRemoteJWKSet`, `jwtVerify`) in `auth.js`: switching to a local JWKS (`createLocalJWKSet`) for tests keeps the same verify path.
- `rls.test.js` already has admin and app-role pools and builds `APP_DATABASE_URL` from `DATABASE_URL`. Reuse its two-pool setup for the cross-tenant suite.
- `fastify.requireRole` (rbac.js) stays the authorization preHandler.

### Established Patterns
- Error body `{ error, message }`. D-12 adds an optional `code`.
- `commonPreHandler` arrays in the route files compose `authenticate` → `setRequestContext` → `requireRole`. The tenant transaction must wrap the handler and commit or roll back on response.
- Migrations are `V{n}__snake_case.sql`. New schema changes for policies and functions go in V13+.

### Integration Points
- `context.js` currently acquires a client and releases it on `finish`/`close`. This is where BEGIN/COMMIT/ROLLBACK and `set_config` belong.
- `users` has no RLS. `org_members` is org-scoped, so the current "first membership" lookup can't see rows without an org context. This is the identity-resolution problem in D-08.
- Today the dev bootstrap opens a second `pool.connect()` at request time. It must go.
- `V2__rls_policies.sql` grants to `postgres`, and `V4` creates `roadmapsnap_app` with the hard-coded password `apppassword`. Phase 7 removes the hard-coded password (DEP-02). Phase 1 only needs the API to run as this role.

</code_context>

<specifics>
## Specific Ideas

- The 403 `NO_ORG` code is the hook that Phase 4 (signup) and Phase 6 (guided empty state) will route on.
- `seed:dev` with two orgs doubles as the manual isolation check and the seed for the Phase 7 two-org smoke test.
- Timezone tests should use extreme offsets (`America/Los_Angeles`, `Pacific/Kiritimati`) and a last-day-of-month milestone.

</specifics>

<deferred>
## Deferred Ideas

- Remembered last-used org per user: Phase 4 (ORG-07 org switching).
- Purging the real program data from git history: explicitly declined for now. Revisit only if the repo becomes public or is shared beyond the author.
- Removing the hard-coded `apppassword` from `V4__app_role.sql`: Phase 7 (DEP-02).

</deferred>

---

*Phase: 01-tenant-security-foundation*
*Context gathered: 2026-11-19*
