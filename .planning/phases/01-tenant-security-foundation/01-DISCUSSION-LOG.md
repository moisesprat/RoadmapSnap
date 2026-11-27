# Phase 1: Tenant & Security Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-19
**Phase:** 01-tenant-security-foundation
**Areas discussed:** Seed data & V7–V12, Local dev without bypass, Test/impersonation auth, No-org & date contract

---

## Seed data & V7–V12

| Option | Description | Selected |
|--------|-------------|----------|
| No-op + dev seed dir | Stub V7–V12 seed bodies; demo data in `src/db/seeds/` via `npm run seed:dev` | ✓ |
| Gate on env flag | Wrap bodies in a `current_setting('app.seed_demo')` check | |
| Leave + V13 cleanup | Keep files; V13 deletes config-seed-org | |

| Option | Description | Selected |
|--------|-------------|----------|
| Remove going forward | Remove from HEAD; synthetic seed from config_base; no history rewrite | ✓ |
| Also rewrite git history | filter-repo + force-push | |
| It's fine as is | Data not sensitive | |

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them alone | Devs drop/recreate local DB, run seed:dev | ✓ |
| V13 removes seed org | Converge all DBs | |
| Only strip memberships | Keep demo data, remove auto-admin rows | |

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Replace generate-config-seed.mjs with a hand-written dev seed | ✓ |
| Keep for dev seeds | Repoint output to seeds/ | |
| You decide | | |

---

## Local dev without bypass

| Option | Description | Selected |
|--------|-------------|----------|
| seed:dev takes your sub | `--sub` / `DEV_ADMIN_SUB` makes the dev an admin of the demo org | ✓ |
| Seed fixed test users only | Fixed dev users; local use via test auth | |
| Pull minimal ORG-01 forward | First login creates own org now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, two orgs | Org A + Org B for manual isolation checks | ✓ |
| One org only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Research decides | Policy shape vs SECURITY DEFINER left to research; no BYPASSRLS / row_security=off | ✓ |
| Prefer policy shape | | |
| Prefer SECURITY DEFINER | | |

---

## Test/impersonation auth

| Option | Description | Selected |
|--------|-------------|----------|
| Locally signed JWTs | Local JWKS, real verify path; remove X-Test-User-Sub | ✓ |
| Header + ALLOW_TEST_AUTH flag | Keep header behind an explicit flag | |
| Both | | |

Boot checks (multi-select): test auth on in production ✓, NODE_ENV unset ✓, connected as owner role ✓, CORS_ORIGIN '*' in prod ✓ (in addition to the required superuser/BYPASSRLS check).

| Option | Description | Selected |
|--------|-------------|----------|
| Split URLs | API on APP_DATABASE_URL only; migrate/seed on DATABASE_URL | ✓ |
| Single URL | | |

---

## No-org & date contract

| Option | Description | Selected |
|--------|-------------|----------|
| 403 with a code | `code: 'NO_ORG'`; /auth/me returns orgs: [] | ✓ |
| Empty results | | |

| Option | Description | Selected |
|--------|-------------|----------|
| 403, no fallback | Reject a non-member X-Org-Id | ✓ |
| Fall back to default org | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest membership | Deterministic; drop the most-workspaces heuristic | ✓ |
| Require X-Org-Id | | |

| Option | Description | Selected |
|--------|-------------|----------|
| ISO 'YYYY-MM-DD' strings | pg DATE type parser; TZ-extreme tests | ✓ |
| Lite's 'DD/MM/YYYY' | | |

---

## Claude's Discretion

- Transaction helper shape, test JWKS env var names, boot-check implementation, the CI guard against `pool` imports, cross-tenant test strategy, audit trigger under the app role, compose skeleton details.

## Deferred Ideas

- Remembered last-used org (Phase 4)
- Git-history purge of the real program data (declined for now)
- Removing the hard-coded `apppassword` in V4 (Phase 7)
