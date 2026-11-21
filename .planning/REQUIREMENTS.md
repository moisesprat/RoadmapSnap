# Requirements: RoadmapSnap SaaS v1

**Defined:** 2026-11-18
**Core Value:** A team's roadmap in SaaS looks and behaves exactly like it does in Lite: same timeline, dashboard, dependencies, filters and themes. It is shared, stored and editable.

## v1 Requirements

### Security & Tenancy Foundation

- [ ] **SEC-01**: Every API request runs in a transaction that sets the tenant context with parameterized `set_config`, as the NOSUPERUSER app role
- [ ] **SEC-02**: The API refuses to start if its DB role is a superuser or has BYPASSRLS
- [ ] **SEC-03**: A user of org A cannot read or write any row of org B through any endpoint (automated cross-tenant tests)
- [ ] **SEC-04**: New users are never auto-joined to the seed org, and the dev RLS bypass is removed
- [ ] **SEC-05**: Fresh installs contain no sample program data; dev seed data is separate from schema migrations
- [ ] **SEC-06**: Dates round-trip without day shifts in any server timezone

### Shared Core

- [ ] **CORE-01**: Lite and SaaS use the same roadmap logic from `packages/core` (timeline, workflow, dependencies, stats, filters, view model)
- [ ] **CORE-02**: The `packages/app/src/lib` duplicates are removed
- [ ] **CORE-03**: Lite keeps working unchanged (`npm test`, `validate`, `build` green), and CI runs Lite tests when shared code changes

### Lite-Identical View

- [ ] **VIEW-01**: A user sees the roadmap timeline/Gantt in SaaS pixel-identical to Lite for the same data (automated screenshot comparison)
- [ ] **VIEW-02**: A user sees the KPI dashboard identical to Lite
- [ ] **VIEW-03**: A user sees dependency arrows and tooltips with blocking detection, identical to Lite
- [ ] **VIEW-04**: A user can filter by name, status and risk, and zoom 3/6/12 months or full range, as in Lite
- [ ] **VIEW-05**: A user can switch among all Lite themes (light, dark, professional, colorful, blank, evergreen)
- [ ] **VIEW-06**: A user can export the roadmap to PNG, CSV and JSON

### Manual Editing

- [ ] **EDIT-01**: An editor can create, edit and delete deliverables/tasks in a side panel
- [ ] **EDIT-02**: An editor can create, rename, reorder and delete groups (groups are a first-class table)
- [ ] **EDIT-03**: An editor can set and change milestone dates per workflow step
- [ ] **EDIT-04**: An editor can add and remove dependencies with a picker; cycles are rejected at milestone granularity with a clear message
- [ ] **EDIT-05**: An editor can drag milestone dates on the timeline
- [ ] **EDIT-06**: An editor can undo a delete or edit from a toast
- [ ] **EDIT-07**: A concurrent edit conflict is detected and the user is told to refresh, with no silent overwrite
- [ ] **EDIT-08**: Viewers see a read-only UI, and the API rejects their writes

### Import

- [ ] **IMP-01**: A user uploads a Lite `config.js` and sees a preview with a validation report; the file is never executed
- [ ] **IMP-02**: On confirm, the import creates a new roadmap that renders identically to Lite for that config

### Accounts & Orgs

- [ ] **ORG-01**: A new user signs up through Auth0 and gets their own organization automatically
- [ ] **ORG-02**: A new org sees a guided empty state: create with AI, import Lite config, or start blank
- [ ] **ORG-03**: An admin invites a teammate by email with a role (viewer/editor/admin); the invite is sent over SMTP (Mailpit in dev)
- [ ] **ORG-04**: An admin sees pending invites and can resend or revoke them; invites expire after 7 days
- [ ] **ORG-05**: An invitee accepts and joins only the inviting org (no personal org), if their verified email matches
- [ ] **ORG-06**: An admin can change member roles and remove members; the last admin can't be removed or demoted
- [ ] **ORG-07**: A user in several orgs can switch between them

### AI Editing

- [ ] **AIE-01**: An editor types a change in plain language (e.g. "add task X in group Y depending on A, B, C") and gets a proposed change set
- [ ] **AIE-02**: The proposal is shown as a diff grouped into added, changed and removed, with a short explanation
- [ ] **AIE-03**: The preview shows the impact: newly blocked items, cycles and KPI changes
- [ ] **AIE-04**: Proposed changes appear as a ghost overlay on the timeline before confirming
- [ ] **AIE-05**: Ambiguous or unknown names are flagged in the preview and block confirm until resolved
- [ ] **AIE-06**: Nothing is saved until the user confirms; the apply is atomic, and a stale proposal is rejected if the roadmap changed meanwhile
- [ ] **AIE-07**: The user can undo an applied AI change set as one unit

### AI Generation

- [ ] **AIG-01**: A user creates a new roadmap from a text prompt
- [ ] **AIG-02**: A user creates a new roadmap from a pasted document
- [ ] **AIG-03**: A user creates a new roadmap from an uploaded CSV, XLSX or markdown file
- [ ] **AIG-04**: A generated roadmap is previewed, with inferred values flagged, before it's created

### AI Usage Limits

- [ ] **QUOTA-01**: Each org has a hard monthly AI cap, enforced atomically before each Claude call
- [ ] **QUOTA-02**: Users see an AI usage meter, with warnings at 80% and a clear message at 100%
- [ ] **QUOTA-03**: When the cap is reached, manual editing still works
- [ ] **QUOTA-04**: An operator can adjust an org's cap; a per-user rate limit and input-size limits apply
- [ ] **QUOTA-05**: The Anthropic key lives only in server env and never reaches the browser

### Deployment

- [ ] **DEP-01**: `docker compose up` starts postgres, a migrate job, the api and web (nginx + SPA + /api proxy), configured from `.env`
- [ ] **DEP-02**: The API runs as the app role; secrets (including the app DB password) come from env, with no hard-coded passwords
- [ ] **DEP-03**: Health and readiness endpoints check the DB; compose waits on them
- [ ] **DEP-04**: SPA config (Auth0 domain/client, API URL) is injected at runtime, not baked into the image
- [ ] **DEP-05**: Structured logs with secrets redacted
- [ ] **DEP-06**: A CI smoke test brings up compose and verifies two-org isolation through nginx

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Billing

- **BILL-01**: Stripe subscriptions and plans
- **BILL-02**: AI limits tied to plan, with top-ups

### AI

- **AIX-01**: Accept or reject individual operations within a proposal
- **AIX-02**: AI change history per roadmap
- **AIX-03**: Merge AI-generated content into an existing roadmap

### Editing & Interop

- **EDX-01**: Inline table (grid) editing
- **EDX-02**: Export a SaaS roadmap as a Lite `config.js`
- **INT-01**: Jira integration
- **ORGX-01**: SSO/SCIM and domain auto-join

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-applying AI changes | Every AI change goes through preview → confirm (trust on shared roadmaps) |
| Persistent AI chat copilot | One-shot proposals are enough; chat adds cost and ambiguity |
| Auto-rescheduling cascades | Lite's model is milestone-dated; cascades don't map and surprise users |
| Real-time co-editing | Optimistic concurrency is enough for v1 |
| Per-org API keys | One server key in v1; simpler ops |
| AI providers other than Anthropic | One structured-output integration |
| Changing Lite's backend-free nature | Lite stays static and config-driven |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Gaps Found |
| SEC-02 | Phase 1 | Gaps Found |
| SEC-03 | Phase 1 | Gaps Found |
| SEC-04 | Phase 1 | Gaps Found |
| SEC-05 | Phase 1 | Gaps Found |
| SEC-06 | Phase 1 | Gaps Found |
| CORE-01 | Phase 2 | Pending |
| CORE-02 | Phase 2 | Pending |
| CORE-03 | Phase 2 | Pending |
| VIEW-01 | Phase 2 | Pending |
| VIEW-02 | Phase 2 | Pending |
| VIEW-03 | Phase 2 | Pending |
| VIEW-04 | Phase 2 | Pending |
| VIEW-05 | Phase 2 | Pending |
| VIEW-06 | Phase 2 | Pending |
| EDIT-01 | Phase 3 | Pending |
| EDIT-02 | Phase 3 | Pending |
| EDIT-03 | Phase 3 | Pending |
| EDIT-04 | Phase 3 | Pending |
| EDIT-05 | Phase 3 | Pending |
| EDIT-06 | Phase 3 | Pending |
| EDIT-07 | Phase 3 | Pending |
| EDIT-08 | Phase 3 | Pending |
| IMP-01 | Phase 3 | Pending |
| IMP-02 | Phase 3 | Pending |
| ORG-01 | Phase 4 | Pending |
| ORG-02 | Phase 6 | Pending |
| ORG-03 | Phase 4 | Pending |
| ORG-04 | Phase 4 | Pending |
| ORG-05 | Phase 4 | Pending |
| ORG-06 | Phase 4 | Pending |
| ORG-07 | Phase 4 | Pending |
| AIE-01 | Phase 5 | Pending |
| AIE-02 | Phase 5 | Pending |
| AIE-03 | Phase 5 | Pending |
| AIE-04 | Phase 5 | Pending |
| AIE-05 | Phase 5 | Pending |
| AIE-06 | Phase 5 | Pending |
| AIE-07 | Phase 5 | Pending |
| AIG-01 | Phase 6 | Pending |
| AIG-02 | Phase 6 | Pending |
| AIG-03 | Phase 6 | Pending |
| AIG-04 | Phase 6 | Pending |
| QUOTA-01 | Phase 5 | Pending |
| QUOTA-02 | Phase 5 | Pending |
| QUOTA-03 | Phase 5 | Pending |
| QUOTA-04 | Phase 5 | Pending |
| QUOTA-05 | Phase 5 | Pending |
| DEP-01 | Phase 7 | Pending |
| DEP-02 | Phase 7 | Pending |
| DEP-03 | Phase 7 | Pending |
| DEP-04 | Phase 7 | Pending |
| DEP-05 | Phase 7 | Pending |
| DEP-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-11-18*
*Last updated: 2026-11-18 after roadmap creation (traceability added)*
