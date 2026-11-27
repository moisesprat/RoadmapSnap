# Stack Research

**Domain:** Multi-tenant roadmap / PMO governance SaaS (RoadmapSnap), subsequent milestone: AI roadmap authoring, shared Lite logic, docker compose deploy, self-serve signup + invites, Lite config import, file-upload parsing
**Researched:** 2026-11-18
**Confidence:** HIGH on versions and library choices (verified against the npm registry, Docker Hub, the Node release schedule, and a local prototype); MEDIUM on Node 26 as the image base, on Auth0 plan limits, and on the Playwright parity approach (flagged inline)

Scope: additions and upgrades only. The existing stack (Fastify 5, pg, jose/Auth0, React 18, TanStack Query, Vite, Tailwind 3, vanilla-ES Lite, `@roadmapsnap/tokens`) is kept as-is; this file does not re-research it.

All versions below were read from the npm registry on 2026-11-18 (`npm view`), not from memory.

## Recommended Stack

### Core Technologies (new runtime dependencies)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@anthropic-ai/sdk` | `^1.10.0` (latest 1.10.0; peer `zod ^3.25 \|\| ^4`) | Claude calls from `packages/api` only | Official SDK. It is now 1.x, so any 0.x snippet from memory is stale. Verified locally: `client.messages.parse()`, `client.messages.stream().finalMessage()` (carries `parsed_output`) and `@anthropic-ai/sdk/helpers/zod` (`zodOutputFormat`) all exist in 1.10.0. Typed errors (`Anthropic.RateLimitError`, etc.), built-in retries (`maxRetries` default 2). | HIGH |
| `zod` | `^4.6.7` | Single source of truth for the AI `ChangeSet` schema and for validating model output server-side | Works with the SDK's `zodOutputFormat` helper (converts to the JSON schema for `output_config.format`) and gives `safeParse` for the second validation pass. Fastify route validation stays on native JSON Schema (existing pattern); zod is used only for AI payloads. | HIGH |
| `@fastify/multipart` | `^10.1.9` | File upload (CSV/XLSX/MD/`config.js`) | Official Fastify plugin, current major. Streams by default; `request.file({ limits })` + `toBuffer()` throws `RequestFileTooLargeError` on overrun. Note the docs warn `bodyLimit` is not an aggregate cap, so set `limits.fileSize`, `files`, `fields`, `parts` explicitly. | HIGH |
| `@fastify/rate-limit` | `^11.2.2` | Coarse per-IP/per-user HTTP throttling (abuse guard) | Official; in-memory store by default, `keyGenerator` and `hook: 'preHandler'` options let you key by org/user after auth. Redis only needed with multiple API replicas (see Stack Patterns). Not the AI budget (that is Postgres, below). | HIGH |
| `acorn` | `^8.19.0` | Safe, no-execution parsing of Lite `config.js` (`const CONFIG = {...}`) into plain data | Parse to AST and evaluate only literal nodes. Prototyped against `js/config_base.js`: yields 10 deliverables / 15 workflow entries with no code execution. Zero transitive deps, runs in Node and browser. | HIGH |
| `papaparse` | `^5.7.1` (+ `@types/papaparse ^5.5.2`) | CSV parsing for upload | Auto-detects delimiter (`delimiter: ''`), which matters because the product uses DD/MM/YYYY dates and European Excel exports use `;`. Works on strings in Node. `csv-parse` (7.0.3) does not auto-detect a single delimiter. | HIGH (library), MEDIUM (BOM handling: add a test with a BOM CSV) |
| `read-excel-file` | `^9.3.17` (deps: `fflate`, `saxen`, `unzipper-esm`, `worker-f`) | XLSX → 2D array / multi-sheet | Actively maintained (updated 2026-11-13), Node import `read-excel-file/node`, `readExcelFile(file)` returns `[{ sheet, data }]` for all sheets. Read-only, which is all we need. `.xlsx` only (no legacy `.xls`), which is an acceptable v1 limit. | HIGH (maintenance), MEDIUM (zip-bomb behavior unverified, so cap compressed size and parsed cell count yourself) |
| `nodemailer` | `^10.6.0` (Node >=20) | Invite emails over SMTP | Provider-agnostic: Resend, Postmark, SES, SendGrid all expose SMTP, so one `SMTP_URL` in `.env` works for self-host and hosted. Pairs with Mailpit in compose for dev. | HIGH |
| `ajv` | `^8.20.0` (move from root devDep to a `packages/api` dependency) | Validate imported Lite config against the existing `schema/config.schema.json` | Same validator and schema Lite already uses, so import and Lite agree on what a valid config is. | HIGH |

### Infrastructure (Docker)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `node:26-alpine` (pin e.g. `26-alpine3.24`) | Node 26.13.x (Active LTS since 2026-10-28, EOL 2029-04-30) | Build and runtime stage for `api` image; build stage for `web` image | All API deps are pure JS, so Alpine/musl is safe (no native addons; this is also a reason to avoid `isolated-vm`). Matches the maintainer's local Node 26. Fallback `node:24-alpine` (Maintenance LTS, EOL 2028-04) if any dep breaks on 26. | MEDIUM (26 is three weeks into LTS) |
| `nginxinc/nginx-unprivileged:1.30-alpine` | 1.30.x (stable line; 1.31 is mainline) | `web` image: serve built SPA, proxy `/api` to `api:4000` | Stable branch, runs as non-root (listens on 8080). Static SPA with `try_files $uri /index.html` plus `location /api/ { proxy_pass http://api:4000; }`. No library needed. | HIGH |
| `postgres:18-alpine` | 18.7 | DB | 18 is current stable; `postgres:19` exists only as `19rc2` (do not use). CI currently uses 16: bump CI to the same major as compose to keep RLS behavior identical. Mount the volume at `/var/lib/postgresql` (18+ image layout changed; verify against the image README when writing compose). | HIGH (tag), MEDIUM (volume path) |
| `axllent/mailpit:v1.34` | 1.34 | Dev-only SMTP sink in a compose `dev` profile | Lets invite flows be exercised without a real provider. | HIGH |
| Docker Compose spec | n/a | `migrate` one-shot job | `migrate` reuses the **api image** with `command: ["node","src/db/migrate.js"]`; `api` has `depends_on: { migrate: { condition: service_completed_successfully } }`; `migrate` waits on `postgres` `service_healthy` (`pg_isready`). No separate migrate image. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | `^1.65.1` (dev) | Visual-parity regression: screenshot Lite and the SaaS view from the same config fixture and compare (`toHaveScreenshot`) | The core value is "looks exactly like Lite", so make it a test, not a review. Run in the pinned Playwright Docker image in CI to avoid font/OS drift. | 
| `@fastify/helmet` | `^13.2.0` | Security headers on the API | Add when the API is exposed directly; if nginx sets headers for the single origin, optional. |
| `@fastify/cors` | `^11.4.3` (existing `^10`) | CORS | Upgrade opportunistically; with nginx proxying `/api` same-origin, CORS is only needed for dev. |
| `jose` | `^6.2.18` (existing `^5.9`) | JWT/JWKS | Optional upgrade; 6.x is ESM-only (fine, API is ESM). Not required for this milestone. |
| `pino` / `pino-pretty` | built into Fastify / `^13.2.0` dev | Structured logs | Fastify already bundles pino: enable `logger: true` in production (closes the "no structured logging" concern). `pino-pretty` only in dev. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| npm workspaces (npm 11.x) | One lockfile, shared `@roadmapsnap/core`, selective installs | See "Shared package approach" below. Verified in a scratch repo: `npm ci --workspaces=false` installs only the root (Lite CI stays light); `npm ci -w @roadmapsnap/api --include-workspace-root=false` installs just that workspace and its linked siblings. |
| Mailpit | Local email inbox | compose `dev` profile |
| CI Node version | **Move CI off Node 20 (EOL 2026-04-30)** to 26 (or 24) | Also unblocks Vite 8 (`^20.19 \|\| >=22.12`) and Vitest 5 (`>=22.12`) later. Do not upgrade Vite/Vitest/Tailwind/React in this milestone; it would put visual-parity work on a moving base. |

## Decisions by Question

### 1. Claude integration: model, tool use, structured output

- **Use structured outputs (`output_config.format` via `client.messages.parse` + `zodOutputFormat`), not forced tool calls.** `tool_choice: {type:'any'|'tool'}` returns **HTTP 400** on `claude-opus-5-5` and `claude-sonnet-5-5` (and Fable/Mythos 5.1+). The "force the model to call `propose_changes`" pattern that older tutorials use is therefore dead on current models. Structured outputs give schema-valid JSON without a tool loop. If a tool-style flow is ever needed: `tool_choice: auto` + `strict: true` + prompt instruction, and verify a call was made.
- **No agent loop for v1.** One request in, one validated `ChangeSet` out, preview, confirm. The model gets the current roadmap serialized in the prompt (by stable ID), not DB-querying tools. This keeps AI changes inside the same RLS/role path as manual edits (the API applies the confirmed ChangeSet through `request.dbClient`).
- **Model:** default `claude-opus-5-5` (the current Opus, $4/$20 per MTok), read from `ANTHROPIC_MODEL` env so it can be switched without a deploy. `claude-sonnet-5-5` ($2/$10) is the cost lever; decide with an eval on real roadmaps, not by guessing. Use exact IDs, no date suffixes. Thinking: omit (adaptive is default on Opus 5.5; `{type:'disabled'}` is a 400). Set `output_config.effort` explicitly because Opus 5.5's default is `medium`.
- **Streaming:** use `client.messages.stream({...}).finalMessage()` for create-from-document (large outputs; the SDK requires streaming for very large `max_tokens`). `finalMessage()` carries `parsed_output`. Plain `messages.parse` is fine for small edit proposals.
- **Always handle** `stop_reason === 'refusal'` (check `stop_details`) and `'max_tokens'` (output may be truncated JSON: treat as failure, never apply). Do not use prefill (400 on these models).
- **Refusal fallbacks:** for `claude-opus-5-5` the current guidance is to opt into server-side fallbacks (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`) on the beta endpoint. Confirm in phase research that this composes with `output_config.format` + `parse()` on `client.beta.messages` before committing to it.
- **Schema gotcha found by prototype (important):** strict structured outputs require `additionalProperties: false` on every object, so an open map such as `z.record(z.string(), z.string())` is emitted as an **empty-properties object** (`properties: {}`, `additionalProperties: false`), which the model can only leave empty. Milestone dates keyed by workflow key (`{START: "01/06/2025", A0: ...}`) must therefore be modelled as an array of `{ key, date }` pairs in the AI schema and converted to Lite's map shape after validation. Also unsupported: recursive schemas, `minimum/maximum`, `minLength/maxLength` (the TS SDK strips these from the wire schema and re-validates client-side, so keep them in zod and validate with `safeParse` yourself). Use `anyOf`/discriminated unions for ops (supported).
- **Do not truncate** oversized pasted/uploaded input silently. Run `client.messages.countTokens` first and return a clear "too large, split it" error.
- **Prompt-injection posture:** uploaded documents are untrusted data. Wrap them in delimited blocks, tell the model they are data, and rely on the real defenses: structured output only, server-side validation (entity IDs must belong to the caller's workspace, field whitelist), preview, explicit confirm, RLS. Never give the model tools that write.

### 2. The change-set format (JSON Patch libraries: don't)

- **Do not use RFC 6902 JSON Patch** (`fast-json-patch` 3.1.1 is unmaintained since 2022; `rfc6902` 5.5.0 and `jsondiffpatch` 0.7.7 are maintained) **as the AI contract.** Index-based paths (`/deliverables/3/dependencies/-`) are fragile for an LLM and for a roadmap that changes between preview and confirm.
- **Use a domain op list**, a zod discriminated union (`add_task`, `update_task`, `delete_task`, `add_group`, `add_dependency`, `remove_dependency`, `set_milestone_date`, ...) referencing entities by stable ID, with client-side temp IDs for entities created in the same set (so "add task in group X depending on A, B, C" is one op plus dependency refs). Include `base_revision` so a stale preview is rejected with 409 on apply.
- **Preview diff:** apply ops to a `structuredClone` of the normalized roadmap in `packages/core` (pure function, shared by API and app), then compute an entity-level before/after list (added / removed / changed fields). That is about 50 lines; no library. If generic field-level diffs become useful later, `rfc6902` `createPatch` is the one to add; `jsondiffpatch`'s HTML formatter will not match the Lite look. `immer` is unnecessary.
- **Apply:** the same pure applier runs in one DB transaction on the API via `request.dbClient`.

### 3. File upload and parsing

- **Parse server-side only**, in-memory, never persisted. Upload via `@fastify/multipart` `request.file({ limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 7 } })` + `toBuffer()`. Sniff magic bytes (XLSX is a ZIP: `PK\x03\x04`); do not trust the client MIME type or extension.
- **CSV:** `papaparse` with `header: true`, `skipEmptyLines: 'greedy'`, auto delimiter.
- **XLSX:** `read-excel-file/node` `readExcelFile(buffer)`; cap sheets (e.g. 5), rows (e.g. 2,000) and columns after parsing. Zip-bomb risk is real for any XLSX reader: cap the compressed upload, then cap decoded size/cell count before handing text to Claude; consider a worker thread with a timeout if abuse appears.
- **Markdown / pasted docs: no parser.** Pass the raw text to Claude. Adding `marked` (18.2.1) or `markdown-it` (15.0.3) buys nothing here.
- **Convert sheets to compact text** (TSV or markdown table per sheet) for the prompt; this is also what makes the token count predictable.
- **PDF/DOCX are out of scope for v1.** Claude accepts PDFs natively as `document` blocks, so a PDF source could be a cheap later addition (note: citations are incompatible with `output_config.format`).

### 4. Safe evaluation of Lite `config.js`

- **Never execute it.** Parse with `acorn` and walk the AST, accepting only: `Literal`, `ObjectExpression` (non-computed, non-spread, `init` properties, reject `__proto__`), `ArrayExpression`, `TemplateLiteral` with no expressions, unary minus on a number. Locate `const|let|var CONFIG = ...` (also accept `window.CONFIG =` / `globalThis.CONFIG =`). Build objects with `Object.create(null)`. Reject anything else with a located error ("line 12: expression not supported").
- Cap file size (1 MB) and AST depth (about 50), and catch `RangeError` from deeply nested input.
- Then validate with Ajv against `schema/config.schema.json` and convert deterministically (no AI). Verified: the sample `js/config_base.js` contains only literals, so no real-world loss is expected; the phase should check any customer samples for non-literals (computed dates, helper calls) and report them rather than evaluate.
- Run it in `packages/api` (one implementation, behind auth, with the file never reaching the browser's origin storage). `acorn` must not become a dependency of `packages/core`, because Lite must stay dependency-free at runtime.
- **If literal-only ever proves too strict**, the next step up is `quickjs-emscripten` (0.32.0, WASM sandbox with memory and time limits). Not `vm2` (repeated sandbox-escape history), not Node's `vm` (documented as not a security boundary), and not `isolated-vm` 7.0.2 (native addon, requires Node >=24, conflicts with the Alpine/pure-JS image plan).

### 5. Rate limiting and AI usage metering

- **Two layers, two tools:**
  1. `@fastify/rate-limit` for abuse (per-IP login/upload endpoints, per-user AI endpoint burst, e.g. 10/min). In-memory store is fine for one API replica.
  2. **Postgres is the authoritative AI budget.** Tables, under RLS: `org_ai_limits(org_id, period, cap_micro_usd)` and `ai_usage(id, org_id, user_id, request_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micro_usd, created_at)`. Flow: **reserve** (atomic `UPDATE ... SET reserved = reserved + $est WHERE used + reserved + $est <= cap RETURNING`, committed immediately) → call Claude with no DB transaction held open → **settle** from `response.usage` (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) and release the unused reservation. Reject with 429 + clear "org AI budget used" message when the reserve fails. Price table lives in config (env-overridable), so a price change is not a migration.
  - Cap in micro-USD (or credits) rather than raw tokens, because Opus and Sonnet price differently and the model is switchable.
  - No Redis in v1. It would add a service to compose for nothing the DB does not already do correctly under concurrency.
- **Backstop outside the app:** set a spend limit on the Anthropic workspace that owns the shared key (Admin API/Console spend limits; availability varies by org type, so verify). The in-app cap protects tenants from each other; the Console limit protects you from a bug in the in-app cap.
- Set `maxRetries` and `timeout` explicitly on the SDK client; a retried timeout can take `timeout x (maxRetries+1)` wall-clock.

### 6. Email invites and Auth0 signup

- **Keep organizations in your own DB; do not adopt Auth0 Organizations.** Search results (competitor blogs, so MEDIUM) put the Free plan at 5 organizations; a self-serve product creating one org per signup would hit that. You already own the org/member/role model and RLS.
- **Signup:** Auth0 Universal Login with `loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })` (`@auth0/auth0-react` ^2.30.0, existing `^2.2.4` resolves). Enable sign-ups on the connection.
- **Org creation:** replace the current "add new user to `config-seed-org`" provisioning in `context.js` with: first login and no membership and no valid invite → create org + default workspace + `admin` membership in one transaction.
- **Invites:** `invitations(org_id, email, role, token_hash, expires_at, accepted_at, invited_by)`. Token = `crypto.randomBytes(32)` base64url, store only a SHA-256 hash (Node `crypto`, no library), 7-day expiry, single use. Email a link to the SPA `/invite?token=...`; after Auth0 login the API accepts the invite only if the caller's `email_verified` is true and matches (or the token itself is the proof; decide in phase discussion).
- **Auth0 caveat:** access tokens carry no email by default. `context.js` already reads `request.user.email`, so confirm the tenant has a Post-Login Action adding namespaced `email` / `email_verified` claims to the access token, or fetch `/userinfo`. No `auth0` management SDK (7.8.0) is needed in v1.
- **Delivery:** `nodemailer` over SMTP (`SMTP_URL`, `MAIL_FROM` in `.env`). `resend` 6.39.0 is a fine alternative if you commit to one hosted provider; SMTP keeps the compose story provider-neutral. Plain template strings for the two or three emails; no MJML.

### 7. Shared package approach: npm workspaces, not `file:` deps

- **Create `packages/core` (`@roadmapsnap/core`)** holding the moved `js/core/*` pure logic (timeline, stats, dependencies, workflow, viewModel, validator) as plain ES modules with JSDoc and a hand-maintained or generated `index.d.ts` (root already has `types/roadmapsnap.d.ts`). "Just-in-time" package: `exports` point at `./src/*.js`; no build step, Vite compiles it for both Lite and the app.
- **Root `package.json`: `"workspaces": ["packages/*"]`.** Replace `file:../tokens` with `"@roadmapsnap/tokens": "*"` and add `"@roadmapsnap/core": "*"` (npm links workspace packages; `workspace:` protocol is pnpm/yarn only). Delete the three per-package lockfiles; one root `package-lock.json`.
- **Why workspaces over `file:`:** `file:` symlinks only and keeps one lockfile per package, so two copies of React or `@types/react` can drift and each Dockerfile must still copy sibling directories. Workspaces give one lockfile and deduped hoisting, plus `npm ci -w <pkg>` for per-image installs. Because core has no dependencies, `file:` would technically work, but you gain nothing from it.
- **Lite stays dependency-free and backend-free:** Lite imports core by relative path (`../packages/core/src/timeline.js`) and Vite bundles it; Lite CI uses `npm ci --workspaces=false` (verified), so no React/Fastify install. If the phase wants zero Lite file moves, the fallback is a Vite `resolve.alias` + `tsconfig paths` pointing the app at `js/core`, which keeps `js/core` canonical but couples the app build to repo-root layout.
- **Prerequisite, not optional:** core currently assigns `window.*` (`window.parseDate`, ...) and `workflow.js` reads `window.parseDate`/`window.getTodayDate`. These must go (they are tagged DEBT in `docs/phase0-window-audit.md`) before core can run in the API/React/Node without a `globalThis.window` shim. Lite UI inline `onclick` handlers keep their window globals inside `js/ui` only.
- **Visual identity:** share the stylesheet, not just the logic. Move or re-export `css/roadmap.css` through `packages/tokens` so the React views emit the same class names under the same CSS. Tailwind 3 preflight can alter element defaults inside the roadmap view; set `corePlugins: { preflight: false }` or scope the roadmap view, and do not migrate to Tailwind 4 in this milestone. Guard with the Playwright screenshot parity test.
- **Docker consequence:** build context must be the repo root so the images can see `package-lock.json` and `packages/*`; use a root `.dockerignore` (excluding `node_modules`, `.env*`, `js/config*.js` except `config_base.js`, `.git`).

## Installation

```bash
# API (packages/api)
npm install -w @roadmapsnap/api @anthropic-ai/sdk zod @fastify/multipart @fastify/rate-limit \
  acorn papaparse read-excel-file nodemailer ajv
npm install -w @roadmapsnap/api @fastify/helmet          # optional
npm uninstall -w @roadmapsnap/api @fastify/jwt           # unused, verification uses jose
npm install -w @roadmapsnap/api @fastify/cors@^11        # optional upgrade

# Shared logic (packages/core): no dependencies by design
# App (packages/app): add the workspace dependencies
npm install -w @roadmapsnap/app @roadmapsnap/core@'*' @roadmapsnap/tokens@'*'
npm install -w @roadmapsnap/app zod                      # only if the app imports the ChangeSet schema from core

# Dev dependencies
npm install -D -w @roadmapsnap/api @types/papaparse
npm install -D @playwright/test                          # root, for Lite/SaaS visual parity
```

Selective installs (CI and Dockerfiles):

```bash
npm ci --workspaces=false                                         # Lite CI: root only
npm ci -w @roadmapsnap/api --include-workspace-root=false --omit=dev   # api image
npm ci -w @roadmapsnap/app --include-workspace-root=false              # web build stage
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Structured outputs (`output_config.format`) | Forced tool call (`tool_choice: tool`) | Only on models that still accept it (Claude Opus 5, Sonnet 5, older). Not on the current Opus 5.5 / Sonnet 5.5, where it 400s. |
| Domain op list + zod | RFC 6902 JSON Patch (`rfc6902`) | If the ops layer is replaced by generic document editing. Fine for the diff *display* only. |
| `read-excel-file` 9.x | SheetJS `xlsx` from `cdn.sheetjs.com` tarball (0.20.x) | If you need `.xls`/`.ods` or formula evaluation. Requires pinning a CDN tarball URL (reproducibility and offline-build trade-off). |
| `papaparse` | `csv-parse` 7.0.3 | If you want a streaming Node pipeline and know the delimiter. |
| `nodemailer` (SMTP) | `resend` 6.39.0 (HTTP API) | If you standardize on Resend for the hosted tier and want delivery webhooks and typed errors. |
| Postgres AI ledger | Redis counters | Only if you later run many API replicas and need sub-second shared throttling for `@fastify/rate-limit` (that plugin takes an `ioredis` instance). Keep the AI budget in Postgres regardless. |
| npm workspaces | pnpm workspaces | If install speed/disk becomes a problem; not worth a package-manager switch now. |
| `acorn` literal evaluator | `quickjs-emscripten` sandbox | If customers' configs contain computed values and you decide to run them. |
| Own org model in Postgres | Auth0 Organizations | If a customer demands enterprise SSO per org and you accept plan limits. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `xlsx` from the npm registry (0.18.5) | Registry copy is frozen at 0.18.5 (2022). Known issues: prototype pollution (CVE-2023-30533, fixed 0.19.3) and ReDoS (CVE-2024-22363, fixed 0.20.2), both fixed only in SheetJS's own CDN distribution. Parsing untrusted uploads with it is the wrong place to be exposed. | `read-excel-file` (or the CDN tarball if SheetJS features are required) |
| `exceljs` 4.4.0 | Last release Dec 2024; heavy, old dependency tree (`unzipper ^0.10`, `archiver ^5`, `uuid ^8`, `fast-csv ^4`); built for read/write fidelity we do not need. | `read-excel-file` |
| `vm2`, Node `vm`, `eval` / `new Function` / `<script>` injection for `config.js` | Sandbox escapes (vm2), "not a security mechanism" (vm), or direct RCE on upload. | `acorn` + literal-only evaluator |
| `isolated-vm` | Native addon, Node >=24, painful on Alpine; overkill for literal data. | `acorn` (or `quickjs-emscripten` if code evaluation is ever required) |
| `fast-json-patch` | Unmaintained since 2022. | Domain ops (or `rfc6902` for display diffs) |
| `marked` / `markdown-it` for uploaded `.md` | Nothing to render; the model reads raw markdown. | Raw text into the prompt |
| Forced `tool_choice` for structured extraction | 400 on Opus 5.5 / Sonnet 5.5. | `output_config.format` |
| `thinking: {type:'disabled'}` or `budget_tokens`, assistant prefill | 400 on Opus 5.5 / Sonnet 5.5. | Omit `thinking`; control depth with `output_config.effort` |
| `ANTHROPIC_API_KEY` in any `VITE_*` var, in the web image, or in a build arg | Key would ship to the browser or into image layers. | Runtime env on the `api` service only |
| `@fastify/jwt` (still in `packages/api/package.json`) | Unused; verification is done with `jose`. Dead dependency and attack surface. | Remove |
| Auth0 Organizations as the tenant model | Plan limits on organization counts (MEDIUM confidence) and duplicates the DB model that RLS depends on. | `organizations` / `org_members` tables |
| `postgres:19` / `19rc2` | Release candidate. | `postgres:18-alpine` |
| Node 20 in CI or images | EOL 2026-04-30. | Node 26 (or 24) |
| `file:../x` sibling dependencies | Per-package lockfiles and duplicate dependency trees; blocks `npm ci -w`. | npm workspaces |

## Stack Patterns by Variant

**If you run more than one `api` replica (hosted scale-out):**
- Add Redis and pass an `ioredis` instance to `@fastify/rate-limit`.
- Because in-memory counters are per-process; the Postgres AI ledger is already replica-safe.

**If AI create-from-document proves slow or large (>60 s):**
- Return `202` + job id and poll, or stream progress over SSE; keep `finalMessage()` server-side.
- Because browsers, nginx (`proxy_read_timeout`, default 60 s) and load balancers cut long idle requests. Set `proxy_read_timeout` explicitly on `/api/` in the web image regardless.

**If customers' configs contain non-literal JavaScript:**
- Report unsupported constructs by line; if demand justifies it, evaluate in `quickjs-emscripten` with memory/time limits.
- Because literal-only is safe by construction.

**If you want Sonnet-class cost for simple edits:**
- Route "apply a plain-language change" to `claude-sonnet-5-5` and "create roadmap from document" to `claude-opus-5-5`, both via env, after an eval on real roadmaps.
- Because the two jobs have very different difficulty and output size.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@anthropic-ai/sdk@1.10.0` | `zod ^3.25 \|\| ^4.0` | Peer dep; `zod@4.6.7` verified with `zodOutputFormat` locally. |
| `fastify@5.12.x` | `@fastify/multipart@10`, `@fastify/rate-limit@11`, `@fastify/cors@11`, `@fastify/helmet@13`, `@fastify/env@7` | Current majors of the official plugins (they depend on `fastify-plugin` 5/6); upgrade the plugins together. `@fastify/env` 5→7 and `@fastify/cors` 10→11 are optional, test before bumping. |
| `vite@8.3.8` | Node `^20.19 \|\| >=22.12` | Not adopted now; app stays on Vite 5.4 and root on Vite 7.3. |
| `vitest@5.1.1` | Node `>=22.12` | Not adopted now; app stays on Vitest 2.1 (works on Node 26). |
| `nodemailer@10.6.0`, `resend@6.39.0` | Node >=20 | Fine on Node 26. |
| `read-excel-file@9` | Node >=18; import `read-excel-file/node` | v9 API: `readSheet` (first/selected sheet), default export returns all sheets; `parseSheetData` replaces the older `parseData`. Do not copy v6/v7 snippets. |
| `acorn@8.19` | Node/browser, any | `ecmaVersion: 'latest'`, `sourceType: 'script'` for `const CONFIG`. |
| `isolated-vm@7.0.2` | Node `>=24` | Listed only to document why it is excluded. |
| `typescript@7.0.2`, `react@19.3`, `tailwindcss@4.3`, `react-router-dom@7.18` | n/a | Current majors exist; deliberately not adopted in this milestone (parity and Lite-sharing work should not ride a framework migration). |

## Sources

- npm registry (`npm view`, 2026-11-18): versions, engines, peer/dependency metadata for every package named above. HIGH
- Local prototype (scratchpad, 2026-11-18): `acorn` literal evaluation of `js/config_base.js`; `zodOutputFormat` on a discriminated-union ChangeSet showing `z.record` collapsing to an empty-properties object; `@anthropic-ai/sdk@1.10.0` exports (`helpers/zod`, `messages.parse`, `MessageStream` `parsed_output`); `npm ci` selective workspace installs on npm 11.20. HIGH
- Claude API skill reference (bundled, cached 2026-11-03): current model IDs and pricing, forced `tool_choice` 400 on Opus 5.5 / Sonnet 5.5, structured-output schema limits, thinking/effort rules, refusal fallbacks, `usage` fields. HIGH (model facts), MEDIUM (fallback + `parse` composition, unverified)
- Node.js release schedule (`raw.githubusercontent.com/nodejs/Release/main/schedule.json`): Node 20 EOL 2026-04-30; 24 Maintenance LTS; 26 LTS from 2026-10-28. HIGH
- Docker Hub tags API: `node:26-alpine`, `node:24-alpine`, `postgres:18-alpine` (19 only as `19rc2`), `nginx` / `nginxinc/nginx-unprivileged` 1.30 and 1.31, `axllent/mailpit` v1.34. HIGH
- `github.com/fastify/fastify-multipart` README: `limits`, `toBuffer`, `RequestFileTooLargeError`, `bodyLimit` not aggregate, `truncated`. HIGH
- `@fastify/rate-limit` and `read-excel-file` READMEs via npm: `hook: 'preHandler'`, `keyGenerator`, Redis store; v9 API and Node import path. HIGH
- SheetJS npm staleness and CVEs: Snyk / ecosyste.ms advisories as summarized by web search (CVE-2023-30533 fixed 0.19.3; CVE-2024-22363 fixed 0.20.2; npm stuck at 0.18.5). MEDIUM (secondary sources; confirm on sheetjs.com before choosing the CDN route)
- Auth0 Organizations Free-plan limit of 5 organizations: competitor/community articles via web search. MEDIUM; confirm on auth0.com/pricing before relying on it. The recommendation (own org table) holds regardless.
- PostgreSQL 18 image volume path (`/var/lib/postgresql`): recalled from the image documentation, not re-fetched. MEDIUM; verify when writing compose.

---
*Stack research for: multi-tenant roadmap/PMO governance SaaS (AI authoring, shared core, compose deploy, signup/invites, config import, upload parsing)*
*Researched: 2026-11-18*
