---
gsd_state_version: "1.0"
current_phase: 3
current_phase_name: Change Engine, Manual Editing & Lite Import
status: planning
stopped_at: Phase 02 complete, ready to plan Phase 3
last_updated: "2026-11-27T19:58:14.025Z"
last_activity: 2026-11-27
last_activity_desc: Phase 02 complete, transitioned to Phase 3
state_head: a03b898342e7814b957e99f9b849ee0413a56881
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 28
  completed_plans: 28
  percent: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-18)

**Core value:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable.
**Current focus:** Phase 02 — Shared Core & Lite-Identical View

## Current Position

Phase: 3 — Change Engine, Manual Editing & Lite Import
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-27 — Phase 02 complete, transitioned to Phase 3

Progress: [███░░░░░░░] 29%

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |
| 02 | 18 | - | - |

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
| Phase 02 P03 | 2 min | 3 tasks | 14 files |
| Phase 02 P04 | 6 min | 3 tasks | 13 files |
| Phase 02 P05 | 15 min | 3 tasks | 12 files |
| Phase 02 P06 | 25min | 3 tasks | 11 files |
| Phase 02 P07 | 9 min | 3 tasks | 10 files |
| Phase 02 P08 | 6 min | 3 tasks | 14 files |
| Phase 02 P09 | 12 min | 3 tasks | 8 files |
| Phase 02 P10 | 6 min | 3 tasks | 9 files |
| Phase 02 P11 | 8 min | 3 tasks | 11 files |
| Phase 02 P12 | 7 min | 2 tasks | 8 files |
| Phase 02 P13 | 7 min | 2 tasks | 8 files |
| Phase 02 P17 | 25 min | 3 tasks | 14 files |
| Phase 02 P14 | 15 min | 3 tasks | 12 files |
| Phase 02 P15 | 6min | 3 tasks | 20 files |
| Phase 02 P18 | 1 min | 3 tasks | 17 files |
| Phase 02 P16 | 30 min | 3 tasks | 15 files |

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
- [Phase 02]: ci.yml has no path filters so core/tokens changes always run Lite tests; app and API CI install with npm ci -w from the root lockfile on Node 24
- [Phase 02]: API image builds from the repo root with an allowlist .dockerignore and a manifests-only stage; final WORKDIR is /app/packages/api so compose commands are unchanged
- [Phase 02]: 02-04: red-dependency sets and effective at-risk derive first/last milestone keys from the workflow (OQ1); Lite output changes only in the minimal:riskOnly snapshot
- [Phase 02]: 02-04: dependency binding defaults to the START..M3 workflow when no CONFIG is loaded, so override-only callers keep their results
- [Phase 02]: 02-05: API keeps a copied THEMES list (image does not ship packages/core); tests/guards/themes.test.js keeps core, API and Lite's rendered theme select equal
- [Phase 02]: 02-05: projects external_link is restricted to http(s) at write time (isHttpUrl), validated before any query on POST and PATCH
- [Phase 02]: 02-06: Parity harness runs in mcr.microsoft.com/playwright:v1.64.1-noble; theme list copied into packages/parity (no dependency on shipped packages); no baseline screenshots
- [Phase 02]: 02-07: calculateStats honors the given today for the red part of atRisk; Lite output unchanged because the browser always passes CONFIG today
- [Phase 02]: 02-07: buildDependencyClass identifies the active node as graph.nodes[0]; the Lite stats binding reads window.AppState and CONFIG today directly so it loads in Node
- [Phase 02]: 02-08: apiToRoadmap falls back to the default workflow when workflow_definition is empty, and removes a milestone key whose planned date is null (Lite's { START: '' } no-dates row becomes {}) — Keeps an unconfigured workspace renderable; the 02-16 parity suite compares Lite over canonicalRoadmap(config) so both sides see the same milestones.
- [Phase 02]: Lite page and component CSS moved verbatim to packages/tokens/lite.css with .lite-area selector lists; roadmap.css keeps only three imports and the universal reset — D-05: one stylesheet set for Lite and SaaS; pixel-neutral proven by base-vs-HEAD parity at each step
- [Phase 02]: Accent/on-accent/danger tokens live in tokens.css for five themes and in lite.css for professional, colorful and blank; dark class alias removed (D-07), DM Sans self-hosted via @fontsource — UI-SPEC chrome token values; T-02-18 removes third-party font requests
- [Phase 02]: 02-10: Dashboard fallbacks ('Items', 'Roadmap Dashboard', 'in scope') stay in the core model rather than config_base defaults, so Lite output is unchanged
- [Phase 02]: 02-10: Risk summary model is { count, active, disabled } or null; AppState.reset() is built on core resetViewState and still nulls the timeline bounds
- [Phase 02]: 02-10: Graph and group transitions live in core but Lite grouping.js and dependencyArrows.js are rewired in 02-11
- [Phase 02]: 02-11: computeDependencyArrows takes the visible months and per-row trackLeft/trackWidth; arrow x comes from the milestone date's percent of the measured track (not from markers) to stay byte-identical with Lite
- [Phase 02]: 02-11: rows of collapsed groups stay in the TimelineModel with a collapsed flag; arrows skip edges without a measured row
- [Phase 02]: 02-11: opening a dependency graph is one AppState.set (graph, expanded groups, cleared filters), so Lite re-renders once
- [Phase 02]: 02-12: golden-markup normalizer compares select/input state through DOM properties and collapses whitespace like CSS; JSX needs {' '} where Lite has inline whitespace
- [Phase 02]: 02-12: LiteFilterBar takes a groupNames prop because FilterBarModel carries only hasGroups and core expandAll/collapseAll need the names
- [Phase 02]: 02-13: LiteDependencyArrows takes months and builds the graph via core getDependencyGraph; chevron and dependency icons are JSX svg (not core constants)
- [Phase 02]: 02-17: parity preview body reset is 'html body {margin:0;padding:0}' (lite.css body padding outranks a plain body rule); 02-15 real page needs the same
- [Phase 02]: 02-17: early parity spec hides Lite #timeline-section and re-adds the empty first milestone key on the Lite side; 02-14 removes the workaround
- [Phase 02]: 02-14: DashboardPage shows an interim Workspace select (only with more than one workspace) until 02-15's SaasHeader; useTheme skips the /auth/me reconcile once the user has picked a theme
- [Phase 02]: 02-15: a successful project create closes the form dialog like an edit (the keep-adding flow and counter are gone)
- [Phase 02]: 02-15: index.css keeps only the body reset and a :where() zero-specificity chrome reset; every rule on Lite class names was removed because .filter-bar position: relative defeated Lite's sticky bar
- [Phase 02]: 02-16: the stub Auth0Context satisfies useAuth0, so the parity entry renders the real DashboardPage (RESEARCH A6 fallback not needed) — Page-level parity compares the true SaaS page, header and hooks included
- [Phase 02]: 02-16: Parity workflow has no path filter; changed-file detection runs in-job and gates heavy steps with steps.changes.outputs.run — A required check skipped by a path filter stays pending and blocks merges

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

Last session: 2026-11-27T19:17:51.758Z
Stopped at: Phase 02 complete, ready to plan Phase 3
Resume file: None
