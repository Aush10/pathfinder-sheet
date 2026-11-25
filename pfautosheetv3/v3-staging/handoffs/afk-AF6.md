# AF6 handoff — Installer and packager alignment

## Work done

Phase 6 / AF6 (Decision 8). The four installer scripts now share one runtime zip. **The installed app runs `server.ts` when Node.js 22+ and `node_modules` are present**, which is what gives it `/api` (AI, ingest, Complete Sheet, SOT fetch). If Node is missing, `Start-PF1MW.ps1` still serves the standalone HTML through the loopback `TcpListener` on port 38173.

Shared allowlist lives in `installer/PF1MW-RuntimeContract.ps1` (Package + Install only). Start stays self-contained inside the zip.

| Script | After AF6 |
| --- | --- |
| `Package-PF1MW.ps1` | Stages standalone HTML, launcher, icons, AI Studio PNGs, memory-bank template, `runtime-manifest.json`, `server.ts` + runtime `server/` sources, `package.json` / `package-lock.json` / `.env.example`, and filtered `dist/` (production SPA). Runs `npm run build` when `dist/index.html` is missing so the GitHub release workflow still works. Writes `dist/pf1mw-runtime.zip` + SHA-256. Never packages `.env`, `.env.local`, `node_modules`, `src/`, or `pfautosheetv3/`. |
| `Install-PF1MW.ps1` | Accepts that zip (GitHub latest or `-PackagePath`). Allowlist matches the packager, including manifest, memory template, AI Studio PNGs, server sources, and `dist/`. Runs `npm ci` in the install dir when Node is present. Desktop shortcut unchanged. |
| `Install-PF1MW-Local.ps1` | Wrapper: runs Package, then `Install-PF1MW.ps1 -PackagePath dist\pf1mw-runtime.zip`. |
| `Start-PF1MW.ps1` | Prefers `NODE_ENV=production PORT=38173 node --experimental-strip-types server.ts`. Health check is `GET /api/openai/status`. Fallback is the existing static mini-server. User puts `OPENAI_API_KEY` in `.env.local` next to `server.ts`. |

## Files created

- `installer/PF1MW-RuntimeContract.ps1`
- `pfautosheetv3/v3-staging/afk/AF6/installer-alignment.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF6.md`

## Files altered

- `installer/Package-PF1MW.ps1`
- `installer/Install-PF1MW.ps1`
- `installer/Install-PF1MW-Local.ps1`
- `installer/Start-PF1MW.ps1`

## Decision (server.ts)

Yes: the installed 1.3.0 app runs `server.ts` when Node 22+ is available. v3 ingest, SOT panel, and Complete Sheet all need `/api`. Standalone HTML remains the no-Node fallback. `server.ts` still listens on `0.0.0.0` (out of this filesscope). Installed PORT is 38173 so it does not collide with `npm run dev` on 3000.

## Tests

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF6\installer-alignment.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af6-installer.test.cjs --external:esbuild
node $env:TEMP\af6-installer.test.cjs
```

- 5 passed, 0 failed (PowerShell parse, allowlist, script agreement, Local wrapper, no secrets).
- `.\installer\Package-PF1MW.ps1` — exit 0. Zip `dist/pf1mw-runtime.zip` contains `server.ts`, `dist/index.html`, `.env.example`, 88 files; does not contain `.env.local`.
- Did not run `Install-PF1MW.ps1` (it writes a Desktop shortcut).

## Open issues and requests

1. **Copilot CP2 / PROGRAM_MAP:** `docs/program-map/01-boot-and-shell.md` still describes the old mismatch. Update it to the AF6 contract.
2. **Copilot CP1:** `package.json` `dist:runtime` still only runs `build:standalone` then Package. Package now self-builds `dist/` when missing, so the script still works. Optional: add `npm run build` before Package.
3. **`.github/workflows/release-pf1mw.yml`:** still does not run `npm run build` or `npm test`. Package runs `npm run build` if `dist/index.html` is missing. Workflow is out of AF6 filesscope.
4. **`server.ts` bind address:** production listen remains `0.0.0.0`. Loopback-only would be safer for the desktop install; that file is AF4's, not AF6.
5. **First-launch `npm ci`:** needs network and disk under `%LOCALAPPDATA%\pf1mw\node_modules`. Vite is a production import of `server.ts`, so `npm ci --omit=dev` is not enough unless `server.ts` becomes a dynamic import (out of scope).

## Do not include secrets

None written. `.env.example` is packaged; `.env.local` is not.
