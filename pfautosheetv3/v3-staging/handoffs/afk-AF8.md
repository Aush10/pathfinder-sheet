# AF8 handoff — Spell-data, Spell Book, and stepper-button wiring

## Work done

Phase 5 / AF8 (Decision 3). CX7's structured Spells per day / Spells known records now survive save/load through `normalizeCharacter`. Hostile keys are stripped, columns must be `spd_*` / `sk_*`, and rows are padded to 20. When those tables are present, a reload also keeps:

- nine blank Spell Book journal pages (`spell-book-1` … `spell-book-9`, tag `spell-book`) without wiping other journal entries
- resource bars named `<level> level spell slots`, value from the current class-level row, stepper `-1`
- Cast bindings (`getSpellSlotCastBinding`) pointing at those bars; an assigned `!` stepper seeds `spell-slot-<level>::bang-1` in `macaroniStepperStore` and does not reset an existing count
- known-spell Action Directory tabs for levels that have a count, plus `Remaining spells` (empty `entryIds` so AG6/the player fill actions)

Complete Sheet gets a deterministic, non-SOT summary of the current-level row via `formatSpellTablesForCompleteSheet`. No model call. Existing saves without `spellTables` stay valid.

CX7's adapter was not copied into `src/` (no AF8 path exception). Call `collectSpellProgressionTables()` from staging (CX3) or after AF7 promotion, then `persistCollectedSpellTables()`.

## Files altered

- `src/storage/characterState.ts` — spell-table normalize/persist, Spell Book pages, slot-bar / tab / stepper wiring, Complete Sheet / Add Class readers.
- `src/engine/aiService.ts` — read-only: append structured spell-table facts to the Complete Sheet character summary.

## Files created

- `pfautosheetv3/v3-staging/afk/AF8/spellcasting-persist.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF8.md`

## Tests

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF8\spellcasting-persist.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af8-persist.test.cjs
node $env:TEMP\af8-persist.test.cjs
```

- 6 passed, 0 failed (legacy save, hostile-key normalize, spent-slot round-trip, stepper `-1` + tabs, `!` store preserved, CX7 collect → persist → Complete Sheet read).
- `npm run lint` — green.
- `npm run build` — green. Existing Vite `__dirname` and chunk-size warnings remain.

## Persist hooks for AG6 / CX3

```ts
persistCollectedSpellTables(character, tables) // after CX7 collect
getPersistedSpellProgressionRow(character, 'spells-per-day' | 'spells-known', level)
getSpellSlotCastBinding(character, spellLevel) // { actionId, resourceId, stepperMacro, stepperScopeId, bangIds }
SPELL_BOOK_JOURNAL_TITLE // 'Spell Book'
```

AG6 should:

- Show the Journal heading as `SPELL_BOOK_JOURNAL_TITLE` when any journal entry has tag `spell-book`.
- Wire Cast / Run Stepper to `getSpellSlotCastBinding`. For `!` macros, pass `stepperScopeId` and `character.macaroniStepperStore` into `executeMacaroni`, then `projectMacaroniResult`.
- Leave known-spell tab `entryIds` blank for the player.

CX3 should keep using `toSpellProgressionMatrix()` / `getSpellProgressionRow()` on the staging adapter (or the persisted readers above). Do not scrape `text.md`.

## Open issues and requests

1. **Promote `codex/CX7/spellTables.ts` into `src/engine/` (AF7, or an Austin-granted AF8 exception).** `src` must not import `pfautosheetv3/`. Ingest → collect still needs a caller.
2. **`AICompanionModal.tsx` (off-limits):** after `ingestAndPersistSrdDocument`, collect tables and call `persistCollectedSpellTables`. Until then, Add Class / a later owner must attach tables.
3. **`JournalModal.tsx` (AG6):** still titled “Session Journal”. Persist hooks are ready.
4. **`ActionDirectoryModule.tsx` (AG6):** Cast / Run Stepper UI. `stepResourceBarValue` still does not pass `stepperStore` / `stepperScopeId` into `executeMacaroni`; AG6 should do that when the stepper contains `!`.
5. **`package.json` (Copilot / AF7):** add `pfautosheetv3/v3-staging/afk/AF8/*.test.ts`.
6. **AF5:** keep `spellTables`, Spell Book pages, slot-bar ids, and `macaroniStepperStore` keys. AF8 landed first on `characterState.ts`.
7. **No extra save-tree sidecar.** `character.json` is source of truth; the four SRD ingest files stay as they are.

## Do not include secrets

None written.
