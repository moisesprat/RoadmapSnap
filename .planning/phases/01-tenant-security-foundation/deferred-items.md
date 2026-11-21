# Phase 01: Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by the plan that found them.

## Found during 01-10

### Intermittent "tuple concurrently updated" in the API test suite

- **Symptom:** `npm --prefix packages/api test` fails now and then (seen on 3 of 11 full runs, a cold first run each time it happened). `seed-dev.test.js` fails in `before()` with `error: tuple concurrently updated` raised from `migrate()` (`packages/api/src/db/migrate.js:72`), which cancels the seed-dev suites (14 cancelled tests, 0 reported failures). Rerunning goes green.
- **Likely cause:** `node --test tests/*.test.js` runs test files in parallel processes against one Postgres, and more than one file runs migrations or creates and drops roles at once (`boot-checks.test.js`, `seed-dev.test.js`, helpers). Postgres reports this error when two sessions update the same catalog tuple at the same time.
- **Why deferred:** not caused by 01-10 (rbac.js, bootChecks.js, server.js, new tests only). It is a test-infrastructure race that needs serialization or a migration advisory lock, which is a separate decision.
- **Suggested follow-up:** take `pg_advisory_lock` in `migrate()` around the migration run, or run the DB-touching test files with `--test-concurrency=1`.
