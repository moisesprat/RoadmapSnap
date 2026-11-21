---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-02
    severity: warning
    disposition: open
    title: "Authentication runs in preHandler, after body parsing and schema validation (still open)"
  - id: WR-11
    severity: warning
    disposition: open
    title: "The default error handler returns raw pg and pool error messages to clients on 500"
  - id: IN-02
    severity: info
    disposition: open
    title: "CLI listen port ignores validated config (still open)"
  - id: IN-03
    severity: info
    disposition: open
    title: "build() leaks the pool when registration fails after the role check (still open)"
  - id: IN-05
    severity: info
    disposition: open
    title: "The client never sends X-Org-Id (still open)"
  - id: IN-06
    severity: info
    disposition: open
    title: "Org-id validation is stricter than route param validation (still open)"
  - id: IN-07
    severity: info
    disposition: open
    title: "A CORS_ORIGIN that is not a single bare origin passes the boot check and then matches nothing"
  - id: IN-08
    severity: info
    disposition: open
    title: "APP_DB_POOL_MAX has no lower bound"
  - id: IN-09
    severity: info
    disposition: open
    title: "A failed ROLLBACK turns a 4xx into a 500 and hides the original status"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "onRequestAbort releases the tenant client while the handler still uses it"
  - id: CR-02
    severity: critical
    disposition: open
    title: "`external_link` accepted without validation and rendered as an href (stored XSS)"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Pool has no error handling and no connection timeout"
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
    disposition: fixed
    title: "requireRole fails open for an unrecognized role value"
  - id: WR-07
    severity: warning
    disposition: open
    title: "`deleteProject` fails on the 204 response, so the UI errors after a successful delete"
  - id: WR-08
    severity: warning
    disposition: fixed
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
  - id: IN-04
    severity: info
    disposition: open
    title: "Client types do not match API responses"
open: 18
total: 22
recorded: 2026-11-21T06:42:06.838Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-02 | warning | open | - |
| WR-11 | warning | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| CR-01 | critical | fixed | 01-09-PLAN.md (not in the current review) |
| CR-02 | critical | open | - (not in the current review) |
| WR-01 | warning | fixed | 01-09-PLAN.md (not in the current review) |
| WR-03 | warning | open | - (not in the current review) |
| WR-04 | warning | open | - (not in the current review) |
| WR-05 | warning | open | - (not in the current review) |
| WR-06 | warning | fixed | 01-10-PLAN.md (not in the current review) |
| WR-07 | warning | open | - (not in the current review) |
| WR-08 | warning | fixed | 01-10-PLAN.md (not in the current review) |
| WR-09 | warning | open | - (not in the current review) |
| WR-10 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
