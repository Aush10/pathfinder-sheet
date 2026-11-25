# Handoff: Antigravity AG1 — Standalone SOT Panel, B5 Chips, I5 Batch Quick-Save

**Status:** Complete (staged in `pfautosheetv3/v3-staging/antigravity/AG1/` + `src/` mount/chat updates)
**Date:** 2026-11-24

## Work Done
- **Standalone Non-AI SOT Panel (`pfautosheetv3/v3-staging/antigravity/AG1/SOTPanel.tsx`):**
  - Built independent modal component (`SOTPanel`) usable without opening AI Companion (`AICompanionModal.tsx` untouched).
  - Supports multi-file upload (`.srd.json`, `.json`, `.html`, `.htm`, `.txt`, `.md`) and batch pasted-page queue (`+ Queue Page for Batch` -> `Save Batch`) with strict non-blank title validation, 5 MiB size guard (`MAX_SOT_FILE_BYTES`), `QuotaExceededError` handling, and distinct JSON import error messages (`.srd.json` envelope missing `srdDocument` vs full PF1E sheet JSON vs unknown raw JSON).
  - Integrates with `/api/sot/ingest` (`runServerIngest`) and AF2 (`persistSrdIngestArtifacts`, `loadSrdIngestArtifacts`, `srdDocFolderName`) using per-character host storage (`getActiveHostSrdOwner`, `loadHostSrdDocsForCharacter`, `saveSrdDocForCharacter`, `removeSrdDocFromHostDeviceStorage`, `exportSrdDocFileToHost`).
  - Displays all 4 deterministic ingest artifacts in separate tabs: `table.json` (with `class-grid`, `extended-grid`, `casting-subgrid`, and read-only `lookup-table` kind badges), `links.json` (with `+ Save Weblink` promotion), `text.md`, and `index.json` (keywords + TOC sections).
  - Replaces legacy browser alerts and auto-closing `<details>` (B8) with explicit dismissable notices (`notices`).
  - Preserves existing Weblinks vault and single-page read-only fetch (`/api/sot/fetch-readonly-page`).
- **Complete Sheet Chat Window (`src/components/tools/CompleteSheetChatWindow.tsx`):**
  - **B5:** Removed all Slayer prompt chips (`Build Slayer from SOT`, `Dual-Wield Feats`, `Test Missing SOT (Stygian)`) and replaced `Stygian Slayer Archetype` placeholder text with generic `"e.g. Core Class or Archetype Rules"`.
  - **I5:** Upgraded Quick SOT Upload drawer to support queuing multiple pasted SOT pages (`quickSotBatch` / `Queue Page`), non-blank validation notices, per-character host storage persistence, best-effort `/api/sot/ingest` + AF2 4-output artifact persistence, and a button firing `'pf1e:open-sot-panel'`.
- **Workspace Mount Hook (`src/App.tsx`, `src/components/workspace/BlueprintSidebar.tsx`):**
  - Added optional `onOpenSotPanel` sidebar launcher button in `BlueprintSidebar.tsx`.
  - Added `isSotPanelOpen` state, `Ctrl+X`/`Escape` close handling, `'pf1e:open-sot-panel'` listener, and AF7 promotion comments in `src/App.tsx` (without importing `pfautosheetv3/` from `src/`).

## Files Created
- `pfautosheetv3/v3-staging/antigravity/AG1/SOTPanel.tsx`
- `pfautosheetv3/v3-staging/antigravity/AG1/SOTPanel.test.ts`
- `pfautosheetv3/v3-staging/handoffs/antigravity-AG1.md`

## Files Altered
- `src/components/tools/CompleteSheetChatWindow.tsx`
- `src/components/workspace/BlueprintSidebar.tsx`
- `src/App.tsx`

## Verification
- `node_modules\.bin\esbuild.cmd pfautosheetv3/v3-staging/antigravity/AG1/SOTPanel.test.ts --bundle --platform=node --format=cjs --outfile=...` -> `AG1 SOTPanel & chat verification passed.` (exit 0).
- `npm run lint` (`tsc --noEmit`) -> exit 0.
- `npm run build` (`vite build`) -> exit 0 (`dist/index.html`, `1727` modules).

## Open Requests for AF7 Promotion
1. Copy `pfautosheetv3/v3-staging/antigravity/AG1/SOTPanel.tsx` to `src/components/tools/SOTPanel.tsx`, updating `../../../../src/` imports to `../../`.
2. In `src/App.tsx`, uncomment `// AF7-PROMOTE: import { SOTPanel } from './components/tools/SOTPanel';` and replace the staged fallback dialog inside `{isSotPanelOpen && ...}` with `<SOTPanel isOpen={isSotPanelOpen} onClose={() => setIsSotPanelOpen(false)} theme={layout.theme} />`.
