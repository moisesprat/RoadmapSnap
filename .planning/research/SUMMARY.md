# Project Research Summary

**Project:** RoadmapSnap SaaS v1
**Domain:** Multi-tenant roadmap / PMO governance SaaS with Claude-powered roadmap creation and edits (brownfield)
**Researched:** 2026-11-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

RoadmapSnap SaaS v1 is a hosted, multi-org version of an existing static dashboard (Lite). It adds in-browser editing, Claude-powered creation and plain-language edits, Lite config import, self-serve signup with invites, and a `docker compose up` deployment. The research agrees on one build philosophy: **one pure shared core, one write path, and tenant isolation proven before anything is built on it.** The existing codebase is further from "ready to host" than PROJECT.md implies. Three findings from reading the code change the plan.

1. RLS is probably not enforced on the real request path. `SET LOCAL` runs outside a transaction, the API connects as the superuser, and the membership lookup would fail under the app role.
2. `js/core/` is not pure. It reads `CONFIG` and `window.*`, so "share it with SaaS" is a refactor first and a move second.
3. Every new signup is auto-made admin of a seed org that holds the author's program data.

All of this must be fixed before multi-org features ship.

The recommended approach has four parts.

- **Shared logic.** Create `packages/core` (zero-dependency ESM JS with JSDoc and `.d.ts`) holding pure functions with explicit arguments. Lite keeps thin binding shims. The React app renders core view models with Lite's own CSS classes, driven by `packages/tokens`. Do not embed Lite's HTML renderers in React (stored XSS, DOM ownership conflicts). Enforce visual identity with tests.
- **Change-set engine.** Build one engine for all roadmap writes. A pure `applyOps(model, ops)` runs in the API (authoritative) and the browser (preview). Manual edits, Lite import and AI apply all call the same path. AI applies by stored proposal id only, with a diff hash and revision check.
- **AI.** Claude is called server-side with structured outputs (not forced `tool_choice`, which returns 400 on current models). Metering is reserve-then-settle in Postgres, outside any DB transaction held across the model call. Uploaded documents are untrusted data, so containment comes from architecture (no write tools, schema validation, preview, confirm, RLS).
- **Deployment.** Two images (api, web/nginx), one `migrate` job running as the owner role, and the API running only as NOSUPERUSER `roadmapsnap_app`. SPA config is injected at runtime.

The main risks are a silent tenant-isolation failure, executing uploaded `config.js`, unsafe LLM edit application, and uncapped spend on the shared key. Each has a concrete structural mitigation below. Two product decisions are unresolved and block onboarding design: whether invited new users also get a personal org, and the invite acceptance rule (email match vs token as proof).

## Key Findings

### Recommended Stack

Extend, don't replace. The existing stack (Fastify 5, pg, jose/Auth0, React 18, TanStack Query, Vite, Tailwind 3, vanilla-ES Lite, tokens) stays. Do not upgrade Vite, Vitest, Tailwind or React in this milestone, so visual-parity work isn't built on a moving base. Versions were read from the npm registry on 2026-11-18. Full detail is in `.planning/research/STACK.md`.

**Core technologies:**
- `@anthropic-ai/sdk ^1.10` + `zod ^4.6`: Claude calls and the single source of truth for the ChangeSet schema. Use `messages.parse` / `stream().finalMessage()` with `zodOutputFormat`. Forced `tool_choice`, prefill and `thinking: disabled` all return 400 on Opus 5.5 / Sonnet 5.5.
- `@fastify/multipart ^10`, `@fastify/rate-limit ^11`: uploads with explicit size/part limits and coarse abuse throttling. The AI budget itself lives in Postgres, not Redis.
- `acorn ^8.19`: literal-only AST evaluation of `config.js`, never execution. Validate with `ajv` against the existing `schema/config.schema.json`.
- `papaparse ^5.7` (CSV) and `read-excel-file ^9.3` (XLSX): not SheetJS from the npm registry (frozen, known CVEs) and not `exceljs`. Markdown goes to the model as raw text.
- `nodemailer ^10` over SMTP: provider-neutral invite email, with Mailpit in a compose dev profile.
- npm workspaces: replace `file:` deps with one root lockfile and a shared `@roadmapsnap/core`. Lite CI uses `npm ci --workspaces=false`.
- Docker: `node:26-alpine` (fallback 24), `nginxinc/nginx-unprivileged:1.30-alpine`, `postgres:18-alpine`. Compose `migrate` reuses the api image. Move CI off Node 20 (EOL 2026-04-30) and align CI Postgres with compose.
- `@playwright/test`: Lite-vs-SaaS screenshot parity as a test, not a review.
- Own the org model in Postgres. Do not adopt Auth0 Organizations (plan limits, duplicates the RLS model). Remove the unused `@fastify/jwt`.

**Model note:** default `claude-opus-5-5` from `ANTHROPIC_MODEL` env, with `claude-sonnet-5-5` as the cost lever decided by an eval on real roadmaps. The AI schema must model milestone dates as `{key, date}` pairs, because `z.record` collapses to an empty object under strict structured outputs (found by prototype).

### Expected Features

Lite's model is milestone-driven (deliverable bar and status derive from workflow milestone dates; dependencies are `{task, from, to}` milestone pairs). Generic Gantt assumptions (drag to change start/end, finish-to-start auto-shift) do not map to it. Full detail is in `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Lite-identical roadmap view (timeline, KPIs, dependencies, filters, themes, exports) on shared logic. This is the Core Value.
- Milestone and dependency API plus server-side validation, optimistic concurrency and role-aware UI.
- Side-panel create/edit/delete for deliverables, groups, milestones and dependencies, with a dependency picker and undo toast.
- Lite `config.js` import with preview and validation report.
- Self-serve signup that creates an org (idempotent), a guided empty state (AI / import / blank) and an org switcher.
- Invites with role, pending list, resend/revoke, expiry, email-match, member management, last-admin guard and a working mail transport.
- AI generation (prompt, paste, CSV/XLSX/MD) into a new roadmap, with preview, validation and inferred-value flags.
- AI natural-language edits: closed op vocabulary, name-to-ID resolution, ambiguity prompts, grouped diff preview, staleness check, atomic apply and post-apply undo.
- AI usage cap: atomic reservation, ledger, meter in UI, 80%/100% messaging, input limits, per-user rate limit, operator-adjustable per-org cap. Manual editing must keep working at 100%.

**Should have (competitive):**
- Impact check in the preview (new blocked items, cycles, KPI deltas). Cheap because core stats and dependency logic is pure, so pull it into v1 if possible.
- Per-op accept/reject, visual ghost-bar preview on the timeline, AI change history, admin usage breakdown, inline table editing, "download as config.js".

**Defer (v2+):**
- Billing, plans, top-ups.
- Merge AI content into an existing roadmap.
- Drag-to-reschedule and drag-to-link (v1.x at the earliest).
- Conversational Q&A and summaries.
- Domain auto-join, SSO/SCIM.
- Jira integration.

Anti-features to hold the line on: auto-apply without preview, a persistent AI chat, auto-rescheduling cascades, real-time co-editing, per-org API keys, and multi-provider AI.

### Architecture Approach

Seven decisions, detailed in `.planning/research/ARCHITECTURE.md`. The load-bearing ones are listed here.

1. `packages/core` is the leaf of the dependency graph (no DOM, `window`, `CONFIG`, `process`, DB or network). It is migrated by strangler, module by module, with Lite `js/core/*` becoming bindings. All theme CSS moves into `packages/tokens`, and the app switches to `data-theme`.
2. One change-set engine. Ops are interpreted only by pure `applyOps`, and the SQL writer persists resolved mutations in one transaction with a workspace lock.
3. AI runs as three short transactions around one DB-free Claude call (reserve, call, persist and settle).
4. Tenant context is the transaction boundary: `withTenantTx` with parameterized `set_config(..., true)`, the API on `APP_DATABASE_URL`, and a boot-time superuser/BYPASSRLS assertion.
5. Provisioning and invite accept work under RLS (new-org context and a token-scoped policy) with no `row_security = off`.

**Major components:**
1. `packages/core`: all pure roadmap rules, the roadmap model and adapters, and the change-set ops/reducer/diff/validate.
2. `plugins/tenant` + `services/changeEngine`: tenant tx/RLS context and the single write path for manual, import and AI.
3. `services/ai` + `services/metering`: snapshot and prompt building, Claude client, proposals storage, reserve/settle ledger.
4. `services/import` + `services/orgs`: literal-only config parsing, signup provisioning, invitations and the mailer.
5. `packages/app` React components on shared CSS: view models, edit modals and the proposal preview (the `src/lib` mirrors are deleted).
6. `web` (nginx) + `migrate` job: static SPA with runtime `/config.js` and the `/api` proxy, and owner-role migrations.

### Critical Pitfalls

Fourteen are catalogued in `.planning/research/PITFALLS.md`. The top five for roadmap purposes:

1. **RLS unexercised on the API path** (superuser connection, `SET LOCAL` outside a tx, membership lookup blocked by FORCE RLS). Fix with per-request `BEGIN` plus parameterized `set_config`, an `APP_DATABASE_URL` app-role connection, `NULLIF(current_setting(...),'')::uuid` in policies, composite `(org_id, id)` FKs, a catalog test for RLS coverage, and a boot check.
2. **Seed-org auto-admin and dev bootstrap leak data across tenants.** Remove them, move V7-V12 seed data out of hosted migrations, and add a fresh-signup isolation test.
3. **Executing uploaded `config.js`.** Never use `eval`, `vm` or `new Function`. Use an `acorn` literal-only evaluator with a malicious-fixture test, and note the repo's own `generate-config-seed.mjs` uses `new Function` and must not be copied.
4. **Unsafe LLM edits** (hallucinated IDs, ambiguity, partial apply, stale or tampered proposals). Use short aliases mapped server-side, an op enum, server-stored proposals, confirm by id only, a `base_revision`/diff-hash check, atomic apply through the manual-edit service layer, and an op cap.
5. **Uncapped or racy spend on the shared key**, plus signup abuse. Use an atomic DB reservation before the call, `max_tokens` on every call, settlement from `usage` including failures, per-user rate limit, verified-email gating and a Console spend limit as backstop.

Also load-bearing:
- Date-only values shift by a day (register `setTypeParser(1082, v => v)` and test under a non-UTC `TZ`).
- Dependency cycles are checked nowhere (check the final graph, at milestone granularity, under a workspace lock).
- Pagination breaks the dashboard (a bounded snapshot endpoint, paginate only unbounded lists).
- Auth0 access tokens carry no email by default.
- Compose hazards: the literal `apppassword` in V4, `NODE_ENV` defaulting to development, a lying `/health`, and build-time `VITE_*`.

## Implications for Roadmap

The architecture build order and the pitfall phase mapping agree. Suggested phases below fold the two together. The researchers' separate labels (P-Foundation, P-Core and so on) map as shown.

### Phase 1: Tenant and Security Foundation
**Rationale:** Everything multi-tenant or transactional depends on it, and isolation is probably unenforced today. It is cheap relative to the cost of discovering it after hosting.
**Delivers:**
- `withTenantTx` with parameterized `set_config`; API on `APP_DATABASE_URL`; boot assertion on `rolsuper`/`rolbypassrls`.
- Two-stage org resolution and an `org_members` self-select policy; removal of the seed-org auto-join and the dev bootstrap (`row_security = off`).
- Route registration moved to `server.js`; composite org-scoped FKs; `NULLIF` policies; DATE type parser.
- Cross-tenant API tests run as the app role; a catalog test for RLS coverage; a split of schema migrations from dev seeds; `NODE_ENV`/test-auth hardening; a CI guard against importing `pool`.
**Addresses:** the foundation for every feature; Pitfalls 1, 2, 3, 6 (driver part), 8 (policy), 13 (role/seed part).
**Avoids:** silent cross-tenant exposure.

### Phase 2: Shared Core Extraction and CI
**Rationale:** The view parity, change engine, import adapters and API validation all need pure shared logic. `js/core` is not pure, so the extraction is real work. Do it module by module.
**Delivers:**
- `packages/core` with timeline, workflow, dependencies, stats, filters and viewModel moved out as explicit-argument functions.
- Lite bindings kept (with `window.*` for inline handlers).
- npm workspaces; CI path filters fixed so shared changes run Lite tests; Node bump; cross-check fixture tests; one canonical DD/MM/YYYY parse/format; updated AGENTS.md and `docs/monorepo.md`.
**Uses:** npm workspaces, JSDoc plus generated `.d.ts`.
**Implements:** `packages/core`.
**Avoids:** Pitfall 5 (window globals), the `today` mismatch between products, and CI blind spots.

### Phase 3: Lite-Identical View
**Rationale:** The Core Value ("if everything else slips, this must be right"). It is independent of AI and can run in parallel with Phases 4 and 6 once core exists.
**Delivers:**
- All themes moved into `packages/tokens` and `data-theme` in the app; Tailwind preflight scoped; React components driven by core view models; `app/src/lib` mirrors deleted.
- A golden-markup parity test and Playwright screenshot diffs for two themes; font parity; XSS fixtures and an `http(s)` link allowlist.
**Addresses:** the Lite-parity table-stakes block.
**Avoids:** `dangerouslySetInnerHTML`, CSS bleed, and drift.

### Phase 4: Change Engine and Manual Editing
**Rationale:** The foundation for AI, import and editing. Proving the engine with humans first de-risks the highest-risk feature and produces the diff UI AI will reuse.
**Delivers:**
- Ops vocabulary and pure `applyOps` with invariants (cycle check on the final graph at milestone granularity, uniqueness, workflow-key validation, date ordering).
- Writer with a per-workspace lock; milestone, dependency, group and changeset endpoints; a bounded snapshot endpoint with hard caps.
- Optimistic concurrency (revision / `updated_at` with 409); group modeling decision (first-class table recommended); side-panel edit UI, dependency picker, delete undo toast and role-aware UI.
- A `change_set_id` on `audit_events` for undo.
**Addresses:** manual editing; foundations for AI undo and history.
**Avoids:** Pitfalls 7, 8, 14.

### Phase 5: Lite Config Import
**Rationale:** It reuses the engine, needs no AI, gives realistic data, and shares the new-workspace target with generation. It comes before AI.
**Delivers:**
- Acorn literal-only parser, ajv plus core validation, `fromLiteConfig` and `modelToOps`.
- An import preview and report, plus a round-trip fidelity test on `config.complex.js`.
- A decision on where workflow, labels and dashboard text live in the SaaS schema (the V7/V9/V12 mapping is the reference).
**Avoids:** Pitfall 4, and silent field dropping.

### Phase 6: Signup, Org Provisioning and Invites
**Rationale:** It needs Phase 1 and can run alongside Phases 3-5. It must land before hosting, and the org quota row is created at provisioning, so it must precede AI.
**Delivers:**
- Idempotent org creation under the new org's own RLS context; the Auth0 Action for namespaced `email`/`email_verified`; a decision on invited-user personal-org policy.
- `org_invitations` (hashed single-use token, 7-day expiry) with a token-scoped accept policy; email-match and wrong-account handling; mailer (SMTP, log driver for dev); members UI, last-admin guard, org switcher and the guided empty state.
**Avoids:** Pitfalls 3 (replace), 12.

### Phase 7: AI Metering and Natural-Language Edits
**Rationale:** The highest-risk feature, so it comes after tenancy, the engine and org provisioning. Metering ships in the same phase as the first Claude call, never after.
**Delivers:**
- `ai_usage_ledger` plus `org_ai_quota` with atomic reserve and settle; Claude client with structured outputs, effort set, refusal and `max_tokens` handling, prompt caching and a countTokens pre-check.
- Short-id snapshots; stored `change_proposals` (confirm by id only, diff hash, expiry); stale 409; clarification results.
- Preview/confirm UI, usage meter with 80%/100% states, per-user rate limit, op cap and a prompt-injection fixture set.
- An eval set for ambiguity, cycles and cross-workspace references.
**Avoids:** Pitfalls 9, 10, 11.

### Phase 8: AI Generation From Prompt, Paste and Files
**Rationale:** It extends Phase 7's pipeline and Phase 5's new-workspace target.
**Delivers:**
- A `/generate` route with multipart limits and magic-byte sniffing.
- CSV/XLSX flattening (hidden sheets, comments and formulas dropped); explicit truncation and limit messages.
- An `{key, date}` pair schema for milestones; inferred-value flags; streaming `finalMessage()`; a possible 202 plus polling path if generation exceeds ~60 s.

### Phase 9: Compose Finalization and Hosted Hardening
**Rationale:** The compose skeleton should start early, in parallel after Phase 1, to flush out role, seed and build-context problems. This phase finishes it.
**Delivers:**
- Runtime `/config.js` injection, nginx (`try_files`, 120 s read timeout, 10 MB body, `X-Forwarded-*` with Fastify `trustProxy`) and `/ready` (DB plus schema version).
- Secret-sourced app-role password and no literal `apppassword`; boot checks on env; structured pino logging with redaction; helmet; rate limits; a global AI circuit breaker and Anthropic spend limit.
- A CI smoke (`docker compose up --wait`, migrate twice, zero seed rows, two-org isolation through nginx, secrets scan of images).
**Avoids:** Pitfall 13.

### Phase Ordering Rationale

- Phase 1 first because every later write path runs through the tenant transaction. Phases 4, 5, 6 and 7 are blocked by it.
- Phase 2 before 3, 4 and 5 because they all consume core. The parity view, the `applyOps` invariants and the import adapters need explicit-argument functions.
- The manual edit API (Phase 4) comes before AI because AI never gets a private write path. Proposals become the same writes a human performs, so RLS, role, cycle and audit checks are identical.
- Import (5) precedes AI generation (8) because generation reuses the new-workspace apply path, and import validates the model and adapters with no LLM cost.
- Phase 6 is order-flexible (needs only Phase 1) but must precede 7 for quota provisioning, and must precede any hosting.
- Start a compose skeleton right after Phase 1 and treat Phase 9 as finalization, so the real topology exercises every phase.
- Early decisions needed: the op vocabulary (before Phase 4 and any AI prompt work), group modeling (before 4 and 5), and the invited-user personal-org policy (before 6).

### Research Flags

Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase <N>`):
- **Phase 1:** targeted spike. Confirm with a failing test first, then choose the identity-resolution pattern under FORCE RLS (policy shape vs `SECURITY DEFINER`) and verify the `audit_trigger_function` runs for the app role.
- **Phase 3:** spike before planning. CSS isolation and Tailwind preflight strategy, theme mechanism bridge, `html2canvas` PNG export under each theme, and a screenshot-parity approach (Playwright in the pinned Docker image).
- **Phase 6:** research. Auth0 tenant plan features (Actions, email claim vs `/userinfo`), account-linking policy, email provider, and a half-day spike on the token-scoped invite policy under FORCE RLS.
- **Phase 7:** research. Re-verify model IDs and pricing at implementation time, whether `betas: server-side-fallback` composes with `output_config.format` + `parse()`, effort and cost weights from real token measurements, and eval set design.
- **Phase 4 (moderate):** group modeling and revision-based concurrency design; the ops vocabulary is the central design artifact.
- **Phase 9 (moderate):** TLS front end choice for Auth0 https callbacks, secrets handling for the target host, and the Postgres 18 volume path.

Phases with standard patterns (skip research-phase):
- **Phase 2:** mechanical strangler refactor with a known target; the main work is fixture-based cross-check tests.
- **Phase 5:** standard once the acorn approach is fixed. Only check any `config_*.js` variants for non-literal syntax.
- **Phase 8:** largely reuses Phase 7 plus well-documented multipart handling. Spot-check the chosen XLSX parser's zip-bomb behavior.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified from the npm registry, Docker Hub and Node schedule, plus a local prototype (acorn on `config_base.js`, `zodOutputFormat` gotcha). MEDIUM on Node 26 as the image base, Auth0 plan limits, the PG18 volume path, fallback-with-parse composition and `read-excel-file` zip-bomb behavior. |
| Features | MEDIUM | Interaction patterns are well established and corroborated. Competitor AI behavior is thinly documented in public sources, and cost weights and caps are unsourced. The last-admin guard is a design requirement, not a sourced finding. |
| Architecture | MEDIUM-HIGH | HIGH for findings read directly from the repo source. MEDIUM for the invite/RLS policy design and Auth0 email-claim handling, and MEDIUM-HIGH for the AI pipeline, since Claude API behavior came from a reference and has not been exercised in this repo. |
| Pitfalls | HIGH (code) / MEDIUM (external) | Code-derived items were read directly. Auth0, Docker and Anthropic items rely on docs, community threads and established practice. |

**Overall confidence:** MEDIUM-HIGH. The codebase findings are firm and drive the plan. The uncertain parts (Auth0 behavior, Claude fallbacks, AI cost numbers) are bounded to Phases 6 and 7 and are flagged for research there.

### Gaps to Address

- **Invited-user signup policy.** Recommendation: invited new users join only the inviting org and get no personal org. Needs a product decision before Phase 6. Also decide the accept rule (verified email match vs token as proof).
- **Auth0 email claim.** The tenant may not put `email`/`email_verified` on access tokens. Confirm the Action or `/userinfo` fallback in a real dev tenant. Users with no email (some enterprise IdPs) need an explicit path.
- **Where Lite config concepts live in the SaaS schema** (`WORKFLOW`, `ENTITY_LABELS`, `DASHBOARD_TEXT`, `NON_FILTERABLE_GROUPS`, group order). Import fidelity depends on it. Use V7/V9/V12 as the reference mapping and decide before Phase 5.
- **Group modeling.** Groups are only `projects.group_name` text plus `settings.group_order` today. Resolve before Phase 4 (a first-class table is recommended), along with the duplicate task name policy (`UNIQUE (workspace_id, name)`).
- **Mail transport** is unspecified in PROJECT.md. Decide SMTP via env with a log-only dev driver.
- **AI numbers.** Unit cost weights, default monthly cap and model choice (Opus vs Sonnet per job) need real token measurements on representative roadmaps and documents. Nothing in the research is sourced for them.
- **Model-fallback and API details.** Confirm `server-side-fallback` beta composition with structured outputs, and re-check model IDs and pricing at implementation time.
- **Seed data migration.** V7-V12 are immutable once applied. Decide how fresh installs skip them while existing dev databases stay consistent.
- **Dependency semantics at milestone granularity.** Project-level cycles can be legitimate at milestone level, so confirm the hard-error vs soft-warning rule with the product owner.
- **Competitor AI claims** (Productboard Spark, Aha!, Atlassian) are unverified. Re-check hands-on before any positioning copy.
- **Node version.** CI is on Node 20 (EOL). The stack research recommends Node 26 (or 24) and the architecture research suggests 22 or 24. Pick one (24 is the conservative choice) and align CI, images and `engines`.
- **Workspaces vs `file:` deps.** STACK recommends npm workspaces, while ARCHITECTURE defers them as a separate risk. Recommendation: adopt workspaces in Phase 2, since the Docker build context and the single lockfile need them anyway, and verify `npm ci --workspaces=false` keeps Lite CI light.

## Sources

### Primary (HIGH confidence)
- Repository source read directly (`packages/api/src/**`, migrations V1-V12, `packages/app/src/**`, `packages/tokens/*`, `js/core/*`, `js/ui/renderer.js`, `css/roadmap.css`, CI workflows, `docs/monorepo.md`, `.planning/PROJECT.md`, `.planning/codebase/*`).
- npm registry (`npm view`, 2026-11-18), Docker Hub tags, the Node release schedule, and a local prototype (acorn evaluation, `zodOutputFormat`, SDK exports, selective workspace installs).
- Official READMEs: `@fastify/multipart`, `@fastify/rate-limit`, `read-excel-file`.
- PostgreSQL documented behavior: `SET LOCAL` outside a transaction, `set_config(..., is_local)`, FORCE RLS applying to owners but not superusers/BYPASSRLS.

### Secondary (MEDIUM confidence)
- Claude API reference bundled with the claude-api skill (cached 2026-11-03): model IDs and pricing, forced `tool_choice` 400s, structured-output schema limits, effort and thinking rules, refusal fallbacks, usage fields.
- Auth0 documentation and community threads on invite edge cases and the missing email claim.
- Anthropic strict tool use and structured outputs docs.
- AI diff-review and usage-limit UX conventions (VS Code agent review docs, monday.com, ClickUp, Lovable, HubSpot) and Gantt editing and invite-flow references (WorkOS, Auth0 B2B guides).
- Postgres GUC-after-commit behavior (`NULLIF` pattern) from community write-ups and mailing list threads.

### Tertiary (LOW confidence, needs validation)
- Auth0 Free-plan limit of 5 Organizations (competitor and community articles). The recommendation to own the org table holds regardless.
- SheetJS npm staleness and CVE details via secondary summaries. Confirm on sheetjs.com only if the CDN route is ever chosen.
- Competitor AI behavior (Productboard Spark, Aha! assistant, Atlassian roadmap AI), vendor marketing with unverified mechanics.
- PostgreSQL 18 image volume path (`/var/lib/postgresql`), recalled from documentation and not re-fetched.

---
*Research completed: 2026-11-18*
*Ready for roadmap: yes*
