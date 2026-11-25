# PF1 Autosheet

Local-first character-sheet workspace for Pathfinder 1e. The app combines live
combat calculations, actions and resources, equipment and downtime, print
output, save-tree persistence, a Character Matrix, SOT ingest, and the Macaroni
xdx macro engine.

## Run locally

Prerequisites: Node.js 22 or later and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Set `OPENAI_API_KEY` in `.env.local` only if AI
assistance is wanted; the sheet and its local tools work without a key.

Local development loads `.env.local` after `.env`. Production uses the hosting
environment. `GET /api/openai/status` reports provider, configuration, and model
status without returning credentials.

## Main tools

- Core Combat, Actions & Skills, Bio/Storage, and Formula Studio sheet pages
- Character Matrix / Career Index and the Class Architect Add Class flow
- SOT Catalogue with deterministic four-artifact ingest
- Complete Sheet and Apple Eye assistance through OpenAI
- XDX, Macro Debug, Dice Tray, Point Buy, Buff Box, Deck, CMB, Journal, and
  Loadout tools
- JSON, CSV, printable-sheet, and standalone HTML export
- Connected-folder saves, crash recovery, and import validation

## Macroni 1.2

Every XDX or Macro Debug expression starts with a sigil:

- `==[...]` neutral definition
- `<<[...]` pull/evaluate
- `<>[...]` make/open a result
- `<?> ...` query choice
- `<^>[...]` modifier
- `<!>[...]` stepper
- `>target<+value` merge into a writable field

Examples:

```text
<<[{2d6}+5] "damage"
<<[{d20}+#bab+#str]
>hp<-5
```

Use `{objectName}` inside a macro to reference a saved object. Legacy leading
`#`, `$`, and `>>` sigils are reserved and are not valid 1.2 entry points.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run clean
```

The clean script and project tooling work from PowerShell and other supported
shells without requiring Unix `rm`.

## Windows mini-browser package

Build and stage the standalone runtime with:

```powershell
npm run dist:runtime
```

The repository's release workflow type-checks and builds on `v*` tags, then
publishes the standalone runtime ZIP and SHA-256 checksum. To install the
latest stable release:

```powershell
curl.exe -L -o Install-PF1MW.ps1 https://raw.githubusercontent.com/Aush10/pathfinder-sheet/main/installer/Install-PF1MW.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-PF1MW.ps1
```

For a local package:

```powershell
.\installer\Install-PF1MW.ps1 -PackagePath .\dist\pf1mw-runtime.zip
```

See `docs/PROGRAM_MAP.md` for the code-traced architecture and current known
gaps. Release tags and pushes are release-gate work; normal development does
not publish or tag a build.
