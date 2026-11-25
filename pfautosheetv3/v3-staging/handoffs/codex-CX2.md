# CX2 handoff — four-output deterministic ingest and table classification

## Work done

Implemented the Phase 2 CX2 staging-only ingest layer. It accepts HTML, Markdown, plain text, PF1E `.srd.json` envelopes (`srdDocument.htmlContent`), and approved sheet JSON envelopes (`_pf1e_sheet`, `character`, or `data`). It rejects unknown or dangerous JSON shapes and oversized inputs.

Each call deterministically emits the required four artifacts:

- `table.json`: expanded rowspan/colspan cells, normalized headers, stable table IDs, document-order metadata, and one of `class-grid`, `casting-subgrid`, `extended-grid`, or `lookup-table` for every table.
- `links.json`: stable link records with anchor text and internal/external status.
- `text.md`: compact heading-aware text with stable table markers.
- `index.json`: manifest/hash, heading-aware sections and TOC, deterministic keywords, and a deterministic per-section BM25-style term index.

The pure classifier uses the approved header rules: BAB/Base Attack Bonus, Fort/Ref/Will aliases, Level, and HD only when it contains level counts. The first full class-shaped table wins `class-grid`; numeric extras remain named columns. Stacked PFSRD spell headers are flattened to `spd_*` / `sk_*`, omit the group row, and classify as an `extended-grid` when level-keyed. Other tables cannot become a class grid.

The source engine was subsequently located at `<user-home>\Documents\lazy as fuck\lazyafpf1builds\sheet-engine`. CX2 now mirrors its important ingest contract: heading-aware sections/TOC, stable table markers, raw span-preserving table cells plus expanded grids, link records, keyword provenance-ready output, and a local retrieval index. The staging implementation remains dependency-free; AF2 may promote the source engine's Cheerio/Turndown/MiniSearch implementations instead if it brings their dependencies into the server bundle and preserves CX2's PF1-specific classification contract.

## Files created

- `pfautosheetv3/v3-staging/codex/CX2/ingest.ts` — deterministic ingest, extraction, validation, classification, and inline output-schema contracts.
- `pfautosheetv3/v3-staging/codex/CX2/ingest.test.ts` — Armorist determinism, Markdown, lookup-table guard, JSON rejection, and both stacked spell-header shapes.
- `pfautosheetv3/v3-staging/codex/CX2/output-schemas.json` — serialized schemas for AF2/server persistence.
- `pfautosheetv3/v3-staging/handoffs/codex-CX2.md` — this handoff.

## Files altered

None. AF7 must promote the reviewed staging implementation into the production source tree. AF2 then owns endpoint/persistence integration.

## Tests

- `node --experimental-strip-types --test pfautosheetv3/v3-staging/codex/CX2/ingest.test.ts` — 4 passed, 0 failed.
- `npm run lint` — passed.
- `npm run build` — passed; existing Vite warnings remain for `vite.config.ts` `__dirname` and a >500 kB chunk.
- `npm test` — could not start because the installed `tsx` client calls `os.userInfo()` and Windows returns `uv_os_get_passwd ENOMEM`. This is the existing environment issue, not a CX2 test failure; the CX2 tests were run through Node's built-in TypeScript stripping successfully.

## Open issues and requests

1. AF2 should promote `ingest.ts` to `server/ingest/`, attach `POST /api/sot/ingest`, and persist the four artifacts under `<character>/SRD/<doc>/` through the folder-storage seam. No server or client production files were edited here.
2. CX1 must import this classifier rather than reimplement it, and should consume only `kind: class-grid`, associated `extended-grid`, and casting subgrids.
3. The staging tests are intentionally absent from `package.json`; CP2/AF7 should add the promoted test to the normal test command when it is moved into the source tree.
4. The record uses lightweight regular-expression HTML extraction to remain dependency-free. `lazyafpf1builds/sheet-engine` has the preferred Cheerio/Turndown/MiniSearch source that AF2 may promote if it retains the CX2 JSON envelope validation, PF1 table classifier, determinism, and no-execution policy.

## Do not include secrets

None written.
