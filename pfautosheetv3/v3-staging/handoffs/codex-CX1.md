# CX1 handoff — classified SRD class extraction

AF7 promoted the adapter and its tests to `src/engine/classExtraction.ts` and
`src/engine/classExtraction.test.ts`. The staging copies listed below were
removed after comparison with the promoted files.

## Work done

Created the staging adapter for the Phase 2 class-extraction fixes. It consumes CX2 tables only and never falls back to arbitrary tables or prose-generated grids.

- **B3:** proficiencies are read only from the delimited `Weapon and Armor Proficiency` field, capped at 1,000 characters. It never scans the rest of the document as fallback.
- **B12:** class names use `Table:` through the first newline, tab, or table marker; Armorist resolves to `The Armorist`, not the following table data.
- **B13:** the entire classified class-grid header set remains named columns. `Max Bonus`, `Caster Level`, and `Magic Talents` are retained rather than folded into Special.
- **B14:** skills come exclusively from `Class Skills:`. Ability-score parentheticals are removed while `Knowledge (arcana)` is retained and normalized. Armorist produces all 13 listed skills.
- **Classified-table guard:** only the first `kind: class-grid` table is the core grid; `extended-grid` and `casting-subgrid` tables append values by level. `lookup-table` is never eligible. A missing class grid returns a clear failure message instead of a synthesized grid.

The CX2 preamble is now retained as its own section, fixing the source-document layout where class skills, HD, and proficiencies precede the first heading.

## Files created

- `pfautosheetv3/v3-staging/codex/CX1/classExtraction.ts` — classifier-consuming extraction adapter and scoped field parsers.
- `pfautosheetv3/v3-staging/codex/CX1/classExtraction.test.ts` — Armorist, bounded field parsing, and lookup-table guard tests.
- `pfautosheetv3/v3-staging/handoffs/codex-CX1.md` — this handoff.

## Files altered

- `pfautosheetv3/v3-staging/codex/CX2/ingest.ts` — retains document preamble content and adds source-engine-compatible lossless table cells/header grids.
- `pfautosheetv3/v3-staging/codex/CX2/ingest.test.ts` — accommodates the retained preamble section.
- `pfautosheetv3/v3-staging/codex/CX2/output-schemas.json` — requires the lossless table structures.

## Tests

- `node --experimental-strip-types --test pfautosheetv3/v3-staging/codex/CX1/classExtraction.test.ts pfautosheetv3/v3-staging/codex/CX2/ingest.test.ts` — 7 passed, 0 failed.
- `npm run lint` — passed.

## Open issues and requests

1. AF7 must promote the adapter into `src/engine/sotEngine.ts` and replace the legacy line/prose grid parser. `parseSrdSkillsAndProficiencies` in `src/engine/aiService.ts` should adopt the scoped parser rules from this adapter.
2. The current `ExtractedSrdClassData` and `ClassGridRow` types cannot represent arbitrary named columns. CX3 owns the generic Matrix grid model and should map `columns`/`values` losslessly there.
3. CX2's staging parser was improved after locating `C:\Users\Austin\Documents\lazy as fuck\lazyafpf1builds\sheet-engine`; AF2 should prefer that engine's Cheerio/Turndown/MiniSearch implementation if its dependencies are adopted, while retaining the PF1 classification layer.
4. No source files under `src/` were changed; promotion remains AF7's responsibility.

## Do not include secrets

None written.
