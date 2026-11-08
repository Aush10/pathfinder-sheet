/**
 * Character State & Calculation Integration Layer
 * ===============================================
 *
 * Architectural Role:
 * -------------------
 * This module sits between raw `PF1Character` state (stored in `CharacterContext`)
 * and the calculation engines (`pf1eMath.ts`, `multiclassCalculator.ts`, `macaroni/`,
 * `sotEngine.ts`).
 *
 * INTEGRATION LAYER ENTRY POINTS:
 * -------------------------------
 * Read side — `resolveIntegratedCharacterView()` is the single selector that
 * turns raw `PF1Character` state into everything the sheet displays:
 *   - `computeDerivedCharacterStats` (pf1eMath) resolves AC, attacks, saves,
 *     CMB/CMD, HP, encumbrance, and skill points.
 *   - `resolveBuffProjection` (buffProjection) applies Pathfinder bonus
 *     stacking to the Buff Box matrix and every active custom buff, exposing
 *     both the resolved totals and the audit trail of suppressed bonuses.
 *   - `calculateCareerProgression` resolves multiclass/gestalt progression.
 *
 * Write side — state changes are funnelled through the apply* helpers below so
 * no surface mutates a character ad hoc:
 *   - `applyCareerProgressionToCharacter` syncs class grids into BAB, saves,
 *     HP, skills, and feats.
 *   - `applyBuffBoxToCharacter` / `applyCustomBuffsWithInventorySync` keep the
 *     Buff Box and inventory item buffs consistent.
 *   - `projectMacaroniResult` is the only path from Macaroni output to sheet
 *     state: buff constructs land in the Buff Box, core fields are applied
 *     directly, and stat mutations become live, removable "Macro:" buffs.
 *
 * New cross-cutting derivations belong here rather than in components, so the
 * sheet, the printable export, and the Macaroni formula context all read the
 * same resolved numbers.
 */

import {
  AbilityName,
  BuffBoxData,
  BuffStatTarget,
  CareerProgressionData,
  CharacterClassEntry,
  CustomBuffEffect,
  CustomClassGrid,
  PF1Character,
  WorkspaceLayout,
} from '../types/character';
import {
  DEFAULT_CHARACTER,
  createBlankCharacter,
  syncOddLevelFeats,
} from '../data/defaultCharacter';
import { normalizeCharacter } from '../storage/characterState';
import {
  DerivedCombatStats,
  computeDerivedCharacterStats,
} from './pf1eMath';
import {
  CalculatedCareerResult,
  calculateCareerProgression,
} from './multiclassCalculator';
import {
  applyMacaroniToCharacter,
  resolveBuffStatTarget,
  type MacaroniExecutionResult,
} from './macaroni';

export const LOCAL_STORAGE_CHARACTER_KEY = 'pf1e_character_data_v1';
export const LOCAL_STORAGE_LAYOUT_KEY = 'pf1e_workspace_layout_v1';

export interface ImageBrowserTargetConfig {
  targetType: 'profile' | 'portrait' | 'item';
  title?: string;
  subtitle?: string;
  itemName?: string;
  currentUrl?: string;
  itemId?: string;
}

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  theme: 'parchment',
  font: 'times',
  glyphStyle: '01-flat-enamel',
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
    addClass: true,
    levelStepper: true,
    turnStepper: true,
    quickMacros: true,
  },
};

/**
 * Normalizes and hydrates a partial or raw character payload,
 * ensuring all nested objects, arrays, memoryBank, sotCatalogue, and odd-level feats are structurally valid.
 */
export function normalizeCharacterState(raw?: Partial<PF1Character> | null): PF1Character {
  if (!raw || typeof raw !== 'object') {
    return syncOddLevelFeats(DEFAULT_CHARACTER);
  }
  return syncOddLevelFeats(normalizeCharacter(raw));
}

/**
 * Loads the initial PF1Character from window.__INITIAL_CHARACTER__, localStorage, or DEFAULT_CHARACTER.
 */
export function loadInitialCharacterState(): PF1Character {
  try {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_CHARACTER__) {
      return normalizeCharacterState((window as any).__INITIAL_CHARACTER__);
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_CHARACTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeCharacterState(parsed);
        }
      }
    }
  } catch {
    // Fallback to default character
  }
  return syncOddLevelFeats(DEFAULT_CHARACTER);
}

/**
 * Loads the initial WorkspaceLayout from window.__INITIAL_LAYOUT__, localStorage, or DEFAULT_WORKSPACE_LAYOUT.
 */
export function loadInitialLayoutState(): WorkspaceLayout {
  try {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_LAYOUT__) {
      return (window as any).__INITIAL_LAYOUT__;
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            theme: parsed.theme || DEFAULT_WORKSPACE_LAYOUT.theme,
            font: parsed.font || DEFAULT_WORKSPACE_LAYOUT.font,
            glyphStyle: parsed.glyphStyle || DEFAULT_WORKSPACE_LAYOUT.glyphStyle,
            activeSheet:
              parsed.activeSheet >= 1 && parsed.activeSheet <= 4 ? parsed.activeSheet : 1,
            showAllSheets: Boolean(parsed.showAllSheets),
            visibleModules: {
              ...DEFAULT_WORKSPACE_LAYOUT.visibleModules,
              ...(parsed.visibleModules || {}),
            },
          };
        }
      }
    }
  } catch {
    // Fallback
  }
  return DEFAULT_WORKSPACE_LAYOUT;
}

/**
 * ============================================================================
 * INTEGRATION SELECTOR PIPELINE
 * ============================================================================
 * Takes the current `PF1Character` state and computes all derived combat,
 * skill, encumbrance, Buff Box, and career progression statistics. Sheet pages,
 * the printable sheet, and the Macaroni formula context all consume this view
 * so a buff that raises AC raises it everywhere at once.
 *
 * `derived.buffProjection` carries the per-stat audit trail (which buff
 * applied, which was suppressed by stacking) for UI that needs to explain a
 * number rather than just print it.
 */
export interface IntegratedCharacterView {
  character: PF1Character;
  derived: DerivedCombatStats;
  careerSummary: CalculatedCareerResult;
}

export function resolveIntegratedCharacterView(
  character: PF1Character
): IntegratedCharacterView {
  const derived = computeDerivedCharacterStats(character);
  const careerSummary = calculateCareerProgression(character, character.careerData);
  return {
    character,
    derived,
    careerSummary,
  };
}

/**
 * Resolves the BAB progression rate ('full' | 'threeQuarter' | 'half') from a CustomClassGrid.
 */
export function inferBabProgressionFromGrid(
  grid?: CustomClassGrid
): 'full' | 'threeQuarter' | 'half' {
  if (!grid || !Array.isArray(grid.rows) || grid.rows.length === 0) {
    return 'full';
  }
  const r20 = grid.rows.find((r) => r.level === 20) || grid.rows[grid.rows.length - 1];
  const ratio = r20.level > 0 ? r20.bab / r20.level : 1;
  if (ratio >= 0.95) return 'full';
  if (ratio >= 0.7) return 'threeQuarter';
  return 'half';
}

/**
 * Synchronizes Career Progression & Custom Class Grids into all relevant PF1Character fields:
 * - level, characterClass, and structured classes[] array (with HD, skillPointsPerLevel, babProgression)
 * - baseAttackBonus & base saves (fortitude.base, reflex.base, will.base)
 * - hitDice string, hpTotalMax, hpCurrent delta, and hpBreakdown (hitDiceCount, hitDiceSize, hitDiceRolledBase)
 * - classSkillPointsPerLevel, favoredClassSkillRanks, and unlocked class skills from active class grids
 * - proficiencies & career features merged into featsAndAbilities and odd-level featEntries
 */
export function applyCareerProgressionToCharacter(
  character: PF1Character,
  careerOverride?: CareerProgressionData
): { updatedCharacter: PF1Character; careerResult: CalculatedCareerResult } {
  const effectiveCareer = careerOverride || character.careerData;
  const careerResult = calculateCareerProgression(character, effectiveCareer);
  const customGrids = character.customClassGrids || {};

  // 1. Build structured ClassEntry[] from career level breakdown
  const classLevelCounts = new Map<
    string,
    { gridId: string; grid?: CustomClassGrid; count: number; favoredCount: number }
  >();
  const levels = effectiveCareer?.levels || [];

  if (levels.length > 0) {
    levels.forEach((entry) => {
      const grid = customGrids[entry.primaryClassId] || customGrids['class1'];
      const key = entry.primaryClassId || grid?.id || 'class1';
      const existing = classLevelCounts.get(key) || {
        gridId: key,
        grid,
        count: 0,
        favoredCount: 0,
      };
      existing.count += 1;
      if (entry.favoredClassBonus === 'hp' || entry.favoredClassBonus === 'skill') {
        existing.favoredCount += 1;
      }
      classLevelCounts.set(key, existing);
    });
  }

  const structuredClasses: CharacterClassEntry[] =
    classLevelCounts.size > 0
      ? Array.from(classLevelCounts.values()).map((item, idx) => ({
          id: item.gridId,
          name: item.grid?.className || `Class ${idx + 1}`,
          level: item.count,
          hitDie: item.grid?.hitDie || character.hpBreakdown?.hitDiceSize || 10,
          skillPointsPerLevel:
            item.grid?.skillPointsPerLevel ?? character.classSkillPointsPerLevel ?? 2,
          babProgression: inferBabProgressionFromGrid(item.grid),
          isFavoredClass: idx === 0 || item.favoredCount > 0,
        }))
      : character.classes || [];

  // 2. Collect class skills and proficiencies across all active classes in career
  const activeGrids: CustomClassGrid[] = [];
  classLevelCounts.forEach((v) => {
    if (v.grid) activeGrids.push(v.grid);
  });
  if (activeGrids.length === 0 && customGrids['class1']) {
    activeGrids.push(customGrids['class1']);
  }

  const skillTokens = new Set<string>();
  const proficiencyLines: string[] = [];

  activeGrids.forEach((grid) => {
    if (grid.classSkillsText) {
      grid.classSkillsText
        .split(/[,\n;]+/)
        .map((s) => s.replace(/\([a-zA-Z]+\)/g, '').trim().toLowerCase())
        .filter((s) => s.length >= 3)
        .forEach((t) => skillTokens.add(t));
    }
    if (grid.proficiencies && grid.proficiencies.trim()) {
      proficiencyLines.push(`[${grid.className} Proficiencies] ${grid.proficiencies.trim()}`);
    }
  });

  const updatedSkills = (character.skills || []).map((sk) => {
    if (skillTokens.size === 0) return sk;
    const sName = sk.name.toLowerCase();
    const matched = Array.from(skillTokens).some(
      (tok) =>
        sName === tok ||
        sName.startsWith(tok) ||
        tok === sName.replace(/\s*\([^)]+\)/, '')
    );
    return matched ? { ...sk, isClassSkill: true } : sk;
  });

  // 3. Merge career features and class proficiencies into featsAndAbilities
  const combinedAbilities = [...(character.featsAndAbilities || [])];
  for (const prof of proficiencyLines) {
    if (!combinedAbilities.some((existing) => existing.toLowerCase() === prof.toLowerCase())) {
      combinedAbilities.push(prof);
    }
  }
  for (const feat of careerResult.allFeatures) {
    if (!combinedAbilities.some((existing) => existing.toLowerCase() === feat.toLowerCase())) {
      combinedAbilities.push(feat);
    }
  }

  // 4. Calculate favored class bonuses (skill ranks & HP)
  const favoredSkillRanks =
    levels.length > 0
      ? levels.filter((l) => l.favoredClassBonus === 'skill').length
      : character.favoredClassSkillRanks || 0;

  const primaryDominantGrid = activeGrids[0];
  const dominantSkillPointsPerLevel =
    primaryDominantGrid?.skillPointsPerLevel ?? character.classSkillPointsPerLevel ?? 2;
  const dominantHitDie =
    primaryDominantGrid?.hitDie ?? character.hpBreakdown?.hitDiceSize ?? 10;

  // Keep hpCurrent proportional when max HP increases
  const prevMaxHp = character.hpTotalMax || careerResult.totalHp;
  const hpDelta = Math.max(0, careerResult.totalHp - prevMaxHp);
  const nextCurrentHp = Math.min(
    careerResult.totalHp,
    (character.hpCurrent || careerResult.totalHp) + hpDelta
  );

  const nextChar: PF1Character = syncOddLevelFeats({
    ...character,
    level: careerResult.totalLevel,
    characterClass: careerResult.classSummaryTitle || character.characterClass,
    classes: structuredClasses,
    baseAttackBonus: careerResult.totalBab,
    saves: {
      ...character.saves,
      fortitude: { ...character.saves.fortitude, base: careerResult.fortBase },
      reflex: { ...character.saves.reflex, base: careerResult.refBase },
      will: { ...character.saves.will, base: careerResult.willBase },
    },
    hpTotalMax: careerResult.totalHp,
    hpCurrent: nextCurrentHp,
    hitDice: careerResult.hitDiceString,
    hpBreakdown: {
      hitDiceCount: careerResult.totalLevel,
      hitDiceSize: dominantHitDie,
      hitDiceRolledBase: careerResult.totalHp,
      additionalBonuses: character.hpBreakdown?.additionalBonuses || [],
      calcMethod: character.hpBreakdown?.calcMethod || 'average',
    },
    classSkillPointsPerLevel: dominantSkillPointsPerLevel,
    favoredClassSkillRanks: favoredSkillRanks,
    skills: updatedSkills,
    featsAndAbilities: combinedAbilities,
    careerData: effectiveCareer || character.careerData,
  });

  return {
    updatedCharacter: nextChar,
    careerResult,
  };
}

/**
 * Applies Point Buy base scores and Level Ability Score Increases (ASI) to a character.
 */
export function applyPointBuyToCharacter(
  character: PF1Character,
  {
    bases,
    asi,
  }: {
    bases: Record<AbilityName, number>;
    asi: Record<AbilityName, number>;
  }
): PF1Character {
  const updatedAbilities = { ...character.abilities };
  for (const ab of Object.keys(bases) as AbilityName[]) {
    if (updatedAbilities[ab]) {
      updatedAbilities[ab] = {
        ...updatedAbilities[ab],
        base: bases[ab],
        levelAsiMod: asi[ab] || 0,
      };
    }
  }
  return {
    ...character,
    abilities: updatedAbilities,
  };
}

/**
 * Updates BuffBox typed matrix on a character.
 */
export function applyBuffBoxToCharacter(
  character: PF1Character,
  buffBox: BuffBoxData
): PF1Character {
  return {
    ...character,
    buffBox,
  };
}

/**
 * Updates customBuffs and synchronizes any linked inventory item buffActive flags.
 */
export function applyCustomBuffsWithInventorySync(
  character: PF1Character,
  newBuffs: CustomBuffEffect[]
): PF1Character {
  const itemActiveMap = new Map<string, boolean>();
  newBuffs.forEach((b) => {
    if (b.itemId) itemActiveMap.set(b.itemId, b.isActive);
  });
  const updatedInventory = (character.inventory || []).map((item) => {
    if (itemActiveMap.has(item.id)) {
      return { ...item, buffActive: itemActiveMap.get(item.id), hasBuff: true };
    }
    return item;
  });
  return {
    ...character,
    customBuffs: newBuffs,
    inventory: updatedInventory,
  };
}

/** Prefix used to identify buffs that were materialised from an inline macro. */
export const MACARONI_MUTATOR_PREFIX = 'macaroni-mutator:';

export interface MacaroniProjectionResult {
  character: PF1Character;
  statusMessage: string;
  didMutate: boolean;
}

/**
 * Projects a finished Macaroni run onto the character.
 *
 * This is the single integration point for macro output. The Macaroni engine
 * resolves `<^...>` buff constructs, dice, and numeric pushes; this function
 * decides what reaches the sheet:
 *
 * 1. `<^...>` buff constructs become Buff Box entries (named buffs) or typed
 *    matrix cells, so they flow through bonus stacking into AC, attacks,
 *    saves, and HP.
 * 2. Core field mutations (`HP`, `THP`, `GP`) are applied directly.
 * 3. Any remaining `^`/`>>` mutation that targets a Buff Box stat (`AC`,
 *    `FORT`, `STR`, ...) becomes a live "Macro:" buff, so a macro that says
 *    `AC^+2` is visible on the sheet and removable from the Buff Box instead
 *    of being silently discarded.
 */
export function projectMacaroniResult(
  character: PF1Character,
  result: MacaroniExecutionResult
): MacaroniProjectionResult {
  const engineApplied = applyMacaroniToCharacter(character, result);
  let nextCharacter = engineApplied.updatedCharacter;
  const notes: string[] = engineApplied.didMutate ? [engineApplied.statusMessage] : [];
  let didMutate = engineApplied.didMutate;

  const deltasByStat = new Map<BuffStatTarget, number>();

  for (const mutation of result.stateMutations || []) {
    const field = mutation.field.toLowerCase().replace(/^~/, '');
    if (['hp', 'hp_current', 'thp', 'temp_hp', 'gp', 'gold'].includes(field)) {
      continue; // already applied by the engine
    }

    const stat = resolveBuffStatTarget(field);
    if (!stat || !mutation.delta) continue;

    deltasByStat.set(stat, (deltasByStat.get(stat) || 0) + mutation.delta);
  }

  if (deltasByStat.size > 0) {
    const currentBuffs = [...(nextCharacter.customBuffs || [])];

    deltasByStat.forEach((delta, stat) => {
      const id = `${MACARONI_MUTATOR_PREFIX}${stat}`;
      const existingIndex = currentBuffs.findIndex((buff) => buff.id === id);
      const label = stat.replace(/_/g, ' ').toUpperCase();

      if (existingIndex >= 0) {
        const merged = (currentBuffs[existingIndex].values[stat] || 0) + delta;
        if (merged === 0) {
          currentBuffs.splice(existingIndex, 1);
          notes.push(`${label} modifier cleared`);
        } else {
          currentBuffs[existingIndex] = {
            ...currentBuffs[existingIndex],
            values: { [stat]: merged },
          };
          notes.push(`${label} ${merged >= 0 ? '+' : ''}${merged} (live on sheet)`);
        }
        return;
      }

      if (delta === 0) return;

      currentBuffs.unshift({
        id,
        name: `Macro: ${label}`,
        category: 'activatable',
        bonusType: 'Untyped',
        isActive: true,
        values: { [stat]: delta },
        notes: 'Created by an inline Macaroni mutation. Toggle off or delete to clear.',
      });
      notes.push(`${label} ${delta >= 0 ? '+' : ''}${delta} applied`);
    });

    nextCharacter = { ...nextCharacter, customBuffs: currentBuffs };
    didMutate = true;
  }

  const statusMessage = notes.length > 0 ? notes.join(' • ') : engineApplied.statusMessage;

  return { character: nextCharacter, statusMessage, didMutate };
}

/**
 * Applies a selected image URL from the Image File Browser to profile avatar, portraits, or inventory item.
 */
export function applySelectedImageToCharacter(
  character: PF1Character,
  config: {
    targetType: 'profile' | 'portrait' | 'item';
    itemId?: string;
  },
  url: string
): PF1Character {
  if (config.targetType === 'profile') {
    return {
      ...character,
      profileData: {
        ...(character.profileData || { customFields: [] }),
        avatarUrl: url,
      },
    };
  }
  if (config.targetType === 'portrait') {
    const currentList = character.characterBio?.portraits || [];
    const updated = url ? [...currentList.filter((p) => p !== url), url] : currentList;
    return {
      ...character,
      characterBio: {
        ...(character.characterBio || { scratchpad: '', bioSections: [] }),
        portraits: updated,
        currentPortraitIndex: Math.max(0, updated.length - 1),
      },
    };
  }
  if (config.targetType === 'item' && config.itemId) {
    return {
      ...character,
      inventory: (character.inventory || []).map((item) =>
        item.id === config.itemId ? { ...item, imageUrl: url } : item
      ),
    };
  }
  return character;
}

export { DEFAULT_CHARACTER, createBlankCharacter, syncOddLevelFeats };
