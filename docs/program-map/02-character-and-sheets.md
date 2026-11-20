# 2. Character model and sheet pages

## The saved object

`PF1Character` in `src/types/character.ts` (about 559–755) is one JSON object. There is no top-level schema version on it. `memoryBank.schemaVersion` is `1` (about 832–838). Folder envelopes use schema version 1 in `src/storage/fsAdapter.ts`.

Groups on the character:

- Identity: name, player, alignment, race, deity, size, XP, hero points, `classes[]`, `level`, `careerData`, `customClassGrids`.
- Abilities: six `AbilityScore` records (`base`, racial, enhancement, misc, temp, and a separate `directMod`). Optional `pointBuyBudget` is not filled in by the blank sheet.
- Vitals stored as numbers: HP current/max/temp/nonlethal, `hpBreakdown`, death saves, DR, SR, resistances, BAB, AC modifiers, saves, initiative misc, speeds, CMB/CMD overrides.
- Lists: weapons, armor, skills, inventory, currency, languages, spells, spell slots, conditions, feats, actions, resource trackers, companions, journal.
- Two biographies: flat `biography` and rich `characterBio` (scratchpad, portraits, sections).
- Tool state: `buffBox`, `customBuffs`, `stepperRules`, `deckState`, `xdxMacros`, `customObjects`, `uiMakePresets`, `profileData`, `rollupNotes`, `downtimeCapital`, `droppedBags`, `installedModules`, `sotCatalogue`, `memoryBank`, `workspaceLibraryImages`.

`WorkspaceLayout` (about 390–427) is separate: theme, font, glyph style, `activeSheet` 1–4, `showAllSheets`, and `visibleModules` toggles.

`magicItemSlots` is on the type and is merged by `normalizeCharacter` (`src/storage/characterState.ts`). No sheet component reads it.

The comment on `memoryBank` says it is mirrored to `AI/memory/manifest.json`. The folder writer never creates that file. It writes `AI/README.txt` and regenerates `AI/read_only/README.txt` (`src/storage/fsAdapter.ts` inside `writeCharacterTree`).

## Defaults and boot state

`src/data/defaultCharacter.ts`:

- `DEFAULT_CHARACTER` spreads `default_sheet.json` (the Valerius demo) and replaces buffs, skills, and starter XDX macros.
- `createBlankCharacter()` is an empty level-0 sheet. Its AI companion flag starts installed.
- `syncOddLevelFeats` inserts placeholder feats at odd levels.

`loadInitialCharacterState` (`src/engine/characterIntegration.ts` 130–148) picks, in order, `window.__INITIAL_CHARACTER__` (standalone HTML injection), `localStorage` key `pf1e_character_data_v1`, then `DEFAULT_CHARACTER`. Layout uses `__INITIAL_LAYOUT__`, then `pf1e_workspace_layout_v1`, then `DEFAULT_WORKSPACE_LAYOUT` (153–181).

Folder loads go through `normalizeCharacter` in `src/storage/characterState.ts`, which merges onto a blank sheet rather than the Valerius demo, then `normalizeCharacterState` adds odd-level feats.

## Who mutates state

`CharacterProvider` (`src/context/CharacterContext.tsx`) holds `character` and `layout`. Every change path ends in `setCharacter` or `setLayout`.

| Call | Effect |
| --- | --- |
| `setCharacter` / `updateCharacter` | Raw dispatcher. Sheet pages use this. |
| `patchCharacter` | Shallow merge (204–206). |
| `applyLoadedCharacter` | `normalizeCharacterState` after a folder load (208–215). |
| `applyPointBuy` / `applyBaseScores` | `applyPointBuyToCharacter`. |
| `syncCareerToSheet` | `applyCareerProgressionToCharacter`. |
| `updateHP` | Shallow merge of four HP fields (245–251). |
| `updateBuffBox` | `applyBuffBoxToCharacter`. |
| `updateCustomBuffs` | `applyCustomBuffsWithInventorySync`. |
| `applyImageSelection` | Writes profile, portrait, or item image URL (262–267). |
| `resetToBlankSheet` / `resetToDefaultSheet` | Blank sheet, or the Valerius default. `NewSheetModal` calls these. |
| `installAICompanion` | Sets `installedModules.aiCompanion`. |
| `importJSON` | File picker, then `setCharacter`. |

Effects (154–196):

1. Debounced crash autosave, skipped on the first render (`src/storage/useAutosave.ts`).
2. `restoreSheetFromStorage` replaces state when the folder read returns a character.
3. `character.level` re-runs odd-level feat sync.
4. The whole character is written to `localStorage` on every change. Quota errors are ignored.
5. Layout is written to its own `localStorage` key.
6. `resolveIntegratedCharacterView` recomputes `derived` and `careerSummary`.

Stored fields are what the inputs write. Totals on the sheet (ability mods, AC, saves, attack bonus, skill totals, encumbrance, calculated max HP) come from `derived` and are not written back unless a control copies them (page 1 "reset HP to max" writes the derived max into `hpCurrent` and `hpTotalMax`).

Example, skill ranks: `SheetPage2ActionsSkills` `updateSkill` replaces `character.skills` via `setCharacter`. The displayed bonus adds ability mods, a class-skill +3, and armor check from `derived`. Example, damage: page 1 writes `hpCurrent` directly; `QuickHPBar` would call `updateHP`, but nothing opens that bar (see part 1).

## Sheet surfaces

| File | Mounted? | What the user sees and edits |
| --- | --- | --- |
| `SheetPage1Core.tsx` | Yes, page 1 and show-all | Identity (`IdentityLoadFields`), abilities, HP, AC, saves, attacks, weapons, armor, inline buff box, level stepper. Roll buttons call `onRollFormula`. Page 1's buff edits go through `setCharacter` rather than `updateBuffBox`. |
| `SheetPage2ActionsSkills.tsx` | Yes, page 2 and show-all | Skill matrix (ranks, class skill, misc), actions, resource pools, feats. |
| `SheetPage2SkillsGear.tsx` | **No imports.** | An older skills-plus-inventory-and-languages page. Dead. |
| `SheetPage3BioStorage.tsx` | Yes, page 3 and show-all | Scratchpad, bio sections, portraits, downtime capital, companions, and `StorageInventoryModule` (worn/stored/companion, currency, item buffs). It accepts `visibleModules` and does not use that prop. It does not edit `biography.*` or spells. |
| `SheetPage3SpellsBio.tsx` | Only as the conditions strip | The file also contains the spell matrix, spellbook, flat biography, `ProfileModule`, `NotesModule`, and a stat block, gated by `visibleModules`. The shell passes only `{ conditions: true }`, and that flag is never turned on. Those sections and `ProfileModule` / `NotesModule` do not appear in normal navigation. |
| `SheetPage4FormulaStudio.tsx` | Yes, tab 4 only | Macaroni objects, UI Make presets, vocabulary, SOT math suggestions. Embeds `MacroQuickGrabPanel`, which evaluates formulas and does not write the character. Omitted from show-all. |
| `BuffBoxModule.tsx` | Inline on page 1 and as a sidebar modal | Bonus matrix and custom buffs. The modal uses `updateBuffBox`. |
| `StorageInventoryModule.tsx` | Via page 3 | Inventory. Also opened from item image buttons into the file browser. |
| `PrintSheet.tsx` | Print view, `?readonly=1`, and the hidden print stylesheet | Read-only combat, actions, and bio from `useCharacter()`, with formula text evaluated for display. The print button calls `window.print()`. |
| `MacroQuickGrabPanel.tsx` | Page 4 | Read-only formula chips. |
| `ProfileModule.tsx`, `NotesModule.tsx` | Only inside the unmounted spells page | Avatar/custom fields, and rollup notes. Orphaned with that page. |

`ConditionDebuffBar` is the conditions UI inside `SheetPage3SpellsBio`. It calls `evaluateConditions` and lets the parent write `character.conditions`. Because the parent strip never opens, the bar does not either.
