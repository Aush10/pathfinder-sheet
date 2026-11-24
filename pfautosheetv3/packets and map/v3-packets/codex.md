# [v3] Codex tasks — PF1 Autosheet 1.3.0

**Distribution packet.** This is your slice of the approved v3 / 1.3.0 Roadmaplate. Do not start work until Austin tells you to. Do not assign or mention other agent bots. Do not edit `src/components/tools/AICompanionModal.tsx`. Ingest stays deterministic; the AI never classifies tables and never becomes SOT authority.

Austin's answers to Q1–Q14 are still pending. Defaults in this packet and in the tracking issue apply until he answers.


## README

### Version target
- **v3 = 1.3.0.** Copilot prepares the tag. The current `package.json` version is **unverified**; Copilot reads it first.

### Scope rules (every agent, every task)
1. **Touch only the files in your task's `filesscope`.** If you need any other file, stop and write it into your handoff as a request. Do not edit it.
2. **New files go only in the staging area:** `APP\v3-staging\<agent>\<task-id>\`, for example `v3-staging\codex\CX2\`. The only agent that moves files out of staging into `src\` or `server\` is the **AFK pilot**, in its integration task (AF7). Some tasks allow an exception and name the exact new path; those are the only exceptions.
3. **Never edit `src\components\tools\AICompanionModal.tsx`.** This holds even for bugs that live there (B8, I5, I6). See the workarounds in AG1 and the open question Q7.
4. **Never write, print, copy or commit credentials or secrets.** That includes `.env.local`, `OPENAI_API_KEY` and tokens. `.env.example` placeholders only.
5. **Ingest is deterministic.** No model call anywhere in the ingest pipeline, including table classification. AI output (summaries, suggestions, assign guesses) is never stored as SOT, never classifies a table, and never overrides SOT. It is advisory and labelled.
6. **Keep macro-language changes out of UI tasks.** Macaroni and syntax work lives only in CX5.
7. **One owner per file per phase.** Use the File Ownership table. When a file has two owners, the later one starts only after the earlier one's handoff exists.
8. **Labels:** `[confirmed]` = verified in code. `[likely]` / `[guess]` / `[unverified]` = check before acting.

### Handoff protocol
When a task finishes (or stops), the agent writes `APP\v3-staging\handoffs\<agent>-<task-id>.md` containing:
- **Work done:** what was fixed or built, with B-numbers and I-numbers.
- **Files altered:** each path, plus one line on what changed.
- **Files created:** each path, all in staging unless the task allowed otherwise.
- **Tests:** commands run and their results (`npm test`, `npx tsx --test …`, `npm run lint`, `npm run build`).
- **Open issues and requests:** files you needed but didn't own, and anything left unverified.
- **Do not include secrets.**

---


## Your role

Heavy backend and engine work: SRD class extraction, the four-output ingest pipeline and table classification, the Character Matrix engine (no UI), demo-data / tap-test logic, and Macaroni syntax migration.

## Phase order (do not start early)

Work is sequenced. Austin decides when each agent starts. Do not begin a task until its dependencies are done and Austin has told you to start. Phase 0 (verify first, read-only) happens before any code changes.

`AF0` → `AF1` → `CX2` → `CX1` → `AF2` → `CX4` → `AF3` → (`CX3` → `AG3`) ∥ `AG1` → (`CP2` → `AG5`), `AG4`, `AF4`, `AF5`, `CX5` → `AF7` → `CP1` finalize → **Austin prompts** → `CP3`.


## Dependencies for your tasks

- **CX2** starts after **AF1** (save/storage). Classification must exist before CX1.
- **CX1** starts after **AF1** and **CX2** (no longer parallel with CX2). Import CX2's classifier; do not reimplement it.
- **CX4** starts after CX1 (same file `aiService.ts`), and before AF3.
- **CX3** starts after Phase 2 (classified tables and stable section ids). Then Antigravity AG3 binds to the engine.
- **CX5** is last on `sotEngine.ts` and `aiService.ts` (after AF3). Keep macro-language changes out of UI tasks.

### File ownership table (prevents overlap)
A file with two owners is **sequenced**: the second owner starts only after the first owner's handoff exists, and touches only the section named.

| File (APP-relative) | Owner, in order | Sections |
|---|---|---|
| `src/storage/characterState.ts`, `fsAdapter.ts`, `useAutosave.ts`, `connectFolder.ts` | AFK (AF1, then AF2, then AF5) | all |
| `src/context/CharacterContext.tsx` (path **unverified**) | AFK (AF1) | persist effect |
| `src/engine/sotEngine.ts` | 1) AFK AF1 (host-storage functions) → 2) Codex CX1 (extractClassFromSrdDoc, parseImportedSrdFile) → 3) Codex CX5 (line ~510 buff syntax) | split by function |
| `src/engine/aiService.ts` | 1) Codex CX1 (parseSrdSkillsAndProficiencies) → 2) Codex CX4 (DEFAULT_SOT_CATALOGUE, tapTestNeedsInput, adaptArchetypeIntoGrid) → 3) AFK AF3 (complete-sheet request payload ~3034) → 4) Codex CX5 (buff syntax 195–849, executeScratchpadAIMacro) | split by function |
| `src/types/character.ts` | Codex CX3 | grid, career index, currency container types |
| `src/engine/currencyUtils.ts` | Copilot CP2 | reconcileCurrency default |
| `src/engine/multiclassCalculator.ts`, `characterIntegration.ts` | Codex CX3 | matrix apply |
| `src/components/tools/ClassArchitectModal.tsx` | Antigravity AG3 (after CX3) | all, including B9 sotDocs merge (uses AF1's scoped loader) |
| `src/components/tools/CompleteSheetChatWindow.tsx` | Antigravity AG1 | chips (B5), quick-save batch (I5) |
| `src/components/.../ActionDirectoryModule.tsx` | Antigravity AG3 | ability type editing |
| `src/components/sheet/SheetPage3BioStorage.tsx`, `StorageInventoryModule.tsx` | Antigravity AG5 (after CP2 and CX3) | scratchpad, race, coinage |
| `src/index.css`, `QuickModularTools.tsx`, `BlueprintSidebar.tsx`, `SheetPage1Core.tsx` | Antigravity AG4 | stepper and scrollbars |
| `src/App.tsx` | Antigravity AG1 (mount SOT panel) → AG4 (stepper button only, if 0.2 says so) | sequenced within Antigravity |
| `src/components/tools/LoadoutModal.tsx`, `src/utils/sheetExporters.ts` | AFK AF5 | IO, exports, import |
| `server.ts`, `server/routes.ts`, `server/sotContext.ts`, `server/prompts.ts`, `server/openai.ts` | AFK (AF2 → AF3 → AF4) | all |
| `package.json`, `vite.config.ts`, `README.md`, `docs/**`, `default_sheet.json`, orphan and debris files | Copilot (CP2, CP3) | all |
| `installer/*.ps1` | AFK AF6 (only if Q8 = in scope) | all |
| `src/components/tools/AICompanionModal.tsx` | **NOBODY** | — |

Note: I moved B16 (import) and I4 (exports) to AFK instead of Codex, so that `sheetExporters.ts` has a single owner. B11 is fixed inside CX3's id generator; Antigravity wires it in through AG3.

---


## Cross-cutting spec: table classification and stacked headers (verbatim)

This is Austin's source-of-truth classification. Your CX2 classifier implements it; CX1 and CX3 consume it. The AI never chooses the kind.

- **Table classification** (Austin, 2026-11-22, source of truth). An SRD can contain many tables. All are extracted and stored, but only some go into the class matrix. Classification is a deterministic header-and-shape check. **The AI never chooses the kind.** Austin also used "search grid" for the leftover kind; this document uses **lookup table** only.
  Kinds:
  1. **Class grid.** Detected by a header set that includes Level (or HD), BAB (or Base Attack Bonus), Fort save, Ref save, Will save, and Special. Add-class pulls only this grid, plus its extensions. Extra columns on the same table (CL, Talents, Max Bonus, and so on) stay as named columns; they are not folded into Special. That supersedes the "strip numeric columns" half of B13 once the generic grid exists.
  2. **Casting subgrid.** A Spells per day table with spell-level columns 0–9 or 1–9, and, when present, a Spells known table with the same. PFSRD usually presents these as a stacked (two-row) header: the group label is on top, and the numbers are underneath (see the stacked-header rule). If the table also covers the class's levels and has a Level header, treat it as an extended grid (next item). If the stacked spell columns sit on the class grid itself, they stay on that grid as prefixed columns and are not split into a second table.
  3. **Extended grid.** Any other table, anywhere in the document, that covers all 20 levels and has Level as a header (for example, sorcerer spells known listed separately from the class grid). Drop its Level column and append its value columns to the right of the rightmost class-grid column. (Row-count for prestige classes is Q12.)
  4. **Lookup table.** Every other table. It matches one value to another. It is stored and indexed, and **must not** be added to the final class matrix.
  **Hidden tables** are tables usually left off SRDs but needed for a complete matrix. Examples: extra spells per day and extra spells known (they apply to any caster); tables a reference index points at that are not in the main class; subsystem tables such as Spheres of Power talents known; implied arrays from ability phrasing, such as total feats and ASI treated as a race index rather than a class index, or race abilities gained at 6 / 12 / 18. Austin suggested headless tables for these later. **Deferred past 1.3.0** unless Q11 says otherwise.
  **Stacked spell headers (PFSRD, Austin 2026-11-22).** PFSRD likes to use a two-row header on spell sections. "Spells per Day" or "Spells Known" is a **group label** that spans the spell-level columns. The **actual headers** are the spell levels underneath (0–9 or 1–9). When those columns are populated into a class grid or an extended grid:
  - Exclude the stacked group row. It is not a data row and must not be treated as column headers.
  - Use the bottom row as the column headers.
  - Use the group label only as a prefix so spells per day and spells known stay distinct, for example `spd_1`…`spd_9` and `sk_0`…`sk_9`. The numbers come from the bottom row; do not invent a 0 column if the table starts at 1. Prefixes: Spells per Day → `spd_`, Spells Known → `sk_`.
  - Detection must handle both of these group-row shapes: (a) one merged cell (`colspan`) across the spell-level columns, and (b) a group row whose cells repeat the same label across the span (no merge).


### Codex

**CX1: SRD class extraction fixes (Phase 2)**
- **Explanation:** Add Class corrupts the sheet with bad SRD parsing, and must consume classified tables so it never pulls a lookup table as the class grid.
- **Details:**
  - Proficiencies come from the proficiency section only, ending at the next heading, with a length cap. Never run the fallback on the whole document (B3).
  - `Table\s*:` name regex: stop at newlines and tabs (B12).
  - Special column: stop dumping leftover numeric columns into Special (B13). Once the generic grid exists, keep those extras as named class-grid columns.
  - Class skills come only from the Class Skills line; keep "(arcana)" (B14).
  - Recognize homebrew HD and skill ranks (3+Int, 5+Int), or flag them clearly.
  - Label synthesized grids as "estimated" instead of presenting them as real.
  - `extractClassFromSrdDoc` reads CX2's classified `table.json`. It builds the class grid from `kind: class-grid` only, appends `extended-grid` columns (Level dropped, values on the right) and attached casting subgrids, and **never** uses a lookup table. If no class grid is found, fail with a clear message; do not fall back to "the first table" or to the whole document.
- **Issues:** B3, B12, B13, B14 (and P4/P5); table-classification guard.
- **Goals:** armorist gives name "Armorist", proficiencies under 1k chars, 13 class skills, a clean Special column (or named extra columns). The sorcerer fixture appends spells known. Lookup-table fixtures never appear in the extracted class grid.
- **Suggested course:** Write failing tests first, using `save tree test\armorist.srd.json` plus the CX2 classification fixtures. Tests go in `v3-staging/codex/CX1/`; AFK promotes them in AF7. Import CX2's classifier; do not reimplement it.
- **filesscope:** `src/engine/sotEngine.ts` (extractClassFromSrdDoc, parseImportedSrdFile only), `src/engine/aiService.ts` (parseSrdSkillsAndProficiencies only), `v3-staging/codex/CX1/*`. Read-only use of `v3-staging/codex/CX2/**`.
- **Sequencing:** after AF1 (which edits `sotEngine.ts` host storage) **and after CX2** (classification must exist first). No longer parallel with CX2.

**CX2: Four-output ingestion pipeline and table classification (Phase 2, Austin's new requirements)**
- **Explanation:** Every ingested sheet or SRD produces a **table, a list of links, compact text-only markdown, and a keyword index for AI lookups** (frequent or prominent terms). Every extracted table is also given a deterministic `kind` so add-class can pull the class grid and never a lookup table.
- **Details:**
  - Port `LAZY\sheet-engine` `src/ingest/*` (tables, links, Turndown sections, keywords, BM25 index, TOC) into staging. Align it to APP's TS 7 and `node:test`.
  - Add a `.srd.json` unwrap (`srdDocument.htmlContent` → html) and a sheet-JSON extractor (`character.json` envelope and `_pf1e_sheet.json`).
  - Validate shape and reject unknown JSON with a message (I3).
  - Write a JSON schema for each output. `table.json` entries include `kind`: `class-grid` | `casting-subgrid` | `extended-grid` | `lookup-table`, plus the normalized header map and section id. Use the term **lookup table** only (not "search grid").
  - **Classifier** (pure function, no model, no network):
    - Normalize headers with synonyms: Level = HD, BAB = Base Attack Bonus, Fort = Fortitude / Fort save, Ref = Reflex / Ref save, Will = Will save.
    - **Class grid** if the header set includes Level (or HD), BAB (or Base Attack Bonus), Fort save, Ref save, Will save, and Special. Keep every other column on that table as a named column.
    - **Casting subgrid** if the headers are Spells per day or Spells known with columns 0–9 or 1–9, including the stacked-header form below. If it also has a Level header and covers all 20 levels, mark it as an extended grid as well (or `kind: extended-grid` with a `casting: "spells-per-day" | "spells-known"` flag — pick one representation, document it, and test it).
    - **Extended grid** if it is not the class grid, has a Level header, and covers all 20 levels. Downstream drops Level and appends the remaining columns to the right of the class grid. Do not perform the append inside ingest; only tag the kind and leave a helper that CX1 / CX3 can call.
    - **Lookup table:** everything else. Stored, never eligible for the class matrix.
    - **Stacked spell headers (PFSRD):** detect a two-row header in which a group label ("Spells per Day" or "Spells Known") spans spell-level columns, and the row beneath is 0–9 or 1–9. Handle (a) one merged (`colspan`) group cell and (b) a group row that repeats the same label in each cell of the span. When exposing columns for population, exclude the group row, take the bottom row as the headers, and apply the group only as a prefix (`spd_` / `sk_`), e.g. `spd_1`…`spd_9`, `sk_0`…`sk_9`. If those stacked columns sit on the class grid, keep them there with the prefixed ids. Do not naively join the two header rows into one label.
    - Repeated headers on separate table elements stay as separate tables, keyed by section id and kind. Do not smash them into one grid.
    - Do not dump all tables into one all-tables sheet, and do not leave tables unclassified.
  - **Hidden tables** are not invented by ingest. If a known hidden table is absent, the output may record a stub (`missing: "extra-spells-per-day"`, and so on) for later work. Do not generate the rows in 1.3.0 unless Q11 says to.
  - Fixtures (required):
    1. `save tree test\armorist.srd.json` (spherecaster; extra columns on the class grid).
    2. A sorcerer SRD with spells known listed separately from the class grid.
    3. A PFSRD-style sorcerer and a PFSRD-style wizard with stacked spell headers. One of these must use a merged (`colspan`) group cell; the other must use a repeated-cell group row. Golden output: no group row in the populated grid, and columns named `spd_*` / `sk_*` from the bottom header row.
    4. A non-caster (for example fighter) with a class grid and no casting subgrid.
    5. A Spheres of Power class whose talents-known table is separate from the class grid, or missing (hidden-table case).
    6. An SRD that has several lookup tables in addition to the class grid (items, random charts, DC tables, and the like).
    Also run the canonical pf1mod set (Q5) and the `LAZY\character_sheets\*.txt` homebrew files once those are available.
  - **Deterministic:** no network and no model calls, including for `kind`. The same input gives byte-identical output, including classification.
- **Issues:** §2.3, I3, Austin's table-classification spec (enables B7, assign, and the add-class guard).
- **Goals:** `ingest(doc) → {table.json, links.json, text.md, index.json}` with stable section ids and a `kind` on every table; about 77% fewer tokens on armorist; fixture classifications as listed in Phase 2's done criteria.
- **Suggested course:** Pure functions with no fs inside the core, so AFK can wrap them in an endpoint. Links come from original HTML or are rebuilt from `incidentalLinks` (sanitized HTML has no `<a>`). Put the classifier in its own module with golden tests per fixture, so CX1 can import it without reaching into HTML parsing.
- **filesscope:** `v3-staging/codex/CX2/**` only. AFK promotes it to `server/ingest/` in AF2.

**CX3: Character Matrix engine, no UI (Phase 4a)**
- **Explanation:** The data model and logic for Austin's Matrix, Career Index and user indexes.
- **Details:** Everything in Part 1 Phase 4a: the generic grid with a migration from `ClassGridRow`, header normalization, the B11-proof id generator, the tokenizer and parser for every notation in `pfautopt5.txt`, the counting rule, gestalt merge, color states, Edit Index operations, tag mapping, a derived Matrix, and the apply-to-sheet function replacing `applyCareerProgressionToCharacter`. Add the currency container field to the types (for AG5). When a user index is filled from an SRD, accept only classified class-grid, extended-grid, and casting-subgrid tables. Provide the append helper (drop Level, append columns on the right). Spell columns use the prefixed ids from the stacked-header rule (`spd_*`, `sk_*`); the group row is never copied into the Matrix. Lookup tables are readable for assign, and are never merged into the Matrix.
- **Issues:** §3, B10 (column limit), B11, table-classification consumption.
- **Goals:** a tested engine Antigravity can bind to.
- **Suggested course:**
  - Build the tokenizer first, with a test for every example in Austin's notes, plus the edge cases (`+1>3!2`, negative starts, overwriting manual edits).
  - Use the 40-row yellow guard, and the 20/40 cap per Q1.
  - Leave the `fighter4` continuation pluggable until Q2 is answered.
  - Leave spells-merge rules, templates, and hidden tables out (Q3, Q4, Q11), but do accept casting subgrids and extended grids as appended columns.
  - Test the sorcerer append path and the "lookup tables never reach the Matrix" guard here, using CX2 fixtures.
- **filesscope:** `src/types/character.ts`, `src/engine/multiclassCalculator.ts`, `src/engine/characterIntegration.ts`, `v3-staging/codex/CX3/**` (matrix engine and tests; AFK promotes them to `src/engine/matrix/`). Read-only use of `v3-staging/codex/CX2/**` fixtures and classifier types.

**CX4: Demo-data removal, tap-test logic and grid adapter (Phase 3)**
- **Explanation:** The Slayer artifacts and the tap-test loop come from `aiService.ts` logic.
- **Details:**
  - Remove the `DEFAULT_SOT_CATALOGUE` fallbacks in `aiService.ts` (~232, ~2896). Delete or relabel the demo. A blank character gets an empty catalogue: AFK does the `createBlankCharacter` side in AF1.
  - The `tapTestNeedsInput` rule (~3127): "nothing applied" on the identity step doesn't count as needing input, and the summary doesn't send "Name: Unnamed".
  - `adaptArchetypeIntoGrid`: no "[Archetype]" suffix, and remove the hardcoded "Bard Fencer" fallback.
- **Issues:** B4 (data side), B6 (client logic), B10.
- **Goals:** no Slayer text on a blank sheet; the tap test moves past the name step.
- **Suggested course:** Add unit tests for the tap-test decision function.
- **filesscope:** `src/engine/aiService.ts` (the functions named only), `v3-staging/codex/CX4/*`.
- **Sequencing:** after CX1 (same file), before AF3.

**CX5: Macro-syntax migration (Phase 5; macro work kept separate)**
- **Explanation:** Old `Name:|<^…>|$` suggestions break under Macaroni 1.2.
- **Details:**
  - Move `sotEngine.ts` ~510 and `aiService.ts` 195–849 to 1.2 sigil syntax.
  - Change `executeScratchpadAIMacro` directives **only per Austin's Q6 decision.**
- **Issues:** B15, B19 (syntax half).
- **Goals:** every built-in suggestion applies without a sigil or reserved-symbol error.
- **Suggested course:** Add a test that runs every built-in suggestion through `executeMacaroni`.
- **filesscope:** `src/engine/sotEngine.ts` (~510), `src/engine/aiService.ts` (suggestion and scratchpad sections only), `v3-staging/codex/CX5/*`.
- **Sequencing:** last on both files (after AF3).


## Required handoff

When a task finishes (or stops), write `APP\v3-staging\handoffs\<agent>-<task-id>.md` containing:

- **Work done:** what was fixed or built, with B-numbers and I-numbers.
- **Files altered:** each path, plus one line on what changed.
- **Files created:** each path, all in staging unless the task allowed otherwise.
- **Tests:** commands run and their results (`npm test`, `npx tsx --test …`, `npm run lint`, `npm run build`).
- **Open issues and requests:** files you needed but didn't own, and anything left unverified.
- **Do not include secrets.**


## Open questions (answers still pending)

Austin has not yet answered Q1–Q14. **Defaults in this document apply until he answers.** Do not invent answers. If a default is marked pluggable or out of scope, leave it that way.


## Open questions for Austin
1. **Matrix row cap:** 20 levels with 40 only as a runaway guard, or real rows 21–40 (epic)?
2. **Count after `fighter4`:** does the next plain `fighter` continue at 5, or count only plain entries?
3. **Spells merge rules:** define them now, or leave spells out of 1.3.0?
4. **Templates:** confirm they are deferred past 1.3.0.
5. **SRD originals:** do they live in the save tree (`<character>\SRD\<doc>\`)? And which pf1mod folder is canonical: `Documents\pf1mod` or `Documents\PROJECTS\pf1mod`?
6. **Scratchpad directives** (`>>#AI$`, `>>AI$`, `>>#ai!`) use symbols Macaroni Part 2 reserves. Move them to a sigil form, drop them in favour of the search bar, or keep them on a separate parser?
7. **AICompanionModal.tsx is off-limits,** but B8 and the old SOT section live there. Is it OK to leave the old section, with its bug, alongside the new SOT panel for 1.3.0? Or will you lift the restriction for one small task?
8. **Installer and packager alignment (AF6):** in 1.3.0, or later?
9. **Staging folder:** `APP\v3-staging\` (proposed). Should it be gitignored or committed? Is `tsconfig` including it needed for type-checks [unverified]?
10. **Orphans:** confirm deleting `SheetPage3SpellsBio.tsx` and `QuickHPBar.tsx` (imported but never shown) as well as the clearly unused files.
11. **Hidden tables in 1.3.0:** extra spells per day and extra spells known apply to any caster and are usually left off SRDs. Should 1.3.0 ship a bundled copy of those two tables so a caster matrix can use them, or are all hidden tables (including Spheres talents known, race feat/ASI indexes, and race abilities at 6 / 12 / 18) deferred? Austin suggested headless tables later; the default in this draft is defer.
12. **Extended-grid row count:** Austin described extensions as covering all 20 levels. For a 10-level prestige class, or any class grid shorter than 20 rows, should an extended grid match the class grid's row count instead of requiring 20?
13. **Two class-shaped tables in one SRD:** if a document has more than one table matching the class-grid header set (for example a base class and an archetype advancement table), which one is the class grid? May add-class offer a picker, or is the first in document order the one?
14. **HD as a header synonym:** Austin allows Level or HD as the class-grid level header. Should a column literally named "Hit Dice" or "HD" that holds die sizes (d6, d8, d10) be treated as a data column instead, so it is not mistaken for Level?

