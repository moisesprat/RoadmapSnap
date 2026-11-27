---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# Testing Patterns

**Analysis Date:** 2026-10-24

Three test suites run in three places. Each has its own runner and CI workflow.

| Suite | Location | Runner | CI workflow |
|---|---|---|---|
| Lite | `tests/` | `node --test` | `.github/workflows/ci.yml` (skipped for `packages/**` changes) |
| SaaS API | `packages/api/tests/` | `node --test` (with a live PostgreSQL) | `.github/workflows/api-ci.yml` |
| SaaS app | `packages/app/src/**/*.test.ts` | Vitest + jsdom + Testing Library | `.github/workflows/app-ci.yml` |

## Test Framework

**Lite (root):**
- Runner: Node's built-in `node:test` with `node:assert/strict`. No test dependencies.
- Script: `"test": "node --test tests/**/*.test.js"` in `package.json`.
- Watch: `npm run test:watch`.
- Single file: `node --test tests/core/timeline.test.js`.
- Config file: none. Node defaults apply.

**SaaS API:**
- Runner: `node:test` with `node:assert/strict`.
- Script: `"test": "NODE_ENV=test node --test tests/*.test.js"` in `packages/api/package.json`.
- Config file: none.
- Database: real PostgreSQL 16. Tests are gated on `DATABASE_URL` and `APP_DATABASE_URL` (see Test Types).

**SaaS app:**
- Runner: Vitest `^2.1.0`, configured inside `packages/app/vite.config.ts` under the `test` key.
- Environment: `jsdom`, `globals: true`.
- Setup file: `packages/app/src/test/setup.ts`, which imports `@testing-library/jest-dom`.
- Libraries: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
- Script: `"test": "vitest run"` in `packages/app/package.json`.

**Assertion Library:**
- Lite and API: `node:assert/strict`, using `assert.equal`, `assert.ok`, `assert.deepEqual`, `assert.rejects`.
- App: Vitest `expect` plus `@testing-library/jest-dom` matchers.

**Run Commands:**

```bash

# Root (Lite)

npm test                                          # All Lite tests
npm run test:watch                                # Watch mode
node --test tests/core/timeline.test.js           # One Lite file
npm run validate                                  # Validate js/config.js against schema (CI)
npm run build                                     # Vite build, copies js/config.js (CI)

# API (needs local Postgres on localhost:5432 and the roadmapsnap_app role)

cd packages/api && npm run migrate                # Apply migrations first
cd packages/api && npm test                       # All API tests
cd packages/api && node --test tests/rls.test.js  # One API file

# App

cd packages/app && npx tsc --noEmit               # Type check (CI runs this before tests)
cd packages/app && npm test                       # vitest run (all)
cd packages/app && npx vitest run src/api/client.test.ts   # One file
cd packages/app && npm run build                  # tsc --noEmit && vite build (CI)
```

**Coverage:**
- No coverage tool or threshold is configured in any suite. No `--coverage` flag is used in any script.
- `npm run build:check` in the root runs a docs generation step and is not run by CI.

## Test File Organization

**Location:**
- Lite: separate tree. Tests in `tests/core/` mirror `js/core/`, and `tests/state/` mirrors `js/state/`. Test-only data lives in `tests/fixtures/`.
- API: separate tree. All tests live flat in `packages/api/tests/`, one file per route group or concern (`auth.test.js`, `projects.test.js`, `workspaces.test.js`, `health.test.js`, `rls.test.js`).
- App: colocated. `packages/app/src/api/client.test.ts` sits next to `client.ts`.

**Naming:**
- Lite and API: `{module}.test.js`.
- App: `{module}.test.ts` (or `.tsx` for components).

**Structure of the Lite fixture directory:**

```
tests/
├── core/
│   ├── configValidator.test.js
│   ├── dependencies.test.js
│   ├── dependencyColoring.test.js
│   ├── stats.test.js
│   ├── timeline.test.js
│   └── workflow.test.js
├── fixtures/
│   ├── config.complex.js
│   └── config.minimal.js
└── state/
    └── appState.test.js
```

**Lite fixtures:** `tests/fixtures/config.minimal.js` and `config.complex.js` are full `CONFIG` objects used as input to core functions and to `configValidator`. Do not put secrets or real user data in them. They are sample programs, not production config. Use `js/config_base.js` as the template and never commit `js/config.js`.

## Test Structure

**Lite suite organization (flat `test()` calls, grouped by function with comments):**

```javascript
// tests/core/timeline.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// timeline.js assigns to window; ensure it exists so the module loads in Node
globalThis.window = globalThis.window || {};
const { parseDate, formatDateDisplay } = await import('../../js/core/timeline.js');

// --- parseDate ---
test('parseDate: valid DD/MM/YYYY returns correct Date object', () => {
  const d = parseDate('15/03/2026');
  assert.ok(d instanceof Date);
  assert.equal(d.getMonth(), 2); // March = 2 (0-indexed)
});

test('parseDate: empty string returns null', () => {
  assert.equal(parseDate(''), null);
});
```

- Test names follow `functionName: behaviour in plain words`, for example `formatDateDisplay: "15/03/2026" returns "15 Mar"`.
- Section headers are `// --- functionName ---`.
- Browser globals are stubbed before the dynamic import. `tests/state/appState.test.js` also stubs `globalThis.localStorage` with `getItem`, `setItem`, and `removeItem`.

**API suite organization (`before` / `after` lifecycle with a real app instance):**

```javascript
// packages/api/tests/health.test.js
import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

let app;
before(async () => {
  app = await build();
  await app.ready();
});
after(async () => {
  await app.close();
});

test('GET /health returns status 200', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
});
```

- Use `app.inject()` (Fastify's in-process HTTP). Do not bind a port inside tests.
- Set `process.env.AUTH0_DOMAIN` and `process.env.AUTH0_AUDIENCE` at the top of the file, before `build()`, with `||` defaults.
- Set `process.env.NODE_ENV = 'test'` so the `X-Test-User-Sub` header bypass in `packages/api/src/plugins/auth.js` is active.

**App suite organization (Vitest, describe/it, globals enabled but imported explicitly):**

```typescript
// packages/app/src/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, createApiClient } from './client'

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws ApiError when fetch returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) }))
    const client = createApiClient(() => Promise.resolve('header.payload.signature'))
    await expect(client.getWorkspaces()).rejects.toThrow(ApiError)
  })
})
```

- Import `describe`, `it`, `expect`, `vi` from `vitest` explicitly, even though `globals: true` is set.
- Reset mocks in `beforeEach` with `vi.restoreAllMocks()`.

## Test Setup and Lifecycle

**Lite:** No shared setup file. Each test file does its own global stubbing at the top. Tests are pure, so no teardown is needed.

**API:**
- `before` builds the app and creates an admin `pg` `Pool` against `DATABASE_URL`.
- Test users, orgs, and workspaces are inserted with `ON CONFLICT ... DO UPDATE ... RETURNING id`, so reruns are idempotent. Example from `packages/api/tests/projects.test.js`:

```javascript
const editorRes = await adminClient.query(
  `INSERT INTO users (auth0_id, email, display_name)
   VALUES ('test-proj-editor', 'proj-editor@example.com', 'Proj Editor')
   ON CONFLICT (auth0_id) DO UPDATE SET email = EXCLUDED.email RETURNING id`
);
```

- Each test file uses a unique slug per run: `` `proj-test-org-${process.pid}-${Date.now()}` ``. Follow this pattern so parallel `node --test` processes do not collide.
- Auth in tests is a header, not a token: `{ 'x-test-user-sub': sub, 'x-org-id': orgId }`. Helper `authHeaders(sub, orgId)` builds it.
- `after` closes the app and ends the pool.

**App:**
- `packages/app/src/test/setup.ts` only imports `@testing-library/jest-dom`. Add global mocks here if several tests need them.
- App CI supplies placeholder `VITE_*` environment variables (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_API_URL`). Tests that touch config must work with these placeholders.

## Mocking

**Lite:**
- Framework: none. Globals are replaced by hand (`globalThis.window`, `globalThis.localStorage`).
- Pattern: assign the stub before the dynamic `import()` so the module's top-level code sees it.
- Do not mock `js/core/` internals. Core functions are pure, so tests pass real inputs.

**API:**
- Framework: none. The real Fastify app and real PostgreSQL are used.
- Auth is bypassed with the test header, not mocked.
- RLS behaviour is tested against the real database by connecting as the `roadmapsnap_app` role (`packages/api/tests/rls.test.js` builds `APP_DATABASE_URL` from `DATABASE_URL` if not set).

**App:**
- Framework: Vitest `vi`.
- Global `fetch` is replaced with `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({...}))`.
- Restore with `vi.restoreAllMocks()` in `beforeEach`.
- Shape a mock response with only the fields the code reads (`ok`, `status`, `json`).

**What to Mock:**
- Network `fetch` in app client tests.
- Browser globals that Lite modules read at load time (`window`, `localStorage`).
- Auth0 token retrieval: the client accepts a token-getter function (`createApiClient(() => Promise.resolve(token))`), so pass a stub instead of mocking Auth0.

**What NOT to Mock:**
- The database in API tests. Tests run against the real migrated PostgreSQL, because RLS and triggers are the behaviour under test.
- Fastify in API tests. Use `app.inject()`.
- Lite core functions (`js/core/`). Test them with real config fixtures.

## Fixtures and Factories

**Lite test data:**
- `tests/fixtures/config.minimal.js`: smallest valid `CONFIG`.
- `tests/fixtures/config.complex.js`: full `CONFIG` with states, milestones, dependencies, and groups.
- Import them the same way as source modules, with a relative path.

**API test data:**
- Inline `INSERT` statements in `before`, not factory functions. Seed data for the real product comes from migrations (`V11__seed_dependencies_from_config.sql`).

**App test data:**
- Inline object literals. No factory library is used.

**Location:**
- Lite: `tests/fixtures/`.
- API: inside each test file.
- App: inside each test file, or future `packages/app/src/test/` helpers.

## Coverage

**Requirements:** None enforced. No threshold in any config.

**View Coverage:** Not configured. To get a rough view, use Node's built-in `node --test --experimental-test-coverage tests/**/*.test.js` for Lite and API, or `npx vitest run --coverage` after installing `@vitest/coverage-v8` in `packages/app`.

## Test Types

**Unit Tests:**
- Lite: `tests/core/*` and `tests/state/*`. Pure functions with fixture inputs. This is the largest Lite suite by behaviour.
- App: `src/lib/*` logic and `src/api/client.ts`. Currently one test file (`client.test.ts`).

**Integration Tests:**
- API: `packages/api/tests/*.test.js` hit the real Fastify app and a real PostgreSQL database through `app.inject()`.
- `rls.test.js` checks row-level security by running queries as the non-superuser role.
- `health.test.js` checks the public `/health` route, with no auth header and a 200 ms response budget.
- Database-dependent tests are gated: they run only when `DATABASE_URL` is set. Without it, DB tests are skipped (`const runTests = Boolean(DATABASE_URL);` in `packages/api/tests/projects.test.js`). A skipped run is not a passing DB test. Check that CI sets `DATABASE_URL`.

**E2E Tests:**
- Not used. No Playwright, Cypress, or similar is configured.

## Environment Requirements for Tests

**Lite:** None. Tests run with plain Node 20. CI first runs `cp js/config_base.js js/config.js` so that `npm run validate` and `npm run build` have a config. `npm test` does not need it.

**API (`api-ci.yml`):**
- Postgres 16 service on port 5432, database `roadmapsnap_test`.
- Role `roadmapsnap_app` created as `NOSUPERUSER` before migrations. RLS depends on this role not bypassing policies.
- `npm run migrate` runs before tests.
- Environment: `NODE_ENV=test`, `DATABASE_URL`, `TEST_DATABASE_URL`, `APP_DATABASE_URL`, `AUTH0_DOMAIN=placeholder.auth0.com`, `AUTH0_AUDIENCE=http://localhost:4000`, `PORT=4000`.
- Reproduce locally with the Docker PostgreSQL on localhost:5432 and the same role. Do not run API tests as a superuser, because RLS tests would pass for the wrong reason.

**App (`app-ci.yml`):**
- Node 20. Runs `npx tsc --noEmit`, then `npm test`, then `npm run build`.
- Placeholder `VITE_*` values as listed in Test Setup.

## Common Patterns

**Async Testing (Lite and API, `node:test`):**

```javascript
test('GET /health responds in under 200ms', async () => {
  const start = Date.now();
  await app.inject({ method: 'GET', url: '/health' });
  assert.ok(Date.now() - start < 200, `Expected < 200ms, got ${Date.now() - start}ms`);
});
```

**Async Testing (App, Vitest):** `await expect(promise).rejects.toThrow(ApiError)` and `rejects.toMatchObject({ status: 403, message: 'Forbidden' })`.

**Error Testing (Lite):** Return-value checks for invalid input, not thrown exceptions. Example: `assert.equal(parseDate(''), null);`.

**Error Testing (API):** Assert on status code and the `{ error, message }` body shape, for example `assert.equal(res.statusCode, 403)` and `res.json().error`.

**Error Testing (App):** Assert the error class and the fields it carries, using `rejects.toThrow(ApiError)` plus `rejects.toMatchObject({...})`.

## Adding a New Test

1. Lite core logic: add `tests/core/{module}.test.js`. Stub `window` and `localStorage` at the top if the module touches them. Use a `tests/fixtures/` config for CONFIG-dependent functions.
2. Lite state: add to `tests/state/appState.test.js`.
3. API route: add `packages/api/tests/{resource}.test.js`. Use the `before` / `after` pattern, a unique org slug, and `x-test-user-sub` headers. Cover the role matrix (viewer, editor, admin) through `requireRole`.
4. App client or logic: colocate `{name}.test.ts` next to the source. Mock `fetch` with `vi.stubGlobal`.
5. Mirror logic changes: a fix to `js/core/` also needs the matching test change in `packages/app/src/lib/` (AGENTS.md).

---

*Testing analysis: 2026-10-24*
