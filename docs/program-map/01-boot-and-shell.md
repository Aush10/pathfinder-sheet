# 1. Boot, server, installer, and shell

## Process entry

`package.json` names the package `react-example` at version `0.0.0`. `dev` and `start` are the same command: `node --experimental-strip-types server.ts`. Neither script sets `NODE_ENV`, so `server.ts` takes the Vite branch.

`server.ts` 6–40:

1. `loadServerEnvironment(__dirname)` loads `.env` with `override: false`, then `.env.local`, which overrides only when `NODE_ENV !== 'production'` (`server/env.ts` 6–15).
2. Express listens on **3000**, bound to `0.0.0.0`.
3. Middleware order: lock-file MIME registration, `lockFileMiddleware`, `express.json({ limit: '10mb' })`, `registerApiRoutes`, then either Vite or static files.

`server/lockFiles.ts` forces `Content-Type: text/plain` for paths ending in `.lock`. The comment says AI Studio polls sibling lock files. The repo's `bun.lock` is a package-manager file, not one of those poll files. The same middleware is installed again as the Vite plugin `serve-lock-files` (`vite.config.ts` 13–17).

Non-production uses Vite `middlewareMode` and `appType: 'spa'`. Production serves `dist/` and falls through `app.get('*all', ...)` to `dist/index.html` (`server.ts` 23–34). `npm run build` writes that `dist/`. `npm run preview` is Vite's own preview server, not `server.ts`, so it does not mount the API.

Vite aliases `@` to the repo root. HMR and file watching turn off when `DISABLE_HMR=true` (`vite.config.ts` 25–30). `index.html` mounts `#root` from `/src/main.tsx` and loads Cinzel, JetBrains Mono, and Plus Jakarta Sans.

`.env.example` lists `APP_URL`. No TypeScript file reads it. The variables the server actually reads are `OPENAI_API_KEY`, `OPENAI_MODEL`, `NODE_ENV`, and, for Vite only, `DISABLE_HMR`.

## Client boot

`src/main.tsx` 81–94 reuses the React root across Vite HMR, then renders:

`RootErrorBoundary` → `StorageProvider` → `CharacterProvider` → `App`

The error boundary's reset deletes `pf1e_character_data_v1` and `pf1e_workspace_layout_v1` and reloads (`src/main.tsx` 31–38). It does not clear IndexedDB or the folder tree.

`App` (`src/App.tsx` 520–535) treats `?readonly=1` or a `readOnly` prop as print-only mode and returns `PrintSheet`. It also wraps a second `CharacterProvider` with `isReadOnly` when no context exists. On the normal boot, `main.tsx` already provided context, so that inner provider never mounts. `?readonly=1` therefore shows the print sheet while the outer provider still runs folder restore and crash autosave (`src/context/CharacterContext.tsx` 145–155). `?stub=1` selects the in-memory storage adapter (`src/storage/StorageContext.tsx` 17–19).

## Shell

`WorkspaceShell` owns modal visibility in React state (`src/App.tsx` 68–94). Escape or Ctrl+X closes most tools (`123–142`). It does not close Macro Debug or the print view. There is no Ctrl+P listener. A hidden `PrintSheet` uses `print:block` so the browser print dialog can still print (`239–242`). The comment above that div mentions Ctrl+P; the handler does not.

Themes (`204–215`): `parchment` (default), `blueprint`, `mythweavers`, `print`. Blueprint and myth-weavers add the `dark` class. Fonts (`190–201`): `sans`, `times`, `cinzel`, `mono`. The sidebar writes `layout.theme`, `layout.font`, `layout.glyphStyle`, `layout.activeSheet`, and `layout.showAllSheets` (`src/components/workspace/BlueprintSidebar.tsx` 123–269). The "All 3 Pages" toggle renders pages 1–3 only (`src/App.tsx` 295–329`). Page 4 is a fourth tab and is omitted from show-all.

| `activeSheet` | Component |
| --- | --- |
| 1 | `SheetPage1Core` |
| 2 | `SheetPage2ActionsSkills` |
| 3 | `SheetPage3BioStorage` |
| 4 | `SheetPage4FormulaStudio` |

`SheetPage3SpellsBio` renders only while `isConditionsOpen` is true, and only with `visibleModules={{ conditions: true }}` (`286–292`). `BlueprintSidebar` accepts `onOpenConditions` and `onOpenDiceRoller` and never calls them (`67–69` versus the rest of that file). Nothing else sets `isConditionsOpen`, so the conditions strip does not open. Dice still opens from sheet roll buttons through `handleRollFormula` (`172–176`).

`isQuickHPOpen` is only ever set to false (`73`, `128`, `386`). `QuickHPBar` is mounted and unreachable.

`QuickModularTools` is rendered by page 1 (`src/components/sheet/SheetPage1Core.tsx` around the turn-stepper module) and then hidden by `.pf1-hidden-turn-stepper { display: none !important; }` in `src/index.css`.

Header (`src/components/workspace/WorkspaceHeader.tsx`): collapse sidebar, open the image browser, new sheet, and `SaveButton`.

Sidebar tools that do call through: deck, XDX, macro debug ("Trace"), point buy, buff box, journal, AI companion, Complete Sheet (opens the AI modal on the lookup tab), CMB, image browser, loadout, Add Class, new sheet, standalone HTML export, a download link to `/pathfinder_sheet_latest.zip`, JSON export/import, CSV, and print view (`BlueprintSidebar.tsx` 277–540).

Macaroni UI events `macaroni:alert` and `macaroni:query` are listened for on `window` and shown as `FloatingAlertCard` and `InteractiveQueryModal` (`src/App.tsx` 100–120, 489–514).

## Installer and mini-browser

| Script | What it does |
| --- | --- |
| `installer/Start-PF1MW.ps1` | Default URL `http://127.0.0.1:38173/`. With `-Server`, a `TcpListener` on loopback serves `index.html`, the icon, `runtime-manifest.json`, the memory-bank template, glyph PNGs, and `assets/aistudio/*.png` (`61–94`, `118–166`). Without `-Server`, it starts that host if needed and runs Edge or Chrome with `--app=` (`226`). It refuses to start if the manifest, memory template, or AI Studio asset directory is missing (`61–68`). |
| `installer/Package-PF1MW.ps1` | Stages standalone HTML, the launcher, character-sheet icons, `assets/aistudio`, `memory-bank-template`, and a generated `runtime-manifest.json`, then zips `dist/pf1mw-runtime.zip` plus a SHA-256 file (`97–144`). |
| `installer/Install-PF1MW.ps1` | Downloads that zip from the latest stable GitHub release into `%LOCALAPPDATA%\pf1mw`, then **rejects any entry** that is not `index.html`, `chirpy.ico`, `Start-PF1MW.ps1`, or a PNG under `character-sheet-icons/` (`92–98`). The manifest, memory template, and AI Studio images that the packager adds fail this check. |
| `installer/Install-PF1MW-Local.ps1` | Copies `public/pathfinder1e_standalone.html` to `index.html`, the icon, the launcher, and character-sheet PNGs (`35–48`). It does not copy `runtime-manifest.json`, the memory template, or `assets/aistudio`, which `Start-PF1MW.ps1` then requires. |

`npm run build:standalone` builds with `vite.singlefile.config.ts` (`outDir: dist-standalone`, `vite-plugin-singlefile`) and copies the HTML to `public/pathfinder1e_standalone.html`. `npm run dist:runtime` runs that and then `Package-PF1MW.ps1` via PowerShell, so it is a Windows script.

`.github/workflows/release-pf1mw.yml` runs on tags `v*`, on `windows-latest`: `npm ci`, `npm run lint`, `npm run build:standalone`, `Package-PF1MW.ps1`, and publishes `dist/pf1mw-runtime.zip` and its checksum. It does not run `npm test`.
