---
phase: "02"
slug: "shared-core-lite-identical-view"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-22"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test` (Lite, `packages/core`, API); Vitest 2.1 + jsdom (app, golden markup); `@playwright/test` 1.64.1 + pixelmatch + pngjs (parity, pinned container); `tsc` (`--checkJs` in core, `--noEmit` in app) |
| **Config file** | root `package.json` `test` script; `packages/app/vite.config.ts`; new `packages/core/tsconfig*.json`; new `packages/parity/playwright.config.ts` (Wave 0 installs) |
| **Quick run command** | `node --test tests/**/*.test.js packages/core/tests/*.test.js` |
| **Full suite command** | `npm test && npm run typecheck -w @roadmapsnap/core && npm run validate && npm run build && npm -w @roadmapsnap/app test && npm -w @roadmapsnap/app run build`, then the parity job in the container; API: `npm -w @roadmapsnap/api test` (needs Postgres) |
| **Estimated runtime** | ~10 seconds quick; several minutes full with parity |

---

## Sampling Rate

- **After every task commit:** Run the quick command, plus `npx tsc --noEmit` in `packages/app` when app files change
- **After every plan wave:** Run the full suite (parity at the view waves)
- **Before `/gsd-verify-work`:** Full suite and the parity job must be green
- **Max feedback latency:** 10 seconds (quick)

---

## Per-Task Verification Map

Filled by the planner and executor from the plans. Requirement → test map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| CORE-01 | Explicit-arg core equals Lite output on both fixtures | unit | `node --test packages/core/tests/*.test.js` | ❌ W0 | ⬜ pending |
| CORE-01 | No `CONFIG`/`window`/`document`/`localStorage`/`process`/`AppState`/`fetch` in `packages/core/src` | static guard | `node --test packages/core/tests/purity.test.js` | ❌ W0 | ⬜ pending |
| CORE-01 | JSDoc typecheck + `.d.ts` emit | typecheck | `npm run typecheck -w @roadmapsnap/core` | ❌ W0 | ⬜ pending |
| CORE-01 | Characterization of untested Lite behavior, before the refactor | unit | `node --test tests/core/*.test.js` | ❌ W0 | ⬜ pending |
| CORE-02 | `packages/app/src/lib` gone, nothing imports it | static guard + tsc | `node --test tests/guards/no-app-lib.test.js` and `cd packages/app && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| CORE-03 | Existing 141 Lite tests, validate and build stay green | regression | `npm test && npm run validate && npm run build` | ✅ | ⬜ pending |
| CORE-03 | CI always runs Lite tests on shared-code changes | static guard | `node --test tests/guards/ci-config.test.js` | ❌ W0 | ⬜ pending |
| VIEW-01..03 | Golden markup identical (timeline, KPI, arrows, tooltip text) | golden | `npm -w @roadmapsnap/app test -- golden` | ❌ W0 | ⬜ pending |
| VIEW-01..02 | Early React-vs-Lite pixel check before the page exists: four regions × 2 fixtures (02-17, wave 6), then the full Lite area on the minimal fixture (02-14, wave 7) | e2e | `npm -w @roadmapsnap/parity run test:docker -- tests/view-vs-lite.spec.ts` | ❌ W0 | ⬜ pending |
| VIEW-01..05 | Pixel parity, 8 themes × 2 fixtures, ≤ 0.1% diff, active-graph + hovered-arrow state | e2e | `npx playwright test -c packages/parity` (container) | ❌ W0 | ⬜ pending |
| VIEW-03 | Arrow geometry/color/title, blocking detection | unit | `node --test packages/core/tests/arrows.test.js` | ❌ W0 | ⬜ pending |
| VIEW-04 | Filters, sort, zoom 3/6/12/all | unit + e2e | `node --test packages/core/tests/filters.test.js` | ❌ W0 | ⬜ pending |
| VIEW-05 | Theme enum accepted and persisted by API | integration | `npm -w @roadmapsnap/api test` | extend `auth.test.js` | ⬜ pending |
| VIEW-06 | CSV/JSON byte-identical Lite vs SaaS; PNG smoke per theme (white background) | unit + e2e | `node --test packages/core/tests/export.test.js`; parity | ❌ W0 | ⬜ pending |
| CSS move | Lite(base) vs Lite(HEAD) identical | e2e one-off | base-vs-head harness | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/config.complex.js` (0 bytes today): author it, plus `roadmapToApi(config)` and a round-trip test
- [ ] Characterization tests for untested Lite behavior, green against unrefactored code
- [ ] `packages/core` skeleton: `package.json`, tsconfigs, `tests/`, `purity.test.js`; root `test` script extended
- [ ] Root `workspaces`, single lockfile, `engines` node >=24, CI/Docker/compose updates
- [ ] Golden-markup harness in `packages/app` (vitest)
- [ ] `packages/parity` workspace: Playwright config, parity entry (never in the production build), base-vs-head script, pinned container job
- [ ] API test extension for the theme enum

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native `title` tooltip appearance on hover | VIEW-03 | Native tooltips are not rendered into page screenshots | Hover an arrow and a bar in both Lite and SaaS and confirm identical tooltip text (text equality is also automated in golden markup) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
