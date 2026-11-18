# Architecture Research

**Domain:** Multi-tenant roadmap / PMO governance SaaS (brownfield: Lite static app + Fastify/Postgres-RLS/React SaaS)
**Researched:** 2026-11-18
**Confidence:** HIGH for findings grounded in the repo source; MEDIUM for the invitation/RLS design and the Auth0 email-claim handling (need a short spike); MEDIUM-HIGH for the AI pipeline (Claude API behaviour taken from the current claude-api reference, not yet exercised in this repo)

Scope: how the seven target features (Lite-identical view, AI edit pipeline, AI generation, Lite import, signup/invites, AI metering, compose topology) fit the existing architecture, what the component boundaries are, how data flows, and the order in which to build them.

---

## Headline Findings (read these first)

These come from reading the code, not the codebase map, and they change the build order.

1. **`js/core/` is not actually pure.** `stats.js`, `dependencies.js`, `timeline.js`, `workflow.js` read the global `CONFIG` and `window.*`; `viewModel.js` reads `document.documentElement` for the theme (`isMonochromeTheme()` etc.) and attaches ~40 functions to `window`. "Share `js/core` with SaaS" therefore means a refactor to explicit-argument functions first, not a move. Lite keeps working through thin binding shims.
2. **Tenant isolation is probably not effective today.** `context.js` never issues `BEGIN` on `request.dbClient`, so `SET LOCAL app.current_org_id` is a no-op outside a transaction block (Postgres emits a warning and the setting does not persist). `db/client.js` reads only `DATABASE_URL`, which `.env.example` points at the `postgres` superuser (RLS bypassed); `APP_DATABASE_URL` (the NOSUPERUSER `roadmapsnap_app` role) is never read. `context.js` also queries `org_members` before any org context exists, which FORCE RLS would block for the app role. Every later feature (AI apply, import, signup) depends on fixing this first.
3. **Every new signup is made `admin` of the seed org.** `context.js` inserts `org_members(config-seed-org, admin)` for any new user if that org exists, and has a dev branch that creates a "Dev Default" org with `row_security = off`. Both must go before hosting. Migrations V7/V8/V9/V11/V12 seed real-looking program data into `config-seed-org` on every fresh database, including a compose database.
4. **The React app already shares Lite's CSS vocabulary.** `css/roadmap.css` imports `packages/tokens/components.css` (1,391 lines) and the React components use the same class names (`kpi-card`, `gantt-bar`, `data-source-row`, `group-header`...). Visual parity is therefore a *CSS-completeness + shared-logic + test* problem, not a markup-porting problem. Gaps: the `professional`, `colorful`, `blank` theme blocks live only in `css/roadmap.css` (50 `data-theme` rules), while the app only toggles `html.dark`; Tailwind `@tailwind base` preflight fights Lite's reset (the app already carries overrides in `index.css` for the progress bar).
5. **Routes are registered inside `plugins/auth.js`**, not `server.js` (`registerAuthRoutes`, `workspacesRoutes`, `projectsRoutes` are dynamically imported at the bottom of `authPlugin`). New route modules must follow or, better, this should be moved to `server.js` early so route registration is visible.
6. **There is no "groups" or "tasks" table.** Domain terms map as: task/deliverable = `projects` row; group = `projects.group_name` text plus ordering in `workspaces.settings.group_order`; milestone = `milestones(project_id, milestone_key, planned_date)` keyed to workflow keys; dependency = `dependencies(from_project_id -> to_project_id, from_milestone_key, to_milestone_key)` where `from` is the blocker/predecessor and `to` is the blocked task (matches Lite's "inbound = tasks I depend on"). The change-set vocabulary must be defined on this model.
7. **CI path filters would hide shared-code regressions.** Root `ci.yml` has `paths-ignore: packages/**`. A `packages/core` consumed by Lite would not trigger Lite CI when changed. Node 20 is also past end-of-life (April 2026); move CI and images to Node 22 or 24 LTS.

---

## Standard Architecture

### System Overview (target)

```
                            BROWSER
┌───────────────────────────────────────────────────────────────────────────┐
│  LITE (static, unchanged runtime)      SAAS SPA (React + TanStack Query)   │
│  index.html + js/app.js                packages/app                        │
│  js/ui (HTML strings)                  components/* (React, same CSS)      │
│  js/core/* = thin bindings             lib/* = DELETED (re-export core)    │
│   (inject CONFIG/theme/today)          hooks/* (queries + mutations)       │
│         │                                        │                         │
│         └───────────────┬────────────────────────┘                         │
│                         ▼ imports (pure, no DOM, no globals)               │
│        ┌────────────────────────────────────────────┐                      │
│        │ packages/core  (plain ESM JS + JSDoc + .d.ts)│  <- also imported   │
│        │ time · workflow · dependencies · stats ·     │     by packages/api │
│        │ filters · viewModel · roadmap model ·        │                      │
│        │ changeset (ops schema, applyOps, diff,       │                      │
│        │ validate) · liteConfig adapters              │                      │
│        └────────────────────────────────────────────┘                      │
│        packages/tokens: ALL theme variables + component CSS (both consume)  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ HTTPS  /api/v1/*   (Bearer Auth0 JWT, X-Org-Id)
                     ┌──────────▼───────────┐
                     │  web (nginx)          │  serves SPA, /config.js (runtime env)
                     │  /api/ -> api:4000    │  proxy_read_timeout 120s, body 10m
                     └──────────┬───────────┘
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ packages/api (Fastify 5)                                                   │
│  plugins: auth(JWT) -> tenant(tx+RLS vars) -> rbac(requireRole)           │
│                                                                            │
│  routes/        HTTP only: validate, authorize, call services              │
│   workspaces · projects · milestones · dependencies · groups               │
│   changesets (manual batch) · proposals (AI) · generate (AI)               │
│   import · orgs · invitations · usage                                      │
│                                                                            │
│  services/      domain logic, no HTTP                                      │
│   changeEngine  load snapshot -> core.applyOps -> write rows (one tx)      │
│   ai/           snapshot · prompts · claude client · extract(csv/xlsx/md)  │
│   metering/     reserve · settle · caps                                    │
│   import/       literal-only JS parser -> core.liteConfigToModel -> ops    │
│   orgs/         provisioning · invitations · mailer                        │
│                                                                            │
│  db/  withTenantTx() · migrations (schema only) · seeds (dev only)         │
└───────────────┬────────────────────────────────────────┬──────────────────┘
                │ pg (role roadmapsnap_app, NOSUPERUSER) │ HTTPS (server key)
                ▼                                        ▼
        PostgreSQL 16 (RLS + FORCE)                Anthropic Messages API
        + change_proposals, ai_usage_ledger,       (ANTHROPIC_API_KEY only in
          org_ai_quota, org_invitations             the api container)

 compose:  postgres -> migrate (one-off, owner role) -> api -> web
```

### Component Responsibilities

| Component | Responsibility | Talks to | Must NOT |
|-----------|----------------|----------|----------|
| `packages/core` | All pure roadmap rules: date math, workflow, dependencies/cycles, stats, filters, view models, roadmap model + adapters, change-set ops/reducer/diff/validation | nothing (leaf) | touch DOM, `window`, `CONFIG`, `process`, DB, network |
| `packages/tokens` | Every CSS variable per theme + all component CSS; JS palettes | consumed by Lite, app | contain logic |
| Lite `js/core/*` | Thin bindings: read `CONFIG`/theme/today, call `packages/core`, keep `window.*` for inline handlers | `packages/core`, `AppState` | hold logic (after migration) |
| Lite `js/ui/*`, `AppState` | HTML-string rendering, UI state, unchanged | Lite core bindings | change behaviour for SaaS reasons |
| `packages/app` components | React presentation of core view models using shared CSS classes; edit modals; AI proposal preview | `packages/core`, api client | re-implement rules (delete `src/lib` mirrors) |
| `plugins/tenant` (replaces `context.js`) | Authenticated user + org resolution, `withTenantTx`, RLS vars via parameterized `set_config` | Postgres | open connections outside a tx; interpolate SQL |
| `services/changeEngine` | The single write path for roadmap content: manual edits, import, AI apply all call it | core, `withTenantTx`, audit | accept ops from the client at AI-apply time (only a stored proposal id) |
| `services/ai/*` | Build snapshot + prompt, call Claude, validate, store proposal | core, metering, Anthropic SDK | hold a DB client across the LLM call |
| `services/metering` | Reserve-then-settle token ledger with hard cap | Postgres | trust client-reported usage |
| `services/import` | Parse uploaded Lite `config.js` safely, convert deterministically | core | execute uploaded JS (`eval`, `vm`, `import()`) |
| `services/orgs` | Org provisioning on first login, invitation create/accept, email | Postgres, mailer | bypass RLS with superuser/`row_security=off` |
| `web` (nginx) | Static SPA, runtime `config.js`, `/api` reverse proxy, SPA fallback | api | hold secrets |
| `migrate` job | Apply schema migrations as owner role, set app-role password from env | Postgres | run seed data in hosted environments |

---

## Decision 1: How to get a Lite-identical SaaS view

Three options were requested. **Recommendation: shared `packages/core` (A) plus React components on the shared CSS (C, mostly already true). Reject embedding Lite HTML renderers (B).**

| Criterion | A. Shared `packages/core` | B. Embed Lite `js/ui` strings in React | C. Port markup to React |
|-----------|---------------------------|-----------------------------------------|-------------------------|
| Ends logic duplication (~2,300 lines) | Yes, if mirrors are deleted | Yes (one UI too) | No (alone) |
| Multi-tenant XSS | Neutral | **Bad**: `raw()` + inline `onclick="toggleDependencyGraph('${vm.name}')"` with user-controlled names become stored XSS across users in a hosted product (flagged in CONCERNS.md) | Neutral (React escapes) |
| Editing + AI diff overlay | Compatible | **Incompatible**: full `document.body.innerHTML` re-render destroys focus, modals and React state; needs globals (`window.AppState`, `window.setDateRange`) | Compatible |
| Cost | Medium (core refactor) | Low up front, high later | Already largely done |
| Visual identity guarantee | Needs tests | Automatic but fragile | Needs tests |

**The seam that makes identity enforceable is the view model.** Move derivation into core (`buildDeliverableViewModel`, a new `buildTimelineModel`, `buildDashboardModel`) so both renderers are dumb mappers from model to markup. Then enforce parity with tests rather than hope.

### Core package design

- **Plain ESM JavaScript with JSDoc, plus generated `.d.ts`** (`tsc --allowJs --declaration --emitDeclarationOnly`). Not TypeScript source: the API runs `node src/server.js` with no build step and Lite CI is on a Node version without type stripping; plain JS imports everywhere with zero toolchain. The app gets types from the `.d.ts`; `tsc --noEmit` in app-ci keeps checking.
- **Zero runtime dependencies.** Lite then needs no `npm install` for core (relative import `../packages/core/src/...`, bundled by Lite's existing Vite build). The API and app consume it as `"@roadmapsnap/core": "file:../core"`, the same pattern as `@roadmapsnap/tokens`. Defer npm workspaces; per-package lockfiles are an existing convention and a workspace migration is a separate risk.
- **Explicit arguments, no globals.** `generateMonths(timeline)`, `calculateStats({deliverables, workflow, today, config})`, `resolveStateColor(key, workflow, palette)`. Theme palettes move to `@roadmapsnap/tokens/tokens.js`; core receives a palette, never reads `document`.
- **Date handling:** Lite uses `DD/MM/YYYY` strings; the DB stores `DATE`; the API returns formatted strings (`formatPlannedDate`). Core owns one canonical parse/format and the API/app/Lite all use it. This is the drift-prone area named in CONCERNS.md; give it fixture tests first.
- **Roadmap model.** One neutral shape: `{ workflow, groups[], deliverables[{id?, name, group, atRisk, descoped, showInTimeline, tags, link, milestones{key:date}, dependencies[{task, from?, to?}]}], timeline{start,end,today?}, labels, text }`. Adapters live in core: `fromLiteConfig(CONFIG)`, `fromApi(workspace, projects)`, `toApiRows(model)`. Lite's `CONFIG` is already this shape.

### Migration approach: strangler, module by module

Each step keeps `npm test` (Lite), `validate` and `build` green:

1. Create `packages/core`; move `tests/core/*` cases to run against it (keep root tests importing `js/core` until bindings exist).
2. Per module (timeline, workflow, dependencies, stats, viewModel): extract pure function with explicit args into core; rewrite the `js/core/<m>.js` file as a binding that calls it with `CONFIG`; keep the `window.*` assignments there (inline handlers still need them; that debt is separate).
3. Port `packages/app/src/lib/*` call sites to core, then delete the mirrors. Add a cross-check test while both exist: same fixtures through both, assert equal.
4. Update `docs/monorepo.md` ("no changes to js/ for SaaS" is superseded by PROJECT.md), AGENTS.md ("fix in both" becomes "logic lives in `packages/core`; `js/core` is binding only"), and CI path filters (below).

CI: root `ci.yml` must also run on `packages/core/**`; `api-ci.yml` and `app-ci.yml` must also trigger on `packages/core/**`; add `packages/core` unit tests to root CI (zero deps, fast). Alternatively a `core-ci.yml`. Bump Node to 22/24.

### Visual-identity enforcement

- Move **all** theme variable blocks (`professional`, `colorful`, `blank`, plus existing) from `css/roadmap.css` into `packages/tokens/tokens.css`; the app switches theme via `data-theme` on `<html>` (Lite's mechanism) instead of the `.dark` class, mapping `light` to the default. Keep `dark` working through the same attribute.
- Resolve Tailwind preflight conflicts deliberately: scope Tailwind utilities to app-only chrome (shell, forms, modals) and either disable preflight or scope Lite component CSS above it. The ad-hoc `#root .progress-bar-container` overrides in `index.css` are the symptom.
- **Golden-markup parity test** (highest value, cheapest): render one fixture (`tests/fixtures/config.complex.js`) through Lite `js/ui` (jsdom) and through the React tree (`renderToStaticMarkup`); normalize attributes/whitespace and compare class sets per structural node. Add Playwright screenshot diffs for 2 themes once the stack runs in compose. Lite UI has no tests today (CONCERNS.md), so this also closes that gap.
- Dependency arrow path routing (308 vs 319 lines of mostly geometry) is the remaining large duplicate. Extract the pure "rects -> path" function into core later; DOM measuring stays per renderer. Defer unless drift appears.

---

## Decision 2: One change-set engine for all writes

The AI edit pipeline, manual editing, Lite import and AI generation all produce the same thing: a typed list of operations on the roadmap. **Build one engine and make every write path call it.** Manual CRUD endpoints become thin wrappers over a one-op change set, so validation, auditing and RLS are identical for humans and AI (a stated PROJECT.md constraint).

### Op vocabulary (v1, on the existing schema)

```
task.create      { ref, name, group?, atRisk?, descoped?, showInTimeline?, tags?, link?, milestones? }
task.update      { id, patch{ name?, group?, atRisk?, descoped?, showInTimeline?, tags?, link? } }
task.delete      { id }
milestone.set    { taskId|ref, key, date|null }
dependency.add   { from: id|ref, to: id|ref, fromMilestone?, toMilestone? }
dependency.remove{ from, to }
group.rename     { from, to }
group.reorder    { order[] }
```

Out of v1: workflow editing, risks/budget/KPI tables, programs. Entities created within the same set are referenced by client-chosen `ref` (e.g. "add a task with a dependency on A, B, C" is `task.create` + 3 `dependency.add` using the new `ref`). Existing entities are referenced by id.

### Layering (this is the key structural decision)

```
ops (JSON)  --core.applyOps(model, ops)-->  { nextModel, resolved[], diff, errors[] }   PURE, in core
                                                    │
                       ┌────────────────────────────┴───────────────┐
                       ▼                                            ▼
          browser: render preview/diff               api: changeEngine writes `resolved`
          (ghost bars from nextModel)                rows inside one tx (dumb persistence)
```

- `applyOps` is the only place ops are interpreted: resolves refs, checks ids exist, enforces invariants (unique task names per workspace, valid workflow milestone keys, date ordering vs workflow order, no self/duplicate dependencies, **no dependency cycles** via the same graph code Lite uses, group existence), and yields concrete row-level mutations plus a human-readable diff with before/after values.
- The SQL writer persists the **resolved** mutations; it does not re-interpret ops. This keeps semantics in one pure, heavily testable function that runs identically in API (authoritative) and browser (preview).
- A `diffHash` (stable hash of `resolved`) ties preview to apply.

### Apply algorithm (transactional, race-safe)

```
withTenantTx:
  BEGIN; set_config(org, user)            -- parameterized, in-tx
  SELECT ... FROM workspaces WHERE id=$1 FOR UPDATE      -- serialize applies per workspace
  load snapshot (projects, milestones, dependencies)
  load proposal (status='pending', org via RLS)
  r = core.applyOps(snapshot, proposal.ops)
  if r.errors or hash(r.resolved) != proposal.diff_hash -> ROLLBACK, 409 STALE_PROPOSAL
  write r.resolved (INSERT/UPDATE/DELETE) ; bump workspace revision ; audit
  UPDATE change_proposals SET status='applied', applied_by, applied_at
  COMMIT
```

"Confirm exactly what you previewed, or fail loudly" avoids per-entity timestamp bookkeeping and works when other editors changed unrelated rows (hash only covers affected rows' before-state). On `STALE_PROPOSAL`, the UI offers "regenerate". The apply endpoint takes **only a proposal id**; ops are never re-submitted by the client. Optional later: accept a subset of op ids to apply selectively.

The existing `audit_trigger_function` already records row changes with `app.current_user_id`; stamp the proposal id into `app.current_proposal_id` (extra `set_config`) so audit rows link back to the AI proposal. Verify the trigger runs for the app role.

---

## Decision 3: AI pipeline (edit and generation)

### Shape

Edit and generation share one service, `ProposalService.propose(kind, input)`:

```
POST /api/v1/workspaces/:id/proposals        { prompt }                         (kind=edit)
POST /api/v1/generate                        { prompt | text | file(multipart) } (kind=generate)
GET  /api/v1/proposals/:id                   -> { status, ops, diff, summary, usage }
POST /api/v1/proposals/:id/apply             (editor+)  -> 200 | 409 STALE_PROPOSAL | 422
POST /api/v1/proposals/:id/reject
```

Pipeline for one proposal, **three short transactions around one no-DB LLM call**:

```
 TX1 (short):  auth + role(editor) · load snapshot · reserve quota (ledger row 'reserved') · COMMIT
 ---- no DB client held ----
 CALL:         build prompt from snapshot · Claude (streaming, max_tokens bounded) · parse tool input
               ajv-validate vs ops schema · core.applyOps(snapshot, ops) dry-run
               on validation failure: ONE repair round-trip with the error list, then fail
 TX2 (short):  INSERT change_proposals(pending, ops, diff, diff_hash, ...) · settle ledger with
               real usage (input/output/cache tokens) · COMMIT
 respond:      proposal id + diff
```

Reasons: the current `setRequestContext` holds a pooled client for the whole request (CONCERNS.md pool exhaustion); an LLM call is 5-60 s. AI routes must not use a request-scoped client; they use `withTenantTx` per phase. Ledger settlement runs in `finally` so a failed or refused call still records actual spend; crashed calls leave an expiring `reserved` row (see metering).

### Claude integration specifics (current API, from the claude-api reference)

- Official `@anthropic-ai/sdk`; key only in the `api` container env; never forwarded to web or migrate.
- Model is an env var (`AI_MODEL`); start with `claude-opus-5-5` (current default) for generation and evaluate `claude-sonnet-5-5` for edits against a small eval set (cheaper per token, which directly stretches the org cap). Do not append date suffixes.
- **Forced `tool_choice` returns 400 on Opus 5.5, Sonnet 5.5 and Fable models.** The brief says "tool-use producing a typed change set"; implement it as one client tool `propose_changes` with `strict: true` and `tool_choice: auto`, with the system prompt requiring exactly one call, or use structured outputs (`output_config.format`) with the ops JSON schema. If `stop_reason` is not `tool_use` (model asks a clarifying question or declines), return that text as a `needs_clarification` result with no proposal. No assistant prefill, no `temperature`/`top_p`.
- Thinking cannot be disabled on Opus 5.5 and thinking tokens bill as output: set `output_config.effort` to `low` or `medium` for edit ops, keep `max_tokens` an explicit bound (this bound is also the reservation upper bound).
- Handle `stop_reason: "refusal"` (check before reading content) and consider the server-side `fallbacks` option the reference recommends for these models. Stream (`client.messages.stream(...).finalMessage()`) for generation (long outputs).
- Prompt caching: system prompt + tool schema + the workspace snapshot are the stable prefix; put the user's instruction last. Verify with `usage.cache_read_input_tokens`; meter cache read/creation tokens separately.
- Snapshot given to the model uses **short ids** (`T1..Tn`, `G1..`) with a server-side map back to UUIDs: fewer tokens, no hallucinated UUIDs, and ops referencing unknown short ids are rejected by `applyOps`. Include workflow keys, group list, and today's date from the server.
- Large workspaces: cap snapshot size (reject or truncate to scoped groups with an explicit message); never silently truncate.

### Generation specifics

- Target is a **new workspace**: `change_proposals.workspace_id` is NULL and `new_workspace` JSONB holds `{name, workflow}`; `applyOps` runs against an empty model with the default workflow (shared core constant derived from `config_base.js`'s workflow). Apply creates the workspace and all rows in one tx; preview renders the timeline from `applyOps(empty, ops)`. This keeps "nothing saved until confirmed" true for generation as well.
- Inputs: prompt, pasted text, or file. Extraction is server-side and deterministic before the LLM sees it: CSV and markdown read as text; XLSX parsed with a maintained library to CSV text. `@fastify/multipart` with hard limits (size, file count, mime/extension allowlist). Reject over-limit input with a clear error; do not truncate.
- **Prompt injection:** uploaded documents are untrusted. Wrap in delimited blocks stated as data; the model has no tools other than `propose_changes`; output is constrained by the ops schema, scoped to one workspace, previewed and confirmed, and applied under the caller's RLS and role. That containment is the control; do not rely on prompt wording.

### Proposal storage (new tables, standard `org_id` + RLS + FORCE RLS pattern)

`change_proposals(id, org_id, workspace_id NULL, new_workspace JSONB NULL, kind, status[pending|applied|rejected|expired|failed], prompt, ops JSONB, diff JSONB, diff_hash, summary, model, created_by, created_at, applied_by, applied_at, expires_at)`

Proposals expire (e.g. 24 h) and are single-use. Prompt text is stored (needed for audit and re-display); document the retention and consider truncating uploaded-document content from storage.

---

## Decision 4: Per-org AI metering with a hard cap

One shared key pays for everyone, so enforcement must be race-safe and must not depend on the LLM call succeeding.

- **`ai_usage_ledger`** (append-only truth): `id, org_id, user_id, proposal_id, kind, model, status[reserved|settled|failed], est_tokens, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_units, period (YYYY-MM), created_at, expires_at`.
- **`org_ai_quota`** (one row per org): `org_id PK, monthly_cap_units, plan override`. Default cap from env `AI_MONTHLY_CAP_UNITS`, overridable per org row.
- **Reserve** in TX1: `SELECT ... FROM org_ai_quota WHERE org_id=$1 FOR UPDATE` (serializes concurrent requests per org), `sum(settled) + sum(open reservations not expired)` for the period; if `+ estimate > cap` return **429 `AI_QUOTA_EXCEEDED`** with remaining units; otherwise insert a `reserved` row. Estimate = input via `messages.countTokens` (or a conservative length-based fallback) + the request's `max_tokens` (worst case, includes thinking).
- **Settle** in TX2/`finally`: set actual token counts from `response.usage`, convert to `cost_units` with a price table in code (input, output, cache read, cache write by model), status `settled` (or `failed` with whatever usage was reported).
- A crashed process leaves a `reserved` row whose `expires_at` (a few minutes) makes it stop counting; no counter to repair, no leak.
- Meter units, not dollars-in-the-schema: store raw tokens per category and compute cost in code so price changes do not rewrite history.
- Additional guards, not substitutes: per-user rate limit on AI routes (`@fastify/rate-limit`, also a CONCERNS.md recommendation), max pending proposals per workspace, request body/file size limits, and a `GET /usage` endpoint (admin) showing period consumption.
- RLS: ledger and quota carry `org_id` and the standard policy. The quota row is created at org provisioning.

---

## Decision 5: Lite config import

- Input is a Lite `js/config.js`: `const CONFIG = {...}`, i.e. **executable JavaScript uploaded by a user. Never `eval`, `new Function`, `vm`, or dynamic `import()` it** (RCE on the API server; self-XSS with the Auth0 token if done in the browser; `vm` is not a security boundary).
- Parse server-side with an AST parser (acorn) and a **literal-only evaluator**: accept object/array/string/number/boolean/null, template literals without expressions, unary minus; reject identifiers, calls, spreads, functions. Also accept `.json`. Reuse `schema/config.schema.json` (ajv) plus the Lite `validateConfig` (now in core) for validation and error messages.
- `core.fromLiteConfig(config)` -> roadmap model -> `core.modelToOps(model)` (deterministic create ops) -> same preview/apply path as AI generation (but no LLM, no metering, no proposal expiry pressure). Import is therefore "generate without Claude", and shares `target: new_workspace`.
- Also the right moment to replace the one-off `scripts/generate-config-seed.mjs` generator and retire the seed SQL migrations (see compose).
- Lite `CONFIG` can contain `WORKFLOW`, `ENTITY_LABELS`, `DASHBOARD_TEXT`, `NON_FILTERABLE_GROUPS`, `GROUP_ORDER`, `TIMELINE`; map them to `workspaces.workflow_definition / entity_labels / dashboard_text / settings` exactly as V7/V9/V12 already do (those migrations are the reference mapping).
- Round trip fidelity matters for trust: add a test `fromApi(toApiRows(fromLiteConfig(cfg)))` equals the original model on `tests/fixtures/config.complex.js`.

---

## Decision 6: Tenant context, signup provisioning and invites

### Fix the tenant context first (blocks everything)

Replace `setRequestContext` with a `tenant` plugin exposing `request.withTenantTx(fn)` (and the same for normal routes so `request.dbClient` is a tx-scoped client for the duration of a short handler):

```js
// sketch
async function withTenantTx(pool, { userId, orgId }, fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_user_id', $1, true), set_config('app.current_org_id', $2, true)", [userId, orgId]);
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
```

- `set_config(..., true)` with bind parameters removes the `SET LOCAL` string interpolation flagged in CONCERNS.md.
- The API connects as `roadmapsnap_app` (use `APP_DATABASE_URL`), never the owner. Assert at startup that `current_setting('is_superuser')` is `off` and `rolbypassrls` is false; fail boot otherwise.
- AGENTS.md rule "handlers use `request.dbClient`" becomes "handlers use `request.withTenantTx` / the tx-scoped client; never `pool`"; AI routes must use `withTenantTx` per phase.
- Add the missing RLS tests listed in CONCERNS.md (cross-tenant write with mismatched `X-Org-Id`, run as the app role) before building on top.

### Two-stage context resolution (membership lookup before an org is known)

1. Look up `users` by `auth0_id` (no RLS on `users`).
2. Set `app.current_user_id` in-tx; add to `org_members` an additional SELECT policy `user_id = current_setting('app.current_user_id')::uuid` so a user can list their own memberships with no org context.
3. Choose org (header `X-Org-Id` if a member, else first membership), then set `app.current_org_id`. Stop trusting `?orgId` query; require the header. Remove the seed-org auto-join and the `row_security = off` dev branch.

### Signup provisioning (no RLS bypass needed)

First authenticated request with no membership: generate the org UUID in the app, `set_config('app.current_org_id', newId)` in the tx, then `INSERT organizations` (the existing `id = current_org_id` policy accepts it), `INSERT org_members(admin)`, create `org_ai_quota`, optionally a starter empty workspace. All in one tx, idempotent via `ON CONFLICT`. Provision by explicit `POST /orgs` (or lazily on `GET /auth/me` when there is no membership) rather than implicitly on every request.

Auth0 detail to verify early: `users.email` is `NOT NULL UNIQUE`, but `context.js` takes `request.user.email` from the access token, and Auth0 access tokens do not carry email by default. Add an Auth0 Action to put a namespaced email/name claim on the access token, or fall back to `/userinfo`. Reject provisioning if no verified email.

### Invitations

`org_invitations(id, org_id, email, role, token_hash, invited_by, expires_at, accepted_at)` with the standard `org_id` policy plus an accept-path policy `token_hash = current_setting('app.invite_token_hash', true)` that the accept route sets for that one transaction (so the invitee, who is not yet a member, can read exactly that row). Accept requires a signed-in user whose verified email matches the invite; the tx inserts `org_members` under the invite's org context. Store only a hash of the token; short expiry; single use; admins only to create; roles validated against `viewer|editor|admin`. Email via a pluggable mailer (SMTP/Resend/SES), with a log-only driver for dev and compose. Auth0's own Organizations/invitation feature is an alternative, but the app-owned table keeps roles and RLS in one place and avoids a hard Auth0 plan dependency. This design is MEDIUM confidence; schedule a half-day spike to confirm the policy approach under FORCE RLS before committing the phase plan.

---

## Decision 7: Docker compose topology

```
services:
  postgres   image postgres:16, volume, healthcheck pg_isready
  migrate    api image, command "node src/db/migrate.js", env DATABASE_URL (owner role),
             APP_DB_PASSWORD; depends_on postgres: service_healthy; restart: "no"
  api        api image, env APP_DATABASE_URL (roadmapsnap_app), AUTH0_*, ANTHROPIC_API_KEY,
             AI_*, CORS_ORIGIN; depends_on migrate: service_completed_successfully; healthcheck /health
  web        nginx image (SPA build); depends_on api healthy; publishes 80/443
```

Points that are easy to get wrong:

- **Two images, repo-root build context.** `packages/api` and `packages/app` both depend on `file:../core` and `file:../tokens`, so Dockerfiles are `-f packages/api/Dockerfile .` with multi-stage builds that copy `packages/core` and `packages/tokens` before `npm ci`. Alpine Node 22/24 LTS; `npm ci --omit=dev` for api.
- **Runtime config for the SPA, not build-time.** `VITE_AUTH0_*` are baked at build time, which would force an image per environment and defeat "each image scales independently". nginx entrypoint renders `/config.js` (`window.__RS_CONFIG__ = {...}`) from env at container start; the app reads it before `Auth0Provider`. One image, any environment.
- **Roles.** `migrate` runs as the owner/superuser role; `api` runs only as `roadmapsnap_app`. V4 hard-codes `PASSWORD 'apppassword'`; never edit applied migrations; instead the migrate runner finishes with `ALTER ROLE roadmapsnap_app PASSWORD <env>` (via `format(... %L)` in a `DO` block, parameter-safe) and the compose `.env.example` documents `APP_DB_PASSWORD`. The api must switch from `DATABASE_URL` to `APP_DATABASE_URL`.
- **Seed data must not ship.** V7, V8, V9, V10 (index + seed), V11, V12 insert the author's program data into a `config-seed-org` and make every user its admin. For fresh/hosted installs, split schema migrations from dev seeds: new `seeds/` folder run only by an explicit `npm run seed` / `MIGRATE_SEEDS=1`; because applied migrations are immutable, handle existing dev DBs by marking seed versions applied and making fresh installs skip them (add a `V13` that is a no-op marker plus move files, or teach the runner to skip a listed set). Extract V10's index into a schema migration. The migration README must be updated.
- **nginx.** `location /api/ { proxy_pass http://api:4000; }` (API routes already carry the `/api/v1` prefix, no rewrite; `/auth/me` currently lives outside `/api`, so either add `location /auth/` or, better, move it to `/api/v1/auth/me` in the same change). `try_files $uri /index.html` for the SPA; `proxy_read_timeout 120s` (AI calls); `client_max_body_size 10m` (uploads); forward `X-Forwarded-*`; set Fastify `trustProxy` so rate limiting sees client IPs. With a single origin CORS is unnecessary; keep `CORS_ORIGIN` for dev and refuse `*` in production.
- **Secrets scope.** `ANTHROPIC_API_KEY` and DB passwords only in the api (and migrate for the owner URL). `.env` is gitignored; commit `.env.example` only.
- **Pool sizing / timeouts.** Set explicit `pg` pool `max` and statement/idle timeouts; with request-long clients gone (short txs), a small pool serves far more traffic.
- **Smoke test in CI.** `docker compose config`, then `up --wait`, `curl /api/health` through nginx, run migrations twice (idempotence), assert zero `config-seed-org` rows. Start this skeleton early (after the tenant fix) so every later phase is exercised in the real topology.

---

## Recommended Project Structure

```
packages/
├── core/                          # NEW. zero-dependency ESM JS + JSDoc, generated .d.ts
│   ├── src/
│   │   ├── time/                  # parse/format DD/MM/YYYY, months, position, zoom
│   │   ├── workflow/              # states, milestones, current status
│   │   ├── dependencies/          # normalize, graph, cycles, red/blocked sets
│   │   ├── stats/                 # KPI/upcoming
│   │   ├── filters/               # filtering + sorting (from app lib)
│   │   ├── viewmodel/             # deliverable/timeline/dashboard models (theme-agnostic)
│   │   ├── model/                 # roadmap model, fromLiteConfig, fromApi, toApiRows
│   │   ├── changes/               # ops.schema.json, applyOps, diff, validateModel, modelToOps
│   │   └── index.js
│   ├── tests/                     # node:test; Lite's tests/core cases move here
│   └── package.json               # "exports", "types"
├── tokens/                        # + every theme's variables
├── api/src/
│   ├── plugins/ auth.js tenant.js rbac.js     # tenant.js replaces context.js
│   ├── routes/  ...existing + milestones, dependencies, groups, changesets, proposals,
│   │            generate, import, orgs, invitations, usage
│   ├── services/ changeEngine/ ai/ metering/ import/ orgs/
│   ├── db/      client.js migrate.js migrations/ (schema only) seeds/ (dev only)
│   └── server.js                  # registers routes explicitly (move out of auth.js)
└── app/src/
    ├── components/ (timeline, dashboard, edit/, ai/ ProposalPreview, orgs/ Members)
    ├── hooks/ (queries + useApplyProposal, useGenerate ...)
    └── lib/       # shrinks to UI-only helpers (theme storage, export wiring)
js/core/*          # bindings only after migration
```

Rationale: `services/` separates domain logic from HTTP routes (today handlers contain SQL and rules inline); `core/changes` makes op semantics testable without a database; `seeds/` separates dev data from schema.

---

## Architectural Patterns

### Pattern 1: Pure core with injected environment
**What:** Functions take `config`, `workflow`, `today`, `palette` explicitly; adapters inject globals per host.
**When:** Anything shared between Lite, app and API.
**Trade-off:** Wider signatures; one-time refactor of ~1,000 Lite lines; eliminates window/DOM coupling.

### Pattern 2: Resolve-then-persist change sets
**What:** Ops are interpreted by one pure reducer; persistence writes resolved mutations; apply recomputes under lock and compares `diffHash`.
**When:** All roadmap writes.
**Trade-off:** Reducer must model every op's effect (more up-front work than SQL per endpoint); removes preview/apply drift and gives one validation path.

```js
const r = applyOps(snapshotModel, ops);            // pure
if (r.errors.length) return reply.code(422).send(r);
const hash = diffHash(r.resolved);                  // stable JSON hash
```

### Pattern 3: Short transactions around slow external calls
**What:** Reserve (tx) -> LLM call (no DB) -> persist/settle (tx).
**When:** Any Claude call, email send, file parse.
**Trade-off:** More code than "one request, one client"; prevents pool exhaustion and long-held row locks.

### Pattern 4: Reserve-then-settle metering with an expiring reservation
**What:** Lock quota row, count settled plus live reservations, insert reservation, settle with real usage.
**Trade-off:** Slight over-reservation (max_tokens) until settled; exact cap enforcement under concurrency.

### Pattern 5: Tenant context as the transaction boundary
**What:** `BEGIN` + parameterized `set_config(..., true)` wraps every unit of DB work.
**Trade-off:** Every DB path must go through the helper; makes RLS actually effective and testable.

---

## Data Flow

### Manual edit (vertical slice that de-risks AI)

```
EditModal -> useMutation -> POST /workspaces/:id/changesets {ops:[task.update...]}
  -> auth -> tenant(role editor) -> changeEngine.apply(ops)  [applyOps -> write -> audit]
  -> 200 -> invalidate ['workspace', id] -> TanStack refetch -> core view models -> CSS classes
```

### AI edit

```
Prompt box -> POST /proposals -> reserve -> Claude (propose_changes) -> validate+dry-run ->
store pending -> {proposalId, diff}
Preview UI: core.applyOps(localSnapshot, ops) draws ghost bars + diff list (same function as server)
Confirm -> POST /proposals/:id/apply -> tx: lock, re-resolve, hash match -> write -> applied
Mismatch -> 409 STALE_PROPOSAL -> "roadmap changed, regenerate"
```

### Lite import

```
upload config.js -> POST /import/lite (multipart) -> literal-only parse -> validateConfig (core)
 -> fromLiteConfig -> modelToOps -> proposal(kind=import, target=new_workspace, no LLM)
 -> preview -> apply (creates workspace + rows in one tx)
```

### Signup and invite

```
Auth0 signup -> SPA callback -> GET /auth/me -> no membership -> POST /orgs (provision under new org ctx)
Admin: POST /orgs/:id/invitations -> token hash stored, email sent
Invitee: Auth0 login -> POST /invitations/accept {token} -> tx sets invite-token var -> org_members insert
```

### State management

Server state is TanStack Query keyed by workspace; proposals are fetched resources, not client state. Lite's `AppState` is unchanged. UI filter/zoom/sort state stays local to the page component, fed into core filter functions.

---

## Build Order and Dependencies

```
 [1] Tenant tx + RLS truth ──────────────┬──────────────────────────────┐
 [2] packages/core extraction + CI ──┐   │                              │
 [2b] compose skeleton (parallel) ───┤   │                              │
 [3] View parity (themes, parity     │   │                              │
     tests, delete app/lib) ◄────────┘   │                              │
 [4] Change engine + manual editing ◄────┘ (needs 1, 2)                 │
 [5] Lite import (needs 2, 4) ──────────────────────────┐              │
 [6] Signup + org provisioning + invites (needs 1) ─────┤ (parallel w/ 3-5)
 [7] AI metering + AI edit (needs 1, 4, 6-org quota) ◄──┘◄─────────────┘
 [8] AI generation (needs 7, 5's new_workspace path)
 [9] Compose finalize: runtime config, smoke e2e, hosted hardening
```

| Phase | Delivers | Why this position |
|-------|----------|-------------------|
| 1. Tenant foundation | `withTenantTx`, parameterized `set_config`, app-role connection, two-stage org resolve, remove seed-org auto-join/dev bypass, move route registration to `server.js`, RLS cross-tenant tests, migration/seed split | Everything multi-tenant or transactional depends on it; currently probably unenforced |
| 2. Shared core | `packages/core`, strangler migration of timeline/workflow/dependencies/stats/viewModel, CI path + Node fixes | Needed by view parity, change engine (invariants), import adapters, API validation |
| 2b. Compose skeleton | Dockerfiles (api, web), compose with postgres/migrate/api/web, healthchecks, CI smoke | Pulls the Docker-context and role issues forward; cheap, parallel |
| 3. View parity | Themes into tokens, `data-theme` in app, Tailwind scoping, golden-markup test, delete `app/src/lib` mirrors | Core value; independent of AI |
| 4. Change engine + manual editing | Ops schema, `applyOps`, writer, endpoints for tasks/milestones/dependencies/groups, edit UI | Proves the engine with humans before AI; produces the diff UI AI will reuse |
| 5. Lite import | Literal-only parser, adapters, import UI | Reuses 4; gives realistic data; no AI dependency |
| 6. Signup + invites | Provisioning, invitations, mailer, members UI, Auth0 email claim | Needed before hosting and before per-org quotas are meaningful; can run alongside 3-5 |
| 7. AI metering + edit | Ledger/quota, Claude client, snapshot/prompt, proposals, preview/confirm UI | Highest-risk feature; build after engine and tenancy are solid; metering ships in the same phase as the first Claude call, never after |
| 8. AI generation | Multipart/file extraction, new-workspace target, generation prompt | Extends 7 and 5 |
| 9. Hosted hardening | Runtime SPA config, rate limits, helmet, structured logging, pagination, smoke e2e | Last mile for "docker compose up" |

---

## Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| 0-1k users / tens of orgs | One api container, one Postgres; synchronous AI calls; polling not needed |
| 1k-10k users | Explicit pool `max`, pagination on list endpoints, index on `ai_usage_ledger(org_id, period)`, run 2+ api replicas behind nginx (stateless; proposals and quota live in DB) |
| 10k+ | Move AI to a queue/worker with SSE or polling for progress; read replica for dashboards; partition `audit_events` and ledger by month |

**First bottleneck:** the pooled client held for a whole request (fixed structurally by short transactions). **Second:** large workspaces rendering and dependency-arrow computation in the browser (virtualize rows; later extract path routing to core and cache). **Third:** AI latency through proxies with ~100 s idle timeouts; switch to streaming progress (SSE) before moving to a queue.

---

## Anti-Patterns

### Anti-Pattern 1: Executing uploaded `config.js`
**What people do:** `eval`/`vm`/`import()` the file to get `CONFIG`.
**Why it's wrong:** Remote code execution on the API or script execution in the user's origin.
**Do this instead:** AST literal-only evaluator; JSON also accepted.

### Anti-Pattern 2: Holding a DB client across the Claude call
**What people do:** Use `request.dbClient` for the entire request.
**Why it's wrong:** 5-60 s holds exhaust the pool; long-held locks.
**Do this instead:** Short reserve and persist transactions around a DB-free call.

### Anti-Pattern 3: Trusting the model's ids and client-submitted ops at apply time
**What people do:** Apply whatever ops the browser POSTs, using raw UUIDs from the model.
**Why it's wrong:** Tampering and hallucinated ids; bypasses the preview contract.
**Do this instead:** Apply by proposal id only; short ids in prompts; `applyOps` rejects unknown refs.

### Anti-Pattern 4: Separate semantics per write path
**What people do:** SQL in each endpoint, different rules for AI vs manual.
**Why it's wrong:** The AI path then gets validation the manual path lacks, or vice versa; cycle/date rules drift.
**Do this instead:** Everything through `changeEngine`.

### Anti-Pattern 5: Embedding Lite's HTML renderers in React
**What people do:** `dangerouslySetInnerHTML` of `js/ui` output for "free" visual identity.
**Why it's wrong:** Stored XSS surface across tenants, global handlers, lost React state during full re-render.
**Do this instead:** React components on the shared CSS driven by shared view models, with parity tests.

### Anti-Pattern 6: Bypassing RLS for provisioning
**What people do:** `row_security = off` or a superuser pool for org creation/invites.
**Why it's wrong:** One bug away from cross-tenant access; already present in `context.js`'s dev branch.
**Do this instead:** Provision under the new org's own context; invite accept via a token-scoped policy.

### Anti-Pattern 7: Build-time SPA configuration
**What people do:** Bake `VITE_AUTH0_*` into the image.
**Why it's wrong:** One image per environment; defeats independent scaling/promotion.
**Do this instead:** Runtime `/config.js` rendered by the nginx entrypoint.

---

## Integration Points

### External Services

| Service | Pattern | Notes |
|---------|---------|-------|
| Anthropic Messages API | Server-only SDK client in `services/ai`; `propose_changes` tool (`strict: true`, `tool_choice: auto`) or structured outputs; streaming for long outputs; `countTokens` for estimates | Key in env of `api` only; handle `refusal`; no forced tool choice on current models; usage fields feed the ledger |
| Auth0 | Existing JWKS verification; add email/name claim via Action; Universal Login signup | Provisioning depends on verified email being present |
| Email provider | `mailer` interface (SMTP/Resend/SES) + log driver | Needed for invites only |
| PostgreSQL | `roadmapsnap_app` NOSUPERUSER with FORCE RLS; owner role only for migrate | Boot-time assertion that the app role cannot bypass RLS |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Lite `js/core` <-> `packages/core` | ES import (relative) | Bindings inject `CONFIG`/theme/today; keep `window.*` for inline handlers |
| `packages/app` <-> `packages/core` | `file:` dep + generated types | Delete `src/lib` mirrors after parity tests pass |
| `packages/api` <-> `packages/core` | `file:` dep | Shared invariants and `applyOps` run on the authoritative side |
| routes <-> services | direct function calls | Routes validate and authorize, services own logic and transactions |
| services/ai <-> services/metering | direct; separate transactions | Reserve before the call, settle in `finally` |
| web <-> api | `/api/` reverse proxy, same origin | Long timeout for AI routes only if needed |
| migrate <-> api | compose ordering (`service_completed_successfully`) | Different DB roles |

---

## Sources

- Repository source read for this document: `js/app.js`, `js/core/{timeline,dependencies,stats,viewModel,workflow}.js`, `js/ui/renderer.js`, `css/roadmap.css`, `packages/api/src/{server.js,plugins/*,routes/*,db/*}`, migrations V1-V12, `packages/app/src/{pages,components,lib,api}`, `packages/tokens/*`, `.github/workflows/ci.yml`, `docs/monorepo.md` (HIGH)
- `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONCERNS}.md` (HIGH)
- Claude API reference bundled with the claude-api skill (cached 2026-11-03): current model IDs, forced `tool_choice` removal on Opus 5.5/Sonnet 5.5/Fable, `strict` tool use, structured outputs via `output_config.format`, adaptive thinking and effort, usage/cache fields, `countTokens`, refusal handling and `fallbacks` (MEDIUM-HIGH: taken from reference, not exercised in this repo)
- PostgreSQL behaviour of `SET LOCAL` outside a transaction block, `set_config(name, value, is_local)`, FORCE ROW LEVEL SECURITY applying to table owners but not superusers/BYPASSRLS roles (HIGH: standard documented behaviour)
- Node 20 end-of-life April 2026 (MEDIUM-HIGH: from release schedule knowledge, verify when pinning images)

---
*Architecture research for: multi-tenant roadmap / PMO governance SaaS (RoadmapSnap)*
*Researched: 2026-11-18*
