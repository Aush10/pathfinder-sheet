# Handoff: Antigravity AG6 — Cast Popup, Spell Book & Run Stepper Wiring

**Status:** Complete
**Date:** 2026-11-24

## Work Done
- **AF8 Stepper & Non-Mutating Counter Engine Helpers (`src/engine/actionDirectory.ts`):**
  - Extended `evaluateDirectoryMacroValue` with optional `{ stepperStore, stepperScopeId }` forwarding to `executeMacaroni`.
  - Added `evaluateCounterDisplayValue(entry, character, derived)`: safely displays Counter macros containing `!` using persisted `character.macaroniStepperStore` steps (defaulting to `0` prior to first step) via a throwaway decremented `peekStore` so rendering NEVER increments `!` state.
  - Added `stepCounterBangAction(entry, character, derived)`: executes Counter `!` macros cleanly with `stepperScopeId: 'counter-' + entry.id` and returns the `MacaroniExecutionResult` for `projectMacaroniResult` projection.
  - Updated `stepResourceBarValue(entry, character, derived, options?)`: passes `stepperScopeId` (defaulting `spell-slot-action-<N>` / `spell-slot-level-<N>` to `spell-slot-<N>`, otherwise `resource-<id>`) and `stepperStore` directly to `executeMacaroni(...)` before regex/formula fallbacks, and returns `macaroniResult` (with `stepperSnapshots`) for persistent `!` resource/slot tracking.
- **Spell Cast Popup, Run Stepper & Spell Known/Remaining UI (`src/components/sheet/ActionDirectoryModule.tsx`):**
  - Exported pure helpers `executeSpellCastOnCharacter` and `executeCounterRunStepperOnCharacter`.
  - Added **Cast** button on every Spell card opening confirmation popup `"Cast <spell name> <spell level>?"` with **Yes**, **Cancel**, and **Alternate casting** (shown when Alt variations exist on the spell, letting the player toggle between primary spell and any Alt variation before confirming).
  - Casting levels `1–9` binds via AF8 `getSpellSlotCastBinding(character, spellLevel)`, runs `-1` or `!` slot steppers via `stepResourceBarValue`, projects any `!` snapshots via `projectMacaroniResult`, and keeps `characterActions`, `resourceTrackers`, and `spellSlots` (`usedSlots`) synchronized. Level `0` cantrips cast without spending slots.
  - Added **`Run Stepper`** button on Counter entries whose `totalCountMacro` includes `!`, persisting steps under `counter-<id>::bang-1`.
  - Added compact progression hint strip (`sk_<N>`, `spd_<N>` via AF8 `getPersistedSpellProgressionRow`) when viewing `spell-known-*` or `spell-known-remaining` (`SPELL_KNOWN_REMAINING_TAB_ID`) tabs without auto-populating empty `entryIds`.
- **Spell Book & Lookup-Table Reference UI (`src/components/tools/JournalModal.tsx`):**
  - Consumes AF8 `SPELL_BOOK_JOURNAL_TITLE` (`'Spell Book'`), `SPELL_BOOK_TAG`, and `characterHasStructuredCasting(character)` so the Journal header becomes `Spell Book` whenever Spell Book pages or `spellTables` exist while displaying all 9 blank level pages (`1st-level spells`..`9th-level spells`).
  - Loads ingested 4-output `table.json` artifacts (`loadSrdIngestArtifacts`) and displays `lookup-table` auxiliary tables cleanly in a **Reference Lookup Tables (Read-Only)** list and inline reader panel (no Matrix/sheet mutation).

## Files Created
- `pfautosheetv3/v3-staging/antigravity/AG6/spellcasting-ui.test.ts`
- `pfautosheetv3/v3-staging/handoffs/antigravity-AG6.md`

## Files Altered
- `src/engine/actionDirectory.ts`
- `src/components/sheet/ActionDirectoryModule.tsx`
- `src/components/tools/JournalModal.tsx`

## Verification
- `pfautosheetv3/v3-staging/antigravity/AG6/spellcasting-ui.test.ts` (via `esbuild` + `node`) -> `AG6 spellcasting UI & ActionDirectory verification passed.` (exit 0).
- `src/engine/actionDirectory.test.ts` (via `esbuild` + `node`) -> 7/7 subtests passed.
- `pfautosheetv3/v3-staging/afk/AF8/spellcasting-persist.test.ts` (via `esbuild` + `node`) -> 6/6 subtests passed.
- `src/engine/macaroni/macaroni.test.ts` (via `esbuild` + `node`) -> 12/12 subtests passed.
- `npm run lint` (`tsc --noEmit`) -> exit 0; `npm run build` (`vite build`) -> exit 0.

## Open Issues
- None.
