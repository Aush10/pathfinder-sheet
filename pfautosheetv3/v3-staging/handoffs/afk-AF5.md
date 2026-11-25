# AF5 handoff — Exports, import and loadout IO

## Work done

Phase 5 / AF5 (I4, B16, I7). JSON, CSV, standalone HTML, and loadout downloads try `<character>/exports/` through the connected folder handle first, then fall back to a Blob URL (`URL.createObjectURL`) instead of a `data:` URL. `ensureCharacterLayout` creates the `exports` folder. `importCharacterJSONFile` unwraps save-tree envelopes (`format === 'pf1e-character'` + `data`), accepts a blank `name`, and still requires an `abilities` object. FileReader `onerror` reports a read failure. Loadout import uses the same unwrap and `onerror`. AF8 `spellTables` on an imported character still go through `normalizeCharacterState`.

`exportSrdDocFileToHost` in `sotEngine.ts` is out of AF5 filesscope and still uses a browser download.

## Files altered

- `src/storage/fsAdapter.ts` — `CHARACTER_EXPORTS_FOLDER`, `exports` on the character layout, `writeCharacterExportFile`.
- `src/utils/sheetExporters.ts` — folder write + Blob fallback, envelope unwrap, blank-name import, FileReader `onerror`.
- `src/components/tools/LoadoutModal.tsx` — folder write + Blob fallback, envelope unwrap, FileReader `onerror`.

## Files created

- `pfautosheetv3/v3-staging/afk/AF5/exports-import.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF5.md`

## Tests

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF5\exports-import.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af5-exports.test.cjs
node $env:TEMP\af5-exports.test.cjs
```

- 6 passed, 0 failed (envelope + blank name, reject missing abilities, loadout unwrap, write to `exports/`, skip when no folder, sanitize path separators).
- Existing `src/storage/fsAdapter.test.ts` — 18 passed after the `exports` folder was added.
- `npm run lint` — green.
- `npm run build` — green. Existing Vite warnings remain.

## Client helpers

```ts
writeCharacterExportFile({ fileName, contents, player?, characterName?, handle? })
writeOrDownloadExport(fileName, contents, mimeType)
unwrapImportedJsonPayload(parsed)
parseImportedCharacterJson(text)
```

## Open issues and requests

1. **`src/engine/sotEngine.ts` `exportSrdDocFileToHost`:** still a `<a download>` Blob. Wire it through `writeOrDownloadExport` / `writeCharacterExportFile` (CX5 owns buff syntax on this file; AF7 can apply the IO change).
2. **Toast when a folder write succeeds (Antigravity / AF7):** silent folder write can look like a no-op if the user expected Downloads.
3. **`docs/STORAGE_TREE.md` (Copilot):** document `<character>/exports/`.
4. **`package.json` (Copilot CP2 / AF7):** add `pfautosheetv3/v3-staging/afk/AF5/*.test.ts`.
5. **AF8 fields:** import goes through `normalizeCharacterState`, so `spellTables`, Spell Book pages, slot-bar ids, and `macaroniStepperStore` keep the AF8 persist rules.

## Do not include secrets

None written.
