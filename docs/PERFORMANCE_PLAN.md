# PF1MW performance plan

Keep the first sheet responsive with the network disconnected, then scale SOT retrieval and sheet editing before adding a Foundry VTT connection. The [Foundry VTT project map](FOUNDRY_VTT_PROJECT_MAP.md) defines which data can cross that connection.

## Baseline

Measured from `0f3c7e5` on Windows with Node 22.19.0 and Vite 8.3.5. The production build transformed 1,732 modules and Vite reported 1.04 seconds. Release bytes include files copied from `public/`. Browser startup, rendering, folder I/O, IndexedDB latency, and HTTP transfer timings still need browser traces.

| Build measurement | Baseline |
| --- | --- |
| Initial JavaScript entry | One file, 1,302.65 kB minified, 336.36 kB gzip |
| Initial CSS | 163.33 kB, 21.75 kB gzip |
| Build output with public files | 27,875,893 bytes (26.58 MiB) |
| Bundled icons and portraits | 25 PNGs, 22,801,178 bytes, about 82% of build output |
| Default sidebar glyph | 496,422-byte, 1254 × 1254 PNG drawn at 20 × 20 CSS pixels |

To reproduce the build figures in PowerShell without replacing the normal output, run `npm.cmd run build -- --outDir $perfOutput --manifest` with `$perfOutput` set to a new temporary directory. Record the Vite sizes and manifest, total bytes on disk, and the current commit. Vite’s gzip estimates describe a compressed response. Actual response bytes depend on how the sheet is served.

CPU spot checks used `performance.now()` after 10 warm-up calls on the same Windows machine. These are local samples for choosing work, with no browser, persistence, or network I/O. The populated character fixture uses 500 inventory items and 500 buffs, with 125 active. The larger serialization fixture adds 24 legacy SOT pages containing both text and HTML. Each retrieval document has 25 short sections and 25 five-row lookup tables with the same vocabulary. The distinct-table fixture gives each table a different caption. The repeated-table fixture uses equal table markup across different sections.

| CPU operation | Samples | Median | P95 |
| --- | ---: | ---: | ---: |
| Resolve combat and career for the default character | 500 | 0.021 ms | 0.048 ms |
| Resolve combat and career for the populated character | 500 | 0.079 ms | 0.109 ms |
| Stringify a 12,492-byte default snapshot | 500 | 0.038 ms | 0.046 ms |
| Stringify a 1,610,329-byte legacy snapshot | 100 | 3.41 ms | 3.95 ms |
| Ingest one 25-section document with repeated tables | 100 | 5.56 ms | 6.21 ms |
| Select SOT evidence across 10 documents with distinct tables | 100 | 3.84 ms | 4.91 ms |
| Select SOT evidence across 100 documents with distinct tables | 100 | 43.2 ms | 46.4 ms |
| Select SOT evidence across 10 documents with repeated tables | 100 | 59.6 ms | 63.4 ms |
| Select SOT evidence across 100 documents with repeated tables | 100 | 608.0 ms | 705.8 ms |
| Evaluate `<<[10+5]` with an existing macro context | 1,000 | 0.013 ms | 0.020 ms |

For each 25-table input, ingest built 25 tables. The distinct-table fixture had 25 section-to-table links and 25 section owners. The repeated-table fixture had 625 links, and all tables pointed to the last matching section. This incorrect association also increased retrieval work. Both 100-document runs returned fewer than 12,000 characters. [Table extraction and section assignment](../server/ingest/ingest.ts#L223)

## Work in priority order

| Priority | Change | Acceptance gate |
| --- | --- | --- |
| 1. First paint and offline startup | Render the core sheet and navigation first. Load Class Architect, AI Companion, SOT Library, Formula Studio, Image Browser, and export code when opened. Today the shell imports all pages and tools eagerly, and keeps many closed tools mounted. Vite also reports that a dynamic exporter import is ineffective because other callers import it statically. Test draft preservation when tools close and keep print and standalone export working. | Provisional first-route JS budget of **220 KiB gzip**. Verify cold startup, initial usability offline, no deferred tool-code fetches on the default route, and repeat open with preserved draft state where applicable. [Shell imports](../src/App.tsx#L20) · [Tool mounts](../src/App.tsx#L380) · [Standalone build](../vite.singlefile.config.ts) |
| 1. Asset size and delivery | Generate 40/80px glyph previews and responsive portrait sizes. Use an explicit asset manifest for the web and installer and keep support for previously saved PNG URLs. Move opt-in downloads out of the initial asset set and label their version. Bundle a small font subset or use system fallbacks for offline startup. | Default sidebar image **10 KiB or less**. Installed web assets **under 12 MiB** before optional downloads, subject to image quality and release compatibility. [Sidebar preview](../src/components/workspace/BlueprintSidebar.tsx#L207) · [Glyph URL contract](../src/data/glyphs.ts#L92) · [Fonts](../index.html#L13) · [Installer packaging](../installer/Package-PF1MW.ps1#L130) |
| 1. SOT table association | Assign tables to sections by each occurrence’s source offsets during ingest. Preserve distinct IDs for identical tables in separate sections. Version and refresh persisted indexes generated by the old association logic when the original source is available. | Both 25-table fixtures have **25 links and 25 owning sections**. Test headings, provenance, and old catalogues with and without an available original. [Section assembly](../server/ingest/ingest.ts#L223) |
| 1. SOT selection | Load query term metadata once per character and select candidate documents and sections before reading and formatting source bodies. Cache parsed artifacts and normalized section/table data by character, provider, and content hash. Invalidate on edit, deletion, character switch, or a Foundry provider revision. Keep candidate counts bounded, cancel superseded requests, and move heavier client ranking to a worker with an offline fallback. Track generated excerpts separately from AI network time. | Existing ranking, table, and no-match fixtures still pass. Both 100-document fixtures have **p95 below 100 ms** for warm selection and formatting on the reference machine, **no retrieval task over 50 ms on the UI thread**, and evidence at most **12,000 characters**. Measure cold folder and IndexedDB reads separately. [Per-turn artifact loading](../src/engine/aiService.ts#L2862) · [Section and table scoring](../server/sotContext.ts#L194) · [Global ranking and packing](../server/sotContext.ts#L328) |
| 2. Editing and save I/O | Profile note typing, HP updates, and large inventory and actions lists with React Profiler and a browser performance trace. Keep unrelated sheet groups and the hidden print view out of hot edits. Move large raw docs and image data into asynchronous local storage with references. Replace whole-character synchronous `localStorage` writes on each edit with a coalesced session checkpoint and verify recovery on close and restart. Measure named-save I/O before skipping unchanged projections and create static folder readmes only as needed. Preserve serialized writes, checksum verification, and crash recovery. | On the populated fixture, **p95 under 50 ms** from keystroke to paint in the reference browser profile and **zero synchronous full-character writes per keystroke**. Save tests cover edits arriving mid-save, canceled shutdown, previously saved sheets, and offline recovery. [Context cache and derived state](../src/context/CharacterContext.tsx#L205) · [Print view](../src/App.tsx#L252) · [Crash debounce](../src/storage/useAutosave.ts#L37) · [Verified file write](../src/storage/fsAdapter.ts#L601) · [Named-save projections](../src/storage/fsAdapter.ts#L886) |
| 3. Macaroni and projections | Keep the simple macro and combat selectors as controls. Measure richer macros with hundreds of custom objects and repeated references. If parsing dominates, cache only immutable parsed syntax per text and DSL version, and build a lookup index per custom-object revision. Add an explicit evaluation work budget before allowing new remote inputs. Preserve fresh rolls, sheet scope, and exactly-once mutation semantics. | Representative macros have **p95 under 10 ms** on the populated fixture and keep existing output, roll, and stepper persistence behavior. Verify changes against the existing Macaroni tests. [Macro execution](../src/engine/macaroni/evaluator.ts#L2386) · [Fresh dice behavior](../src/engine/macaroni/evaluator.ts#L953) · [Custom-object lookup](../src/engine/macaroni/evaluator.ts#L696) · [Combat and career derivation](../src/engine/characterIntegration.ts#L205) |

## Benchmark and release checks

1. Capture cold and warm runs in Chromium with the default and populated synthetic sheets. Record browser version, machine, network/CPU profile, route, and commit. Record transferred bytes, long tasks, interaction timing, and time to usable sheet. Use local fixtures and a stubbed AI provider.
2. Track IndexedDB and folder reads, candidate counts, selection time, selected section counts, and output size for 10 and 100 documents. Track serialization time, save duration, and bytes written separately. Store timings and counts without document content, character names, or prompts.
3. Run type checking, unit tests, and both browser and standalone build checks. Exercise startup with the network disabled, volatile and durable recovery, existing saved image URLs, print, and a newly installed runtime. Once measurements are repeatable, enforce the JS and asset budgets in CI and track latency against the recorded reference profile.
