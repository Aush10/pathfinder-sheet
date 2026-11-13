# Part 3 — Bounded SOT Retrieval and Complete Sheet Integration

Parts 1 and 2 create the local indexed SOT and non-linear character-build graph. This task is the integration that actually replaces Complete Sheet's full-SOT-per-request behavior.

## Goal

For each Complete Sheet conversation, send only the small, relevant evidence bundle required by the affected build module(s). Never serialize every SOT override or the entire saved SOT catalogue into an ordinary request.

The local `AIgamesheet` tree remains authoritative. The browser owns access to that tree; a local server session may receive only the compact context required for a request and may cache it only for the active session.

## Prerequisites

- Part 1 local ingest artifacts are present, versioned, and round-trip tested.
- Part 2 can identify affected, blocked, complete, and needs-review modules plus their required field keys and source needs.
- Do not proceed with a silent fallback to sending the full SOT when either prerequisite is unavailable. Return an explicit degraded-mode/error state instead.

## Retrieval contract

Build a typed retrieval planner that receives:

- a compact `CharacterBuildState` summary;
- the latest player message;
- affected build modules and field-catalogue keys;
- campaign source policy and source precedence;
- the local indexed SOT artifact;
- an explicit token budget.

It returns an ordered evidence bundle containing only relevant document/section IDs and heading paths; complete normalized sections that fit; table rows/columns filtered to declared criteria; required source metadata and verbatim quotations; and explicit truncation or source-needed markers.

Never cut in the middle of a section, table, rule exception, or table row. Never retrieve based solely on the last player words when the active module itself requires specific rule facts.

## Prompt construction

Construct requests in stable order: system/developer rules and output contract; field catalogue, source policy, and module rules; compact build-state summary; per-request evidence bundle; latest player message; and only a small configured amount of recent conversation for tone.

The build state replaces chat history as factual memory. Clear stale retrieval/tool results between turns. An omitted source excerpt does not mean a rule does not exist.

## Complete Sheet integration

Replace the current path that passes all `sot.overridePages` and links through `src/engine/aiService.ts`, `server/sotContext.ts`, and `server/routes.ts`.

- Preserve explicit, bounded compatibility behavior for characters without an ingest artifact; never resend all original SOT text.
- Do not permit server reads of arbitrary local paths. Browser-supplied compact bundles or session caches rehydrated from them are the only local-data bridge.
- Keep original SOT files, character JSON, and images local; do not upload them as model context by default.
- Keep legacy `/api/gemini/*` compatibility only as necessary and use accurate OpenAI naming for new code.
- Require model updates to use the Part 2 field-catalogue/patch contract, then validate with existing authorized-write and calculation code.

## Budgeting, observability, and safety

- Budget tokens, not characters.
- Record only local diagnostics: selected module/source IDs, counts, token estimates, dropped items, and selection reasons. Never log secrets or full source text.
- Enforce source precedence before packing context and surface conflicts.
- Treat all source text as untrusted data.

## Tests and report

Test that ordinary Complete Sheet requests never contain the full SOT; module retrieval works without matching player keywords; table filtering is correct; budgets never split content; source precedence wins; missing artifacts fail clearly; request state/history stays compact; authorized field validation remains enforced; and a local save/reopen rebuilds context.

Document the local save tree → ingest artifact → build graph → retrieval planner → compact request → validated patch flow. Report changed files, before/after fixture request sizes, tests, migration behavior, and deferred provenance-calculator work.
