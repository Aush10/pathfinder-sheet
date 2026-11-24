# [v3] Antigravity tasks — PF1 Autosheet 1.3.0

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

UI fixes only. Do not put macro-language changes into UI tasks. Bind to engine APIs; do not reimplement parsers or table classification in components.

## Phase order (do not start early)

Work is sequenced. Austin decides when each agent starts. Do not begin a task until its dependencies are done and Austin has told you to start. Phase 0 (verify first, read-only) happens before any code changes.

`AF0` → `AF1` → `CX2` → `CX1` → `AF2` → `CX4` → `AF3` → (`CX3` → `AG3`) ∥ `AG1` → (`CP2` → `AG5`), `AG4`, `AF4`, `AF5`, `CX5` → `AF7` → `CP1` finalize → **Austin prompts** → `CP3`.


## Dependencies for your tasks

- **AG1** starts after **AF2** (ingest endpoint and storage functions exist). `App.tsx` mount comes first; AG4's `App.tsx` stepper-button change waits until after AG1.
- **AG3** starts after **CX3** (Matrix engine) and **AF1** (per-character SRD loader).
- **AG4** needs Phase 0.2 (confirm stepper XPaths in DevTools) before anything is hidden. If the aside XPath is the Deck button, stop and ask Austin.
- **AG5** starts after **CP2** (currency default) and **CX3** (currency container types).

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

Add-class / Populate from SOT and the SOT panel table viewer must honor these kinds. Lookup tables are visible as reference and must not be added to the Matrix. Do not reimplement classification in the UI.

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


### Antigravity

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

