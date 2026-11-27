---
phase: 01-tenant-security-foundation
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/api/.env.example
  - packages/api/src/db/bootChecks.js
  - packages/api/src/db/client.js
  - packages/api/src/plugins/context.js
  - packages/api/src/plugins/rbac.js
  - packages/api/src/server.js
  - packages/api/tests/boot-checks.test.js
  - packages/api/tests/db-client.test.js
  - packages/api/tests/rbac.test.js
  - packages/api/tests/tenant-tx.test.js
findings:
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 01: Code Review Report (gap-closure round)

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This round re-verified the four gap-closure fixes against the current code, the installed Fastify 5.7.4 (`lib/wrap-thenable.js`) and pg-pool 3.12.0 (`_release`, `_releaseOnce`, `_acquireClient`).

Verdicts on the fixes, none of which has a remaining defect I can prove:

- **CR-01 (fixed, confirmed).** There is no path that releases a client twice, leaks one, or hands one tenant's connection to another request.
  - `finishTenantTx` sets `request.dbClient = null` synchronously before its first `await`. onSend, the settle guard and onResponse therefore cannot both finalize one client. pg-pool's `_releaseOnce` would also throw on a second release.
  - `onRequestAbort` now only logs, so the handler keeps exclusive use of its client until it settles.
  - The cases where Fastify sends nothing are covered.
    - Aborted request with the handler resolving `undefined`: `wrap-thenable.js` skips `reply.send` because `request.raw.aborted` is true, so the settle guard finalizes.
    - Handler that rejects: Fastify sends the error, so onSend rolls back.
    - Handler that returns a payload after the abort: `payload !== undefined`, so `reply.send` runs onSend.
    - Handler that calls `reply.send` without returning: onSend has already nulled `dbClient`, so the guard is a no-op.
  - A handler that does `return reply.send(...)` resolves only after the response finishes. By then `dbClient` is null, so the guard does nothing.
  - Hooks are encapsulated in the context plugin. `onRoute` is registered before `authPlugin`, so all tenant routes, including the `extraRoutes` seam, get the guard. `/` and `/health` do not.
  - Fastify's auto-generated HEAD routes may be wrapped twice. That is harmless, because the inner guard nulls `dbClient`.
  - A handler that completes after the abort and then commits is the same outcome as without an abort. That is consistent and tested.
- **WR-01 (fixed, confirmed).**
  - `pool.on('error')` is attached in `createPool`.
  - A checked-out client gets its own listener, attached in a microtask after `pool.connect()` resolves. No I/O event can fire in that gap.
  - The listener is removed immediately before `release()`, and pg-pool re-adds its idle listener synchronously at the top of `_release`, so there is no unhandled-`error` window.
  - A failed COMMIT or ROLLBACK passes the error to `release(failure)`, so the connection is destroyed rather than reused.
- **WR-06 (fixed, confirmed).** `roleLevel` uses `Object.hasOwn` and a type check, so inherited keys (`toString`, `__proto__`) and non-strings resolve to level 0 and are denied. `requireRole` throws at registration for an unknown minimum role. Every route in `workspaces.js`, `projects.js` and the test routes uses `fastify.requireRole`, and no local fail-open helper remains.
- **WR-08 (fixed, confirmed).**
  - `assertSafeConfig` runs before any DB access and refuses a missing, blank or `*` origin under production, after trimming.
  - `resolveCorsOrigin` is independently fail-closed, and the schema default is gone.
  - Case variants of `NODE_ENV`, such as `Production`, are refused as unknown.

New findings are one warning (raw error messages reach clients on 500) and a few info items. Previously open items that live in the reviewed files, or that I could confirm from them, are re-raised below under their original IDs.

## Warnings

### WR-02: Authentication runs in preHandler, after body parsing and schema validation (still open)

**File:** `packages/api/src/routes/auth.js:8,26` (same pattern in `workspaces.js:27` and `projects.js:30`)
**Issue:** `authenticate` and `setRequestContext` are `preHandler` hooks. An unauthenticated caller can therefore make the server parse a JSON body and run schema validation before getting a 401. This is unchanged since the last round, and the new `setRequestContext` and settle-guard wiring does not address it.
**Fix:** Run `authenticate` in `onRequest` (or `preParsing`/`preValidation`) and keep `setRequestContext` in `preHandler`. For example, register `authenticate` as an `onRequest` hook in the scope that holds the tenant routes, and keep `setRequestContext` after validation.

### WR-11: The default error handler returns raw pg and pool error messages to clients on 500

**File:** `packages/api/src/plugins/context.js:68-88,119` and `packages/api/src/server.js` (no `setErrorHandler` anywhere in `src/`)
**Issue:** Fastify's default error handler serializes `err.message` for 5xx responses too. The new failure paths make this reachable: a pool saturation timeout (`timeout exceeded when trying to connect`), a COMMIT failure (`COMMIT was turned into ROLLBACK`), and any raw pg error that a handler lets propagate. The pg errors can include constraint names, column names and role or host details. The response also does not follow the project error shape `{ error, message }`. The tests only assert `statusCode === 500`.
**Fix:** Register one root error handler that logs the error and sends a generic body for status >= 500. Pool exhaustion could additionally map to 503.
```js
fastify.setErrorHandler((err, request, reply) => {
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  if (status >= 500) {
    request.log.error({ err }, 'unhandled error');
    return reply.status(status).send({ error: 'Internal Server Error', message: 'Internal server error' });
  }
  return reply.status(status).send({ error: err.code ?? 'Bad Request', message: err.message });
});
```
Add a test that a forced failure (for example `write-then-throw`) does not echo the thrown message.

## Info

### IN-02: CLI listen port ignores validated config (still open)

**File:** `packages/api/src/server.js:99`
**Issue:** The CLI guard listens on `Number(process.env.PORT) || 4000` instead of the validated `app.config.PORT`. An invalid `PORT` fails in `@fastify/env`, but a `PORT=0` or `PORT=` value silently becomes 4000.
**Fix:** `await app.listen({ port: app.config.PORT, host: '0.0.0.0' });`

### IN-03: build() leaks the pool when registration fails after the role check (still open)

**File:** `packages/api/src/server.js:54-74`
**Issue:** The `onClose` hook that ends the pool is added only after the role check succeeds. If `fastifyCors`, `rbacPlugin` or `contextPlugin` registration throws (for example a bad `AUTH_TEST_JWKS`, thrown from `authPlugin`), `build()` rejects. The Fastify instance is never closed and the pool is never ended. The process stays alive on idle connections, and in tests this hangs the run.
**Fix:** Register `onClose` right after `createPool`, and wrap the remaining registration in `try { ... } catch (err) { await fastify.close(); throw err; }`. Keep the existing `pool.end()` in the role-check catch only if `onClose` is registered after it, so the pool is not ended twice.

### IN-05: The client never sends X-Org-Id (still open)

**File:** `packages/app/src/api/client.ts` (no occurrence of `X-Org-Id` or `orgId` under `packages/app/src`), consumed by `packages/api/src/plugins/context.js:55-61`
**Issue:** The server supports org selection through the header or query. A user with several memberships can only ever act in their oldest org, because the app never names one.
**Fix:** Send `X-Org-Id` from the active-org state in the fetch wrapper.

### IN-06: Org-id validation is stricter than route param validation (still open)

**File:** `packages/api/src/plugins/context.js:27`
**Issue:** `UUID_REGEX` accepts only version nibbles 1-5 and variants 8, 9, a, b. A valid RFC 9562 UUID (v6, v7, v8, or the nil/max UUIDs) is answered with 400 `INVALID_ORG_ID`. The Postgres `uuid` type accepts these, so this works today only because ids come from `gen_random_uuid()` (v4).
**Fix:** Use a format-only pattern, `/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i`, and let the membership lookup decide.

### IN-07: A CORS_ORIGIN that is not a single bare origin passes the boot check and then matches nothing

**File:** `packages/api/src/db/bootChecks.js:49-52,62-67`, `packages/api/.env.example:15-16`
**Issue:** The production check only rejects blank and `*`. A comma-separated list (`https://a.com,https://b.com`), a trailing slash (`https://app.example.com/`) or a value without a scheme is registered as the literal allowed origin. No browser request ever matches it, so CORS fails closed with no startup signal. The logic is also duplicated between `assertSafeConfig` and `resolveCorsOrigin`.
**Fix:** In `assertSafeConfig`, validate the value with `new URL(origin)`, require `origin === url.origin`, and refuse otherwise. Alternatively, split on commas and pass an array. Have `assertSafeConfig` call `resolveCorsOrigin` so the rule lives in one place.

### IN-08: APP_DB_POOL_MAX has no lower bound

**File:** `packages/api/src/server.js:22`, `packages/api/src/db/client.js:14`
**Issue:** The schema type is `integer` with no `minimum`. A negative value makes pg-pool consider itself full permanently, so every request waits the 5 s connect timeout and fails. `0` silently becomes pg's default of 10.
**Fix:** `APP_DB_POOL_MAX: { type: 'integer', default: 10, minimum: 1 }`.

### IN-09: A failed ROLLBACK turns a 4xx into a 500 and hides the original status

**File:** `packages/api/src/plugins/context.js:87,213-216`
**Issue:** `finishTenantTx` rethrows on any failure, including a ROLLBACK that runs after a 401/403/409 response was already decided. The caller then sees a 500 for what was an intended client error. The connection is correctly destroyed, so this is a status-accuracy problem only. The 500 is only observable when the backend died mid-request, so it is rare.
**Fix:** For `commit === false`, log the failure and do not rethrow. Rethrow only when a COMMIT fails, where a 5xx is the correct answer.

## Carried forward, not re-examined this round

These open items live outside the reviewed files and stay open per `01-REVIEW-DISPOSITION.md`: CR-02, WR-03, WR-04, WR-05, WR-07, WR-09, WR-10, IN-01, IN-04.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
