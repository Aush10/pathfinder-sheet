# SOT ingest playtest

This folder is a small kit for the SRD parser. It does not open the character
sheet.

The full Autosheet SOT library is bigger because it also stores files per
character, shows tabs, and talks to the AI. The parser in `server/ingest/` is
the small part. You can test that part by dropping one file on this runner.

## What it does

You give it HTML, Markdown, text, or `.srd.json`. It writes four artifacts:

- `table.json`
- `links.json`
- `text.md`
- `index.json`

Same four files the app saves under `<character>/SRD/<doc>/`.

It does not call OpenAI. It does not execute the file. Size cap is 5 MB.

## Run it

From the repo root (Node 22+):

```powershell
node --experimental-strip-types pt-kit/ingest/run.ts pt-kit/ingest/sample-class.md
```

That writes into `pt-kit/ingest/out/sample-class.md/`.

Your own file:

```powershell
node --experimental-strip-types pt-kit/ingest/run.ts path\to\fighter.html
```

## What good looks like

On `sample-class.md`:

- One table tagged `class-grid` (Level, BAB, saves, Special)
- One table tagged `lookup-table` (Result / Effect)
- `text.md` has a `[Table: ...]` line
- Running it twice gives the same output

## What this kit is not

It is not the SOT panel, Complete Sheet, or host-folder save. Use the main
playtest app for those.
