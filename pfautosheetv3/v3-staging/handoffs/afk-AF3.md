# AF3 handoff — Bounded AI retrieval and tap-test logging

## Work done

Phase 3 / AF3 (B7, B6 server half, B4 prompt). Complete Sheet and lookup now send a compact SOT payload and a query. The server queries ingest `index.json` (termIndex + heading/text/table-cell overlap), packs matching `text.md` sections and table rows, and keeps a catalogue of loaded docs so an omitted excerpt is not treated as absence. Caps: SOT 12,000 characters; history 8 messages / 4,000 characters. Ingest sections are never split. Lookup-table rows are included only when they match; class-grid / extended-grid / casting-subgrid rows ride with a selected section (max 40). Unindexed dumps are windowed on word boundaries as a degraded path and still capped at 12k. Sheet text, SOT excerpts, and conversation are wrapped as untrusted **content**. The Slayer `className` example in `server/prompts.ts` is now `"Fighter"`. Tap-test turns log raw model JSON in development only, with `sk-` keys and Bearer tokens redacted.

Austin cleared AF3 while CX7 was still running. AF3 stayed off `character.ts`, `characterState.ts`, CX6 stepper files, and CX7 spell-table code. CX7 has since landed (`codex-CX7.md`); CX3 is unblocked after this handoff.

## Files altered

- `server/sotContext.ts` — bounded retrieval, history caps, untrusted wrappers, secret redaction.
- `server/routes.ts` — lookup and complete-sheet use `sotDocuments ?? sotOverridePages`, bound history, untrusted content blocks, tap-test log.
- `server/prompts.ts` — Fighter example; UNTRUSTED CONTENT; omitted excerpt is not absence.
- `src/engine/aiService.ts` — payload only: `compactSotDocumentsForRequest` / `REQUEST_SOT_EXCERPT_CAP`. Lookup and complete-sheet POST `sotDocuments` + `query`. CX4 empty catalogue, `tapTestNeedsInput`, and archetype cleanup are unchanged.

## Files created

- `server/sotContext.test.ts`
- `pfautosheetv3/v3-staging/afk/AF3/bounded-retrieval.test.ts`
- `pfautosheetv3/v3-staging/afk/AF3/payload-and-prompts.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF3.md`

## Tests

Focused suites bundled with the installed esbuild (avoids the known `tsx` `uv_os_get_passwd ENOMEM` runner in this environment):

```powershell
node_modules\.bin\esbuild.cmd server\sotContext.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af3-sotContext.test.cjs
node $env:TEMP\af3-sotContext.test.cjs
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF3\bounded-retrieval.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af3-bounded.test.cjs
node $env:TEMP\af3-bounded.test.cjs
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF3\payload-and-prompts.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af3-payload.test.cjs
node $env:TEMP\af3-payload.test.cjs
```

- `server/sotContext.test.ts` — 8 passed (history caps, ingest section selection, lookup-table vs class-grid, catalogue-on-omit, 12k never-split ingest sections, key redaction).
- `bounded-retrieval.test.ts` — 2 passed (real CX2 ingest artifact; legacy HTML dump capped, no tags).
- `payload-and-prompts.test.ts` — 3 passed (no `htmlContent` in compact payload, no Slayer in prompts, tap-test log is dev-only and redacted).
- `npm run lint` — green.
- `npm run build` — green. Existing Vite warnings remain for `vite.config.ts` `__dirname` and the >500 kB output chunk.

Staging tests are not in `package.json` `test` (Copilot owns that file). AF7 should add `server/sotContext.test.ts` and `pfautosheetv3/v3-staging/afk/AF3/*.test.ts`.

## Compact payload contract

Client sends, per page:

- `id`, `title`, `category`
- `ingest` (the four-artifact object) when present
- otherwise `excerpt` (plain text, max 4,000 characters)

Never `htmlContent`. Complete Sheet also sends `query` (the latest player prompt) plus the existing conversation / characterSummary / weblinks / allowedFields / tapTest. Lookup already had `query`. Legacy clients that still POST `sotOverridePages` keep working; the server 12k-caps them.

Until `AICompanionModal` wires Load SRD through AF2 ingest+persist, saved pages usually have no `ingest` field, so the server uses the 4k excerpt path. Attach `page.ingest` / `ingestArtifacts` later and retrieval will query `termIndex` without a further AF3 change.

## Open issues and requests

1. **`src/components/tools/AICompanionModal.tsx` (off-limits):** Load SRD / paste-lock should `POST /api/sot/ingest`, persist via `ingestAndPersistSrdDocument`, and put the artifacts on the override page (or a parallel lookup the client can attach at request time). Bounded ingest retrieval stays degraded to excerpts until that wiring exists.
2. **`src/engine/sotEngine.ts`:** still writes full HTML into localStorage (AF2 leftover). After artifacts exist, host keys should keep metadata/references only.
3. **`package.json` (Copilot CP2 / AF7):** add `server/sotContext.test.ts` and `pfautosheetv3/v3-staging/afk/AF3/*.test.ts`.
4. **B5 Slayer chips** in `CompleteSheetChatWindow.tsx` are still present. Out of AF3 filesscope (prompt example only).
5. **CX3** is unblocked: issue 10 order is AF3 → CX3. CX7's `codex/CX7/spellTables.ts` is the spell-progression adapter; do not re-scrape `text.md`.
6. **AF4+** wait for this handoff (now present). Do not start later AFK packets until sequencing is met unless Austin clears them.

## Do not include secrets

None written. Tap-test logging is skipped when `NODE_ENV === 'production'` and always runs through `redactSecretsForLog`.
