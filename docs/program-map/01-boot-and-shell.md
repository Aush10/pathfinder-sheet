# 1. Boot, server, installer, and shell

## Process entry

`package.json` names the package `pathfinder-1e-modular-workspace` at version
`1.3.0`. `dev` and `start` are the same command:
`node --experimental-strip-types server.ts`. Neither script sets `NODE_ENV`,
so `server.ts` takes the Vite branch.

`server.ts` 6–40:

1. `loadServerEnvironment(__dirname)` loads `.env` with `override: false`, then `.env.local`, which overrides only when `NODE_ENV !== 'production'` (`server/env.ts` 6–15).
2. Express listens on **3000**, bound to `0.0.0.0`.
3. Middleware order: lock-file MIME registration, `lockFileMiddleware`, `express.json({ limit: '10mb' })`, `registerApiRoutes`, then either Vite or static files.

`server/lockFiles.ts` forces `Content-Type: text/plain` for paths ending in
`.lock`. The same middleware is installed as the Vite plugin
`serve-lock-files`.

Non-production uses Vite `middlewareMode` and `appType: 'spa'`. Production serves `dist/` and falls through `app.get('*all', ...)` to `dist/index.html` (`server.ts` 23–34). `npm run build` writes that `dist/`. `npm run preview` is Vite's own preview server, not `server.ts`, so it does not mount the API.

Vite aliases `@` to the repo root with an ESM URL, so the config does not depend
on CommonJS `__dirname`. HMR and file watching turn off when `DISABLE_HMR=true`;
otherwise the ignored path includes `pfautosheetv3/`. `index.html` mounts `#root`
from `/src/main.tsx` and loads Cinzel, JetBrains Mono, and Plus Jakarta Sans.

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

The old conditions-only `SheetPage3SpellsBio` mount and unreachable Quick HP
modal were removed during CP2 cleanup. Dice still opens from sheet roll buttons
through `handleRollFormula`.

`QuickModularTools` is rendered by page 1 (`src/components/sheet/SheetPage1Core.tsx` around the turn-stepper module) and then hidden by `.pf1-hidden-turn-stepper { display: none !important; }` in `src/index.css`.

Header (`src/components/workspace/WorkspaceHeader.tsx`): collapse sidebar, open the image browser, new sheet, and `SaveButton`.

Sidebar tools that do call through: deck, XDX, macro debug ("Trace"), point buy, buff box, journal, AI companion, Complete Sheet (opens the AI modal on the lookup tab), CMB, image browser, loadout, Add Class, new sheet, standalone HTML export, a download link to `/pathfinder_sheet_latest.zip`, JSON export/import, CSV, and print view (`BlueprintSidebar.tsx` 277–540).

Macaroni UI events `macaroni:alert` and `macaroni:query` are listened for on `window` and shown as `FloatingAlertCard` and `InteractiveQueryModal` (`src/App.tsx` 100–120, 489–514).

## Installer and mini-browser

| Script | What it does |
| --- | --- |
| `installer/Start-PF1MW.ps1` | Prefers `NODE_ENV=production PORT=38173 node --experimental-strip-types server.ts`; the health check is `/api/openai/status`. If Node.js 22+ or dependencies are unavailable, it serves the standalone HTML with a loopback `TcpListener` and opens Edge or Chrome. |
| `installer/Package-PF1MW.ps1` | Stages the standalone app, launcher, icon assets, server sources, manifest, package metadata, and production `dist/`, then writes `dist/pf1mw-runtime.zip` plus SHA-256. It excludes secrets, `node_modules`, `src/`, and `pfautosheetv3/`. |
| `installer/Install-PF1MW.ps1` | Accepts the same runtime contract from GitHub or `-PackagePath`, installs beneath `%LOCALAPPDATA%\pf1mw`, and runs `npm ci` when Node.js is available. |
| `installer/Install-PF1MW-Local.ps1` | Builds through `Package-PF1MW.ps1`, then reuses `Install-PF1MW.ps1` for local installation. |

`npm run build:standalone` builds with `vite.singlefile.config.ts` (`outDir: dist-standalone`, `vite-plugin-singlefile`) and copies the HTML to `public/pathfinder1e_standalone.html`. `npm run dist:runtime` runs that and then `Package-PF1MW.ps1` via PowerShell, so it is a Windows script.

`.github/workflows/release-pf1mw.yml` runs on tags `v*`, on
`windows-latest`: `npm ci`, `npm run lint`, `npm run build:standalone`,
`Package-PF1MW.ps1`, and publishes `dist/pf1mw-runtime.zip` and its checksum.
It does not run `npm test`; CP3 runs that gate before tag publication.
