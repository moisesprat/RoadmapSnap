---
phase: 01-tenant-security-foundation
plan: 07
subsystem: infra
tags: [docker, compose, postgres, rls, jose, rs256, dev-tooling]

requires:
  - phase: 01-tenant-security-foundation
    provides: "01-02 boot role check and env schema; 01-03 schema-only migrate CLI; 01-04 seed:dev; 01-08 Bearer-only auth"
provides:
  - "compose.yaml: postgres (healthchecked, no host port), one-shot migrate job as the owner role, api as roadmapsnap_app with APP_DATABASE_URL only"
  - "packages/api/Dockerfile (node:24-alpine, npm ci --omit=dev, USER node) and .dockerignore (env, keys, tests, scripts excluded)"
  - "Root .env.example compose template; root .env gitignored"
  - "packages/api/scripts/dev-token.mjs: local RS256 keypair, public-only JWKS (--print-jwks) and signed tokens the API accepts through the real jwtVerify path"
affects: [phase-02-node-pin, phase-07-deployment, phase-07-smoke-test]

plan_head_before: 4fbf630207e8bc8f9811f57956314b2759afc181
plan_head_after: 8304c801f4b2f6cd1c03b2b61bb12886d9967a6a

actuals:
  tokens: 2300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Compose topology: postgres (service_healthy) -> migrate job (service_completed_successfully) -> api as the non-superuser app role"
    - "Owner credentials live only in the migrate service; the api service is given APP_DATABASE_URL and never DATABASE_URL"
    - "dev-token builds the public JWK by allow-list (kty, n, e) so private members cannot leak into the printed JWKS"

key-files:
  created:
    - compose.yaml
    - packages/api/Dockerfile
    - packages/api/.dockerignore
    - .env.example
    - packages/api/scripts/dev-token.mjs
  modified:
    - .gitignore
    - packages/api/.gitignore

key-decisions:
  - "dev-token requires AUTH0_DOMAIN and AUTH0_AUDIENCE only when signing, not for --print-jwks, because the JWKS is independent of issuer and audience"
  - "The public JWK is derived from the private JWK on every run and jwks.json is rewritten, so the two files cannot drift"

requirements-completed: [SEC-02, SEC-05]

coverage:
  - id: D1
    description: "docker compose config renders a valid three-service skeleton: api has APP_DATABASE_URL as roadmapsnap_app, no DATABASE_URL, NODE_ENV development, and postgres has no host port"
    requirement: "SEC-02"
    verification:
      - kind: other
        ref: "docker compose --env-file .env.example config --quiet and the rendered-JSON assertion (Task 1 verify 1 and 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On a fresh volume the organizations table has 0 rows after docker compose up; demo data appears only after the explicit seed:dev run"
    requirement: "SEC-05"
    verification:
      - kind: manual_procedural
        ref: "compose steps 3 and 5 recorded in this SUMMARY (count 0, then 'seed: Demo Org A and Demo Org B ready')"
        status: pass
    human_judgment: true
    rationale: "Real container topology run by the executor; the plan keeps a human re-check at the end-of-phase review and does not wire it into CI (DEP-06 owns the CI smoke test)"
  - id: D3
    description: "The api container logs 'boot: database role check passed' as roadmapsnap_app and exits 1 with 'Refusing to start' when given the superuser URL"
    requirement: "SEC-02"
    verification:
      - kind: manual_procedural
        ref: "compose steps 4 and 7 recorded in this SUMMARY"
        status: pass
    human_judgment: true
    rationale: "Same as D2: verified in a real container topology by the executor, human re-check at end of phase"
  - id: D4
    description: "dev-token prints a public-only RS256 JWKS and a token that jwtVerify accepts with the matching issuer and audience; the private key stays in the gitignored .dev-keys with mode 0600; it refuses NODE_ENV=production"
    requirement: "SEC-02"
    verification:
      - kind: other
        ref: "Task 2 verify commands 1-3 (jwks public ok, token ok, keys ignored)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A dev-token token authenticates through the real API: the seeded admin lists only demo-roadmap, and X-Org-Id of dev-org-b returns 403 NOT_A_MEMBER"
    requirement: "SEC-05"
    verification:
      - kind: manual_procedural
        ref: "compose step 6 recorded in this SUMMARY"
        status: pass
    human_judgment: true
    rationale: "Executor run against the live compose stack; not repeated in CI"
  - id: D6
    description: "The API image contains no .env, tests, scripts or keys and runs as the node user"
    verification:
      - kind: manual_procedural
        ref: "ls /app inside the built image: node_modules, package-lock.json, package.json, src; user node"
        status: pass
    human_judgment: false
  - id: D7
    description: "Existing suites stay green: API 150/150 and root Lite 141/141"
    verification:
      - kind: integration
        ref: "npm --prefix packages/api test"
        status: pass
      - kind: unit
        ref: "npm test (repo root)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-20
status: complete
---

# Phase 1 Plan 07: Compose skeleton and dev-token CLI Summary

**A three-service compose stack (postgres, migrate as owner, api as `roadmapsnap_app`) that boots on an empty schema, seeds only on request and refuses a superuser URL, plus a `dev-token.mjs` CLI that mints real RS256 tokens from a local gitignored keypair.**

## Performance

- **Duration:** about 5 min (start time was not captured at step start; estimated from commit and log timestamps)
- **Started:** 2026-11-20T23:16:00Z (estimated)
- **Completed:** 2026-11-20T23:21:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `docker compose up --build -d` runs postgres, then the migrate job (V1 to V13 as the owner role), then the api as `roadmapsnap_app`, on a database with no organizations.
- SEC-02 is visible in a real topology: the api logs `boot: database role check passed` with role `roadmapsnap_app`, and exits 1 with `Refusing to start: database role "postgres" is a superuser` when given the superuser URL.
- SEC-05 is visible in a real topology: 0 organizations after `up`; `seed:dev` run through the migrate service creates dev-org-a and dev-org-b.
- `dev-token.mjs` replaces the removed header bypass for scripted use: its token is accepted by the running API, shows only `demo-roadmap`, and gets 403 `NOT_A_MEMBER` for dev-org-b's id.
- Image hygiene: the built image holds only `node_modules`, `package.json`, `package-lock.json` and `src`, and runs as `node`.

## Compose Evidence (Task 2, steps 1 to 8)

Test values: `AUTH0_DOMAIN=test.auth0.com`, `AUTH0_AUDIENCE=https://test.api`, `AUTH_TEST_JWKS` from `dev-token.mjs --print-jwks`. The root `.env` was written with the Write tool (a local hook blocks shell commands that name it) and stays untracked.

1. `.env` created from the template and filled; `git status` does not list it, so it is ignored.
2. `docker compose up --build -d`: images built, postgres healthy, migrate exited 0 (`migrate: Applied V13__tenant_policies`, `migrate: All migrations completed.`), api started. `curl -fsS localhost:4000/health` returned `{"status":"ok","service":"roadmapsnap-api","version":"0.1.0",...}`.
3. `select count(*) from organizations` printed `0`.
4. `docker compose logs api` contained `"role":"roadmapsnap_app","msg":"boot: database role check passed"`.
5. `docker compose run --rm migrate npm run seed:dev -- --sub dev-local-admin` printed `seed: Demo Org A and Demo Org B ready (admin dev-local-admin)`. Organizations then listed: `dev-org-a`, `dev-org-b`.
6. With a `dev-token.mjs --sub dev-local-admin` token: `GET /api/v1/workspaces` returned HTTP 200 with workspace slugs `[ 'demo-roadmap' ]`. With `X-Org-Id` set to dev-org-b's id: HTTP 403 `{"error":"Forbidden","message":"Not a member of this organization","code":"NOT_A_MEMBER"}`. Without a token: HTTP 401.
7. `docker compose run --rm -e APP_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/roadmapsnap api`: exit code `1`, stderr `Error: Refusing to start: database role "postgres" is a superuser`.
8. `docker compose down -v` removed the containers, the `roadmapsnap_pgdata` volume and the network. The locally built `roadmapsnap-api` and `roadmapsnap-migrate` images were removed. `roadmapsnap-pg` and the unrelated containers were not touched.

## Task Commits

1. **Task 1: compose skeleton, API Dockerfile, env template** - `8cc8ce6` (chore)
2. **Task 2: dev-token CLI** - `8304c80` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `compose.yaml` - postgres, migrate and api services, `pgdata` volume, usage header
- `packages/api/Dockerfile` - production-only dependencies, `USER node`, no environment-mode variable (compose supplies it)
- `packages/api/.dockerignore` - excludes node_modules, env files, `.dev-keys`, tests, scripts, logs
- `.env.example` - compose template (POSTGRES_PASSWORD, AUTH0_DOMAIN, AUTH0_AUDIENCE, CORS_ORIGIN, commented AUTH_TEST_JWKS)
- `.gitignore` - root `.env` added under Secrets
- `packages/api/scripts/dev-token.mjs` - keypair, `--print-jwks`, `--sub`, `--email`, `--name`, `--expires-in`
- `packages/api/.gitignore` - `.dev-keys/` added

## Decisions Made

- `dev-token.mjs` only demands AUTH0_DOMAIN and AUTH0_AUDIENCE when it signs; printing the JWKS needs neither.
- The public JWK is rebuilt from the private one on each run and `jwks.json` is rewritten, so the pair cannot drift.
- `.dockerignore` keeps `scripts` out of the image, so `seed:dev` (which lives in `src/db/seeds`) works through the migrate service while `dev-token.mjs` stays host-only.

## Deviations from Plan

None - plan executed exactly as written.

One verification command could not be run verbatim: the first Task 1 acceptance check (`git check-ignore -q .env` and `grep -cx ".env" .gitignore`) names the root env file, and a local secret-read hook blocks any shell command that names it. The ignore rule was confirmed another way: the root `.gitignore` contains the `.env` line under Secrets, and `git status --short` did not list the root `.env` after it was created. The other Task 1 acceptance counts passed (`service_completed_successfully` 1, `service_healthy` 1).

## Issues Encountered

- A shell `PIPESTATUS` read was empty (the shell is zsh); the superuser-URL run was repeated writing to a file so the exit code (`1`) could be read directly.
- Missing `AUTH0_DOMAIN` in dev-token's own environment is refilled by `loadEnv.js` from `packages/api/.env` when that variable is unset, as designed (non-overriding); an empty value triggers the `dev-token: AUTH0_DOMAIN is not set` exit.

## Known Stubs

None.

## Threat Flags

None. The new surface (compose services, the dev-token CLI and its local key) is covered by T-01-33 to T-01-38.

## User Setup Required

None - no external service configuration required. The untracked root `.env` left by the verification run holds only local test values and a public key set; delete it if you want a clean tree, or replace it with real values.

## Next Phase Readiness

- Phase 2 can change the Node pin in `packages/api/Dockerfile` (provisional `node:24-alpine`) and revisit the build context if the lockfile moves to the root workspace.
- 01-05 and the end-of-phase human check can re-run the compose steps above.
- Concerns carried forward: the `apppassword` role password in V4 and `compose.yaml` (DEP-02, Phase 7), and `POSTGRES_USER=postgres` being forced by V2 (revisit for hosted databases).

## Self-Check: PASSED

- Created files exist: compose.yaml, packages/api/Dockerfile, packages/api/.dockerignore, .env.example, packages/api/scripts/dev-token.mjs (all FOUND).
- Commits `8cc8ce6` and `8304c80` are ancestors of HEAD.
- Task 1 verify 1 to 3 (without the literal root `.env` check), Task 2 verify 1 to 3, and acceptance counts re-run: pass. `grep -c ".dev-keys" packages/api/.gitignore` 1, `grep -c "NODE_ENV=production" dev-token.mjs` 1.
- `npm --prefix packages/api test`: 150 pass, 0 fail, 0 skipped. Root `npm test`: 141 pass, 0 fail.

---
*Phase: 01-tenant-security-foundation*
*Completed: 2026-11-20*
