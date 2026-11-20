---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Tenant & Security Foundation
status: executing
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-11-20T23:03:14.327Z"
last_activity: 2026-11-20
last_activity_desc: Phase 01 execution started
state_head: a934bc0cfd3618df636fb322adb7e27d3a7c2fa6
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 8
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-18)

**Core value:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable.
**Current focus:** Phase 01 — Tenant & Security Foundation

## Current Position

Phase: 01 (Tenant & Security Foundation) — EXECUTING
Plan: 4 of 8
Status: Ready to execute
Last activity: 2026-11-20 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

Last session: 2026-11-20T23:03:14.308Z
Stopped at: Completed 01-02-PLAN.md
Resume file: None
