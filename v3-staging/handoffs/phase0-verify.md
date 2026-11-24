# Phase 0 verification

## Work done

- AF0 / B7 / I9: searched the checked-out repository, available GitHub branches and pull requests, and recent repository session history for the claimed `sotContext.test.ts` work and its 12k SOT / 8-message caps. No matching test or cap implementation was found in the sources checked. Treat B7 as not found and rebuild it in AF3 after its dependencies are complete.
- The referenced `LAZY\sheet-engine\README.md` is not present in this checkout or the bundled workspace ZIP, so a comparison could not be made.
- The available sample SRD at `save tree test/armorist.srd.json` has the `PF1E_SOT_READONLY_SRD_V1` format field.
- The package version currently reads `0.0.0`; it is not the stated v3 target `1.3.0`.

## Files altered

- None.

## Files created

- `v3-staging/handoffs/phase0-verify.md` — records Phase 0 findings and outstanding checks.

## Tests

- Read-only repository and GitHub searches only; no tests run.
- Local search found no `sotContext.test.ts`, 12k cap, or 8-message cap in this checkout.
- GitHub branch and pull-request searches and file-list checks found no `sotContext.test.ts`.
- Recent session-history search for this repository and test returned no rows.

## Open issues and requests

- The required live DevTools XPath confirmation (Phase 0.2) was not performed; record the component, label, and stable selector before hiding anything.
- The specific pf1mod source file and `<folder>\AIgamesheet\pfmusers\Crash\character.json` are not available in this environment. The sample SRD check does not establish the canonical pf1mod folder; Austin's choice remains pending.
- AF1 and later phases remain blocked on completing the Phase 0 data checks and the stated phase dependencies. AF7 also requires all specified handoffs and Austin's explicit instruction to connect the work.
- The unrelated failed release workflow run from 2026-11-01 failed at `npm ci` due to Vite 8.3.5 requiring esbuild `^0.27.0 || ^0.28.0` while the project pinned `^0.25.0`. No changes were made for that historical failure.
