# AF4 handoff — Server hygiene

## Work done

Phase 5 / AF4 (B17, B18, §4 security). Production deep links use an Express 4 catch-all (`app.get('*')`) instead of Express 5 `*all`, and `/api` paths are left for the API 404. `PORT` is read from the environment with a 3000 fallback (invalid values also fall back). `EADDRINUSE` prints a message that names the busy port and suggests `PORT=3001`. `/api/sot/fetch-readonly-page` only fetches http(s) hosts on the allowlist (d20pfsrd.com, aonprd.com, paizo.com, spheresofpower.wikidot.com, including subdomains), still blocks webhook URLs, and does not follow redirects off that list. `/api/gemini/*` aliases are removed. Client callers already POST `/api/openai/*`.

`getSessionApiKey` / `setSessionApiKey` / `clearSessionApiKey` still live in `src/engine/aiService.ts` (not in AF4 filesscope). They are no-ops. Callers remain in AddClassModal, ClassArchitectModal, and JournalModal.

`server/openai.ts` had no Gemini leftovers to remove.

## Files altered

- `server.ts` — `resolveServerPort()`, Express 4 SPA fallback, listen `error` handler for EADDRINUSE.
- `server/routes.ts` — port helpers, allowlist, redirect-safe fetch, Gemini aliases removed, `registerProductionSpaFallback`.

## Files created

- `pfautosheetv3/v3-staging/afk/AF4/server-hygiene.test.ts`
- `pfautosheetv3/v3-staging/handoffs/afk-AF4.md`

## Tests

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\afk\AF4\server-hygiene.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\af4-hygiene.test.cjs
node $env:TEMP\af4-hygiene.test.cjs
```

- 6 passed, 0 failed (PORT fallback, EADDRINUSE message, SPA skip `/api`, allowlist, webhook/off-list reject, no Gemini routes).
- `npm run lint` — green.
- `npm run build` — green. Existing Vite `__dirname` and chunk-size warnings remain.

## Open issues and requests

1. **`src/engine/aiService.ts` (Copilot / AF7):** remove `getSessionApiKey`, `setSessionApiKey`, and `clearSessionApiKey`. AF4 cannot edit that file for this leftover.
2. **Callers (Antigravity / AF7):** drop `getSessionApiKey()` from `AddClassModal.tsx`, `ClassArchitectModal.tsx`, and `JournalModal.tsx`.
3. **Docs (Copilot):** PROGRAM_MAP and `docs/program-map/04-tools-and-ai.md` still mention `/api/gemini/*` aliases.
4. **`package.json` (Copilot CP2 / AF7):** add `pfautosheetv3/v3-staging/afk/AF4/*.test.ts`.

## Do not include secrets

None written.
