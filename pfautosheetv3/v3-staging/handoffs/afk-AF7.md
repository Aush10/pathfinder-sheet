# AF7 handoff — Promotion, wiring, and request resolution

## Work done

Phase 6 / AF7. Landed Codex/AFK staging is promoted into `src/` and `server/` (the `pfautosheetv3/` folder itself is not shipped). Imports are wired. Cross-scope handoff requests are resolved except `AICompanionModal.tsx` (Q7 / B8). AF6 installers were not started.

CX2 ingest was already in `server/ingest/`; staging vs promoted `ingest.ts` differed only in comments, so the promoted copy stayed. CX1 class extraction, CX3 Matrix engine, and CX7 spell-table adapter are now runtime modules. Add Class / Class Architect populate POSTs `/api/sot/ingest` and maps classified tables; a missing class-grid returns unmatched rows and does not synthesize a 1–20 prose grid.

## Files created

- `src/engine/classExtraction.ts` and `src/engine/classExtraction.test.ts`
- `src/engine/matrix/matrixEngine.ts`, `src/engine/matrix/matrixEngine.test.ts`, `src/engine/matrix/index.ts`
- `src/engine/srdHeaders.ts` — client-safe `normalizeHeader` (keeps `node:crypto` ingest out of the Vite bundle)
- `src/engine/spellTables.ts` and `src/engine/spellTables.test.ts`
- `src/engine/cx4.test.ts`
- `src/engine/macaroni/stepperPersistence.test.ts`
- `server/ingest/ingest.test.ts`
- `server/server-hygiene.test.ts`
- `src/utils/sheetExporters.test.ts`
- `src/storage/spellcasting-persist.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF7.md` — this handoff

## Files altered

- `src/engine/sotEngine.ts` — classified extract; `extractClassFromSrdDocWithIngest`; `exportSrdDocFileToHost` async through `writeOrDownloadExport`
- `src/engine/aiService.ts` — scoped `parseSrdSkillsAndProficiencies`; `getSessionApiKey` trio removed
- `src/data/defaultCharacter.ts` — empty `sotCatalogue` on `createBlankCharacter()`
- `src/storage/characterState.ts` — `persistSpellTablesFromIngest`
- `src/storage/fsAdapter.ts` — Connect reuses a stored handle (`requestPermission` in the click) and only picks when none exists
- `src/storage/fsAdapter.test.ts` — skip-picker / cancel-without-handle cases
- `src/components/tools/AddClassModal.tsx`, `ClassArchitectModal.tsx` — ingest extract + persist spell tables; drop API-key args
- `src/components/tools/JournalModal.tsx` — drop API-key args
- `src/components/storage/CrashRecoveryBanner.tsx`, `src/context/CharacterContext.tsx`, `src/App.tsx` — Restore / Keep named save (no `window.confirm`)
- `package.json` — `test` lists promoted `src/` / `server/` suites, not `pfautosheetv3/`

## Tests

Focused suites bundled with esbuild (tsx ENOMEM still known) all passed, including:

- classExtraction 4, matrix 7, spellTables 2, cx4 3, ingest 4
- AF4 hygiene 6, AF5 exports 6, AF8 persist 7, CX6 stepper 1
- macaroni 12, sotContext 8, fsAdapter 19
- ClassArchitectModal 4 plus existing sheet/tap/action/currency/openai/env suites

- `npm run lint` — green
- `npm run build` — green. Existing Vite `__dirname` and chunk-size warnings remain. Dynamic `sheetExporters` import from `sotEngine` is already in the main chunk via SaveButton/Loadout/CharacterContext.

## Adoption notes for AF6 / CP3 / remaining owners

1. **AF6** can start: installer/packager is the final implementation phase before CP3 (Decision 8).
2. **AG1** still owns `SOTPanel.tsx`. No Antigravity handoffs landed; AF7 did not invent that panel.
3. **AG3** should import `src/engine/matrix` (`deriveMatrix`, `migrateClassGrids`, `indexFromClassifiedTables`) and call `applyMatrixProgressionToCharacter` only from Apply.
4. **AG6** still owns Cast UI. Slot bars and Spell Book persist already exist (AF8).
5. **CX5** handoff was missing; buff-syntax was not invented.
6. **CP2** still owns gitignore/tsconfig exclude of `pfautosheetv3/`, orphan copy-then-delete, `npm run clean` (`rm -rf`), and docs (`STORAGE_TREE`, PROGRAM_MAP Gemini leftovers).
7. **`AICompanionModal.tsx`:** Load SRD / paste-lock still needs `POST /api/sot/ingest` + `ingestAndPersistSrdDocument`. Collect-after-ingest for the SOT UI stays blocked until that file is in scope. `exportSrdDocFileToHost` is already async; the existing `onClick={() => exportSrdDocFileToHost(page)}` is valid.
8. **`saveSrdDocForCharacter`** still writes full HTML into origin storage because the SOT UI rehydrates from those keys. Stripping bodies would empty the off-limits modal until ingest artifacts are the read path.

## Botjot §4 (this filesscope)

- Gemini session-key leftovers removed from `aiService` and Add Class / Class Architect / Journal.
- Blank factory `sotCatalogue` is empty; CX4 demo Slayer path stays unused.
- `macaroni.test.ts` is in `package.json` `test`.
- Fetch allowlist, Express 4 SPA fallback, and PORT/EADDRINUSE already landed in AF4.
- Orphans, installer mismatch, and `rm -rf` clean remain Copilot / AF6.

## Do not include secrets

None written.
