---
gsd_state_version: "1.0"
current_phase: 1
current_phase_name: Tenant & Security Foundation
status: planning
stopped_at: Phase 1 context gathered
last_updated: "2026-11-18T23:29:14.204Z"
last_activity: 2026-11-18
last_activity_desc: Roadmap created (7 phases, 54/54 v1 requirements mapped)
state_head: dde265ac1c96d4c61cfb83f527f972452be1114f
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-18)

**Core value:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable.
**Current focus:** Phase 1 - Tenant & Security Foundation

## Current Position

Phase: 1 of 7 (Tenant & Security Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-11-18 - Roadmap created (7 phases, 54/54 v1 requirements mapped)

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

Last session: 2026-11-18T23:29:14.191Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-tenant-security-foundation/01-CONTEXT.md
