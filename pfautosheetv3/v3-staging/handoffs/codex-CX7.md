# CX7 handoff — structured spell progression tables

## Delivered

- Added `SpellProgressionRow`, `SpellProgressionTable`, and `SpellProgressionTables` to `src/types/character.ts`; `PF1Character.spellTables` is optional for backwards-compatible saves.
- Added pure staging adapter at `codex/CX7/spellTables.ts`.
  - Consumes only CX2-classified `casting-subgrid` / `extended-grid` tables.
  - Uses `Level` first and numeric `HD` as the only synonym.
  - Preserves `spd_*` / `sk_*` cell text losslessly in 20 fixed rows.
  - Exposes collection, immutable attach, level query, and a small matrix view for CX3.
- Added `codex/CX7/spellTables.test.ts` using actual CX2 ingest output, including stacked PFSRD-style headers and numeric HD.

## Verification

Run the focused suite with:

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\codex\CX7\spellTables.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\cx7.test.cjs
node $env:TEMP\cx7.test.cjs
```

## Adoption notes for AF8 / CX3

- Promote `spellTables.ts` into the chosen runtime layer, then call `collectSpellProgressionTables()` after CX2 ingest. Pass the ingest `documentId` for provenance.
- AF8 owns save-tree persistence and input normalization. Existing saves intentionally remain valid because `spellTables` is optional.
- CX3 can call `toSpellProgressionMatrix()` or `getSpellProgressionRow()`; do not re-scrape `text.md` or infer spell values from prose.
- The adapter deliberately does not choose a database or touch UI state.
