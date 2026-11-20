---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "onRequestAbort releases the tenant client while the handler still uses it"
  - id: CR-02
    severity: critical
    disposition: open
    title: "`external_link` accepted without validation and rendered as an href (stored XSS)"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Pool has no error handling and no connection timeout"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Authentication runs in preHandler, after body parsing and schema validation"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Unique-violation races return 500 in workspace create/update and project rename"
  - id: WR-04
    severity: warning
    disposition: open
    title: "`PATCH /auth/me` persists arbitrary keys into `preferences`"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Dev tooling guards fail open when NODE_ENV is unset; seed can take over an existing org"
  - id: WR-06
    severity: warning
    disposition: open
    title: "requireRole fails open for an unrecognized role value"
  - id: WR-07
    severity: warning
    disposition: open
    title: "`deleteProject` fails on the 204 response, so the UI errors after a successful delete"
  - id: WR-08
    severity: warning
    disposition: open
    title: "Production CORS check is defeated by the schema default"
  - id: WR-09
    severity: warning
    disposition: open
    title: "Tenant-scoped tables allow writes by any member at the SQL layer"
  - id: WR-10
    severity: warning
    disposition: open
    title: "API CI uses `npm install`, a cache key that ignores the lockfile, and swallows role-creation errors"
  - id: IN-01
    severity: info
    disposition: open
    title: "Unused dependency and provisional image pin"
  - id: IN-02
    severity: info
    disposition: open
    title: "CLI listen port ignores validated config"
  - id: IN-03
    severity: info
    disposition: open
    title: "build() leaks the pool when registration fails after the role check"
  - id: IN-04
    severity: info
    disposition: open
    title: "Client types do not match API responses"
  - id: IN-05
    severity: info
    disposition: open
    title: "The client never sends `X-Org-Id`"
  - id: IN-06
    severity: info
    disposition: open
    title: "Org-id validation is stricter than route param validation"
open: 18
total: 18
recorded: 2026-11-20T23:25:42.595Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| WR-10 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
