import React, { useState, useMemo } from 'react';
import {
  Dices,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Zap,
  Flame,
  Shield,
  Swords,
  Crosshair,
  BookOpen,
  Award,
  RefreshCw,
  Minus,
  Edit3,
  Check,
  ChevronDown,
  Layers,
  Info,
  Clock,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  PF1Character,
  SkillItem,
  AbilityName,
  SkillPointsConfig,
  ResourceTracker,
  CharacterActionItem,
  FeatItem,
} from '../../types/character';
import { DerivedCombatStats } from '../../engine/pf1eMath';
import { GlyphStyle, resolveIconOrGlyphUrl } from '../../data/glyphs';
import { GlyphPicker } from '../tools/GlyphPicker';

interface SheetPage2ActionsSkillsProps {
  character: PF1Character;
  derived: DerivedCombatStats;
  theme: string;
  fontClass: string;
  glyphStyle?: GlyphStyle;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  onRollFormula: (formula: string, label?: string) => void;
  visibleModules?: Record<string, boolean>;
}

export type SkillSortOption =
  | 'custom'
  | 'name-asc'
  | 'ability'
  | 'class-first'
  | 'bonus-desc'
  | 'bonus-asc';

export const SheetPage2ActionsSkills: React.FC<SheetPage2ActionsSkillsProps> = ({
  character,
  derived,
  theme,
  fontClass,
  glyphStyle = '01-flat-enamel',
  onUpdateCharacter,
  onRollFormula,
  visibleModules = {},
}) => {
  // Skill search, sorting, collapse 0-SP, and add new skill state
  const [skillSearch, setSkillSearch] = useState('');
  const [skillSort, setSkillSort] = useState<SkillSortOption>('custom');
  const [collapseZeroSpSkills, setCollapseZeroSpSkills] = useState(false);
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillAbility, setNewSkillAbility] = useState<AbilityName>('INT');
  const [newSkillIsClass, setNewSkillIsClass] = useState(true);
  const [newSkillTrainedOnly, setNewSkillTrainedOnly] = useState(false);
  const [newSkillHasAcp, setNewSkillHasAcp] = useState(false);

  // Action search & category filter (Matches Wireframe Image 1: "search bar_smite____", "list of all available actions by section")
  const [actionSearch, setActionSearch] = useState('');
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('All');
  const [selectedActionId, setSelectedActionId] = useState<string>('act-smite');

  // Modal / Drawer states
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [isAddFeatOpen, setIsAddFeatOpen] = useState(false);

  // New resource form state
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceMax, setNewResourceMax] = useState('3');
  const [newResourceMacro, setNewResourceMacro] = useState('');
  const [newResourceCategory, setNewResourceCategory] = useState<
    'Class Resource' | 'Spell Slot' | 'Resource Pool' | 'Special'
  >('Class Resource');
  const [newResourceGlyph, setNewResourceGlyph] = useState('');

  // New action form state
  const [newActionName, setNewActionName] = useState('');
  const [newActionCategory, setNewActionCategory] = useState<
    'Spells' | 'SLA' | 'Class Ability' | 'Feats' | 'Racial' | 'Combat' | 'Other'
  >('Class Ability');
  const [newActionType, setNewActionType] = useState<
    'Standard' | 'Move' | 'Swift' | 'Immediate' | 'Free' | 'Full-Round' | '1 Round'
  >('Standard');
  const [newActionMacro, setNewActionMacro] = useState('');
  const [newActionIcon, setNewActionIcon] = useState('');
  const [newActionDesc, setNewActionDesc] = useState('');

  // New feat form state
  const [newFeatName, setNewFeatName] = useState('');
  const [newFeatType, setNewFeatType] = useState('Combat');
  const [newFeatPrereq, setNewFeatPrereq] = useState('');
  const [newFeatSummary, setNewFeatSummary] = useState('');
  const [newFeatGlyph, setNewFeatGlyph] = useState('');

  // Styling helpers
  const isParchment = theme === 'parchment';
  const isPrint = theme === 'print';
  const isLightTheme = isParchment || isPrint;
  const isBlueprint = theme === 'blueprint';
  const isMythWeavers = theme === 'mythweavers';

  const cardBg = isParchment
    ? 'bg-amber-50/70 border-amber-800/20 text-stone-900 shadow-sm'
    : isBlueprint
    ? 'bg-slate-900/90 border-cyan-500/40 text-cyan-50'
    : isMythWeavers
    ? 'bg-[#15171a] border-[#2d3139] text-slate-100'
    : 'bg-white border-black text-black';

  const headerBg = isParchment
    ? 'bg-amber-900/10 border-amber-900/20 text-amber-950 font-serif'
    : isBlueprint
    ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 font-mono'
    : isMythWeavers
    ? 'bg-[#0f1113] border-[#2d3139] text-amber-400 font-serif'
    : 'bg-neutral-100 border-black text-black font-sans';

  const inputStyle = isParchment
    ? 'bg-white/80 border-amber-900/30 text-stone-900 focus:border-amber-700 focus:bg-white'
    : isBlueprint
    ? 'bg-slate-950/80 border-cyan-700/60 text-cyan-200 focus:border-cyan-400'
    : isMythWeavers
    ? 'bg-[#0d0e10] border-[#383d47] text-amber-100 focus:border-amber-500'
    : 'bg-white border-neutral-400 text-black';

  const setField = <K extends keyof PF1Character>(key: K, value: PF1Character[K]) => {
    onUpdateCharacter((prev) => ({ ...prev, [key]: value }));
  };

  // Skill points configuration state helpers
  const spConfig: SkillPointsConfig = character.skillPointsConfig || {};
  const [selectedClassId, setSelectedClassId] = useState<string>('class1');

  const classesList = useMemo(() => {
    const list: { id: string; name: string; level: number; spPerLevel: number }[] = [];
    if (character.customClassGrids) {
      Object.values(character.customClassGrids).forEach((grid) => {
        list.push({
          id: grid.id,
          name: grid.className || grid.id,
          level: grid.level || character.level,
          spPerLevel: grid.skillPointsPerLevel || 2,
        });
      });
    }
    if (list.length === 0 && character.classes && character.classes.length > 0) {
      character.classes.forEach((c) => {
        list.push({
          id: c.id,
          name: c.name,
          level: c.level,
          spPerLevel: c.skillPointsPerLevel || 2,
        });
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'class1',
        name: character.characterClass || 'Class 1',
        level: character.level || 1,
        spPerLevel: character.classSkillPointsPerLevel || 2,
      });
    }
    return list;
  }, [character.customClassGrids, character.classes, character.level, character.characterClass, character.classSkillPointsPerLevel]);

  const activeClass = useMemo(() => {
    return classesList.find((c) => c.id === selectedClassId) || classesList[0];
  }, [classesList, selectedClassId]);

  const effectiveIntMod = spConfig.intOverride !== undefined ? spConfig.intOverride : derived.intMod;
  const classBaseSp = spConfig.classSpOverrides?.[activeClass.id] ?? activeClass.spPerLevel;
  const extraPerLvl = spConfig.extraPerLevel || 0;
  const flatBonus = spConfig.bonusFlat || 0;

  const totalCalculatedSp = useMemo(() => {
    let total = 0;
    classesList.forEach((cls) => {
      const spRate = spConfig.classSpOverrides?.[cls.id] ?? cls.spPerLevel;
      const perLvl = Math.max(1, spRate + effectiveIntMod + extraPerLvl);
      total += perLvl * cls.level;
    });
    total += flatBonus;
    return total;
  }, [classesList, spConfig, effectiveIntMod, extraPerLvl, flatBonus]);

  const totalAvailableSp = spConfig.isManualOverride
    ? spConfig.manualOverride ?? totalCalculatedSp
    : totalCalculatedSp;

  const totalInvestedSp = useMemo(() => {
    return (character.skills || []).reduce((acc, s) => acc + (s.ranks || 0), 0);
  }, [character.skills]);

  const spRemaining = totalAvailableSp - totalInvestedSp;

  const updateSkill = (id: string, updates: Partial<SkillItem>) => {
    setField(
      'skills',
      (character.skills || []).map((sk) => (sk.id === id ? { ...sk, ...updates } : sk))
    );
  };

  // Ability Mod lookup helper
  const getAbilityMod = (ability: AbilityName) => {
    switch (ability) {
      case 'STR': return derived.strMod;
      case 'DEX': return derived.dexMod;
      case 'CON': return derived.conMod;
      case 'INT': return derived.intMod;
      case 'WIS': return derived.wisMod;
      case 'CHA': return derived.chaMod;
      default: return 0;
    }
  };

  // Calculate total skill bonus for a skill item
  const calculateSkillBonus = (skill: SkillItem) => {
    const abilityMod = getAbilityMod(skill.keyAbility);
    const classBonus = skill.isClassSkill && skill.ranks >= 1 ? 3 : 0;
    const acpPenalty = skill.hasArmorCheckPenalty ? derived.armorCheckPenaltyTotal : 0;
    return abilityMod + skill.ranks + classBonus + (skill.miscMod || 0) + acpPenalty;
  };

  // Add a new custom skill to the skill list
  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    const newSk: SkillItem = {
      id: `sk-custom-${Date.now()}`,
      name: newSkillName.trim(),
      keyAbility: newSkillAbility,
      isClassSkill: newSkillIsClass,
      ranks: 0,
      miscMod: 0,
      hasArmorCheckPenalty: newSkillHasAcp,
      isTrainedOnly: newSkillTrainedOnly,
    };
    setField('skills', [...(character.skills || []), newSk]);
    setNewSkillName('');
    setIsAddSkillOpen(false);
  };

  // Sort and filter skills
  const sortedSkills = useMemo(() => {
    let list = [...(character.skills || [])];

    if (collapseZeroSpSkills) {
      list = list.filter((s) => (s.ranks || 0) > 0);
    }

    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.keyAbility.toLowerCase().includes(q));
    }

    const abilityOrder: Record<AbilityName, number> = {
      STR: 1,
      DEX: 2,
      CON: 3,
      INT: 4,
      WIS: 5,
      CHA: 6,
    };

    switch (skillSort) {
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'ability':
        return list.sort((a, b) => {
          const orderDiff = (abilityOrder[a.keyAbility] || 99) - (abilityOrder[b.keyAbility] || 99);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name);
        });
      case 'class-first':
        return list.sort((a, b) => {
          if (a.isClassSkill === b.isClassSkill) return a.name.localeCompare(b.name);
          return a.isClassSkill ? -1 : 1;
        });
      case 'bonus-desc':
        return list.sort((a, b) => calculateSkillBonus(b) - calculateSkillBonus(a));
      case 'bonus-asc':
        return list.sort((a, b) => calculateSkillBonus(a) - calculateSkillBonus(b));
      case 'custom':
      default:
        return list;
    }
  }, [character.skills, skillSearch, skillSort, collapseZeroSpSkills, derived]);

  // Resource Trackers logic
  const resourceTrackers = character.resourceTrackers || [];

  const updateResource = (id: string, updates: Partial<ResourceTracker>) => {
    setField(
      'resourceTrackers',
      resourceTrackers.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const useResource = (id: string) => {
    setField(
      'resourceTrackers',
      resourceTrackers.map((r) => {
        if (r.id === id) {
          const nextVal = Math.max(0, r.current - 1);
          return { ...r, current: nextVal };
        }
        return r;
      })
    );
  };

  const restoreResource = (id: string) => {
    setField(
      'resourceTrackers',
      resourceTrackers.map((r) => {
        if (r.id === id) {
          const nextVal = Math.min(r.max, r.current + 1);
          return { ...r, current: nextVal };
        }
        return r;
      })
    );
  };

  const refreshResource = (id: string) => {
    setField(
      'resourceTrackers',
      resourceTrackers.map((r) => (r.id === id ? { ...r, current: r.max } : r))
    );
  };

  const deleteResource = (id: string) => {
    setField('resourceTrackers', resourceTrackers.filter((r) => r.id !== id));
  };

  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    const maxVal = parseInt(newResourceMax, 10) || 1;
    const newRes: ResourceTracker = {
      id: `res-${Date.now()}`,
      name: newResourceName.trim(),
      current: maxVal,
      max: maxVal,
      macroKey: newResourceMacro.trim().toUpperCase() || undefined,
      category: newResourceCategory,
      icon: newResourceGlyph || undefined,
    };
    setField('resourceTrackers', [...resourceTrackers, newRes]);
    setNewResourceName('');
    setNewResourceMax('3');
    setNewResourceMacro('');
    setNewResourceGlyph('');
    setIsAddResourceOpen(false);
  };

  // Actions Directory logic
  const characterActions = character.characterActions || [];

  const filteredActions = useMemo(() => {
    return characterActions.filter((act) => {
      const matchCat =
        actionCategoryFilter === 'All' ||
        act.category.toLowerCase() === actionCategoryFilter.toLowerCase();
      const matchSearch =
        !actionSearch.trim() ||
        act.name.toLowerCase().includes(actionSearch.toLowerCase()) ||
        act.description.toLowerCase().includes(actionSearch.toLowerCase()) ||
        (act.macroFormula && act.macroFormula.toLowerCase().includes(actionSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [characterActions, actionCategoryFilter, actionSearch]);

  const selectedAction = useMemo(() => {
    return (
      characterActions.find((a) => a.id === selectedActionId) ||
      characterActions[0] ||
      null
    );
  }, [characterActions, selectedActionId]);

  const handleAddAction = () => {
    if (!newActionName.trim()) return;
    const newAct: CharacterActionItem = {
      id: `act-${Date.now()}`,
      name: newActionName.trim(),
      category: newActionCategory,
      actionType: newActionType,
      macroFormula: newActionMacro.trim() || undefined,
      icon: newActionIcon || undefined,
      description: newActionDesc.trim() || 'No description provided.',
      shortSummary: `${newActionType} action. ${newActionMacro || ''}`,
    };
    setField('characterActions', [...characterActions, newAct]);
    setSelectedActionId(newAct.id);
    setNewActionName('');
    setNewActionMacro('');
    setNewActionIcon('');
    setNewActionDesc('');
    setIsAddActionOpen(false);
  };

  const deleteAction = (id: string) => {
    const updated = characterActions.filter((a) => a.id !== id);
    setField('characterActions', updated);
    if (selectedActionId === id && updated.length > 0) {
      setSelectedActionId(updated[0].id);
    }
  };

  // Feats list logic
  const characterFeats = character.characterFeats || [];

  const handleAddFeat = () => {
    if (!newFeatName.trim()) return;
    const newF: FeatItem = {
      id: `feat-${Date.now()}`,
      name: newFeatName.trim(),
      type: newFeatType,
      prerequisites: newFeatPrereq.trim() || 'None',
      summary: newFeatSummary.trim() || 'Benefit description...',
      icon: newFeatGlyph || undefined,
    };
    setField('characterFeats', [...characterFeats, newF]);
    setNewFeatName('');
    setNewFeatPrereq('');
    setNewFeatSummary('');
    setNewFeatGlyph('');
    setIsAddFeatOpen(false);
  };

  const deleteFeat = (id: string) => {
    setField('characterFeats', characterFeats.filter((f) => f.id !== id));
  };

  // Helper for rendering action icon or assigned glyph
  const renderActionIcon = (iconName?: string) => {
    const resolvedGlyph = resolveIconOrGlyphUrl(iconName, glyphStyle);
    if (resolvedGlyph) {
      return (
        <img
          src={resolvedGlyph}
          alt=""
          className="w-5 h-5 object-contain shrink-0"
        />
      );
    }
    switch (iconName) {
      case 'flame':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'swords':
        return <Swords className="w-4 h-4 text-rose-500" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-emerald-500" />;
      case 'crosshair':
        return <Crosshair className="w-4 h-4 text-cyan-500" />;
      case 'book':
        return <BookOpen className="w-4 h-4 text-purple-500" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-amber-600 dark:text-yellow-400" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <div className={`space-y-6 ${fontClass}`}>
      {/* Top Banner Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold text-amber-300 text-sm">Action Command Center & Skills Matrix</span>
            <p className="text-xs text-slate-400">
              Manage class resources, spells known & per-day pools, combat actions, and 35 PF1e skills.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800">
            SP Remaining: {spRemaining} / {totalAvailableSp}
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout (Matches Wireframe Image 1: Left = Skills, Right = Resources & Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN (lg:col-span-5): 35 PF1e Skills Matrix with Reorganization */}
        {/* ========================================================================= */}
        {visibleModules.skills !== false && (
        <div className="lg:col-span-5 space-y-4">
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            {/* Skills Header & Sort / Organization Controls */}
            <div className="flex flex-col gap-3 pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  <h3 className="font-serif font-bold text-base tracking-wide">Skills Matrix</h3>
                  <span className="text-[11px] font-mono opacity-70">
                    ({sortedSkills.length}/{character.skills?.length || 35})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCollapseZeroSpSkills(!collapseZeroSpSkills)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 transition-colors ${
                      collapseZeroSpSkills
                        ? 'bg-amber-600 text-slate-950 border-amber-600'
                        : 'bg-black/5 dark:bg-white/10 border-black/15 dark:border-white/15 opacity-80 hover:opacity-100'
                    }`}
                    title="Fold / hide skills with 0 skill points (SP) invested"
                  >
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        collapseZeroSpSkills ? '-rotate-90' : ''
                      }`}
                    />
                    <span>{collapseZeroSpSkills ? 'Unfold 0 SP' : 'Fold Unused (0 SP)'}</span>
                  </button>
                  <button
                    onClick={() => setIsAddSkillOpen(!isAddSkillOpen)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors"
                    title="Create a new skill and add it to the skill list"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Skill</span>
                  </button>
                </div>
              </div>

              {isAddSkillOpen && (
                <div className="p-2.5 rounded-lg border border-amber-500/40 bg-black/5 dark:bg-white/5 space-y-2 text-xs font-mono">
                  <div className="font-bold text-[11px] uppercase">Create Custom Skill</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      placeholder="Skill Name (e.g. Craft: Traps)"
                      className={`sm:col-span-2 px-2 py-1 rounded border text-xs ${inputStyle}`}
                    />
                    <select
                      value={newSkillAbility}
                      onChange={(e) => setNewSkillAbility(e.target.value as AbilityName)}
                      className={`px-2 py-1 rounded border text-xs font-bold ${inputStyle}`}
                    >
                      {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => (
                        <option key={ab} value={ab}>
                          Key: {ab}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newSkillIsClass}
                          onChange={(e) => setNewSkillIsClass(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        <span>Class Skill</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newSkillTrainedOnly}
                          onChange={(e) => setNewSkillTrainedOnly(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        <span>Trained Only</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newSkillHasAcp}
                          onChange={(e) => setNewSkillHasAcp(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        <span>ACP</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsAddSkillOpen(false)}
                        className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddSkill}
                        className="px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[11px]"
                      >
                        Add Skill
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SP Calculation Bar */}
              <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className={`font-bold ${isLightTheme ? 'text-amber-900' : 'text-amber-500'}`}>
                    Skill Points Allocation:
                  </span>
                  <span className={spRemaining < 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                    {totalInvestedSp} / {totalAvailableSp} SP ({spRemaining >= 0 ? `${spRemaining} left` : `${Math.abs(spRemaining)} over`})
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                  <div className="bg-black/5 dark:bg-white/5 p-1 rounded">
                    <span className="opacity-60 block">INT Mod</span>
                    <span className="font-bold">{effectiveIntMod >= 0 ? `+${effectiveIntMod}` : effectiveIntMod}</span>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-1 rounded">
                    <span className="opacity-60 block">{activeClass.name.slice(0, 7)}</span>
                    <span className="font-bold">{classBaseSp} SP/lvl</span>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-1 rounded">
                    <span className="opacity-60 block">Extra/Lvl</span>
                    <span className="font-bold">+{extraPerLvl}</span>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-1 rounded">
                    <span className="opacity-60 block">Flat Bonus</span>
                    <span className="font-bold">+{flatBonus}</span>
                  </div>
                </div>
              </div>

              {/* Organization & Sort Bar (Image 1 Requirement) */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search skills..."
                    className={`w-full pl-8 pr-2 py-1 text-xs rounded border ${inputStyle}`}
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                  <select
                    value={skillSort}
                    onChange={(e) => setSkillSort(e.target.value as SkillSortOption)}
                    className={`text-xs py-1 px-2 rounded border font-mono ${inputStyle}`}
                    title="Organize skills by name, ability (SDCIWC), class skill, or bonus"
                  >
                    <option value="custom">Sort: Default Order</option>
                    <option value="name-asc">Sort: Name (A-Z)</option>
                    <option value="ability">Sort: Ability (SDCIWC)</option>
                    <option value="class-first">Sort: Class Skills First</option>
                    <option value="bonus-desc">Sort: Bonus (+/- High to Low)</option>
                    <option value="bonus-asc">Sort: Bonus (-/+ Low to High)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Skills Table List */}
            <div className="mt-3 max-h-[700px] overflow-y-auto space-y-1 pr-1 font-mono text-xs">
              <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[10px] font-bold opacity-60 uppercase border-b border-black/10 dark:border-white/10">
                <span className="col-span-1 text-center">CS</span>
                <span className="col-span-5">Skill Name</span>
                <span className="col-span-1 text-center">Abil</span>
                <span className="col-span-1 text-center">Rnk</span>
                <span className="col-span-1 text-center">Misc</span>
                <span className="col-span-1 text-center font-bold">Tot</span>
                <span className="col-span-2 text-center">Roll</span>
              </div>

              {sortedSkills.map((sk) => {
                const totalBonus = calculateSkillBonus(sk);
                const isOverLevel = sk.ranks > character.level;

                return (
                  <div
                    key={sk.id}
                    className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 rounded transition-colors ${
                      sk.ranks > 0
                        ? 'bg-amber-500/10 dark:bg-amber-500/15'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Class Skill Checkbox */}
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={sk.isClassSkill}
                        onChange={(e) => updateSkill(sk.id, { isClassSkill: e.target.checked })}
                        className="rounded accent-amber-500 w-3 h-3 cursor-pointer"
                        title="Class skill checkbox (+3 bonus if invested)"
                      />
                    </div>

                    {/* Skill Name */}
                    <div className="col-span-5 flex items-center gap-1 truncate" title={sk.name}>
                      <span
                        className={`truncate ${
                          sk.isClassSkill
                            ? isLightTheme
                              ? 'font-bold text-amber-900'
                              : 'font-semibold text-amber-400'
                            : ''
                        }`}
                      >
                        {sk.name}
                      </span>
                      {sk.hasArmorCheckPenalty && (
                        <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold" title="Armor check penalty applies">*</span>
                      )}
                      {sk.isTrainedOnly && (
                        <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-bold" title="Trained only">†</span>
                      )}
                    </div>

                    {/* Key Ability */}
                    <div className="col-span-1 text-center text-[10px] opacity-75">
                      {sk.keyAbility}
                    </div>

                    {/* Ranks Input */}
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="number"
                        min="0"
                        max={character.level}
                        value={sk.ranks || 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          updateSkill(sk.id, { ranks: val });
                        }}
                        className={`w-7 text-center py-0.5 rounded border text-xs font-bold ${
                          isOverLevel ? 'border-rose-500 bg-rose-500/20 text-rose-700 dark:text-rose-300' : inputStyle
                        }`}
                        title={isOverLevel ? `Cannot invest more ranks than level (${character.level})` : 'Ranks invested'}
                      />
                    </div>

                    {/* Misc Mod */}
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="number"
                        value={sk.miscMod || 0}
                        onChange={(e) => updateSkill(sk.id, { miscMod: parseInt(e.target.value, 10) || 0 })}
                        className={`w-7 text-center py-0.5 rounded border text-xs ${inputStyle}`}
                        title="Miscellaneous modifier"
                      />
                    </div>

                    {/* Total Bonus */}
                    <div className="col-span-1 text-center font-bold text-xs">
                      <span
                        className={
                          totalBonus >= 0
                            ? isLightTheme
                              ? 'text-amber-900 font-black'
                              : 'text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {totalBonus >= 0 ? `+${totalBonus}` : totalBonus}
                      </span>
                    </div>

                    {/* Roll Button */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        onClick={() => onRollFormula(`1d20+${totalBonus}`, `${sk.name} Check`)}
                        className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-1 transition-colors ${
                          isLightTheme
                            ? 'bg-amber-900/15 hover:bg-amber-600 text-amber-950 hover:text-black border border-amber-900/30'
                            : 'bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-black'
                        }`}
                        title={`Roll 1d20+${totalBonus}`}
                      >
                        <Dices className="w-2.5 h-2.5" />
                        <span>d20</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Resources, Actions Directory & Inspector                     */}
        {/* ========================================================================= */}
        <div className={`${visibleModules.skills !== false ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          {/* SECTION 1: Resource Trackers & Pools (Matches Wireframe Image 1 Top) */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-serif font-bold text-base tracking-wide">
                    Class Resources & Pools
                  </h3>
                  <span className="text-[11px] opacity-70">
                    Spells per day, pools, smite & rage rounds (Macro sensitive: e.g. &#123;SMITE&#125;)
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsAddResourceOpen(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Resource</span>
              </button>
            </div>

            {/* Resources Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resourceTrackers.map((res) => {
                const percent = Math.min(100, Math.round((res.current / Math.max(1, res.max)) * 100));
                const resGlyphUrl = resolveIconOrGlyphUrl(res.icon, glyphStyle);

                return (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        {resGlyphUrl && (
                          <img
                            src={resGlyphUrl}
                            alt=""
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        )}
                        <span
                          className={`font-bold text-xs truncate ${
                            isLightTheme ? 'text-stone-900' : 'text-amber-300'
                          }`}
                        >
                          {res.name}
                        </span>
                        {res.macroKey && (
                          <span
                            className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                              isLightTheme
                                ? 'bg-cyan-900/10 text-cyan-900 border-cyan-800/30 font-bold'
                                : 'bg-black/40 text-cyan-300 border-cyan-800/40'
                            }`}
                          >
                            #{res.macroKey}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteResource(res.id)}
                        className="text-slate-500 hover:text-rose-500 p-0.5"
                        title="Delete tracker"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/20 dark:bg-black/30 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Counter Controls: *use[] *refresh */}
                    <div className="flex items-center justify-between font-mono text-xs pt-1">
                      <span
                        className={`font-bold ${
                          isLightTheme ? 'text-stone-900' : 'text-amber-200'
                        }`}
                      >
                        {res.current} / {res.max}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => useResource(res.id)}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5 transition-colors ${
                            isLightTheme
                              ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-900 hover:text-white'
                              : 'bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white'
                          }`}
                          title="Use 1 charge"
                        >
                          <Minus className="w-2.5 h-2.5" />
                          <span>Use</span>
                        </button>
                        <button
                          onClick={() => restoreResource(res.id)}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5 transition-colors ${
                            isLightTheme
                              ? 'bg-emerald-500/20 hover:bg-emerald-600 text-emerald-900 hover:text-white'
                              : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white'
                          }`}
                          title="Restore 1 charge"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => refreshResource(res.id)}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5 transition-colors ${
                            isLightTheme
                              ? 'bg-cyan-500/20 hover:bg-cyan-600 text-cyan-900 hover:text-white'
                              : 'bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-white'
                          }`}
                          title="Refresh to full"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {resourceTrackers.length === 0 && (
                <div className="col-span-2 text-center py-6 text-xs opacity-50 font-mono">
                  No active resource trackers. Click &quot;+ New Resource&quot; to track Smite, Rage, Spell Slots, or Pools.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Searchable Action Directory (Matches Wireframe Image 1 Middle) */}
          <div className={`rounded-xl border p-4 ${cardBg} space-y-3`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-serif font-bold text-base tracking-wide">Action Directory</h3>
              </div>

              <button
                onClick={() => setIsAddActionOpen(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Action</span>
              </button>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-mono">
                {['All', 'Class Ability', 'Spells', 'SLA', 'Feats', 'Racial', 'Combat'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActionCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                      actionCategoryFilter === cat
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : isLightTheme
                        ? 'bg-black/10 hover:bg-black/20 text-stone-800 font-medium'
                        : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  placeholder="search bar_smite______"
                  className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border font-mono ${inputStyle}`}
                />
              </div>
            </div>

            {/* Action Cards List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredActions.map((act) => {
                const isSelected = act.id === selectedActionId;

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActionId(act.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-500/80 bg-amber-500/15 shadow-sm'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-md bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center w-8 h-8 overflow-hidden">
                        {renderActionIcon(act.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-xs truncate ${
                              isLightTheme ? 'text-stone-900' : 'text-amber-200'
                            }`}
                          >
                            {act.name}
                          </span>
                          <span className="text-[10px] font-mono opacity-75 px-1 rounded bg-black/10 dark:bg-black/30">
                            {act.actionType || 'Standard'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-75 truncate font-sans">
                          {act.shortSummary || act.description.slice(0, 60)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {act.macroFormula && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRollFormula(act.macroFormula!, act.name);
                          }}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                          title={`Roll formula: ${act.macroFormula}`}
                        >
                          <Dices className="w-3 h-3" />
                          <span>{act.macroFormula}</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAction(act.id);
                        }}
                        className="text-slate-500 hover:text-rose-500 p-1"
                        title="Delete action"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredActions.length === 0 && (
                <div className="text-center py-6 text-xs opacity-50 font-mono">
                  No actions found matching &quot;{actionSearch}&quot;.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Selected Action Extended Inspector (Matches Wireframe Image 1 Lower) */}
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span
                  className={`font-bold text-xs uppercase tracking-wider font-mono ${
                    isLightTheme ? 'text-cyan-900' : 'text-cyan-300'
                  }`}
                >
                  Selected Action Inspector
                </span>
              </div>
              {selectedAction && (
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    isLightTheme
                      ? 'bg-amber-900/10 text-amber-950 border-amber-800/30 font-bold'
                      : 'bg-black/40 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {selectedAction.category}
                </span>
              )}
            </div>

            {selectedAction ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4
                      className={`font-serif font-bold text-lg ${
                        isLightTheme ? 'text-stone-900' : 'text-amber-300'
                      }`}
                    >
                      {selectedAction.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs font-mono opacity-75">
                      <span>Action: {selectedAction.actionType || 'Standard'}</span>
                      {selectedAction.range && <span>• Range: {selectedAction.range}</span>}
                      {selectedAction.saveDC && <span>• Save: {selectedAction.saveDC}</span>}
                    </div>
                  </div>

                  {selectedAction.macroFormula && (
                    <button
                      onClick={() => onRollFormula(selectedAction.macroFormula!, selectedAction.name)}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Dices className="w-4 h-4" />
                      <span>Roll {selectedAction.macroFormula}</span>
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 text-xs leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedAction.description}
                </div>

                {/* Allow changing glyph on existing action */}
                <div className="pt-1">
                  <GlyphPicker
                    value={selectedAction.icon || ''}
                    onChange={(glyphId) =>
                      setField(
                        'characterActions',
                        characterActions.map((a) =>
                          a.id === selectedAction.id ? { ...a, icon: glyphId || undefined } : a
                        )
                      )
                    }
                    glyphStyle={glyphStyle}
                    label="Action Glyph"
                    compact={true}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs opacity-50 font-mono">
                Select an action above to inspect full description, rules, and macro parameters.
              </div>
            )}
          </div>

          {/* SECTION 4: Feats and Special Qualities (Matches Wireframe Image 1 Bottom) */}
          {visibleModules.feats !== false && (
          <div className={`rounded-xl border p-4 ${cardBg} space-y-3`}>
            <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-serif font-bold text-base tracking-wide">Feats &amp; Special Qualities</h3>
              </div>

              <button
                onClick={() => setIsAddFeatOpen(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Feat</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {characterFeats.map((feat) => {
                const featGlyphUrl = resolveIconOrGlyphUrl(feat.icon, glyphStyle);
                return (
                  <div
                    key={feat.id}
                    className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {featGlyphUrl && (
                          <img
                            src={featGlyphUrl}
                            alt=""
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        )}
                        <span
                          className={`font-bold text-xs truncate ${
                            isLightTheme ? 'text-stone-900' : 'text-amber-200'
                          }`}
                        >
                          {feat.name}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteFeat(feat.id)}
                        className="text-slate-500 hover:text-rose-500 p-0.5 shrink-0"
                        title="Delete feat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] font-mono opacity-60">
                      <span>{feat.type || 'General'}</span>
                      {feat.prerequisites && feat.prerequisites !== 'None' && (
                        <span> • Req: {feat.prerequisites}</span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 font-sans line-clamp-2">
                      {feat.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Add Resource Tracker Drawer / Dialog                             */}
      {/* ========================================================================= */}
      {isAddResourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className={`font-serif font-bold text-base ${isLightTheme ? 'text-amber-900' : 'text-amber-400'}`}>
                New Resource Tracker
              </h3>
              <button
                onClick={() => setIsAddResourceOpen(false)}
                className="p-1 rounded opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold opacity-75 mb-1">Resource Name</label>
                <input
                  type="text"
                  value={newResourceName}
                  onChange={(e) => setNewResourceName(e.target.value)}
                  placeholder="e.g. Smite Evil, Rage, Ki Pool, Lay on Hands"
                  className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Total Uses / Max [ ]</label>
                  <input
                    type="number"
                    min="1"
                    value={newResourceMax}
                    onChange={(e) => setNewResourceMax(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Macro Sensitive Key</label>
                  <input
                    type="text"
                    value={newResourceMacro}
                    onChange={(e) => setNewResourceMacro(e.target.value)}
                    placeholder="e.g. SMITE, RAGE"
                    className={`w-full px-3 py-1.5 rounded border font-mono uppercase ${inputStyle}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold opacity-75 mb-1">Category</label>
                <select
                  value={newResourceCategory}
                  onChange={(e) => setNewResourceCategory(e.target.value as any)}
                  className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                >
                  <option value="Class Resource">Class Resource</option>
                  <option value="Spell Slot">Spell Slot</option>
                  <option value="Resource Pool">Resource Pool</option>
                  <option value="Special">Special / Item</option>
                </select>
              </div>

              <GlyphPicker
                value={newResourceGlyph}
                onChange={setNewResourceGlyph}
                glyphStyle={glyphStyle}
                label="Assign Glyph (Optional)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                onClick={() => setIsAddResourceOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddResource}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Save Tracker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Add New Action Drawer / Dialog                                  */}
      {/* ========================================================================= */}
      {isAddActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className={`font-serif font-bold text-base ${isLightTheme ? 'text-amber-900' : 'text-amber-400'}`}>
                New Action
              </h3>
              <button
                onClick={() => setIsAddActionOpen(false)}
                className="p-1 rounded opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold opacity-75 mb-1">Action Name</label>
                <input
                  type="text"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder="e.g. Smite Evil!, Fireball, Flurry of Blows"
                  className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Category</label>
                  <select
                    value={newActionCategory}
                    onChange={(e) => setNewActionCategory(e.target.value as any)}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Class Ability">Class Ability</option>
                    <option value="Spells">Spells</option>
                    <option value="SLA">SLA (Spell-Like Ability)</option>
                    <option value="Feats">Feats</option>
                    <option value="Racial">Racial</option>
                    <option value="Combat">Combat</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold opacity-75 mb-1">Action Economy</label>
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value as any)}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Standard">Standard Action</option>
                    <option value="Move">Move Action</option>
                    <option value="Swift">Swift Action</option>
                    <option value="Immediate">Immediate Action</option>
                    <option value="Free">Free Action</option>
                    <option value="Full-Round">Full-Round Action</option>
                    <option value="1 Round">1 Round</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold opacity-75 mb-1">Macro Sensitive Roll / Formula</label>
                <input
                  type="text"
                  value={newActionMacro}
                  onChange={(e) => setNewActionMacro(e.target.value)}
                  placeholder="e.g. 2d6+CHA, 6d6 fire, 1d20+12"
                  className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                />
              </div>

              <GlyphPicker
                value={newActionIcon}
                onChange={setNewActionIcon}
                glyphStyle={glyphStyle}
                label="Assign Glyph (Optional)"
              />

              <div>
                <label className="block font-bold opacity-75 mb-1">Description (Macro Sensitive)</label>
                <textarea
                  rows={4}
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  placeholder="Enter full rules text, scaling notes, saving throw DCs, and formula tags..."
                  className={`w-full px-3 py-2 rounded border font-sans text-xs ${inputStyle}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                onClick={() => setIsAddActionOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAction}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Save Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Add New Feat Dialog                                             */}
      {/* ========================================================================= */}
      {isAddFeatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className={`font-serif font-bold text-base ${isLightTheme ? 'text-amber-900' : 'text-amber-400'}`}>
                New Feat
              </h3>
              <button
                onClick={() => setIsAddFeatOpen(false)}
                className="p-1 rounded opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold opacity-75 mb-1">Feat Name</label>
                <input
                  type="text"
                  value={newFeatName}
                  onChange={(e) => setNewFeatName(e.target.value)}
                  placeholder="e.g. Power Attack, Cleave, Improved Initiative"
                  className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Type</label>
                  <select
                    value={newFeatType}
                    onChange={(e) => setNewFeatType(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Combat">Combat</option>
                    <option value="General">General</option>
                    <option value="Metamagic">Metamagic</option>
                    <option value="Item Creation">Item Creation</option>
                    <option value="Racial">Racial</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Prerequisites</label>
                  <input
                    type="text"
                    value={newFeatPrereq}
                    onChange={(e) => setNewFeatPrereq(e.target.value)}
                    placeholder="e.g. Str 13, BAB +1"
                    className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold opacity-75 mb-1">Benefit Summary</label>
                <textarea
                  rows={3}
                  value={newFeatSummary}
                  onChange={(e) => setNewFeatSummary(e.target.value)}
                  placeholder="Summarize mechanical benefits..."
                  className={`w-full px-3 py-2 rounded border font-sans text-xs ${inputStyle}`}
                />
              </div>

              <GlyphPicker
                value={newFeatGlyph}
                onChange={setNewFeatGlyph}
                glyphStyle={glyphStyle}
                label="Assign Glyph (Optional)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                onClick={() => setIsAddFeatOpen(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeat}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Save Feat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
