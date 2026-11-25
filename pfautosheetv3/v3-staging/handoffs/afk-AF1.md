# AF1 handoff — Save path and storage correctness

## Work done

Phase 1 / AF1 (B1, B2, B9, I1, I2, B4). Named saves win. Crash recovery only applies when it is the same `characterId` and newer, and then only after a confirm. Autosave is a serialized queue with a 2.5s debounce. Crash writes skip projections after the first crash snapshot exists. Host SRDs are scoped per character. Blank sheets get an empty `sotCatalogue`. Quota errors on the session cache are toasted instead of swallowed.

B1 fixture used: `<user-home>\Documents\test folder\pfautotest4\AIgamesheet\pfmusers\Crash\character.json` (Control / aush, all ability bases 0, savedAt 2026-11-24T08:57:10.375Z). Healthy comparison: `pfmodulartest` Crash Thorne 15 / 14 / 12 / 10 / 8 / 10.

## Files altered

- `src/storage/characterState.ts` — crash preference, serialized write queue, empty SOT on normalize/blank, restore asks for newer same-id crash, matching crash is dismissed.
- `src/storage/fsAdapter.ts` — write lock, crash does not reuse a leftover Crash folder id, Save refreshes Crash with the named id, crash skips projections when a snapshot already exists, SRD bodies are referenced instead of embedded when host storage works.
- `src/storage/useAutosave.ts` — 2500ms debounce plus the serialized queue.
- `src/storage/connectFolder.ts` — restore only when `active.json` exists; leftover Crash is dropped before inspecting the collection.
- `src/context/CharacterContext.tsx` — persist-effect quota toasts, confirm before applying pending crash, dismiss reloads the named save, New Sheet uses empty SOT and a new host-SRD owner.
- `src/engine/sotEngine.ts` — per-character host SRD keys, `loadHostSrdDocsForCharacter` / `saveSrdDocForCharacter` for AG3, `referenceSrdPagesForStorage` / `rehydrateSrdPagesFromHost`. Unscoped `pf1e_host_srd_index_v1` is no longer read as authority.

## Files created

- `pfautosheetv3/v3-staging/afk/AF1/crash-preference.test.ts`
- `pfautosheetv3/v3-staging/afk/AF1/host-srd-scope.test.ts`
- `pfautosheetv3/v3-staging/afk/AF1/restore-and-save.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF1.md`

## Tests

- `npm test` — 60 passed, 0 failed, 0 skipped.
- `npx tsx --test src/storage/fsAdapter.test.ts pfautosheetv3/v3-staging/afk/AF1/*.test.ts` — 34 passed (includes the 16 AF1 staging tests and the Windows temp-folder test).
- `npm run lint` — green.
- `npm run build` — green.

Staging tests are not in `package.json` `test` (Copilot owns that file). AF7 should add them or promote them next to `src/storage/fsAdapter.test.ts`.

## Open issues and requests

1. **`src/data/defaultCharacter.ts` (B4 remainder):** `createBlankCharacter()` still omits `sotCatalogue`. AF1 covers New Sheet via `blankCharacterWithEmptySot()` and `normalizeCharacter`. Please add an empty catalogue on the factory itself so other callers stop falling through to `DEFAULT_SOT_CATALOGUE`.
2. **`src/storage/StorageContext.tsx`, `src/storage/types.ts`, `src/storage/stubAdapter.ts`, `src/components/storage/SaveButton.tsx`, `src/components/storage/IdentityLoadFields.tsx`:** Connect/Open still always call `showDirectoryPicker`. Existing `fsAdapter.test.ts` "cancelling Connect" seeds a stored handle and expects the picker to run, so AF1 did not skip the picker. After that test is updated, Connect should `requestPermission` on the stored handle in the click and only pick when there is no handle. Treat `prompt` as "needs a gesture", not disconnected.
3. **`src/components/storage/CrashRecoveryBanner.tsx` and `src/App.tsx`:** Startup currently uses `window.confirm` because the banner only has Dismiss. A Restore / Keep named-save pair would match the spec better.
4. **`docs/STORAGE_TREE.md` (Copilot):** Crash snapshots now skip projection rewrites after the first file exists. Host SRDs are per-character session keys, not a global index. Please update the tree doc.
5. **`src/engine/characterIntegration.ts`:** `loadInitialCharacterState` still boots from `localStorage`. With a granted folder the persist effect then restores from the tree. A later pass can stop treating that key as startup authority.
6. **AF2:** migrate leftover `pf1e_host_srd_doc_*` / `pf1e_host_srd_index_v1` once (exported as `LEGACY_GLOBAL_HOST_SRD_*`). AF1 does not attach those globals to a new sheet. Persist ingest outputs under `<character>\SRD\<doc>\`.
7. **`exportSrdDocFileToHost`:** still a browser download. Out of AF1 scope; AF5 / `sotEngine.ts` request as already noted in the packet.
8. **Images:** still data URLs in `character.json`. Diagnosis step 4 image sidecars were not started (ingest round-trip is AF2).
9. **Browser close/reopen with File System Access:** not exercised here (no folder-picker automation). Adapter restore cases are covered in staging tests.

## Do not include secrets

None written.
