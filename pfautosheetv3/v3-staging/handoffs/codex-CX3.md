# CX3 handoff — Character Matrix engine

## Delivered

- Added generic Matrix types in `src/types/character.ts`:
  `MatrixColumn`, `MatrixRow`, `UserMatrixIndex`, `CareerIndex`, source
  assignments/bindings, and the optional coin-container field. Existing saves
  remain valid because all new character fields are optional.
- Added the pure, UI-free Matrix engine in `codex/CX3/matrixEngine.ts`.
  - Migrates legacy `CustomClassGrid` rows losslessly.
  - Generates collision-free ids (B11), normalizes headers (`BAB` / `Base
    Attack Bonus`), and derives rather than persists the Matrix.
  - Parses all approved header/cell notation: `=wizard`, `+1>3`, `+1!2`,
    `fighter4`, `*wizard`, and include/exclude filters.
  - Uses the decided count behavior: `fighter4` makes the following plain
    `fighter` read level 5.
  - Performs first/dominant merge inside comma gestalt cells and highest
    numeric merge across tracks. Tracks count independently.
  - Exposes green/red/yellow states, a 40-row guard, row zero, append,
    assign/auto-assign, bind, cleanup, row/column, and autofill primitives.
  - Creates SRD indexes only from `class-grid`, `extended-grid`, and
    `casting-subgrid`; lookup tables are impossible to merge. Spell columns
    retain the classifier's `spd_*` / `sk_*` headers.
  - Maps `<act>`, `<rec>`, `<spell>`, and `<feat>` suffixes for the UI/apply
    layer.
- Added `applyMatrixProgressionToCharacter()` to
  `src/engine/characterIntegration.ts`. This is the explicit Matrix
  apply-to-sheet boundary; it projects non-empty derived rows into level, BAB,
  base saves, and deduplicated abilities. Legacy
  `applyCareerProgressionToCharacter()` stays intact for pre-Matrix UI/saves.

## Files altered

- `src/types/character.ts` — generic Matrix/Career Index and currency-container types.
- `src/engine/characterIntegration.ts` — explicit derived-Matrix projection.

## Files created

- `pfautosheetv3/v3-staging/codex/CX3/matrixEngine.ts`
- `pfautosheetv3/v3-staging/codex/CX3/matrixEngine.test.ts`
- `pfautosheetv3/v3-staging/handoffs/codex-CX3.md`

## Verification

```powershell
node_modules\.bin\esbuild.cmd pfautosheetv3\v3-staging\codex\CX3\matrixEngine.test.ts --bundle --platform=node --format=cjs --outfile=$env:TEMP\cx3-matrix.test.cjs
node $env:TEMP\cx3-matrix.test.cjs
npx tsc --noEmit --pretty false
npm run build
```

- Focused Matrix suite: 7 passed.
- Typecheck: passed.
- Production build: passed. Existing Vite `__dirname` and bundle-size warnings remain.

## Adoption notes

1. AG3 should import the staging engine (or AF7-promoted `src/engine/matrix`)
   and render `deriveMatrix(character.matrixIndexes ?? migrateClassGrids(...),
   character.careerIndex)`. Call `applyMatrixProgressionToCharacter` only from
   the explicit Apply action.
2. The Matrix view has 20 default rows and can expose real rows 21–40. Do not
   save `DerivedMatrix`; save only `matrixIndexes` and `careerIndex`.
3. AF7 promotes `matrixEngine.ts` to `src/engine/matrix/`. The type and apply
   boundary are already in their production locations.
4. This does not implement UI, spell-slot resource behavior, hidden tables, or
   spell merge rules; those remain with AG3/AG6/AF8 as scoped.
