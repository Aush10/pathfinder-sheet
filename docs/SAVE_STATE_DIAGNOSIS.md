# Save-state diagnosis

Examination only. No ingest pipeline, no Complete Sheet changes, and no storage-behavior patch in this pass.

Supermemory was unavailable, so this is from the repo, the storage tests, and a throwaway adapter reproduction. The Copilot handoff describes the intended local-first model. `docs/STORAGE_TREE.md` describes the adapter that was actually built. Those two documents do not describe the same system, and the running app matches neither one completely.

## 1. Intended model vs what the code does

Intended (handoff): the user-selected `AIgamesheet` tree is the durable copy. `character.json`, local SRD/source files, and local image files live there. Indexes and manifests are rebuildable. The browser holds the File System Access permission. A local server may cache a session, then rehydrate from that tree and write back through the browser. The server never opens the picked folder.

What exists today is three stores, and the folder is not the one the app trusts on startup.

| Store | What it actually keeps | Who reads it on startup |
| --- | --- | --- |
| React state | The live sheet, including `sotCatalogue` and data-URL images | Replaced by whichever store wins below |
| `localStorage` (`pf1e_character_data_v1`, `pf1e_host_srd_doc_*`, `pf1e_image_library_v1`) | A second full character, a second copy of each SRD, and up to 30 image data URLs | First. `loadInitialCharacterState` in `src/engine/characterIntegration.ts` |
| IndexedDB `pf1e-folder-storage` | Only the directory handle, not the character | Used to remember the folder |
| `AIgamesheet/` via the File System Access adapter | `character.json` plus projections | Only if `queryPermission` is already `granted` |

`CharacterProvider` initializes from `localStorage`, then calls `restoreSheetFromStorage`. The safe adapter around load, crash load, and active-character lookup returns empty success when permission is anything other than `granted` (`src/storage/StorageContext.tsx`). A cold start therefore paints the browser cache and does not read the tree.

There is no server character session. `server/routes.ts` formats SOT text from the request body through `formatCompleteSheetOverridePages` in `server/sotContext.ts`. That full-text-per-request path is real, and it is the later integration problem named in the handoff. It is not why local save/load fails. The server never reads or writes the picked folder.

## 2. What is broken

### Folder round trip of character JSON can work, and the product path still drops it

`createFsStorageAdapter` writes an envelope to `pfmusers/{player}/{character}/character.json`, verifies the temp file, and can load it back. `src/storage/fsAdapter.test.ts` covers that with an in-memory handle whose permission is hard-coded to `granted`. A second adapter pointed at the same handle store also loaded the saved character in a throwaway script.

That is not the close/reopen path the UI uses.

- Connect and Open call `pickFolderAndOpen`, which always calls `showDirectoryPicker`. They never call `requestPermission` on the handle already stored in IndexedDB (`SaveButton.tsx`, `IdentityLoadFields.tsx`, `fsAdapter.ts` `pickFolderAndOpen`).
- The header treats the folder as connected only when `selected && permission === 'granted'`. A stored handle whose permission is `prompt` looks disconnected.
- With a handle whose `queryPermission` and `requestPermission` both return `prompt`, `getStatus` reports `selected: true, permission: 'prompt'` and `saveCharacter` returns `PERMISSION_DENIED`.
- `saveCharacter` will ask for permission, but only after `selectedHandle` awaits IndexedDB when the in-memory handle is empty. This run did not execute that in Chrome. The File System Access user-gesture rule means a prompt after that await may never appear. Startup restore does not try.

So after a browser restart the usual result is: the sheet comes back from `localStorage` if that write fit, the folder sits unread until the user picks it again, and picking it then runs `restoreSheetFromStorage`, which can replace the on-screen sheet.

### Crash recovery can discard a newer deliberate save

`saveCharacter` updates the named character folder and `active.json`. It does not update or clear `pfmusers/Crash/`. `restoreSheetFromStorage` loads the active character, then **prefers Crash whenever the checksums differ**. It does not compare `savedAt`, and it does not require the crash character to be the active character.

Reproduced against the real adapter and `restoreSheetFromStorage`:

- Autosave "older crash notes", then save "deliberate save notes". Restore returned the older notes with `recoveredFromCrash: true`.
- Autosave and save of the same bytes. Restore returned that save with `recoveredFromCrash: false`. The equal-hash path works.
- Save character `Other` while Crash still held `Hero`. Restore returned `Hero`.

`useAutosave` waits one second and skips the first render, so a save immediately after an edit, a save of a different character, or a close before the timer fires leaves Crash older or unrelated. Dismiss archives `Crash/character.json` and hides the banner. It does not reload the named save. The stale sheet stays on screen, `localStorage` copies it, and the next explicit save can overwrite the good `character.json`.

### Session cache is durable, and the tree is optional

Every character change writes `pf1e_character_data_v1`. Quota failures are swallowed in `CharacterContext`. Folder autosave failures are swallowed when permission is not `granted`, and toasted when it is. The two copies diverge whenever a folder write fails, a crash snapshot wins, or the user edits before connect finishes. Connecting a folder afterwards overwrites the screen with crash-or-folder data.

`localStorage` is origin storage for this site. It is not the `AIgamesheet` directory, and clearing site data deletes it without touching the folder.

### SRD and image "files" are not files in the tree

On save, `writeCharacterTree` creates `SRD/` and writes only `SRD/README.txt` ("Reserved for locally saved SRD references"). Nothing reads that directory. A save whose `sotCatalogue.overridePages` contained a Slayer page left `SRD/` as `[README.txt]` while the HTML lived inside `character.json`.

The UI copy that says a SRD was "saved separately on host device" calls `saveSrdDocToHostDeviceStorage` (`src/engine/sotEngine.ts`). That writes `localStorage` keys `pf1e_host_srd_doc_{id}` plus `pf1e_host_srd_index_v1`. Failures are caught, logged, and returned as `''`. The success notice still shows. "Sync Host SRDs" reads those keys, not the folder. "Save this SRD separately as a file" uses an `<a download>` into the browser download folder, not `SRD/`.

Imported and pasted SRDs are also pushed into `character.sotCatalogue`, so the same document is inline in the character, in the character `localStorage` blob, and in the host-SRD keys. `character.json` and every projection are capped at 5 MiB (`MAX_FILE_BYTES`). A save whose notes were 5 MiB of `x` returned `FILE_TOO_LARGE` and left the previous `character.json` in place. Full class-page HTML plus a duplicated `plainText`, times a few documents, crosses that cap. Crash autosave writes the same envelope, so it fails the same way and, once permission is granted, toasts on each debounced edit.

Images follow the same pattern. Uploads become `FileReader.readAsDataURL` strings. Crops become `canvas.toDataURL('image/png')`. Those strings are stored on the character (so they ride inside `character.json`) and in `pf1e_image_library_v1` (max 30). The folder receives `images/manifest.json`, a JSON projection of the URL strings. The adapter never writes an image byte file, and load never reads the manifest (`docs/STORAGE_TREE.md` says projections are not read). `blob:` URLs die on reload. Large data URLs compete with SRD text for the same 5 MiB character budget and the same `localStorage` quota.

`PF1Character.memoryBank` comments say it is mirrored to `AI/memory/manifest.json`. No writer creates that file. Save only refreshes `AI/README.txt` and regenerates `AI/read_only/README.txt`.

### Partial projection write

`saveCharacter` writes player DSL projections, then `writeCharacterTree` writes image, DSL, notebook, tools, and module projections, and only then `character.json`. A late `FILE_TOO_LARGE` on the character envelope leaves those projections ahead of the authoritative file. Load ignores them, so the screen stays on the old character, but the tree is no longer a clean snapshot of that character.

## 3. Why SRD artifacts cannot go up from local yet

There is no folder API for them.

- `StorageAdapter` can save a character, crash-save, list, and load. It cannot write or read an original under `SRD/` or an image under `images/`.
- The only SRD write is the README placeholder.
- The player-visible original currently lives in `sotCatalogue` inside the character object. That object is duplicated into `localStorage` and rejected by the folder once the envelope exceeds 5 MiB.
- Generated manifests are defined as non-authoritative and are not loaded. Putting an ingest index only in that projection style would make it disposable, which is fine, but there is still no durable original beside it to rebuild from.
- Startup will not see a newly written tree file until permission is already `granted`, and a stale Crash snapshot can hide the character that the artifact was written next to.
- The server cannot be given the directory handle, and it has no rehydrate path from the tree. A session copy of an SRD would be another cache with no way back.

Until originals round-trip in the picked folder without depending on `localStorage`, an ingest index has nowhere trustworthy to sit and nothing stable to rebuild from.

## 4. Repair order before ingest

Do these in order. Do not start the Brief 1 ingest until the round trip in step 4 is tested.

1. **Make the named save win.** On a successful `saveCharacter`, write the committed snapshot over Crash or remove Crash so the checksums match. Change `restoreSheetFromStorage` so an older crash, or a crash of a different character, cannot replace a newer `active.json` character. Dismiss must not be the only way to get the deliberate save back. Test the three cases reproduced above: stale crash, equal bytes, cross-character.
2. **Reattach the stored handle on a user gesture.** If IndexedDB has a handle, Connect and Open should call `requestPermission` in that click, before any await, and only open the directory picker when there is no handle. Treat `prompt` as "needs a gesture", not as "no folder". Do not read or write the tree from `useEffect` while permission is `prompt`; after the gesture, rehydrate from the tree before showing browser-cached edits as saved.
3. **Demote `localStorage` to a volatile session cache.** Stop treating `pf1e_character_data_v1`, `pf1e_host_srd_doc_*`, and `pf1e_image_library_v1` as the host copy. Surface quota errors. After a granted folder is open, rebuild the screen from the tree and write subsequent edits back through the adapter.
4. **Add real sidecar reads and writes.** Persist SRD originals (HTML, Markdown, text, exported `.srd.json`) under the character `SRD/` directory, and image bytes under `images/`, with relative references in `character.json`. Keep the 5 MiB guard for each file, but stop inlining whole SRDs and data URLs into the one character envelope. Load those files on open. Leave `character.json` as the character record, not the document blob. Keep generated indexes as separate, rebuildable files and do not load the character from them.
5. **Then** add the deterministic ingest artifacts beside those originals. `server/sotContext.ts` stays a full-text formatter until a later brief swaps the request path.

Steps 1–3 are character-JSON close/reopen. Step 4 is the missing SRD and image path. Step 5 is Brief 1, which this run did not start.

## 5. Tests run

`npm test` (`tsx --test src/storage/fsAdapter.test.ts src/engine/sheetFieldWrites.test.ts`): 13 passed, 1 skipped, 0 failed.

The skip is `uses a real Windows temp folder...`, gated on `process.platform === 'win32'`. This environment is Linux, so the only on-disk File System Access stand-in never ran. The passing storage test uses a fake handle that always returns `granted`. It does not cover `restoreSheetFromStorage`, permission `prompt`, SRD sidecars, or image files.

The stale-crash, SRD-directory, oversize, and `prompt` results above were from a throwaway script against `createFsStorageAdapter` and `restoreSheetFromStorage`. That script was not added to the suite.
