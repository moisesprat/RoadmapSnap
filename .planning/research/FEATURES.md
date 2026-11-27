# Feature Research

**Domain:** Multi-tenant roadmap / PMO governance SaaS with AI-assisted creation and editing (RoadmapSnap SaaS v1)
**Researched:** 2026-11-18
**Confidence:** MEDIUM. Interaction patterns (diff review, invite flows, usage-cap UX) are well established and corroborated by several sources. Competitor-specific AI behavior is only partly verifiable: vendor pages mostly do not document confirm-before-apply semantics, so competitor claims below are labelled where they are unverified. Opinionated recommendations are the author's synthesis, not sourced facts.

## Reading Guide

RoadmapSnap's Core Value is "SaaS looks and behaves exactly like Lite". Everything below is filtered through that. Three facts about the existing codebase shape the recommendations and are easy to miss:

1. **Lite's data model is milestone-driven, not start/end-driven.** A deliverable has `milestones: { KEY: date }`; its bar and status are derived from which workflow milestone dates exist or have passed. Dependencies are `{ task, from, to }` pairs of milestone keys (SaaS table: `dependencies.from_milestone_key / to_milestone_key`). Generic Gantt expectations ("drag a bar = change start/end", "finish-to-start auto-shift") do not map 1:1. Editing and AI proposals must speak this model.
2. **Multi-org membership already exists** (`org_members` unique on `(org_id, user_id)`, org chosen by `X-Org-Id`). A user who signs up with their own org and is later invited to a second org belongs to two orgs, so an org switcher is required. `org_members` has `invited_by` and `accepted_at` but there is **no invitations table**, so invites to people without accounts need new storage.
3. **`audit_events` already records `payload_before/payload_after` per row via trigger** (V3). That is a ready substrate for undo and change history, but it is per-row, so a change-set grouping key (for example in `metadata`) is needed to undo an AI change set as one unit.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these makes the product feel unfinished or unsafe. Users give no credit for having them.

#### A. Roadmap view (Lite parity)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Timeline/Gantt with zoom (3/6/12 mo, full), key milestone markers | Already in Lite; it is the Core Value | MEDIUM | Reuse `js/core/` logic rather than the TS mirror (PROJECT.md decision). |
| KPI dashboard with click-to-filter by status | In Lite | MEDIUM | |
| Dependency arrows + blocking detection + tooltips | In Lite | MEDIUM | |
| Search/filter by name/tag/status/risk | In Lite; every comparable tool has filters | LOW | |
| Themes, PNG/CSV/JSON export | In Lite | LOW-MEDIUM | PNG export is the usual source of rendering drift between tiers. |
| Persistence and sharing across the org | The whole reason to leave Lite | MEDIUM | Existing workspace/project API covers part of it. |

#### B. Manual editing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create / edit / delete deliverables (name, group, dates per milestone, tags, link, atRisk, descoped, showInTimeline) | Basic CRUD; "full manual editing" is a stated target | MEDIUM | API needs milestone and dependency endpoints (none exist today). |
| Side-panel / modal edit form opened from a row or bar | Universal pattern (Linear, Aha!, Roadmunk, Jira) | MEDIUM | Gets full-field editing with validation without building every inline control. |
| Group CRUD, rename, reorder (`GROUP_ORDER`) | Groups are the main structure in Lite | LOW-MEDIUM | Rename must propagate to member deliverables atomically. |
| Milestone date editing with date picker and validation (order, within timeline range) | Dates are the core data | LOW-MEDIUM | Reuse config validator rules server-side; do not trust the client. |
| Add/remove dependency via picker (searchable select of deliverables, optional from/to milestone) | Dependencies are a headline feature | MEDIUM | Must reject self-links (DB CHECK exists), duplicates, and cycles with a clear message. |
| Delete confirmation, with undo toast | Destructive actions on shared data | LOW | "Undo toast for ~5-10 s" is the cheap, widely expected form of undo. |
| Inline edit of simple fields in list/table rows (name, status flags, tags) | Expected in spreadsheet-like views; monday/ClickUp/Aha! all do it | MEDIUM | Optional for v1 if the side-panel is solid; see MVP. |
| Validation errors shown per field, server-authoritative | Prevents corrupt shared data | LOW | Mirror `configValidator` rules in the API. |
| Role-aware UI: viewers see no edit affordances (not just a 403) | Role model exists; broken-looking buttons erode trust | LOW | Enforce `requireRole('editor')` server-side regardless. |
| Concurrent edit safety (optimistic version/`updated_at` check, "someone else changed this" message) | Shared roadmap with several editors; silent overwrite is data loss | MEDIUM | Real-time co-editing is NOT required (see anti-features); conflict detection is. Also required for AI confirm (below). |

#### C. AI roadmap generation (prompt / pasted document / uploaded file)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate a draft roadmap, then show it for review before anything is saved | Stated project rule; also the trust baseline in every AI-writes-to-shared-data product | MEDIUM | Output is a structured proposal (validated schema), never free text parsed with regexes. |
| Output validated against the Lite config schema / workflow rules before the user sees it | A draft that fails validation on confirm is a broken promise | MEDIUM | Reuse `schema/config.schema.json` and `configValidator`. Invalid model output -> automatic retry (capped), then a readable error. |
| Progress/loading state and a timeout/failure path for multi-second generations | LLM calls take 10-60 s; users abandon silent spinners | LOW-MEDIUM | Streaming is optional; a clear "working" state, cancel, and retry are not. |
| Accept the realistic inputs: prompt text, pasted text, CSV, spreadsheet (xlsx), markdown | The project lists these inputs | MEDIUM | Enforce file-size/row/character limits up front, with an explicit message when input is truncated. |
| Editable result: after confirm the draft is just a normal roadmap | Users fix 10-20% of any AI draft by hand | LOW | Free if generation produces normal projects. |
| Missing info handled visibly (dates absent in source -> flagged as assumed, not silently invented) | Invented dates on a governance dashboard are worse than blanks | MEDIUM | Mark inferred values in the preview; or leave null where the schema allows. |
| Generation creates a new roadmap/workspace, never overwrites an existing one | Avoids the highest-blast-radius mistake | LOW | Merging into an existing roadmap is a different feature (see differentiators/defer). |

#### D. AI natural-language edits

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Propose -> preview diff -> confirm/discard; nothing written before confirm | Project rule; matches the propose/review/commit pattern documented for human-in-the-loop AI UX | MEDIUM | Corroborated across AI UX pattern sources; also the main complaint when tools drop it (e.g. user backlash when Cursor applied edits without an approval diff). |
| Diff grouped by operation type (added / changed / removed) with before -> after values | A change set is hard to trust as prose | MEDIUM | Show destructive ops (deletes, removed dependencies) prominently. |
| Items referenced by name, resolved to IDs server-side | Users say "task A, B, C", not UUIDs | MEDIUM | See ambiguity handling below. Model proposes operations keyed by IDs the server supplied in context. Names in the preview are rendered from the DB, not echoed from the model. |
| Ambiguity handling: if a name matches 0 or >1 items, ask or show candidates; never guess silently | Wrong-target edits are the dominant failure mode of NL edit tools | MEDIUM | Research on tool-calling clarification (ClarifyBench, arXiv 2511.08798) and entity-disambiguation patterns supports "resolve to canonical ID, ask when several candidates". Implementation: server-side fuzzy lookup tool exposed to the model; unresolved references appear in the preview as explicit "could not find 'X'" rows that block confirm for that op. |
| Short plain-language explanation of what the AI will do and any assumptions it made | Lets the user check intent against result | LOW | One summary line plus per-op rationale only when non-obvious ("placed after B because dependency"). Keep brief. |
| Atomic apply: all operations in one DB transaction, under the user's role and RLS | Half-applied change sets corrupt the roadmap | MEDIUM | Constraint from PROJECT.md: same RLS and role checks as manual edits. |
| Staleness check at confirm (roadmap changed since proposal -> re-validate or ask to re-propose) | Preview-then-confirm creates a time gap with other editors | MEDIUM | Same version mechanism as manual-edit concurrency. |
| Undo of the last applied AI change set | After confirm, users still want a single-step escape hatch | MEDIUM-HIGH | Table stakes in the sense that "no undo after accept" is a named anti-pattern in AI UX writeups. Build on `audit_events` plus a change-set id. |
| Cheap rejection: discard, and edit the instruction and re-run | Obvious | LOW | A re-run counts toward the usage cap. |
| Operations beyond the 'add' example: update dates, move between groups, rename, set risk, add/remove dependency, descope, delete | Users will try them immediately; an assistant that only adds feels broken | MEDIUM | Define a closed operation vocabulary up front (see Dependencies). |
| Server-side guardrails on proposal size (max operations per proposal) | Prevents a vague prompt wiping or rewriting the roadmap | LOW | Over the limit -> refuse or ask to narrow. |

#### E. Lite import

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload Lite `config.js`, deterministic conversion, validation report | Migration path from the free tier, an explicit target and success metric | MEDIUM | Parse the `CONFIG` object without executing arbitrary uploaded JS (the Lite validator extracts it; do not `eval`/`import` an uploaded file on the server). Report errors by field. |
| Import preview (counts: groups, deliverables, dependencies, warnings) before commit | Same trust pattern as AI | LOW | Cheap because the converter output can be validated before insert. |
| Preserve workflow states, labels, group order, themes where the SaaS model has a home for them | "Identical to Lite" requires round-tripping | MEDIUM | Gap risk: confirm where `WORKFLOW`, `ENTITY_LABELS`, `DASHBOARD_TEXT`, `NON_FILTERABLE_GROUPS` live in the SaaS schema. |

#### F. Org onboarding, membership and invites

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Self-serve signup creates the user's own org, user becomes admin | Stated target; also the success metric's entry point | MEDIUM | First-login provisioning exists for `users`; org creation on first login is new. Make it idempotent (double-click or retried callback must not create two orgs). |
| Org name step (prefilled, editable) | Minimal setup that avoids "John's Org" everywhere | LOW | Keep to one field. |
| Guided empty state: three paths (generate with AI, import Lite config, start blank/sample) | Time-to-first-roadmap is the activation metric | LOW-MEDIUM | This is where the AI and import features pay off. |
| Invite by email with role (viewer/editor/admin) | Stated target | MEDIUM | Needs a new `invitations` table (id, org_id, email, role, token hash, invited_by, expires_at, accepted_at, revoked_at). Server-side record rather than self-contained token, so revoke/resend/audit work. |
| Pending invites list with resend and revoke; resend invalidates the older link | Standard; prevents multiple valid links in circulation | LOW-MEDIUM | Default expiry of ~7 days is the common convention. |
| Accept flow handles: new user (signup then join), existing user (login then join), already a member, expired/revoked invite | Failed acceptance is the top invite complaint | MEDIUM | Auth0 community threads show failed accepts invalidating invitations with no retry; design for retry. |
| Email-match rule: invite binds to invited email; mismatch shows a clear explanation and a route to sign in with the right account | Prevents wrong-user joins | MEDIUM | Do not silently attach whichever account is logged in. |
| Members list: change role, remove member | Basic admin | LOW | |
| Last-admin guard: cannot demote or remove the only admin | Prevents orphaned orgs. No source covered it, so this is a design requirement | LOW | Enforce in the API, not just the UI. |
| Org switcher for users in multiple orgs | A signed-up user who accepts an invite is in two orgs | LOW-MEDIUM | `X-Org-Id` mechanism exists; UI and a persisted "last org" preference are new. |
| Invite emails actually delivered (SMTP/provider config in `.env`) | Compose deployment must send mail | MEDIUM | Needs a mail transport and a dev fallback (log the link). Not specified anywhere in PROJECT.md. See gaps. |

#### G. AI usage limits

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hard per-org cap per period (calendar month), enforced server-side before the model call | One shared key pays for everyone; stated target | MEDIUM | Reserve atomically (single `UPDATE ... WHERE used + cost <= cap` or equivalent) so concurrent requests cannot overshoot. |
| Usage meter visible in the AI panel: "X of Y used, resets on DATE" | Users cannot manage what they cannot see; every comparable product (monday, ClickUp, Lovable, Zite) surfaces it | LOW-MEDIUM | Show to all members who can use AI, not only admins. |
| Warning at ~80% and a clear message at 100% | 50/80/100 is the most common threshold convention; monday notifies at 80% and 100% | LOW | In-app only is fine for v1; email notification to admins at 80/100 is a cheap add. |
| Exhausted state that says what happened, current usage, cap, reset date, and who to contact | Vague "limit reached" errors drive support load | LOW | v1 has no self-serve upgrade, so the CTA is "contact your admin / operator". |
| Manual editing keeps working at 100% | The cap must degrade only AI, never core editing | LOW | Architectural rule: AI is an optional layer. |
| Per-request input limits (characters/tokens, file size, rows) | One 10 MB document can burn a month of budget | LOW | Reject early with the limit stated. |
| Per-user rate limit (burst) in addition to org cap | One member (or a script) should not exhaust the org's month in minutes | LOW-MEDIUM | Simple token bucket per user. |
| Cost accounting in units users understand ("AI actions"), with cost weights by operation | Token counts mean nothing to PMO users | LOW-MEDIUM | Suggest generation from a document costs more units than a single edit (monday also weights by feature). Track raw tokens internally for operator visibility. |
| Fair charging rules: provider errors and validation-failed outputs not charged; a valid proposal is charged even if discarded | Keeps the meter trustworthy | LOW | Decide and document; users notice unfair metering. |
| Cap configurable per org by the operator (DB/env default) | One instance serves many orgs; a design partner will need a bump | LOW | No billing UI in v1. A default from `.env` plus a per-org override column is enough. |
| Usage ledger (who, when, operation, units, tokens) | Needed for debugging disputes and for v2 billing | LOW-MEDIUM | Append-only table; the cap check reads aggregates from it or a counter kept in step with it. |

### Differentiators (Competitive Advantage)

Align with Core Value (a roadmap that looks like Lite but is shared and editable) and with the PMO-governance positioning ("sits above execution tools"). Do not try to win on all of these in v1.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural-language edits against a milestone-driven governance model, with dependencies and blocking awareness ("add task in group X depending on A, B, C") | Comparable tools use AI for summaries, drafts and feedback synthesis (Productboard Spark mainly generates specs/briefs; Aha!'s assistant centres on feedback and prioritization; Atlassian's roadmap AI is aimed at discovery). A confirm-gated structured editor of the schedule graph itself is not documented in what I could verify | HIGH | This is the real differentiator and is already in scope. Confidence MEDIUM, because competitor docs are thin and change quickly. |
| Per-operation accept/reject in the diff (not only all-or-nothing) | Partial approval is a recurring ask in AI diff-review UX; saves re-prompting | MEDIUM | Needs ops to be independently applicable; dependent ops (new task + link to it) must be grouped so you cannot accept the link without the task. |
| Visual preview on the timeline itself (ghost bars, dashed arrows for proposed items) in addition to the diff list | A PMO leader judges a roadmap visually, not as a list of field changes | MEDIUM-HIGH | Reuse the real timeline renderer with a "proposed" overlay. Strong fit for "looks like Lite". Defer if time is tight; the diff list is the table-stakes floor. |
| "Impact check" line in the preview: new blocked items, dependency cycles introduced, items moved past a key milestone, KPI deltas | Governance value: AI edit consequences before commit | MEDIUM | Cheap given `js/core` dependency and stats logic is pure: run it on before/after states. Likely the best value per effort among differentiators. |
| Refine a pending proposal conversationally ("also make it depend on C") before confirm | Fewer discard-and-retype loops | MEDIUM | Bounded to a single pending proposal, not a persistent chat. Each refinement counts toward the cap. |
| Merge/append AI-generated content into an existing roadmap with the same preview | Real use: "add these Q3 items from this PRD" | HIGH | Name collisions and group matching make this much harder than create-new. v1.x. |
| AI change history: who/what/when, with prompt, per change set, restorable | Auditability, and a governance product should have it | MEDIUM | Falls out of change-set ids on `audit_events`; a visible history panel is the add-on. |
| Lite-config import that preserves everything round-trip, and a Lite-compatible JSON/config export | Gives free-tier users a no-risk path both ways (open-core trust) | MEDIUM | Export to JSON already exists; a "download as config.js" would close the loop. |
| Confidence/"inferred" markers on AI-generated dates and dependencies | Honest uncertainty in a governance tool | LOW-MEDIUM | Marker lives in the proposal preview only; clear on confirm. |
| Admin AI usage breakdown by member, plus admin-set per-member limits | Org admins asked "who used my quota" | MEDIUM | Ledger already has user id. v1.x unless a design partner asks. |
| Drag a bar on the timeline to reschedule (move all milestones by a delta) / drag a milestone marker | Expected in Gantt tools (Roadmunk, monday, Linear timeline, Quickbase and others all offer drag to move); not in Lite | HIGH | See anti-feature note on cascading. Treat as v1.x or a stretch: implement as "move bar" (shifts every milestone by the same delta) and "move marker" (changes one milestone), both writing through the same edit API and respecting the full-rerender convention. |
| Drag from one bar to another to create a dependency | Most common dependency UX in Gantt tools (Quickbase, Zoho, Umbrava pattern) | HIGH | Needs milestone from/to selection after the drop (not just finish-to-start). Picker-based creation is the table-stakes substitute. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI applies changes without preview ("auto-apply" toggle, "trust mode") | Faster; users get tired of confirming | Already out of scope; one wrong name match silently edits a shared roadmap; no recovery story | Keep confirm. Make confirm one click for small proposals and surface "undo" afterwards. Do not add a setting. |
| Persistent free-form AI chat assistant with memory, Q&A about the roadmap, tool use across the product | Competitors market "AI copilots" (Notion AI, ClickUp Brain, Asana AI, Aha!'s assistant) | Different product: large scope, cost unpredictable, hard to cap, hard to preview. Also dilutes the clear "describe a change, review, confirm" contract | One-shot "propose change" with optional refinement of the pending proposal. Revisit Q&A/summaries in v2. |
| Auto-rescheduling cascades (move A and everything dependent on A shifts automatically) | Standard in MS Project-style tools | Lite's dependencies are milestone-pair references that drive blocking indicators, not a scheduling engine; silently changing dates in a governance view corrupts reported status. Large new logic area | Show blocking/conflict warnings (already Lite behavior) and optionally suggest shifts in an AI proposal where the user reviews them. |
| Real-time multi-cursor collaborative editing | "Google Docs for roadmaps" | Large infrastructure (CRDT/WebSocket), conflicts with the Lite full-re-render model and RLS-per-request design. Not needed for roadmaps edited a few times a week | Optimistic-concurrency conflict detection with a clear message, plus refetch on focus. |
| Per-organization bring-your-own API key | Enterprise buyers ask for it | Already out of scope; multiplies integration, support and security surface | One server key and a per-org cap. Revisit with billing in v2. |
| Multiple AI providers / model picker | Users like choice | Out of scope; complicates structured-output reliability and testing | Claude only; operator can change the model by config. |
| "Unlimited" or soft-only AI usage in v1 | Friendlier than hard caps | One shared key pays for everyone; a single org or script can exhaust the budget | Hard cap, visible meter, operator-adjustable. |
| Token-level usage display / metered billing UI | Seems transparent | Meaningless to PMO users; creates billing-system scope that v1 explicitly defers | "AI actions" units; token data stays internal. |
| Credit rollover, top-up purchase, overage billing | Common in competitors' pricing | These are billing features (v2) | Reset each period; operator override only. |
| Domain-based auto-join / SSO/SCIM provisioning in v1 | Enterprise checklist items | Large scope; auto-join also makes the "own org per signup" model leaky | Email invites only. Document as v2. |
| Multi-step undo/redo stack for every manual edit across sessions | "Like Figma" | Heavy state design; conflicts with server-authoritative shared data | Undo toast for delete/last action, and AI change-set undo; use audit history for everything else. |
| Importing from Jira/Asana/etc. in v1 | README mentions Jira as SaaS vision | Out of scope; each connector is a separate project | CSV/spreadsheet upload through the AI path already covers "get my data in". |
| Rich-text/comment threads/approvals workflow on items | Present in Productboard/Aha! | Moves toward execution-tool territory; RoadmapSnap positions above execution tools | Keep fields lean; link to the system of record via the existing `link` field. |
| Custom-built email templates/branding editor for invites | Polish | Pure scope creep | One plain, well-written template. |

## Feature Dependencies

```
Milestone + dependency API endpoints (do not exist yet)
    +--required by--> Manual editing UI (create/edit/delete, dependency picker)
    +--required by--> AI proposal apply (same write path, same RLS + role checks)
    +--required by--> Lite config import (bulk write path)

Shared validation rules (configValidator semantics, server-side)
    +--required by--> Manual edit validation
    +--required by--> AI proposal validation (before preview)
    +--required by--> Import validation

Closed operation vocabulary (addProject, updateProject, moveToGroup, setMilestoneDate,
  addDependency, removeDependency, setRisk, descope, delete, renameGroup ...)
    +--required by--> AI NL edits (model emits only these ops)
    +--required by--> Diff preview rendering
    +--required by--> Per-operation accept/reject
    +--required by--> AI undo (inverse of each op, or restore from audit payload_before)

Name -> ID resolution (server-side fuzzy lookup)
    +--required by--> NL edits ("depends on A, B, C")
    +--enhances----> Ambiguity handling (candidates list / clarification)

Optimistic concurrency (version / updated_at)
    +--required by--> Manual edit conflict handling
    +--required by--> AI confirm staleness check

Change-set id on audit_events
    +--required by--> AI undo, AI change history
    (audit trigger already captures payload_before/after per row)

AI service layer (prompt -> structured proposal, retries, size limits)
    +--required by--> Generate from prompt / pasted doc / uploaded file
    +--required by--> NL edits
    +--required by--> Usage metering

Usage ledger + atomic cap reservation
    +--required by--> Any AI call (pre-check before the model call)
    +--required by--> Usage meter UI, 80%/100% warnings
    +--enhances----> Admin usage breakdown (v1.x)

Invitations table + mail transport
    +--required by--> Invite by email, resend, revoke, accept flow
    +--requires----> Auth0 signup/login return path that carries invite token

Org auto-creation on first login (idempotent)
    +--required by--> Self-serve signup
    +--required by--> Guided empty state
    +--conflicts-with--> Invite-first signup unless the accept flow skips own-org creation
         (decide: invited new users get no personal org, or get one plus the invited org)

Multi-org membership (exists) --required by--> Org switcher (needed once invites + own-org coexist)

Shared js/core logic in the app (PROJECT.md goal)
    +--required by--> Lite-identical view
    +--enhances----> AI impact check (run pure stats/dependency functions on before/after state)

Role model (exists)
    +--required by--> Role-aware editing UI, AI access (editor+), invites (admin)

Timeline drag editing --requires--> Manual edit API + concurrency check
Dependency drag-to-link --requires--> Timeline drag infra + milestone from/to chooser
Merge AI content into existing roadmap --requires--> Create-new generation + name matching + per-op accept/reject
```

### Dependency Notes

- **Manual edit API is the foundation for AI.** AI never gets a private write path: proposals become the same writes a manual edit performs. Build and test the edit endpoints first (also satisfies the RLS/role constraint).
- **The operation vocabulary is the central design artifact.** Preview, per-op accept, impact check, and undo all hang off it. Decide it before the AI prompt work.
- **Invite flow vs own-org-on-signup conflict.** An invited new user hitting Auth0 signup would otherwise get an empty personal org created, which clutters onboarding. Needs an explicit product decision early (see MVP and gaps).
- **Usage metering must wrap every AI call from the first AI feature.** Retrofitting after AI endpoints ship is where cap bypasses happen.
- **Drag editing conflicts with nothing technically, but depends on a stable edit API.** Safe to defer.

## MVP Definition

### Launch With (v1)

- [ ] Lite-identical roadmap view on shared logic (timeline, KPIs, dependencies, filters, themes, exports): Core Value
- [ ] Milestone and dependency API endpoints plus server-side validation, optimistic concurrency, role checks: foundation for everything else
- [ ] Side-panel create/edit/delete for deliverables, groups, milestones; dependency picker; delete undo toast; role-aware UI
- [ ] Lite config import with preview and validation report
- [ ] Self-serve signup creating an org, guided empty state (AI / import / blank), org switcher
- [ ] Invites with role, pending list, resend/revoke, expiry, email-match, member role change/removal, last-admin guard, working mail transport
- [ ] AI generation from prompt, pasted text and CSV/spreadsheet/markdown into a new roadmap, with preview, validation and inferred-value flags
- [ ] AI NL edits with: closed operation set, name -> ID resolution, ambiguity prompts, grouped diff preview, explanation line, staleness check, atomic apply, post-apply undo of the change set
- [ ] AI usage cap: atomic reservation, ledger, meter in UI, 80%/100% messaging, per-request input limits, per-user rate limit, operator-adjustable per-org cap
- [ ] docker compose deployment (already scoped)

### Add After Validation (v1.x)

- [ ] Timeline drag-to-reschedule (bar and milestone marker) - trigger: users ask for it, or edit-form friction shows up in feedback
- [ ] Per-operation accept/reject in the diff - trigger: users discard whole proposals to avoid one bad op
- [ ] Impact check line in preview (blocked items, cycles, KPI deltas) - cheap early win if time allows; could pull into v1
- [ ] Visual timeline preview overlay (ghost items)
- [ ] AI change history panel and admin usage-by-member view
- [ ] Inline editing of simple fields in the list/table
- [ ] Download as Lite `config.js`

### Future Consideration (v2+)

- [ ] Billing, plans, top-ups, overage (explicitly v2)
- [ ] Merge AI-generated content into an existing roadmap
- [ ] Roadmap Q&A / summaries / status-report generation (conversational AI)
- [ ] Drag-to-create dependency
- [ ] Domain auto-join, SSO/SCIM
- [ ] Jira integration, predictive risk scoring (README vision)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Lite-parity view on shared core | HIGH | MEDIUM-HIGH | P1 |
| Milestone/dependency API + validation + concurrency | HIGH | MEDIUM | P1 |
| Manual edit forms (deliverables, groups, milestones, dependencies) | HIGH | MEDIUM | P1 |
| Lite config import | HIGH | MEDIUM | P1 |
| Signup-creates-org + empty-state paths | HIGH | MEDIUM | P1 |
| Invites (full lifecycle) + mail + last-admin guard | HIGH | MEDIUM-HIGH | P1 |
| AI generation (prompt/paste/file) with preview | HIGH | HIGH | P1 |
| AI NL edits: preview, name resolution, ambiguity, atomic apply | HIGH | HIGH | P1 |
| AI undo of change set | MEDIUM-HIGH | MEDIUM-HIGH | P1 |
| AI usage cap + meter + limits | HIGH (cost protection) | MEDIUM | P1 |
| Impact check in preview | MEDIUM-HIGH | MEDIUM | P2 (pull to P1 if cheap) |
| Per-op accept/reject | MEDIUM | MEDIUM | P2 |
| Timeline ghost-preview overlay | MEDIUM | MEDIUM-HIGH | P2 |
| Drag-to-reschedule | MEDIUM-HIGH | HIGH | P2 |
| Inline table editing | MEDIUM | MEDIUM | P2 |
| Change history / admin usage breakdown | MEDIUM | MEDIUM | P2 |
| Merge AI content into existing roadmap | MEDIUM | HIGH | P3 |
| Drag-to-create dependency | MEDIUM | HIGH | P3 |
| Conversational Q&A | LOW (for v1 goals) | HIGH | P3 |

**Priority key:** P1 must have for launch; P2 should have, add when possible; P3 later.

## Competitor Feature Analysis

Competitor details are limited to what public vendor pages and searches surfaced; behavior inside paid tiers was not verified.

| Feature | Competitors (observed) | Our Approach |
|---------|------------------------|--------------|
| AI roadmap/spec drafting | Productboard Spark generates briefs/PRDs and updates entities (public beta); Aha!'s assistant helps explore feedback and prioritize toward a roadmap "your team approves"; Atlassian describes roadmap-aware AI in Product Collection (early access) and idea generation in whiteboards. No source confirmed a confirm-before-apply step for roadmap changes | Structured proposal, validated, diff preview, explicit confirm, undo. Position as the trustworthy schedule editor rather than an idea generator |
| Natural-language edit of existing roadmap items | Not documented as a distinct feature in the sources found; copilots in Notion/ClickUp/monday/Asana are mostly generation, summarization, and automations | Core differentiator, scoped to a closed operation set |
| Drag to move/resize bars on timeline | Common (Roadmunk, monday, Quickbase, Zoho, Umbrava, Linear timeline) | Defer to v1.x; side-panel editing first |
| Dependency creation | Drag bar-to-bar (Quickbase, Zoho) or predecessor column editing (Precursive, Fluid, NetSuite OpenAir); monday community threads show demand for in-Gantt dependency management | Picker in the edit panel in v1 with from/to milestone selection |
| AI usage limits | monday: credits with notifications at 80% and 100%, grace period, then restriction; ClickUp: premium-model allocation with daily/weekly/monthly limits and a fallback to a standard model; Notion: windowed limits on some plans; HubSpot: spend caps by account/feature/action; Lovable: low-balance alerts that never block | Hard org cap, visible meter, 80/100 warnings, explicit exhausted message, manual editing unaffected, operator override |
| Invites | Standard: email invite with role, pending list, resend/revoke, ~7-day expiry (WorkOS, Auth0 guidance, multiple SaaS references) | Same, with email binding and last-admin guard |
| Org onboarding | Auth0 documents self-service signup and admin-led provisioning as the two B2B patterns; free tier org limits apply (about five orgs per the vendor post; verify against current Auth0 plan) | Self-serve org creation on first login (idempotent); no domain auto-join in v1 |

## Open Questions / Gaps (feed to roadmap research flags)

- **Own-org vs invited-user signup path** (product decision, blocks onboarding design): do invited new users also get a personal org? Recommendation: no, invited users join only the inviting org until they explicitly create another. Confidence on the recommendation: MEDIUM.
- **How orgs are created on first login with Auth0** (post-login Action vs API-side provisioning in `context.js`) was not resolved by search; needs phase-level research. Also verify Auth0 plan limits on number of Organizations if Auth0 Organizations is used; the current code keeps membership in its own `org_members` table, so Auth0 Organizations may not be needed at all. Recommendation: keep membership in the app DB.
- **Mail transport** for invites is unspecified in PROJECT.md and the compose stack has no mail service. Needs a decision (SMTP via env, with a console/log fallback in dev).
- **Where Lite config concepts live in the SaaS schema** (workflow states, labels, themes, `NON_FILTERABLE_GROUPS`, group order). Import fidelity depends on it.
- **AI cost-weight and default cap numbers** (units per operation, monthly default) need real token measurements on representative prompts and documents; nothing here is sourced.
- **Prompt-injection through uploaded/pasted documents**: treat document text as data, keep the model's only output channel the validated operation schema, and preview everything. Not researched in depth; flag for the AI phase.
- **Competitor AI behavior** is thinly documented publicly; re-check Productboard Spark, Aha! assistant, and Jira Product Discovery/Atlassian roadmap AI hands-on before positioning copy.

## Sources

- Atlassian: Jira Product Discovery / Atlassian Intelligence, Team '24 AI updates, Product Collection announcement (https://www.atlassian.com/blog/company-news/introducing-product-collection; https://www.atlassian.com/blog/announcements/team-24-ai-updates). Confidence MEDIUM, no confirm-before-apply semantics documented.
- Productboard Spark (https://www.productboard.com/blog/introducing-spark-ai-product-management-agent/, https://www.productboard.com/spark/). Confidence MEDIUM, vendor marketing.
- Aha! Roadmaps AI assistant tutorial page (https://www.aha.io/support/roadmaps/videos/tutorials/draft-your-2026-roadmap-with-the-ai-assistant); page is a video summary only, so mechanics unverified. Aha! vs Productboard blog is vendor-authored. Confidence LOW-MEDIUM.
- AI diff-review / human-in-the-loop UX patterns: aiuxplayground.com glossary (diff/patch review), ai-design-patterns "reversibility marking", VS Code agent review docs (https://code.visualstudio.com/learn/foundations/reviewing-and-controlling-agent-changes), Stagewise diff review docs, Tiptap AI suggestion docs, GitLab UX proposal on partial approval and rollback, Cursor forum threads on auto-applied edits. Confidence MEDIUM (practitioner conventions, consistent across sources).
- Entity ambiguity / clarification in tool-calling: arXiv 2511.08798 (structured-uncertainty clarification, ClarifyBench), Gravitee disambiguation article, USPTO 11256868 (clarifying questions for ambiguous entities). Confidence MEDIUM.
- AI usage-limit UX: monday.com AI Credits support article (https://support.monday.com/hc/en-us/articles/29544502265746-Changes-to-AI-Credits-model), ClickUp Brain usage help article (https://help.clickup.com/hc/en-us/articles/34741383911959-Track-your-Workspace-s-Brain-AI-usage), Lovable usage limits and alerts docs (https://docs.lovable.dev/features/usage-limits-and-alerts), HubSpot AI spend caps coverage, Dodo Payments billing UX and Schematic AI-credit articles, Zite AI credit limits help. Threshold conventions (50/80/100) are from vendor blogs, not measured data. Confidence MEDIUM.
- Gantt editing conventions: Quickbase Gantt plugin help, monday.com community threads, Precursive, Fluid, NetSuite OpenAir inline-editing docs, Zoho/Umbrava notes. monday and Roadmunk behavior not confirmed from official docs. Confidence MEDIUM.
- Invites and onboarding: Auth0 B2B onboarding and provisioning docs (https://auth0.com/docs/get-started/architecture-scenarios/business-to-business/provisioning, https://auth0.com/blog/user-onboarding-strategies-b2b-saas/), Auth0 community thread on failed invite accept, WorkOS B2B user management guide, DEV Community posts on tenant-bound invite links. The last-admin guard is not sourced; it is a design requirement. Confidence MEDIUM.
- Codebase (HIGH): `packages/api/src/db/migrations/V1__core_schema.sql` (`org_members`, `dependencies`, `audit_events`), `V3__audit_trigger.sql`, `packages/api/src/plugins/context.js` (org resolution via `X-Org-Id`, user provisioning), `.planning/PROJECT.md`, `README.md`.

---
*Feature research for: multi-tenant roadmap / PMO governance SaaS with AI-assisted editing*
*Researched: 2026-11-18*
