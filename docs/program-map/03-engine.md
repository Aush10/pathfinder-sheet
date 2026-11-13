# 3. Engine

`CharacterContext` is the only place that turns a character into the numbers the sheet displays: `resolveIntegratedCharacterView` calls `computeDerivedCharacterStats` and `calculateCareerProgression` (`src/engine/characterIntegration.ts` 203–212). Several tools also call the math and formula modules directly for previews.

## `pf1eMath.ts`

`computeDerivedCharacterStats` is the combat pass: ability totals and modifiers, size modifiers, condition penalties (`evaluateConditions`), stacked buffs (`resolveBuffProjection`), AC and touch/flat-footed, saves, BAB and iteratives, initiative, CMB/CMD, HP breakdown, skill-point budget, encumbrance, and point-buy spent.

Also exported:

- `POINT_BUY_COST_TABLE`, `POINT_BUY_PRESETS`, `getPointBuyCost` — used by `PointBuyModal` and by `applyPointBuyToCharacter`.
- `evaluateConditions` — also called directly by the condition bar, print sheet, DSL drawer, formula studio, XDX, and macro debug.
- `computeBuffBoxTotals` — stacking totals used by `BuffBoxModule` in parallel with `derived.buffTotals`.
- `computeNaiveBuffTotals` — sums without stacking. Nothing outside this file imports it.
- `SIZE_MODIFIERS` — used inside the derived pass.

`DSLBibleDrawer` calls `computeDerivedCharacterStats` itself. That drawer is not mounted (part 4).

## `formula.ts`

`buildFormulaContext` fills names the macros can see: level, BAB, caster level, ability scores and mods, HP, AC if `derived` was passed, saves, CMB/CMD, skills, custom objects, XDX macros, and resource pools. Callers that omit `derived` use raw ability sums minus condition penalties, not the stacked buff totals.

`evaluateFormula` splits on `|`, expands `<<name>>` / `{name}` / `@name`, and stops at depth 6. `solvePureMath` strips the segment to digits and `+ - * / ( ) .` and then evaluates with `new Function`. `executeDiceRoll` handles `NdM`, keep-lowest `k`, and flat modifiers. `DiceRollerTray` uses `executeDiceRoll`. Sheet pages, print, the quick-grab panel, and the AI modal use `evaluateFormula`.

## Macaroni

`src/engine/macaroni/lexer.ts` tokenizes a small language: comments, quoted text, `<?...>` queries, `<11"msg">` UI presets, `<^...>` buff makes, `>>` / `<<` pushes, `[eval]`, `{math}`, `field^delta`, dice, and inert text.

`executeMacaroni` (`evaluator.ts`) returns text plus `alertEvents`, `buffMakeEvents`, `queryEvent`, and `stateMutations`. It does not write the character. `applyMacaroniToCharacter` writes buff matrix cells, custom buffs, HP, temp HP, and currency from those mutations. `projectMacaroniResult` in `characterIntegration.ts` (about 498–565) is the wrapper the tools call, and it also promotes leftover mutations into `Macro:` custom buffs.

`App.tsx` listens for the alert and query events the UI dispatches after a run. Query `onSelect` inside the evaluator is a stub; the modal in `App.tsx` is what records the choice.

Depth limit is 6, same as formulas.

Callers: page 1, `BuffBoxModule`, page 4, `XDXTool`, `MacroDebugTool`.

## Career

`calculateCareerProgression` (`src/engine/multiclassCalculator.ts` 141–513) walks `careerData.levels` or synthesizes levels from `character.level` and `customClassGrids`. It handles gestalt (max HD / BAB that level), fractional BAB and saves, first-level max HP versus average, skill points, archetype feature swaps, and a fixed VMC schedule (`VMC_SCHEDULES`).

`applyCareerProgressionToCharacter` (`characterIntegration.ts` 239–388) writes level, the class list, BAB, save bases, HP, hit dice, class skills, and the feat list. `AddClassModal` and the unmounted `ClassArchitectModal` call the calculator. The context helper `syncCareerToSheet` calls the apply function. `resolveIntegratedCharacterView` also runs the calculator so `careerSummary` stays current.

`POPULAR_ARCHETYPES` is exported and not imported anywhere else.

## Point buy and images

`applyPointBuyToCharacter` (`characterIntegration.ts` 394–434) checks the budget and ability increases, then writes bases. `applySelectedImageToCharacter` (570–607) stores a URL on the profile, a portrait list, or an inventory item. It does not write a file.

## Sheet-write authorization

`src/engine/sheetFieldWrites.ts` is the gate for model output and for the English field inspector. The file header says refused fields leave the character unchanged.

`applyStructuredSheetUpdates` (1296 onward):

1. Rejects objects whose keys match `SECRET_KEY` (`api_key`, token, password, and similar).
2. Rejects an unknown `category`. The allowlist is `FIELD_CATEGORIES` (1270–1290): hp, conditions, currency, inventory, notes, journal, customFormulas, coreIdentity, abilities, armorClass, saves, attacksAndWeapons, armorAndGear, actionsAndResources, feats, skills, spellsAndMagic, companionsAndMount, bioAndProfile.
3. If `allowedFields[category] === false`, the update is **blocked** and the character is unchanged.
4. Abilities additionally require `allowedModules.pointBuy` when that module is present, a stated budget, scores from 6 to 18, spend within budget, and ability increases within `floor(level/4)`. Random arrays run only when the caller sets `allowRandom` and the player text asked for random.
5. Class writes refuse an invented hit die and an archetype that is not in the supplied SOT text. A missing progression grid becomes a question rather than a guessed table (`syncSharedClassState`).
6. Collections (feats, inventory, spells, weapons, armor, actions, companions, journal, formulas) add, remove, or upsert rows. Unknown skill names do not write.

`parseNaturalLanguageSheetUpdates` turns English commands into the same updates. `CompleteSheetChatWindow` does not call that parser itself; `completeSheetConverse` runs structured updates and the English parser inside `runCompleteSheetWrites` (`src/engine/aiService.ts`).

## Buff projection

`src/engine/buffProjection/stacking.ts`: penalties stack. Untyped and dodge bonuses stack. Every other bonus type keeps only the highest per stat; the rest are marked suppressed. `resolveBuffProjection` feeds `computeDerivedCharacterStats`. `describeStatProjection` is exported and unused outside the module.

## SOT engine

`src/engine/sotEngine.ts` is client-side:

- `sanitizeSrdDocument` strips scripts, iframes, event handlers, webhook-like URLs, and fenced code, and collects links as inert records (patterns near the top of the file, function around 63–181).
- `saveSrdDocToHostDeviceStorage`, `loadAllHostDeviceSrdDocs`, and `removeSrdDocFromHostDeviceStorage` use `localStorage` keys `pf1e_host_srd_doc_{id}` and index `pf1e_host_srd_index_v1` (187–245). Failures are caught and the save function returns `''`.
- `exportSrdDocFileToHost` triggers a browser download of `{slug}.srd.json` (247–271). It does not write the folder tree.
- `parseImportedSrdFile` accepts the JSON envelope or raw HTML/text.
- `extractClassFromSrdDoc` pulls class name, hit die, skill points, proficiencies, and a 1–20 grid from a table or a synthesized chassis, plus `extractMacaroniSuggestionsFromSrd` (sentence scan, not a model).

`AddClassModal`, `ClassArchitectModal`, `AICompanionModal`, and page 4 call these. `parseSrdSkillsAndProficiencies` lives in `aiService.ts` and is used by the class extractor.

## Tap Test

`src/engine/tapTest.ts`: the exact phrase `tap test` starts a 10-step random build (identity, class, abilities, HP, one skill, one feat, one weapon, one armor, one item, biography). `buildTapTestTurnInstruction` tells the model which category is legal. `filterTapTestUpdates` drops every other `sheetUpdates` entry before apply. `CompleteSheetChatWindow` and `completeSheetConverse` pass `{ step, budget }`. The server includes the instruction only when that object is well-formed (`server/routes.ts` 144–148).

## Sketches

`generateProceduralPencilSketch` (`src/engine/sketchRenderer.ts`) draws a canvas pencil sketch from keywords and returns a PNG data URL. The only caller is `generatePencilSketch` in `aiService.ts`. The journal "sketch" button does not call the image model.
