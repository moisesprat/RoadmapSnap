---
phase: "02"
slug: "shared-core-lite-identical-view"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| CORE-01 | Explicit-arg core equals Lite output on both fixtures | unit | `node --test packages/core/tests/*.test.js` | ✅ `packages/core/tests/*.test.js` (16 files) | ✅ green |
| CORE-01 | No `CONFIG`/`window`/`document`/`localStorage`/`process`/`AppState`/`fetch` in `packages/core/src` | static guard | `node --test packages/core/tests/purity.test.js` | ✅ `packages/core/tests/purity.test.js`, `tests/guards/lite-isolation.test.js` | ✅ green |
| CORE-01 | JSDoc typecheck + `.d.ts` emit | typecheck | `npm run typecheck -w @roadmapsnap/core` | ✅ `packages/core/tsconfig*.json` | ✅ green |
| CORE-01 | Characterization of untested Lite behavior, before the refactor | unit | `node --test tests/core/*.test.js` | ✅ `tests/core/characterization.test.js` + `tests/fixtures/lite-html-snapshots.json` | ✅ green |
| CORE-02 | `packages/app/src/lib` gone, nothing imports it | static guard + tsc | `node --test tests/guards/no-app-lib.test.js` and `cd packages/app && npx tsc --noEmit` | ✅ `tests/guards/no-app-lib.test.js` | ✅ green |
| CORE-03 | Existing 141 Lite tests, validate and build stay green | regression | `npm test && npm run validate && npm run build` | ✅ root suite (510 tests) | ✅ green |
| CORE-03 | CI always runs Lite tests on shared-code changes | static guard | `node --test tests/guards/ci-config.test.js` | ✅ `tests/guards/ci-config.test.js` | ✅ green |
| VIEW-01..03 | Golden markup identical (timeline, KPI, arrows, tooltip text) | golden | `npm -w @roadmapsnap/app test -- golden` | ✅ `packages/app/src/test/goldenMarkup.ts` + `components/lite/*.test.tsx` | ✅ green |
| VIEW-01..02 | Early React-vs-Lite pixel check before the page exists: four regions × 2 fixtures (02-17, wave 6), then the full Lite area on the minimal fixture (02-14, wave 7) | e2e | `npm -w @roadmapsnap/parity run test:docker -- tests/view-vs-lite.spec.ts` | ✅ `packages/parity/tests/view-vs-lite.spec.ts` | ✅ green |
| VIEW-01..05 | Pixel parity, 8 themes × 2 fixtures, ≤ 0.1% diff, active-graph + hovered-arrow state | e2e | `npx playwright test -c packages/parity` (container) | ✅ `packages/parity/tests/saas-vs-lite.spec.ts`, `interactions.spec.ts` | ✅ green |
| VIEW-03 | Arrow geometry/color/title, blocking detection | unit | `node --test packages/core/tests/arrows.test.js` | ✅ `packages/core/tests/arrows.test.js` | ✅ green |
| VIEW-04 | Filters, sort, zoom 3/6/12/all | unit + e2e | `node --test packages/core/tests/filters.test.js` | ✅ `packages/core/tests/filters.test.js`, `viewState.test.js` | ✅ green |
| VIEW-05 | Theme enum accepted and persisted by API | integration | `npm -w @roadmapsnap/api test` | ✅ `packages/api/tests/auth.test.js` (eight-theme PATCH/GET) | ✅ green |
| VIEW-06 | CSV/JSON byte-identical Lite vs SaaS; PNG smoke per theme (white background) | unit + e2e | `node --test packages/core/tests/export.test.js`; parity | ✅ `packages/core/tests/export.test.js`, `packages/parity/tests/png.spec.ts` | ✅ green |
| CSS move | Lite(base) vs Lite(HEAD) identical | e2e one-off | base-vs-head harness | ✅ `packages/parity/tests/lite-vs-lite.spec.ts` (`BASE_REF`) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/fixtures/config.complex.js` (0 bytes today): author it, plus `roadmapToApi(config)` and a round-trip test
- [x] Characterization tests for untested Lite behavior, green against unrefactored code
- [x] `packages/core` skeleton: `package.json`, tsconfigs, `tests/`, `purity.test.js`; root `test` script extended
- [x] Root `workspaces`, single lockfile, `engines` node >=24, CI/Docker/compose updates
- [x] Golden-markup harness in `packages/app` (vitest)
- [x] `packages/parity` workspace: Playwright config, parity entry (never in the production build), base-vs-head script, pinned container job
- [x] API test extension for the theme enum

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native `title` tooltip appearance on hover | VIEW-03 | Native tooltips are not rendered into page screenshots | Hover an arrow and a bar in both Lite and SaaS and confirm identical tooltip text (text equality is also automated in golden markup) |
| Parity job is a required status check on `main` and reports on a docs-only PR | CORE-03, VIEW-01 | GitHub repository setting and a real runner (`--user 1001`); outward-facing, not done by agents | After pushing the branch, add `parity` (workflow Parity) to branch protection for `main`; confirm with `gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks.contexts'`; open a README-only PR and confirm Parity reports success without the heavy steps |

**Audit notes (2026-11-27):** full parity suite 61/61 in the pinned container; root 510/510; app 194/194; API 193/193 on rerun. One intermittent API failure was seen once, `tests/seed-fresh.test.js` "tuple concurrently updated" in `V4__app_role` when test files migrate concurrently (Phase 1 test, passes alone and on two full reruns); tracked as flaky, not a Phase 2 regression.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-27 by validate-phase (state A audit, no gaps)

## Validation Audit 2026-11-27

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
