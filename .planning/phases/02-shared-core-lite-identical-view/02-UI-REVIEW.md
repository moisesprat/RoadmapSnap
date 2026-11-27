# Phase 02 — UI Review

**Audited:** 2026-11-27
**Baseline:** 02-UI-SPEC.md (approved 2026-11-21)
**Screenshots:** not captured. The parity build (`packages/app/dist-parity`) was served on a free port, but Playwright browsers are not installed (`npx playwright install` required), so the capture failed. No screenshots exist. All findings are code-derived. Visual parity of the Lite area (the core contract) was NOT verified by this audit and is left to the parity suite.
**Interaction captures:** off (workflow.ui_interaction_capture is false)

Scope audited: SaaS chrome only (`packages/app/src/components/{layout,projects,lite}`, `pages/`). The Lite area is parity-owned.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings are present nearly verbatim; the form dialog's icon-only "Close" has a non-contract accessible name, and `LoginPage` is off-contract |
| 2. Visuals | 3/4 | Focal-point and header rules are followed; form dialog keeps an unspecced "✕" glyph button and `LoginPage` still uses the old non-themed look |
| 3. Color | 3/4 | Chrome uses tokens; one hardcoded `#ffffff` in export and `LoginPage` uses `bg-blue-600`/`hover:bg-blue-700` |
| 4. Typography | 2/4 | Contract says 3 sizes and 2 weights, but 9 off-contract size classes and 7 off-contract weight classes remain, mostly in `ProjectFormModal` |
| 5. Spacing | 3/4 | Header, notices and states follow the scale; the form modal uses `px-5`/`py-3`/`py-1.5` (20/12/6px) instead of 8/16/24 |
| 6. Experience Design | 3/4 | States, focus management, reduced motion, aria-busy and alerts are all implemented; screenshot-level proof is missing |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **`ProjectFormModal` still uses pre-contract Tailwind type classes** (`text-base`, `text-sm`, `text-xs`, `font-medium`, `font-normal`, `font-semibold` at lines 145, 161, 186, 201, 203, 217, 232, 241, 250) — the dialog reads as a different type system than the header and the other two dialogs, and violates the explicit rule "`font-medium` (500) is removed" — replace with `text-18 font-600` for the title, `text-12 font-600` for labels, `text-14 font-400` for checkbox labels and `text-12 font-400` for the hint.
2. **`LoginPage` was not migrated to the contract** (`pages/LoginPage.tsx:10,15`: `text-4xl font-bold`, `bg-blue-600`, `hover:bg-blue-700`, `font-medium`, `rounded-lg`, `px-8 py-3`) — it is the first screen every user sees, ignores the theme tokens, and breaks the rule that the only accent fill is a token-based primary button, and no chrome size above 18px — restyle the heading to 18/600 (or an explicit approved exception) and the button to the shared primary button classes (`bg-accent text-on-accent`).
3. **Form dialog spacing and close control deviate** (`ProjectFormModal.tsx:143-153, 159, 270`: `px-5 py-4`, `px-5 py-3`, `py-1.5`, `aria-label="Close"`, literal "✕") — 20px/12px/6px are not on the 4/8/16/24 scale, and the close name is generic where `ProjectsDialog` uses `Close projects dialog` — use `px-6`/`px-4`, `py-2`, and an accessible name such as `Close project form` with an SVG icon consistent with the icon rule.

Further issues (lower priority):

4. `LiteExportControls.tsx:56` hardcodes `backgroundColor: '#ffffff'`. Verify this is only a fallback after resolving `--color-bg-page`; the contract forbids a white fallback.
5. Project form inputs use `focus:ring-1 focus:outline-none` (lines 174, 195, 211, 226) instead of the contract's 2px accent `:focus-visible` ring with 2px offset, so mouse focus shows a ring and the ring is thinner than specified.
6. `ProjectFormModal` `Discard changes` button omits an explicit `font-400`/focus-visible class that the other dialog buttons carry (line 276), minor inconsistency.
7. Verify and capture the missing screenshots (desktop, tablet, mobile, 8 themes); the header wrap below 768px and the 240px workspace-select truncation are unverified visually.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified present in code: `Discard changes` (ProjectFormModal:278), `Keep project` / `Deleting…` (DeleteProjectModal:75,83), `Adding…` / `Saving…` (ProjectFormModal:132), `Enter a project name.` (ProjectFormModal:179), `Retry loading` (PageStates:58), `No workspaces yet` (PageStates:82), `Workflow not configured` (PageStates:92), `Your session has expired` (PageStates:71), `PNG export failed` (DashboardPage:20), theme-not-saved notice (hooks/useTheme.ts:17), `Account menu` (UserMenu:47), `Close projects dialog` (ProjectsDialog:56), `Select workspace` / `No workspaces` (SaasHeader:55,58).

- No `Cancel`, `Submit` or `OK` labels in chrome. The "no generic label" rule is met.
- WARNING: `ProjectFormModal.tsx:149` uses `aria-label="Close"`, a generic accessible name, contrary to the "names its action or its object" rule.
- WARNING: `LoginPage.tsx` was outside the copy contract and was not reviewed against it; its heading and button copy were not verified against any spec.
- Not verified: delete body text with the project name and exact empty-notice strings (grep matched only a subset).

### Pillar 2: Visuals (3/4)

- Focal point rule is encoded: header is 48px, `Add project` is the single accent fill, chrome sizes stay at or below 18px in migrated components.
- Removed items (sidebar, tabs, floating menus, ThemeToggle) no longer appear in the component tree (`components/` holds only `layout`, `lite`, `projects`).
- Icon-only controls carry accessible names (`Account menu`, `Close projects dialog`), except the form dialog "Close".
- WARNING: `ProjectFormModal` close control is a literal "✕" text glyph, not the specified inline SVG icon style.
- WARNING: `LoginPage` uses `text-4xl font-bold`, which exceeds the 18px/600 chrome ceiling, and competes visually.
- Screenshots absent, so actual hierarchy and Lite-vs-SaaS pixel parity could not be confirmed by this audit.

### Pillar 3: Color (3/4)

- Chrome uses token utilities (`bg-accent`, `text-on-accent`, `text-danger`, `bg-bg-secondary`, `border-border`). `bg-accent` appears on the header primary, PageStates retry button and dialog submits only, matching the reserved list.
- Danger is used for load/session error titles and dialog error text as specified.
- WARNING: hardcoded `#ffffff` at `components/lite/LiteExportControls.tsx:56`.
- WARNING: `pages/LoginPage.tsx:15` uses `bg-blue-600` and `hover:bg-blue-700`, which are not theme-aware and violate "the chrome hardcodes no hex values / m3 colors removed" intent.
- Hover on primary uses `hover:brightness-90` (contract: 0.92), negligible.

### Pillar 4: Typography (2/4)

Distribution in `components/` and `pages/` (excluding tests):

| Class | Count | In contract |
|-------|-------|-------------|
| text-12 | 8 | yes |
| text-14 | 25 | yes |
| text-18 | 4 | yes |
| text-sm | 7 | no |
| text-base | 1 | no |
| text-xs | 1 | no |
| text-4xl (LoginPage) | 1 | no |
| font-400 | 12 | yes |
| font-600 | 13 | yes |
| font-medium | 5 | no (explicitly removed) |
| font-bold | 2 | no |
| font-normal / font-semibold | 1 / 1 | no (equivalent values, wrong token) |

BLOCKER-adjacent (scored 2, not 1, because the header, states, user menu and delete dialog are compliant): the largest chrome dialog, `ProjectFormModal`, carries 9 off-contract classes (lines 145, 161, 186, 201, 203, 217, 232, 241, 250), and `LoginPage` carries 3. The contract states "Existing chrome uses Tailwind defaults ... Replace with the mapped sizes above. `font-medium` (500) is removed." This was not finished.

### Pillar 5: Spacing (3/4)

- Header, notice and state blocks use `p-page`, `gap-4`, `mb-6`, `h-8` as specified. Only arbitrary values are `max-w-[240px]` (workspace select), `max-w-[120px]` (user name), `min-w-[220px]` (menu), all of which match declared truncation limits or menu width.
- WARNING: `ProjectFormModal` uses `px-5` (20px), `py-3` (12px), `py-1.5` (6px), which are off the declared 4/8/16/24 scale. The 20px page gutter is the only declared exception.
- `ProjectsDialog` buttons use `px-3` (12px) at line 17, also off-scale (contract: padding 8px 16px).

### Pillar 6: Experience Design (3/4)

- Loading: `LoadingSkeleton` with `aria-busy`, three fixed-height blocks, `motion-safe:animate-[pulse...]` so reduced-motion disables the pulse (PageStates:14-20).
- Error: `role="alert"` on load error and session-expired states and on form/delete failure blocks; notice region is `role="status"` `aria-live="polite"` with a dismiss control (PageStates:115-125).
- Empty: workspace-less, no-workflow and no-project states exist.
- PNG export: `aria-busy` on the export button (LiteExportControls:34).
- Destructive: delete confirmation with `Keep project` focused by default (DeleteProjectModal:35).
- Form: submit disabled while name is empty or pending; pending labels present.
- Focus-visible: shared Lite-control ring is in `packages/tokens/components.css:1356-1363`. WARNING: project form inputs use `focus:` rather than `focus-visible:` with a thinner ring (see Priority fix 5).
- WARNING: no screenshot or interaction evidence, so keyboard flows, dialog focus return and mobile header wrap are code-derived only.
- Registry audit: skipped. `components.json` does not exist and UI-SPEC declares no third-party registries.

---

## Files Audited

- /Users/moises/Documents/Code/RoadmapSnap/.planning/phases/02-shared-core-lite-identical-view/02-UI-SPEC.md
- /Users/moises/Documents/Code/RoadmapSnap/.planning/phases/02-shared-core-lite-identical-view/02-CONTEXT.md (header only)
- /Users/moises/Documents/Code/RoadmapSnap/packages/app/src/components/layout/{SaasHeader,UserMenu,PageStates}.tsx
- /Users/moises/Documents/Code/RoadmapSnap/packages/app/src/components/projects/{ProjectFormModal,ProjectsDialog,DeleteProjectModal}.tsx
- /Users/moises/Documents/Code/RoadmapSnap/packages/app/src/components/lite/LiteExportControls.tsx (and grep across `components/lite/`)
- /Users/moises/Documents/Code/RoadmapSnap/packages/app/src/pages/{DashboardPage,LoginPage}.tsx
- /Users/moises/Documents/Code/RoadmapSnap/packages/app/src/hooks/useTheme.ts
- /Users/moises/Documents/Code/RoadmapSnap/packages/tokens/components.css (focus-visible block)
