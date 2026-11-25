# CX4 handoff — demo-data removal, tap-test logic, and archetype cleanup

## Work done

Completed Phase 3 CX4 after AF2.

- **B4:** `DEFAULT_SOT_CATALOGUE` is now an empty catalogue. The previous seeded SRD/weblink content is relabelled `LEGACY_DEMO_SOT_CATALOGUE` and is no longer used as a blank-character fallback, so blank sheets do not receive Slayer content.
- **B6:** blank identity summaries no longer fabricate `Name: Unnamed`. Added `tapTestNeedsInput()`: a quiet no-op at the identity step advances the tap test, while model/user questions, rejected writes, a missing-SOT request, and no-op later steps still request input.
- **B10:** removed the hard-coded Bard Fencer/Arcane Duelist fallback and its hard-coded feature set. Archetype merges no longer prepend `[Archetype]` to acquired features.

## Files altered

- `src/engine/aiService.ts` — empty SOT fallback, tap-test decision helper and summary correction, generic archetype fallback/merge behavior.

## Files created

- `pfautosheetv3/v3-staging/codex/CX4/cx4.test.ts` — focused blank-SOT and tap-test decision tests.
- `pfautosheetv3/v3-staging/handoffs/codex-CX4.md` — this handoff.

## Tests

- Bundled focused test with the installed esbuild and ran it under Node: 2 passed, 0 failed.
- `npm run lint` — passed.
- `npm run build` — passed. Existing Vite warnings remain for `vite.config.ts` `__dirname` and the >500 kB output chunk.
- `npm test` was not rerun: the workspace `tsx` runner is known to fail in this environment with `uv_os_get_passwd ENOMEM`. The focused test was bundled to avoid that runner and did execute successfully.

## Open issues and requests

1. AF3 is now unblocked. It should implement bounded retrieval using AF2's `index.json`/`text.md`, including the 12k context and 8-message/4k history caps.
2. `LEGACY_DEMO_SOT_CATALOGUE` is intentionally retained in `aiService.ts` for a later migration/debugging decision. It is no longer exported or used as a fallback. If CP2 removes all legacy demo artifacts, it may delete this constant after confirming no migration needs it.
3. Focused CX4 tests are staging-only; AF7 should promote them to the normal test suite.

## Do not include secrets

None written.
