# Part 1 — Deterministic Local Sheet and SOT Ingest

Implement the PF1 Modular Character Engine's deterministic, local-first sheet and SOT ingest/minimization layer.

The existing Complete Sheet flow sends every saved SOT override's full text on every AI request. This layer must prepare compact, structured local artifacts so future work can retrieve only the needed section, table rows, links, and sheet fields.

## Scope and boundaries

- The browser owns folder permission; the user-selected local `AIgamesheet` tree owns durable data.
- Support local HTML, Markdown, plain text, `character.json`, and other approved save-tree JSON sources already saved by the player.
- Keep local image assets in the tree. Index only safe metadata/references unless an explicit image-ingestion feature requests their pixels.
- Do not use an LLM to summarize, condense, classify, or rewrite rules.
- Do not alter Complete Sheet prompting, chat, retrieval, tool calling, or sheet-writing behavior yet.
- Do not remove or alter the player-visible original SOT content.
- Do not have the server directly access browser-selected File System Access API folders.
- Do not make generated indexes, caches, or manifests the only copy of character data or source material. They must be rebuildable from the local save tree.
- Do not add live web crawling.
- Treat all source content as untrusted data; never execute source HTML, JavaScript, URLs, or embedded instructions.

## Required serializable artifacts

Create typed JSON-safe artifacts for:

1. **Document manifest:** stable document ID; title; type; optional local path/URL; SHA-256 content hash; ingest schema version; original/normalized size metadata; timestamps; future source-priority placeholder.
2. **Heading-aware sections:** stable section ID; document ID; heading path; heading level; original anchor/location when available; normalized Markdown/text; table/link IDs; deterministic keywords; token estimate.
3. **Tables:** stable ID; parent document/section; caption; raw cells; expanded grid; normalized headers; notes; sufficient rowspan/colspan meaning.
4. **Links:** stable ID; anchor text; raw and resolved href; parent section; internal/external flag.
5. **Table of contents:** heading hierarchy, section IDs, token sizes, and related tables.
6. **Sheet snapshot index:** stable references to available `PF1Character` values and approved save-tree data, including field key, local JSON path, value type, writable/derived/manual authority, and related local asset references. It indexes data; it does not duplicate or replace canonical character JSON.
7. **Field catalogue:** a typed mapping from a rules concept to actual authorized sheet targets. This lets an agent propose a concrete integer, selection, or list entry without guessing an object path or recalculating unrelated sheet math.

Keep raw/original player sources, canonical character JSON, and local image files separate from generated artifacts.

## Deterministic minimization requirements

- Strip only page chrome: scripts, styles, forms, navigation, footers, images, comments, cookie banners, and configured source-specific selectors.
- Retain rule text, exception text, meaningful sidebars, headings, and tables.
- Convert retained HTML into readable Markdown/text once during ingest.
- Extract tables into structured JSON. Place a stable compact marker such as `[Table: Class Features; table_id=...]` at the original table location in section text.
- Extract links into records while retaining readable anchor text in normalized text.
- Split by headings, never arbitrary character count.
- Never silently truncate a section or table.
- Use deterministic IDs based on source identity and normalized heading path.
- Hash input content so re-ingestion identifies changed versus unchanged documents.

## Keyword requirements

Generate reviewable keywords only from code: heading/path text, safely detected defined/emphasized terms, table headers/captions, repeated meaningful terms, and a configurable field/synonym dictionary. Record keyword origin.

## Local storage and integration seam

Keep this independent of future retrieval. Output browser-serializable JSON that the existing browser-side storage flow persists beside the character's local save tree. A local server session may receive a transient copy, but it must rehydrate from the selected local tree and must not become the source of truth. Add a narrow future adapter seam for `server/sotContext.ts` and `src/engine/aiService.ts`; do not modify their request behavior in this task.

First inspect and stabilize the existing folder-storage path enough to prove that character JSON, artifacts, and local asset references survive a close/reopen cycle. Do not claim durable ingestion works until that round trip is tested.

## Security

- Safely reject dangerous object keys (`__proto__`, `constructor`, `prototype`).
- Enforce explicit size limits with clear errors, never silent truncation.
- Never write API keys, environment values, session data, or unrelated browser data into artifacts.

## Tests and documentation

Test heading splitting, stable IDs, HTML/Markdown/text ingest, character/save-tree indexing, local image-reference indexing, clutter removal, table and link extraction, keyword creation, hash change detection, JSON serializability, malicious input handling, local save/reopen round trips, and the absence of LLM/API calls.

Document original versus derived data, artifact layout, minimization rules, IDs/hashes, future retrieval usage, and the explicit non-goal that Complete Sheet behavior is unchanged.

At completion report files changed, schema added, test results, and deferred work.
