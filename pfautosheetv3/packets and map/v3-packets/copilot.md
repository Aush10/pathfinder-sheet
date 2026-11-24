# [v3] Copilot tasks — PF1 Autosheet 1.3.0

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

Heavy backend and repetitive work, plus release scaffolding.

- **CP1:** Prep the v3 tag at version **1.3.0** now (draft only). Do not apply the tag or push.
- **CP3:** Run the stability check and prepare push notation **only after Austin prompts again**. Do not start CP3 on your own. **Do not push without Austin's go.**

## Phase order (do not start early)

Work is sequenced. Austin decides when each agent starts. Do not begin a task until its dependencies are done and Austin has told you to start. Phase 0 (verify first, read-only) happens before any code changes.

`AF0` → `AF1` → `CX2` → `CX1` → `AF2` → `CX4` → `AF3` → (`CX3` → `AG3`) ∥ `AG1` → (`CP2` → `AG5`), `AG4`, `AF4`, `AF5`, `CX5` → `AF7` → `CP1` finalize → **Austin prompts** → `CP3`.


## Dependencies for your tasks

- **CP1 (prep):** can draft early from this packet. Finalize only after other agents' handoffs exist (especially AF7). Never push or tag without Austin's go.
- **CP2 (Phase 5 cleanup):** after Antigravity's AG3 handoff, so `AddClassModal.tsx` is not removed while someone still references it. Coinage default in `currencyUtils.ts` must land before AG5.
- **CP3 (release):** only when Austin prompts again, and only after AF7 has connected the work. If anything fails, report it; don't fix it.

### Copilot

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

