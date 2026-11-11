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
import { FieldCallTooltip } from '../common/FieldCallTooltip';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
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

export type ActionSortOption =
  | 'default'
  | 'pools-first'
  | 'category'
  | 'economy'
  | 'name-asc';

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

  // Unified Action & Class Resource Directory state
  const [actionSearch, setActionSearch] = useState('');
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('All');
  const [onlyResourcePools, setOnlyResourcePools] = useState<boolean>(false);
  const [actionSort, setActionSort] = useState<ActionSortOption>('default');
  const [selectedActionId, setSelectedActionId] = useState<string>('act-smite');

  // Modal / Drawer states
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [isAddFeatOpen, setIsAddFeatOpen] = useState(false);
  const [editingFeatId, setEditingFeatId] = useState<string | null>(null);

  // Unified Action / Class Resource form state
  const [newActionName, setNewActionName] = useState('');
  const [newActionCategory, setNewActionCategory] = useState<CharacterActionItem['category']>('Class Resource');
  const [newActionType, setNewActionType] = useState<NonNullable<CharacterActionItem['actionType']>>('Standard');
  const [newActionMacro, setNewActionMacro] = useState('');
  const [newActionMacroKey, setNewActionMacroKey] = useState('');
  const [newActionIcon, setNewActionIcon] = useState('sparkles');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionRange, setNewActionRange] = useState('');
  const [newActionSaveDC, setNewActionSaveDC] = useState('');
  const [newActionHasPool, setNewActionHasPool] = useState(true);
  const [newActionPoolCurrent, setNewActionPoolCurrent] = useState('3');
  const [newActionPoolMax, setNewActionPoolMax] = useState('3');

  // Feat form state (for Add & Edit)
  const [newFeatName, setNewFeatName] = useState('');
  const [newFeatType, setNewFeatType] = useState('Combat');
  const [newFeatPrereq, setNewFeatPrereq] = useState('');
  const [newFeatSummary, setNewFeatSummary] = useState('');
  const [newFeatLevelGranted, setNewFeatLevelGranted] = useState<string>('');

  // AI Lookup states for +Add Action/Resource and +Add Feat modals
  const [isSeekingActionAI, setIsSeekingActionAI] = useState(false);
  const [actionLookupFeedback, setActionLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    authority?: RulesLookupResult['sourceAuthority'];
    message: string;
  } | null>(null);

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
  // UNIFIED ACTION & CLASS RESOURCE DIRECTORY LOGIC
  // =========================================================================
  const unifiedActions = useMemo<CharacterActionItem[]>(() => {
    const baseActions = [...(character.characterActions || [])];
    const trackers = character.resourceTrackers || [];

    // Ensure any standalone ResourceTracker is merged or synced with its matching Action entry
    const merged = baseActions.map((act) => {
      const matchedTracker = trackers.find(
        (r) =>
          (act.linkedResourceId && r.id === act.linkedResourceId) ||
          (act.macroKey && r.macroKey && act.macroKey.toUpperCase() === r.macroKey.toUpperCase()) ||
          r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === act.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (matchedTracker) {
        return {
          ...act,
          hasResourcePool: true,
          resourceCurrent: matchedTracker.current,
          resourceMax: matchedTracker.max,
          macroKey: act.macroKey || matchedTracker.macroKey,
          linkedResourceId: matchedTracker.id,
        };
      }
      return act;
    });

    // Add any standalone resourceTrackers that don't have a corresponding entry in characterActions yet
    trackers.forEach((r) => {
      const alreadyInActions = merged.some(
        (act) =>
          act.linkedResourceId === r.id ||
          act.id === r.id ||
          (act.macroKey && r.macroKey && act.macroKey.toUpperCase() === r.macroKey.toUpperCase()) ||
          r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === act.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (!alreadyInActions) {
        merged.push({
          id: r.id,
          name: r.name,
          category: r.category === 'Spell Slot' ? 'Spells' : r.category === 'Resource Pool' ? 'Resource Pool' : 'Class Resource',
          actionType: 'Passive / Pool',
          macroKey: r.macroKey || r.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          icon: r.category === 'Spell Slot' ? 'book' : 'zap',
          description: r.notes || `Class resource / daily pool (${r.current}/${r.max} uses remaining).`,
          shortSummary: r.notes || `${r.category || 'Class Resource'} pool (${r.current}/${r.max})`,
          hasResourcePool: true,
          resourceCurrent: r.current,
          resourceMax: r.max,
          linkedResourceId: r.id,
        });
      }
    });

    return merged;
  }, [character.characterActions, character.resourceTrackers]);

  // Helper to update resource pool on an action and sync with resourceTrackers
  const adjustActionResource = (act: CharacterActionItem, nextCurrent: number, nextMax?: number) => {
    const maxVal = nextMax !== undefined ? Math.max(1, nextMax) : Math.max(1, act.resourceMax || 1);
    const clampedCurrent = Math.max(0, Math.min(maxVal, nextCurrent));

    onUpdateCharacter((prev) => {
      const prevActions = [...(prev.characterActions || [])];
      const prevTrackers = [...(prev.resourceTrackers || [])];

      const actionExists = prevActions.some((a) => a.id === act.id);
      const updatedActions = actionExists
        ? prevActions.map((a) =>
            a.id === act.id
              ? {
                  ...a,
                  hasResourcePool: true,
                  resourceCurrent: clampedCurrent,
                  resourceMax: maxVal,
                  usesPerDay: `${clampedCurrent}/${maxVal} remaining`,
                }
              : a
          )
        : [
            ...prevActions,
            {
              ...act,
              hasResourcePool: true,
              resourceCurrent: clampedCurrent,
              resourceMax: maxVal,
              usesPerDay: `${clampedCurrent}/${maxVal} remaining`,
            },
          ];

      const trackerIdx = prevTrackers.findIndex(
        (r) =>
          r.id === act.linkedResourceId ||
          r.id === act.id ||
          (act.macroKey && r.macroKey && act.macroKey.toUpperCase() === r.macroKey.toUpperCase())
      );

      let updatedTrackers = prevTrackers;
      if (trackerIdx >= 0) {
        updatedTrackers = prevTrackers.map((r, i) =>
          i === trackerIdx ? { ...r, current: clampedCurrent, max: maxVal } : r
        );
      } else {
        updatedTrackers = [
          ...prevTrackers,
          {
            id: act.linkedResourceId || `res-${act.id}`,
            name: act.name,
            current: clampedCurrent,
            max: maxVal,
            macroKey: act.macroKey || act.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
            category: act.category === 'Spells' ? 'Spell Slot' : 'Class Resource',
            notes: act.shortSummary || act.description,
          },
        ];
      }

      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
      };
    });
  };

  // Reset all resource pools to full (Long Rest / Daily Refresh)
  const handleResetAllPools = () => {
    onUpdateCharacter((prev) => {
      const updatedActions = (prev.characterActions || []).map((a) =>
        a.hasResourcePool && typeof a.resourceMax === 'number'
          ? {
              ...a,
              resourceCurrent: a.resourceMax,
              usesPerDay: `${a.resourceMax}/${a.resourceMax} remaining`,
            }
          : a
      );
      const updatedTrackers = (prev.resourceTrackers || []).map((r) => ({
        ...r,
        current: r.max,
      }));
      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
      };
    });
  };

  const filteredActions = useMemo(() => {
    let list = unifiedActions.filter((act) => {
      if (onlyResourcePools && !act.hasResourcePool) return false;

      const matchCat =
        actionCategoryFilter === 'All' ||
        act.category.toLowerCase() === actionCategoryFilter.toLowerCase() ||
        (actionCategoryFilter === 'Class Resource' &&
          (act.category === 'Class Resource' || act.category === 'Resource Pool' || act.hasResourcePool));

      const q = actionSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        act.name.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q) ||
        (act.macroKey && act.macroKey.toLowerCase().includes(q)) ||
        (act.macroFormula && act.macroFormula.toLowerCase().includes(q)) ||
        (act.actionType && act.actionType.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });

    const economyRank: Record<string, number> = {
      Swift: 1,
      Immediate: 2,
      Free: 3,
      Standard: 4,
      Move: 5,
      'Full-Round': 6,
      '1 Round': 7,
      'Passive / Pool': 8,
    };

    switch (actionSort) {
      case 'pools-first':
        return [...list].sort((a, b) => Number(Boolean(b.hasResourcePool)) - Number(Boolean(a.hasResourcePool)));
      case 'category':
        return [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      case 'economy':
        return [...list].sort(
          (a, b) => (economyRank[a.actionType || 'Standard'] || 99) - (economyRank[b.actionType || 'Standard'] || 99)
        );
      case 'name-asc':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'default':
      default:
        return list;
    }
  }, [unifiedActions, actionCategoryFilter, onlyResourcePools, actionSearch, actionSort]);

  const selectedAction = useMemo(() => {
    return (
      unifiedActions.find((a) => a.id === selectedActionId) ||
      filteredActions[0] ||
      unifiedActions[0] ||
      null
    );
  }, [unifiedActions, filteredActions, selectedActionId]);

  const openAddActionModal = () => {
    setEditingActionId(null);
    setNewActionName('');
    setNewActionCategory('Class Resource');
    setNewActionType('Standard');
    setNewActionMacro('');
    setNewActionMacroKey('');
    setNewActionIcon('sparkles');
    setNewActionDesc('');
    setNewActionRange('');
    setNewActionSaveDC('');
    setNewActionHasPool(true);
    setNewActionPoolCurrent('3');
    setNewActionPoolMax('3');
    setActionLookupFeedback(null);
    setIsAddActionOpen(true);
  };

  const openEditActionModal = (act: CharacterActionItem) => {
    setEditingActionId(act.id);
    setNewActionName(act.name);
    setNewActionCategory(act.category);
    setNewActionType(act.actionType || 'Standard');
    setNewActionMacro(act.macroFormula || '');
    setNewActionMacroKey(act.macroKey || '');
    setNewActionIcon(act.icon || 'sparkles');
    setNewActionDesc(act.description || '');
    setNewActionRange(act.range || '');
    setNewActionSaveDC(act.saveDC || '');
    setNewActionHasPool(Boolean(act.hasResourcePool));
    setNewActionPoolCurrent(String(act.resourceCurrent ?? 3));
    setNewActionPoolMax(String(act.resourceMax ?? 3));
    setActionLookupFeedback(null);
    setIsAddActionOpen(true);
  };

  // AI Seek handler for +Add Action / Resource modal (uses Name + other fields as search modifiers)
  const handleSeekActionWithAI = async () => {
    const isActionFieldAllowed =
      (character.installedModules?.aiSettings?.allowedFields?.actionsAndResources ?? true) !== false;
    if (!isActionFieldAllowed) {
      setActionLookupFeedback({
        type: 'error',
        message:
          'AI Blind Spot Active: "Action & Class Resource Directory" is currently in the AI\'s Blind Spots (Module Permissions). Enable it to let AI populate these fields.',
      });
      return;
    }

    const queryText = newActionName.trim();
    if (!queryText && !newActionDesc.trim() && !newActionMacroKey.trim()) {
      setActionLookupFeedback({
        type: 'warning',
        message:
          'Enter an ability, spell, or resource name in the Name field (or a clue in Description / #MACRO_KEY) before clicking the Apple-Eye AI Seek button.',
      });
      return;
    }

    setIsSeekingActionAI(true);
    setActionLookupFeedback(null);

    try {
      const mappedFilter =
        newActionCategory === 'Spells' || newActionCategory === 'SLA'
          ? 'Spell'
          : newActionCategory === 'Feats'
          ? 'Feat'
          : 'Class Ability';

      const result = await lookupRulesWithSOT(queryText, mappedFilter, character, {
        directoryCategory: newActionCategory,
        actionEconomy: newActionType,
        macroKey: newActionMacroKey.trim() || undefined,
        range: newActionRange.trim() || undefined,
        saveDC: newActionSaveDC.trim() || undefined,
        descriptionHint: newActionDesc.trim() || undefined,
        hasResourcePool: newActionHasPool,
      });

      if (!result.matched) {
        setActionLookupFeedback({
          type: 'warning',
          message:
            result.sourceNotes ||
            `No verified match found in SOT Docs, SOT Links, or PF1e SRD for "${queryText}". Fields were not modified (no guessing).`,
        });
        return;
      }

      // Populate verified fields without making things up
      setNewActionName(result.title);
      if (result.macroKey) {
        setNewActionMacroKey(result.macroKey);
      } else {
        setNewActionMacroKey(
          result.title
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
        );
      }

      if (result.category === 'Spell') {
        setNewActionCategory('Spells');
        setNewActionIcon('book');
      } else if (result.category === 'Feat') {
        setNewActionCategory('Feats');
        setNewActionIcon('swords');
      } else if (result.hasResourcePool) {
        setNewActionCategory('Class Resource');
        setNewActionIcon('zap');
      } else if (result.category === 'Class Ability' || result.category === 'Power') {
        setNewActionCategory('Class Ability');
        setNewActionIcon('sparkles');
      }

      if (result.actionType) {
        setNewActionType(result.actionType);
      }
      if (result.range !== undefined && result.range !== '') {
        setNewActionRange(result.range);
      }
      if (result.saveDC !== undefined && result.saveDC !== '') {
        setNewActionSaveDC(result.saveDC);
      }
      if (result.suggestedMacro) {
        setNewActionMacro(result.suggestedMacro);
      }
      if (typeof result.hasResourcePool === 'boolean') {
        setNewActionHasPool(result.hasResourcePool);
        if (result.hasResourcePool && result.resourceMax) {
          setNewActionPoolMax(String(result.resourceMax));
          setNewActionPoolCurrent(String(result.resourceMax));
        }
      }
      setNewActionDesc(result.fullDescription || result.summary);

      setActionLookupFeedback({
        type: 'success',
        authority: result.sourceAuthority,
        message: `Populated "${result.title}" (${result.sourceNotes})`,
      });
    } catch (err) {
      setActionLookupFeedback({
        type: 'warning',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSeekingActionAI(false);
    }
  };

  const handleSaveActionOrResource = () => {
    if (!newActionName.trim()) return;
    const maxVal = Math.max(1, parseInt(newActionPoolMax, 10) || 1);
    const curVal = Math.max(0, Math.min(maxVal, parseInt(newActionPoolCurrent, 10) ?? maxVal));
    const cleanMacroKey =
      newActionMacroKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') ||
      newActionName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

    const actionId = editingActionId || `act-${Date.now()}`;
    const linkedResId = `res-${actionId}`;

    const savedItem: CharacterActionItem = {
      id: actionId,
      name: newActionName.trim(),
      category: newActionCategory,
      actionType: newActionType,
      macroFormula: newActionMacro.trim() || undefined,
      macroKey: cleanMacroKey,
      icon: newActionIcon,
      description: newActionDesc.trim() || 'No description provided.',
      shortSummary: `${newActionType}${newActionMacro ? ` • ${newActionMacro}` : ''}${
        newActionHasPool ? ` • ${curVal}/${maxVal} uses` : ''
      }`,
      range: newActionRange.trim() || undefined,
      saveDC: newActionSaveDC.trim() || undefined,
      hasResourcePool: newActionHasPool,
      resourceCurrent: newActionHasPool ? curVal : undefined,
      resourceMax: newActionHasPool ? maxVal : undefined,
      usesPerDay: newActionHasPool ? `${curVal}/${maxVal} remaining` : undefined,
      linkedResourceId: newActionHasPool ? linkedResId : undefined,
    };

    onUpdateCharacter((prev) => {
      const existingActions = [...(prev.characterActions || [])];
      const existingIdx = existingActions.findIndex((a) => a.id === actionId);
      const updatedActions =
        existingIdx >= 0
          ? existingActions.map((a, i) => (i === existingIdx ? savedItem : a))
          : [...existingActions, savedItem];

      let updatedTrackers = [...(prev.resourceTrackers || [])];
      if (newActionHasPool) {
        const tIdx = updatedTrackers.findIndex(
          (r) => r.id === linkedResId || r.id === actionId || r.macroKey === cleanMacroKey
        );
        const trackerObj: ResourceTracker = {
          id: tIdx >= 0 ? updatedTrackers[tIdx].id : linkedResId,
          name: savedItem.name,
          current: curVal,
          max: maxVal,
          macroKey: cleanMacroKey,
          category:
            savedItem.category === 'Spells'
              ? 'Spell Slot'
              : savedItem.category === 'Resource Pool'
              ? 'Resource Pool'
              : 'Class Resource',
          notes: savedItem.shortSummary,
        };
        if (tIdx >= 0) {
          updatedTrackers[tIdx] = trackerObj;
        } else {
          updatedTrackers.push(trackerObj);
        }
      } else if (editingActionId) {
        updatedTrackers = updatedTrackers.filter(
          (r) => r.id !== linkedResId && r.id !== actionId
        );
      }

      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
      };
    });

    setSelectedActionId(actionId);
    setIsAddActionOpen(false);
    setEditingActionId(null);
  };

  const deleteActionOrResource = (act: CharacterActionItem) => {
    onUpdateCharacter((prev) => {
      const updatedActions = (prev.characterActions || []).filter((a) => a.id !== act.id);
      const updatedTrackers = (prev.resourceTrackers || []).filter(
        (r) =>
          r.id !== act.id &&
          r.id !== act.linkedResourceId &&
          !(act.macroKey && r.macroKey && r.macroKey.toUpperCase() === act.macroKey.toUpperCase())
      );
      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
      };
    });
    if (selectedActionId === act.id) {
      const remaining = unifiedActions.filter((a) => a.id !== act.id);
      if (remaining.length > 0) setSelectedActionId(remaining[0].id);
    }
  };

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

  // Helper for rendering action icon
  const renderActionIcon = (iconName?: string) => {
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
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  const activePoolCount = unifiedActions.filter((a) => a.hasResourcePool).length;

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
        {/* RIGHT COLUMN: Actions & Resource Pools + Feats */}
        {/* ========================================================================= */}
        <div className={`${visibleModules.skills !== false ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          {/* UNIFIED MODULE: Action & Class Resource Directory */}
          <div className={`rounded-xl border p-4 ${cardBg} space-y-3.5`}>
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="font-serif font-bold text-base tracking-wide">
                  Actions &amp; Resource Pools
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activePoolCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllPools}
                    className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 transition-colors"
                    title="Rest / Refresh all daily class resources and spell pools to maximum"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset All Pools</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openAddActionModal}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Action or Resource</span>
                </button>
              </div>
            </div>

            {/* Category Filter Tabs + Pool Toggle + Sort + Search */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-mono">
                {[
                  'All',
                  'Class Resource',
                  'Class Ability',
                  'Resource Pool',
                  'Spells',
                  'SLA',
                  'Feats',
                  'Racial',
                  'Combat',
                ].map((cat) => {
                  const count =
                    cat === 'All'
                      ? unifiedActions.length
                      : cat === 'Class Resource'
                      ? unifiedActions.filter(
                          (a) =>
                            a.category === 'Class Resource' ||
                            a.category === 'Resource Pool' ||
                            a.hasResourcePool
                        ).length
                      : unifiedActions.filter((a) => a.category.toLowerCase() === cat.toLowerCase()).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActionCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 ${
                        actionCategoryFilter === cat
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 opacity-85'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="text-[9px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    value={actionSearch}
                    onChange={(e) => setActionSearch(e.target.value)}
                    placeholder="Search actions, class resources, #MACRO_KEY, or rules..."
                    className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border font-mono ${inputStyle}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyResourcePools(!onlyResourcePools)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 shrink-0 transition-colors ${
                    onlyResourcePools
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                      : 'border-black/15 dark:border-white/15 opacity-75 hover:opacity-100'
                  }`}
                  title="Filter to only show items with trackable daily uses or pools"
                >
                  <Filter className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pools Only</span>
                </button>

                <select
                  value={actionSort}
                  onChange={(e) => setActionSort(e.target.value as ActionSortOption)}
                  className={`text-xs py-1.5 px-2 rounded-lg border font-mono shrink-0 ${inputStyle}`}
                  title="Organize actions and class resources"
                >
                  <option value="default">Sort: Directory Order</option>
                  <option value="pools-first">Sort: Resource Pools First</option>
                  <option value="category">Sort: By Category</option>
                  <option value="economy">Sort: By Action Economy (Swift → Std)</option>
                  <option value="name-asc">Sort: Name (A–Z)</option>
                </select>
              </div>
            </div>

            {/* Unified Action & Class Resource Cards List */}
            <div className="pf1-blue-scrollbar space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredActions.map((act) => {
                const isSelected = act.id === selectedAction?.id;
                const hasPool = Boolean(act.hasResourcePool);
                const curPool = act.resourceCurrent ?? 0;
                const maxPool = Math.max(1, act.resourceMax ?? 1);
                const poolPercent = Math.min(100, Math.round((curPool / maxPool) * 100));
                const callKey = act.macroKey
                  ? `#${act.macroKey}`
                  : `#${act.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActionId(act.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'border-amber-500/80 bg-amber-500/15 shadow-sm'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-black/15 dark:bg-white/10 shrink-0 mt-0.5">
                          {renderActionIcon(act.icon)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-amber-800 dark:text-amber-200">
                              {act.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/15 dark:bg-black/40 border border-black/10 dark:border-white/10">
                              {act.category}
                            </span>
                            <span className="text-[10px] font-mono opacity-75 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              {act.actionType || 'Standard'}
                            </span>
                            <FieldCallTooltip
                              callName={callKey}
                              description={`${act.name} (${hasPool ? `${curPool}/${maxPool} uses` : 'Action Call'})`}
                            >
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 cursor-help">
                                {callKey}
                              </span>
                            </FieldCallTooltip>
                          </div>
                          <p className="text-[11px] opacity-75 truncate font-sans mt-0.5">
                            {act.shortSummary || act.description.slice(0, 80)}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Buttons: Roll, Edit, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {act.macroFormula && (
                          <button
                            type="button"
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditActionModal(act);
                          }}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                          title="Edit action / resource pool"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteActionOrResource(act);
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-500 opacity-70 hover:opacity-100"
                          title="Delete action / resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Resource Pool Bar & Quick Controls (if item tracks uses/pools) */}
                    {hasPool && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-1.5 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[10px] font-mono font-bold uppercase opacity-75 shrink-0">
                            Pool Uses:
                          </span>
                          <span
                            className={`text-xs font-mono font-bold shrink-0 ${
                              curPool === 0 ? 'text-rose-500' : 'text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            {curPool} / {maxPool}
                          </span>
                          <div className="flex-1 max-w-[160px] bg-black/25 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 transition-all duration-300 ${
                                curPool === 0 ? 'bg-rose-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${poolPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 font-mono">
                          <button
                            type="button"
                            onClick={() => adjustActionResource(act, curPool - 1)}
                            disabled={curPool <= 0}
                            className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 disabled:opacity-40 text-rose-700 dark:text-rose-300 hover:text-white font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                            title="Spend 1 use"
                          >
                            <Minus className="w-2.5 h-2.5" />
                            <span>Use</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustActionResource(act, curPool + 1)}
                            disabled={curPool >= maxPool}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 hover:text-white font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                            title="Restore 1 use"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>+1</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustActionResource(act, maxPool)}
                            className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500 text-cyan-700 dark:text-cyan-300 hover:text-white font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                            title="Reset pool to maximum"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Reset</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredActions.length === 0 && (
                <div className="text-center py-6 text-xs opacity-60 font-mono">
                  No actions or class resources match your current filter. Click &quot;Add Action or Resource&quot; to create one.
                </div>
              )}
            </div>

            {/* Embedded Selected Action & Resource Inspector */}
            <div className="pt-3 border-t border-black/15 dark:border-white/15">
              <div className="flex items-center justify-end mb-2">
                {selectedAction && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditActionModal(selectedAction)}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-amber-500/20 text-[10px] font-mono font-bold flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Selected</span>
                    </button>
                  </div>
                )}
              </div>

              {selectedAction ? (
                <div className="p-3 rounded-xl bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-serif font-bold text-base text-amber-700 dark:text-amber-300">
                          {selectedAction.name}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                          {selectedAction.category}
                        </span>
                        {selectedAction.macroKey && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/40">
                            #{selectedAction.macroKey}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs font-mono opacity-75 flex-wrap">
                        <span>Action: {selectedAction.actionType || 'Standard'}</span>
                        {selectedAction.range && <span>• Range: {selectedAction.range}</span>}
                        {selectedAction.saveDC && <span>• Save: {selectedAction.saveDC}</span>}
                        {selectedAction.hasResourcePool && (
                          <span>
                            • Pool: {selectedAction.resourceCurrent ?? 0} / {selectedAction.resourceMax ?? 1}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedAction.hasResourcePool && (selectedAction.resourceCurrent ?? 0) > 0 && selectedAction.macroFormula && (
                        <button
                          type="button"
                          onClick={() => {
                            adjustActionResource(
                              selectedAction,
                              (selectedAction.resourceCurrent ?? 1) - 1
                            );
                            onRollFormula(selectedAction.macroFormula!, `${selectedAction.name} (Spent 1 Use)`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow-sm transition-all"
                          title="Spend 1 resource charge and roll macro formula"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Use &amp; Roll</span>
                        </button>
                      )}
                      {selectedAction.macroFormula && (
                        <button
                          type="button"
                          onClick={() => onRollFormula(selectedAction.macroFormula!, selectedAction.name)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Dices className="w-3.5 h-3.5" />
                          <span>Roll {selectedAction.macroFormula}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 text-xs leading-relaxed font-sans whitespace-pre-wrap">
                    {selectedAction.description}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs opacity-50 font-mono">
                  Select an action or resource above to inspect rules, pool counters, and macro parameters.
                </div>
              )}
            </div>
          </div>

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
      {/* MODAL 1: Unified Add / Edit Action or Class Resource                      */}
      {/* ========================================================================= */}
      {isAddActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className="font-serif font-bold text-base text-amber-500">
                {editingActionId ? 'Edit Action / Class Resource' : 'Add Action or Class Resource'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddActionOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold opacity-85">
                      Name <span className="text-[10px] font-mono opacity-65">(AI Lookup Field)</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                      1. SOT Doc &rarr; 2. SOT Links &rarr; 3. SRD
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newActionName}
                      onChange={(e) => setNewActionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSeekActionWithAI();
                        }
                      }}
                      placeholder="Type name or describe ability, then click Apple-Eye..."
                      className={`flex-1 px-3 py-1.5 rounded border ${inputStyle}`}
                    />
                    <button
                      type="button"
                      onClick={handleSeekActionWithAI}
                      disabled={isSeekingActionAI}
                      className="px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm border border-rose-400/50 shrink-0 transition-all active:scale-95"
                      title="AI Seek (Eye in an Apple): Searches 1. SOT Docs -> 2. SOT Links -> 3. Online SRD using other fields as modifiers (Never guesses!)"
                    >
                      <AppleEyeIcon className="w-4 h-4" isSeeking={isSeekingActionAI} />
                      <span>{isSeekingActionAI ? 'Seeking...' : 'Seek'}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">#MACRO_KEY</label>
                  <input
                    type="text"
                    value={newActionMacroKey}
                    onChange={(e) => setNewActionMacroKey(e.target.value)}
                    placeholder="e.g. SMITE, RAGE"
                    className={`w-full px-3 py-1.5 rounded border font-mono uppercase ${inputStyle}`}
                  />
                </div>
              </div>

              {actionLookupFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-[11px] font-mono flex items-start justify-between gap-2 ${
                    actionLookupFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : actionLookupFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    {actionLookupFeedback.authority && (
                      <span className="inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-black/20 mr-1.5">
                        {actionLookupFeedback.authority}
                      </span>
                    )}
                    <span>{actionLookupFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionLookupFeedback(null)}
                    className="opacity-60 hover:opacity-100 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Directory Category</label>
                  <select
                    value={newActionCategory}
                    onChange={(e) => setNewActionCategory(e.target.value as CharacterActionItem['category'])}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Class Resource">Class Resource</option>
                    <option value="Class Ability">Class Ability</option>
                    <option value="Resource Pool">Resource Pool</option>
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
                    onChange={(e) =>
                      setNewActionType(e.target.value as NonNullable<CharacterActionItem['actionType']>)
                    }
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="Standard">Standard Action</option>
                    <option value="Swift">Swift Action</option>
                    <option value="Move">Move Action</option>
                    <option value="Immediate">Immediate Action</option>
                    <option value="Free">Free Action</option>
                    <option value="Full-Round">Full-Round Action</option>
                    <option value="1 Round">1 Round</option>
                    <option value="Passive / Pool">Passive / Resource Pool</option>
                  </select>
                </div>
              </div>

              {/* Integrated Resource Pool / Uses Per Day Toggle */}
              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Track Daily Resource Pool / Uses (Current / Max)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={newActionHasPool}
                    onChange={(e) => setNewActionHasPool(e.target.checked)}
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                </label>

                {newActionHasPool && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block opacity-75 mb-1">Current Uses</label>
                      <input
                        type="number"
                        min="0"
                        value={newActionPoolCurrent}
                        onChange={(e) => setNewActionPoolCurrent(e.target.value)}
                        className={`w-full px-3 py-1 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                    <div>
                      <label className="block opacity-75 mb-1">Max Uses / Pool Cap</label>
                      <input
                        type="number"
                        min="1"
                        value={newActionPoolMax}
                        onChange={(e) => setNewActionPoolMax(e.target.value)}
                        className={`w-full px-3 py-1 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Macro Roll / Formula (Optional)</label>
                  <input
                    type="text"
                    value={newActionMacro}
                    onChange={(e) => setNewActionMacro(e.target.value)}
                    placeholder="e.g. 2d6+CHA, 6d6, 1d20+12"
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Icon Style</label>
                  <select
                    value={newActionIcon}
                    onChange={(e) => setNewActionIcon(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    <option value="sparkles">Sparkles (Class / Magic)</option>
                    <option value="swords">Swords (Melee / Combat)</option>
                    <option value="flame">Flame (Fire / Breath)</option>
                    <option value="shield">Shield (Defense / Buff)</option>
                    <option value="crosshair">Crosshair (Challenge / Target)</option>
                    <option value="zap">Lightning (Resource Pool)</option>
                    <option value="book">Tome (Spell Slots)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold opacity-75 mb-1">Range / Area (Optional)</label>
                  <input
                    type="text"
                    value={newActionRange}
                    onChange={(e) => setNewActionRange(e.target.value)}
                    placeholder="e.g. Personal, Touch, 30 ft."
                    className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block font-bold opacity-75 mb-1">Save DC (Optional)</label>
                  <input
                    type="text"
                    value={newActionSaveDC}
                    onChange={(e) => setNewActionSaveDC(e.target.value)}
                    placeholder="e.g. DC 17 Reflex half"
                    className={`w-full px-3 py-1.5 rounded border ${inputStyle}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold opacity-75 mb-1">Description &amp; Rules Text</label>
                <textarea
                  rows={3}
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  placeholder="Enter rules text, scaling notes, saving throw DCs, and formula tags..."
                  className={`w-full px-3 py-2 rounded border font-sans text-xs ${inputStyle}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsAddActionOpen(false)}
                className="px-3 py-1.5 rounded text-xs opacity-70 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveActionOrResource}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingActionId ? 'Save Changes' : 'Save to Directory'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Add / Edit Feat Dialog                                           */}
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
