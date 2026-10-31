/**
 * Pathfinder 1st Edition Modular Workspace & Character Sheet Application
 * Implements:
 * - Technical Blueprint Workspace Builder
 * - Tabletop Facing Sheet (Parchment Tan & Times New Roman 12 Charcoal Black)
 * - Player-Friendly Custom Formula & Object Engine (DSL)
 * - Automated PF1e Mathematics (Point Buy, AC, Saves, Iterative Attacks, ACP, Encumbrance, Conditions)
 * - Interactive Tools (Dice Tray, Point Buy Allocator, Quick HP Tracker, Condition Debuffs)
 * - Spreadsheet CSV & JSON Persistence
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Dices,
  Calculator,
  Heart,
  Shield,
  FileSpreadsheet,
  Download,
  Upload,
  Printer,
  Sparkles,
  Palette,
  Maximize2,
  Scroll,
  Clock,
  Terminal,
} from 'lucide-react';

import { PF1Character, WorkspaceLayout, AbilityName } from './types/character';
import { DEFAULT_CHARACTER } from './data/defaultCharacter';
import { computeDerivedCharacterStats } from './engine/pf1eMath';
import { DiceRollOutcome } from './engine/formula';

import { BlueprintSidebar } from './components/workspace/BlueprintSidebar';
import { SheetPage1Core } from './components/sheet/SheetPage1Core';
import { SheetPage2ActionsSkills } from './components/sheet/SheetPage2ActionsSkills';
import { SheetPage3BioStorage } from './components/sheet/SheetPage3BioStorage';
import { SheetPage2SkillsGear } from './components/sheet/SheetPage2SkillsGear';
import { SheetPage3SpellsBio } from './components/sheet/SheetPage3SpellsBio';
import { SheetPage4FormulaStudio } from './components/sheet/SheetPage4FormulaStudio';
import { BuffBoxModule } from './components/sheet/BuffBoxModule';

import { DiceRollerTray } from './components/tools/DiceRollerTray';
import { PointBuyModal } from './components/tools/PointBuyModal';
import { QuickHPBar } from './components/tools/QuickHPBar';
import { StepperTool } from './components/tools/StepperTool';
import { DeckTool } from './components/tools/DeckTool';
import { XDXTool } from './components/tools/XDXTool';
import { LoadoutModal } from './components/tools/LoadoutModal';
import { AddClassModal } from './components/tools/AddClassModal';
import { CMBTool } from './components/tools/CMBTool';

const LOCAL_STORAGE_KEY = 'pf1e_character_data_v1';
const LOCAL_STORAGE_LAYOUT_KEY = 'pf1e_workspace_layout_v1';

export default function App() {
  // Initialize character state from localStorage or default, ensuring all fields are merged safely
  const [character, setCharacter] = useState<PF1Character>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_CHARACTER,
            ...parsed,
            gender: parsed.gender || DEFAULT_CHARACTER.gender || 'Male',
            abilities: { ...DEFAULT_CHARACTER.abilities, ...(parsed.abilities || {}) },
            buffBox: parsed.buffBox || DEFAULT_CHARACTER.buffBox,
            currency: { ...DEFAULT_CHARACTER.currency, ...(parsed.currency || {}) },
            hpBreakdown: {
              ...DEFAULT_CHARACTER.hpBreakdown,
              calcMethod: parsed.hpBreakdown?.calcMethod || 'max',
              ...(parsed.hpBreakdown || {}),
            },
            characterBio: { ...DEFAULT_CHARACTER.characterBio, ...(parsed.characterBio || {}) },
            conditions: { ...DEFAULT_CHARACTER.conditions, ...(parsed.conditions || {}) },
            saves: {
              fortitude: { ...DEFAULT_CHARACTER.saves.fortitude, ...(parsed.saves?.fortitude || {}) },
              reflex: { ...DEFAULT_CHARACTER.saves.reflex, ...(parsed.saves?.reflex || {}) },
              will: { ...DEFAULT_CHARACTER.saves.will, ...(parsed.saves?.will || {}) },
            },
            inventory: Array.isArray(parsed.inventory) ? parsed.inventory : DEFAULT_CHARACTER.inventory,
            weapons: Array.isArray(parsed.weapons) ? parsed.weapons : DEFAULT_CHARACTER.weapons,
            armor: Array.isArray(parsed.armor) ? parsed.armor : DEFAULT_CHARACTER.armor,
            skills: Array.isArray(parsed.skills) ? parsed.skills : DEFAULT_CHARACTER.skills,
            classes: Array.isArray(parsed.classes) ? parsed.classes : DEFAULT_CHARACTER.classes,
          };
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CHARACTER;
  });

  // Initialize workspace layout
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LAYOUT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return {
      theme: 'parchment', // Defaults to Parchment Tan per user instruction
      font: 'times', // Defaults to Times New Roman 12 per user instruction
      activeSheet: 1,
      showAllSheets: false,
      visibleModules: {
        abilities: true,
        hpAndVitals: true,
        armorClass: true,
        saves: true,
        attacks: true,
        weapons: true,
        armor: true,
        feats: true,
        skills: true,
        inventory: true,
        currency: true,
        languages: true,
        spellMatrix: true,
        spellbook: true,
        conditions: true,
        biography: true,
        profile: true,
        notes: true,
        formulaStudio: true,
        statblock: true,
        buffBox: true,
      },
    };
  });

  // Tool Modals State
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePresetFormula, setDicePresetFormula] = useState<string>('1d20+7');
  const [isPointBuyOpen, setIsPointBuyOpen] = useState(false);
  const [isQuickHPOpen, setIsQuickHPOpen] = useState(false);
  const [isBuffBoxOpen, setIsBuffBoxOpen] = useState(false);
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isXDXOpen, setIsXDXOpen] = useState(false);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isCMBtOpen, setIsCMBtOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(character));
    } catch {
      // ignore quota errors
    }
  }, [character]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // ignore
    }
  }, [layout]);

  // Global Ctrl+X or Escape listener to close all open tools/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 'x' || e.key === 'X')) || e.key === 'Escape') {
        setIsDiceOpen(false);
        setIsPointBuyOpen(false);
        setIsQuickHPOpen(false);
        setIsBuffBoxOpen(false);
        setIsConditionsOpen(false);
        setIsStepperOpen(false);
        setIsDeckOpen(false);
        setIsXDXOpen(false);
        setIsLoadoutOpen(false);
        setIsAddClassOpen(false);
        setIsCMBtOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute all derived stats automatically
  const derived = computeDerivedCharacterStats(character);

  // Trigger a dice roll with a preset formula
  const handleRollFormula = (formula: string, label?: string) => {
    setDicePresetFormula(formula);
    setIsDiceOpen(true);
  };

  // Apply point buy and Level ASI updates
  const handleApplyPointBuy = ({
    bases,
    asi,
  }: {
    bases: Record<AbilityName, number>;
    asi: Record<AbilityName, number>;
  }) => {
    setCharacter((prev) => {
      const updatedAbilities = { ...prev.abilities };
      for (const ab of Object.keys(bases) as AbilityName[]) {
        if (updatedAbilities[ab]) {
          updatedAbilities[ab] = {
            ...updatedAbilities[ab],
            base: bases[ab],
            levelAsiMod: asi[ab] || 0,
          };
        }
      }
      return { ...prev, abilities: updatedAbilities };
    });
  };

  // Export JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(character, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${character.name.replace(/\s+/g, '_')}_pf1e_sheet.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.name && parsed.abilities) {
            setCharacter(parsed);
          } else {
            alert('Invalid character sheet format.');
          }
        } catch {
          alert('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Export CSV formatted index matching the uploaded spreadsheet structure
  const handleExportCSV = () => {
    const lines: string[] = [
      `Name:,${character.name},,,,Race:,${character.race},,,,Space:,5 ft.`,
      `Class:,${character.characterClass},,,,Level:,${character.level},,Size:,${character.size},,Reach:,5 ft.`,
      `Abilities,,Total,Base,Race,Enh,Misc,Mod,,,,Current,Max,Temp`,
      `STR,,${derived.strTotal},${character.abilities.STR.base},${character.abilities.STR.raceMod},${character.abilities.STR.enhMod},${character.abilities.STR.miscMod},${derived.strMod},Hit Points:,${character.hpCurrent},${character.hpTotalMax},${character.hpTemp}`,
      `DEX,,${derived.dexTotal},${character.abilities.DEX.base},${character.abilities.DEX.raceMod},${character.abilities.DEX.enhMod},${character.abilities.DEX.miscMod},${derived.dexMod}`,
      `CON,,${derived.conTotal},${character.abilities.CON.base},${character.abilities.CON.raceMod},${character.abilities.CON.enhMod},${character.abilities.CON.miscMod},${derived.conMod}`,
      `INT,,${derived.intTotal},${character.abilities.INT.base},${character.abilities.INT.raceMod},${character.abilities.INT.enhMod},${character.abilities.INT.miscMod},${derived.intMod}`,
      `WIS,,${derived.wisTotal},${character.abilities.WIS.base},${character.abilities.WIS.raceMod},${character.abilities.WIS.enhMod},${character.abilities.WIS.miscMod},${derived.wisMod}`,
      `CHA,,${derived.chaTotal},${character.abilities.CHA.base},${character.abilities.CHA.raceMod},${character.abilities.CHA.enhMod},${character.abilities.CHA.miscMod},${derived.chaMod}`,
      `Defense,Total,Armor,Shield,Natural,Dex,Deflection,Touch,Flat-Footed`,
      `AC,${derived.acTotal},${derived.armorBonusTotal},${derived.shieldBonusTotal},${character.naturalArmorMod},${derived.effectiveDexModForAC},${character.deflectionMod},${derived.touchAC},${derived.flatFootedAC}`,
      `Saves,Total,Base,Ability,Magic,Misc`,
      `Fortitude,${derived.fortitudeTotal},${character.saves.fortitude.base},${derived.conMod},${character.saves.fortitude.magicMod},${character.saves.fortitude.miscMod}`,
      `Reflex,${derived.reflexTotal},${character.saves.reflex.base},${derived.dexMod},${character.saves.reflex.magicMod},${character.saves.reflex.miscMod}`,
      `Will,${derived.willTotal},${character.saves.will.base},${derived.wisMod},${character.saves.will.magicMod},${character.saves.will.miscMod}`,
      `Combat,BAB,${character.baseAttackBonus},CMB,${derived.cmbTotal},CMD,${derived.cmdTotal},Initiative,${derived.initiativeTotal}`,
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `${character.name.replace(/\s+/g, '_')}_pf1e_sheet.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Determine active font family
  const getFontClass = () => {
    switch (layout.font) {
      case 'times':
        return 'font-serif text-[13px] leading-relaxed'; // Classic Times New Roman 12-13pt feel
      case 'cinzel':
        return 'font-serif tracking-tight';
      case 'mono':
        return 'font-mono text-xs';
      case 'sans':
      default:
        return 'font-sans text-xs';
    }
  };

  // Determine background style of workspace canvas
  const getCanvasBgClass = () => {
    switch (layout.theme) {
      case 'parchment':
        return 'bg-[#f4efe4] text-[#1c1917]'; // Authentic warm parchment tan
      case 'blueprint':
        return 'bg-[#08121f] text-cyan-50 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px]'; // Blueprint grid
      case 'mythweavers':
        return 'bg-[#0d0f12] text-slate-100'; // Dark Myth-Weavers
      case 'print':
      default:
        return 'bg-white text-black';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${layout.theme === 'blueprint' || layout.theme === 'mythweavers' ? 'dark' : ''}`}>
      {/* Top Bar Contract (1 row, 3 clean functional zones) */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 text-slate-100 px-4 md:px-6 flex items-center justify-between gap-6 shrink-0 z-20 print:hidden select-none">
        {/* Zone 1: Wordmark & Core Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors"
            title="Toggle Blueprint Sidebar"
          >
            <Layers className="w-4 h-4" />
          </button>
          <span className="font-serif font-black tracking-tight text-amber-300 text-sm md:text-base whitespace-nowrap">
            Pathfinder 1e <span className="font-sans font-light text-slate-400 text-xs hidden sm:inline">| Modular Workspace</span>
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 hidden md:inline-block">
            {character.name || 'Unnamed Character'} (Lvl {character.level})
          </span>
        </div>

        {/* Zone 2: Sheet Navigation & Viewport Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 shrink-0">
          {[
            { id: 1, label: 'Page 1: Core Combat' },
            { id: 2, label: 'Page 2: Actions & Skills' },
            { id: 3, label: 'Page 3: Bio & Storage' },
            { id: 4, label: 'Page 4: DSL Studio' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setLayout((prev) => ({ ...prev, activeSheet: tab.id as 1 | 2 | 3 | 4, showAllSheets: false }));
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                layout.activeSheet === tab.id && !layout.showAllSheets
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setLayout((prev) => ({ ...prev, showAllSheets: !prev.showAllSheets }))}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              layout.showAllSheets
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All 3 Pages
          </button>
        </nav>

        {/* Zone 3: Quick Live Action Bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stepper Tool */}
          <button
            onClick={() => setIsStepperOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Open Turn Stepper"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Stepper</span>
          </button>

          {/* Deck Tool */}
          <button
            onClick={() => setIsDeckOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Open Deck Simulator"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Deck</span>
          </button>

          {/* XDX Tool */}
          <button
            onClick={() => setIsXDXOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Open XDX Macro Center"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">XDX</span>
          </button>

          <button
            onClick={() => setIsDiceOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Open Dice Tray"
          >
            <Dices className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Dice</span>
          </button>

          <button
            onClick={() => setIsQuickHPOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Adjust HP"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>
              {character.hpCurrent}/{character.hpTotalMax}
            </span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition-colors"
            title="Print / PDF Export"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Modular Blueprint Sidebar (Matches user's wireframe) */}
        {!isSidebarCollapsed && (
          <BlueprintSidebar
            layout={layout}
            onUpdateLayout={(updates) => setLayout((prev) => ({ ...prev, ...updates }))}
            character={character}
            onOpenPointBuy={() => setIsPointBuyOpen(true)}
            onOpenDiceRoller={() => setIsDiceOpen(true)}
            onOpenQuickHP={() => setIsQuickHPOpen(true)}
            onOpenBuffBox={() => setIsBuffBoxOpen(true)}
            onOpenConditions={() => setIsConditionsOpen(!isConditionsOpen)}
            onOpenStepper={() => setIsStepperOpen(true)}
            onOpenDeck={() => setIsDeckOpen(true)}
            onOpenXDX={() => setIsXDXOpen(true)}
            onOpenLoadout={() => setIsLoadoutOpen(true)}
            onOpenAddClass={() => setIsAddClassOpen(true)}
            onOpenCMBt={() => setIsCMBtOpen(true)}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onExportCSV={handleExportCSV}
            onPrint={() => window.print()}
          />
        )}

        {/* Center / Main Canvas Viewport */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 transition-colors duration-200 ${getCanvasBgClass()}`}>
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Quick condition debuff notification if active */}
            {isConditionsOpen && (
              <div className="mb-4">
                <SheetPage3SpellsBio
                  character={character}
                  derived={derived}
                  theme={layout.theme}
                  fontClass={getFontClass()}
                  onUpdateCharacter={setCharacter}
                  visibleModules={{ conditions: true }}
                />
              </div>
            )}

            {/* Render Active Pages based on Viewport State */}
            {layout.showAllSheets ? (
              // All 3 Standard Pages Layout (Tablet / Tabletop facing mode)
              <div className="space-y-12">
                <section className="border-b border-black/10 dark:border-white/10 pb-8">
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 1: Core Combat & Attributes</span>
                    <span>Myth-Weavers Layout Standard</span>
                  </div>
                  <SheetPage1Core
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                    onOpenCMBt={() => setIsCMBtOpen(true)}
                  />
                </section>

                <section className="border-b border-black/10 dark:border-white/10 pb-8">
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 2: Actions & Skills</span>
                    <span>Action Command Center, Resource Pools & Skills Matrix</span>
                  </div>
                  <SheetPage2ActionsSkills
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 3: Bio, Storage & Downtime</span>
                    <span>Scratchpad, Narrative, Companions & Storage Equipment Matrix</span>
                  </div>
                  <SheetPage3BioStorage
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                </section>
              </div>
            ) : (
              // Single Selected Tab View
              <div>
                {layout.activeSheet === 1 && (
                  <SheetPage1Core
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                    onOpenCMBt={() => setIsCMBtOpen(true)}
                  />
                )}

                {layout.activeSheet === 2 && (
                  <SheetPage2ActionsSkills
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                )}

                {layout.activeSheet === 3 && (
                  <SheetPage3BioStorage
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                )}

                {layout.activeSheet === 4 && (
                  <SheetPage4FormulaStudio
                    character={character}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Tools & Modals */}
      <DiceRollerTray
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        presetFormula={dicePresetFormula}
      />

      <PointBuyModal
        isOpen={isPointBuyOpen}
        onClose={() => setIsPointBuyOpen(false)}
        character={character}
        onApplyBaseScores={handleApplyPointBuy}
      />

      {isQuickHPOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm">
            <QuickHPBar
              character={character}
              hpStatus={derived.hpStatus}
              onClose={() => setIsQuickHPOpen(false)}
              onUpdateHP={(updates) => setCharacter((prev) => ({ ...prev, ...updates }))}
            />
          </div>
        </div>
      )}

      {isBuffBoxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <BuffBoxModule
              buffBox={character.buffBox}
              customBuffs={character.customBuffs}
              onUpdateBuffBox={(newBox) =>
                setCharacter((prev) => ({ ...prev, buffBox: newBox }))
              }
              onUpdateCustomBuffs={(newBuffs) =>
                setCharacter((prev) => {
                  const itemActiveMap = new Map<string, boolean>();
                  newBuffs.forEach((b) => {
                    if (b.itemId) itemActiveMap.set(b.itemId, b.isActive);
                  });
                  const updatedInventory = (prev.inventory || []).map((item) => {
                    if (itemActiveMap.has(item.id)) {
                      return { ...item, buffActive: itemActiveMap.get(item.id), hasBuff: true };
                    }
                    return item;
                  });
                  return { ...prev, customBuffs: newBuffs, inventory: updatedInventory };
                })
              }
              theme={layout.theme}
              fontClass={getFontClass()}
              isToolModal={true}
              onCloseModal={() => setIsBuffBoxOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Stepper Tool Modal */}
      <StepperTool
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        character={character}
        derived={derived}
        onUpdateCharacter={setCharacter}
        theme={layout.theme}
      />

      {/* Deck Simulator Tool Modal */}
      <DeckTool
        isOpen={isDeckOpen}
        onClose={() => setIsDeckOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
      />

      {/* XDX Compact Macro Center Tool Modal */}
      <XDXTool
        isOpen={isXDXOpen}
        onClose={() => setIsXDXOpen(false)}
        character={character}
        derived={derived}
        onUpdateCharacter={setCharacter}
      />

      {/* Loadout Sectional Save/Load Modal */}
      <LoadoutModal
        isOpen={isLoadoutOpen}
        onClose={() => setIsLoadoutOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
        onExportCSV={handleExportCSV}
        onPrint={() => window.print()}
        theme={layout.theme}
      />

      {/* Add Class Progression Grid & Auto Level-Up Modal */}
      <AddClassModal
        isOpen={isAddClassOpen}
        onClose={() => setIsAddClassOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
        theme={layout.theme}
      />

      {/* CMBt - Combat Maneuver & Grapple Track Tool */}
      <CMBTool
        isOpen={isCMBtOpen}
        onClose={() => setIsCMBtOpen(false)}
        character={character}
        derived={derived}
        theme={layout.theme}
        onUpdateCharacter={setCharacter}
        onRollFormula={handleRollFormula}
      />
    </div>
  );
}

