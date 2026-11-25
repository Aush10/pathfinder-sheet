import React from 'react';
import {
  Palette,
  Type,
  LayoutGrid,
  Calculator,
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
  Bug,
  ShieldAlert,
} from 'lucide-react';
import { ThemeMode, SheetFont, WorkspaceLayout, PF1Character } from '../../types/character';
import { GLYPH_STYLE_OPTIONS, getGlyphUrl, type GlyphStyle } from '../../data/glyphs';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { useCharacter } from '../../context/CharacterContext';
import type { AiServerProbeStatus } from '../../engine/aiService';

interface BlueprintSidebarProps {
  layout?: WorkspaceLayout;
  onUpdateLayout?: (updates: Partial<WorkspaceLayout>) => void;
  character?: PF1Character;
  onOpenPointBuy: () => void;
  onOpenDiceRoller?: () => void;
  onOpenBuffBox: () => void;
  onOpenDeck: () => void;
  onOpenXDX: () => void;
  onOpenMacroDebug?: () => void;
  onOpenLoadout: () => void;
  onOpenAddClass: () => void;
  onOpenCMBt: () => void;
  onOpenJournal?: () => void;
  onOpenSotPanel?: () => void;
  onOpenAITool?: () => void;
  onOpenCompleteSheet?: () => void;
  onInstallAITool?: () => void;
  aiKitStatus?: AiServerProbeStatus;
  onOpenPlaytestGuide?: () => void;
  onRunUpdatedCommand?: () => void;
  isUpdatingPlaytest?: boolean;
  lastUpdateSummary?: string | null;
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
  onOpenBuffBox,
  onOpenDeck,
  onOpenXDX,
  onOpenMacroDebug,
  onOpenLoadout,
  onOpenAddClass,
  onOpenCMBt,
  onOpenJournal,
  onOpenSotPanel,
  onOpenAITool,
  onOpenCompleteSheet,
  onInstallAITool,
  aiKitStatus,
  onOpenPlaytestGuide,
  onRunUpdatedCommand,
  isUpdatingPlaytest,
  lastUpdateSummary,
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

  return (
    <aside className="w-80 shrink-0 self-stretch bg-slate-900/95 border-r border-cyan-500/30 text-slate-200 flex flex-col min-h-full shadow-2xl overflow-y-auto pf1-theme-scrollbar select-none print:hidden">
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

      {/* Middle & Bottom Section: Toolbox moved into the former Modules Available area */}
      <div className="p-4 flex-1 overflow-y-auto pf1-theme-scrollbar space-y-3">
        {/* Tools grid */}
        <div className="grid grid-cols-2 gap-2">
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

          {onOpenMacroDebug && (
            <button
              onClick={onOpenMacroDebug}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors flex items-center gap-2"
              title="Trace macro inputs, evaluated output, and potential sheet mutations"
            >
              <Bug className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">Trace</div>
                <div className="text-[10px] font-mono text-cyan-400/80">Debug Flow</div>
              </div>
            </button>
          )}

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

          {/* Standalone Source of Truth (SOT) Library */}
          {onOpenSotPanel && (
            <button
              onClick={onOpenSotPanel}
              className="p-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-600/50 hover:border-cyan-400 text-left transition-colors flex items-center gap-2 col-span-2 shadow-sm"
              title="Source of Truth Library: Batch import rulebook pages and inspect deterministic tables, links, text, and index outputs without AI"
            >
              <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">Source of Truth (SOT)</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                    {character.sotCatalogue?.overridePages?.length || 0} DOCS
                  </span>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/80 truncate">
                  Non-AI Batch Upload • 4-Output Viewer
                </div>
              </div>
            </button>
          )}

          {/* Standalone AI Companion Module Tool (Empty slot until AI test kit is installed) */}
          {character.installedModules?.aiCompanion ? (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border border-cyan-400/80 shadow-md col-span-2 space-y-2">
              <div
                onClick={onOpenAITool}
                className="flex items-center gap-2.5 cursor-pointer group"
                title="AI Companion Tool: Turn on listeners, Plain English to DSL macros, voice journal & module permissions"
              >
                <Cpu className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-cyan-200 group-hover:text-cyan-100">
                      AI Companion Tool
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                        aiKitStatus?.available
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {aiKitStatus?.available ? 'API READY' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400/80 truncate">
                    Listeners &amp; Blind Spots · Macros
                  </div>
                </div>
              </div>

              {onOpenCompleteSheet && (
                <button
                  onClick={onOpenCompleteSheet}
                  className="w-full py-1.5 px-2 rounded-md bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  title="Open Complete Sheet AI in the available-links area"
                >
                  <AppleEyeIcon className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Complete Sheet AI</span>
                </button>
              )}
            </div>
          ) : aiKitStatus?.available && onInstallAITool ? (
            <button
              onClick={onInstallAITool}
              className="p-2 rounded-lg bg-slate-900/60 hover:bg-cyan-950/40 border border-dashed border-cyan-500/50 hover:border-cyan-400 text-left transition-colors flex items-center gap-2 col-span-2 group"
              title="Install the standalone AI Companion module (listeners start OFF by default)"
            >
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-300">
                    + Install AI Companion
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    KIT READY
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  Listeners OFF by default
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPlaytestGuide}
              className="p-2 rounded-lg bg-slate-950/50 hover:bg-slate-900 border border-dashed border-slate-700/90 text-left transition-colors flex items-center gap-2 col-span-2 group"
              title="Empty AI Companion slot — AI is not included in the Playtest Kit. Click for AI Test Kit & API Keyhole instructions."
            >
              <Cpu className="w-4 h-4 text-slate-600 group-hover:text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-slate-500 group-hover:text-slate-300">
                    AI Companion Slot
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-900 text-slate-500 border border-slate-800">
                    EMPTY
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  No AI Test Kit installed
                </div>
              </div>
            </button>
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
              title="Open Class Architect: progression spreadsheet, multiclass/gestalt timeline, and class kit tools"
            >
              <Swords className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-amber-200 truncate">Add Class</div>
                <div className="text-[10px] font-mono text-amber-400/80 truncate">Class Architect</div>
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
            {onOpenPlaytestGuide && (
              <button
                type="button"
                onClick={onOpenPlaytestGuide}
                className="py-1.5 px-2 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 hover:border-amber-400 text-amber-200 font-bold flex items-center justify-center gap-1.5 transition-colors col-span-2 shadow-xs group"
                title="Open Autosheet Playtest Kit Quick Guide, Safety Briefing, Kits & Windows Shortcuts"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Playtest Kit Quick Guide o7</span>
              </button>
            )}
            {onRunUpdatedCommand && (
              <button
                type="button"
                onClick={onRunUpdatedCommand}
                disabled={isUpdatingPlaytest}
                className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-400/60 hover:border-cyan-300 text-cyan-100 font-bold flex items-center justify-center gap-1.5 transition-colors col-span-2 shadow-xs group disabled:opacity-60"
                title="Updated — Pull latest distros for all existing kits in your test folder"
              >
                <img
                  src="./chirpy-updated.png"
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-4 h-4 rounded-xs object-contain shrink-0"
                />
                <span>{isUpdatingPlaytest ? 'Updated: Pulling...' : 'Updated (Pull Existing Kits)'}</span>
              </button>
            )}
            {lastUpdateSummary && (
              <div className="col-span-2 px-2 py-1 rounded bg-slate-900/90 border border-cyan-500/30 text-[10px] font-mono text-cyan-200 break-words">
                {lastUpdateSummary}
              </div>
            )}
            <a
              href="https://github.com/Aush10/pathfinder-sheet"
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-colors col-span-2 shadow-xs group text-center"
              title="Open the project source and release instructions on GitHub"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Source Code on GitHub</span>
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
