# Roadmap: RoadmapSnap

## Overview

RoadmapSnap Lite is a static, config-driven roadmap dashboard. This roadmap takes the hosted SaaS tier (`packages/`) from a partial prototype to a first release that runs as a multi-organization product with `docker compose up`. The journey starts by proving tenant isolation on the real request path, because the current API probably does not enforce it. It then extracts Lite's pure logic into one shared core and rebuilds the SaaS roadmap view on it, so the SaaS view is identical to Lite (the Core Value). With the view in place, editors get full manual editing and Lite config import through a single validated write path. Self-serve signup and invites turn the single-tenant app into a multi-org product. Claude-powered natural-language edits come next, shipped together with the per-org spend cap that protects the shared API key, followed by AI roadmap generation and a guided first-run experience. The roadmap closes by finalizing the compose deployment and hosted hardening, with a CI smoke test that proves two-org isolation through nginx.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Tenant & Security Foundation** - Tenant isolation is enforced and proven on the real API request path (completed 2026-11-21)
- [ ] **Phase 2: Shared Core & Lite-Identical View** - Lite and SaaS share one logic core, and the SaaS roadmap view matches Lite exactly
- [ ] **Phase 3: Change Engine, Manual Editing & Lite Import** - Editors build and maintain roadmaps in the browser, or import a Lite config, through one validated write path
- [ ] **Phase 4: Signup, Organizations & Invites** - Teams sign up on their own, get their own org and invite teammates with roles
- [ ] **Phase 5: AI Usage Limits & Natural-Language Edits** - Editors describe changes in plain language and apply them safely, under a hard per-org AI cap
- [ ] **Phase 6: AI Roadmap Generation & Guided Onboarding** - Roadmaps are created from a prompt, a pasted document or an uploaded file, and new orgs are guided to a starting path
- [ ] **Phase 7: Compose Deployment & Hosted Hardening** - `docker compose up` runs the full hardened stack, with CI proving two-org isolation through nginx

## Phase Details

### Phase 1: Tenant & Security Foundation

**Goal**: Tenant isolation is enforced and proven on the real API request path, so every later feature can be built multi-org with confidence
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. A user in org A cannot read or write any row belonging to org B through any API endpoint, proven by automated cross-tenant tests that run as the NOSUPERUSER app role
  2. The API refuses to start when its database role is a superuser or has BYPASSRLS, and every request runs inside a transaction that sets the tenant context with parameterized `set_config`
  3. A brand-new user who signs in is not added to the seed org, no dev RLS bypass remains, and a fresh install's database contains no sample program data (dev seed data is separate from schema migrations)
  4. A date saved on a roadmap comes back unchanged, with no day shift, when the API runs under a non-UTC server timezone

**Plans**: 10/10 plans complete (2 gap-closure plans pending)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Tracer: a signed-JWT request runs as roadmapsnap_app in a tenant transaction (V13 policies)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Schema-only migrations: V7-V12 stubs, importable migrate(), fresh-install zero-rows test
- [x] 01-08-PLAN.md — Header bypass removed in the same commit that moves auth, projects and workspaces tests to signed JWTs; /auth/me reports orgs (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-02-PLAN.md — Boot refusal for an unsafe role or config; transaction guarantees proven; NO_ORG from fastify.requireRole

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — Explicit seed:dev with two demo orgs; config-seed generator removed; README and .env.example
- [x] 01-05-PLAN.md — Routes on fastify.requireRole, no-bypass guard, cross-tenant matrix over every route, RLS catalog

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-06-PLAN.md — DATE contract: ISO strings end to end, two-timezone tests in CI, SPA adapter
- [x] 01-07-PLAN.md — Compose skeleton (postgres, migrate job, api as app role) and dev-token CLI

**Gap closure** *(from 01-VERIFICATION.md; 01-10 blocked on 01-09)*
- [x] 01-09-PLAN.md — CR-01 tracer: a client abort no longer releases the tenant client mid-handler (abort regression tests on a one-connection pool); WR-01 pool and client error listeners plus connect timeout
- [x] 01-10-PLAN.md — WR-06 requireRole fails closed on unknown roles; WR-08 production refuses to boot without CORS_ORIGIN; review ledger and SEC-01 traceability updated

**Research flag**: Targeted spike before planning. Confirm the RLS failure with a failing test first, choose the identity-resolution pattern under FORCE RLS (policy shape vs `SECURITY DEFINER`), and verify `audit_trigger_function` runs for the app role. Decide how fresh installs skip the immutable V7-V12 seed migrations while existing dev databases stay consistent.
**Notes**: Stand up a minimal compose skeleton (postgres + migrate job + api as the app role) as one plan in this phase, to flush out role, seed and build-context problems early. The DEP-* requirements are delivered and verified in Phase 7, not here.

### Phase 2: Shared Core & Lite-Identical View

**Goal**: A team's roadmap in SaaS looks and behaves exactly like it does in Lite, driven by the same shared logic
**Depends on**: Phase 1
**Requirements**: CORE-01, CORE-02, CORE-03, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. Lite and SaaS compute timeline, workflow, dependencies, stats, filters and the view model from the single `packages/core`, and the `packages/app/src/lib` duplicates no longer exist
  2. Lite works unchanged: `npm test`, `npm run validate` and `npm run build` stay green, and CI runs the Lite tests whenever shared code changes
  3. For the same data, the SaaS timeline/Gantt, KPI dashboard, and dependency arrows with tooltips and blocking detection are pixel-identical to Lite, verified by automated screenshot comparison
  4. A user can filter by name, status and risk, zoom 3, 6 or 12 months or the full range, and switch among all eight Lite themes (light, dark, professional, colorful, blank, monochrome, papallona, evergreen)
  5. A user can export the roadmap to PNG, CSV and JSON

**Plans**: 16/18 plans executed

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Tracer: npm workspaces + @roadmapsnap/core; one canonical date function in Lite tests, Lite build and app typecheck; purity guard; reserved core modules
- [x] 02-02-PLAN.md — Lite page composer extracted; byte-exact Lite HTML snapshots; complex fixture; characterization tests

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-03-PLAN.md — CI on Node 24 and workspaces (Lite CI always runs), API image from repo root, one lockfile, docs
- [x] 02-04-PLAN.md — Core workflow, timeline and dependencies with Lite bindings (OQ1 derived keys)
- [x] 02-05-PLAN.md — Eight-theme contract (core, API, app type, guard), requirement texts, http(s)-only project links
- [x] 02-06-PLAN.md — Parity harness in the pinned Playwright image, Lite-vs-Lite and base-vs-HEAD (package legitimacy gate)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-07-PLAN.md — Core filters, stats and row view model with Lite bindings
- [x] 02-08-PLAN.md — Core CSV/JSON builders, apiToRoadmap adapter and defaults, icons and safeHttpUrl
- [x] 02-09-PLAN.md — All theme CSS into packages/tokens, dark class alias removed, chrome tokens, self-hosted DM Sans

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-10-PLAN.md — Core page, dashboard and filter-bar models plus view-state transitions; Lite renders from them

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-11-PLAN.md — Core timeline model and dependency-arrow computation; Lite renders from them
- [x] 02-12-PLAN.md — React Lite components I: golden harness, view-state hook, dashboard, filter bar

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-13-PLAN.md — React Lite components II: timeline grid and dependency arrows
- [x] 02-17-PLAN.md — Early React-vs-Lite pixel check (parity-mode preview, both fixtures); export controls and footers

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-14-PLAN.md — SaaS page on live data through apiToRoadmap, first full-area pixel check, theme persistence, page states

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-15-PLAN.md — SaaS header, account menu and projects dialog; dialog copy; pre-paint theme; Tailwind preflight off; AppShell/ThemeToggle/themeStorage removed
- [ ] 02-18-PLAN.md — Superseded React views and the six duplicated app lib modules deleted (CORE-02)

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 02-16-PLAN.md — Lite-vs-SaaS parity matrix, interactions and PNG smoke; always-run Parity CI gate; CORE-02 guard; docs

**Research flag**: Spike before planning for the view half. Cover CSS isolation and Tailwind preflight scoping, the bridge from the app's CSS-class themes to `data-theme`, `html2canvas` PNG export under each theme, and the screenshot-parity approach (Playwright in a pinned Docker image). The core-extraction half is a mechanical strangler refactor with a known target and needs no research.
**Notes**: `js/core/` is not pure today (it reads `CONFIG` and `window.*`), so extraction means refactoring to explicit-argument functions first, then moving them. Decide the Node version (24 is the conservative choice) and adopt npm workspaces here, aligning CI, images and `engines`. Update AGENTS.md and `docs/monorepo.md` once the duplicate-fix rule no longer applies.
**UI hint**: yes

### Phase 3: Change Engine, Manual Editing & Lite Import

**Goal**: Editors can build and maintain a roadmap in the browser, or bring in an existing Lite roadmap, through one validated, role-checked write path
**Depends on**: Phase 2
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, IMP-01, IMP-02
**Success Criteria** (what must be TRUE):
  1. An editor can create, edit and delete deliverables/tasks in a side panel, create, rename, reorder and delete groups, and set or change milestone dates per workflow step, and the changes persist and render on the timeline
  2. An editor can add and remove dependencies with a picker, a dependency that would create a cycle at milestone granularity is rejected with a clear message, and the editor can drag milestone dates on the timeline
  3. An editor can undo a delete or edit from a toast, and when someone else changed the same item in the meantime the user is told to refresh rather than silently overwriting it
  4. A viewer sees a read-only UI, and the API rejects the viewer's writes
  5. A user can upload a Lite `config.js` and see a preview with a validation report without the file ever being executed, and on confirm gets a new roadmap that renders identically to Lite for that config

**Plans**: TBD
**Research flag**: Moderate. The ops vocabulary is the central design artifact (it must be fixed before Phase 5 prompt work), plus the revision-based concurrency design and the duplicate task-name policy. Import is standard once the `acorn` literal-only approach is fixed; check the `config_*.js` samples for non-literal syntax. Decide where `WORKFLOW`, `ENTITY_LABELS`, `DASHBOARD_TEXT`, `NON_FILTERABLE_GROUPS` and group order live in the SaaS schema (V7/V9/V12 are the reference mapping).
**Notes**: Decisions already made: groups become a first-class table, and cycles are rejected at milestone granularity. Import must never use `eval`, `vm` or `new Function` (the repo's `generate-config-seed.mjs` uses `new Function` and must not be copied), and a malicious-fixture test is required.
**UI hint**: yes

### Phase 4: Signup, Organizations & Invites

**Goal**: New teams can sign up on their own, get their own organization, and bring teammates in with the right roles
**Depends on**: Phase 1
**Requirements**: ORG-01, ORG-03, ORG-04, ORG-05, ORG-06, ORG-07
**Success Criteria** (what must be TRUE):
  1. A new user signs up through Auth0 and lands in their own newly created organization automatically, and signing in again does not create a duplicate
  2. An admin can invite a teammate by email with a viewer, editor or admin role, the email is delivered over SMTP (visible in Mailpit in dev), and the admin sees pending invites and can resend or revoke them, with invites expiring after 7 days
  3. An invitee whose verified email matches accepts the invite and joins only the inviting org with no personal org created, while a mismatched, expired or revoked invite is refused with a clear message
  4. An admin can change member roles and remove members, and the last admin cannot be removed or demoted
  5. A user who belongs to several orgs can switch between them and sees only the active org's data

**Plans**: TBD
**Research flag**: Research before planning. Confirm Auth0 tenant plan features (Actions, `email`/`email_verified` claim vs `/userinfo`), the account-linking policy and the path for users with no email, and spike the token-scoped invite-accept policy under FORCE RLS.
**Notes**: Decisions already made: invitees join only the inviting org (no personal org), invite mail goes over SMTP with Mailpit in dev. Needs only Phase 1 in code, so it can be pulled forward if the Auth0 research unblocks early, but it must land before Phase 5 because the org's AI quota row is created at provisioning.
**UI hint**: yes

### Phase 5: AI Usage Limits & Natural-Language Edits

**Goal**: An editor can describe a change in plain language, review exactly what Claude proposes, and apply it safely, with spend on the shared key capped per org from the very first call
**Depends on**: Phase 3, Phase 4
**Requirements**: AIE-01, AIE-02, AIE-03, AIE-04, AIE-05, AIE-06, AIE-07, QUOTA-01, QUOTA-02, QUOTA-03, QUOTA-04, QUOTA-05
**Success Criteria** (what must be TRUE):
  1. An editor types a change in plain language (for example "add task X in group Y depending on A, B, C") and gets a proposed change set, shown as a diff grouped into added, changed and removed with a short explanation
  2. The preview shows the impact (newly blocked items, cycles and KPI changes) and the proposed changes as a ghost overlay on the timeline, and ambiguous or unknown names are flagged and block confirm until resolved
  3. Nothing is saved until the user confirms, the apply is atomic, a proposal made stale by a roadmap change is rejected, and the user can undo an applied AI change set as one unit
  4. Each org has a hard monthly AI cap enforced atomically before every Claude call, users see a usage meter with a warning at 80% and a clear message at 100%, and manual editing keeps working when the cap is reached
  5. An operator can adjust an org's cap, a per-user rate limit and input-size limits apply, and the Anthropic key exists only in server env and never reaches the browser

**Plans**: TBD
**Research flag**: Research before planning. Re-verify model IDs and pricing at implementation time, whether the `server-side-fallback` beta composes with `output_config.format` and `parse()`, effort and cost weights from real token measurements (default monthly cap included), and eval-set design for ambiguity, cycles and cross-workspace references.
**Notes**: Metering ships in the same phase as the first Claude call, never after. Default model is `claude-opus-5-5`, read from the `ANTHROPIC_MODEL` env var. AI applies only by stored proposal id through the same write path as manual edits, so RLS, role, cycle and audit checks are identical.
**UI hint**: yes

### Phase 6: AI Roadmap Generation & Guided Onboarding

**Goal**: A user can create a roadmap from a prompt, a pasted document or an uploaded file, and a brand-new org is guided to pick a starting path
**Depends on**: Phase 5, Phase 3
**Requirements**: AIG-01, AIG-02, AIG-03, AIG-04, ORG-02
**Success Criteria** (what must be TRUE):
  1. A user can create a new roadmap from a text prompt
  2. A user can create a new roadmap from a pasted document, or from an uploaded CSV, XLSX or markdown file
  3. A generated roadmap is shown in a preview with inferred values flagged, and nothing is created until the user confirms
  4. A new org with no roadmap sees a guided empty state offering create with AI, import a Lite config, or start blank, and each choice leads into a working flow

**Plans**: TBD
**Research flag**: Skip the research phase. It extends Phase 5's pipeline and Phase 3's new-roadmap apply path with well-documented multipart handling. Spot-check the chosen XLSX parser's zip-bomb behavior during planning.
**Notes**: ORG-02 sits here rather than in Phase 4 because this is the first point where all three starting paths (blank, Lite import, AI) exist. Generation draws on the same org AI meter and the same input-size limits built in Phase 5. Milestone dates in the AI schema must be `{key, date}` pairs, because `z.record` collapses under strict structured outputs.
**UI hint**: yes

### Phase 7: Compose Deployment & Hosted Hardening

**Goal**: `docker compose up` runs the full stack as a hardened, hosted multi-org deployment, and an automated check proves isolation through the real topology
**Depends on**: Phase 6 (builds on the compose skeleton started in Phase 1)
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06
**Success Criteria** (what must be TRUE):
  1. From a fresh clone with `.env` copied from `.env.example`, `docker compose up` starts postgres, runs the migrate job, then starts the api and web (nginx serving the SPA and proxying `/api`), and a user can sign in and use the app through one origin
  2. The SPA's Auth0 domain/client and API URL come from runtime configuration, so changing them in `.env` and restarting takes effect without rebuilding the image
  3. The API runs as the app role, and every secret, including the app DB password, comes from env with no hard-coded passwords left in migrations or images
  4. Health and readiness endpoints reflect real database state, and compose starts dependent services only once they report ready
  5. Logs are structured with secrets redacted, and a CI smoke test brings up compose and verifies two-org isolation through nginx

**Plans**: TBD
**Research flag**: Moderate. Choose the TLS front end for Auth0 https callbacks, the secrets handling for the target host, and confirm the Postgres 18 volume path (`/var/lib/postgresql`).
**Notes**: Smoke test scope per research: `docker compose up --wait`, migrate run twice, zero seed rows on a fresh install, two-org isolation through nginx, and a secrets scan of the built images. Also finish helmet, rate limits, a global AI circuit breaker and the Anthropic Console spend limit as backstops.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tenant & Security Foundation | 10/10 | Complete    | 2026-11-21 |
| 2. Shared Core & Lite-Identical View | 16/18 | In Progress | - |
| 3. Change Engine, Manual Editing & Lite Import | 0/TBD | Not started | - |
| 4. Signup, Organizations & Invites | 0/TBD | Not started | - |
| 5. AI Usage Limits & Natural-Language Edits | 0/TBD | Not started | - |
| 6. AI Roadmap Generation & Guided Onboarding | 0/TBD | Not started | - |
| 7. Compose Deployment & Hosted Hardening | 0/TBD | Not started | - |
