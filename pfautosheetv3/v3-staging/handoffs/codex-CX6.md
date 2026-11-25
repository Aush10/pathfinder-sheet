# CX6 handoff — persisted Macaroni `!` counter

## Work done

Completed CX6 after AF2.

- Added the persisted `PF1Character.macaroniStepperStore`, keyed by the evaluator's hidden bang IDs.
- `normalizeCharacter()` accepts only finite non-negative numeric counter values, so saves/reloads retain valid counters without accepting hostile payloads.
- `projectMacaroniResult()` is now the one state-projection boundary for evaluator snapshots: it writes each `!` counter to the character and marks the macro operation as a mutation.
- XDX and Macro Debug now pass a copy of the saved store into `executeMacaroni`; successful `!` runs go through projection even if they have no buff/mutation. Trace-only Macro Debug runs remain non-mutating.
- Existing evaluator behavior remains: `!` increments before calculation, so its updated value appears in macro output.

## Files altered

- `src/types/character.ts` — persisted Macaroni counter-store field.
- `src/storage/characterState.ts` — safe counter-store normalization.
- `src/engine/characterIntegration.ts` — writes evaluator `stepperSnapshots` into saved character state.
- `src/components/tools/XDXTool.tsx` — supplies/persists the stepper store.
- `src/components/tools/MacroDebugTool.tsx` — supplies/persists the stepper store on Apply only.

## Files created

- `pfautosheetv3/v3-staging/codex/CX6/stepperPersistence.test.ts` — three-run save/reload acceptance test.
- `pfautosheetv3/v3-staging/handoffs/codex-CX6.md` — this handoff.

## Tests

- Bundled focused test with installed esbuild and ran it under Node: 1 passed, 0 failed. It proves `!` output 7 → 8 → 9 with a JSON serialize/reload between runs two and three.
- `npm run lint` — passed.
- `npm run build` — passed. Existing Vite `__dirname` and chunk-size warnings remain.

## Open issues and requests

1. `StepperTool.tsx` has a separate `stepperRules[].currentValue` tracker and does not call `executeMacaroni`; it remains unchanged by design. Its optional modal/UI touch-ups belong to AG4 after this handoff.
2. `actionDirectory.ts`, Formula Studio, and sheet display callers retain their existing `stepCount`/display-only behavior and are outside CX6's allowed scope. If any becomes a user-facing `!` execution path, it must pass/persist `macaroniStepperStore` through the same projection boundary.
3. CX7 may now add structured spell-table types after this persisted field; CX3 must preserve both fields.

## Do not include secrets

None written.
