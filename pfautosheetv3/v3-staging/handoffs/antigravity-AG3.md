# Handoff: Antigravity AG3 — Character Matrix UI, ClassArchitect Fixes, Editable Ability Type

**Status:** Complete (staged in `pfautosheetv3/v3-staging/antigravity/AG3/` + `src/` owned edits)
**Date:** 2026-11-24

## Work Done
- **Character Matrix Workspace Staging (`pfautosheetv3/v3-staging/antigravity/AG3/`):**
  - `CharacterMatrixPanel.tsx`: Bound directly to CX3 `pfautosheetv3/v3-staging/codex/CX3/matrixEngine.ts` (`deriveMatrix`, `migrateClassGrids`, `parseHeaderFill`, `materializeTrack`, `parseIndexToken`, `createMatrixId`, `abilityTypeFromTag`, `makeColumns`) and `src/engine/characterIntegration.ts` (`applyMatrixProgressionToCharacter`).
    - Folder tab bar with `Character Matrix` derived view (`20` default rows, `1–40` expand toggle, Row 0 display, hidden columns omitted, sticky frozen headers, `Apply Matrix to Sheet`), `Career Index` (level column, `+ Add Track`, header fills `=wizard`/`+1`/`+1>3`/`+1!2`, comma gestalt & `*`/`fighter4`/`+bab`/`-bab`/`=bab+special`, green/red/yellow cell state classes and diagnostics), `User Indexes` tabs (overlapped `-ml-2` style when `appendToIndexId` is set, inline `<act>`/`<rec>`/`<spell>`/`<feat>` tags), right-click **Edit Index** context menu + button, and rightmost empty `+` New Index tab (populates Career Index Track A on first creation).
  - `EditIndexModal.tsx`: Implements `clearIndex`, Cleanup `replaceIndexValues`, `addRow0`, RowCol (`updateIndexColumns` reorder/freeze/hide/add/remove + `insertIndexRow`), `autofillIndexColumn`, `appendIndex`, `assignMatrixValue`, `autoAssignIndex` (against loaded `index.json` sections), `bindMatrixValue` (`take-highest` / `count-total`), and marks `Template` disabled `Template (WIP)` per deferred-work guard.
  - `SotClassifiedPicker.tsx`: Loads deterministic `table.json` artifacts (`loadSrdIngestArtifacts` + `splitIngestTablesByEligibility`) for per-character SOT docs, creates `UserMatrixIndex` only from `class-grid`, `extended-grid`, and `casting-subgrid` via `indexFromClassifiedTables`, and displays `lookup-table` strictly as Reference Only (excluded from Matrix progression).
- **`ClassArchitectModal.tsx` Updates (`src/components/tools/ClassArchitectModal.tsx`):**
  - **B9:** Removed `DEFAULT_SOT_CATALOGUE` import/fallback and swapped global `loadAllHostDeviceSrdDocs()` for per-character `loadHostSrdDocsForCharacter(ownerId)` so SRDs never leak between characters.
  - **B11:** Added `nextCollisionFreeClassId` so deleting `class1` leaving `class2` never causes a `class2` ID collision on Add Class.
  - **Classified Table Guard:** Added `classifyIngestTablesForArchitect` check in `handlePopulateFromSot` preventing `lookup-table`-only SOT documents from overwriting class progression grids.
  - Added `matrixPanelSlot?: React.ReactNode` prop and `Character Matrix` viewMode tab with `AF7-PROMOTE` comment hook without importing `pfautosheetv3/` inside `src/`.
- **Editable Ability Type & Format (`src/components/sheet/ActionDirectoryModule.tsx`):**
  - Made existing Ability cards' `abilityType` badge clickable for inline tag switching (`inlineAbilityTypeEditId`).
  - Added an editable `Entry format` selector (`Ability`, `Resource Bar`, `Spell`, `Counter`, `Alt Variation`) inside the Edit modal alongside the `Type` + `+ Add type` controls.

## Files Created
- `pfautosheetv3/v3-staging/antigravity/AG3/CharacterMatrixPanel.tsx`
- `pfautosheetv3/v3-staging/antigravity/AG3/EditIndexModal.tsx`
- `pfautosheetv3/v3-staging/antigravity/AG3/SotClassifiedPicker.tsx`
- `pfautosheetv3/v3-staging/antigravity/AG3/ClassArchitectMatrix.test.ts`
- `pfautosheetv3/v3-staging/handoffs/antigravity-AG3.md`

## Files Altered
- `src/components/tools/ClassArchitectModal.tsx`
- `src/components/sheet/ActionDirectoryModule.tsx`

## Verification
- `pfautosheetv3/v3-staging/antigravity/AG3/ClassArchitectMatrix.test.ts` (via `esbuild` + `node`) -> `AG3 Character Matrix & ClassArchitect verification passed.` (exit 0).
- `src/components/tools/ClassArchitectModal.test.ts` (via `esbuild` + `node`) -> 4/4 subtests passed.
- `pfautosheetv3/v3-staging/codex/CX3/matrixEngine.test.ts` (via `esbuild` + `node`) -> 7/7 subtests passed.
- `npm run lint` (`tsc --noEmit`) -> exit 0; `npm run build` (`vite build`) -> exit 0.

## Open Requests for AF7 Promotion
1. Promote `pfautosheetv3/v3-staging/codex/CX3/matrixEngine.ts` -> `src/engine/matrix/matrixEngine.ts`.
2. Promote `pfautosheetv3/v3-staging/antigravity/AG3/{CharacterMatrixPanel,EditIndexModal,SotClassifiedPicker}.tsx` -> `src/components/tools/matrix/`, updating `../../codex/CX3/matrixEngine` -> `../../../engine/matrix/matrixEngine` and `../../../../src/` -> `../../../`.
3. In `src/components/tools/ClassArchitectModal.tsx`, uncomment `// AF7-PROMOTE: import { CharacterMatrixPanel } from './matrix/CharacterMatrixPanel';` and render `<CharacterMatrixPanel character={character} onUpdateCharacter={onUpdateCharacter} />` as the default for `viewMode === 'matrix'`.
