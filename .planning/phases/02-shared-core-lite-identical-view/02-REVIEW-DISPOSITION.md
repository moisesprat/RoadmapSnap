---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Group name equal to an Object.prototype key crashes the whole timeline (stored DoS)"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Deleting a project always reports failure and never refreshes the list"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "Zoom months skip a month and overshoot the end when today is on the 29th to 31st"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Workflow state keys that collide with stats fields throw or corrupt KPIs"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Unbounded month range lets a settings value or milestone date freeze the browser"
  - id: WR-03
    severity: warning
    disposition: open
    title: "CSV export does not escape quotes in group, tags or link"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Lite inline handlers break on apostrophes and group names with `&`, `<`, `>`, `\"`"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Lite search box double-escapes its value"
  - id: WR-06
    severity: warning
    disposition: open
    title: "PATCH /projects/:id returns 500 on a concurrent duplicate name"
  - id: WR-07
    severity: warning
    disposition: open
    title: "Create stores an empty-string group instead of NULL when the form sends null"
  - id: WR-08
    severity: warning
    disposition: open
    title: "PATCH /auth/me persists arbitrary preference keys without a size bound"
  - id: WR-09
    severity: warning
    disposition: open
    title: "Text download revokes the object URL immediately after click"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Lite renders `row.link` unsanitized while SaaS uses `safeLink`"
  - id: IN-02
    severity: info
    disposition: open
    title: "Lite theme read is unguarded and unvalidated"
  - id: IN-03
    severity: info
    disposition: open
    title: "Unreachable branch in `updateFilter`"
  - id: IN-04
    severity: info
    disposition: open
    title: "`filterDeliverables` assumes `name` is a string while its sibling guards it"
open: 11
total: 16
recorded: 2026-11-27T19:36:06.208Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | e4aca35 |
| CR-02 | critical | fixed | 533b281 |
| CR-03 | critical | fixed | 1e1bed4 |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | fixed | bd068f2 |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| IN-01 | info | fixed | bd068f2 |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
