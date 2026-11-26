---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Shared Core & Lite-Identical View
status: executing
stopped_at: Completed 02-02-PLAN.md
last_updated: "2026-11-26T07:45:19.021Z"
last_activity: 2026-11-26
last_activity_desc: Phase 02 execution started
state_head: e1825afb79da6021955703c219d57fb383fa018c
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 28
  completed_plans: 12
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-18)

**Core value:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable.
**Current focus:** Phase 02 — Shared Core & Lite-Identical View

## Current Position

Phase: 02 (Shared Core & Lite-Identical View) — EXECUTING
Plan: 3 of 18
Status: Ready to execute
Last activity: 2026-11-26 — Phase 02 execution started

Progress: [█░░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8 min | 1 tasks | 7 files |
| Phase 01 P03 | 1 min | 2 tasks | 10 files |
| Phase 01 P08 | 8 min | 1 tasks | 5 files |
| Phase 01 P02 | 2 min | 2 tasks | 8 files |
| Phase 01 P04 | 4 min | 2 tasks | 7 files |
| Phase 01 P05 | 25 min | 3 tasks | 6 files |
| Phase 01 P06 | 12 min | 2 tasks | 9 files |
| Phase 01 P07 | 5 min | 2 tasks | 7 files |
| Phase 01 P09 | 30 min | 2 tasks | 4 files |
| Phase 01 P10 | 9 min | 3 tasks | 9 files |
| Phase 02 P01 | 4 min | 2 tasks | 31 files |
| Phase 02 P02 | 8 min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Groups become a first-class table (not `projects.group_name` text); decided before Phase 3
- [Roadmap]: Dependency cycles are rejected at milestone granularity with a clear message (EDIT-04)
- [Roadmap]: Invitees join only the inviting org and get no personal org (ORG-05)
- [Roadmap]: Invite mail goes over SMTP, with Mailpit in the dev compose profile (ORG-03)
- [Roadmap]: Claude model defaults to `claude-opus-5-5`, read from the `ANTHROPIC_MODEL` env var
- [Roadmap]: Research's 9 phases compressed to 7 (core + view merged; Lite import folded into the editing phase; AI generation also owns the guided empty state ORG-02)
- [Phase 01]: selectOrg returns a status object (ok/invalid/not_a_member) so it stays pure; the context plugin maps it to 400 INVALID_ORG_ID / 403 NOT_A_MEMBER
- [Phase 01]: Verified JWTs without a non-empty sub are rejected with 401 in authenticate
- [Phase 01]: 01-03: Seed migrations V7/V8/V9/V11/V12 are comment-only stubs with unchanged filenames; existing databases skip them (filename-only tracking), fresh installs are schema-only
- [Phase 01]: 01-03: loadEnv no longer overrides variables already set in the environment (dotenv semantics)
- [Phase 01]: 01-08: X-Test-User-Sub removed; Bearer is the only auth path, and /auth/me reports orgId, orgs [{id,name,role}] and a nullable role without echoing JWT claims
- [Phase 01]: 01-02: BOOT_CHECK_SQL adds r.rolname AS role to the RESEARCH query so refusals name the connected role
- [Phase 01]: 01-02: NODE_ENV must be development, test or production; unknown values such as 'prod' are refused so production-only checks cannot be skipped by a typo
- [Phase 01]: 01-02: rbac plugin uses Symbol.for('skip-override') and registers before the context plugin so route plugins can call fastify.requireRole (no new dependency)
- [Phase 01]: 01-04: seed:dev demo data is hand-copied from js/config_base.js (ISO dates), never read or evaluated from config files; Demo Org B is owned by a synthetic user and the dev joins it only via --member-of-b
- [Phase 01]: 01-04: seed re-runs are idempotent on domain tables; ON CONFLICT DO UPDATE adds audit_events rows, documented in the migrations README
- [Phase 01]: 01-05: every tenant route authorizes through fastify.requireRole (reads at viewer), so NO_ORG comes from one place
- [Phase 01]: 01-05: SHAPES map beside MATRIX; header and query loops iterate app.routeTable so a new route cannot be skipped
- [Phase 01]: [01-06] DATE (OID 1082) stays a YYYY-MM-DD string via a global pg type parser; milestones are ISO or null on the wire; isoDateSchema (Ajv date format) is the shared write contract; SPA isoToLiteDate adapter until Phase 2 shared core
- [Phase 01]: 01-07: dev-token requires AUTH0_DOMAIN/AUTH0_AUDIENCE only when signing; its public JWK is rebuilt from the private key on every run so jwks.json cannot drift
- [Phase 01]: 01-07: .dockerignore keeps scripts out of the image; seed:dev (src/db/seeds) runs through the migrate service, dev-token stays host-only
- [Phase 01]: 01-09: a client disconnect no longer changes the tenant transaction outcome; onRequestAbort only logs and an onRoute settle guard finalizes handlers that settle with undefined — Fastify 5.7.4 skips onSend and onResponse for such handlers after an abort; releasing in the abort hook handed the tenant client to another request (CR-01)
- [Phase 01]: 01-10: requireRole uses an own-property lookup (Object.hasOwn on a frozen table) instead of a nullish fallback, so inherited keys like toString never grant access
- [Phase 01]: 01-10: CORS_ORIGIN has no schema default; resolveCorsOrigin falls back to localhost only under development and test and production refuses before any DB access (reverses 01-02 flagged assumption)
- [Phase 02]: Workspace lockfile re-pinned to per-package resolved versions so the root lockfile change is workspace linking only
- [Phase 02]: Core formatDateDisplay/formatShortDate format from validated string parts; parseDDMMYYYY rolls over day past month end (31/04 is 1 May)
- [Phase 02]: 02-02: Lite node harness pins TZ to UTC; snapshots and characterized positions are DST-independent
- [Phase 02]: 02-02: complex fixture encodes a row with no milestone dates as milestones { START: '' } because validateConfig rejects {}

### Pending Todos

None yet.

### Blockers/Concerns

Open decisions and risks surfaced by research, each tagged with the phase that must resolve it:

- [Phase 1]: RLS is probably unenforced on the real API path (`SET LOCAL` outside a tx, superuser connection). Confirm with a failing test first.
- [Phase 1]: V7-V12 seed migrations are immutable once applied. Decide how fresh installs skip them while existing dev databases stay consistent.
- [Phase 2]: `js/core/` is not pure (reads `CONFIG` and `window.*`). Extraction is a refactor before it is a move.
- [Phase 2]: Pick one Node version (24 is the conservative choice) and align CI (currently Node 20, EOL), images and `engines`. Adopt npm workspaces and verify `npm ci --workspaces=false` keeps Lite CI light.
- [Phase 3]: Decide where `WORKFLOW`, `ENTITY_LABELS`, `DASHBOARD_TEXT`, `NON_FILTERABLE_GROUPS` and group order live in the SaaS schema; import fidelity depends on it.
- [Phase 3]: Ops vocabulary must be fixed before any Phase 5 prompt work; also settle the duplicate task-name policy.
- [Phase 4]: Auth0 access tokens may carry no `email`/`email_verified`; confirm the Action or `/userinfo` fallback in a real dev tenant. Define the path for users with no email.
- [Phase 5]: Default monthly cap, unit cost weights and Opus-vs-Sonnet per job are unsourced; they need real token measurements. Re-check model IDs and pricing at implementation time.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-26T07:45:18.995Z
Stopped at: Completed 02-02-PLAN.md
Resume file: None
