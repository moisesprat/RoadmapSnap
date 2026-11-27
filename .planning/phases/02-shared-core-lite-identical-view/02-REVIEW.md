---
phase: 02-shared-core-lite-identical-view
reviewed: 2026-11-27T00:00:00Z
depth: standard
files_reviewed: 156
files_reviewed_list:
  - .dockerignore
  - .github/workflows/api-ci.yml
  - .github/workflows/app-ci.yml
  - .github/workflows/ci.yml
  - .github/workflows/parity.yml
  - .gitignore
  - AGENTS.md
  - compose.yaml
  - css/roadmap.css
  - docs/monorepo.md
  - index.html
  - js/app.js
  - js/core/dependencies.js
  - js/core/stats.js
  - js/core/timeline.js
  - js/core/viewModel.js
  - js/core/workflow.js
  - js/export/csv.js
  - js/export/json.js
  - js/state/appState.js
  - js/ui/dashboard.js
  - js/ui/dependencyArrows.js
  - js/ui/exportControls.js
  - js/ui/filterBar.js
  - js/ui/grouping.js
  - js/ui/page.js
  - js/ui/timelineGrid.js
  - package-lock.json
  - package.json
  - packages/api/Dockerfile
  - packages/api/package.json
  - packages/api/src/lib/links.js
  - packages/api/src/lib/themes.js
  - packages/api/src/routes/auth.js
  - packages/api/src/routes/projects.js
  - packages/api/tests/auth.test.js
  - packages/api/tests/projects.test.js
  - packages/app/index.html
  - packages/app/package.json
  - packages/app/parity-view.html
  - packages/app/parity.html
  - packages/app/src/api/client.test.ts
  - packages/app/src/api/client.ts
  - packages/app/src/components/layout/PageStates.tsx
  - packages/app/src/components/layout/SaasHeader.test.tsx
  - packages/app/src/components/layout/SaasHeader.tsx
  - packages/app/src/components/layout/UserMenu.tsx
  - packages/app/src/components/lite/download.ts
  - packages/app/src/components/lite/LiteDashboard.test.tsx
  - packages/app/src/components/lite/LiteDashboard.tsx
  - packages/app/src/components/lite/LiteDependencyArrows.test.tsx
  - packages/app/src/components/lite/LiteDependencyArrows.tsx
  - packages/app/src/components/lite/LiteExportControls.test.tsx
  - packages/app/src/components/lite/LiteExportControls.tsx
  - packages/app/src/components/lite/LiteFilterBar.test.tsx
  - packages/app/src/components/lite/LiteFilterBar.tsx
  - packages/app/src/components/lite/LiteFooter.tsx
  - packages/app/src/components/lite/LiteRoadmapView.test.tsx
  - packages/app/src/components/lite/LiteRoadmapView.tsx
  - packages/app/src/components/lite/LiteTimelineGrid.test.tsx
  - packages/app/src/components/lite/LiteTimelineGrid.tsx
  - packages/app/src/components/projects/DeleteProjectModal.tsx
  - packages/app/src/components/projects/ProjectFormModal.tsx
  - packages/app/src/components/projects/ProjectModals.test.tsx
  - packages/app/src/components/projects/ProjectsDialog.tsx
  - packages/app/src/hooks/useDocumentClick.ts
  - packages/app/src/hooks/useLiteViewState.test.ts
  - packages/app/src/hooks/useLiteViewState.ts
  - packages/app/src/hooks/useTheme.test.tsx
  - packages/app/src/hooks/useTheme.ts
  - packages/app/src/index.css
  - packages/app/src/main.tsx
  - packages/app/src/pages/DashboardPage.test.tsx
  - packages/app/src/pages/DashboardPage.tsx
  - packages/app/src/parity/main.tsx
  - packages/app/src/parity/view.tsx
  - packages/app/src/test/__fixtures__/lite-arrows.json
  - packages/app/src/test/auth0Stub.tsx
  - packages/app/src/test/goldenMarkup.ts
  - packages/app/src/test/liteArrows.characterization.test.ts
  - packages/app/src/test/liteRenderer.ts
  - packages/app/src/test/pageIsolation.test.tsx
  - packages/app/src/test/prepaint.test.ts
  - packages/app/src/test/rectMock.ts
  - packages/app/src/test/setup.ts
  - packages/app/src/vite-env.d.ts
  - packages/app/tailwind.config.ts
  - packages/app/vite.config.ts
  - packages/core/package.json
  - packages/core/src/adapter.js
  - packages/core/src/arrows.js
  - packages/core/src/dates.js
  - packages/core/src/defaults.js
  - packages/core/src/dependencies.js
  - packages/core/src/export.js
  - packages/core/src/filters.js
  - packages/core/src/index.js
  - packages/core/src/markup.js
  - packages/core/src/models.js
  - packages/core/src/stats.js
  - packages/core/src/themes.js
  - packages/core/src/timeline.js
  - packages/core/src/timelineModel.js
  - packages/core/src/viewModel.js
  - packages/core/src/viewState.js
  - packages/core/src/workflow.js
  - packages/core/tests/adapter.test.js
  - packages/core/tests/arrows.test.js
  - packages/core/tests/dates.test.js
  - packages/core/tests/dependencies.test.js
  - packages/core/tests/export.test.js
  - packages/core/tests/filters.test.js
  - packages/core/tests/markup.test.js
  - packages/core/tests/models.test.js
  - packages/core/tests/purity.test.js
  - packages/core/tests/stats.test.js
  - packages/core/tests/themes.test.js
  - packages/core/tests/timeline.test.js
  - packages/core/tests/timelineModel.test.js
  - packages/core/tests/viewModel.test.js
  - packages/core/tests/viewState.test.js
  - packages/core/tests/workflow.test.js
  - packages/core/tsconfig.build.json
  - packages/core/tsconfig.json
  - packages/parity/lib/compare.ts
  - packages/parity/lib/lite.ts
  - packages/parity/lib/saas.ts
  - packages/parity/lib/states.ts
  - packages/parity/package.json
  - packages/parity/playwright.config.ts
  - packages/parity/scripts/build-targets.mjs
  - packages/parity/scripts/docker-test.sh
  - packages/parity/scripts/static-server.mjs
  - packages/parity/tests/fonts.spec.ts
  - packages/parity/tests/interactions.spec.ts
  - packages/parity/tests/lite-vs-lite.spec.ts
  - packages/parity/tests/png.spec.ts
  - packages/parity/tests/saas-vs-lite.spec.ts
  - packages/parity/tests/view-vs-lite.spec.ts
  - packages/tokens/components.css
  - packages/tokens/lite.css
  - packages/tokens/package.json
  - packages/tokens/tokens.css
  - packages/tokens/tokens.js
  - README.md
  - tests/core/characterization.test.js
  - tests/fixtures/config.complex.js
  - tests/fixtures/lite-export-snapshots.json
  - tests/fixtures/lite-html-snapshots.json
  - tests/guards/ci-config.test.js
  - tests/guards/lite-isolation.test.js
  - tests/guards/no-app-lib.test.js
  - tests/guards/themes.test.js
  - tests/helpers/liteRender.js
  - tests/helpers/roadmapToApi.js
  - tests/ui/liteHtml.test.js
findings:
  critical: 3
  warning: 9
  info: 4
  total: 16
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-27
**Depth:** standard
**Files Reviewed:** 156 (source read in full; generated JSON snapshots, lockfile, fixtures and CSS skimmed only)
**Status:** issues_found

## Summary

The phase moves Lite's rules into `@roadmapsnap/core` and renders them from React. Structure is sound: core is pure, `dangerouslySetInnerHTML` is restricted to constant SVG strings, links go through `safeHttpUrl`, and the API enforces an http(s) allowlist on write.

The main risk is that rules written for a single trusted Lite config now run on tenant-controlled data (group names, workflow keys, workspace settings, project dates), and several of them crash or misbehave on legal input. Three defects are blockers:

- A project whose group is named `constructor`, `toString`, `__proto__` or `hasOwnProperty` throws inside `groupDeliverables`, which blanks the dashboard for every user of that workspace.
- The delete-project client call always fails against the real API.
- The 3, 6 and 12 month zoom produces wrong months when today falls on the 29th to 31st.

Items already tracked (CSV formula injection, hardcoded `#ffffff` PNG background) are not repeated.

## Critical Issues

### CR-01: Group name equal to an Object.prototype key crashes the whole timeline (stored DoS)

**File:** `packages/core/src/timelineModel.js:56-75` (also `packages/core/src/stats.js:89-93`)
**Issue:** `groupDeliverables` builds `groups` as a plain `{}` and tests `if (!groups[groupName])`. For `constructor`, `toString`, `valueOf`, `hasOwnProperty` or `__proto__`, that lookup returns an inherited truthy value, so the next line `groups[groupName].push(source)` throws `TypeError: groups[groupName].push is not a function`. I reproduced this with node for all five names. `buildTimelineModel` runs inside `buildRoadmapModel`, so one bad group name breaks the render of the entire `LiteRoadmapArea`. In the SaaS, `group_name` is any string an editor can POST or PATCH, and every viewer of the workspace then sees a broken page. In Lite the same code path breaks the page for the config author. This behaviour existed in Lite, but moving it into core for tenant data turns it from an author-only quirk into a cross-user denial of service.
**Fix:**
```js
export function groupDeliverables(sources) {
    /** @type {Map<string, Deliverable[]>} */
    const map = new Map();
    const ungrouped = [];
    sources.forEach(source => {
        const name = source.group || null;
        if (!name) { ungrouped.push(source); return; }
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(source);
    });
    return { groups: Object.fromEntries(map) /* or return the Map and adjust callers */, ungrouped };
}
```
Alternatively use `Object.create(null)` for `groups`, and for `state.groupCollapsed` in `viewState.js`. Add a core test with group names `constructor` and `__proto__`.

### CR-02: Deleting a project always reports failure and never refreshes the list

**File:** `packages/app/src/api/client.ts:166` (caller `packages/app/src/hooks/useProjectMutations.ts:32`, `packages/app/src/components/projects/DeleteProjectModal.tsx:45`)
**Issue:** `request()` ends with `return res.json()`. `DELETE /projects/:id` answers `204` with an empty body (`packages/api/src/routes/projects.js:250`), and `Response.json()` on an empty body rejects with `Unexpected end of JSON input` (verified in node). The delete succeeds on the server, but the mutation rejects, so `onSuccess` never runs. The modal stays open with "Could not delete the project. Try again.", the `['workspace', id, 'projects']` query is not invalidated, and the deleted project stays in the list until the next refetch. A retry returns 404. The test stub in `ProjectModals.test.tsx` returns `json: async () => r.body ?? {}` for every call, so it hides this.
**Fix:**
```ts
if (res.status === 204 || res.headers.get('content-length') === '0') {
  return undefined as T
}
return res.json() as Promise<T>
```
Also make the test stub return an empty-body response for 204 (for example a real `new Response(null, { status: 204 })`) and assert the dialog closes.

### CR-03: Zoom months skip a month and overshoot the end when today is on the 29th to 31st

**File:** `packages/core/src/timeline.js:77-79` and `:106-107`
**Issue:** Two date-overflow bugs in `generateVisibleMonthsForZoom`:
1. `new Date(y, m + count, d)` overflows when the target month is shorter than `d` (31 Jan plus 3 months is "31 April", which becomes 1 May). The following clamp (`lastDayOfEndMonth`) is computed from the already overflowed date, so it never fires.
2. The loop advances with `cur.setMonth(cur.getMonth() + 1); cur.setDate(1);`. Starting at 31 Jan, `setMonth` gives "31 Feb", which becomes 3 Mar, so February is skipped.

For today = 31/01/2026 and zoom 3 the output is `Jan:1, Mar:31, Apr:30, May:1`: February is missing and there is a bogus 1-day May. Positions, header periods, today pointer and dependency arrows are all wrong for the 3, 6 and 12 month zoom on any such day, and `isDateInRange` hides milestones in the missing month. The code was copied from Lite, so both products agree, but the rule is now canonical in core and wrong. Fixing it changes Lite output on those days, so characterization tests (pinned to 15/04) will not catch it.
**Fix:**
```js
const cur = new Date(today.getFullYear(), today.getMonth(), 1);   // iterate by first of month
// end date: clamp the day to the last day of the target month
const target = new Date(today.getFullYear(), today.getMonth() + count, 1);
const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
const endDate = new Date(target.getFullYear(), target.getMonth(), Math.min(today.getDate(), lastDay));
// ... and advance with cur.setMonth(cur.getMonth() + 1) while cur is always day 1
```
Add tests for today = 31/01, 30/01, 29/01 (non-leap) and 31/08.

## Warnings

### WR-01: Workflow state keys that collide with stats fields throw or corrupt KPIs

**File:** `packages/core/src/stats.js:78-93`
**Issue:** `calculateStats` stores each state count as `stats[s.key]` on the same object that holds `total`, `visible`, `hidden`, `atRisk`, `descoped`, `visibleByStatus`, `hiddenByStatus`, `stateKeys`. `workflow_definition` is tenant-editable in the SaaS. A state keyed `total` or `atRisk` overwrites the counter, and one keyed `visibleByStatus` makes the next line (`stats.visibleByStatus[s.key] = 0`) throw in strict mode, because the property is now the number 0. `models.js` and `dependencies.js` then read the corrupted values.
**Fix:** Keep counts in a separate `counts` map (`Object.create(null)`) and expose them under a distinct field, or reject reserved keys in the workflow validator. At minimum, prefix state counters internally and map them back in `buildDashboardModel`.

### WR-02: Unbounded month range lets a settings value or milestone date freeze the browser

**File:** `packages/core/src/timeline.js:48-64`, `packages/core/src/adapter.js:62-85`
**Issue:** `generateMonths` loops from start to end with no cap. `settings.start_month` / `end_month` come from workspace `settings` (editor-writable through `PATCH /workspaces/:id`, validated only as `type: 'object'`), and `deriveTimelineRange` takes the min and max of any `\d{4}-\d{2}-\d{2}` milestone. `generateMonths('01/0001','12/9999')` returns 97,188 months, each rendered as a header cell, grid line and row. Years below 100 also map to 19xx through `new Date(year, ...)`. One bad value freezes every viewer's tab.
**Fix:** Cap the span (for example 600 months) in `generateMonths` and fall back to `deriveTimelineRange` or an empty list beyond it, and validate `settings.start_month`/`end_month` (`^(0[1-9]|1[0-2])/\d{4}$`, year 1970-2200) in the API.

### WR-03: CSV export does not escape quotes in group, tags or link

**File:** `packages/core/src/export.js:45-52`
**Issue:** Only the name cell doubles its quotes. Group, tags and link are wrapped in `"..."` without escaping, so any `"` in a SaaS group name or tag (`Core "platform"`) closes the field early and shifts every following column. This is separate from the tracked formula-injection item. The header comment records the formula gap only, and the "as Lite always has" reasoning does not hold for quote-doubling, because it never changes valid output. Only rows that already produce malformed CSV change.
**Fix:** Apply the same `replace(/"/g, '""')` to group, joined tags and link, and add a test with a quote in each field.

### WR-04: Lite inline handlers break on apostrophes and group names with `&`, `<`, `>`, `"`

**File:** `js/ui/timelineGrid.js:39` and `:70`, `js/ui/dashboard.js:31`
**Issue:** `onclick="toggleDependencyGraph('${row.name}', event)"` and `onclick="filterByStatus('${c.key}', event)"` interpolate through `html\`\``, which escapes `& " < >` but not `'`. A deliverable named `Team's API` renders `toggleDependencyGraph('Team's API', event)` (reproduced), a JS syntax error, so the dependency icon is dead, and a crafted name can inject script. The group header uses `escapeHtmlAttr` inside `html\`\``, which double-escapes: a group `R&D` is sent as `R&amp;D` after the browser decodes the attribute, so `toggleGroup` stores `groupCollapsed['R&amp;D']` and the section never collapses. The new core models make names tenant-shaped data. For Lite it is author-only data, so this is a functional bug rather than a cross-user one.
**Fix:** Drop the inline handlers for these three and use `data-` attributes plus delegated listeners, or pass the value as `JSON.stringify(name)` with `html` escaping only (one escape layer, and escape `'` and `\` for the JS string context).

### WR-05: Lite search box double-escapes its value

**File:** `js/ui/filterBar.js:113`
**Issue:** `value="${window.escapeHtmlAttr(model.searchValue)}"` runs inside `html\`\``, which escapes again. Searching `R&D` renders `value="R&amp;amp;D"` (reproduced), so after the debounced re-render the input shows `R&amp;D` and the next keystroke sends that text as the search. The React filter bar uses the raw value, so Lite and SaaS differ for any search containing `& " < >`, which also means the parity suite cannot cover that case.
**Fix:** Pass `model.searchValue` straight to `html\`\`` (it already escapes) and remove the `escapeHtmlAttr` call. Update the affected snapshot.

### WR-06: PATCH /projects/:id returns 500 on a concurrent duplicate name

**File:** `packages/api/src/routes/projects.js:171-226`
**Issue:** POST catches Postgres `23505` and maps it to 409, but PATCH relies only on a SELECT pre-check followed by the UPDATE. Two concurrent renames to the same name both pass the check and the second UPDATE throws an unhandled unique violation, which reaches the generic handler as a 500 with the error logged.
**Fix:** Wrap the UPDATE in `try { ... } catch (err) { if (err.code === '23505') return reply.status(409).send({ error: 'Conflict', message: 'A project with this name already exists in this workspace' }); throw err; }` and keep the pre-check only as a fast path.

### WR-07: Create stores an empty-string group instead of NULL when the form sends null

**File:** `packages/api/src/routes/projects.js:50,102` with `packages/app/src/components/projects/ProjectFormModal.tsx:117`
**Issue:** The POST schema declares `group_name: { type: 'string' }` without `nullable`, but the form sends `group_name: null` when the field is blank. Fastify's default Ajv `coerceTypes` turns `null` into `""` (reproduced), and `group_name?.trim() ?? null` keeps `""`. The database then holds `''` where an empty group should be NULL. PATCH declares `nullable: true` and uses `|| null`, so the two routes disagree. The adapter and Lite grouping tolerate `''`, so nothing visibly breaks today, but any query or filter on `group_name IS NULL` will miss these rows.
**Fix:** `group_name: { type: 'string', nullable: true }` in the POST schema and `group_name?.trim() || null` in the INSERT.

### WR-08: PATCH /auth/me persists arbitrary preference keys without a size bound

**File:** `packages/api/src/routes/auth.js:30-36` and `:55-56`
**Issue:** The `preferences` schema lists only `theme` and does not set `additionalProperties: false`, and the handler merges `{ ...current, ...incoming }`. A user can store any keys, up to the body limit, in their own `users.preferences` JSONB, which `/auth/me` then returns on every request. Separately, the post-merge `THEMES.includes` fallback is unreachable for new input because the schema enum already rejects bad themes.
**Fix:** Add `additionalProperties: false` under `preferences` and pick only known fields (`const { theme } = incoming`) when merging.

### WR-09: Text download revokes the object URL immediately after click

**File:** `packages/app/src/components/lite/download.ts:11-16` (same pattern in `js/export/csv.js:15-18`)
**Issue:** `URL.revokeObjectURL(url)` runs synchronously after `link.click()` on an anchor that was never attached to the document. Several browsers (notably Safari and some Firefox versions) start the fetch of the blob asynchronously and can abort the CSV and JSON download when the URL is revoked first. Failures are silent.
**Fix:** `document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);`.

## Info

### IN-01: Lite renders `row.link` unsanitized while SaaS uses `safeLink`

**File:** `js/ui/timelineGrid.js:42`
**Issue:** The core model supplies `safeLink` (http/https only) and the React grid uses it, but the Lite mapper still emits `href="${row.link}"`, so a `javascript:` link in a Lite config becomes a clickable script URL. Lite configs are author-controlled, so exposure is low, but the two products now differ and the intended single rule is not applied.
**Fix:** Use `row.safeLink` in the Lite mapper and gate `renderIf` on it.

### IN-02: Lite theme read is unguarded and unvalidated

**File:** `js/state/appState.js:3-5`
**Issue:** `localStorage.getItem` is not in a try/catch (only `setItem` is), so blocked storage throws at module load and Lite renders nothing. The stored value is used as is, although core now provides `normalizeTheme`, so an unknown value becomes `data-theme="x"` with no option selected. The SaaS pre-paint script and `useTheme` validate.
**Fix:** `try { t = localStorage.getItem(...) } catch {}` then `return normalizeTheme(t)` from `@roadmapsnap/core`.

### IN-03: Unreachable branch in `updateFilter`

**File:** `js/ui/filterBar.js:66-67`
**Issue:** The final `else { AppState.set({ filter: { ...state.filter, [key]: value } }) }` is unreachable: the markup only calls `updateFilter` with `search`, `sortBy`, `sortOrder` and `showGantt`. It bypasses the core transitions the file header says every change uses.
**Fix:** Remove the branch, or route unknown keys to a core transition.

### IN-04: `filterDeliverables` assumes `name` is a string while its sibling guards it

**File:** `packages/core/src/filters.js:56`
**Issue:** `source.name.toLowerCase()` throws for a deliverable without a name, whereas `filterBySearchOnly` (line 86) guards it. The adapter always supplies a string, but core is also fed by Lite configs and by `Deliverable` types that mark `name` required only by JSDoc.
**Fix:** `(source.name || '').toLowerCase()`, matching `filterBySearchOnly`.

---

_Reviewed: 2026-11-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
