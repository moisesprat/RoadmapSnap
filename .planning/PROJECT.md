# RoadmapSnap SaaS v1

## What This Is

RoadmapSnap is a roadmap and program-governance dashboard for PMO leaders and program managers: timeline, KPI dashboard, dependencies, risk and exports. The free Lite tier (repo root) is a static, config-driven page. This project finishes the hosted, multi-organization **SaaS** tier (`packages/`) as a first release. The SaaS version looks and feels exactly like Lite, edits roadmaps in the browser, and adds Claude-powered AI that creates roadmaps and applies plain-language changes ("add a new task in group X with a dependency on A, B, C"). The whole stack runs with `docker compose up`.

## Core Value

A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable. If everything else slips, this must be right.

## Business Context

- **Customer**: PMO leaders, program executives and program managers in organizations that outgrow a single config file.
- **Revenue model**: Open-core. Lite stays free; hosted SaaS is the commercial tier. Billing is deferred to v2.
- **Success metric**: Organizations sign up on their own, import or create a roadmap, and keep editing it in SaaS. Measured by active orgs.
- **Strategy notes**: README "Open-core model" section.

## Requirements

### Validated

<!-- Inferred from the existing codebase (.planning/codebase/). -->

- ✓ Lite: static, config-driven roadmap dashboard (`js/config.js` → validator → AppState → render) — existing
- ✓ Lite: executive KPI dashboard with auto-calculated health metrics — existing
- ✓ Lite: timeline/Gantt with zoom (3/6/12 months, full range) and key milestones — existing
- ✓ Lite: cross-deliverable dependency graph with blocking detection and tooltips — existing
- ✓ Lite: risk flagging and filtering by name, status and risk — existing
- ✓ Lite: configurable workflow states — existing
- ✓ Lite: exports to PNG, CSV and JSON — existing
- ✓ Lite: themes (light, dark, professional, colorful, blank, monochrome, papallona, evergreen) — existing
- ✓ SaaS API: Fastify 5 + PostgreSQL, Auth0 JWT verification (jose/JWKS) — existing
- ✓ SaaS API: multi-tenant model organizations → workspaces → projects → milestones/dependencies, RLS on `app.current_org_id`, roles viewer < editor < admin — existing
- ✓ SaaS API: workspace CRUD, project create/update/delete, `/auth/me` — existing
- ✓ SaaS app: React + TanStack Query shell, Auth0 login/callback, dashboard page with KPI cards, Gantt timeline, dependency arrows, filter bar, export menu, theme toggle — existing (partial re-implementation of Lite)
- ✓ Shared design tokens in `packages/tokens`, used by both Lite and the app — existing
- ✓ Tenant isolation enforced and proven on the real API request path (RLS in a per-request transaction, NOSUPERUSER app role, route-coverage matrix) — Phase 1
- ✓ The SaaS roadmap view is visually identical to Lite (timeline, dashboard, KPIs, dependencies, filters, themes, exports); enforced by a required `parity` check (≤0.1% pixel diff, 8 themes × 2 fixtures plus interaction states) — Phase 2
- ✓ Lite's pure logic is shared with SaaS through `@roadmapsnap/core`; the `packages/app/src/lib/` copies are deleted and a guard test keeps them out — Phase 2

### Active

**Hardening (emerged in Phase 2 review)**
- [ ] Shared core, Lite and API tolerate hostile or unusual tenant strings and ranges: workflow keys that collide with stats fields, unbounded month ranges, CSV quoting and formula injection, apostrophes and HTML-special characters in Lite handlers, and `preferences` key validation (Phase 2 review WR-01..WR-09, `deferred-items.md`)

**Full manual editing**
- [ ] Users create, edit and delete tasks/deliverables, groups, milestones and dependencies in the SaaS UI, with matching API endpoints under RLS and role checks

**AI (Claude via server `ANTHROPIC_API_KEY`)**
- [ ] A user describes a change in plain language. The AI proposes a structured change set, the user previews the diff, and nothing is saved until they confirm
- [ ] A user creates a new roadmap from a text prompt
- [ ] A user creates a new roadmap from a pasted document (PRD, notes, task list)
- [ ] A user creates a new roadmap from an uploaded file (CSV, spreadsheet, markdown)
- [ ] AI usage has a hard cap per organization, because one shared key pays for everyone

**Import**
- [ ] A user uploads a Lite `config.js` and it is converted into a SaaS roadmap (deterministic, no AI)

**Hosted multi-org**
- [ ] Self-serve signup through Auth0 creates the user's own organization
- [ ] Org admins invite teammates by email and assign viewer/editor/admin roles

**Deployment**
- [ ] `docker compose up` runs the full stack: `postgres`, a one-off `migrate` job, `api` (Fastify image) and `web` (app built into nginx, which forwards `/api` to the API). Configuration comes from `.env`, with `.env.example` committed

### Out of Scope

- Stripe billing and paid plans: deferred to v2. v1 uses fixed per-org AI caps instead
- Jira integration and predictive risk scoring (mentioned in README as the SaaS vision): not part of this first release
- AI providers other than Anthropic: Claude only, to keep one tool-use integration
- Per-organization API keys: v1 uses one server key from the environment
- AI changes that apply without preview: every AI change goes through preview → confirm
- Changes to Lite's backend-free nature: Lite stays static and config-driven (docs/monorepo.md)

## Context

- Brownfield monorepo, mapped in `.planning/codebase/` (2026-10-24). Lite lives at the root; SaaS is in `packages/api`, `packages/app` and `packages/tokens`.
- Roadmap logic lives once, in `@roadmapsnap/core` (npm workspaces, one root lockfile). Lite's `js/core/*` files are thin bindings over it, and the SaaS app renders core models in React. The former `packages/app/src/lib/` duplicate was deleted in Phase 2.
- The API only has routes for workspaces and projects. Milestones and dependencies exist in the schema (migrations V1–V12) but have no endpoints.
- Security concerns from CONCERNS.md must be resolved before going multi-org hosted. `SET LOCAL` session variables are built with string interpolation, and `SET LOCAL` may run outside an explicit transaction, which could leave RLS variables unset. List endpoints have no pagination, and there is no structured logging.
- The API image builds from the repo root (allowlist `.dockerignore`, `USER node`) and a root `compose.yaml` exists; the full `docker compose up` stack (web/nginx) is still to come.
- CI runs on Node 24. Root CI has no path filter (`npm test`, core typecheck, `validate`, `build`); api-ci needs Postgres plus a NOSUPERUSER `roadmapsnap_app` role; app-ci runs typecheck, tests and build. The `parity` workflow (Playwright 1.64.1 in a pinned container) is a required check on `main` via the `require-parity-on-main` ruleset.

## Constraints

- **Tech stack**: Keep Fastify + PostgreSQL + Auth0 (API) and React + TanStack Query + Vite (app), plus vanilla ES modules for Lite. Extend these, don't replace them.
- **Lite**: Must stay backend-free and must not break (`npm test`, `npm run validate`, `npm run build` stay green). Sharing code must not add a runtime dependency on SaaS.
- **Security**: Tenant isolation through RLS is mandatory. Handlers use `request.dbClient`, never `pool`. AI-proposed changes go through the same RLS and role checks as manual edits.
- **AI**: Anthropic Claude, with the key only in server env (`ANTHROPIC_API_KEY`). It must never reach the browser.
- **Repo policy**: Every change goes through a PR from a branch. Never commit `js/config.js`, the sample `js/config_*.js` files or `.env`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hosted multi-org is the v1 target | User runs one instance for many orgs | — Pending |
| SaaS view must be visually identical to Lite | Core value; one product feel across tiers | ✓ Phase 2: pixel parity ≤0.1% across 8 themes, required in CI |
| Share Lite logic instead of mirroring it in TS | Reuse requested; removes drift risk | ✓ Phase 2: `@roadmapsnap/core` (JS + JSDoc types), app lib deleted |
| Claude via one server `ANTHROPIC_API_KEY` | Simplest ops; key stays server-side | — Pending |
| AI changes are preview → confirm | Trust and safety on shared roadmaps | — Pending |
| Billing deferred to v2; fixed per-org AI caps in v1 | Keeps v1 focused | — Pending |
| Compose: postgres + migrate job + api image + web (nginx + built app) image | Two images we build, each scales on its own when hosted; nginx forwards /api so there's one origin | — Pending |
| Groups become a first-class table | Needed for AI "add to group X", import and reordering | — Pending |
| Dependency cycles rejected at milestone granularity | Project-level cycles can be valid at milestone level | — Pending |
| Invitees join only the inviting org (no personal org) | Avoids empty orphan orgs | — Pending |
| Invite email over SMTP (Mailpit in dev) | Provider-neutral | — Pending |
| Default model claude-opus-5-5 via ANTHROPIC_MODEL env | Quality first; Sonnet is the cost lever after evals | — Pending |
| Horizontal-layer roadmap (7 phases) | Hard prerequisites found in research (isolation, shared core, change engine) | — Pending (Phases 1-2 done) |
| Parity enforced as a required GitHub check through a ruleset, with in-job change detection instead of a path filter | A path-filtered required check stays pending and blocks merges | ✓ Phase 2 (skip path observed on a README-only PR) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

---
*Last updated: 2026-11-27 after Phase 2*
