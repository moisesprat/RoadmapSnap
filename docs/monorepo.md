# Monorepo layout

This repository is one npm workspace (`packages/*`) with a single root `package-lock.json`. It contains two products and the code they share:

| Product | Location | Description |
|--------|----------|-------------|
| **RoadmapSnap Lite** | Repository root | Backend-free, client-side roadmap dashboard, delivered by the Vite build (`dist/`) |
| **RoadmapSnap SaaS** | `packages/api/`, `packages/app/` | Multi-tenant API and React frontend (under development) |
| **Shared core** | `packages/core/` | `@roadmapsnap/core`: shared roadmap logic (dates, timeline math and more), plain ESM + JSDoc, zero dependencies, used by Lite and the app |
| **Design tokens** | `packages/tokens/` | `@roadmapsnap/tokens`: shared CSS tokens consumed by the app and Lite |

---

## Install

Install once, at the repository root:

```bash
npm install
```

There is one root lockfile and no per-package installs: do not run `npm install` inside `packages/*`. Node.js 24 or newer is required (`engines.node` is `>=24` in every package, and every CI workflow runs Node 24).

---

## RoadmapSnap Lite (root)

Lite is **backend-free and always will be**. It is driven by `index.html` and `js/config.js`. No server, no database.

- **Root `package.json`** holds the Lite scripts (`dev`, `build`, `test`, `validate`, etc.) and declares the workspaces.
- Lite imports `@roadmapsnap/core` (and never anything from the SaaS packages; `tests/guards/lite-isolation.test.js` enforces it).
- Lite is delivered by `npm run build` into `dist/`. Serving the raw repository root, or opening `index.html` without a build, is no longer supported because the bare `@roadmapsnap/core` specifier is resolved by Vite. `npm run dev` keeps working.

---

## Shared core and SaaS (`packages/`)

- **`packages/core/`** is the shared roadmap logic: plain ESM + JSDoc with zero dependencies. Lite binds to it through the bare specifier `@roadmapsnap/core`; the app consumes generated `.d.ts` types. Its tests run in the root `npm test`.
- **`packages/api/`** is the Fastify + PostgreSQL + Auth0 backend: multi-tenant API (organizations, workspaces, projects), RBAC and row-level security.
- **`packages/app/`** is the React + TypeScript + Vite frontend with TanStack Query and TailwindCSS.
- **`packages/tokens/`** holds shared CSS design tokens.

**To work on the API or app** (from the repo root, after `npm install`):

```bash
npm run dev -w @roadmapsnap/api   # Fastify on port 4000
npm run dev -w @roadmapsnap/app   # Vite on port 3001
```

---

## CI

All workflows run on Node 24 and install from the single root lockfile.

| Workflow | Triggers | Install | Runs |
|----------|----------|---------|------|
| `ci.yml` (Lite + core) | Every push and pull request, no path filter | `npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root` | `npm test`, core typecheck, `npm run validate`, `npm run build` |
| `app-ci.yml` | Every push and pull request | `npm ci -w @roadmapsnap/app` | typecheck, tests, build (`-w @roadmapsnap/app`) |
| `api-ci.yml` | Path-filtered (`packages/api/**`, root manifest and lockfile, the workflow) | `npm ci -w @roadmapsnap/api` | migrate, tests, timezone tests (`-w @roadmapsnap/api`) |

`ci.yml` has no path filter on purpose: a change under `packages/core` or `packages/tokens` must always run the Lite tests. `tests/guards/ci-config.test.js` keeps these shapes in place.

---

## Docker

The API image builds from the repository root (`docker build -f packages/api/Dockerfile .`, which is what `compose.yaml` does). The root `.dockerignore` is an allowlist: only package manifests, the root lockfile and `packages/api/src` enter the build context, so `.env`, `js/config.js` and the working tree cannot leak into an image layer.

---

## Directory tree

```
RoadmapSnap/
├── index.html
├── package.json          # Workspace root + Lite: dev, build, test
├── package-lock.json     # The only lockfile
├── .dockerignore         # Allowlist context for the API image
├── compose.yaml
├── vite.config.js
├── js/
│   ├── app.js
│   ├── config.js
│   └── ...
├── css/
├── tests/
├── docs/
│   ├── monorepo.md
│   └── ...
├── schema/
├── scripts/
├── packages/
│   ├── core/              # Shared roadmap logic (@roadmapsnap/core)
│   ├── api/               # RoadmapSnap SaaS backend
│   ├── app/               # RoadmapSnap SaaS frontend
│   └── tokens/            # Shared design tokens
└── .github/
    └── workflows/
        ├── ci.yml          # Lite + core CI (always runs)
        ├── api-ci.yml      # packages/api CI
        └── app-ci.yml      # packages/app CI
```
