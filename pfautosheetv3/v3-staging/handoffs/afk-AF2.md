# AF2 handoff — Ingest endpoint, persistence and migration

## Work done

Phase 2 / AF2 (§2.3, I1, I2). CX2 ingest is promoted into `server/ingest/`. `POST /api/sot/ingest` accepts untrusted `name` + string `content` (never executed), caps the source at 5 MiB, and returns the four artifacts (`table.json`, `links.json`, `text.md`, `index.json`). Named exports on `fsAdapter.ts` persist those files to `<character>\SRD\<doc>\` through the folder handle, or to an IndexedDB/reference store when no folder is connected. Leftover `pf1e_host_srd_doc_*` / `pf1e_host_srd_index_v1` entries migrate once: HTML is ingested, artifacts are written, global keys are removed, and per-character bodies are stripped. Globals are not attached to a brand-new sheet. `pf1mod` is not required.

## Files altered

- `server.ts` — notes that ingest also caps the source string at 5 MiB.
- `server/routes.ts` — `POST /api/sot/ingest` wired to `ingestFromRequestBody`.
- `src/storage/fsAdapter.ts` — persist/load helpers, IndexedDB `srdArtifacts` store (DB version 2), one-time host-SRD migration, best-effort migrate on named save/load.

## Files created

- `server/ingest/ingest.ts` — promoted CX2 ingest (deterministic, dependency-free).
- `server/ingest/http.ts` — request validation; input treated as data.
- `server/ingest/index.ts` — re-exports.
- `server/ingest/output-schemas.json` — four-artifact contracts.
- `pfautosheetv3/v3-staging/afk/AF2/ingest.test.ts`
- `pfautosheetv3/v3-staging/afk/AF2/ingest-http.test.ts`
- `pfautosheetv3/v3-staging/afk/AF2/persist.test.ts`
- `pfautosheetv3/v3-staging/afk/AF2/migrate.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF2.md`

## Tests

- `npx tsx --test pfautosheetv3/v3-staging/afk/AF2/*.test.ts` — 11 passed, 0 failed.
- `npx tsx --test src/storage/fsAdapter.test.ts pfautosheetv3/v3-staging/afk/AF1/*.test.ts` — 34 passed.
- `npm test` — 60 passed, 0 failed, 0 skipped.
- `npm run lint` — green.
- `npm run build` — green.
- Live smoke: `POST http://localhost:3000/api/sot/ingest` with a Fighter HTML table returned 200, `PF1E_SOT_INGEST_V1`, `kind: class-grid`, and all four artifacts. Unknown JSON returned 400. Homepage 200.

Staging tests are not in `package.json` `test` (Copilot owns that file). AF7 should add them.

## Open issues and requests

1. **`src/components/tools/AICompanionModal.tsx` (off-limits):** Load SRD / paste-lock should `POST /api/sot/ingest` then call `ingestAndPersistSrdDocument` / `persistSrdIngestArtifacts` from `fsAdapter.ts`. The four files will not appear from the SOT UI until that wiring exists. AG3 can use the same helpers in Class Architect.
2. **`src/engine/sotEngine.ts` (CX1 owns extract; AF1 owned host-storage):** `saveSrdDocForCharacter` still writes full HTML into localStorage. The next character save that rehydrates then `referenceSrdPagesForStorage` will put HTML back. After artifacts exist, host keys should keep metadata/references only (`hostSavedKey` like `folder:SRD/<doc>`). AF2 strips bodies during the one-time migration.
3. **`src/storage/types.ts` / `StorageContext.tsx`:** `StorageAdapter` was not extended (out of AF2 filesscope). Persist helpers are named exports. A later owner can surface them through context.
4. **`docs/STORAGE_TREE.md` (Copilot):** document `<character>/SRD/<doc>/{table.json,links.json,text.md,index.json}`. Those files are rebuildable ingest artifacts; `character.json` remains source of truth.
5. **`package.json` (Copilot CP2 / AF7):** add `pfautosheetv3/v3-staging/afk/AF2/*.test.ts` or promote them next to `server/ingest/`.
6. **Cheerio / Turndown / MiniSearch:** not promoted. `package.json` is Copilot-owned and those deps are not in the bundle. CX2's regex ingest is the record; it keeps the PF1 classifier, determinism, and no-execution policy.
7. **Original HTML sidecar:** AF2 writes the four ingest outputs only. Diagnosis step 4 originals (`source.html` / `.srd.json` under `SRD/`) are still a request if you want the pre-ingest blob on disk.
8. **Images:** still data URLs in `character.json`. Out of AF2 scope.
9. **`exportSrdDocFileToHost`:** still a browser download. AF5 / `sotEngine.ts` as already noted in AF1.
10. **AF3:** bounded retrieval should query `index.json` and send matching `text.md` sections. Do not start until CX4 has landed.
11. **Browser File System Access:** persist-to-folder is covered with the in-memory handle and a live ingest POST. The native folder picker was not automated here.

Client helpers for later tasks:

- `persistSrdIngestArtifacts`
- `loadSrdIngestArtifacts`
- `ingestAndPersistSrdDocument`
- `migrateLegacyHostSrdDocsOnce`
- `hostSrdMigrationPending`

## Do not include secrets

None written.
