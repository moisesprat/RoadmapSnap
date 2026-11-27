---
phase: "02"
slug: "shared-core-lite-identical-view"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-27"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. The register was authored at plan time (18 plan `<threat_model>` blocks) and verified by gsd-security-auditor against the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> repo / workspace install | New third-party packages and scoped workspace names enter the lockfile | supply chain |
| core package -> Lite and app | Shared code runs in both products; a global read in core would couple Lite to the browser or SaaS state | code |
| shared core -> app | Roadmap rules must come from one implementation; a stale copy shows different KPIs than Lite | logic |
| roadmap data -> KPI, filters, displayed risk | Governance signals; a silent refactor change misleads program managers | integrity |
| deliverable / tenant data -> Lite HTML, timeline DOM and SVG | Names, tags, tooltips and links from any org editor reach every viewer | untrusted strings (XSS) |
| API JSON (tenant data) -> core adapter -> SPA | Strings and dates written by any editor are adapted and rendered for every viewer | untrusted strings |
| browser -> PATCH /auth/me | Untrusted preference values written to `users.preferences` | user input |
| browser -> POST/PATCH projects | Untrusted `external_link` stored and rendered as an href | user input (XSS) |
| localStorage -> data-theme attribute | Any script on the origin or a user can write the cached theme | untrusted value |
| role (from /auth/me) -> visible actions | UI gating mirrors server roles; the server enforces | authorization |
| exported files -> spreadsheet tools | CSV cells interpreted by Excel/Sheets on the recipient's machine | export content |
| browser -> third-party CDNs | Font requests disclosing viewer IP and page | privacy |
| host -> container | Repo mounted into a container running a browser and npm | host files / secrets |
| parity build -> production build | The parity entry contains a stub authentication context | auth bypass risk |
| pull request -> CI gate | Workflow and path-filter changes decide which checks run and whether merges are blocked | CI integrity |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | workspace package names | medium | mitigate | `"private": true` in core/tokens; lockfile links `packages/*` | closed |
| T-02-02 | Info disclosure | core purity | low | mitigate | `packages/core/tests/purity.test.js` forbids browser/process/CONFIG/AppState/fetch globals | closed |
| T-02-03 | Info disclosure | test fixtures | low | mitigate | Synthetic `config.complex.js` (example.com links); only `js/config_base.js` tracked | closed |
| T-02-04 | Info disclosure | API Docker build context | high | mitigate | `.dockerignore` deny-all plus allowlist (39 files verified); no `COPY . .`; `USER node` | closed |
| T-02-05 | DoS / Tampering | Lite CI | medium | mitigate | `ci.yml` has no `paths` filter; `tests/guards/ci-config.test.js` | closed |
| T-02-06 | Tampering | lockfile drift | low | accept | `npm ci` everywhere; one tracked lockfile (guard test) | closed |
| T-02-07 | Tampering | OQ1 risk-key change | low | mitigate | Renamed characterization test; one snapshot change listed with reason (02-04) | closed |
| T-02-08 | Tampering | PATCH /auth/me theme | medium | mitigate | Ajv `enum: [...THEMES]`; invalid merged theme repaired to light; `auth.test.js` | closed |
| T-02-09 | Stored XSS | project `external_link` write | high | mitigate | `isHttpUrl` 400 on POST/PATCH (`routes/projects.js`); `projects.test.js` covers `javascript:`/`data:` | closed |
| T-02-10 | Elevation of privilege | PATCH /auth/me scope | low | accept | Update scoped to `request.dbUser.id` on `request.dbClient` inside the tenant transaction | closed |
| T-02-11 | Info disclosure | parity container | medium | mitigate | Env allowlist, shadowed node_modules, `--ignore-scripts`, non-localhost requests aborted, isolated contexts | closed |
| T-02-12 | Tampering | base-vs-head worktree | low | accept | `finally` removes the worktree (`build-targets.mjs`) | closed |
| T-02-13 | Elevation of privilege | parity package | low | mitigate | Private; no package depends on it; API image installs only `@roadmapsnap/api --omit=dev` | closed |
| T-02-14 | Tampering | stats refactor | low | mitigate | Byte-exact snapshots unchanged; "today override honored" test | closed |
| T-02-15 | Stored XSS | timeline link | high | mitigate | Core `safeHttpUrl` (http/https only) feeds `safeLink`; `markup.test.js` | closed |
| T-02-16 | Tampering | CSV formula injection | medium | accept | Deferred; see Accepted Risks Log AR-02-02 and `deferred-items.md` | closed |
| T-02-17 | Tampering | `apiToRoadmap` malformed input | low | mitigate | Never evaluates or throws; `isoToLite` returns '' for null; `adapter.test.js` | closed |
| T-02-18 | Info disclosure | Google Fonts | low | mitigate | Self-hosted `@fontsource/dm-sans`; no Google font refs; `fonts.spec.ts` blocks external requests | closed |
| T-02-19 | Markup injection | core models | medium | mitigate | Models carry plain data; Lite `html` escapes at render; model tests pass markup through unescaped | closed |
| T-02-20 | Markup injection | arrow titles / handlers | medium | mitigate | Plain-text titles; Lite `textContent`; React `<title>{…}</title>` | closed |
| T-02-21 | Tampering | Lite inline onclick | low | accept | Unchanged from pre-phase; React uses `onClick` only | closed |
| T-02-22 | Stored XSS | React dashboard / filter bar | high | mitigate | Only core icon constants reach `dangerouslySetInnerHTML` | closed |
| T-02-23 | Tampering | theme select value | low | mitigate | Options from core THEMES; `setTheme` normalizes | closed |
| T-02-24 | Stored XSS | React timeline anchor | high | mitigate | Anchor only when `safeLink`; `rel="noopener noreferrer"`; `LiteTimelineGrid.test.tsx` | closed |
| T-02-25 | Markup injection | React arrows / tooltips | medium | mitigate | JSX text/attributes; path `d` from numeric geometry only | closed |
| T-02-26 | Info disclosure | Auth0 config in UI copy | low | mitigate | Auth0 env only in `main.tsx`; page states name no tenant | closed |
| T-02-27 | Tampering | data-theme writes | low | mitigate | `normalizeTheme` allowlist on every `applyTheme` path | closed |
| T-02-28 | Stored XSS | app-wide raw HTML sinks | high | mitigate | Sink inventory: no tenant data reaches innerHTML in non-test source | closed |
| T-02-29 | Tampering | pre-paint theme script | low | mitigate | Allowlist in `index.html`; `prepaint.test.ts` (16 tests incl. throwing localStorage) | closed |
| T-02-30 | Elevation of privilege | role-gated actions | medium | mitigate | UI via `useRole` (fails closed to viewer); API `requireRole('editor')`; viewer 403 tests. Post-plan fix `2ab2842` keeps role in cache, no regression | closed |
| T-02-31 | Elevation of privilege | parity stub auth in prod build | high | mitigate | `mode === 'parity'` gates entries; default build verified free of parity files/markers; API verifies RS256 JWTs | closed |
| T-02-32 | DoS / Tampering | Parity required check | medium | mitigate | No `paths` filter; in-job change detection; `if: always()` Report step; guard test | closed |
| T-02-33 | Tampering | Playwright image | low | accept | Tag equals npm pin 1.64.1 (guard test); digest pinning deferred | closed |
| T-02-34 | Elevation / Info disclosure | parity preview entry | medium | mitigate | Absent from default build, present in parity build; preview calls no API | closed |
| T-02-35 | Stored XSS | export controls / footer | high | mitigate | Icons from core constants; labels are literals | closed |
| T-02-36 | Tampering | duplicated app logic | low | mitigate | `packages/app/src/lib` deleted; `no-app-lib.test.js`; tsc clean | closed |
| T-02-SC (02-01) | Tampering | npm installs | high | mitigate | Direct deps unchanged; only new transitive `@fastify/deepmerge` (fastify org); all entries from registry.npmjs.org with integrity | closed |
| T-02-SC (02-06) | Tampering | npm installs | high | mitigate | Exact pins, no install scripts, `--ignore-scripts`; human legitimacy checkpoint approved by the user | closed |
| T-02-SC (02-02..05, 07..18 excl. 06) | Tampering | npm installs | high | accept | No package installed by these plans (02-09 adds an export entry, 02-17 a script only); see AR-02-01 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-SC (16 plans) | These plans install no package; `git log` over all manifests and the lockfile shows only the 02-01 and 02-06 dependency commits (plus 02-09 export entry and 02-17 script). Nothing to mitigate. | plan threat models; verified by gsd-security-auditor | 2026-11-27 |
| AR-02-02 | T-02-16 | CSV formula injection: CSV stays byte-identical with Lite this phase (resolved OQ5); fix (prefix `=+-@` cells) deferred to a later security pass, recorded in `deferred-items.md`. | plan 02-08 (OQ5); verified by gsd-security-auditor | 2026-11-27 |
| AR-02-03 | T-02-06 | Lockfile drift: mitigated in practice by `npm ci` and a single lockfile guard; residual risk low. | plan 02-01/02-03 | 2026-11-27 |
| AR-02-04 | T-02-10 | PATCH /auth/me already scoped to the caller's own row inside the RLS transaction; no new route. | plan 02-05 | 2026-11-27 |
| AR-02-05 | T-02-12 | Temporary base worktree is removed in a `finally`; worst case is a stray local worktree. | plan 02-06 | 2026-11-27 |
| AR-02-06 | T-02-21 | Lite's inline `onclick` handlers predate this phase and are unchanged; React uses no inline-handler strings. | plan 02-11 | 2026-11-27 |
| AR-02-07 | T-02-33 | Playwright image pinned by tag equal to the npm pin; digest pinning deferred. | plan 02-16 | 2026-11-27 |

*Accepted risks do not resurface in future audit runs.*

**Informational (not registered threats, no effect on threats_open):**
1. No standing CI guard on `dangerouslySetInnerHTML`/`innerHTML` sinks; the directory-wide grep was a plan-time check (holds T-02-22/28/35 today). Candidate guard test beside `no-app-lib.test.js`.
2. `timelineModel.js` keeps the raw `link` next to `safeLink`; safe today because no app code reads `row.link`.
3. The parity-only preview (`src/parity/view.tsx`) sets `data-theme` without `normalizeTheme`; excluded from the shipped build.
4. `PATCH /auth/me` accepts extra keys under `preferences` (no `additionalProperties: false`); outside T-02-08.
5. Human step: mark `parity` as a required status check on `main` (code-level T-02-32 verified; first GitHub run passed on PR #3).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-27 | 54 | 54 | 0 | gsd-security-auditor (sonnet), ASVS L1, block_on high |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-27

## Security Audit 2026-11-27

| Metric | Count |
|---|---|
| Threats found | 54 |
| Closed | 54 |
| Open | 0 |
