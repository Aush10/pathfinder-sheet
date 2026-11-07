import React from 'react';
import {
  Palette,
  Type,
  LayoutGrid,
  Calculator,
  Heart,
  Shield,
  Code,
  FileSpreadsheet,
  Download,
  Upload,
  Printer,
  Eye,
  Check,
  ChevronDown,
  Sparkles,
  Clock,
  Layers,
  Terminal,
  Package,
  Swords,
  Hand,
  FilePlus,
  Image as ImageIcon,
  FolderOpen,
  FileCode,
  BookOpen,
  Cpu,
} from 'lucide-react';
import { ThemeMode, SheetFont, WorkspaceLayout, PF1Character } from '../../types/character';
import { GLYPH_STYLE_OPTIONS, getGlyphUrl, type GlyphStyle } from '../../data/glyphs';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { useCharacter } from '../../context/CharacterContext';

interface BlueprintSidebarProps {
  layout?: WorkspaceLayout;
  onUpdateLayout?: (updates: Partial<WorkspaceLayout>) => void;
  character?: PF1Character;
  onOpenPointBuy: () => void;
  onOpenDiceRoller?: () => void;
  onOpenQuickHP: () => void;
  onOpenBuffBox: () => void;
  onOpenConditions: () => void;
  onOpenStepper: () => void;
  onOpenDeck: () => void;
  onOpenXDX: () => void;
  onOpenLoadout: () => void;
  onOpenAddClass: () => void;
  onOpenCMBt: () => void;
  onOpenJournal?: () => void;
  onOpenAITool?: () => void;
  onOpenCompleteSheet?: () => void;
  onInstallAITool?: () => void;
  onOpenNewSheet?: () => void;
  onOpenImageBrowser?: () => void;
  onExportStandaloneHTML?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
  onExportCSV?: () => void;
  onPrint: () => void;
}

export const BlueprintSidebar: React.FC<BlueprintSidebarProps> = ({
  layout: propLayout,
  onUpdateLayout: propOnUpdateLayout,
  character: propCharacter,
  onOpenPointBuy,
  onOpenDiceRoller,
  onOpenQuickHP,
  onOpenBuffBox,
  onOpenConditions,
  onOpenStepper,
  onOpenDeck,
  onOpenXDX,
  onOpenLoadout,
  onOpenAddClass,
  onOpenCMBt,
  onOpenJournal,
  onOpenAITool,
  onOpenCompleteSheet,
  onInstallAITool,
  onOpenNewSheet,
  onOpenImageBrowser,
  onExportStandaloneHTML: propOnExportStandaloneHTML,
  onExportJSON: propOnExportJSON,
  onImportJSON: propOnImportJSON,
  onExportCSV: propOnExportCSV,
  onPrint,
}) => {
  const ctx = useCharacter();
  const layout = propLayout ?? ctx.layout;
  const onUpdateLayout = propOnUpdateLayout ?? ctx.updateLayout;
  const character = propCharacter ?? ctx.character;
  const onExportStandaloneHTML = propOnExportStandaloneHTML ?? ctx.exportStandaloneHTML;
  const onExportJSON = propOnExportJSON ?? ctx.exportJSON;
  const onImportJSON = propOnImportJSON ?? ctx.importJSON;
  const onExportCSV = propOnExportCSV ?? ctx.exportCSV;
  const activeGlyphStyle: GlyphStyle = layout.glyphStyle ?? '01-flat-enamel';
  const toggleModule = (key: keyof WorkspaceLayout['visibleModules']) => {
    onUpdateLayout({
      visibleModules: {
        ...layout.visibleModules,
        [key]: !layout.visibleModules[key],
      },
    });
  };

  const moduleItems: Array<{
    key: keyof WorkspaceLayout['visibleModules'];
    label: string;
    sheet: 1 | 2 | 3 | 4;
  }> = [
    { key: 'weapons', label: 'Weapons & Attacks Matrix', sheet: 1 },
    { key: 'armor', label: 'Armor & Defensive Gear', sheet: 1 },
    { key: 'feats', label: 'Feats & Special Abilities', sheet: 1 },
    { key: 'skills', label: 'Skills Matrix (35 PF1e Skills)', sheet: 2 },
    { key: 'inventory', label: 'Inventory & Gear List', sheet: 2 },
    { key: 'currency', label: 'Currency & Total Wealth', sheet: 2 },
    { key: 'languages', label: 'Languages Known', sheet: 2 },
    { key: 'spellMatrix', label: 'Spell Saves & Slots (0-9th)', sheet: 3 },
    { key: 'spellbook', label: 'Spells Known & Prepared', sheet: 3 },
    { key: 'conditions', label: 'Conditions & Debuffs Checklist', sheet: 3 },
    { key: 'biography', label: 'Character Bio, Traits & Flaws', sheet: 3 },
    { key: 'profile', label: 'Profile Portrait & Titled Blocks', sheet: 3 },
    { key: 'notes', label: 'Roll-Up Notes & Scratchpad', sheet: 3 },
    { key: 'formulaStudio', label: 'Custom Formula Objects (DSL)', sheet: 4 },
    { key: 'statblock', label: 'Monster/NPC Statblock Generator', sheet: 3 },
  ];

  return (
    <aside className="w-80 shrink-0 bg-slate-900/95 border-r border-cyan-500/30 text-slate-200 flex flex-col h-full shadow-2xl overflow-y-auto select-none print:hidden">
      {/* Top Section: Layout, Color & Font */}
      <div className="p-4 border-b border-cyan-500/20 bg-slate-950/70">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs uppercase tracking-wider font-bold text-cyan-300">
              Workspace Blueprint
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
            PF1e Modular
          </span>
        </div>

        {/* Theme Selector */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>Theme Style:</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onUpdateLayout({ theme: 'parchment' })}
              className={`px-2 py-1.5 rounded text-xs font-serif text-left border flex items-center justify-between transition-all ${
                layout.theme === 'parchment'
                  ? 'bg-amber-100 text-stone-900 border-amber-600 font-bold shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>Parchment Tan</span>
              {layout.theme === 'parchment' && <Check className="w-3.5 h-3.5 text-amber-800" />}
            </button>
            <button
              onClick={() => onUpdateLayout({ theme: 'blueprint' })}
              className={`px-2 py-1.5 rounded text-xs font-mono text-left border flex items-center justify-between transition-all ${
                layout.theme === 'blueprint'
                  ? 'bg-cyan-950 text-cyan-200 border-cyan-400 font-bold shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>Blueprint</span>
              {layout.theme === 'blueprint' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onUpdateLayout({ theme: 'mythweavers' })}
              className={`px-2 py-1.5 rounded text-xs font-mono text-left border flex items-center justify-between transition-all ${
                layout.theme === 'mythweavers'
                  ? 'bg-neutral-900 text-amber-200 border-amber-500 font-bold shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>Myth-Weavers</span>
              {layout.theme === 'mythweavers' && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>
            <button
              onClick={() => onUpdateLayout({ theme: 'print' })}
              className={`px-2 py-1.5 rounded text-xs font-sans text-left border flex items-center justify-between transition-all ${
                layout.theme === 'print'
                  ? 'bg-white text-black border-black font-bold shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>Clean Print</span>
              {layout.theme === 'print' && <Check className="w-3.5 h-3.5 text-black" />}
            </button>
          </div>
        </div>

        {/* Font Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sheet Font:</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'times', label: 'Times New Roman 12', classFont: 'font-serif' },
              { id: 'cinzel', label: 'Cinzel Decorative', classFont: 'font-serif' },
              { id: 'sans', label: 'Plus Jakarta Sans', classFont: 'font-sans' },
              { id: 'mono', label: 'JetBrains Mono', classFont: 'font-mono' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => onUpdateLayout({ font: f.id as SheetFont })}
                className={`px-2 py-1 rounded text-[11px] truncate text-left border transition-all ${f.classFont} ${
                  layout.font === f.id
                    ? 'bg-cyan-900/60 border-cyan-400 text-cyan-200 font-bold'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bundled Icon Style Selector */}
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bundled Icon Style:</span>
            </span>
            <span className="w-5 h-5 rounded overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
              {getGlyphUrl('blue-sword', activeGlyphStyle) ? (
                <img
                  src={getGlyphUrl('blue-sword', activeGlyphStyle) || undefined}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[9px] text-slate-500">—</span>
              )}
            </span>
          </div>
          <select
            value={activeGlyphStyle}
            onChange={(event) => onUpdateLayout({ glyphStyle: event.target.value as GlyphStyle })}
            className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500/60"
            title="Choose the locally bundled icon family used by new visual selections"
          >
            {GLYPH_STYLE_OPTIONS.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sheet Page Navigation Tabs */}
      <div className="p-3 border-b border-cyan-500/20 bg-slate-950/40">
        <div className="text-[11px] font-mono text-cyan-400 mb-1.5 uppercase font-bold flex items-center justify-between">
          <span>Active Viewport</span>
          <button
            onClick={() => onUpdateLayout({ showAllSheets: !layout.showAllSheets })}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              layout.showAllSheets
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle between viewing all 3 main pages combined or a single selected page"
          >
            {layout.showAllSheets ? 'All 3 Pages' : 'Single Page'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: 1, label: '1. Core', full: 'Page 1: Core Combat & Attributes' },
            { id: 2, label: '2. Actions', full: 'Page 2: Actions & Skills' },
            { id: 3, label: '3. Bio/Gear', full: 'Page 3: Bio, Storage & Downtime' },
            { id: 4, label: '4. DSL', full: 'Page 4: Custom Formula Studio (DSL)' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => onUpdateLayout({ activeSheet: p.id as 1 | 2 | 3 | 4, showAllSheets: false })}
              title={p.full}
              className={`py-1.5 px-1 rounded text-xs font-mono text-center border transition-all ${
                layout.activeSheet === p.id && !layout.showAllSheets
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Middle Section: Modules Available */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300">
            Modules Available
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Click to toggle / dock
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-tight">
          Fill spaces and eliminate unused sections. Active modules populate the layout space.
        </p>

        <div className="space-y-1.5 pt-1">
          {moduleItems.map((mod) => {
            const isVisible = layout.visibleModules[mod.key];
            return (
              <div
                key={mod.key}
                onClick={() => toggleModule(mod.key)}
                className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                  isVisible
                    ? 'bg-slate-950/80 border-cyan-500/40 text-cyan-100 hover:border-cyan-400'
                    : 'bg-slate-950/30 border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                      isVisible
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {isVisible && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`font-medium ${isVisible ? 'text-slate-200' : 'text-slate-500'}`}>
                    {mod.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-600">P{mod.sheet}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Various Tools (Wireframe Match) */}
      <div className="p-4 border-t border-cyan-500/30 bg-slate-950/90 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300">
            Various Tools
          </span>
          <span className="text-[10px] font-mono text-slate-500">Live Calculators</span>
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Stepper (Turn-based macro execution) */}
          <button
            onClick={onOpenStepper}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">Stepper</div>
              <div className="text-[10px] font-mono text-amber-400/80">Turn Macros</div>
            </div>
          </button>

          {/* Deck (Card deck simulator) */}
          <button
            onClick={onOpenDeck}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">Deck</div>
              <div className="text-[10px] font-mono text-cyan-400/80">Draw & Hand</div>
            </div>
          </button>

          {/* XDX (Compact Dice Macro Center) */}
          <button
            onClick={onOpenXDX}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-2"
          >
            <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">XDX</div>
              <div className="text-[10px] font-mono text-amber-400/80">Macro Center</div>
            </div>
          </button>

          <button
            onClick={onOpenPointBuy}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-2"
          >
            <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">Point Buy</div>
              <div className="text-[10px] font-mono text-amber-400/80">Cost & Limits</div>
            </div>
          </button>

          <button
            onClick={onOpenQuickHP}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left transition-colors flex items-center justify-between col-span-2"
            title="HP Tracker: Adjust current HP, non-lethal damage, and temporary HP"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Heart className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-200">HP Tracker</div>
                <div className="text-[10px] font-mono text-rose-400/80">Quick Adjust & Healing</div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-rose-300 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/30">
              {character.hpCurrent}/{character.hpTotalMax} HP
            </span>
          </button>

          <button
            onClick={onOpenBuffBox}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-2 col-span-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">Buff Box</div>
              <div className="text-[10px] font-mono text-amber-400/80">Typed Bonus Matrix</div>
            </div>
          </button>

          {/* Session Journal & Chronicle Tool */}
          {onOpenJournal && (
            <button
              onClick={onOpenJournal}
              className="p-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/70 border border-amber-600/50 hover:border-amber-400 text-left transition-colors flex items-center gap-2 col-span-2 shadow-sm"
              title="Session Journal: Record session logs, recall notes, and pencil sketches"
            >
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">Session Journal & Notes</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    {character.journal?.length || 0} LOGS
                  </span>
                </div>
                <div className="text-[10px] font-mono text-amber-400/80 truncate">
                  Campaign Chronicle • Pencil Sketches
                </div>
              </div>
            </button>
          )}

          {/* Standalone AI Companion Module Tool */}
          {character.installedModules?.aiCompanion ? (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border border-cyan-400/80 shadow-md col-span-2 space-y-2">
              <div
                onClick={onOpenAITool}
                className="flex items-center gap-2.5 cursor-pointer group"
                title="AI Companion Tool: Plain English to DSL macros, in-character voice journal, pencil sketches & module permissions"
              >
                <Cpu className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-cyan-200 group-hover:text-cyan-100">
                      AI Companion Tool
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400/80 truncate">
                    DSL Macros • Voice • Pencil Sketches
                  </div>
                </div>
              </div>

              {onOpenCompleteSheet && (
                <button
                  onClick={onOpenCompleteSheet}
                  className="w-full py-1.5 px-2 rounded-md bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  title="Toggle AI Complete Sheet (Conversational Build from Concept mini-window)"
                >
                  <AppleEyeIcon className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Open Complete Sheet AI</span>
                </button>
              )}
            </div>
          ) : (
            onInstallAITool && (
              <button
                onClick={onInstallAITool}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-cyan-950/40 border border-dashed border-slate-700 hover:border-cyan-500/50 text-left transition-colors flex items-center gap-2 col-span-2 group"
                title="Install the standalone AI Companion module"
              >
                <Cpu className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-cyan-300">
                      + Install AI Companion
                    </span>
                    <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-500">
                      OPTIONAL
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    Standalone Assistant Module
                  </div>
                </div>
              </button>
            )
          )}

          {/* CMBt: Combat Maneuvers & Grapple Track Tool */}
          <button
            onClick={onOpenCMBt}
            className="p-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/50 hover:border-amber-400 text-left transition-colors flex items-center gap-2 col-span-2 shadow-sm"
            title="CMBt: Combat Maneuver Bonus Tool & Interactive Grapple Track"
          >
            <Hand className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300 truncate">CMBt & Grapple Track</div>
              <div className="text-[10px] font-mono text-amber-400/80">Rules, Flowchart & Sliders</div>
            </div>
          </button>

          {/* Image & File Browser Tool */}
          {onOpenImageBrowser && (
            <button
              onClick={onOpenImageBrowser}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-left transition-colors flex items-center gap-2 col-span-2 shadow-sm"
              title="File Browser for character portraits, item images & fantasy presets"
            >
              <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-cyan-300 truncate">Image & File Browser</div>
                <div className="text-[10px] font-mono text-cyan-400/80">Portraits, Items & Presets</div>
              </div>
            </button>
          )}
        </div>

        {/* Big Boys Under Buff Box: Loadout and Add Class */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenLoadout}
              className="p-2.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/50 hover:border-cyan-400 text-left transition-all shadow-md group flex items-center gap-2"
              title="Sectional JSON save/load: Frankenstein kits, gear sets, macros, ability presets"
            >
              <Package className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-cyan-200 truncate">Loadout</div>
                <div className="text-[10px] font-mono text-cyan-400/80 truncate">Sectional Kits</div>
              </div>
            </button>

            <button
              onClick={onOpenAddClass}
              className="p-2.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/50 hover:border-amber-400 text-left transition-all shadow-md group flex items-center gap-2"
              title="Paste class progression grid, auto-populate BAB, Saves, Feats, and Kits"
            >
              <Swords className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-amber-200 truncate">Add Class</div>
                <div className="text-[10px] font-mono text-amber-400/80 truncate">Grid & Level Up</div>
              </div>
            </button>
          </div>

          {/* New Sheet / Clear All Button */}
          {onOpenNewSheet && (
            <button
              onClick={onOpenNewSheet}
              className="w-full py-2 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 hover:border-rose-400 text-rose-200 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm group"
              title="Clear all character data or start a pristine new sheet"
            >
              <FilePlus className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              <span>Start New Sheet / Clear All</span>
            </button>
          )}

          {/* Quick Access JSON & CSV Export / Import */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
            {onExportStandaloneHTML && (
              <button
                onClick={onExportStandaloneHTML}
                className="py-1.5 px-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 font-bold flex items-center justify-center gap-1.5 transition-colors col-span-2 shadow-xs group"
                title="Download single-file standalone HTML that can be double clicked and sent to friends"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Export Standalone HTML (.html)</span>
              </button>
            )}
            <a
              href="/pathfinder_sheet_latest.zip"
              download="pathfinder_sheet_latest.zip"
              className="py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-colors col-span-2 shadow-xs group text-center"
              title="Download entire project source code zip to sync directly into your local folder or GitHub"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Download Full Source Code (.zip)</span>
            </a>
            <button
              onClick={onExportJSON}
              className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors"
              title="Download entire character sheet as JSON"
            >
              <Download className="w-3 h-3" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onImportJSON}
              className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors"
              title="Import character sheet from JSON file"
            >
              <Upload className="w-3 h-3" />
              <span>Import JSON</span>
            </button>
            <button
              onClick={onExportCSV}
              className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 transition-colors"
              title="Export spreadsheet index CSV (Myth-Weavers format)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>CSV Index</span>
            </button>
            <button
              onClick={onPrint}
              className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1 transition-colors"
              title="Print or PDF export sheet"
            >
              <Printer className="w-3 h-3" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
