# PF1 Autosheet — Combined Issues (playtest 11-22)

Sources:
- Austin's playtest notes: `notes 2\pfautopt5.txt`
- Austin's `notes 2\stepper remake.txt`
- PAut-3's internals notes: `Paut-3notes.txt`
- The earlier audit: `botjot.txt`

Repo: `C:\Users\Austin\Documents\PROJECTS\pathfinder-1e-modular-workspace`, shortened to APP below. GitHub: Aush10/pathfinder-sheet.

Labels:
- **[confirmed]**: verified in code or run on real data.
- **[likely]** / **[guess]**: still needs checking.
- **[Austin]**: from his notes.

---

## 0. Key correction: Complete Sheet SOT context

The 11-21 change log (`Change log Complete Sheet SOT conte.txt`) says these are done:
- query-focused excerpts
- `sotContext.test.ts`
- a 12k SOT cap
- an 8-message / 4k chat cap

**None of that is on main.** `server/sotContext.ts` (dated 11-11) only formats text. It joins the full `plainText` of every page, with no cap. `sotContext.test.ts` does not exist. `server/routes.ts` handleCompleteSheet sends all pages and the full conversation history. No commit in the git log matches.

Guess: the work was done on an unmerged branch or in an agent session. Look for it before redoing it.

---

## 1. Bugs

| # | Severity | Issue | Root cause (file → function) | Status |
|---|---|---|---|---|
| B1 | High | The Crash copy overrides real saves ("items still read from crash"). The previous character's crash state persists with stats reset. | `src/storage/characterState.ts` restoreSheetFromStorage prefers Crash whenever its checksum differs. `fsAdapter.ts` saveCharacter never refreshes Crash. Crash autosaves on every edit. saveLayout reuses the old crash characterId. | [confirmed] mechanism; [guess] cause of the stats reset |
| B2 | High | "Storage .json locked" error; Explorer crash | `src/storage/useAutosave.ts` → `fsAdapter.ts` autosaveCrash → writeCharacterTree rewrites about 13 files plus .tmp files plus backups about 1 second after every edit. There's no in-flight guard, so autosaves overlap. The locked message comes from `toFailure` (NoModificationAllowedError / InvalidStateError). | [confirmed] file churn; [likely] it caused the lock; [guess] it caused the Explorer crash |
| B3 | High | Add Class copies the whole class table into proficiencies | `src/engine/sotEngine.ts` extractClassFromSrdDoc: the proficiency-section regex fails, so it falls back to `aiService.ts` parseSrdSkillsAndProficiencies on the WHOLE doc. The sentence split treats the table as one "sentence" containing "armor". `ClassArchitectModal.tsx` handleAddKit then writes it into feats. On armorist the result is 31,040 chars. | [confirmed] |
| B4 | High | Slayer artifact in autofill, Add Class and the AI context | `src/engine/aiService.ts` DEFAULT_SOT_CATALOGUE (demo Slayer SRD page, Slayer macros, d20pfsrd links) is used whenever `character.sotCatalogue` is missing, which is the case for every blank sheet (`createBlankCharacter` has none). This happens at aiService.ts ~232 and ~2896 (Complete Sheet sends it to the AI), `ClassArchitectModal.tsx` ~250 and `AddClassModal.tsx` ~226. | [confirmed] |
| B5 | Medium | The "Build Slayer" input filler in Complete Sheet | Hardcoded chips in `CompleteSheetChatWindow.tsx` ~826 ("Build Slayer from SOT") and ~842 (Stygian Slayer) | [confirmed] |
| B6 | High | Tap test loops on the name step | `CompleteSheetChatWindow.tsx` runTapTest re-sends the same step whenever `tapTestNeedsInput` is true. `aiService.ts` ~3127 sets it if the model asks any question, any write is rejected, or nothing applies. The summary sends "Name: Unnamed". | [confirmed] mechanism; [likely] trigger. Check the raw model JSON. |
| B7 | Medium | Complete Sheet sends the full SOT text and full history every turn (token blowup) | `server/sotContext.ts` formatCompleteSheetOverridePages and `server/routes.ts` handleCompleteSheet. The client sends every page with htmlContent (`aiService.ts` ~3034). | [confirmed] (see §0) |
| B8 | Medium | "Sync Host SRDs" panel closes itself too fast | `AICompanionModal.tsx`: `<details open={Boolean(editingPageId \|\| pageSavedNotice)}>`. The notice is cleared after 3.5 s by setTimeout, which collapses the panel. setState is also called inside an updater. | [confirmed] |
| B9 | Medium | SRDs from old characters show up on new ones | Host copies in localStorage (`pf1e_host_srd_doc_*`) are never cleared. `ClassArchitectModal.tsx` sotDocs merges all host docs into every character. | [confirmed] |
| B10 | Medium | Grid adapter adds "[Archetype]" text and can't add columns | `aiService.ts` adaptArchetypeIntoGrid → applyArchetypeSwapsToRows appends `[Archetype] …` on purpose. `ClassGridRow` (`src/types/character.ts` 458) is fixed at level/bab/fort/ref/will/special. The fallback has a hardcoded "Bard Fencer" example. | [confirmed] |
| B11 | Medium | Adding a class grid can overwrite an existing grid | `ClassArchitectModal.tsx` handleAddNewClass uses id = `class${count+1}`, which collides after a delete. | [confirmed] code; [guess] it matches "adding more than 2 replaces the last" |
| B12 | Medium | Class name parsed as "The Armorist\n\nLevel\tBase A" when the name is blank or "New Class" | `sotEngine.ts` extractClassFromSrdDoc: in the `Table\s*:` regex, `\s` swallows newlines | [confirmed] on armorist; not yet seen in the playtest |
| B13 | Low | Special column keeps the Max Bonus / CL / Talents columns | Same function. The trailing-number strip misses "+0 (1)" style values. | [confirmed] on armorist |
| B14 | Low | Extra class skills (Fly, Heal from "flying"/"healing"). Possibly all Knowledge skills marked because "(arcana)" gets stripped. | parseSrdSkillsAndProficiencies scans the whole doc. ClassArchitect handleAddKit strips `\([a-z]+\)`. | [confirmed] Fly/Heal; [likely] Knowledge |
| B15 | Medium | Old-syntax buff suggestions (`Name:\|<^…>\|$`) are rejected by Macaroni 1.2 | `sotEngine.ts` 510 and `aiService.ts` 195–849 | [confirmed] code; untested in the playtest |
| B16 | Low | A blank-name sheet can't be re-imported; save-tree envelopes are rejected by Import | `sheetExporters.ts` importCharacterJSONFile requires a truthy `name` and `abilities` | [confirmed] code |
| B17 | Low | Production deep links return 404 | `server.ts` `app.get('*all')` is Express 5 syntax on Express 4.22 | [confirmed] |
| B18 | Low | Port 3000 hardcoded; the server crashes if it's in use | `server.ts` | [confirmed] |
| B19 | Low | Scratchpad "doesn't work" | `SheetPage3BioStorage.tsx` scratchpad only acts on lines ending `>>#AI$` / `>>AI$` / `>>#ai!` (`aiService.ts` executeScratchpadAIMacro). Otherwise it shows a tip. Those symbols are reserved in Macaroni Part 2. | [confirmed] |

**Spec changes from Austin (not bugs):**
- Total coinage should equal Current GP. Today it is GP + Bank: `currencyUtils.ts` reconcileCurrency(includeBank = true). `SheetPage3BioStorage.tsx` ~191 hardcodes true, and `StorageInventoryModule.tsx` has a toggle that defaults to true.
- Add a container dropdown to the coinage/wealth slate. Today `character.currency` is flat, with no per-container field.

---

## 2. File ingestion and storage

### 2.1 Where things are saved today [confirmed]

Answer to "can't find where it's being saved": nothing goes in the project folder. Everything is in one of these places:

1. **Browser localStorage** for `http://localhost:3000`, per browser (Canary is separate). Keys:
   - `pf1e_host_srd_index_v1`
   - `pf1e_host_srd_doc_<id>` (one per SRD, full HTML)
   - `pf1e_character_data_v1` (the live character, which **also** embeds every SRD)
   - `pf1e_image_library_v1`, `pf1e_user_loadouts`

   You can see these in DevTools → Application → Local Storage.
2. **The picked folder**:
   - `<folder>\AIgamesheet\pfmusers\<player>\<character>\character.json`, with SRDs inside `data.sotCatalogue.overridePages`
   - the same in `...\pfmusers\Crash\character.json`
   - `backups\*.bak`, up to 10 per file
3. **The per-character `SRD\` folder** only contains `README.txt`. It says "untrusted user data", which means "don't execute what's in here". It is not related to the app's "read-only" SRD label, which means sanitized and non-editable. Nothing writes SRD files there.

### 2.2 Problems

| # | Issue | Root cause |
|---|---|---|
| I1 | Each SRD is stored twice in localStorage (about 240 KB per armorist copy). Quota errors are swallowed. | `sotEngine.ts` saveSrdDocToHostDeviceStorage returns `''` silently while the UI still says "saved". `CharacterContext.tsx` persist effect: "ignore quota errors". |
| I2 | `character.json` is capped at 5 MiB, and SRDs and images count toward it | `fsAdapter.ts` MAX_FILE_BYTES |
| I3 | No format check. A wrong-shape `.srd.json` loads as one text blob. | `sotEngine.ts` parseImportedSrdFile. Untested: the pf1mod files' shape is unknown. |
| I4 | Exports ignore the connected folder (always go to Downloads) [Austin] | All exports use `<a download>` (`sheetExporters.ts`, `sotEngine.ts` exportSrdDocFileToHost, `LoadoutModal.tsx`). The JSON export uses a data: URL, which risks size limits. |
| I5 | Manual SOT entries must be saved one at a time [Austin] | `AICompanionModal.tsx` handleSaveOverridePage, `CompleteSheetChatWindow.tsx` handleSaveQuickSot |
| I6 | SOT UI is buried in the AI Companion [Austin] | Catalogue UI is inside `AICompanionModal.tsx` (134 KB) |
| I7 | Loadout tool: no envelope support, no read-error handling | `LoadoutModal.tsx` handleFileUpload (FileReader, no onerror) |
| I8 | Duplicate data sources | `Documents\pf1mod` and `Documents\PROJECTS\pf1mod`. Pick one canonical copy. |
| I9 | The Complete Sheet SOT fix described in the 11-21 change log is missing from main | See §0 |

### 2.3 New requirement: every ingest produces four outputs [Austin]

When a sheet or SRD is ingested it should produce:

1. **Table**: structured, e.g. class progression grids.
2. **List of links.**
3. **Compact markdown**: text only.
4. **AI lookup index**: keywords that appear frequently or prominently.

| Output | APP today | `lazyafpf1builds\sheet-engine` prototype (11-11, 22/22 tests pass, not wired in) |
|---|---|---|
| 1 Table | Class grids only, by regex (`sotEngine.ts` extractClassFromSrdDoc, parseClassProgressionGrid). Fixed 7-column `ClassGridRow`, so extra columns are lost. | `src/ingest/tables.ts`: any `<table>`, rowspan/colspan expanded, multi-row headers → `tables.json` |
| 2 Links | `incidentalLinks` collected (142 on armorist), but the `<a>` tags are converted to spans, so positions are lost | `links.json` (text, href, canonical, section_id). Needs the ORIGINAL HTML: it found 0 links on APP's sanitized HTML. |
| 3 Compact markdown | `plainText` (tags stripped, not markdown) | Turndown, heading-aware sections (`sections.jsonl`). Measured on armorist: about 49.5k → 11.2k est. tokens (−77%). |
| 4 Keyword index | None. Full text goes to the model. | `src/ingest/keywords.ts` (heading, defined terms, table headers, frequent terms, dictionary, synonyms) → `keywords.json`, plus a BM25 `index.json` and `toc.json` |

**Gaps:**
- sheet-engine skips `.json`. It needs a `.srd.json` unwrap (srdDocument.htmlContent → .html) and an extractor for sheet JSON.
- It is Node-only, so it must run server-side, but SRDs currently live in browser storage.
- **Proposal** (not built): store the outputs in the unused save-tree folder as `<character>\SRD\<doc>\{table.json, links.json, text.md, index.json}`.
- Consumers (Complete Sheet, Apple Eye, Class Architect, matrix "assign") then query the index and pull only the matching sections and rows. That closes B7.

**Buckets:**
- **Codex/Copilot:** the pipeline port, unwrap and sheet extractor, schemas, fixtures and tests.
- **AFK pilot:** the ingest endpoint, save-tree persistence, localStorage migration, retrieval wiring into the AI routes.
- **Antigravity:** a SOT panel showing the four outputs, plus batch save.

---

## 3. UI overhaul spec: Character Matrix, Career Index and user indexes [Austin]

This restates Austin's proposal. His notation rules are kept exactly.

### 3.1 Replace the career tab and modal options

- Remove the career tab and the modal options (multiclass / alternative / etc.).
- Players get a single **Character Matrix**. It can be filled manually, as class 1 is now, but instructions encourage letting it autofill. If a user fills the matrix themselves and applies it, it behaves as now (class 1 fills the sheet).
- Where the class 2 grid is now, there is a default **Career Index**:
  - Column 1 is the level sequence 1–20.
  - Column 2 ("track") is empty, waiting for a user index name.
  - Users can add as many track columns as they want.
  - The Career Index tells the Matrix which user index to read for each level. The default value is **0**, meaning don't autopopulate.
- Same location and style as the class 1 / class 2 tabs. An empty 3rd grid tab sits where "+ Add Class" is now. Clicking the empty tab:
  1. creates a new user input class grid (user index), and
  2. creates a new empty tab to its right.
- Currently only 2 subtabs can exist, and adding a third deletes and replaces the last one. In the new model players may have any number of active or inactive classes.
- When apply-to-sheet runs, the **gestalt grid** is what is read and added.
- The first time a user index is created, column 2 of the Career Index is populated with its name.

### 3.2 Reading rule (counting)

The Matrix counts like items in the track to decide which row of that index to use.

```
level | track A
1 | fighter      -> fighter row 1
2 | fighter      -> fighter row 2
3 | wizard       -> wizard row 1
4 | wizard       -> wizard row 2
```

- A second index (e.g. wizard) does not populate until the user edits the Career Index, typing wizard in the levels where they want it.
- Typing is preferred over a dropdown.

### 3.3 Color states

- **Green**: a value was found at the indicated address.
- **Red**: nothing found. For example, no fighter value at that level, or no index exists (e.g. "magus").
- **Yellow**: a syntax error in a header fill, or the result would exceed **40 rows** (prevents runaway fills).

### 3.4 Gestalt

- Edit the class index directly.
- **Comma in a track cell** (`fighter,wizard`): add BOTH values for that level. Like-named columns are combined, with the values appended and separated by a comma. For numeric columns (BAB, saves) the **first** value is dominant and the others are dropped.
- **Second track column** filled with a second class: treated the same way, except it takes the **higher** of like values.
- **`*` dominance** (`fighter,*wizard`): wizard's values are dominant. Only the values fighter has that wizard doesn't are added. The cell stays green if this works.
- User and AI input grids on subtabs live at tab 2 and up.
- The gestalt grid is generated one row at a time. For each row it takes the entire matching row from each user index into a virtual array and combines like columns.

### 3.5 Header fill shortcuts ("the header spills a column")

| Syntax | Effect |
|---|---|
| `=wizard` | Fills every cell in that track with "wizard". Example: type `=wizard` in the track B header for gestalt fighter/wizard instead of typing wizard 20 times. |
| `+1` (`-1`, `+2`, `-4` …) | Sequence starting at that value, up to the number of existing rows, or 20 if none: 1, 2, 3, 4… |
| `+1>3` | `>` = how many to fill: 1, 2, 3, then 0 |
| `+1!2` | `!` = pattern separated by that many rows: 1, 0, 2, 0 … |

Yellow on a syntax error or more than 40 rows.

### 3.6 Class index tamper notation (in track cells)

| Syntax | Effect |
|---|---|
| `fighter4` | Sets the count for that item. In `wizard / wizard / fighter3`, fighter's 3rd level is added at level 3 even though its count would be 1. It does not back-fill rows 1–2. |
| `fighter+bab` | Take fighter's BAB at this level even if you otherwise wouldn't |
| `fighter-bab` | Don't populate BAB for this level |
| `fighter=bab` | Only BAB for this level |
| `fighter=bab+special` | Only the BAB and special columns (identified by headers) |
| `fighter-bab-special` | Neither of those columns |

Spells: flagged as confusing; not yet specified. Terminology: saved user grids are called **user input grids**. By default their leftmost column is the sequence 1–20.

### 3.7 User indexes and the Edit Index subtool

Not every player index is a class grid. Right-click an index tab → **Edit index**. This creates a new virtual index and opens a popup with:

- **Clear index**: return it to all-0 values.
- **Cleanup (remove / replace)**: remove one type of value from the index, or replace it with another.
- **Template tool**: work in progress, come back later.
- **Row 0**: creates a level-0 row. It is added to the sheet but does not appear on the matrix. Use it for **race** (a race is a 0-level class) without a new module.
- **RowCol**: reorder or insert rows and columns, mark them frozen (leftmost frozen by default) or hidden (not on the matrix but still added to the sheet).
- **Autofill**: same as header spills, but manual. Pick a row or column and enter the fill instruction.
- **Append**: treat one index as an extension of another. Shown as the appended tab partly hidden behind the tab it extends. If the Career Index says `fighter4` and wizard is appended to fighter, the matrix reads both.
- **Assign**: lets apply-to-sheet recognize ability calls. Highlight a non-number value and assign it a block of text from the SOT ("TOS" in the notes). This is automatic when using the AI companion.
  - **Auto assign all**: assigns every highlighted value the text block immediately following it in the SOT index.
- **Bind**: finds similar values (e.g. "extra feat" ×10 in fighter, or "monk AC +3 / +4") and binds them to one ability that updates instead of duplicating. Options: **bind (take highest)** or **bind (count total)**.

### 3.8 Ability types

- Today apply-to-sheet adds every ability as an action/resource, and the type can't be changed afterward.
  1. In the index, typing `<rec>`, `<act>` or `<spell>` next to an ability's value sets its type. `<feat>` sends it to the Feats section instead.
  2. The type must also be editable in the Actions & Resources area.

### 3.9 Race and scratchpad

- **Race**: a simple race function in the Biography & Narrative module. Matrix row 0 also covers it.
- **Scratchpad**: currently broken and ugly. Add a search bar and an interface for Apple Eye to look up items from anywhere on the sheet.

### 3.10 Implementation notes from PAut-3 (clarifications, not Austin's spec)

**Components this replaces:**
- ClassArchitectModal's career tab: `careerData` / `CareerProgressionData` (with a 20-level cap), `CareerLevelEntry` (primary plus one gestalt).
- `applyCareerProgressionToCharacter` and `multiclassCalculator.ts`.
- `customClassGrids` class1/class2 subtabs (with the B11 id bug).
- The mode toggles.
- handleAddKit's sheet writes become "apply matrix".
- The orphaned `AddClassModal.tsx` should be deleted, not ported.

**Data model:**
- Grids need generic columns: `{columns:[{id, header, type, frozen, hidden}], rows, row0}`. This requires a migration from `ClassGridRow`.
- The Career Index is `tracks[] → cells[]`, each cell a parsed token list.
- The Matrix should be **derived** (recomputed), not stored, to avoid drift.
- Columns need stable ids and normalized headers ("Base Attack Bonus" = "BAB"), so `+bab` filters survive header renames.

**Risks:**
- The fill syntax needs a real parser plus tests (combos like `+1>3!2`, negative starts, overwriting manual edits).
- Decide whether 21–40 rows are allowed (epic levels) or 40 is only a runaway guard.
- Name normalization is needed to avoid false reds.
- After `fighter4`, does the next plain `fighter` continue at 5? Needs a decision.
- Spells-per-day merge rules are undefined.
- Assign needs stable SOT section ids, which come from the §2.3 index.
- `<act>/<rec>/<spell>/<feat>` map to characterActions / resourceTrackers / spells / characterFeats. Editability touches `ActionDirectoryModule.tsx`.
- Row 0 writes raceMod, size, speed, languages and traits.

---

## 4. Cleanup and orphans (from the audit; still relevant)

- `src/components/tools/AddClassModal.tsx` is orphaned. Class Architect is mounted as "Add Class" (App.tsx ~433). `docs/PROGRAM_MAP.md` says the opposite; update it (it also says 49 tests, now 60).
- Not imported: `SheetPage2SkillsGear.tsx`, `ImageBrowserModal.tsx`, `GlyphPicker.tsx`, `DSLBibleDrawer.tsx`, `storage/seedTree.ts`. Effectively unused: `SheetPage3SpellsBio.tsx` (conditions strip only), `QuickHPBar.tsx`.
- Demo data to remove or relabel: DEFAULT_SOT_CATALOGUE (Slayer), the Slayer chips, the Bard Fencer fallback, the stubAdapter sample characters.
- Gemini leftovers: `/api/gemini/*` aliases, `getSessionApiKey`, `metadata.json`, the README note. The package name is still "react-example".
- `macaroni.test.ts` is not in `npm test`.
- Stale builds: `dist\`, `dist-standalone\`, `public\pathfinder1e_standalone.html` (11-05 to 11-07, older than the code). Rebuild or remove.
- Debris:
  - `sot-ai-complete-sheet.bundle` (a git bundle from 11-05)
  - `pathfinder-1e-modular-workspace.zip`
  - `bun.lock`
  - `tmp-tsc.ps1`
  - `New folder\`
  - three `Attached Element Context from Integrated*.txt` (2 and 3 identical)
  - `.aistudio\`
  - duplicate `character-sheet-icons\`
- Docs:
  - `ROADMAP-11-18.md` is complete; archive it.
  - `AI_THEORY_AND_ROADMAP.md`, `CHANGELOG_FOR_ANTIGRAVITY.md` and the skeleton notes are superseded.
  - Keep `docs\program-map\*`, `SAVE_STATE_DIAGNOSIS.md`, `STORAGE_TREE.md` and `copilot-character-engine-handoff\*`. Merge the handoff into the new roadmap.
- `npm run clean` uses `rm -rf`, which fails in Windows cmd. `vite.config.ts` uses `__dirname`.
- `/api/sot/fetch-readonly-page` fetches any URL, and `/api` has no auth. Fine on localhost; a risk if hosted.
- Installer and packager mismatch (per PROGRAM_MAP). The installed app has no `/api`, so no AI.

---

## 5. Stepper remake [Austin, `stepper remake.txt`]

- Hide the stepper slate and the level-stepper slate, but keep the code.
  - The turn stepper is already hidden by `.pf1-hidden-turn-stepper` in `src/index.css` (used in `QuickModularTools.tsx`).
  - `visibleModules.levelStepper` exists, but no component reads it. Identify the actual level-stepper slate in the browser first.
- Hide the stepper tool button. Austin's XPaths:
  - `//*[@id="root"]/div/div[2]/main/div/div/div/div[3]/div/div[2]`
  - `//*[@id="root"]/div/div[2]/aside/div[3]/div[1]/button[1]/div/div[1]`
  - **Caution [guess]:** read statically from `BlueprintSidebar.tsx`, the aside XPath lands on the **Deck** button's label, not a stepper. Confirm with DevTools before hiding anything. The StepperTool modal itself is opened via AICompanionModal `onOpenStepper` (App.tsx ~481).
- Make scrollbars match the sheet's color, shape and transparency.
  - Today only `.pf1-blue-scrollbar` exists (`#2563eb`, 8px, pill, transparent track), used only in ActionDirectoryModule.
  - Make a theme-aware global scrollbar with CSS variables for the parchment / blueprint / mythweavers / print themes.

---

## 6. Brief for the agent writing `Roadmaplate.md`

**Your job:** write `Roadmaplate.md`, a roadmap that splits the work above into small, independently testable tasks by agent. This document is the input, not the roadmap.

**Rules for the roadmap:**
- Every task names its files, its acceptance check, and its dependencies.
- Order the work in this sequence:
  1. Save and storage correctness.
  2. Ingestion (four outputs).
  3. Bounded AI retrieval.
  4. Character Matrix.
  5. Polish.
- Don't fold macro-language changes into UI tasks.

**Bucket A — Codex / Copilot (heavy backend, repetitive):**
- B3, B12, B13, B14: SRD class extraction fixes, with tests on `save tree test\armorist.srd.json`.
- B15: migrate the old buff syntax. B19: decide the scratchpad directive syntax vs Macaroni reserved symbols.
- B4/B5 data side: blank `sotCatalogue`; remove or relabel the demo Slayer data.
- B11: grid id generation.
- B16: import accepts envelopes and blank names.
- §2.3: the four-output ingestion pipeline (port or extend sheet-engine, `.srd.json` unwrap, sheet extractor, schemas, fixtures).
- §3: the Character Matrix engine (no UI):
  - generic grid model and migration from `ClassGridRow`
  - Career Index tokenizer and parser (`=`, `+n`, `>n`, `!n`, comma gestalt, `*`, `fighter4`, `+col/-col/=col`)
  - row-by-row gestalt merge
  - color-state computation
  - Edit Index operations (clear, remove/replace, row 0, rowcol, autofill, append, bind)
  - `<act>/<rec>/<spell>/<feat>` tag mapping
- Coinage: GP-only total (spec change).
- §4 cleanup: orphan removal, the test script, the clean script, the vite config, doc refresh.

**Bucket B — Antigravity (UI):**
- The Character Matrix and Career Index UI (§3): tabs, the empty "new index" tab, the right-click Edit Index popup, color states, the append tab overlap.
- Editable ability type in Actions & Resources.
- A SOT panel separated from the AI Companion (I6), with batch save (I5) and a viewer for the four outputs (§2.3).
- B8: SOT panel open state. B5 UI: remove the Slayer chips.
- The coinage container dropdown.
- Scratchpad redesign: search bar plus Apple Eye lookup from anywhere.
- Simple race function in Biography & Narrative.
- §5: the stepper remake (hide slates and button via flag or class, theme-aware scrollbars). Confirm the XPaths first.
- Quota and size warnings, and clearer import errors.

**Bucket C — AFK pilot (connection layer: server, API, AI routes, storage/IO, folder connection, downloads, sync):**
- B1 / B2 / B9: the crash and save path.
  - Serialized autosave queue with an in-flight guard; crash saves skip the projection rewrites.
  - Deliberate Save refreshes or clears Crash.
  - Prefer Crash only if it is newer and has the same characterId, and ask the user.
  - Scope host SRDs per character, or move them into the save tree.
  - Follow `docs\SAVE_STATE_DIAGNOSIS.md` and `docs\CODEX_SAVE_PATH_WORKFLOW.md`.
- I1 / I2: storage limits.
  - Stop double-storing SRDs.
  - Keep SRD bodies out of `pf1e_character_data_v1` and `character.json`; reference them instead.
  - Surface quota errors.
- I4: exports write to the connected folder (e.g. `<character>\exports\`), with a Blob fallback.
- I7: loadout file read errors and envelopes.
- §2.3 connection side:
  - `POST /api/sot/ingest`, which runs the pipeline server-side
  - persist the outputs to `<character>\SRD\<doc>\`
  - migrate existing localStorage SRDs
- B7 / §0: bounded retrieval in `/api/openai/complete-sheet` and `/lookup`, using the keyword index. Cap the history.
  - First check GitHub for the missing `sotContext.test.ts` work.
- B6: tap test progression. Don't count "no write" as needing input on the identity step; log the raw model JSON.
- B17 / B18: Express catch-all, port fallback (`PORT` env). Allowlist for `/api/sot/fetch-readonly-page`.
- Installer and packager alignment.

**Open decisions for Austin (put these at the top of the roadmap):**
- Matrix row cap (20, or up to 40).
- Count continuation after `fighter4`.
- Spells merge rules.
- Templates (deferred).
- Whether SRD originals live in the save tree.
- Which pf1mod folder is canonical.
