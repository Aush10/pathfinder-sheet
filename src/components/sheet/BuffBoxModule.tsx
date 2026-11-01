import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  ShieldAlert,
  Flame,
  Zap,
  CheckSquare,
  Square,
  Filter,
} from 'lucide-react';
import {
  BuffBonusType,
  BuffStatTarget,
  BuffBoxData,
  CustomBuffEffect,
} from '../../types/character';
import { computeBuffBoxTotals } from '../../engine/pf1eMath';

export const BUFF_BONUS_TYPES: BuffBonusType[] = [
  'Untyped',
  'Enhancement',
  'Circumstance',
  'Competence',
  'Deflection',
  'Dodge',
  'Insight',
  'Item',
  'Inherent',
  'Luck',
  'Morale',
  'Pro/Sac',
  'Race',
  'NAT armor',
  'Armor',
  'Level advance',
  'Shield',
  'Size',
  'Alt size',
];

export const BUFF_STAT_TARGETS: Array<{ key: BuffStatTarget; label: string }> = [
  { key: 'hp', label: 'HP' },
  { key: 'mattack', label: 'Mattack' },
  { key: 'rattack', label: 'Rattack' },
  { key: 'fort', label: 'Fort' },
  { key: 'ref', label: 'Ref' },
  { key: 'will', label: 'Will' },
  { key: 'ac', label: 'AC' },
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
  { key: 'str_mod', label: 'STR Mod' },
  { key: 'dex_mod', label: 'DEX Mod' },
  { key: 'con_mod', label: 'CON Mod' },
  { key: 'int_mod', label: 'INT Mod' },
  { key: 'wis_mod', label: 'WIS Mod' },
  { key: 'cha_mod', label: 'CHA Mod' },
];

export function createEmptyBuffBox(): BuffBoxData {
  const box = {} as BuffBoxData;
  for (const bType of BUFF_BONUS_TYPES) {
    box[bType] = {
      hp: 0,
      mattack: 0,
      rattack: 0,
      fort: 0,
      ref: 0,
      will: 0,
      ac: 0,
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
      str_mod: 0,
      dex_mod: 0,
      con_mod: 0,
      int_mod: 0,
      wis_mod: 0,
      cha_mod: 0,
    };
  }
  return box;
}

const PRESET_TEMPLATES: Array<{
  name: string;
  category: 'activatable' | 'permanent' | 'debuff';
  bonusType: BuffBonusType;
  values: Partial<Record<BuffStatTarget, number>>;
  notes?: string;
}> = [
  {
    name: 'Haste',
    category: 'activatable',
    bonusType: 'Dodge',
    values: { mattack: 1, rattack: 1, ac: 1, ref: 1 },
    notes: '+1 attack, +1 dodge AC, +1 Reflex, +30ft speed',
  },
  {
    name: 'Heroism',
    category: 'activatable',
    bonusType: 'Morale',
    values: { mattack: 2, rattack: 2, fort: 2, ref: 2, will: 2 },
    notes: '+2 morale bonus to attack rolls, saves, and skill checks',
  },
  {
    name: "Bull's Strength",
    category: 'activatable',
    bonusType: 'Enhancement',
    values: { str: 4 },
    notes: '+4 enhancement to Strength',
  },
  {
    name: "Cat's Grace",
    category: 'activatable',
    bonusType: 'Enhancement',
    values: { dex: 4 },
    notes: '+4 enhancement to Dexterity',
  },
  {
    name: "Bear's Endurance",
    category: 'activatable',
    bonusType: 'Enhancement',
    values: { con: 4 },
    notes: '+4 enhancement to Constitution',
  },
  {
    name: 'Shield of Faith',
    category: 'activatable',
    bonusType: 'Deflection',
    values: { ac: 2 },
    notes: '+2 deflection bonus to AC',
  },
  {
    name: 'Barkskin',
    category: 'activatable',
    bonusType: 'NAT armor',
    values: { ac: 2 },
    notes: '+2 enhancement to natural armor',
  },
  {
    name: 'Sickened',
    category: 'debuff',
    bonusType: 'Untyped',
    values: { mattack: -2, rattack: -2, fort: -2, ref: -2, will: -2 },
    notes: '-2 untyped penalty on all attack rolls, damage, saves, skill checks',
  },
  {
    name: 'Shaken',
    category: 'debuff',
    bonusType: 'Untyped',
    values: { mattack: -2, rattack: -2, fort: -2, ref: -2, will: -2 },
    notes: '-2 untyped penalty on attack rolls, saving throws, skill checks',
  },
  {
    name: 'Fatigued',
    category: 'debuff',
    bonusType: 'Untyped',
    values: { str: -2, dex: -2 },
    notes: '-2 Strength, -2 Dexterity, cannot run or charge',
  },
  {
    name: 'Exhausted',
    category: 'debuff',
    bonusType: 'Untyped',
    values: { str: -6, dex: -6, ac: -3 },
    notes: '-6 Strength, -6 Dexterity, half speed',
  },
  {
    name: 'Ray of Enfeeblement',
    category: 'debuff',
    bonusType: 'Untyped',
    values: { str: -6 },
    notes: '1d6+5 Strength penalty (untyped)',
  },
  {
    name: 'Power Attack (-2 / +4)',
    category: 'activatable',
    bonusType: 'Untyped',
    values: { mattack: -2 },
    notes: '-2 attack roll penalty for extra melee damage',
  },
  {
    name: 'Combat Expertise (-2 / +2)',
    category: 'activatable',
    bonusType: 'Dodge',
    values: { mattack: -2, ac: 2 },
    notes: '-2 attack for +2 dodge bonus to AC',
  },
];

interface BuffBoxModuleProps {
  buffBox?: BuffBoxData;
  customBuffs?: CustomBuffEffect[];
  onUpdateBuffBox: (newBox: BuffBoxData) => void;
  onUpdateCustomBuffs?: (newBuffs: CustomBuffEffect[]) => void;
  abilities?: import('../../types/character').PF1Character['abilities'];
  onUpdateCharacter?: (updater: (prev: import('../../types/character').PF1Character) => import('../../types/character').PF1Character) => void;
  theme?: string;
  fontClass?: string;
  isToolModal?: boolean;
  onCloseModal?: () => void;
}

export const BuffBoxModule: React.FC<BuffBoxModuleProps> = ({
  buffBox,
  customBuffs = [],
  onUpdateBuffBox,
  onUpdateCustomBuffs,
  abilities,
  onUpdateCharacter,
  theme = 'parchment',
  fontClass = '',
  isToolModal = false,
  onCloseModal,
}) => {
  const [viewMode, setViewMode] = useState<'expanded' | 'rollup' | 'icon'>('rollup');
  const [filterCategory, setFilterCategory] = useState<'all' | 'active' | 'activatable' | 'permanent' | 'debuff'>('all');
  const [showFullMatrixTable, setShowFullMatrixTable] = useState(false);

  // New Buff / Debuff Creator Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'activatable' | 'permanent' | 'debuff'>('activatable');
  const [newBonusType, setNewBonusType] = useState<BuffBonusType>('Untyped');
  const [newValues, setNewValues] = useState<Record<BuffStatTarget, number>>({
    hp: 0,
    mattack: 0,
    rattack: 0,
    fort: 0,
    ref: 0,
    will: 0,
    ac: 0,
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
    str_mod: 0,
    dex_mod: 0,
    con_mod: 0,
    int_mod: 0,
    wis_mod: 0,
    cha_mod: 0,
  });
  const [newNotes, setNewNotes] = useState('');
  const [editingBuffId, setEditingBuffId] = useState<string | null>(null);

  const safeBox: BuffBoxData = buffBox || createEmptyBuffBox();
  const totals = computeBuffBoxTotals(safeBox, customBuffs);

  // Filtered list of buffs & debuffs
  const filteredBuffs = customBuffs.filter((b) => {
    if (filterCategory === 'active') return b.isActive;
    if (filterCategory === 'activatable') return b.category === 'activatable';
    if (filterCategory === 'permanent') return b.category === 'permanent';
    if (filterCategory === 'debuff') return b.category === 'debuff';
    return true;
  });

  const activeCount = customBuffs.filter((b) => b.isActive).length;

  // Active altered stats across all buffs & debuffs
  const activeAlteredStats = BUFF_STAT_TARGETS.filter((t) => totals[t.key] !== 0).map((t) => ({
    label: t.label,
    value: totals[t.key],
    key: t.key,
  }));

  const updateCellInMatrix = (bonusType: BuffBonusType, stat: BuffStatTarget, value: number) => {
    const updated: BuffBoxData = {
      ...safeBox,
      [bonusType]: {
        ...(safeBox[bonusType] || {}),
        [stat]: value,
      },
    };
    onUpdateBuffBox(updated);
  };

  const handleToggleBuff = (id: string) => {
    if (!onUpdateCustomBuffs) return;
    const updated = customBuffs.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b));
    onUpdateCustomBuffs(updated);
  };

  const handleDeleteBuff = (id: string) => {
    if (!onUpdateCustomBuffs) return;
    onUpdateCustomBuffs(customBuffs.filter((b) => b.id !== id));
  };

  const handleSaveBuff = () => {
    if (!newName.trim() || !onUpdateCustomBuffs) return;

    if (editingBuffId) {
      // Update existing
      const updated = customBuffs.map((b) =>
        b.id === editingBuffId
          ? {
              ...b,
              name: newName.trim(),
              category: newCategory,
              bonusType: newBonusType,
              values: { ...newValues },
              notes: newNotes.trim() || undefined,
            }
          : b
      );
      onUpdateCustomBuffs(updated);
      setEditingBuffId(null);
    } else {
      // Create new
      const newBuff: CustomBuffEffect = {
        id: `buff-${Date.now()}`,
        name: newName.trim(),
        category: newCategory,
        bonusType: newBonusType,
        isActive: true, // Auto-activate newly created buff
        values: { ...newValues },
        notes: newNotes.trim() || undefined,
      };
      onUpdateCustomBuffs([newBuff, ...customBuffs]);
    }

    // Reset creator form
    setNewName('');
    setNewNotes('');
    setNewValues({
      hp: 0,
      mattack: 0,
      rattack: 0,
      fort: 0,
      ref: 0,
      will: 0,
      ac: 0,
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
      str_mod: 0,
      dex_mod: 0,
      con_mod: 0,
      int_mod: 0,
      wis_mod: 0,
      cha_mod: 0,
    });
  };

  const handleEditBuff = (b: CustomBuffEffect) => {
    setEditingBuffId(b.id);
    setNewName(b.name);
    setNewCategory(b.category);
    setNewBonusType(b.bonusType);
    const initialValues: Record<BuffStatTarget, number> = {
      hp: 0,
      mattack: 0,
      rattack: 0,
      fort: 0,
      ref: 0,
      will: 0,
      ac: 0,
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
      str_mod: 0,
      dex_mod: 0,
      con_mod: 0,
      int_mod: 0,
      wis_mod: 0,
      cha_mod: 0,
      ...(b.values || {}),
    };
    setNewValues(initialValues);
    setNewNotes(b.notes || '');
    if (viewMode === 'rollup' || viewMode === 'icon') {
      setViewMode('expanded');
    }
  };

  const handleLoadTemplate = (tpl: typeof PRESET_TEMPLATES[0]) => {
    setNewName(tpl.name);
    setNewCategory(tpl.category);
    setNewBonusType(tpl.bonusType);
    setNewNotes(tpl.notes || '');
    const filledValues: Record<BuffStatTarget, number> = {
      hp: 0,
      mattack: 0,
      rattack: 0,
      fort: 0,
      ref: 0,
      will: 0,
      ac: 0,
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
      str_mod: 0,
      dex_mod: 0,
      con_mod: 0,
      int_mod: 0,
      wis_mod: 0,
      cha_mod: 0,
    };
    for (const key of Object.keys(tpl.values) as BuffStatTarget[]) {
      filledValues[key] = tpl.values[key] || 0;
    }
    setNewValues(filledValues);
  };

  const isParchment = theme === 'parchment';
  const isBlueprint = theme === 'blueprint';
  const isMythWeavers = theme === 'mythweavers';
  const isLightTheme = isParchment || theme === 'print';

  const cardBg = isParchment
    ? 'bg-amber-50/80 border-amber-800/30 text-stone-900 shadow-sm'
    : isBlueprint
    ? 'bg-slate-900/95 border-cyan-500/50 text-cyan-50 shadow-cyan-950/50'
    : isMythWeavers
    ? 'bg-[#15171a] border-[#2d3139] text-slate-100'
    : 'bg-white border-black text-black';

  const headerBg = isParchment
    ? 'bg-amber-900/10 border-amber-900/20 text-amber-950 font-serif'
    : isBlueprint
    ? 'bg-cyan-950/90 border-cyan-500/40 text-cyan-300 font-mono'
    : isMythWeavers
    ? 'bg-[#0f1113] border-[#2d3139] text-amber-400 font-serif'
    : 'bg-neutral-100 border-black text-black';

  const inputStyle = isParchment
    ? 'bg-white/90 border-amber-900/20 text-stone-900 focus:border-amber-700'
    : isBlueprint
    ? 'bg-slate-950/80 border-cyan-700/50 text-cyan-200 focus:border-cyan-400'
    : isMythWeavers
    ? 'bg-[#0d0e10] border-[#383d47] text-amber-100 focus:border-amber-500'
    : 'bg-white border-neutral-400 text-black';

  // Compact Icon Mode |<^>|
  if (viewMode === 'icon') {
    return (
      <div className="inline-flex items-center shrink-0 whitespace-nowrap">
        <button
          onClick={() => setViewMode('rollup')}
          className="px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-md border border-amber-400 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
          title="Expand Buff Box (|<^>|)"
        >
          <span className="whitespace-nowrap shrink-0">|&lt;^&gt;|</span>
          <span className="whitespace-nowrap shrink-0">Buff Box</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] whitespace-nowrap shrink-0">
            {activeCount} active
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${cardBg} ${fontClass} transition-all duration-200`}>
      {/* Header Bar */}
      <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 ${headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className={`w-4 h-4 shrink-0 ${isLightTheme ? 'text-amber-700' : 'text-amber-500'}`} />
          <span className="font-bold text-xs uppercase tracking-wider truncate">
            Buff Box: Status Effects &amp; Bonus Matrix
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
            isLightTheme
              ? 'bg-sky-100 text-sky-900 border-sky-700/40 font-bold'
              : 'bg-cyan-950 text-cyan-300 border-cyan-500/30'
          }`}>
            {activeCount} Active / {customBuffs.length} Total
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Roll left into small compact icon |<^>| - Never wraps */}
          <button
            onClick={() => setViewMode('icon')}
            className={`px-2 py-0.5 text-xs font-mono font-bold rounded border whitespace-nowrap shrink-0 ${
              isLightTheme
                ? 'border-amber-700/50 bg-amber-100 hover:bg-amber-200 text-amber-950'
                : 'border-amber-500/40 bg-black/5 dark:bg-white/5 hover:bg-amber-500/20 text-amber-400'
            }`}
            title="Roll into compact icon |<^>|"
          >
            |&lt;^&gt;|
          </button>

          {/* Toggle rollup vs expanded */}
          <button
            onClick={() => setViewMode(viewMode === 'expanded' ? 'rollup' : 'expanded')}
            className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            {viewMode === 'expanded' ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                <span>Roll Up</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                <span>Expand Matrix</span>
              </>
            )}
          </button>

          {onCloseModal && (
            <button
              onClick={onCloseModal}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ROLLED UP VIEW: Shows active sum badges with fast toggles */}
      {viewMode === 'rollup' && (
        <div className="p-3 space-y-2">
          {activeAlteredStats.length === 0 ? (
            <div className="flex items-center justify-between text-xs opacity-75">
              <span>No active buffs or debuffs. Check an effect below or expand to create one.</span>
              <button
                onClick={() => setViewMode('expanded')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 underline ml-2 font-mono"
              >
                Open Creator & Matrix
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold opacity-75 mr-1 font-mono">Active Sum Matrix:</span>
              {activeAlteredStats.map((stat) => (
                <span
                  key={stat.key}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                    stat.value > 0
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  {stat.label}: {stat.value > 0 ? `+${stat.value}` : stat.value}
                </span>
              ))}
              <button
                onClick={() => setViewMode('expanded')}
                className="text-[11px] underline opacity-75 hover:opacity-100 ml-auto font-mono text-cyan-400"
              >
                Manage Effects
              </button>
            </div>
          )}

          {/* Quick toggle list in rollup */}
          {customBuffs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-black/5 dark:border-white/5">
              {customBuffs.slice(0, 8).map((buff) => (
                <button
                  key={buff.id}
                  onClick={() => handleToggleBuff(buff.id)}
                  className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
                    buff.isActive
                      ? buff.category === 'debuff'
                        ? 'bg-rose-950/80 border-rose-500/50 text-rose-200 font-bold'
                        : 'bg-cyan-950/80 border-cyan-400 text-cyan-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {buff.isActive ? (
                    <CheckSquare className="w-3 h-3 text-cyan-400" />
                  ) : (
                    <Square className="w-3 h-3 text-slate-600" />
                  )}
                  <span>{buff.name}</span>
                </button>
              ))}
              {customBuffs.length > 8 && (
                <button
                  onClick={() => setViewMode('expanded')}
                  className="px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-slate-200"
                >
                  +{customBuffs.length - 8} more...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXPANDED VIEW: Creator Prompt + Active Sums + List of Buffs/Debuffs + Matrix */}
      {viewMode === 'expanded' && (
        <div className="p-3 space-y-4">
          {/* 1. CREATOR PROMPT AT THE TOP */}
          <div className="p-3 rounded-lg border border-cyan-500/40 bg-slate-950/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-cyan-200 uppercase">
                  {editingBuffId ? 'Edit Status Effect / Buff' : 'Create New Buff or Debuff'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  (Supports negative penalties & Untyped debuffs)
                </span>
              </div>

              {/* Template preset selector */}
              <select
                onChange={(e) => {
                  const tpl = PRESET_TEMPLATES.find((p) => p.name === e.target.value);
                  if (tpl) handleLoadTemplate(tpl);
                }}
                defaultValue=""
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-mono"
              >
                <option value="" disabled>Load Standard Preset...</option>
                {PRESET_TEMPLATES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Input row: Name, Category, Bonus Type */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-5">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Name of Buff / Debuff</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Haste, Sickened, Bull's Strength, Shaken"
                  className={`w-full px-2.5 py-1.5 rounded font-medium ${inputStyle}`}
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Status Effect Category</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNewCategory('activatable')}
                    className={`flex-1 py-1.5 rounded text-[11px] font-mono text-center border transition-all ${
                      newCategory === 'activatable'
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Activatable
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory('permanent')}
                    className={`flex-1 py-1.5 rounded text-[11px] font-mono text-center border transition-all ${
                      newCategory === 'permanent'
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Permanent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategory('debuff');
                      setNewBonusType('Untyped');
                    }}
                    className={`flex-1 py-1.5 rounded text-[11px] font-mono text-center border transition-all ${
                      newCategory === 'debuff'
                        ? 'bg-rose-500/20 text-rose-200 border-rose-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Debuff
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Bonus Type</label>
                <select
                  value={newBonusType}
                  onChange={(e) => setNewBonusType(e.target.value as BuffBonusType)}
                  className={`w-full px-2 py-1.5 rounded font-mono text-xs ${inputStyle}`}
                >
                  {BUFF_BONUS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt} {bt === 'Untyped' ? '(Debuff default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Values Input Grid (13 stats) */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">
                Modifier Values (enter positive numbers for buffs, negative numbers like -2 for debuffs):
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-13 gap-1.5 text-xs font-mono">
                {BUFF_STAT_TARGETS.map((t) => (
                  <div key={t.key} className="text-center">
                    <span className="block text-[10px] text-slate-400 font-semibold truncate">{t.label}</span>
                    <input
                      type="number"
                      value={newValues[t.key] === 0 ? '' : newValues[t.key]}
                      placeholder="0"
                      onChange={(e) =>
                        setNewValues({
                          ...newValues,
                          [t.key]: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className={`w-full text-center py-1 rounded border text-xs font-mono tabular-nums ${inputStyle} ${
                        newValues[t.key] > 0
                          ? 'text-emerald-400 font-bold'
                          : newValues[t.key] < 0
                          ? 'text-rose-400 font-bold'
                          : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save / Cancel buttons */}
            <div className="flex items-center justify-between pt-1">
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional notes or duration (e.g. '1 round/level', 'Save ends', 'Item enhancement')..."
                className={`max-w-md text-xs px-2.5 py-1 rounded ${inputStyle}`}
              />

              <div className="flex items-center gap-2">
                {editingBuffId && (
                  <button
                    onClick={() => {
                      setEditingBuffId(null);
                      setNewName('');
                    }}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSaveBuff}
                  disabled={!newName.trim()}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingBuffId ? 'Update Effect' : 'Save & Add to Buff Box'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. SUM MATRIX OF ALL BUFFS & DEBUFFS */}
          <div className="p-3 rounded-lg border border-amber-500/40 bg-slate-950/90 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                  Sum Matrix of All Active Buffs & Debuffs ({activeCount} active)
                </span>
              </div>
              <button
                onClick={() => setShowFullMatrixTable(!showFullMatrixTable)}
                className="text-[11px] font-mono text-cyan-400 hover:underline"
              >
                {showFullMatrixTable ? 'Hide 19-Row Breakdown' : 'Show Full 19-Row Typed Matrix'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="p-1.5 text-left">Category</th>
                    {BUFF_STAT_TARGETS.map((t) => (
                      <th key={t.key} className="p-1.5 text-center min-w-[44px]">
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-900/80 font-bold border-b border-amber-500/40">
                    <td className="p-2 text-left text-amber-300 font-bold text-xs uppercase">
                      Total Active Sum
                    </td>
                    {BUFF_STAT_TARGETS.map((t) => {
                      const totalVal = totals[t.key];
                      return (
                        <td key={t.key} className="p-2 text-xs tabular-nums">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              totalVal > 0
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-black'
                                : totalVal < 0
                                ? 'bg-rose-950 text-rose-400 border border-rose-500/40 font-black'
                                : 'opacity-40 text-slate-500'
                            }`}
                          >
                            {totalVal > 0 ? `+${totalVal}` : totalVal}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2B. ABILITY SCORES MOD ADJ (Direct Modifier Adjustments for All 6 Ability Scores) */}
          <div className="p-3 rounded-lg border border-cyan-500/40 bg-slate-950/80 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-cyan-800/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wide">
                  Ability Scores Mod ADJ (Direct Modifier Buffs)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Direct modifier adjustments apply directly to attack rolls, checks, and saves without changing total score.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 font-mono text-xs">
              {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
                const statKey = `${ab.toLowerCase()}_mod` as BuffStatTarget;
                const buffModSum = totals[statKey] || 0;
                const directMod = abilities?.[ab]?.directMod || 0;
                const totalModAdj = directMod + buffModSum;

                return (
                  <div
                    key={ab}
                    className="p-2 rounded-lg bg-black/40 border border-cyan-900/50 flex flex-col items-center justify-between space-y-1"
                  >
                    <span className="text-xs font-bold text-cyan-300">{ab} Mod ADJ</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Direct:</span>
                      <input
                        type="number"
                        value={directMod}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (onUpdateCharacter) {
                            onUpdateCharacter((prev) => ({
                              ...prev,
                              abilities: {
                                ...prev.abilities,
                                [ab]: {
                                  ...prev.abilities[ab],
                                  directMod: val,
                                },
                              },
                            }));
                          }
                        }}
                        disabled={!onUpdateCharacter}
                        className={`w-11 text-center py-0.5 rounded border text-xs font-bold tabular-nums ${inputStyle} ${
                          directMod !== 0 ? 'text-amber-300 border-amber-500/50' : 'text-slate-300'
                        }`}
                        title={`Direct ${ab} modifier adjustment`}
                      />
                    </div>
                    <div className="text-[10px] flex items-center justify-between w-full pt-1 border-t border-slate-800 text-slate-400">
                      <span>Buffs: {buffModSum >= 0 ? `+${buffModSum}` : buffModSum}</span>
                      <strong className={`font-bold ${totalModAdj > 0 ? 'text-emerald-400' : totalModAdj < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        Net: {totalModAdj >= 0 ? `+${totalModAdj}` : totalModAdj}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. LIST OF SAVED BUFFS & DEBUFFS WITH ACTIVATION CHECKBOXES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                  Saved Status Effects ({customBuffs.length})
                </span>
                <span className="text-[10px] text-slate-500">
                  (Click checkbox to activate or deactivate)
                </span>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                {(['all', 'active', 'activatable', 'permanent', 'debuff'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      filterCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {filteredBuffs.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center text-xs text-slate-500 italic">
                No effects found under filter "{filterCategory}". Use the creator prompt above to add new buffs or debuffs.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredBuffs.map((buff) => {
                  const nonZeroVals = BUFF_STAT_TARGETS.filter((t) => (buff.values[t.key] || 0) !== 0);
                  const isDebuff = buff.category === 'debuff' || nonZeroVals.some((t) => (buff.values[t.key] || 0) < 0);

                  return (
                    <div
                      key={buff.id}
                      className={`p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2.5 ${
                        buff.isActive
                          ? isDebuff
                            ? 'bg-rose-950/40 border-rose-500/50 text-rose-100 shadow-xs'
                            : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-100 shadow-xs'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {/* Left: Checkbox & Details */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleBuff(buff.id)}
                          className="mt-0.5 shrink-0 focus:outline-none"
                          title={buff.isActive ? 'Deactivate effect' : 'Activate effect'}
                        >
                          {buff.isActive ? (
                            <CheckSquare
                              className={`w-4 h-4 ${
                                isDebuff ? 'text-rose-400' : 'text-cyan-400'
                              }`}
                            />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => handleToggleBuff(buff.id)}
                              className={`font-semibold text-xs cursor-pointer ${
                                buff.isActive ? 'text-white' : 'text-slate-400 line-through'
                              }`}
                            >
                              {buff.name}
                            </span>

                            {buff.itemId && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300">
                                🎒 Item Buff
                              </span>
                            )}

                            {/* Category Badge */}
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                buff.category === 'permanent'
                                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                                  : buff.category === 'debuff'
                                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                                  : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                              }`}
                            >
                              {buff.category}
                            </span>

                            {/* Bonus Type Badge */}
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300">
                              {buff.bonusType}
                            </span>
                          </div>

                          {/* Value pills */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {nonZeroVals.length === 0 ? (
                              <span className="text-[10px] text-slate-500 italic">No modifiers</span>
                            ) : (
                              nonZeroVals.map((t) => {
                                const val = buff.values[t.key] || 0;
                                return (
                                  <span
                                    key={t.key}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                      val > 0
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                                    }`}
                                  >
                                    {t.label}: {val > 0 ? `+${val}` : val}
                                  </span>
                                );
                              })
                            )}
                          </div>

                          {buff.notes && (
                            <div className="text-[10px] text-slate-400 mt-1 truncate">
                              {buff.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditBuff(buff)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                          title="Edit effect"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBuff(buff.id)}
                          className="p-1 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete effect"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. OPTIONAL FULL 19-ROW TYPED MATRIX (Enhancement, Luck, Morale, Untyped, etc.) */}
          {showFullMatrixTable && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                  19-Row Bonus Type Distribution (Base Matrix)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Enter manual typed numbers directly into cells if desired
                </span>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-800 rounded">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="sticky top-0 bg-slate-900 text-slate-100 text-[10px] uppercase font-bold border-b border-slate-700 z-10">
                    <tr>
                      <th className="p-2 min-w-[130px]">Bonus Type</th>
                      {BUFF_STAT_TARGETS.map((t) => (
                        <th key={t.key} className="p-1.5 text-center min-w-[48px]">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {BUFF_BONUS_TYPES.map((bonusType) => {
                      const rowData = safeBox[bonusType] || {};
                      return (
                        <tr key={bonusType} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-1.5 font-medium text-xs whitespace-nowrap text-slate-300">
                            {bonusType}
                          </td>
                          {BUFF_STAT_TARGETS.map((t) => {
                            const cellVal = rowData[t.key] || 0;
                            return (
                              <td key={t.key} className="p-1 text-center">
                                <input
                                  type="number"
                                  value={cellVal === 0 ? '' : cellVal}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateCellInMatrix(bonusType, t.key, parseInt(e.target.value, 10) || 0)
                                  }
                                  className={`w-11 text-center py-0.5 text-xs font-mono rounded border tabular-nums ${inputStyle} ${
                                    cellVal !== 0 ? 'font-bold text-amber-400' : 'opacity-50'
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <span className="opacity-75 text-[11px] font-mono text-slate-400">
              Active sums automatically alter Attack rolls, Saves, AC, HP, and Ability Scores in real time.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('rollup')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-xs rounded transition-colors"
              >
                Roll Up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
