# Autosheet Playtest Kit

This is a test build of the Pathfinder 1e Autosheet. It is a fan-made character
sheet helper. It is not a Paizo product.

The sheet works on your computer. Your characters live in a folder you pick.
Nothing is uploaded unless you turn AI on.

Expect rough edges. That is the point of a playtest.

## First launch

The first time you open the kit (`#inits = 0` in the browser crash log / `playtest-state.json`),
the launcher opens a private window to the **Wait it's dangerous out there. Read this o7** warning page
(`PLAYTEST_GUIDE.html` / `launch-warning.html`), records `#inits = 1`, and instructs you to close and reopen
the kit a second time (or click through). Subsequent launches open directly in a regular app window.

The exportable `dist-standalone/` Playtest Kit (`npm run build:standalone`) also includes:
- Downloadable `kits/api-keyhole.zip` (`api-keyhole.json` + `.env.local` without an API key)
- Downloadable `kits/openai-ai-kit.zip` and experimental `kits/gemini-ai-kit.zip`
- Downloadable `kits/sot-ingest-kit.zip` alongside `pt-kit/ingest/`
- Windows Defender Firewall & quick-start shortcuts under `shortcuts/`
- `MACRONI_XDX_BIBLE.html` (updated Marconi = Macro Native Index XdX reference)

## What you need

- Windows
- Node.js 22 or later if you want AI, SOT ingest, or Complete Sheet
- Edge or Chrome
- An empty folder for saves (suggested name: `AIgamesheet`)

The sheet still opens without Node. You just will not get `/api` features.

## Install and start

To install a prebuilt runtime zip:

1. Obtain this repository's `installer` folder (not included in the runtime zip).
   Keep `PF1MW-RuntimeContract.ps1` beside `Install-PF1MW.ps1`, and keep
   `pf1mw-runtime.zip.sha256` beside `pf1mw-runtime.zip`.
   From the folder containing `installer`, run
   `.\installer\Install-PF1MW.ps1 -PackagePath 'C:\path\to\pf1mw-runtime.zip'`
   using the actual path to your zip.
2. Use the desktop shortcut **Pathfinder 1e Modular Workspace**
3. The app opens in a small browser window at `http://127.0.0.1:38173/`

From the repo, for development:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Save folder

Click Connect and pick a folder. The app writes `character.json` there. That
file is the real save. If the app crashes, you will get Restore or Keep named
save. Named save wins if you keep it.

## AI (optional)

The sheet, dice, macros, matrix, and SOT library work with no key.

If you want Complete Sheet / lookup:

1. Copy `.env.example` to `.env.local` next to `server.ts`
2. Put your key on the `OPENAI_API_KEY=` line
3. Restart the Node server, not just the browser window. For the installed
   kit, stop its `server.ts` Node process in Task Manager, then relaunch the
   desktop shortcut. For development, stop and rerun `npm run dev`.

Do not put a key in the zip, in chat, or in a screenshot. The kit never
packages `.env.local`.

AI Companion starts as an **empty slot** until an AI test kit / configured API server is detected, and all AI listeners start **OFF by default** so you explicitly enable only the listeners you want in the AI Companion tool.

## What to try

- Make a character and click around the four sheet pages
- Add Class / Class Architect, then open Character Matrix
- Open the SOT library from the sidebar. Drop an SRD page or paste text
- Cast a spell if you have slot bars. Confirm the Cast popup
- Journal should say Spell Book once spell tables exist
- Export JSON and load it back

## SOT ingest

SOT means Source of Truth: class pages, archetypes, and similar rules text.

The in-app path: SOT library → add files or paste pages → Save. The app
builds four files per document under `<character>/SRD/<doc>/`:

- `table.json` — tables, tagged as class grid, extra grid, casting, or lookup
- `links.json` — links
- `text.md` — readable text
- `index.json` — headings and search terms

There is also a small **ingest-only kit** that does not open the whole sheet.
See `pt-kit/ingest/README.md`. That is the light way to test “did this SRD
parse?” Full class SRDs can be large. The parser itself is not.

## Please tell us

- What broke
- What you expected
- The character name and what you clicked
- Whether Node / AI was on

Do not send your `.env.local` or API key.
