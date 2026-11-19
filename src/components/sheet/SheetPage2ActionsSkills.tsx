import React, { useState, useMemo } from 'react';
import {
  Dices,
  Plus,
  Trash2,
  Search,
  BookOpen,
  Award,
  RefreshCw,
  Edit3,
  ArrowUpDown,
} from 'lucide-react';
import {
  PF1Character,
  SkillItem,
  AbilityName,
  SkillPointsConfig,
  FeatItem,
} from '../../types/character';
import { DerivedCombatStats } from '../../engine/pf1eMath';
import { FieldCallTooltip } from '../common/FieldCallTooltip';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { ActionDirectoryModule } from './ActionDirectoryModule';
import { syncOddLevelFeats } from '../../data/defaultCharacter';
import { lookupRulesWithSOT, RulesLookupResult } from '../../engine/aiService';
import { useCharacter } from '../../context/CharacterContext';

interface SheetPage2ActionsSkillsProps {
  character?: PF1Character;
  derived?: DerivedCombatStats;
  theme?: string;
  fontClass: string;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
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
  character: propCharacter,
  derived: propDerived,
  theme: propTheme,
  fontClass,
  onUpdateCharacter: propOnUpdateCharacter,
  onRollFormula,
  visibleModules: propVisibleModules,
}) => {
  const ctx = useCharacter();
  const character = propCharacter ?? ctx.character;
  const derived = propDerived ?? ctx.derived;
  const theme = propTheme ?? ctx.layout.theme;
  const visibleModules = propVisibleModules ?? ctx.layout.visibleModules;
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx.updateCharacter;
  // Skill search & sorting state
  const [skillSearch, setSkillSearch] = useState('');
  const [skillSort, setSkillSort] = useState<SkillSortOption>('custom');

  // Modal states for Feats
  const [isAddFeatOpen, setIsAddFeatOpen] = useState(false);
  const [editingFeatId, setEditingFeatId] = useState<string | null>(null);

  // Feat form state (for Add & Edit)
  const [newFeatName, setNewFeatName] = useState('');
  const [newFeatType, setNewFeatType] = useState('Combat');
  const [newFeatPrereq, setNewFeatPrereq] = useState('');
  const [newFeatSummary, setNewFeatSummary] = useState('');
  const [newFeatLevelGranted, setNewFeatLevelGranted] = useState<string>('');

  // AI Lookup state for +Add Feat modal
  const [isSeekingFeatAI, setIsSeekingFeatAI] = useState(false);
  const [featLookupFeedback, setFeatLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    authority?: RulesLookupResult['sourceAuthority'];
    message: string;
  } | null>(null);

  // Styling helpers
  const isParchment = theme === 'parchment';
  const isBlueprint = theme === 'blueprint';
  const isMythWeavers = theme === 'mythweavers';

  const cardBg = isParchment
    ? 'bg-amber-50/70 border-amber-800/20 text-stone-900 shadow-sm'
    : isBlueprint
    ? 'bg-slate-900/90 border-cyan-500/40 text-cyan-50'
    : isMythWeavers
    ? 'bg-[#15171a] border-[#2d3139] text-slate-100'
    : 'bg-white border-black text-black';

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

  const updateSkillPointsConfig = (updates: Partial<SkillPointsConfig>) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      skillPointsConfig: {
        ...prev.skillPointsConfig,
        ...updates,
      },
    }));
  };

  // =========================================================================
  // SKILL POINTS & MATRIX LOGIC
  // =========================================================================
  const spConfig: SkillPointsConfig = character.skillPointsConfig || {};
  const [selectedClassId] = useState<string>('class1');

  const classesList = useMemo(() => {
    const list: { id: string; name: string; level: number; spPerLevel: number }[] = [];
    if (character.customClassGrids) {
      Object.values(character.customClassGrids).forEach((grid) => {
        list.push({
          id: grid.id,
          name: grid.className || grid.id,
          level: grid.level ?? character.level ?? 0,
          spPerLevel: grid.skillPointsPerLevel ?? 0,
        });
      });
    }
    if (list.length === 0 && character.classes && character.classes.length > 0) {
      character.classes.forEach((c) => {
        list.push({
          id: c.id,
          name: c.name,
          level: c.level ?? 0,
          spPerLevel: c.skillPointsPerLevel ?? 0,
        });
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'class1',
        name: character.characterClass || 'Class 1',
        level: character.level ?? 0,
        spPerLevel: character.classSkillPointsPerLevel ?? 0,
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
      if ((cls.level ?? 0) <= 0) return;
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

  const calculateSkillBonus = (skill: SkillItem) => {
    const abilityMod = getAbilityMod(skill.keyAbility);
    const classBonus = skill.isClassSkill && skill.ranks >= 1 ? 3 : 0;
    const acpPenalty = skill.hasArmorCheckPenalty ? derived.armorCheckPenaltyTotal : 0;
    return abilityMod + skill.ranks + classBonus + (skill.miscMod || 0) + acpPenalty;
  };

  const sortedSkills = useMemo(() => {
    let list = [...(character.skills || [])];

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
  }, [character.skills, skillSearch, skillSort, derived]);

  // =========================================================================
  // FEATS & ODD-LEVEL PROGRESSION LOGIC
  // =========================================================================
  const characterFeats = useMemo(() => {
    const list = [...(character.characterFeats || [])];
    return list.sort((a, b) => {
      const lvlA = a.levelGranted ?? 99;
      const lvlB = b.levelGranted ?? 99;
      if (lvlA !== lvlB) return lvlA - lvlB;
      return a.name.localeCompare(b.name);
    });
  }, [character.characterFeats]);

  const openAddFeatModal = () => {
    setEditingFeatId(null);
    setNewFeatName('');
    setNewFeatType('Combat');
    setNewFeatPrereq('');
    setNewFeatSummary('');
    setNewFeatLevelGranted('');
    setFeatLookupFeedback(null);
    setIsAddFeatOpen(true);
  };

  const openEditFeatModal = (feat: FeatItem) => {
    setEditingFeatId(feat.id);
    setNewFeatName(feat.name);
    setNewFeatType(feat.type || 'General');
    setNewFeatPrereq(feat.prerequisites || '');
    setNewFeatSummary(feat.summary || '');
    setNewFeatLevelGranted(feat.levelGranted ? String(feat.levelGranted) : '');
    setFeatLookupFeedback(null);
    setIsAddFeatOpen(true);
  };

  // AI Seek handler for +Add Feat modal (uses Feat Name + Type/Level/Prereq/Summary as search modifiers)
  const handleSeekFeatWithAI = async () => {
    const isFeatsAllowed =
      (character.installedModules?.aiSettings?.allowedFields?.feats ?? true) !== false;
    if (!isFeatsAllowed) {
      setFeatLookupFeedback({
        type: 'error',
        message:
          'AI Blind Spot Active: "Feats & Odd-Level Slots" is currently in the AI\'s Blind Spots (Module Permissions). Enable it to let AI populate feat fields.',
      });
      return;
    }

    const queryText = newFeatName.trim();
    if (!queryText && !newFeatPrereq.trim() && !newFeatSummary.trim()) {
      setFeatLookupFeedback({
        type: 'warning',
        message:
          'Enter a feat name or description in Feat Name (or prerequisites/keywords below) before clicking the Apple-Eye AI Seek button.',
      });
      return;
    }

    setIsSeekingFeatAI(true);
    setFeatLookupFeedback(null);

    try {
      const result = await lookupRulesWithSOT(queryText, 'Feat', character, {
        featType: newFeatType,
        levelGranted: newFeatLevelGranted.trim() || undefined,
        prerequisites: newFeatPrereq.trim() || undefined,
        summaryHint: newFeatSummary.trim() || undefined,
      });

      if (!result.matched) {
        setFeatLookupFeedback({
          type: 'warning',
          message:
            result.sourceNotes ||
            `No verified match found in SOT Docs, SOT Links, or PF1e SRD for "${queryText}". Fields were left untouched (no guessing).`,
        });
        return;
      }

      setNewFeatName(result.title);
      if (result.featType) {
        setNewFeatType(result.featType);
      }
      if (result.prerequisites) {
        setNewFeatPrereq(result.prerequisites);
      }
      setNewFeatSummary(result.fullDescription || result.summary);

      setFeatLookupFeedback({
        type: 'success',
        authority: result.sourceAuthority,
        message: `Populated "${result.title}" (${result.sourceNotes})`,
      });
    } catch (err) {
      setFeatLookupFeedback({
        type: 'warning',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSeekingFeatAI(false);
    }
  };

  const handleSaveFeat = () => {
    if (!newFeatName.trim()) return;
    const parsedLevel = newFeatLevelGranted.trim() ? parseInt(newFeatLevelGranted, 10) : undefined;
    const savedFeat: FeatItem = {
      id: editingFeatId || `feat-${Date.now()}`,
      name: newFeatName.trim(),
      type: newFeatType,
      prerequisites: newFeatPrereq.trim() || 'None',
      summary: newFeatSummary.trim() || 'Benefit description...',
      levelGranted: parsedLevel && !isNaN(parsedLevel) ? parsedLevel : undefined,
      isOddLevelSlot: parsedLevel ? parsedLevel % 2 === 1 : false,
    };

    onUpdateCharacter((prev) => {
      const existing = [...(prev.characterFeats || [])];
      const idx = existing.findIndex((f) => f.id === editingFeatId);
      const updatedFeats =
        idx >= 0 ? existing.map((f, i) => (i === idx ? savedFeat : f)) : [...existing, savedFeat];

      const updatedAbilities = [...(prev.featsAndAbilities || [])];
      if (!updatedAbilities.some((s) => s.toLowerCase() === savedFeat.name.toLowerCase())) {
        updatedAbilities.push(savedFeat.name);
      }

      return {
        ...prev,
        characterFeats: updatedFeats,
        featsAndAbilities: updatedAbilities,
      };
    });

    setIsAddFeatOpen(false);
    setEditingFeatId(null);
  };

  const deleteFeat = (feat: FeatItem) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      characterFeats: (prev.characterFeats || []).filter((f) => f.id !== feat.id),
      featsAndAbilities: (prev.featsAndAbilities || []).filter(
        (name) => name.toLowerCase() !== feat.name.toLowerCase()
      ),
    }));
  };

  const handleForceSyncOddFeats = () => {
    onUpdateCharacter((prev) => syncOddLevelFeats(prev, true));
  };

  return (
    <div className={`space-y-6 ${fontClass}`}>
      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN (lg:col-span-5): 35 PF1e Skills Matrix                        */}
        {/* ========================================================================= */}
        {visibleModules.skills !== false && (
          <div className="lg:col-span-5 space-y-4">
            <div className={`rounded-xl border p-4 ${cardBg}`}>
              {/* Skills Header & Sort / Organization Controls */}
              <div className="flex flex-col gap-3 pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="font-serif font-bold text-base tracking-wide">Skills Matrix</h3>
                  </div>
                  <span className="text-xs font-mono opacity-70">
                    {character.skills?.length || 35} Skills
                  </span>
                </div>

                {/* SP Calculation Bar */}
                <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-amber-600 dark:text-amber-400">Skill Points Allocation:</span>
                    <span className={spRemaining < 0 ? 'text-rose-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
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
                      <input
                        type="number"
                        step="1"
                        value={extraPerLvl}
                        onChange={(e) =>
                          updateSkillPointsConfig({
                            extraPerLevel: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        aria-label="Extra skill points per level"
                        className={`w-full min-w-0 rounded border px-1 text-center font-bold ${inputStyle}`}
                      />
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 p-1 rounded">
                      <span className="opacity-60 block">Flat Bonus</span>
                      <input
                        type="number"
                        step="1"
                        value={flatBonus}
                        onChange={(e) =>
                          updateSkillPointsConfig({
                            bonusFlat: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        aria-label="Flat skill point bonus"
                        className={`w-full min-w-0 rounded border px-1 text-center font-bold ${inputStyle}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Organization & Sort Bar */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
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
              <div className="pf1-blue-scrollbar mt-3 max-h-[700px] overflow-y-auto space-y-1 pr-1 font-mono text-xs">
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
                    <FieldCallTooltip
                      key={sk.id}
                      callName={`#${sk.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`}
                      description={`${sk.name} Bonus`}
                      className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 rounded transition-colors w-full ${
                        sk.ranks > 0
                          ? 'bg-amber-500/10 dark:bg-amber-500/15'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={sk.isClassSkill}
                          onChange={(e) => updateSkill(sk.id, { isClassSkill: e.target.checked })}
                          className="rounded accent-amber-500 w-3 h-3 cursor-pointer"
                        />
                      </div>

                      <div className="col-span-5 flex items-center gap-1 truncate">
                        <span
                          className={`truncate cursor-help hover:text-amber-500 transition-colors ${
                            sk.isClassSkill ? 'font-semibold text-amber-700 dark:text-amber-400' : ''
                          }`}
                        >
                          {sk.name}
                        </span>
                        {sk.hasArmorCheckPenalty && (
                          <span className="text-[9px] text-rose-500 font-bold" title="Armor check penalty applies">
                            *
                          </span>
                        )}
                        {sk.isTrainedOnly && (
                          <span className="text-[9px] text-cyan-500" title="Trained only">
                            †
                          </span>
                        )}
                      </div>

                      <div className="col-span-1 text-center text-[10px] opacity-75">
                        {sk.keyAbility}
                      </div>

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
                            isOverLevel ? 'border-rose-500 bg-rose-500/20 text-rose-300' : inputStyle
                          }`}
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <input
                          type="number"
                          value={sk.miscMod || 0}
                          onChange={(e) => updateSkill(sk.id, { miscMod: parseInt(e.target.value, 10) || 0 })}
                          className={`w-7 text-center py-0.5 rounded border text-xs ${inputStyle}`}
                        />
                      </div>

                      <div className="col-span-1 text-center font-bold text-xs cursor-help">
                        <span className={totalBonus >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500'}>
                          {totalBonus >= 0 ? `+${totalBonus}` : totalBonus}
                        </span>
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={() => onRollFormula(`1d20+${totalBonus}`, `${sk.name} Check`)}
                          className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-800 dark:text-amber-200 hover:text-black font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Dices className="w-2.5 h-2.5" />
                          <span>d20</span>
                        </button>
                      </div>
                    </FieldCallTooltip>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Actions & Resource Directory + Feats                        */}
        {/* ========================================================================= */}
        <div className={`${visibleModules.skills !== false ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          <ActionDirectoryModule
            character={character}
            derived={derived}
            theme={theme}
            onUpdateCharacter={onUpdateCharacter}
            onRollFormula={onRollFormula}
          />

          {/* ========================================================================= */}
          {/* SECTION 2: Feats & Special Qualities (Auto-generates every odd level)     */}
          {/* ========================================================================= */}
          {visibleModules.feats !== false && (
            <div className={`rounded-xl border p-4 ${cardBg} space-y-3`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-base tracking-wide">Feats</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold">
                        {characterFeats.length} Feats
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={openAddFeatModal}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Feat</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleForceSyncOddFeats}
                    className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 transition-colors"
                    title="Ensure every odd level up to your current level has a feat slot"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync Feats</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {characterFeats.map((feat) => {
                  const isPlaceholderOdd = feat.name.includes('(Select Feat)');
                  return (
                    <div
                      key={feat.id}
                      className={`p-2.5 rounded-lg border space-y-1 transition-colors ${
                        isPlaceholderOdd
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {feat.levelGranted ? (
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                feat.levelGranted % 2 === 1
                                  ? 'bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              Lvl {feat.levelGranted}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/15 dark:bg-white/10 opacity-75 shrink-0">
                              Bonus
                            </span>
                          )}
                          <span className="font-bold text-xs truncate text-amber-800 dark:text-amber-200">
                            {feat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditFeatModal(feat)}
                            className="text-slate-500 hover:text-amber-500 p-0.5"
                            title="Edit feat"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFeat(feat)}
                            className="text-slate-500 hover:text-rose-500 p-0.5"
                            title="Delete feat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono opacity-65">
                        <span>{feat.type || 'General'}</span>
                        {feat.prerequisites && feat.prerequisites !== 'None' && (
                          <span> • Req: {feat.prerequisites}</span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-80 font-sans line-clamp-2">
                        {feat.summary}
                      </p>
                    </div>
                  );
                })}

                {characterFeats.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-xs opacity-50 font-mono">
                    No feats listed. Click &quot;Sync Feats&quot; or &quot;Add Feat&quot; to add feats.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Add / Edit Feat Dialog                                             */}
      {/* ========================================================================= */}
      {isAddFeatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className="font-serif font-bold text-base text-amber-500">
                {editingFeatId ? 'Edit Feat' : 'Add New Feat'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddFeatOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold opacity-85">
                    Feat Name <span className="text-[10px] font-mono opacity-65">(AI Lookup Field)</span>
                  </label>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                    1. SOT Doc &rarr; 2. SOT Links &rarr; 3. SRD
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFeatName}
                    onChange={(e) => setNewFeatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSeekFeatWithAI();
                      }
                    }}
                    placeholder="e.g. Power Attack, Outflank, Deadly Aim, Dodge..."
                    className={`flex-1 px-3 py-1.5 rounded border ${inputStyle}`}
                  />
                  <button
                    type="button"
                    onClick={handleSeekFeatWithAI}
                    disabled={isSeekingFeatAI}
                    className="px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm border border-rose-400/50 shrink-0 transition-all active:scale-95"
                    title="AI Seek (Eye in an Apple): Searches 1. SOT Docs -> 2. SOT Links -> 3. Online SRD using Type, Prerequisites & Summary as modifiers (Never guesses!)"
                  >
                    <AppleEyeIcon className="w-4 h-4" isSeeking={isSeekingFeatAI} />
                    <span>{isSeekingFeatAI ? 'Seeking...' : 'Seek'}</span>
                  </button>
                </div>
              </div>

              {featLookupFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-[11px] font-mono flex items-start justify-between gap-2 ${
                    featLookupFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : featLookupFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    {featLookupFeedback.authority && (
                      <span className="inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-black/20 mr-1.5">
                        {featLookupFeedback.authority}
                      </span>
                    )}
                    <span>{featLookupFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatLookupFeedback(null)}
                    className="opacity-60 hover:opacity-100 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Type</label>
                  <select
                    value={newFeatType}
                    onChange={(e) => setNewFeatType(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Combat">Combat</option>
                    <option value="General">General</option>
                    <option value="Metamagic">Metamagic</option>
                    <option value="Item Creation">Item Creation</option>
                    <option value="Racial">Racial</option>
                    <option value="Class Bonus">Class Bonus</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Level Gained</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newFeatLevelGranted}
                    onChange={(e) => setNewFeatLevelGranted(e.target.value)}
                    placeholder="Odd (1,3,5...)"
                    className={`w-full px-2.5 py-1.5 rounded border font-mono ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Prerequisites</label>
                  <input
                    type="text"
                    value={newFeatPrereq}
                    onChange={(e) => setNewFeatPrereq(e.target.value)}
                    placeholder="Str 13, BAB +1"
                    className={`w-full px-2.5 py-1.5 rounded border ${inputStyle}`}
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
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsAddFeatOpen(false)}
                className="px-3 py-1.5 rounded text-xs opacity-70 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFeat}
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
