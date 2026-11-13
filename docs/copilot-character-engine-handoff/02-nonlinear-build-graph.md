# Part 2 — Non-Linear Character Build Graph

Implement a dependency-aware character-build workspace. It is **not** a sequential character-creation wizard.

Players can start anywhere: concept, appearance, race, class, ability scores, equipment, spells, partial imports, or completed stat blocks. Each area is an independent compartment. The engine retains player input, reports missing prerequisites, validates only what it can validate, and marks only dependent compartments for review when something changes.

Part 1 provides typed local sheet/SOT artifacts. Consume only its interfaces where needed; do not implement ingestion, live retrieval, tool calling, narrator agents, or UI in this task.

## Do not

- force a current step or fixed order;
- let model output directly mutate `PF1Character`;
- hard-code PF1 rules from memory;
- treat supplied point-buy labels/budgets, HP policies, feat counts, or publisher lists as universal rules;
- change Complete Sheet routes, chat prompting, or UI;
- create an Apple Eye UI integration. Instead, emit typed source-needed requests.

## State model

Add a versioned, serializable `CharacterBuildState` separate from the display sheet. Include campaign/rules profile, module states, player choices, sourced facts, derived values, evidence, unresolved questions, source-needed requests, dependency metadata, audit log, and proposed/applied sheet patches.

Each value has one origin: `player`, `source`, `derived`, or `imported`.

The agent's normal job is not to independently calculate the whole sheet. It identifies the authorized target field, proposes the concrete value or selection, supplies source evidence where required, and lets the established sheet-calculation code recompute dependent values.

Modules have one status: `empty`, `draft`, `complete`, `blocked`, `needs_review`, `conflict`, or conditionally `skipped`.

Retain player input in blocked modules. Do not guess missing source facts.

## Dependency graph

Represent dependencies and invalidation explicitly in a registry/graph, not scattered conditionals. Examples:

- class/build-structure changes invalidate class kit, skills, feats, HP, BAB/saves, equipment assumptions, and spells;
- race/origin changes invalidate racial traits, speed, languages, ability adjustments, and affected skills;
- campaign source-policy changes invalidate rules-derived modules;
- concept, biography, and appearance never invalidate rules modules.

## Required modules

Build modules for campaign contract; concept/persona; appearance/identity; build structure; race/origin; class kit/career; ability scores; skills; feats; HP/resilience; equipment/wealth; derived combat validation; spells/magic; and final review.

The campaign contract covers house rules, homebrew, EitR/variants, source policy, permitted 3PP, level, ability method/profile, HP method, randomization policy, and standard/multiclass/gestalt mode. Do not model a fixed “class 2”; support arbitrary progression tracks through existing career data.

## Campaign/source policy

Make source precedence configurable:

`campaign/homebrew override → campaign variant → official PF1 → allowed 3PP → unverified/imported`

Point-buy profiles such as 10/15/20/25/custom are campaign configuration. Random generation requires explicit player consent, a configured method, and an audit record. A requested unavailable source must create a typed source-needed request.

## Existing utilities and patch contract

Reuse `PF1Character`, `CareerProgressionData`, `CustomClassGrid`, `applyCareerProgressionToCharacter`, `applyPointBuyToCharacter`, and existing authorized-write helpers. Generate validated proposed patches; use trusted existing code to apply and calculate them. Do not duplicate PF1 math.

Every proposed non-derived write must identify its field-catalogue key and authorized character target, literal typed value, origin, evidence when source-backed, and dependent calculations to refresh.

For example, the agent may propose a sourced hit-die size, a selected feat, or an integer rank allocation. Existing calculators then own HP, BAB, saves, modifiers, spell resources, prerequisites, and other derived results.

## Evidence

Rules-derived inputs require Part 1 evidence: document ID, section/table ID, verbatim quote, and source tier. Player-authored values do not. Imported values are retained but visibly unverified until confirmed or sourced.

The later provenance calculator must distinguish evidence supporting an input value from a deterministic calculation trace that explains a derived value from already-validated inputs. Quote matching alone is not proof that an agent interpreted a rule correctly.

## Tests and documentation

Test beginning with any module, blocked-state retention, precise invalidation, source-priority conflicts, standard/multiclass/gestalt structures, random-consent enforcement, unavailable 3PP/homebrew, invalid provenance, existing-calculation reuse, final-review accuracy, serialization, and migration.

Document that this is a connected set of build compartments rather than a forced sequence. Include a compact dependency/invalidation table.

At completion report files changed, state/module schema, existing utilities reused, test results, and deferred work for retrieval/tool-calling/Complete Sheet integration.
