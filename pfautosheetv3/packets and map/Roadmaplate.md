# Roadmaplate.md — PF1 Autosheet v3 (version 1.3.0)

**Status: DRAFT FOR AUSTIN'S APPROVAL.** Nothing has been delegated. No repo files have been changed.
Repo: `Aush10/pathfinder-sheet`. Local copy: `<user-home>\Documents\PROJECTS\pathfinder-1e-modular-workspace` (called **APP** below).
Inputs: `combined-issues.md` (main), `pfautopt5.txt` (Austin's spec, the source of truth for notation), `Paut-3notes.txt` (root causes), `botjot.txt` (audit), and Austin's 2026-11-22 table-classification notes (t33u, t34u stacked PFSRD spell headers). Written 2026-11-22 (CT); revised later the same evening for table kinds and stacked spell headers.

**Open decisions (full list at the end):** Matrix row cap (20 vs 40); count after `fighter4`; spells merge; templates deferred?; SRD originals in the save tree, and which pf1mod folder is canonical; scratchpad directives vs Macaroni; whether the old SOT UI in AICompanionModal stays; installer in 1.3.0?; staging gitignore; two maybe-orphans; hidden caster tables in 1.3.0?; extended-grid row count for prestige classes; two class-shaped tables in one SRD; HD as a Level synonym vs a Hit Dice column.

---

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

## Part 1 — Single-builder path to completion (ordered)

The brief sets the order: **save and storage → ingestion → bounded AI retrieval → Character Matrix → polish → release.** One builder works through it top to bottom.

### Phase 0 — Verify first (read-only, no code changes)
- **0.1 SOT token fix (§0 / I9 / B7).** The 11-21 change log says `sotContext.test.ts`, query-focused excerpts, a 12k SOT cap and an 8-message / 4k chat cap all landed. **None of it is on main** [confirmed by PAut-3]. Search every GitHub branch, open and closed PR, and any Codex/Copilot worktree or agent session on `Aush10/pathfinder-sheet` for `sotContext.test.ts`. Compare with `LAZY\sheet-engine\README.md`. Result: either "found on branch X, cherry-pick" or "not found, rebuild in Phase 3". **Nobody is assigned the B7 fix until this is written down.**
- **0.2 Stepper XPaths.** Open the running app in DevTools and confirm which element each XPath in §5 actually hits. Read statically, the aside XPath points at the **Deck** button, not a stepper [guess]. Record the component, the label text and a stable selector. **Nothing is hidden until this is done.**
- **0.3 Data checks:**
  - Open one pf1mod `*.srd.json` and confirm whether it starts with `"format":"PF1E_SOT_READONLY_SRD_V1"`.
  - Open `<folder>\AIgamesheet\pfmusers\Crash\character.json` and look at `data.abilities` (tells which B1 path caused the stats reset).
  - Austin picks the canonical pf1mod folder (I8).
- **Done when:** `v3-staging\handoffs\phase0-verify.md` records all three results.

### Phase 1 — Save and storage correctness (B1, B2, B9, I1, I2, I7, B16)
- Serialized autosave queue with an in-flight guard and a longer debounce. Crash saves skip the projection rewrites (images, DSL, notebook, AI\read_only, index.csv, printable HTML).
- A deliberate Save refreshes or clears Crash. Prefer Crash only if it is **newer and has the same characterId**, and ask the user before restoring it.
- `saveLayout` stops reusing a previous crash's characterId.
- Host SRDs are scoped per character (or moved into the save tree), and New Sheet stops inheriting them. Stop storing SRDs twice; the character references SRDs instead of embedding HTML. Quota errors are surfaced, not swallowed.
- Loadout tool: FileReader `onerror`, plus envelope support. Import accepts save-tree envelopes and blank names.
- Follow `docs\SAVE_STATE_DIAGNOSIS.md` and `docs\CODEX_SAVE_PATH_WORKFLOW.md`.
- **Depends on:** 0.3.
- **Done when:**
  - Edit, Save, restart: the named save loads, with no silent Crash override.
  - Rapid edits with the folder open in Explorer give no "locked" error, and at most one write is in flight.
  - A new sheet shows no SRDs from the previous character.
  - A filled localStorage shows a visible error.
  - A blank-name export re-imports.
  - `npm test` and `npm run lint` are green.

### Phase 2 — Ingestion: four outputs and table classification (§2.3, I3, B3, B12–B14)
- Port and extend `LAZY\sheet-engine` into a server-side, deterministic pipeline. Every ingested sheet or SRD produces **four outputs:**
  1. `table.json`: every `<table>`, with rowspan/colspan expanded and multi-row headers joined, except stacked spell group headers (see the PFSRD rule below), which are not joined into a single label. **Every table is kept** and tagged with a deterministic `kind` (see Table classification below). Class grids keep **all** columns, including extras such as CL, Talents, or prefixed spell-level columns.
  2. `links.json`: text, href, canonical URL, section_id. Built from the **original** HTML, or rebuilt from `incidentalLinks`.
  3. `text.md`: compact, text-only, heading-aware markdown, with tables replaced by placeholders.
  4. `index.json`: a keyword index for AI lookups, from headings, defined terms, table headers, and frequent or prominent terms. Plus a BM25 index and `toc.json`, with stable section ids.
- Add the `.srd.json` unwrap and a sheet-JSON extractor. Shape validation rejects unknown JSON with a message (I3).
- Store outputs at `<character>\SRD\<doc>\{table.json, links.json, text.md, index.json}`. Endpoint: `POST /api/sot/ingest`. Migrate existing localStorage SRDs.
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
  - Do not naively join the two header rows into a single string (for example "Spells per Day 1") and then lose the prefix scheme.
  Rules:
  - Header-name normalization, with synonyms such as Level = HD, BAB = Base Attack Bonus, Fort = Fortitude / Fort save, Ref = Reflex / Ref save, Will = Will save. Repeated headers on separate table elements are disambiguated by kind and section id, not merged blindly.
  - Guard: add-class, and any fill of the class matrix, pulls the class grid and its extensions only, never a lookup table.
  - Pulling every table into one all-tables sheet, or pulling tables with no classification, will not work consistently. Do not do either.
  - Fixtures, in addition to `save tree test\armorist.srd.json` (already a spherecaster): a sorcerer SRD with spells known listed separately; a PFSRD-style sorcerer and a PFSRD-style wizard whose spell sections use stacked headers (one fixture must use a merged group cell, and one must use a repeated-cell group row); a non-caster (for example fighter); a Spheres of Power class whose talents-known table is separate or absent; an SRD that has several lookup tables besides the class grid.
- Fix SRD class extraction (consumes the classified tables):
  - B3: proficiencies come from the proficiency section only, capped in length.
  - B12: the name regex stops at newlines.
  - B13: until the generic grid lands, stop dumping leftover numeric columns into Special. After it lands, those columns stay as named class-grid columns.
  - B14: class skills come only from the Class Skills line, and "(arcana)" is kept.
  - The class-grid builder reads only `kind: class-grid`, then appends `extended-grid` and casting subgrids. It never treats a lookup table as the class grid.
- **Depends on:** Phase 1 (storage location and the reference model).
- **Done when:**
  - armorist produces all four files, deterministically (two runs give a byte-identical hash), and every table in `table.json` has a `kind`.
  - Fixtures classify correctly: sorcerer spells-known is an extended grid (or a casting subgrid treated as one) and is appended, not stored as a second class grid; the PFSRD sorcerer/wizard fixtures drop the stacked group row, use the bottom row as headers, and emit prefixed columns (`spd_*`, `sk_*`) with no group-row values in the matrix; the non-caster has a class grid and no casting subgrid; lookup tables on the multi-table SRD are stored and are absent from the built class grid; a Spheres talents table that is not a 20-level Level-header grid is a lookup table (or is flagged absent if it is a hidden table).
  - Proficiencies are under the cap, the name is "Armorist", there are 13 class skills, and Special is not polluted with numeric columns.
  - Unknown JSON is rejected with a message.
  - The pipeline has tests under `npm test`.

### Phase 3 — Bounded AI retrieval and demo-data removal (B7, B6, B4, B5)
- Use the Phase 0.1 result: cherry-pick the old work, or rebuild it. `/api/openai/complete-sheet` and `/lookup` send only the index-matched `text.md` sections and table rows (a 12k cap is the suggestion). History is capped at 8 messages / 4k. The client stops posting whole `overridePages`.
- B4: blank characters get an empty `sotCatalogue`, and `DEFAULT_SOT_CATALOGUE` fallbacks are removed. B5: remove the Slayer chips. Remove the Slayer example in `server/prompts.ts`.
- B6: the tap test doesn't treat "nothing applied" on the identity step as needing input, the summary stops saying "Name: Unnamed", and the server logs the raw model JSON (dev only, no keys).
- **Depends on:** Phase 2 (the index). 0.1 decides cherry-pick versus rebuild.
- **Done when:**
  - The request payload stays under the cap with 5 or more SRDs loaded.
  - No Slayer text reaches a blank sheet or the AI.
  - The tap test moves past the name step.
  - New `sotContext` tests pass.

### Phase 4 — Character Matrix / Career Index / user indexes (§3, B10, B11)
- **4a Engine, no UI:**
  - Generic grid model `{columns:[{id, header, type, frozen, hidden}], rows, row0}`, with a migration from `ClassGridRow`.
  - Header normalization ("Base Attack Bonus" = "BAB"). Collision-free ids (fixes B11).
  - Career Index tokenizer and parser:
    - header fills: `=x`, `+n` / `-n`, `>n`, `!n`
    - track cells: comma gestalt, `*` dominance, `fighter4`, `+col` / `-col` / `=col` / `=col+col` / `-col-col`
  - Counting read rule. Row-by-row gestalt merge: within a cell the first value dominates; a second track takes the higher value.
  - Color states: green found, red not found, yellow syntax error or more than 40 rows.
  - Edit Index operations: clear, remove/replace, row 0, rowcol, autofill, append, assign, auto-assign all, bind (take highest / count total).
  - `<act>/<rec>/<spell>/<feat>` tag mapping.
  - The Matrix is **derived**, never stored.
  - Austin's notation in `pfautopt5.txt` is the source of truth.
  - **SRD → user index:** populate only from the classified **class grid**, plus **extended grids** (Level column dropped, value columns appended on the right) and **casting subgrids**. Stacked PFSRD spell headers are flattened to prefixed columns (`spd_*`, `sk_*`); the group row is excluded. Lookup tables stay available for assign and Apple Eye search, and are never written into the Matrix. Hidden tables stay out of this pass (Q11).
- **4b UI:**
  - Replace the career tab and mode toggles with the Matrix and the Career Index tab.
  - An empty "new index" tab that creates an index plus a new empty tab. Any number of indexes.
  - Right-click Edit Index popup, color states, the overlapping tab for append.
  - Apply-to-sheet reads the gestalt grid. Ability type is editable in Actions & Resources.
  - The grid adapter stops writing "[Archetype]" text and can add columns (B10).
  - Add-class / Populate from SOT offers the class grid and its extensions only. Lookup tables are visible as reference, and cannot be added to the Matrix.
- **Out of scope for 1.3.0:** templates (WIP), spells merge rules (Q3), and hidden tables (Q11), unless Austin decides otherwise.
- **Depends on:** Phase 2 (stable section ids for assign, and classified tables). Q1 and Q2 need answers before the parser is final.
- **Done when:**
  - The parser has tests for every example in `pfautopt5.txt` (fighter/wizard counting, `fighter3`, `+1>3`, `+1!2`, `=wizard`, `fighter,*wizard`, `fighter=bab+special`).
  - A sorcerer fixture builds one matrix row-set whose right-hand columns include the appended spells-known values, with no lookup table columns mixed in.
  - Old `customClassGrids` migrate losslessly.
  - Apply-to-sheet matches today's class 1 behaviour for a single class.

### Phase 5 — Polish
- SOT panel separated from the AI Companion (I6), with batch save (I5), a viewer for the four outputs, and a stable open state (the B8 replacement). Quota and size warnings, and clear import errors.
- Stepper remake: hide the slates and the button with a class or flag (code kept), and theme-aware global scrollbars. **Needs Phase 0.2.**
- Scratchpad (B19): search bar, plus Apple Eye lookup from anywhere. The directive syntax is decided in Q6.
- Simple race function in Biography & Narrative (Matrix row 0 also covers race).
- Coinage: total = Current GP (bank excluded), plus a container dropdown.
- Exports write to the connected folder `<character>\exports\` with a Blob fallback (I4).
- Server hygiene:
  - Express 4 catch-all (B17).
  - `PORT` environment variable with a fallback (B18).
  - An allowlist for `/api/sot/fetch-readonly-page`.
  - Remove the `/api/gemini/*` aliases.
- Old buff syntax moved to Macaroni 1.2 (B15). `macaroni.test.ts` added to `npm test`.
- Cleanup: remove orphans, fix the clean script, fix vite `__dirname`, refresh docs and README, archive superseded notes, remove stale builds and debris.
- **Done when:** each item has its own acceptance check (see Part 2) and the full suite is green.

### Phase 6 — Release 1.3.0
- Stability check (`npm ci`, `npm test`, macaroni tests, lint, build, `build:standalone`, a manual playtest following the botjot checklist). Version bump, CHANGELOG, tag `v1.3.0`, push notes.
- Installer and packager alignment, **if** Austin keeps it in scope (Q8).
- **Done when:** Austin approves the push notes and the tag is ready to push. **Copilot does not push without Austin's go.**

---

## Part 2 — Split by tool

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

### @copilot

**CP1: Prep the v3 tag (version 1.3.0)**
- **Explanation:** Get the release scaffolding ready without releasing anything.
- **Details:**
  - Read the current version in `package.json` [unverified].
  - Draft `v3-staging/copilot/CP1/CHANGELOG-1.3.0.md` from the handoffs as they arrive.
  - Prepare, but don't apply, the version bump and the tag command.
  - Rename the package from "react-example" (cleanup item).
- **Issues:** release prep; §4 package name.
- **Goals:** a one-step release once CP3 passes.
- **Suggested course:** Draft early, finalize in CP3. Never push or tag without Austin's go.
- **filesscope:** `package.json` (version and name fields only), `v3-staging/copilot/CP1/*`.

**CP2: Repetitive cleanup and config (Phase 5)**
- **Explanation:** Low-risk, repetitive fixes from the audit.
- **Details:**
  - Add `src/engine/macaroni/macaroni.test.ts` to the `npm test` script.
  - Make `npm run clean` cross-platform (e.g. `rimraf` or a node script).
  - Remove `__dirname` from `vite.config.ts`.
  - Coinage default: `reconcileCurrency(includeBank=false)` (spec change: total = Current GP).
  - Delete orphans after confirming with grep that nothing imports them: `AddClassModal.tsx`, `SheetPage2SkillsGear.tsx`, `ImageBrowserModal.tsx`, `GlyphPicker.tsx`, `DSLBibleDrawer.tsx`, `storage/seedTree.ts`. Ask Austin before touching `SheetPage3SpellsBio.tsx` and `QuickHPBar.tsx`.
  - Remove debris: `bun.lock`, `tmp-tsc.ps1`, `New folder\`, the duplicate `Attached Element Context*.txt`, `.aistudio\`, the duplicate `character-sheet-icons\`, the stale `public\pathfinder1e_standalone.html` (rebuild it in CP3), `sot-ai-complete-sheet.bundle`, and the old `.zip`.
  - Archive superseded docs to a notes folder outside the repo root (botjot §6); don't delete them.
  - Refresh `docs/PROGRAM_MAP.md` (Class Architect is the mounted Add Class; the test count is now 60+) and the README (macro syntax, Gemini mentions, tool names). Update `default_sheet.json` xdxMacros to 1.2 sigils.
  - Remove Gemini leftovers: `metadata.json` and the README note. The route aliases belong to AFK in AF4.
- **Issues:** §4 cleanup, coinage spec change, P6 / demo xdxMacros.
- **Goals:** a clean tree, all tests in `npm test`, accurate docs.
- **Suggested course:** One commit per category. Run `npm test`, `npm run lint` and `npm run build` after each. List every deletion in the handoff.
- **filesscope:** `package.json` (scripts), `vite.config.ts`, `src/engine/currencyUtils.ts`, `README.md`, `docs/**`, `metadata.json`, `default_sheet.json`, and the orphan and debris paths listed above (delete or archive only).
- **Sequencing:** do the orphan deletion **after** Antigravity's AG3 handoff, so that `AddClassModal.tsx` isn't removed while someone is still referencing it.

**CP3: Stability check and push notation (only when Austin prompts again)**
- **Explanation:** The final gate before 1.3.0.
- **Details:**
  - Run `npm ci`, `npm test`, `npm run lint`, `npm run build` and `npm run build:standalone`.
  - Smoke-test the dev server with `/api/openai/status`, without printing any key.
  - Walk the botjot §4 checklist.
  - Finalize the CHANGELOG, write push notes (summary, B-numbers closed, known issues), and apply the version bump. Prepare `git tag v1.3.0`.
- **Issues:** release.
- **Goals:** a go/no-go report.
- **Suggested course:** If anything fails, report it; don't fix it. Wait for Austin's go before pushing.
- **filesscope:** `package.json` (version), `v3-staging/copilot/CP3/*` (report, push notes), `CHANGELOG.md` (new at the root, allowed exception).

### @Codex

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

### @Antigravity

**AG1: Standalone SOT panel (Phase 5)**
- **Explanation:** SOT is buried in the AI Companion, saving is one page at a time, and Sync closes itself.
- **Details:**
  - Build a new `SOTPanel` that reads `character.sotCatalogue`, with:
    - batch save of multiple pasted pages (I5)
    - a viewer for the four outputs per document: table viewer (with a kind badge: class grid, extended grid, casting subgrid, or lookup table), link list, markdown preview, keyword chips
    - an open state independent of notices, with dismissable notices (the B8 replacement)
    - quota and size warnings, and clear import errors (envelope vs raw, blank names)
  - Mount it from `App.tsx`.
  - Remove the Slayer chips in `CompleteSheetChatWindow.tsx` (B5), and route its quick-save to batch save.
  - **`AICompanionModal.tsx` is not touched.** Its old SOT section and its B8 bug stay until Austin answers Q7.
- **Issues:** I5, I6, B8 (via replacement), B5 (UI).
- **Goals:** SOT is reachable without the AI Companion.
- **Suggested course:** Build the component in staging. AFK promotes it to `src/components/tools/SOTPanel.tsx`. It consumes AF2's endpoint and storage functions.
- **filesscope:** `src/App.tsx` (mount only), `src/components/tools/CompleteSheetChatWindow.tsx` (chips and quick-save only), `v3-staging/antigravity/AG1/**`.
- **Sequencing:** after AF2.

**AG3: Character Matrix and Career Index UI (Phase 4b)**
- **Explanation:** Replace the career tab and modal options with Austin's Matrix.
- **Details:**
  - Same location and style as the class 1/2 tabs, with the Career Index where class 2 is now.
  - An empty tab where "+ Add Class" is now: clicking it creates an index plus a new empty tab. Any number of indexes; no "third replaces second".
  - Typing (not dropdowns) in the track cells and headers. Green, red and yellow cell states come from CX3.
  - Right-click → Edit Index popup with all the operations. Append shows as the appended tab partly hidden behind the tab it extends.
  - Apply-to-sheet uses CX3's apply function.
  - Ability type is editable in Actions & Resources.
  - Fix the B9 `sotDocs` merge, using AF1's per-character loader.
  - Populate from SOT / add-class shows the classified class grid and its extensions, and uses CX3's append helper. Lookup tables are listed as reference only and cannot be added to the Matrix. Do not reimplement classification in the UI.
- **Issues:** §3, B10 (UI), B11 (wiring), B9 (UI site), table-classification UI guard.
- **Goals:** Austin's fighter/wizard examples work end to end in the UI.
- **Suggested course:** Bind to the engine only; no parsing logic in components. Don't touch any macro syntax.
- **filesscope:** `src/components/tools/ClassArchitectModal.tsx`, `ActionDirectoryModule.tsx` (path **unverified**), `v3-staging/antigravity/AG3/**`.
- **Sequencing:** after CX3 and AF1.

**AG4: Stepper remake and scrollbars (Phase 5)**
- **Explanation:** Hide the stepper UI while keeping the code, and fix the scrollbars.
- **Details:**
  - **Step 0: confirm both XPaths in DevTools** (Phase 0.2). If the aside XPath is the Deck button, stop and ask Austin.
  - Hide the slates and the button with a class or flag. The turn stepper is already hidden (`.pf1-hidden-turn-stepper`). `visibleModules.levelStepper` exists but nothing reads it.
  - Add a theme-aware global scrollbar with CSS variables for the parchment, blueprint, mythweavers and print themes.
- **Issues:** §5.
- **Goals:** the correct elements are hidden, with no code deleted; scrollbars match each theme.
- **Suggested course:** Use a stable selector or label, never a raw XPath, in code.
- **filesscope:** `src/index.css`, `QuickModularTools.tsx`, `BlueprintSidebar.tsx`, `SheetPage1Core.tsx`, `src/App.tsx` (stepper button only), `v3-staging/antigravity/AG4/*`.
- **Sequencing:** `App.tsx` changes go after AG1. `StepperTool` is opened through AICompanionModal's `onOpenStepper`; hide it at the `App.tsx` or button level, not inside AICompanionModal.

**AG5: Bio and storage page: scratchpad, race, coinage (Phase 5)**
- **Explanation:** Austin's page-3 asks.
- **Details:**
  - Scratchpad redesign: a search bar, plus Apple Eye lookup of items anywhere on the sheet. Directive behaviour per Q6.
  - Simple race function in Biography & Narrative, writing raceMod, size, speed, languages and traits (shared with Matrix row 0).
  - Coinage: the call site at ~191 stops forcing bank into the total. The StorageInventoryModule toggle defaults off. Add a container dropdown using CX3's field.
- **Issues:** B19 (UI half), the race ask, the coinage spec change.
- **Goals:** scratchpad search works, race applies, total = Current GP.
- **filesscope:** `src/components/sheet/SheetPage3BioStorage.tsx`, `StorageInventoryModule.tsx`, `v3-staging/antigravity/AG5/*`.
- **Sequencing:** after CP2 (currency) and CX3 (types).

(There is no AG2. The B5 chips are folded into AG1 because they live in the same file.)

### @afk pilot

**AF0: Verify first (Phase 0, read-only)**
- **Explanation:** Settle the claimed SOT token fix before anyone redoes or re-assigns it.
- **Details:** Search the branches, PRs and worktrees for `sotContext.test.ts`, the 12k cap and the 8-message cap. Also record the 0.3 data checks if Austin hasn't.
- **Issues:** §0, I9, B7.
- **Goals:** "found → cherry-pick" or "not found → rebuild in AF3".
- **filesscope:** read-only; writes only `v3-staging/handoffs/phase0-verify.md`.

**AF1: Save path and storage correctness (Phase 1)**
- **Explanation:** Crash overrides real saves, overlapping writes lock files, and SRDs leak between characters.
- **Details:** All of the Phase 1 bullets. Also give `createBlankCharacter` an empty `sotCatalogue` (B4), and expose a per-character host-SRD loader for AG3.
- **Issues:** B1, B2, B9, I1, I2, B4 (blank character).
- **Goals:** the Phase 1 done criteria.
- **Suggested course:** Follow `docs\SAVE_STATE_DIAGNOSIS.md` and `docs\CODEX_SAVE_PATH_WORKFLOW.md`. Add tests for the queue and the crash-preference rule.
- **filesscope:** `src/storage/characterState.ts`, `fsAdapter.ts`, `useAutosave.ts`, `connectFolder.ts`, `CharacterContext.tsx` (persist effect), `src/engine/sotEngine.ts` (host-storage functions only), `v3-staging/afk/AF1/*`.

**AF2: Ingest endpoint, persistence and migration (Phase 2)**
- **Details:**
  - Promote CX2 into `server/ingest/`.
  - Add `POST /api/sot/ingest` (size limit; input treated as untrusted data and never executed).
  - Persist the four outputs to `<character>\SRD\<doc>\` through the folder handle. Fall back to IndexedDB or reference storage when no folder is connected [design choice, Q5].
  - Migrate existing `pf1e_host_srd_doc_*` entries once.
- **Issues:** §2.3, I1, I2.
- **Goals:** loading an SRD produces the four files on disk; localStorage no longer holds full HTML.
- **filesscope:** `server.ts`, `server/routes.ts`, `server/ingest/**` (promoted), `src/storage/fsAdapter.ts`, `v3-staging/afk/AF2/*`.
- **Sequencing:** after CX2 and AF1.

**AF3: Bounded AI retrieval and tap-test logging (Phase 3)**
- **Details:**
  - Cherry-pick or rebuild per AF0.
  - `server/sotContext.ts` queries `index.json` and sends only the matching `text.md` sections and table rows. SOT cap of about 12k chars; history of 8 messages / 4k.
  - Apply the same to `/lookup`.
  - The client payload (`aiService.ts` ~3034) sends doc ids and the query, not whole pages.
  - Remove the Slayer example in `server/prompts.ts`.
  - Log the raw model JSON for tap-test turns in dev, never logging keys.
  - Mark sheet text sent to the model as content, not instructions (prompt-injection guard).
- **Issues:** B7, B6 (server half), B4 (prompt).
- **Goals:** the Phase 3 done criteria.
- **filesscope:** `server/sotContext.ts`, `server/routes.ts`, `server/prompts.ts`, `src/engine/aiService.ts` (request payload only), new `server/sotContext.test.ts` (allowed exception), `v3-staging/afk/AF3/*`.
- **Sequencing:** after AF0, AF2 and CX4.

**AF4: Server hygiene (Phase 5)**
- **Details:**
  - An Express 4 catch-all for production deep links (B17).
  - `PORT` environment variable with a fallback, and a clear EADDRINUSE message (B18).
  - An allowlist for `/api/sot/fetch-readonly-page` (e.g. d20pfsrd, aonprd).
  - Remove the `/api/gemini/*` aliases and `getSessionApiKey` (the last needs a coordinated touch in `aiService.ts`; request it if needed).
- **Issues:** B17, B18, §4 security.
- **filesscope:** `server.ts`, `server/routes.ts`, `server/openai.ts`, `v3-staging/afk/AF4/*`.

**AF5: Exports, import and loadout IO (Phase 5)**
- **Details:**
  - Exports write to `<character>\exports\` through the folder handle when connected, with a Blob URL fallback instead of a data: URL (I4).
  - `importCharacterJSONFile` accepts envelopes and blank names (B16).
  - LoadoutModal gets FileReader `onerror` and envelope unwrap (I7).
  - The `exportSrdDocFileToHost` change in `sotEngine.ts` is out of scope; request it in the handoff.
- **Issues:** I4, B16, I7.
- **filesscope:** `src/utils/sheetExporters.ts`, `src/components/tools/LoadoutModal.tsx`, `src/storage/fsAdapter.ts` (exports helper), `v3-staging/afk/AF5/*`.
- **Sequencing:** after AF2 (`fsAdapter.ts`).

**AF6: Installer and packager alignment (only if Q8 = in scope)**
- **Details:** Bring `Package-PF1MW.ps1`, `Install-PF1MW.ps1`, `Install-PF1MW-Local.ps1` and `Start-PF1MW.ps1` into agreement. Decide whether the installed app runs `server.ts`, which is what gives it AI.
- **filesscope:** `installer/*.ps1`, `v3-staging/afk/AF6/*`.

**AF7: Integration, debug and connect (last)**
- **Explanation:** Read this full roadmap, every Codex handoff and every Antigravity handoff, then debug and connect the work.
- **Details:**
  - Promote staging files to their target paths: `server/ingest/`, `src/engine/matrix/`, `src/components/tools/SOTPanel.tsx` and the tests.
  - Wire the imports.
  - Resolve every "request" listed in the handoffs, as the only agent allowed to cross scopes, still never touching `AICompanionModal.tsx`.
  - Run the full suite and the botjot §4 checklist.
- **Goals:** a green tree ready for CP3.
- **filesscope:** the promotion targets listed above, plus the files named in handoff requests. Write `v3-staging/handoffs/afk-AF7.md`.

### Run order across agents
`AF0` → `AF1` → `CX2` → `CX1` → `AF2` → `CX4` → `AF3` → (`CX3` → `AG3`) ∥ `AG1` → (`CP2` → `AG5`), `AG4`, `AF4`, `AF5`, `CX5` → `AF7` → `CP1` finalize → **Austin prompts** → `CP3`.

---

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
