# Monorepo layout

This repository contains two products:

| Product | Location | Description |
|--------|----------|-------------|
| **RoadmapSnap Lite** | Repository root | Backend-free, client-side roadmap dashboard |
| **RoadmapSnap SaaS** | `packages/api/`, `packages/app/`, `packages/tokens/` | Multi-tenant API, frontend, and shared design tokens (under development) |

---

## RoadmapSnap Lite (root)

Lite is **backend-free and always will be**. It runs from `index.html` and `js/config.js`. No server, no database. Edit config → refresh → done.

- **Root `package.json`** — Scripts (`dev`, `build`, `test`, `validate`, etc.) always refer to Lite.
- **No changes** to `index.html`, `js/`, `css/`, `tests/`, or any existing root files are made for the SaaS product.

---

## RoadmapSnap SaaS (`packages/`)

The SaaS product is split across three packages, each self-contained with its own `package.json`, `node_modules`, tests, and CI workflow:

- **`packages/api/`** — Fastify + PostgreSQL + Auth0 backend. Multi-tenant API (organizations → workspaces → projects), RBAC, row-level security.
- **`packages/app/`** — React + TypeScript + Vite frontend, TanStack Query, TailwindCSS.
- **`packages/tokens/`** — Shared CSS design tokens consumed by both `packages/app/` and (via `css/`) Lite.

CI: `.github/workflows/api-ci.yml` and `.github/workflows/app-ci.yml`, triggered on changes under their respective `packages/*` paths; the root `ci.yml` excludes `packages/**`.

**To work on the API or app:**

```bash
cd packages/api && npm run dev   # Fastify on port 4000
cd packages/app && npm run dev   # Vite on port 3001
```

---

## Directory tree

```
RoadmapSnap/
├── index.html
├── package.json          # Lite: dev, build, test
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
│   ├── api/               # RoadmapSnap SaaS backend
│   ├── app/                # RoadmapSnap SaaS frontend
│   └── tokens/             # Shared design tokens
└── .github/
    └── workflows/
        ├── ci.yml          # Root CI: Lite only
        ├── api-ci.yml      # packages/api CI
        └── app-ci.yml      # packages/app CI
```

Root tooling (Vite, tests, validate) applies only to Lite. Each SaaS package is self-contained under `packages/`.
