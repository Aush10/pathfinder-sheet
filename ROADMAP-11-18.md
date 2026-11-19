# Pathfinder Sheet Roadmap — 11-18

# these changes are complete disregard this md and move on

**Date:** November 18, 2026  
**Goal:** Break the requested Pathfinder autosheet changes into small, independently testable tasks. The primary focus is the action/resource UI redesign for Antigravity; macro-engine changes are called out as dependencies, not folded into UI tickets.

## Recommended Antigravity starting sequence

Start with **A1 → A2 → A3**. That gives the new directory its core shape and one complete, useful item flow before expanding to every format. Keep each numbered task to one focused implementation/review cycle.

## Phase A — Foundation and directory shell

### A1. Define the action/resource data contract
- Agree on the persisted fields and compatibility rules for Resource, Ability, Spell, Counter, and Alt.
- Map existing action, resource, and spell data into the new model without losing saved characters.
- Keep the Apple Eye quick-fill behavior available in the new editor.
- **Done when:** old saved entries still load and edit; each new type has a written field list and clear ownership of its macro fields.

### A2. Replace the tabbed action/resource landing view
- Show a clean empty state when there are no listed entries.
- Replace “Add Action or Resource” with one **Add Action** button.
- Make the button open a format picker; do not build all five editors in this task.
- Preserve search/filter access and the existing theme styling.
- **Done when:** an empty character sees the empty state, and choosing a format starts the correct creation flow.

### A3. Build shared directory cards and editing behavior
- Add common list/card behavior: name, optional summary, expand/collapse description, edit, and delete.
- Make search and category filtering work across the new entry types.
- Keep existing entries visible during the transition.
- **Done when:** each supported entry can be found, expanded, edited, and removed without relying on tabs.

## Phase B — Ship the entry types one at a time

### B1. Resource editor and resource bar
- Fields: name, description, color, macro-call key, full macro, and stepper macro.
- Show current/max values in the colored bar and provide a button to run its stepper.
- Put description in the dropdown; keep edit/delete available on the entry.
- **Done when:** creating, editing, saving, and using a resource preserves its values and the stepper button invokes the intended macro.

### B2. Ability editor and ability card
- Fields: name, macro-call key, icon, type, DC macro, roll macro, action cost, and description.
- Support the built-in type tags and an **Add type** flow for custom tags.
- Show name and DC when present; provide dice, expand, edit, and delete controls.
- **Done when:** a saved ability displays consistently and its roll/DC actions call the configured macros.

### B3. Spell editor, availability, and journal list
- Fields: name, macro-call key, availability, icon, action cost, spell level, DC macro, roll macro, and description.
- Only available spells should populate the journal link/list requested in the notes.
- Keep spell availability separate from the existing prepared/cast slot behavior unless the product rules explicitly say otherwise.
- **Done when:** toggling availability updates the journal list and does not corrupt spell slots or cast state.

### B4. Counter entry
- Fields: name, description, icon, and total-count macro.
- Show name, icon, and evaluated total in the directory; put description in the dropdown.
- **Done when:** counters can be created, found, edited, and display their current total.

### B5. Ability and spell alternatives (Alts)
- Add an action to create an alternate from an existing ability or spell, without changing the original.
- Keep alts out of the default directory results; allow search to find them.
- Add the original entry’s opt-in indicator and a dog-ear control/menu to switch among its alts.
- **Done when:** users can find an alt through search or the original’s alt menu and return to the original without data loss.

## Phase C — Search and class integration

### C1. Searchable macro directory
- Make macro entries discoverable through directory search.
- Add the requested **Make tab** action and **Add to list** action for a selected result.
- **Done when:** a found macro can be added to the action list and opened from its tab/list entry.

### C2. Add class abilities after the new directory model is stable
- Connect class progression abilities to the action/resource directory.
- Avoid duplicate abilities when a class is added or progression is reapplied.
- **Done when:** class-granted abilities appear once, retain their source, and can be edited without breaking class progression.

## Phase D — Macro behavior and class-level formulas

These are engine work, not UI-only work. Complete the relevant semantics and tests before wiring new controls to them.

### D1. Write executable examples for the updated macro language
- Specify formula display (`<<...`), calculator grouping, encapsulated `{...}` values, completed `#...` values, Boolean comparisons/conditionals, and stepper state.
- Specify when results persist, when they refresh, and how each stepper keeps its own local state.
- Confirm Enter runs a macro and exits the macro box.
- **Done when:** each example in the notes has an agreed input, expected displayed value, stored value, and repeat-run behavior.

### D2. Implement and test macro-language semantics
- Add focused tests for display-vs-stored values, nested calculations, object references, conditions, and independent steppers.
- Keep dice expressions encapsulated in calculations as specified.
- **Done when:** the examples from D1 pass as tests, including repeated stepper runs and separate stepper state.

### D3. Repair hit-die macro and class-level references
- Fix the hit-die macro so it executes and receives the correct level/HD inputs.
- Support class-specific level references for multiclass/gestalt characters, including the requested Level A calculation.
- **Done when:** a multiclass character’s formula uses the intended class level and hit-die inputs, with a regression test for the reported failure.

## Phase E — Equipment currency UI

### E1. Add coin reconciliation and Auto Change
- Compare platinum, gold, silver, and copper totals against the displayed GP amount plus bank savings.
- Add an **Auto Change** button that distributes the selected amount into denominations using 10 gp / 1 gp / 0.1 gp / 0.01 gp.
- Highlight the button only when the totals do not reconcile.
- **Done when:** the example 111.11 gp converts to 11 pp, 1 gp, 1 sp, and 1 cp, and matching totals do not show a warning.

## Decisions to confirm before implementation

1. **Currency target:** Should Auto Change split the current GP balance alone, or current GP plus bank savings? The notes say coins should equal both, but do not say whether bank savings can be converted into carried coins.
2. **Stepper persistence:** The notes say a stepper value persists until re-run or sheet refresh; confirm whether refresh resets it or whether the value must survive reloads.
3. **Available spells:** Confirm whether “available” means known/ready for the journal, or whether it should affect the existing prepared/cast tracking.
4. **Alt visibility:** Confirm whether an alt is searchable only by its own name or also by the original ability/spell name.

## Source notes and current implementation touchpoints

- Original requirements: [pfautosheet changes 11-18.txt](./pfautosheet%20changes%2011-18.txt)
- Current action/resource directory: [SheetPage2ActionsSkills.tsx](./src/components/sheet/SheetPage2ActionsSkills.tsx)
- Current spell editor/list: [SheetPage3SpellsBio.tsx](./src/components/sheet/SheetPage3SpellsBio.tsx)
- Current equipment and coin totals: [SheetPage2SkillsGear.tsx](./src/components/sheet/SheetPage2SkillsGear.tsx)
- Existing action/spell/currency data types: [character.ts](./src/types/character.ts)
- Macro implementation: [macaroni/](./src/engine/macaroni/)
