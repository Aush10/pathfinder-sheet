# Changelog

## 1.3.0 — 2026-11-25

### Added

- Deterministic SOT ingest for HTML, Markdown, text, SRD JSON, and supported
  character-sheet JSON, producing `table.json`, `links.json`, `text.md`, and
  `index.json`.
- Deterministic class-grid, extended-grid, casting-subgrid, and lookup-table
  classification, including stacked PFSRD spell headers.
- A standalone SOT panel with batch upload, pasted-page queues, artifact
  viewers, per-character persistence, and web-link support.
- Bounded SOT retrieval with a 12,000-character evidence budget and capped
  conversation history.
- Character Matrix and Career Index engine/UI with legacy migration, 40-row
  support, notation parsing, append, assign, bind, cleanup, and apply-to-sheet.
- Classified SRD class extraction that preserves named numeric columns and
  only uses bounded skill/proficiency fields.
- Structured spell tables, Spell Book pages, slot resources, casting
  confirmation/alternate casting, and Run Stepper wiring.
- Persistent Macaroni `!` counters, import/export envelope support, connected
  folder exports, and aligned installer/runtime packaging.

### Changed

- Promoted v3 SOT, Matrix, spell, export, ingest, and server work into `src/`
  and `server/`.
- Made Class Architect the mounted Add Class experience.
- Switched Complete Sheet and lookup requests to compact indexed SOT evidence.
- Removed active demo SOT fallbacks and Slayer prompt examples.
- Defaulted currency reconciliation to Current GP; bank value now requires an
  explicit opt-in.
- Renamed the package to `pathfinder-1e-modular-workspace` and set version
  `1.3.0`.

### Fixed

- Crash recovery, connected-folder reuse, named-save restoration, and export
  fallbacks.
- Class ID collisions, archetype feature pollution, class-grid column loss,
  class-name leakage, and lookup tables being treated as class grids.
- Loadout/save-tree imports, blank character names, FileReader errors, and
  connected-folder export destinations.
- Express production routing, `PORT` fallback, occupied ports, SOT host
  allowlisting, safe redirects, and obsolete Gemini route aliases.
- Cross-platform cleanup, Vite ESM configuration, ignored staging, and stale
  repository debris.
- Default XDX formulas now use valid Macaroni 1.2 sigils.

### Removed

- Approved orphaned components and dead wiring, duplicate root icon assets,
  stale bundles/builds, obsolete API-key helpers, Gemini aliases, and
  superseded root notes.

### Verification

- `npm ci`: passed, 0 vulnerabilities.
- `npm test`: 133 passed, 0 failed, 0 skipped.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run build:standalone`: passed.
- Runtime package: 88 allowlisted entries, no `.env.local` or `node_modules`.
- API smoke test: `/api/openai/status` passed without credential exposure.
- Browser smoke test: SOT Library and Class Architect/Character Matrix entry
  points rendered successfully.

### Known deferred work

- The original SOT section in `AICompanionModal.tsx` remains by roadmap
  decision.
- Templates and hidden-table generation remain deferred.
- The release workflow does not yet run `npm test`.
- The main client chunk remains above Vite's 500 kB warning threshold.
