---
last_mapped_commit: 5417afd472e5eee222814acb47d071e02ec5f57a
last_mapped_at: 2026-10-24
---
# Codebase Concerns

**Analysis Date:** 2026-10-24

## Tech Debt

**Duplicated business logic between Lite and SaaS:**
- Issue: `js/core/` (timeline, stats, dependencies, workflow, viewModel) and `packages/app/src/lib/` (timeline.ts, stats.ts, dependencyGraph.ts, projectFilters.ts, timelineSort.ts) implement the same rules in two languages with no shared source. Roughly 2,300 lines of logic are maintained in parallel.
- Files: `js/core/timeline.js`, `js/core/stats.js`, `js/core/dependencies.js`, `packages/app/src/lib/timeline.ts`, `packages/app/src/lib/stats.ts`, `packages/app/src/lib/dependencyGraph.ts`
- Impact: Fixes applied to one side silently diverge from the other. AGENTS.md requires logic fixes in both, but nothing enforces it. Date handling and dependency cycle rules are the most likely to drift.
- Fix approach: Move pure rules into a shared package (e.g. `packages/tokens`-style `packages/core`) consumed by both, or add cross-implementation fixture tests that run the same inputs through `js/core` and `packages/app/src/lib` and compare outputs.

**Dead and empty files:**
- Issue: `js/workers/dependencyWorker.js` is a 0-byte file and nothing in `js/` instantiates a `Worker`.
- Files: `js/workers/dependencyWorker.js`
- Impact: Misleading signal that dependency computation is off-thread; a future change may assume a worker exists.
- Fix approach: Delete the file, or implement the worker if off-main-thread dependency computation is needed.

**Global window exports in Lite core:**
- Issue: `js/core/timeline.js` and `js/roadmap.utils.js` attach functions to `window` (`parseDate`, `formatShortDate`, `calculatePosition`, etc.), and `js/app.js` exposes `setDateRange`, `escapeHtmlAttr`, `infoIconSVG` the same way. Inline `onclick="..."` handlers in UI templates depend on these globals (e.g. `js/ui/timelineGrid.js`, `js/ui/exportControls.js`, `js/ui/dashboard.js`).
- Files: `js/core/timeline.js`, `js/roadmap.utils.js`, `js/app.js`, `js/ui/timelineGrid.js`, `js/ui/exportControls.js`, `js/ui/dashboard.js`
- Impact: Violates the "`js/core/` is pure, no DOM" rule in spirit (core modules touch `window`), and makes the UI hard to test or refactor. Global name collisions are possible.
- Fix approach: Replace inline handlers with delegated event listeners bound in `js/app.js`; remove `window.*` assignments from core modules once no template references them.

**Test coverage is thin for the SaaS packages:**
- Issue: Only 13 test files exist across the repo. Lite has tests for core modules and `AppState` only. `packages/app` has a single test (`packages/app/src/api/client.test.ts`); its components, hooks and `lib/` are untested.
- Files: `tests/`, `packages/api/tests/`, `packages/app/src/api/client.test.ts`
- Impact: Logic drift and regressions in `packages/app/src/lib/` and in React components go unnoticed. CI runs `npx tsc --noEmit`, tests, then build, but tests cover little.
- Fix approach: Add unit tests for each `packages/app/src/lib/*.ts` module, mirroring the `tests/core/*.test.js` cases.

## Known Bugs

**Dependency worker file is referenced in docs but empty:**
- Symptoms: Any code or docs expecting `dependencyWorker` to compute graphs will get an empty module.
- Files: `js/workers/dependencyWorker.js`
- Trigger: Importing or constructing the worker.
- Workaround: None needed while nothing references it; see Tech Debt above.

**Development-only org bootstrap bypasses RLS:**
- Symptoms: In `NODE_ENV=development`, users with no org get a "Dev Default" org created via a direct `pool.connect()` with `SET LOCAL row_security = off`, and an admin membership is inserted.
- Files: `packages/api/src/plugins/context.js` (dev branch in `setRequestContext`)
- Trigger: Any authenticated request from a user without `org_members` rows while `NODE_ENV=development`.
- Workaround: Run with a non-development `NODE_ENV` or seed memberships. Risk only if a development environment is exposed or the flag is misconfigured in a deployed environment.

## Security Considerations

**Session variables set with string interpolation:**
- Risk: `SET LOCAL app.current_org_id` and `app.current_user_id` are built with template strings. Injection is currently blocked only by the `isValidUuid` guard on lines around the `SET LOCAL` calls. If that guard is removed or loosened, or `resolvedOrgId` comes from an unvalidated source in a new code path, arbitrary SQL can run on the request connection.
- Files: `packages/api/src/plugins/context.js` (the two `client.query(\`SET LOCAL ...\`)` calls)
- Current mitigation: UUID regex check on `resolvedOrgId` and `row.id` before the statements.
- Recommendations: Use parameterized `set_config('app.current_org_id', $1, true)` and `set_config('app.current_user_id', $2, true)`, which also removes the dependency on regex validation.

**`SET LOCAL` outside an explicit transaction:**
- Risk: `SET LOCAL` only lasts for the current transaction. The request path in `setRequestContext` does not appear to open a `BEGIN` on `request.dbClient`. In autocommit mode the session variables would apply only to the single statement, so RLS policies that read `current_setting('app.current_org_id')` in later queries may see unset values. The explicit `BEGIN` found in `packages/api/src/db/migrate.js` is for migrations only.
- Files: `packages/api/src/plugins/context.js`, `packages/api/src/routes/projects.js`, `packages/api/src/routes/workspaces.js`
- Current mitigation: Unverified from this analysis. The RLS test suite (`packages/api/tests/rls.test.js`) is the place to confirm it.
- Recommendations: Confirm with `rls.test.js` and by logging `current_setting` inside a handler. If confirmed, wrap each request in `BEGIN`/`COMMIT` on `request.dbClient` (or use `set_config(..., true)` inside an explicit transaction) and roll back on error.

**Auth test bypass header:**
- Risk: `packages/api/src/plugins/auth.js` accepts an `X-Test-User-Sub` header that impersonates any user when `NODE_ENV` is `test` or `development`. A misconfigured deployment with `NODE_ENV=development` exposes full impersonation.
- Files: `packages/api/src/plugins/auth.js`
- Current mitigation: Gated on `NODE_ENV`; disabled when `NODE_ENV=production`.
- Recommendations: Gate the bypass on an explicit opt-in flag (e.g. `ALLOW_TEST_AUTH=1`) that is never set in shared environments, and fail startup when it is set in production-like config.

**CORS origin and rate limiting:**
- Risk: `packages/api/src/server.js` registers `@fastify/cors` with `origin: fastify.config.CORS_ORIGIN` and listens on `0.0.0.0`. No rate limiting or security-header plugin is registered.
- Files: `packages/api/src/server.js`
- Current mitigation: Auth0 JWT required on `/api/v1` routes (`packages/api/src/plugins/auth.js`).
- Recommendations: Add `@fastify/rate-limit` and `@fastify/helmet`; validate that `CORS_ORIGIN` is not `*` in production config.

**Unsafe HTML rendering in Lite:**
- Risk: Lite builds UI with `html` tagged templates and `raw()` to inject SVG and pre-rendered strings. `raw()` skips escaping, so any user-controlled text (project names, descriptions, links, owners) that reaches a `raw(...)` argument becomes XSS. `js/app.js` also assigns `document.body.innerHTML = pageHTML`.
- Files: `js/ui/renderer.js`, `js/ui/timelineGrid.js` (lines around 85–142), `js/ui/dashboard.js` (lines around 30–83), `js/ui/exportControls.js`, `js/app.js` (line 121)
- Current mitigation: `escapeHtml` in `js/ui/renderer.js`; `escapeHtmlAttr` exported from `js/app.js`. Interpolated values in plain `${}` positions are escaped.
- Recommendations: Audit each `raw(html\`...\`)` call so that only static SVG constants or already-escaped strings are wrapped. Escape `vm.name`, `upcomingItem.source` and `vm.link` explicitly. Note `href="${vm.link}"` should allow only `http:`/`https:` schemes.

**Inline handlers with interpolated names:**
- Risk: `onclick="toggleDependencyGraph('${vm.name}', event)"` in `js/ui/timelineGrid.js` interpolates a project name into a JavaScript string inside an HTML attribute. A name containing a quote or `</` breaks the handler or allows script injection.
- Files: `js/ui/timelineGrid.js` (line 85)
- Current mitigation: None visible.
- Recommendations: Pass an index or `data-` attribute and look up the name in state, instead of interpolating it into script.

**Config secrets and data in build output:**
- Risk: `npm run build` copies `js/config.js` into `dist/js/`. `js/config.js` is user data and is gitignored, but its contents ship to any static host with the build output.
- Files: `package.json` (`build` script), `.gitignore`
- Current mitigation: `js/config.js` is gitignored, so it is not committed.
- Recommendations: Document that `dist/` must not be published with private roadmap data, or make the build fail when `js/config.js` contains private fields.

## Performance Bottlenecks

**Full re-render on every Lite state change:**
- Problem: AGENTS.md mandates that Lite state changes call a full `renderRoadmap()`. Every filter, zoom or drag re-renders the whole timeline grid and dependency arrows.
- Files: `js/app.js`, `js/ui/renderer.js`, `js/ui/timelineGrid.js`, `js/ui/dependencyArrows.js`
- Cause: No incremental DOM update and no memoization of view-model output in `js/core/viewModel.js`.
- Improvement path: Memoize `viewModel` output keyed on state slices, and skip re-rendering unchanged sections (dashboard vs timeline) at the `renderRoadmap()` level.

**Dependency arrow computation on the main thread:**
- Problem: Dependency routing in `js/core/dependencies.js` (310 lines) and `packages/app/src/components/timeline/DependencyArrows.tsx` runs synchronously during render.
- Files: `js/core/dependencies.js`, `js/ui/dependencyArrows.js`, `packages/app/src/components/timeline/DependencyArrows.tsx`
- Cause: The intended worker (`js/workers/dependencyWorker.js`) is empty.
- Improvement path: Implement the worker, or cache routed paths per project-set hash.

**Large monolithic timeline component:**
- Problem: `packages/app/src/components/timeline/GanttTimeline.tsx` is 462 lines and mixes layout, drag, grouping and export hooks.
- Files: `packages/app/src/components/timeline/GanttTimeline.tsx`
- Cause: Single component owns most timeline state.
- Improvement path: Split row layout, bar interaction and milestone rendering into separate components and hooks.

## Fragile Areas

**RLS and session-variable coupling:**
- Files: `packages/api/src/plugins/context.js`, `packages/api/src/db/migrations/V2__rls_policies.sql`, `V4__app_role.sql`, `V6__force_rls.sql`
- Why fragile: Correctness depends on the request connection carrying `app.current_org_id` and `app.current_user_id`, on the app role being NOSUPERUSER (superusers bypass RLS), and on `FORCE ROW LEVEL SECURITY` being applied. Any new route that uses `pool` instead of `request.dbClient` silently loses the session vars.
- Safe modification: Always use `request.dbClient` in route handlers. Run `packages/api/tests/rls.test.js` after any change to context or migrations. Never grant the app role `BYPASSRLS` or superuser.
- Test coverage: RLS tests exist; the pool-vs-dbClient rule has no lint or test enforcement.

**Migration sequence with data backfills:**
- Files: `packages/api/src/db/migrations/V7__seed_projects_from_config.sql`, `V8__add_users_to_seed_org.sql`, `V9__backfill_workspace_workflows.sql`, `V10__dependencies_index_and_seed.sql`, `V11__seed_dependencies_from_config.sql`, `V12__backfill_group_order.sql`
- Why fragile: Six migrations seed or backfill data from config. Re-running on a database with edited data, or running them out of order on a fresh DB, produces different results. Only `V1`–`V6` are schema-focused.
- Safe modification: Never edit an applied migration. Add a new `V13__...` migration for corrections. Keep `migrations/README.md` current.
- Test coverage: Not detected for migration idempotency.

**Config schema and validator drift:**
- Files: `schema/config.schema.json`, `js/core/configValidator.js`, `scripts/validate-config.js`, `scripts/validate-config.mjs`, `packages/api/scripts/generate-config-seed.mjs`
- Why fragile: Two validator scripts exist (`validate-config.js` and `validate-config.mjs`), and `configValidator.js` may duplicate schema rules that `ajv` checks in `scripts/validate-config.mjs`. The API seed generator reads the same config independently.
- Safe modification: Make `scripts/validate-config.mjs` the single entry point, and remove or redirect `validate-config.js`.
- Test coverage: `tests/core/configValidator.test.js` covers the Lite validator only.

**Duplicate Lite/SaaS logic (see Tech Debt):**
- Files: `js/core/*.js`, `packages/app/src/lib/*.ts`
- Why fragile: Any date or dependency edge-case fix must be made twice.
- Safe modification: Change one side, then add the same fixture case to the other side's tests.

## Scaling Limits

**Single-process API with pooled connections:**
- Current capacity: Not measured. `pg` pool size is the default unless configured in `packages/api/src/db/client.js`.
- Limit: Each authenticated request holds a pool client for its full duration (`pool.connect()` in `setRequestContext`, released on response finish). Slow handlers exhaust the pool under load.
- Scaling path: Set an explicit `max` on the pool, add request timeouts, and keep handlers short.

**Lite data in a single config file:**
- Current capacity: All projects, milestones and dependencies load into one `js/config.js` and are fully re-rendered on each change.
- Limit: Practical limit is the size at which the full re-render becomes noticeable; not measured.
- Scaling path: Use SaaS for larger portfolios; for Lite, paginate or virtualize the timeline rows.

## Dependencies at Risk

**Unused or overlapping API dependencies:**
- Risk: `packages/api/package.json` lists `@fastify/jwt` alongside `jose`. Auth verification in `packages/api/src/plugins/auth.js` uses `jose` only.
- Impact: Extra attack surface and bundle size; possible confusion about which JWT library is authoritative.
- Migration plan: Confirm with a search for `@fastify/jwt` usage, then remove it if unused.

**Node version pinning:**
- Risk: Root CI runs on Node 20. Dependencies such as `vite` 7 and `fastify` 5 may require newer Node versions for some tooling.
- Impact: CI and local runs may diverge.
- Migration plan: Declare `engines` in each `package.json` and align `.github/workflows/*.yml` to the same version.

## Missing Critical Features

**No structured logging or error tracking for the API:**
- Problem: Only Fastify's default logger is used, and `auth.js` logs JWT failures with `fastify.log.warn`. No error tracker is configured.
- Blocks: Diagnosing RLS or session-variable failures in production.

**No pagination on list endpoints:**
- Problem: `packages/api/src/routes/projects.js` and `workspaces.js` return full collections. Not verified against a large fixture.
- Blocks: Large organizations will see slow responses and large payloads.

## Test Coverage Gaps

**Lite UI modules:**
- What's not tested: `js/ui/*.js` (renderer, timelineGrid, dashboard, filterBar, exportControls) and `js/export/*.js`.
- Files: `js/ui/timelineGrid.js`, `js/ui/dashboard.js`, `js/export/png.js`
- Risk: XSS regressions in `raw()` call sites and export regressions go unnoticed.
- Priority: High

**API route handlers under RLS:**
- What's not tested: Cross-tenant write attempts through `packages/api/src/routes/projects.js` and `workspaces.js` with mismatched `X-Org-Id`.
- Files: `packages/api/tests/projects.test.js`, `packages/api/tests/workspaces.test.js`, `packages/api/tests/rls.test.js`
- Risk: Tenant isolation regressions.
- Priority: High

**React app components and hooks:**
- What's not tested: `packages/app/src/components/**`, `packages/app/src/hooks/**`, `packages/app/src/lib/**`.
- Files: `packages/app/src/components/timeline/GanttTimeline.tsx`, `packages/app/src/hooks/useProjectMutations.ts`, `packages/app/src/lib/timeline.ts`
- Risk: Timeline and mutation regressions reach users.
- Priority: Medium

---

*Concerns audit: 2026-10-24*
