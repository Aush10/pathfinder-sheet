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

`npm test` on this map's run: **48 passed, 1 skipped, 0 failed** (49 total).

| File | What it locks |
| --- | --- |
| `server/env.test.ts` | `.env` vs `.env.local` vs inherited env; production does not let `.env.local` override. |
| `server/openai.test.ts` | Chat completions URL, model fallback, no provider switch on a key error, model read after env load. |
| `src/components/tools/ClassArchitectModal.test.ts` | Progression-grid parse and a 1–20 skeleton. The modal is not mounted. |
| `src/engine/sheetFieldWrites.test.ts` | Class-skill toggles, feats/inventory/journal rows, class/HD/grid writes, pasted SOT grids, point-buy budget and random gates, blind spots, secret-like keys. |
| `src/engine/tapTest.test.ts` | The literal command, per-step allowlists, and that `completeSheetConverse` drops off-stage writes. Uses a fake fetch. |
| `src/storage/fsAdapter.test.ts` | Name sanitizing, envelope round trip, reserved names, checksum and prototype rejection, unsafe roots, picker error codes, empty-folder Connect, corrupt Crash, real temp-directory Connect. The Windows reserved-name case is skipped unless `process.platform === 'win32'`. |

Not covered: `pf1eMath`, Macaroni, `multiclassCalculator`, React rendering, the AI modal, `?readonly=1`, and the stale-crash versus newer-save cases from the diagnosis. Storage tests use a fake handle whose permission is always `granted`, except where they throw from the picker. `npm run lint` (`tsc --noEmit`) and `npm run build` both exited 0 on this run. The release workflow typechecks and packages; it does not run `npm test`.

## Debris and naming

Present at the repo root and not imported by `server.ts` or `src/main.tsx`:

| Path | Approx size | Role |
| --- | --- | --- |
| `pathfinder-1e-modular-workspace.zip` | 53 MB | Archived workspace snapshot. Not referenced by the installer scripts. |
| `sot-ai-complete-sheet.bundle` | 1.8 MB | A bundled artifact. The running client is Vite's graph from `src/`, not this file. |
| `default_sheet.json` | 20 KB | Imported by `defaultCharacter.ts` as the Valerius demo. This one is live. |
| `New_Adventurer_pf1e_sheet.json` | 19 KB | Sample sheet. Not imported by `src/`. |
| `save tree test/` | small | `Valerius_the_Fireborn_pf1e_sheet.json` and `armorist.srd.json`. Not read by the adapter tests. |
| `public/pathfinder_sheet_latest.zip` | — | Linked from the sidebar as a download. Separate from `dist/pf1mw-runtime.zip`. |
| `public/pathfinder1e_standalone.html` | — | Output of `build:standalone`, fetched by the HTML exporter. |
| `character-sheet-icons/` and `public/character-sheet-icons/` | — | Two copies. The packager and local installer read `public/`. |
| `bun.lock` next to `package-lock.json` | — | npm is what `package.json` and the release workflow use (`npm ci`). |
| `tmp-tsc.ps1` | — | A local typecheck helper, not a package script. |
| `Attached Element Context from Integrated.txt` and the `Integrated2` / `Integrated3` siblings | about 4 KB each | Pasted notes. Not imported. |
| `.aistudio/` | — | Studio leftovers. |
| `AI_THEORY_AND_ROADMAP.md`, `CHANGELOG_FOR_ANTIGRAVITY.md`, `HOSTING_AND_SHARING.md` | — | Notes. Not loaded at runtime. |

Naming that no longer matches the code:

- Package name `react-example`.
- `/api/gemini/*` routes call OpenAI.
- `getSessionApiKey` implies a browser key. It returns an empty string (`src/engine/aiService.ts` 37–38).
- Sidebar label "All 3 Pages" while four sheet tabs exist.
- `ClassArchitectModal` is a second class UI beside `AddClassModal`, with tests and no mount point.
- `SheetPage2SkillsGear` and `SheetPage3SpellsBio` read as the live page 2 and page 3. The shell uses `SheetPage2ActionsSkills` and `SheetPage3BioStorage`.
