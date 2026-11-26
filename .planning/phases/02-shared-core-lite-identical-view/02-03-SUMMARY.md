---
phase: 02-shared-core-lite-identical-view
plan: 03
subsystem: infra
tags: [github-actions, npm-workspaces, docker, compose, node-24, ci]

requires:
  - phase: 02-shared-core-lite-identical-view
    provides: "Plan 02-01 root npm workspace, single root lockfile, packages/core, workspace scripts (typecheck, build:types)"
provides:
  - "ci.yml: Lite + core CI with no path filters, Node 24, light workspace install, core typecheck"
  - "app-ci.yml and api-ci.yml on Node 24 using npm ci -w from the root lockfile"
  - "tests/guards/ci-config.test.js: static guard over the workflows, the one-lockfile rule and the .dockerignore allowlist"
  - "API image built from the repo root (manifests stage + npm ci -w @roadmapsnap/api --omit=dev) with an allowlist root .dockerignore"
  - "compose.yaml migrate and api services build with context . and dockerfile packages/api/Dockerfile"
  - "README, docs/monorepo.md and AGENTS.md describing the workspace install, Node 24, Lite delivery via dist/ and the CI shape"
affects: [02-04, 02-15, 02-18, phase-07-deployment]

actuals:
  tokens: 5600
  tasks: 3
  commits: 3
plan_head_before: 732ef2a2fe3f3f18b0064469926e3174c881c0d9
plan_head_after: b12c007f97effb535e2d40acb78b425be789d215

tech-stack:
  added: []
  patterns:
    - "Lite CI always runs (no path filter) on a light install of only core, tokens and the root: npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root"
    - "Per-product CI installs with npm ci -w <workspace> from the single root lockfile"
    - "Allowlist .dockerignore (* then explicit !paths) plus a manifests-only build stage so new workspaces need no Dockerfile edit"

key-files:
  created:
    - tests/guards/ci-config.test.js
    - .dockerignore
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/app-ci.yml
    - .github/workflows/api-ci.yml
    - packages/api/Dockerfile
    - compose.yaml
    - README.md
    - docs/monorepo.md
    - AGENTS.md
  deleted:
    - packages/api/.dockerignore
    - packages/api/package-lock.json
    - packages/app/package-lock.json

key-decisions:
  - "ci.yml has no path filters at all, so a change under packages/core or packages/tokens always runs the Lite tests and a required check never sits Pending (T-02-05)"
  - "api-ci.yml stays path-filtered but now also triggers on root package.json and package-lock.json, since the API install depends on the root lockfile"
  - "API Dockerfile WORKDIR ends at /app/packages/api so the compose commands (node src/db/migrate.js, npm run seed:dev) keep working unchanged"
  - "The Docker build context is an allowlist, so .env, js/config.js, .git and node_modules cannot enter an image layer (T-02-04)"

patterns-established:
  - "Static workflow guards read YAML as text with node:fs, no YAML dependency in the root suite"
  - "Image content assertions in verify: /app/.env, /app/js and /app/node_modules/react must be absent"

requirements-completed: [CORE-03]

coverage:
  - id: D1
    description: "Lite CI runs on every push and pull request with no path filter, on Node 24, with the light workspace install and npm test, core typecheck, validate and build"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/guards/ci-config.test.js#ci.yml runs on every change: no paths / paths-ignore filter"
        status: pass
      - kind: unit
        ref: "tests/guards/ci-config.test.js#ci.yml: Node 24, light workspace install and the Lite + core checks"
        status: pass
    human_judgment: false
  - id: D2
    description: "A clean copy of the tree installed with the Lite CI command (no app or api dependencies) passes npm test (240 pass), core typecheck, validate and build"
    requirement: CORE-03
    verification:
      - kind: other
        ref: "rsync clean copy; npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root; test ! -e node_modules/react; npm test; npm run typecheck -w @roadmapsnap/core; npm run validate; npm run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "App CI and API CI on Node 24 with npm ci -w from the root lockfile; no workflow on Node 20 or using cd packages/*"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/guards/ci-config.test.js (app-ci.yml, api-ci.yml, no workflow is still on Node 20)"
        status: pass
    human_judgment: true
    rationale: "The workflow text is guarded statically; a real GitHub Actions run of app-ci and api-ci on Node 24 has not happened and happens on the first PR push"
  - id: D4
    description: "Exactly one tracked package-lock.json (root); API image builds from the repo root with an allowlist .dockerignore and contains only API source and production dependencies"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/guards/ci-config.test.js#exactly one package-lock.json is tracked: the root one"
        status: pass
      - kind: integration
        ref: "docker build -f packages/api/Dockerfile -t roadmapsnap-api:phase2 . ; docker run ... node -e import fastify,pg,jose,@fastify/cors,@fastify/env -> api deps ok; in-image test ! -e /app/.env, /app/js, /app/node_modules/react"
        status: pass
    human_judgment: false
  - id: D5
    description: "compose.yaml builds migrate and api from the repo root context and the compose file validates"
    requirement: CORE-03
    verification:
      - kind: other
        ref: "AUTH0_DOMAIN=test.auth0.com AUTH0_AUDIENCE=https://test.api POSTGRES_PASSWORD=postgres docker compose --env-file .env.example config --quiet -> compose config ok"
        status: pass
    human_judgment: false
  - id: D6
    description: "README, docs/monorepo.md and AGENTS.md state the root workspace install, Node 24, Lite delivery by npm run build (raw repo root no longer supported) and the CI shape"
    requirement: CORE-03
    verification:
      - kind: other
        ref: "grep acceptance checks (Node.js 24 in README, no Node.js 18+, no longer supported, packages/core in docs/monorepo.md, no Node 20 in AGENTS.md) and npm test (242 pass)"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy and readability of the install and delivery guidance needs a human read; greps only prove the key phrases exist"

duration: 2min
completed: 2026-11-26
status: complete
---

# Phase 2 Plan 03: CI, API image and docs on the workspace layout Summary

**Always-on light Lite CI, Node 24 and the single root lockfile across all three workflows, an allowlist-context API image and compose build from the repo root, and workspace docs, all pinned by a static guard test**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-26T07:47:12Z
- **Completed:** 2026-11-26T07:48:49Z
- **Tasks:** 3
- **Files modified:** 14 (2 created, 9 modified, 3 deleted)

## Accomplishments
- `ci.yml` no longer has any path filter and uses `npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root`, so a core or tokens change always runs Lite tests (CORE-03) without installing React or Fastify.
- `app-ci.yml` and `api-ci.yml` run on Node 24 with `npm ci -w @roadmapsnap/<pkg>` and `-w` scripts; the API workflow also triggers on root manifest and lockfile changes. All env blocks, the postgres service and the app-role step are verbatim.
- API image builds from the repo root with a `manifests` stage and `npm ci -w @roadmapsnap/api --omit=dev`; the root `.dockerignore` is an allowlist; compose uses context `.`; the two per-package lockfiles and `packages/api/.dockerignore` are gone.
- README, `docs/monorepo.md` and AGENTS.md describe the single root install, Node 24, Lite delivery through `dist/` (raw repo root no longer supported) and the CI shape.

## Task Commits

1. **Task 1: Tracer, Lite CI always runs on the light install; every workflow on Node 24 and the root lockfile** - `126ac50` (ci)
2. **Task 2: API image and compose from the repo root with an allowlist context; per-package lockfiles removed** - `9966ecf` (build)
3. **Task 3: Install, delivery and CI docs for the workspace layout** - `b12c007` (docs)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `tests/guards/ci-config.test.js` - static guard: no path filter in ci.yml, required commands per workflow, no Node 20, one tracked lockfile, `.dockerignore` allowlist
- `.dockerignore` - allowlist build context for the API image
- `.github/workflows/ci.yml`, `app-ci.yml`, `api-ci.yml` - Node 24, root lockfile, workspace commands
- `packages/api/Dockerfile` - root-context build with a manifests-only stage
- `compose.yaml` - `migrate` and `api` build from context `.`
- `README.md`, `docs/monorepo.md`, `AGENTS.md` - workspace install, Node 24, delivery and CI documentation

## Decisions Made
- ci.yml carries no path filters at all (T-02-05); api-ci.yml stays path-filtered and gains `package.json` and `package-lock.json` triggers.
- Dockerfile final `WORKDIR` is `/app/packages/api`, keeping `node src/db/migrate.js` and `npm run seed:dev` working unchanged from compose.
- The guard test was built in two steps to match the plan: the workflow assertions with Task 1 (RED then GREEN), the lockfile and `.dockerignore` assertions added with Task 2.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The local toolchain is Node 26, not 24, so the clean-copy simulation and Docker-free checks ran on Node 26; the image build ran on `node:24-alpine`. A real Node 24 run happens on the first PR push.
- A real GitHub Actions run of app-ci and api-ci was not possible locally; the workflows are verified by the guard and by running the same commands the workflows run (Lite path fully, API install inside the image).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required. Flagged for the verifier: whether GitHub branch protection marks `ci` as a required check is a repository setting outside this plan.

## Next Phase Readiness
- Plans that touch `packages/core` are covered by an always-on Lite CI and a core typecheck.
- AGENTS.md still carries the "`packages/app/src/lib/` mirrors `js/core/`" bullet by design; plan 02-15 retires it.
- `compose.yaml` header note about Phase 2 lockfile ownership was already absent; nothing else to hand off.

## Self-Check: PASSED

- FOUND: tests/guards/ci-config.test.js, .dockerignore, packages/api/Dockerfile, docs/monorepo.md
- FOUND commits: 126ac50, 9966ecf, b12c007
- Deleted as planned: packages/api/package-lock.json, packages/app/package-lock.json, packages/api/.dockerignore
- npm test: 242 pass, 0 fail; guard: 7 pass, 0 fail

---
*Phase: 02-shared-core-lite-identical-view*
*Completed: 2026-11-26*
