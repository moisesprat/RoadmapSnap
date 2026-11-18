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
- ✓ Lite: themes (light, dark, professional, colorful, blank, evergreen) — existing
- ✓ SaaS API: Fastify 5 + PostgreSQL, Auth0 JWT verification (jose/JWKS) — existing
- ✓ SaaS API: multi-tenant model organizations → workspaces → projects → milestones/dependencies, RLS on `app.current_org_id`, roles viewer < editor < admin — existing
- ✓ SaaS API: workspace CRUD, project create/update/delete, `/auth/me` — existing
- ✓ SaaS app: React + TanStack Query shell, Auth0 login/callback, dashboard page with KPI cards, Gantt timeline, dependency arrows, filter bar, export menu, theme toggle — existing (partial re-implementation of Lite)
- ✓ Shared design tokens in `packages/tokens`, used by both Lite and the app — existing

### Active

**Lite-identical look and feel and code reuse**
- [ ] The SaaS roadmap view is visually identical to Lite (timeline, dashboard, KPIs, dependencies, filters, themes, exports)
- [ ] Lite's pure logic (`js/core/`) is shared with SaaS rather than kept as parallel TypeScript copies in `packages/app/src/lib/`, which ends the duplication described in CONCERNS.md

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
- About 2,300 lines of logic are duplicated between `js/core/` and `packages/app/src/lib/`. AGENTS.md currently requires fixing logic bugs in both. Code reuse is an explicit goal of this project.
- The API only has routes for workspaces and projects. Milestones and dependencies exist in the schema (migrations V1–V12) but have no endpoints.
- Security concerns from CONCERNS.md must be resolved before going multi-org hosted. `SET LOCAL` session variables are built with string interpolation, and `SET LOCAL` may run outside an explicit transaction, which could leave RLS variables unset. List endpoints have no pagination, and there is no structured logging.
- There is no Dockerfile or compose file yet.
- CI: the root runs on Node 20 (`npm test`, `validate`, `build`). api-ci needs Postgres plus a NOSUPERUSER `roadmapsnap_app` role. app-ci runs `tsc --noEmit`, tests and build.

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
| SaaS view must be visually identical to Lite | Core value; one product feel across tiers | — Pending |
| Share Lite logic instead of mirroring it in TS | Reuse requested; removes drift risk | — Pending |
| Claude via one server `ANTHROPIC_API_KEY` | Simplest ops; key stays server-side | — Pending |
| AI changes are preview → confirm | Trust and safety on shared roadmaps | — Pending |
| Billing deferred to v2; fixed per-org AI caps in v1 | Keeps v1 focused | — Pending |
| Compose: postgres + migrate job + api image + web (nginx + built app) image | Two images we build, each scales on its own when hosted; nginx forwards /api so there's one origin | — Pending |

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
*Last updated: 2026-11-18 after initialization*
