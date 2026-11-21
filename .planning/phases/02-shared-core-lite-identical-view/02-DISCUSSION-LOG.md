# Phase 2: Shared Core & Lite-Identical View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 02-shared-core-lite-identical-view
**Areas discussed:** How SaaS renders the view, Theme set & persistence, Parity bar & verification, Core packaging & Lite delivery

---

## How SaaS renders the view

| Question | Options | Selected |
|----------|---------|----------|
| Markup strategy | React + Lite classes / Reuse Lite HTML strings / Shared renderers in core | React + Lite classes |
| Surrounding page | Thin SaaS header + Lite page / Pure Lite page, menus inside / Keep current AppShell | Thin SaaS header + Lite page |
| Existing project modals | Keep, outside the Lite area / Remove now / You decide | Keep, outside the Lite area |
| Display config source | Workspace data + core defaults / Add schema now | Workspace data + core defaults |

## Theme set & persistence

| Question | Options | Selected |
|----------|---------|----------|
| Theme set | All 8 / Only the 6 in VIEW-05 / 6 now, others later | All 8 |
| Persistence | Per user, cached locally / Per browser only / Per workspace | Per user, cached locally |
| Scope | Whole page / Roadmap area only | Whole page |

## Parity bar & verification

| Question | Options | Selected |
|----------|---------|----------|
| Tolerance | Near-zero, pinned env / Exact 0 pixels / Looser, plus markup test | Near-zero, pinned env |
| Coverage | All 8 themes × 2 fixtures / 2 themes × 2 fixtures / Every theme × every state | All 8 themes × 2 fixtures (+ key states) |
| Test data | Mocked API, live Lite diff / Real stack, seeded DB / Committed baselines | Mocked API, live Lite diff |
| CI gating | Required on relevant PRs / Every PR, blocking / Non-blocking / nightly | Required on relevant PRs |
| Exports | Same format via shared core / JSON is a Lite config / Loose match | Same format via shared core |

## Core packaging & Lite delivery

| Question | Options | Selected |
|----------|---------|----------|
| Lite loading | Build is the delivery / Keep no-build working / Vendor core into js/ | Build is the delivery |
| Core language | JS + JSDoc, generated .d.ts / TypeScript, compiled | JS + JSDoc |
| Node version | Node 24 LTS / Node 26 | Node 24 LTS |
| Data model | Core takes Lite shape; adapter in core / New neutral model / You decide | Core takes Lite shape; adapter in core |

## Claude's Discretion

- Extraction order and strangler mechanics, Tailwind preflight strategy, font parity, header details, Playwright image and diff tooling, frozen-date mechanism, `window.*` shims, `.d.ts` generation.

## Deferred Ideas

None.
