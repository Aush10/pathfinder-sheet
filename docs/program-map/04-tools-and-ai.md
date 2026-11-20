# 4. Tools and the AI path

## Tools

Mounted from `WorkspaceShell` unless noted. "Writes" means `PF1Character` or `localStorage`, not the folder tree. The folder sees those edits only on Save, crash autosave, or Connect.

| Tool | Opened from | Writes | Engine |
| --- | --- | --- | --- |
| `DiceRollerTray` | Sheet roll buttons. Sidebar prop is unused. | Local roll history only | `executeDiceRoll` |
| `PointBuyModal` | Sidebar | `pointBuyBudget` and ability bases via `applyBaseScores` | `getPointBuyCost` |
| `QuickHPBar` | Never. State starts false and nothing sets it true (`src/App.tsx` 73). | Would call `updateHP` | — |
| `BuffBoxModule` modal | Sidebar | `buffBox`, `customBuffs` | `computeBuffBoxTotals`, Macaroni via `projectMacaroniResult` |
| `StepperTool` | Mounted. `AICompanionModal` receives `onOpenStepper` and never calls it, so the tool does not open from the AI modal. | `stepperRules` | Local stepper parsing |
| `DeckTool` | Sidebar | `deckState` | In-component shuffle |
| `XDXTool` | Sidebar | `xdxMacros`, and HP or other fields if a macro's projection says so | `executeMacaroni`, `projectMacaroniResult` |
| `MacroDebugTool` | Sidebar "Trace". Escape does not close it. | Whole character from `projectMacaroniResult` | Same |
| `LoadoutModal` | Sidebar | Merges sections of the character. Presets in `localStorage` `pf1e_user_loadouts`. | `exportCSV` |
| `AddClassModal` | Sidebar and page 1 | `customClassGrids`, `careerData`, then `applyCareerProgressionToCharacter` | `parseSrdSkillsAndProficiencies`, `adaptArchetypeIntoGrid` (server generate), `extractClassFromSrdDoc` |
| `ClassArchitectModal` | **Not imported by the app.** Tests import its parsers. | Same career fields, if it were mounted | Same family as Add Class |
| `CMBTool` | Sidebar and page 1 | `conditions.grappled` / `pinned` | Derived stats; rolls go to the dice tray |
| `NewSheetModal` | Header and sidebar | `resetToBlankSheet` or `resetToDefaultSheet` | `exportJSON` as a backup |
| `ImageFileBrowserModal` | Header, sidebar, sheet image buttons | The modal stores up to 30 data URLs in `pf1e_image_library_v1`. The character URL is written by `applyImageSelection` in `App.tsx` 460. | FileReader and `canvas.toDataURL('image/png')` |
| `ImageBrowserModal` | **No imports.** Older preset-and-URL picker. | — | — |
| `JournalModal` | Sidebar | `journal`, scratchpad, `rollupNotes` | `generateJournalEntryInVoice` (server), `generatePencilSketch` (local canvas) |
| `AICompanionModal` | Sidebar, and from Add Class / Journal | See below | See below |
| `GlyphPicker` | **No imports.** Glyph choices are inlined in `ImageFileBrowserModal`. | — | — |
| `DSLBibleDrawer` | **No imports.** | Would be a read-only formula sandbox | `evaluateFormula`, `computeDerivedCharacterStats` |
| `FloatingAlertCard`, `InteractiveQueryModal` | Macaroni window events | None; the query callback returns the choice to the macro runner | — |
| `FieldCallTooltip` | Sheet pages | Copies a `#CALL` token | — |
| `AppleEyeIcon` | AI, Add Class, Complete Sheet | None | — |

## AI companion modal

`src/components/tools/AICompanionModal.tsx` is the AI UI. The tab type is `'permissions' | 'lookup_sot' | 'macro'` (line 85). The visible tabs are Settings and Lookups & SOT (about 1224–1246). `setActiveTab('macro')` does not occur. The macro panel at the `activeTab === 'macro'` branch is unreachable. Journal asks for `initialTab: 'journal_settings'` (`JournalModal`); `normalizeTab` (about 282–287) maps only lookup aliases to `lookup_sot` and everything else to `permissions`, so that request opens Settings. The journal voice/art controls live inside the permissions render, not a third tab.

`App.tsx` 475–487 passes `onOpenBuffBox`, `onOpenStepper`, and `onNavigateToDSLPage`. Those props are declared (143–145) and not referenced in the component body.

What the modal does write:

- `installedModules.aiSettings`: per-field and per-module blind spots (`handleUpdateSettings`, toggles around 409–468). Defaults are `DEFAULT_AI_MODULE_SETTINGS` in `aiService.ts` (about 43–87).
- `sotCatalogue.weblinks`, `overridePages`, and `macaroniSuggestions`. Saving a page runs `sanitizeSrdDocument`, then `saveSrdDocToHostDeviceStorage` (localStorage), then merges the page into the character (about 860–917). Import and "sync host" use the same localStorage index (763–858).
- Lookup apply can append a feat or an action if that field is allowed (about 501–563).
- The field inspector runs `parseNaturalLanguageSheetUpdates` and then each action's `apply` (about 1118–1134).
- Embedded `CompleteSheetChatWindow` on the lookup tab (about 2346–2352).

Single-page SOT snapshots call `POST /api/sot/fetch-readonly-page` (about 700–708) and store the sanitized text on the weblink.

## Complete Sheet

`CompleteSheetChatWindow.sendTurn` calls `completeSheetConverse` and, only when `appliedActions.length > 0`, replaces the character (`onUpdateCharacter(() => result.updatedCharacter)`). A quick SOT upload in the chat writes `sotCatalogue.overridePages` directly after `sanitizeSrdDocument`. Typing `tap test` sets `tapTest: { step, budget }` on later turns.

The client does **not** POST the whole `PF1Character`. `completeSheetConverse` sends (`aiService.ts` around 3022–3033):

- `conversation` (role and text)
- `characterSummary` (a text digest built on the client)
- `sotOverridePages` and `sotWeblinks` (full saved pages and links, unless `allowedModules.sotCatalogue` is false, in which case `buildSOTContextForAI` returns empty)
- `allowedFields`
- optional `tapTest`

The server returns `{ rawText }`. The client parses JSON and calls `runCompleteSheetWrites`, which calls `applyStructuredSheetUpdates` and the English parser, then `filterTapTestUpdates` when a tap-test step is active.

## HTTP API

Registered in `server/routes.ts` 286–298. There is no session or bearer check. Missing `OPENAI_API_KEY` returns 503 from `missingApiKeyResponse` (`server/openai.ts` 8–10 and 90–94).

| Route | Body in | Body out | Notes |
| --- | --- | --- | --- |
| `GET /api/openai/status` | — | provider, whether a key is set, model list | Public |
| `POST /api/openai/generate` | `prompt` (required), `systemInstruction`, `responseMimeType`, `urls` | `{ text }` | At most 20 URLs are appended to the prompt (`routes.ts` 31–34). If URLs are present the handler sets `config.tools = [{ urlContext: {} }]`. `generateContentWithFallback` never reads `tools` or `responseMimeType`; it only sends chat `messages` (`openai.ts`). |
| `POST /api/openai/lookup` | `query`, `category`, `modifiers`, `sotOverridePages`, `sotWeblinks`, `characterSummary` | `{ text, sourceUrls }` | System prompt `LOOKUP_SYSTEM_INSTRUCTION` (`prompts.ts`). Full SOT text via `formatOverridePages`. |
| `POST /api/openai/complete-sheet` | conversation, summary, SOT pages, weblinks, `allowedFields`, `tapTest` | `{ rawText }` | System prompt from `buildCompleteSheetSystemInstruction`, including `formatBlindSpots` and `formatCompleteSheetOverridePages`. |
| `POST /api/gemini/generate`, `/lookup`, `/complete-sheet` | same as the OpenAI routes | same | Aliases to the OpenAI handlers (`routes.ts` 295–297). `server/gemini.ts` is gone. |
| `POST /api/sot/fetch-readonly-page` | `{ url }` | sanitized HTML/text and an audit | Requires `http:` or `https:`. Rejects strings that look like webhooks. 7s timeout. Caps HTML and text length. Strips script, iframe, style, nav, and footer. **No host allowlist**: the server GETs the URL the browser sends (`routes.ts` handler `handleSotFetchReadonlyPage`). |

`server/openai.ts` POSTs `https://api.openai.com/v1/chat/completions`. Model order is `OPENAI_MODEL` if set, then `gpt-4o-mini`, then `gpt-4o` (1–6). A failed model is retried on the next name. Tests in `server/openai.test.ts` lock this to the OpenAI host (a key error does not switch providers).

## Other client AI functions

All of these except the sketch and the local parsers go through `callServerOpenAIGenerate` → `/api/openai/generate`:

| Function | Used for |
| --- | --- |
| `lookupRulesWithSOT` | Companion lookup. Scans local SOT text first, then the lookup route. |
| `generateMacroFromEnglish` | DSL draft. The user still has to save it. |
| `generateBuffFromEnglish` | Buff draft. |
| `generateJournalEntryInVoice` | Journal modal. |
| `adaptArchetypeIntoGrid` | Add Class / Class Architect. |
| `executeScratchpadAIMacro` | Appends model text to the scratchpad. |
| `generatePencilSketch` | Local canvas, no network. |
| `parseSrdSkillsAndProficiencies` | Local. |
| `getSessionApiKey` / `setSessionApiKey` / `clearSessionApiKey` | `getSessionApiKey` returns `''`. The setters do nothing (`aiService.ts` 37–41). Modals still pass the getter. The key lives only in server env. |

## Guard rails that actually run

- Blind spots: a Complete Sheet update whose category is disabled is not applied. The model still receives the field list and can talk about it.
- Secret-like keys in a proposed update are rejected.
- Point buy and random ability arrays are checked in `applyAbilityWrite` before they touch the sheet. Tap Test is the path that sets `allowRandom`, and only on the abilities step.
- Class mechanics that are not in the pasted SOT text become a question (`missingSotRequest`) instead of a filled grid.
- SOT HTML pasted into the catalogue is passed through `sanitizeSrdDocument` first. That is a string filter, not a browser sandbox.
- The readonly-page proxy strips tags and caps size. It does not restrict the host.
- Disk content is not inserted by the server. The client chooses the summary and the SOT pages to send. Saved pages are sent in full, which is the behavior `server/sotContext.ts` implements (`formatOverridePages`, `formatCompleteSheetOverridePages`).
