# Monorepo layout

This repository is one npm workspace (`packages/*`) with a single root `package-lock.json`. It contains two products and the code they share:

| Product | Location | Description |
|--------|----------|-------------|
| **RoadmapSnap Lite** | Repository root | Backend-free, client-side roadmap dashboard, delivered by the Vite build (`dist/`) |
| **RoadmapSnap SaaS** | `packages/api/`, `packages/app/` | Multi-tenant API and React frontend (under development) |
| **Shared core** | `packages/core/` | `@roadmapsnap/core`: the single source of shared roadmap logic (dates, timeline math, workflow, dependencies, stats, filters, view models, exports), plain ESM + JSDoc, zero dependencies, used by Lite and the app |
| **Design tokens** | `packages/tokens/` | `@roadmapsnap/tokens`: shared CSS tokens and all theme CSS consumed by the app and Lite; both products select a theme with `[data-theme]` on `<html>` |
| **Parity suite** | `packages/parity/` | `@roadmapsnap/parity`: Playwright suite that renders Lite and the SaaS page side by side and compares screenshots |

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
- **`packages/tokens/`** holds shared CSS design tokens and the theme CSS for both products.
- **`packages/parity/`** is the Lite-vs-SaaS screenshot suite (see "Parity suite" below).

`packages/core` is the single source of shared logic: a roadmap rule (timeline, workflow, dependencies, stats, filters, view model, export) is fixed once there, and `js/core/*` are thin bindings over it. `packages/app/src/lib` no longer exists, and `tests/guards/no-app-lib.test.js` fails if a second implementation of a core rule appears in the app.

---

## Parity suite

`packages/parity` proves that the SaaS Lite area looks and behaves like Lite for the same data. Both products are rendered live in the same run and compared pixel by pixel (at most 0.1% of pixels may differ); no screenshot baselines are committed (D-10).

- **What is compared:** Lite's `body` against the SaaS `.lite-area`, for the minimal and complex fixtures under all eight themes, plus interaction states (search, status filter, risk toggle, 6 month zoom, Collapse All, an open dependency graph with an arrow hovered, a scrolled page with the sticky filter bar, a theme switched from the select). The SaaS side is the real `DashboardPage` (entry `packages/app/parity.html`, a stub Auth0 context) fed by stubbed API routes built from the same fixture. A PNG smoke checks "Export Full Roadmap" under every theme.
- **How it is built:** `node packages/parity/scripts/build-targets.mjs --lite-head --saas` builds Lite and the SaaS entries (`vite build --mode parity` into `packages/app/dist-parity`). The parity entries are never part of the default app build.
- **Run it locally:** `npm -w @roadmapsnap/parity run test:docker` (needs Docker). It runs inside the pinned `mcr.microsoft.com/playwright` image, whose tag equals the pinned `@playwright/test` version, with a frozen date, a fixed viewport and no network, so fonts and anti-aliasing are identical everywhere.
- **In CI:** the `Parity` workflow (`parity.yml`) runs on every push and pull request with no path filter. Its first step computes the changed files and the heavy steps run only when core, tokens, app, parity, CSS, Lite sources, test fixtures or helpers, or a manifest or lockfile changed, so the job always reports a status and can be a required check.
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
| `parity.yml` | Every push and pull request, no path filter; heavy steps gated in-job on changed files | `npm ci` for core, tokens, app and parity, inside the pinned Playwright image | build Lite and the SaaS parity entry, then `npx playwright test -c packages/parity` |
| `api-ci.yml` | Path-filtered (`packages/api/**`, root manifest and lockfile, the workflow) | `npm ci -w @roadmapsnap/api` | migrate, tests, timezone tests (`-w @roadmapsnap/api`) |

`ci.yml` has no path filter on purpose: a change under `packages/core` or `packages/tokens` must always run the Lite tests. `parity.yml` has none either, so a required `parity` check is never left pending. `tests/guards/ci-config.test.js` keeps these shapes in place.

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
│   ├── parity/            # Lite-vs-SaaS screenshot suite
│   └── tokens/            # Shared design tokens
└── .github/
    └── workflows/
        ├── ci.yml          # Lite + core CI (always runs)
        ├── parity.yml      # Lite-vs-SaaS parity (always reports)
        ├── api-ci.yml      # packages/api CI
        └── app-ci.yml      # packages/app CI
```
