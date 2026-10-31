# Pathfinder 1e Modular Workspace & Character Engine

An interconnected, 3-part Pathfinder 1st Edition character sheet and modular canvas workspace. It features a technical Blueprint-themed layout builder, a classic Parchment & Charcoal table-facing sheet with tablet/print optimization, an in-app player formula engine supporting custom objects and string-concatenation attacks, automated PF1e mathematical derivation, and a dockable utility toolkit.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate your clarifications and layout wireframe:

- **Confirmed: Dual-Interface Workflow (Blueprint Builder vs Tabletop Sheet)**:
  - **Modular Blueprint Workspace**: A cyan/navy blueprint drafting table where players can inspect available modules from the left-hand rail, toggle/reorder/drag them into pages, customize font/color themes, and configure custom formula objects.
  - **Tabletop Facing Sheet**: Rendered in **Parchment Tan** with **12pt Times New Roman Charcoal Black** (per your specification), switchable to **Dark Myth-Weavers** or **Printer-Friendly High-Contrast Monochrome** for tablet and physical play.
- **Confirmed: Player-Friendly Formula & Object DSL**:
  - Implements a reactive expression evaluator supporting:
    - Built-in character variables: `level`, `bab`, `str_mod`, `dex_mod`, `con_mod`, `int_mod`, `wis_mod`, `cha_mod`, `ac`, `hp_max`, etc.
    - Custom object formulas (e.g. `firebreath: 2d6 + (5 * floor(level/2)) + " fire"` yielding `2d6+10 fire` at level 5).
    - Concatenation & compound attacks (e.g. `mainattack: "Axe +" + (bab + str_mod) + " (1d8+" + str_mod + " slashing)"` combined with `firebreath` to yield `"Axe +4 to hit (1d8+4 slashing) and 2d6+10 fire"`).
    - Color-coded live syntax highlighting for dice expressions, math operators, numbers, and resolved text.
- **Confirmed: Automated PF1e Mathematics**:
  - Point buy calculator auto-summing point costs (PF1e standard scale 7-18).
  - Derived attributes: Ability modifiers `floor((score - 10) / 2)`, HP pool (current, max, temp, nonlethal, status flag), Saves (Base + Mod + Magic + Misc), AC breakdown (10 + Armor + Shield + Dex + Size + Natural + Deflection + Dodge + Misc, plus Touch and Flat-Footed), CMB/CMD with size adjustments, iterative attack penalties (+BAB/+BAB-5/+BAB-10/+BAB-15), Encumbrance thresholds based on Strength.
  - Skill ranks, class skill bonuses (+3 on trained class skills), Armor Check Penalty (ACP) deduction.

---

## 1. Overview & Core Concept

### What It Does
This application unites the granular completeness of classic Myth-Weavers and Google Sheet calculators with modern drag-and-drop modularity. Players and Game Masters can design custom page layouts without wasted whitespace, define complex abilities using natural player-friendly formulas, and switch instantly between a technical drafting mode (Blueprint) and an immersive play/table mode (Parchment & Charcoal).

### Target Audience & Persona
- **Pathfinder 1e Players**: Who need automated math without losing granular control over buffs, magic items, custom class features, and complex spell loadouts.
- **Game Masters / Tablet Users**: Who need a clean, responsive, single-glance dashboard or printable export during live combat and session tracking.

### Key Value
- Zero dead space: modules can be toggled on/off and arranged to fit character builds (e.g., martials don't need dead spell slots; pure casters can expand spellbook pages).
- Dynamic custom abilities that scale automatically with character level, attributes, and equipment without requiring manual recalculation every level-up.

---

## 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Character Name • Lvl 20 Fighter/Sorcerer • Mode [Blueprint | Tabletop] • Print│
├───────────────────┬────────────────────────────────────────────────────────────────────┤
│ MODULE PALETTE &  │ MODULAR WORKSPACE CANVAS                                           │
│ WORKSPACE TOOLS   │                                                                    │
│                   │ ┌──────────────────────────┐ ┌──────────────────────────┐         │
│ • Theme & Fonts   │ │ PAGE 1: CORE COMBAT      │ │ PAGE 2: SKILLS & GEAR    │         │
│   [Parchment Tan] │ │ • Ability Scores & Mods  │ │ • Skills Matrix & ACP    │         │
│   [Times New Roman│ │ • HP Tracker & Status    │ │ • Inventory & Encumbrance│         │
│                   │ │ • AC / Touch / CMD       │ │ • Currency & Languages   │         │
│ • Active Modules  │ │ • Weapons & Full Attack  │ │ • Feats & Traits         │         │
│   ☑ Abilities     │ └──────────────────────────┘ └──────────────────────────┘         │
│   ☑ Combat & AC   │                                                                    │
│   ☑ Skills Matrix │ ┌──────────────────────────┐ ┌──────────────────────────┐         │
│   ☑ Spellbook     │ │ PAGE 3: MAGIC & BIO      │ │ PAGE 4: FORMULA OBJECTS  │         │
│   ☑ Formula Studio│ │ • Spell Saves & Slots    │ │ • Custom player formulas │         │
│                   │ │ • Prepared Spells        │ │ • "firebreath" resolver  │         │
│ • Tools Dock      │ │ • Conditions & Debuffs   │ │ • Live syntax viewer     │         │
│   - Point Buy Calc│ └──────────────────────────┘ └──────────────────────────┘         │
│   - Dice RNG      │                                                                    │
│   - Quick HP Bar  │                                                                    │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
```

### Visual Themes & Typography
1. **Blueprint Mode (Workspace / Layout Tool)**:
   - Deep drafting navy canvas (`#0b1a2d`) with subtle grid coordinates (`#1d3557`), cyan blueprint accents (`#38bdf8`), and crisp mono/sans labels.
2. **Tabletop Mode (Tablet & Live Play)**:
   - **Default**: Warm, authentic **Parchment Tan** (`#f7f2e7` with subtle texture tint) with **Charcoal Black** text (`#1f2421`) rendered in **Times New Roman** (12pt baseline) with dark brass dividers.
   - **Myth-Weavers Dark**: Deep slate-black parchment (`#121417`) with crisp white/gold high-contrast borders and tabular grid formatting.
   - **Clean Print**: Pure monochrome high-contrast vector lines with print CSS optimization (`@media print` pagination and zero color ink bleed).

### User Interaction Flows
1. **Drafting & Layout**:
   - The user opens the left rail to see available PF1e modules (Abilities, Defenses, Combat Attacks, Armor, Skills, Inventory, Spell Slots, Spells Known, Bio/Traits, Conditions, Custom Objects).
   - Clicking or dragging a module places it onto the active page or creates new sub-sections.
   - Unused sections (e.g. Psionics or Spells for non-casters) can be hidden, eliminating wasted page real estate.
2. **Formula Creation & Execution**:
   - The user opens the Formula & Object panel.
   - Enters `firebreath = 2d6 + (5 * floor(level / 2)) + " fire"`.
   - The engine automatically parses dependencies (`level`), resolves `level = 5` to `2d6+10 fire`, and highlights dice rolls in amber, math in blue, and descriptors in green.
   - In a weapon or attack box, the player types `{mainattack} and {firebreath}`, producing a combined roll string with click-to-roll functionality.
3. **Interactive Table Play**:
   - Clicking on any skill, save, attack, or custom formula triggers the integrated **Dice Roller** with 3D-feel animations, d20 outcomes, critical threat detection, and modifiers.
   - HP damage and nonlethal damage inputs automatically update combat status flags (`Feelin' Fine`, `Staggered`, `Dying`, `Dead`).
   - Condition checkboxes (Fatigued, Shaken, Sickened, Entangled, Blinded, Prone) dynamically inject penalties into attack rolls, AC, and dexterity checks.

---

## 3. Key Product Decisions & Trade-Offs

### Custom Formula DSL vs Arbitrary JavaScript `eval`
- **Chosen Approach**: Built-in safe tokenized math and string expression parser (supporting math operations, standard functions `floor`, `round`, `ceil`, `min`, `max`, dice notation `XdY`, and string concatenation).
- **Rationale**: Completely safe (no arbitrary code injection or prototype pollution), highly predictable, and enables syntax highlighting and dependency tracking across sheet fields.

### Layout Storage: Modular Canvas with Persistence
- **Chosen Approach**: Reactive document model backed by LocalStorage and full JSON/CSV export and import.
- **Rationale**: Instant responsive performance on tablets and desktops, offline readiness, with easy data portability matching spreadsheet-style backups.

### Responsive Modular Grid vs Rigid Fixed PDF
- **Chosen Approach**: Flexible CSS grid with page-constrained aspect ratios for print/tablet view, combined with an interactive drag/toggle workbench.
- **Rationale**: Retains the authentic Myth-Weavers aesthetic while adapting seamlessly to tablets (iPad/Android) and physical printers.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Pathfinder 1e Application State                       │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │    Character Data     │ │   Layout & Modules    │ │  Formula Registry │  │
│  │ (Stats, HP, AC, Bab,  │ │ (Active panels, grid  │ │ (User objects,    │  │
│  │  Skills, Spells, Gear)│ │  order, active page)  │ │  macros, parsed)  │  │
│  └───────────┬───────────┘ └───────────┬───────────┘ └─────────┬─────────┘  │
│              │                         │                       │            │
│              └─────────────────────────┼───────────────────────┘            │
│                                        ▼                                    │
│                         Reactive Calculation Engine                         │
│             (Derives Mods, Saves, AC, iterative attacks, ACP,               │
│              Point Buy total, Conditions, and Formula trees)                │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
┌──────────────────────────────┐                         ┌────────────────────────────────┐
│   Blueprint Builder View     │                         │  Tabletop Facing Sheet View    │
│  • Module Palette Rail       │                         │  • Parchment Tan / TNR 12      │
│  • Theme & Font Customizer   │                         │  • Myth-Weavers Dark Theme     │
│  • Formula Playground Studio │                         │  • Tablet Optimized Touch      │
│  • Drag & Toggle Workspace   │                         │  • High-Contrast Print View    │
└──────────────────────────────┘                         └────────────────────────────────┘
```

### Component Breakdown
- **`WorkspaceShell`**: Top navigation header, view mode switch (Blueprint vs Tabletop vs Print), quick character selector, import/export controls.
- **`BlueprintSidebar`**: Module catalog, layout page manager, theme picker (Parchment, Myth-Weavers Dark, High-Contrast Print), font picker (Times New Roman, Classic Serif, Sans, Mono), and tools dock (Point Buy, Quick HP, Dice Bag).
- **`SheetCanvas`**: The primary 3-page rendering surface:
  - **Page 1: Core Combat & Attributes**: Ability scores, HP tracker, AC & defenses, Initiative, Speed, Saves, Base Attack & Iteratives, Weapons & Attacks, Armor/Protective gear, Feats.
  - **Page 2: Skills, Inventory & Equipment**: Full 35-skill PF1e matrix with Class Skill checks and ACP derivation, Weight & Encumbrance thresholds, Currency pouches, Gear breakdown, Languages.
  - **Page 3: Magic, Bio & Conditions**: Spell save DCs & slot matrix (0-9th level), Spells Known/Prepared tracker, Status/Conditions with live stat penalties, Bio & Traits, Statblock generator.
- **`FormulaEngine`**: Lexer and evaluator for player-defined objects, dice expressions (`2d6+5`), and dynamic concatenation (`axe + firebreath`), with visual syntax token rendering.
- **`DiceRollerModal`**: Floating or embedded interactive dice tray with formula breakdown, critical confirmation, and history log.
- **`PointBuyCalculator`**: Interactive stat allocator showing raw score vs racial adjustments and total point buy spent.
- **`ConditionManager`**: Toggles standard PF1e conditions (Shaken, Sickened, Fatigued, Exhausted, Blinded, Entangled, Prone, Grappled) and feeds debuffs into total combat calculations.

---

## Plan Status & Next Steps
Upon user approval, we will build out the complete full-featured application with modular drag-and-drop workspace controls, the custom formula engine, authentic Parchment & Myth-Weavers visual themes, and test compilation.
