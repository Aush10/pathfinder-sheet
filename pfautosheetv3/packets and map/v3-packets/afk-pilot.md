# [v3] afk pilot tasks — PF1 Autosheet 1.3.0

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

Connection layer: server, API and AI routes, storage and file IO, folder connection, downloads, and sync. You are also the integrator.

**Before connecting work (AF7), you must:**

1. Read the **full** Roadmaplate (tracking issue and `/workspace/pf1-handoff/Roadmaplate.md`, also `C:\Users\Austin\Documents\notes 2\Roadmaplate.md`).
2. Read every **Codex** agent handoff under `APP\v3-staging\handoffs\`.
3. Read every **Antigravity** agent handoff under `APP\v3-staging\handoffs\`.
4. Then form a plan, debug, and connect the work. You are the only agent that moves files out of staging into `src\` or `server\`.

Do not start AF7 until those handoffs exist and Austin has told you to connect the work.

## Phase order (do not start early)

Work is sequenced. Austin decides when each agent starts. Do not begin a task until its dependencies are done and Austin has told you to start. Phase 0 (verify first, read-only) happens before any code changes.

`AF0` → `AF1` → `CX2` → `CX1` → `AF2` → `CX4` → `AF3` → (`CX3` → `AG3`) ∥ `AG1` → (`CP2` → `AG5`), `AG4`, `AF4`, `AF5`, `CX5` → `AF7` → `CP1` finalize → **Austin prompts** → `CP3`.


## Dependencies for your tasks

- **AF0** is first: Phase 0, read-only. Search branches/PRs/worktrees for the missing `sotContext.test.ts` work **before anyone is assigned the B7 fix**. Also record the 0.3 data checks if Austin hasn't. Nothing is hidden on the stepper until XPaths are confirmed in DevTools (Antigravity does the hide, after 0.2).
- **AF1** starts after 0.3 / AF0 as needed.
- **AF2** starts after **CX2** and **AF1**.
- **AF3** starts after **AF0**, **AF2**, and **CX4**.
- **AF4** is Phase 5 (server hygiene).
- **AF5** starts after **AF2** (`fsAdapter.ts`).
- **AF6** only if Q8 = in scope (pending; default is ask, do not assume it is in 1.3.0).
- **AF7** is last before Copilot finalizes CP1 and, when Austin prompts, CP3.

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

AF2 persists `table.json` with a `kind` on every table. AF3 bounded retrieval uses the keyword index and compact markdown, not full SOT text. Ingest stays deterministic; the AI never classifies tables.

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


### afk pilot

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

