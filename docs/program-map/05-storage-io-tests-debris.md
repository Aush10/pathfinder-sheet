# 5. Storage, import/export, tests, and debris

## Storage

The close/reopen failure modes are written up in [../SAVE_STATE_DIAGNOSIS.md](../SAVE_STATE_DIAGNOSIS.md). That diagnosis is still accurate for startup priority, crash-versus-named-save, permission `prompt`, SRD files, and images. Read it for those. This section is the code that exists now, including the Connect work that landed after the diagnosis.

`docs/CODEX_SAVE_PATH_WORKFLOW.md` is an implementation brief. It restates the diagnosis and lists repair steps. It is not a description of finished behavior. `docs/STORAGE_TREE.md` matches the directories `writeCharacterTree` creates. It does not describe `localStorage` or Connect.

### Three copies

1. React state, initialized from `localStorage` `pf1e_character_data_v1` (`loadInitialCharacterState`).
2. That same `localStorage` key, rewritten on every edit. Failures are swallowed (`CharacterContext` persist effect).
3. The File System Access tree under the picked folder's `AIgamesheet/` directory, when `queryPermission` is already `granted`. IndexedDB database `pf1e-folder-storage` stores the directory handle only.

The safe adapter in `src/storage/StorageContext.tsx` still returns an empty success for crash load, active character, list, and load when permission is not `granted`. Startup restore therefore does not read the tree after a browser restart until something has already granted permission.

### Connect and Save, as of this tree

`connectSheetToFolder` (`src/storage/connectFolder.ts` 14–69), used by the header Connect button:

1. `pickFolderAndOpen()` runs before any other await in that function. Cancelling the picker returns `PICKER_CANCELLED` and writes nothing (`fsAdapter.ts` `toFailure` maps `AbortError` from the picker).
2. If Crash or `active.json` is present, it calls `restoreSheetFromStorage` and returns that character. The on-screen sheet is replaced. The current unsaved sheet is not written.
3. If there is no active pointer but some character folders exist, it returns `connected` and does not write.
4. If the tree has no characters, it crash-saves the current sheet. If the name is non-empty it also `saveCharacter`s it, so the new `character.json` and `Crash/character.json` share a checksum (covered by `src/storage/fsAdapter.test.ts`, "connecting an empty folder immediately saves...").

Save, when the header does not consider the folder connected, calls `pickFolderAndOpen` and then `saveCharacter` of the **current** sheet (`SaveButton.tsx` 160–177). It does not restore over the sheet being saved. When the folder is already connected, Save only calls `saveCharacter`.

`saveCharacter` still does not update or clear Crash (`fsAdapter.ts` `saveCharacter`, about 1083–1108). `restoreSheetFromStorage` (`characterState.ts` 164–194) still prefers Crash whenever the checksums differ, including a crash of a different character. The comment on that function says so. The three cases in the diagnosis are unchanged.

`pickFolderAndOpen` still always calls `showDirectoryPicker`. It does not call `requestPermission` on the IndexedDB handle before awaiting. `requestPermission` still happens later inside `selectedHandle`, after an IndexedDB read when the in-memory handle is empty (`fsAdapter.ts` `ensureReadWritePermission` and `selectedHandle`).

Remembering the handle is now best-effort. A quota error on IndexedDB leaves the folder usable for the session and sets a status message (`pickFolderAndOpen` 1053–1060, test "keeps the selected folder usable...").

### What the tree contains

`character.json` is the character envelope (format, schema 1, sha256, `characterId`, `data`). Projections (index CSV, printable HTML, image manifest, DSL, notebook, tools, modules, READMEs) are rewritten from that object and are not read back. `SRD/README.txt` is the only SRD write. Image pixels are data URLs inside the character and in `pf1e_image_library_v1`, duplicated as URL strings in `images/manifest.json`. Each file is capped at 5 MiB. Player and character folder names are sanitized to 60 characters; `settings`, `dsl`, `backups`, and `Crash` are reserved.

`?stub=1` uses `src/storage/stubAdapter.ts`, an in-memory fake with Valerius, Seraphina, Kaelen, and Lyra. It is for UI clicks, not the folder format.

## Import, export, print

`src/utils/sheetExporters.ts`:

| Function | Behavior | Called from |
| --- | --- | --- |
| `exportStandaloneHTMLBundle` | Fetches `/pathfinder1e_standalone.html`, injects `window.__INITIAL_CHARACTER__` and `__INITIAL_LAYOUT__`, downloads one HTML file | Sidebar via context |
| `exportCharacterJSON` | Downloads the live character JSON | Sidebar, `NewSheetModal` backup, `SaveButton` |
| `importCharacterJSONFile` | File input, `normalizeCharacterState`, `setCharacter` | Sidebar |
| `exportCharacterCSV` | Identity and derived totals as CSV | Sidebar, `LoadoutModal` |

`PrintSheet` is the print layout. In-app print sets `isPrintViewOpen`. Native print hits the hidden `print:block` copy. Neither produces a PDF; the print control calls `window.print()`.

Standalone HTML has no Express API. AI buttons in that file call back to whatever origin served it, or fail.

## Tests

`npm test` runs the checked-in storage, engine, UI-adapter, and server suites
from the script in `package.json`.

| File | What it locks |
| --- | --- |
| `server/env.test.ts` | `.env` vs `.env.local` vs inherited env; production does not let `.env.local` override. |
| `server/openai.test.ts` | Chat completions URL, model fallback, no provider switch on a key error, model read after env load. |
| `src/components/tools/ClassArchitectModal.test.ts` | Progression-grid parse and a 1–20 skeleton for the mounted Add Class tool. |
| `src/engine/sheetFieldWrites.test.ts` | Class-skill toggles, feats/inventory/journal rows, class/HD/grid writes, pasted SOT grids, point-buy budget and random gates, blind spots, secret-like keys. |
| `src/engine/tapTest.test.ts` | The literal command, per-step allowlists, and that `completeSheetConverse` drops off-stage writes. Uses a fake fetch. |
| `src/storage/fsAdapter.test.ts` | Name sanitizing, envelope round trip, reserved names, checksum and prototype rejection, unsafe roots, picker error codes, empty-folder Connect, corrupt Crash, real temp-directory Connect. The Windows reserved-name case is skipped unless `process.platform === 'win32'`. |

Coverage includes Macaroni/stepper persistence, matrix behavior, deterministic
ingest, SOT retrieval, currency, and server hygiene. `npm run lint` runs
`tsc --noEmit`; `npm run build` runs Vite. The release workflow type-checks and
packages the runtime but does not replace the local `npm test` gate.

## Debris and naming

Live non-code assets include `default_sheet.json`, the character fixtures under
`save tree test/`, the packaged download in
`public/pathfinder_sheet_latest.zip`, and `public/character-sheet-icons/`.
`public/pathfinder1e_standalone.html` is generated by `build:standalone` and is
therefore expected only after that build runs.

CP2 archives superseded root notes and removes the duplicate icon tree, old
workspace ZIP/bundle, `bun.lock`, local typecheck helper, duplicate browser
context dumps, and approved orphaned component sources. The removed sources are
preserved in the external CP2 archive noted in the handoff.

Known naming drift:

- The package and lockfile use `pathfinder-1e-modular-workspace` version
  `1.3.0`.
- `getSessionApiKey` implies a browser key, but it returns an empty string;
  `OPENAI_API_KEY` belongs to the server environment.
- The sidebar label "All 3 Pages" does not describe the fourth Formula Studio
  tab.
