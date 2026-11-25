# Autosheet Playtest Kit

This is a test build of the Pathfinder 1e Autosheet. It is a fan-made character
sheet helper. It is not a Paizo product.

The sheet works on your computer. Your characters live in a folder you pick.
Nothing is uploaded unless you turn AI on.

Expect rough edges. That is the point of a playtest.

## First launch

The first time you open the kit, a warning page will show (Antigravity is
building that page). Read it, then continue.

Antigravity is also building a small API keyhole so you can paste a key in the
app. Until that lands, AI is optional and uses a local file (see below).

## What you need

- Windows
- Node.js 22 or later if you want AI, SOT ingest, or Complete Sheet
- Edge or Chrome
- An empty folder for saves (suggested name: `AIgamesheet`)

The sheet still opens without Node. You just will not get `/api` features.

## Install and start

From a local zip:

1. Run `installer\Install-PF1MW-Local.ps1`  
   or `installer\Install-PF1MW.ps1 -PackagePath .\dist\pf1mw-runtime.zip`
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
3. Restart the app

Do not put a key in the zip, in chat, or in a screenshot. The kit never
packages `.env.local`.

The keyhole UI is coming. Use the file until then.

## What to try

- Make a character and click around the four sheet pages
- Add Class / Class Architect, then open Character Matrix
- Open the SOT library (sidebar, or Ctrl+X). Drop an SRD page or paste text
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
