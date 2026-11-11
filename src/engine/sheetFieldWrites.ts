/**
 * Structured Complete Sheet writes.
 *
 * The model (and tests) hand JSON field updates here. Each update is applied
 * to the same character objects the sheet and Add Class already read, or it
 * is refused with the character left unchanged for that field.
 */

import type {
  AbilityName,
  AIModuleSettings,
  ArmorItem,
  CharacterActionItem,
  CharacterClassEntry,
  CompanionNPC,
  ConditionState,
  CustomClassGrid,
  CustomFormulaObject,
  FeatItem,
  InventoryItem,
  JournalEntry,
  PF1Character,
  ResourceTracker,
  SkillItem,
  SOTRichTextPage,
  SpellItem,
  WeaponAttack,
  ClassGridRow,
} from '../types/character';
import { POINT_BUY_COST_TABLE } from './pf1eMath';

export const ABILITY_NAMES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const SECRET_KEY = /api[_-]?key|secret|password|credential|private[_-]?key|access[_-]?token|(^|_)token$|^token$|authorization|bearer/i;

const SIZES = new Set([
  'Fine',
  'Diminutive',
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
  'Colossal',
]);

const CONDITION_KEYS: Array<keyof ConditionState> = [
  'blinded',
  'cowering',
  'dazzled',
  'deafened',
  'entangled',
  'exhausted',
  'fatigued',
  'frightened',
  'grappled',
  'panicked',
  'pinned',
  'prone',
  'shaken',
  'sickened',
  'stunned',
  'haste',
  'prayer',
  'enlarge',
  'reduce',
  'heroism',
];

const HIT_DICE = new Set([6, 8, 10, 12]);

export interface SheetWriteContext {
  /** Budget the player stated in this message, if any. */
  statedBudget?: number | null;
  /** True only when the player explicitly asked to roll or randomly assign ability scores. */
  allowRandom?: boolean;
  allowedModules?: AIModuleSettings['allowedModules'];
  /** When false, class-skill checkboxes are left alone even if a pasted class list names them. */
  markClassSkills?: boolean;
  rng?: () => number;
  /** SOT pages the write may read. Demo pages are not implied. */
  sotPages?: SOTRichTextPage[];
}

export interface StructuredSheetUpdate {
  category?: string;
  skill?: string;
  isClassSkill?: boolean | string | number;
  ranks?: number | string;
  miscMod?: number | string;
  clearClassSkills?: boolean;
  classSkillPointsPerLevel?: number | string;
  favoredClassSkillRanks?: number | string;
  className?: string;
  archetype?: string;
  level?: number | string;
  hitDie?: number | string;
  skillPointsPerLevel?: number | string;
  classMode?: 'set' | 'add';
  scores?: Partial<Record<string, number | string>>;
  levelIncreases?: Partial<Record<string, number | string>>;
  raceMods?: Partial<Record<string, number | string>>;
  enhMods?: Partial<Record<string, number | string>>;
  miscMods?: Partial<Record<string, number | string>>;
  tempMods?: Partial<Record<string, number | string>>;
  budget?: number | string;
  random?: boolean;
  values?: Record<string, unknown>;
  add?: Record<string, unknown>;
  remove?: string;
  appendNote?: string;
  setNote?: string;
  resetPools?: boolean;
  label?: string;
}

export interface ClassSyncResult {
  character: PF1Character;
  summary: string;
  questions: string[];
  missingSotRequest: { title: string; category: string; reason: string } | null;
  classSkillNames: string[];
}

export interface AbilityWriteResult {
  character: PF1Character;
  saved: boolean;
  blockedModule?: boolean;
  rejected?: boolean;
  label: string;
  details: string;
  question?: string;
}

export interface SkillWriteResult {
  character: PF1Character;
  saved: boolean;
  label: string;
  details: string;
  question?: string;
}

export interface StructuredWriteResult {
  character: PF1Character;
  appliedLabels: string[];
  blocked: Array<{ label: string; details: string }>;
  rejected: Array<{ label: string; details: string }>;
  questions: string[];
  missingSotRequest: { title: string; category: string; reason: string } | null;
  abilityAttempted: boolean;
}

function pagesOf(character: PF1Character, context?: SheetWriteContext): SOTRichTextPage[] {
  if (context?.sotPages) return context.sotPages;
  if (character.sotCatalogue) return character.sotCatalogue.overridePages ?? [];
  return [];
}

function containsSecretKey(value: unknown, depth = 0): boolean {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) return true;
    if (containsSecretKey(child, depth + 1)) return true;
  }
  return false;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function asInt(value: unknown): number | undefined {
  const n = asNumber(value);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (['true', 'yes', 'y', 'on'].includes(text)) return true;
    if (['false', 'no', 'n', 'off'].includes(text)) return false;
  }
  return undefined;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function abilityKey(raw: string): AbilityName | undefined {
  const key = raw.trim().toUpperCase().slice(0, 3);
  return ABILITY_NAMES.includes(key as AbilityName) ? (key as AbilityName) : undefined;
}

export function pointBuyCost(score: number): number | null {
  if (!Number.isInteger(score) || score < 6 || score > 18) return null;
  const cost = POINT_BUY_COST_TABLE[score];
  return typeof cost === 'number' ? cost : null;
}

export function extractStatedPointBuyBudget(text: string): number | null {
  if (!text) return null;
  const match = text.match(
    /(\d{1,2})\s*[- ]?\s*point(?:\s*|-)?buy|point\s*buy(?:\s+budget)?(?:\s+of|\s+is|\s*[:=])?\s*(\d{1,2})/i
  );
  if (!match) return null;
  const value = parseInt(match[1] || match[2], 10);
  return Number.isFinite(value) ? value : null;
}

export function playerAskedToRandomizeAbilities(text: string): boolean {
  return /\b(roll|random(?:ly|ize)?|surprise me)\b[\s\S]{0,40}\b(stat|ability|abilities|array|scores?)\b|\b(stat|ability|abilities|array|scores?)\b[\s\S]{0,40}\b(roll|random(?:ly|ize)?)\b/i.test(
    text || ''
  );
}

export function resolvePointBuyBudget(
  character: PF1Character,
  context: SheetWriteContext | undefined,
  updateBudget: number | undefined
): number | null {
  for (const candidate of [updateBudget, context?.statedBudget, character.pointBuyBudget]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) return candidate;
  }
  return null;
}

function readAbilityMap(
  raw: Partial<Record<string, number | string>> | undefined
): Partial<Record<AbilityName, number>> {
  const out: Partial<Record<AbilityName, number>> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    const ability = abilityKey(key);
    const n = asInt(value);
    if (ability && n !== undefined) out[ability] = n;
  }
  return out;
}

export function rollLegalPointBuyArray(
  budget: number,
  rng: () => number = Math.random,
  maxAttempts = 80
): { scores: Record<AbilityName, number>; attempts: number } | null {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const scores = {} as Record<AbilityName, number>;
    for (const ability of ABILITY_NAMES) {
      scores[ability] = 7 + Math.floor(rng() * 12);
    }
    const spent = ABILITY_NAMES.reduce((sum, ability) => sum + (pointBuyCost(scores[ability]) ?? 999), 0);
    if (spent <= budget) return { scores, attempts: attempt };
  }
  return null;
}

export function applyAbilityWrite(
  character: PF1Character,
  input: {
    scores?: Partial<Record<string, number | string>>;
    levelIncreases?: Partial<Record<string, number | string>>;
    raceMods?: Partial<Record<string, number | string>>;
    enhMods?: Partial<Record<string, number | string>>;
    miscMods?: Partial<Record<string, number | string>>;
    tempMods?: Partial<Record<string, number | string>>;
    budget?: number | string;
    random?: boolean;
  },
  context?: SheetWriteContext
): AbilityWriteResult {
  const scores = readAbilityMap(input.scores);
  const levelIncreases = readAbilityMap(input.levelIncreases);
  const raceMods = readAbilityMap(input.raceMods);
  const enhMods = readAbilityMap(input.enhMods);
  const miscMods = readAbilityMap(input.miscMods);
  const tempMods = readAbilityMap(input.tempMods);
  const wantsRandom = input.random === true;
  const assignsArray = Object.keys(scores).length > 0 || Object.keys(levelIncreases).length > 0 || wantsRandom;

  if (assignsArray && context?.allowedModules?.pointBuy === false) {
    return {
      character,
      saved: false,
      blockedModule: true,
      label: 'Point buy blocked',
      details: 'Point Buy is in the AI blind spots, so this ability array was not saved.',
    };
  }

  if (wantsRandom && !context?.allowRandom) {
    return {
      character,
      saved: false,
      rejected: true,
      label: 'Random ability scores were not requested',
      details: 'Ability scores were left unchanged. Ask to roll or randomly assign stats before they are generated.',
    };
  }

  const budget = resolvePointBuyBudget(character, context, asInt(input.budget));
  let nextScores = scores;
  let randomNote = '';

  if (wantsRandom && Object.keys(scores).length === 0) {
    if (budget === null) {
      return {
        character,
        saved: false,
        rejected: true,
        label: 'Point-buy budget needed',
        details: 'No ability scores were saved. What point-buy budget should be used?',
        question: 'What point-buy budget should I use? I will not assume one, and I did not save an ability array.',
      };
    }
    const rolled = rollLegalPointBuyArray(budget, context?.rng);
    if (!rolled) {
      return {
        character,
        saved: false,
        rejected: true,
        label: 'Random point buy failed',
        details: `No legal array within ${budget} points was kept.`,
        question: `I could not find a legal ${budget}-point array to keep, so ability scores were left unchanged.`,
      };
    }
    nextScores = rolled.scores;
    randomNote = ` Rolled a legal array in ${rolled.attempts} attempt${rolled.attempts === 1 ? '' : 's'}.`;
  }

  const proposedBases = {} as Record<AbilityName, number>;
  let spent = 0;
  for (const ability of ABILITY_NAMES) {
    const current = character.abilities[ability]?.base ?? 0;
    const written = nextScores[ability];
    const proposed = written !== undefined ? written : current;
    proposedBases[ability] = proposed;
    if (written !== undefined && pointBuyCost(written) === null) {
      return {
        character,
        saved: false,
        rejected: true,
        label: 'Ability array rejected',
        details: `${ability} ${written} is outside the 6–18 point-buy range, so the array was not saved.`,
      };
    }
    if (pointBuyCost(proposed) !== null) spent += pointBuyCost(proposed) ?? 0;
  }

  const proposedAsi = {} as Record<AbilityName, number>;
  let asiSpent = 0;
  for (const ability of ABILITY_NAMES) {
    const current = character.abilities[ability]?.levelAsiMod ?? 0;
    const written = levelIncreases[ability];
    const proposed = written !== undefined ? written : current;
    if (!Number.isInteger(proposed) || proposed < 0) {
      return {
        character,
        saved: false,
        rejected: true,
        label: 'Level increases rejected',
        details: 'Level increases must be whole numbers of 0 or more, so the ability array was not saved.',
      };
    }
    proposedAsi[ability] = proposed;
    asiSpent += proposed;
  }
  const asiAllowed = Math.max(0, Math.floor((character.level || 0) / 4));

  if (assignsArray && budget === null) {
    return {
      character,
      saved: false,
      rejected: true,
      label: 'Point-buy budget needed',
      details: 'No ability scores were saved. What point-buy budget should be used?',
      question: 'What point-buy budget should I use? I will not assume one, and I did not save an ability array.',
    };
  }

  if (assignsArray && budget !== null && spent > budget) {
    return {
      character,
      saved: false,
      rejected: true,
      label: 'Point buy over budget',
      details: `This array costs ${spent} and the budget is ${budget}. Ability scores were not saved.`,
    };
  }

  if (assignsArray && asiSpent > asiAllowed) {
    return {
      character,
      saved: false,
      rejected: true,
      label: 'Too many level increases',
      details: `Level increases total ${asiSpent}, and level ${character.level || 0} allows ${asiAllowed}. Ability scores were not saved.`,
    };
  }

  const abilities = { ...character.abilities };
  for (const ability of ABILITY_NAMES) {
    const current = abilities[ability];
    abilities[ability] = {
      ...current,
      base: proposedBases[ability],
      levelAsiMod: proposedAsi[ability],
      raceMod: raceMods[ability] ?? current.raceMod,
      enhMod: enhMods[ability] ?? current.enhMod,
      miscMod: miscMods[ability] ?? current.miscMod,
      tempMod: tempMods[ability] ?? current.tempMod,
    };
  }

  const summary = ABILITY_NAMES.map((ability) => `${ability} ${abilities[ability].base}`).join(', ');
  return {
    character: {
      ...character,
      abilities,
      ...(budget !== null ? { pointBuyBudget: budget } : {}),
    },
    saved: true,
    label: wantsRandom ? `Random point buy (${budget} pts)` : `Ability scores (${summary})`,
    details: `Saved ability scores within ${budget ?? 'the stated'} point-buy budget.${randomNote}`,
  };
}

function skillQueryIndex(skills: SkillItem[], query: string): number | 'ambiguous' {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const exact = skills.findIndex((skill) => skill.name.toLowerCase().replace(/\s+/g, ' ').trim() === q);
  if (exact >= 0) return exact;
  const matches = skills
    .map((skill, index) => ({
      index,
      full: skill.name.toLowerCase(),
      base: skill.name.toLowerCase().split(' (')[0],
    }))
    .filter(({ full, base }) => full.startsWith(q) || base === q);
  if (matches.length === 1) return matches[0].index;
  if (matches.length > 1) return 'ambiguous';
  return -1;
}

export function applySkillWrite(
  character: PF1Character,
  input: {
    skill?: string;
    isClassSkill?: boolean | string | number;
    ranks?: number | string;
    miscMod?: number | string;
    clearClassSkills?: boolean;
    classSkillPointsPerLevel?: number | string;
    favoredClassSkillRanks?: number | string;
  }
): SkillWriteResult {
  let skills = (character.skills || []).map((skill) => ({ ...skill }));
  let classSkillPointsPerLevel = character.classSkillPointsPerLevel;
  let favoredClassSkillRanks = character.favoredClassSkillRanks;
  const notes: string[] = [];

  if (input.clearClassSkills) {
    skills = skills.map((skill) => ({ ...skill, isClassSkill: false }));
    notes.push('cleared every class-skill checkbox');
  }

  const sp = asInt(input.classSkillPointsPerLevel);
  if (sp !== undefined) {
    classSkillPointsPerLevel = sp;
    notes.push(`skill points per level ${sp}`);
  }
  const favored = asInt(input.favoredClassSkillRanks);
  if (favored !== undefined) {
    favoredClassSkillRanks = favored;
    notes.push(`favored class skill ranks ${favored}`);
  }

  if (input.skill) {
    const index = skillQueryIndex(skills, input.skill);
    if (index === 'ambiguous') {
      return {
        character,
        saved: false,
        label: `Which ${input.skill} skill?`,
        details: `"${input.skill}" matches more than one skill, so the skills matrix was not changed.`,
        question: `Which skill should "${input.skill}" update? Name the full skill so the class-skill checkbox, ranks, and misc modifier stay specific.`,
      };
    }
    if (index < 0) {
      return {
        character,
        saved: false,
        label: `Skill not found: ${input.skill}`,
        details: `No row named "${input.skill}" exists on the skills matrix, so nothing was changed.`,
      };
    }
    const current = skills[index];
    const next: SkillItem = { ...current };
    const classSkill = input.isClassSkill === undefined ? undefined : coerceBoolean(input.isClassSkill);
    if (input.isClassSkill !== undefined && classSkill === undefined) {
      return {
        character,
        saved: false,
        label: `Class skill value was not true or false`,
        details: `The class-skill checkbox for ${current.name} was left unchanged.`,
      };
    }
    if (classSkill !== undefined) next.isClassSkill = classSkill;
    const ranks = asInt(input.ranks);
    if (ranks !== undefined) next.ranks = Math.max(0, ranks);
    const misc = asInt(input.miscMod);
    if (misc !== undefined) next.miscMod = misc;
    skills[index] = next;
    const parts = [`${current.name}`];
    if (classSkill !== undefined) parts.push(`class skill ${classSkill ? 'true' : 'false'}`);
    if (ranks !== undefined) parts.push(`ranks ${next.ranks}`);
    if (misc !== undefined) parts.push(`misc ${next.miscMod}`);
    notes.push(parts.join(', '));
  }

  if (notes.length === 0) {
    return {
      character,
      saved: false,
      label: 'No skill change',
      details: 'The skills matrix was not changed.',
    };
  }

  return {
    character: { ...character, skills, classSkillPointsPerLevel, favoredClassSkillRanks },
    saved: true,
    label: `Skills: ${notes.join('; ')}`,
    details: 'Updated the skills matrix the sheet displays.',
  };
}

export function parsePastedProgressionRows(raw: string): ClassGridRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: ClassGridRow[] = [];
  for (const line of lines) {
    if (/^(level|lvl|bab|base attack|hd)\b/i.test(line)) continue;
    let parts: string[] = [];
    if (line.includes('\t')) parts = line.split('\t').map((part) => part.trim()).filter(Boolean);
    else if (line.includes('|')) parts = line.split('|').map((part) => part.trim()).filter(Boolean);
    else {
      const matched = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);
      parts = matched
        ? [matched[1], matched[2], matched[3], matched[4], matched[5], matched[6]]
        : line.split(/\s+/);
    }
    if (parts.length < 5) continue;
    const levelMatch = parts[0].match(/\d+/);
    if (!levelMatch) continue;
    const level = parseInt(levelMatch[0], 10);
    if (level < 1 || level > 20 || rows.some((row) => row.level === level)) continue;
    const babMatch = parts[1].match(/[+-]?\d+/);
    const save = (value: string) => {
      const match = value.match(/[+-]?\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    rows.push({
      level,
      bab: babMatch ? Math.abs(parseInt(babMatch[0], 10)) : level,
      babString: parts[1],
      fort: save(parts[2]),
      ref: save(parts[3]),
      will: save(parts[4]),
      special: parts.slice(5).join(' ').trim() || '—',
    });
  }
  return rows.sort((a, b) => a.level - b.level);
}

function pageBlob(page: SOTRichTextPage): string {
  return `${page.title || ''}\n${(page.tags || []).join(' ')}\n${page.plainText || ''}`;
}

function findClassPage(pages: SOTRichTextPage[], className: string): SOTRichTextPage | undefined {
  const needle = className.trim().toLowerCase();
  if (!needle) return undefined;
  const candidates = pages.filter((page) => {
    const title = (page.title || '').toLowerCase();
    const tags = (page.tags || []).join(' ').toLowerCase();
    const text = (page.plainText || '').toLowerCase();
    return (
      title.includes(needle) ||
      tags.includes(needle) ||
      (text.includes(needle) && /class skills|hit die|skill ranks/i.test(page.plainText || ''))
    );
  });
  return (
    candidates.find((page) => parsePastedProgressionRows(page.plainText || '').length > 0) || candidates[0]
  );
}

function findArchetypePage(pages: SOTRichTextPage[], archetype: string): SOTRichTextPage | undefined {
  const needle = archetype.trim().toLowerCase();
  if (!needle) return undefined;
  return pages.find((page) => pageBlob(page).toLowerCase().includes(needle));
}

function detectHitDie(text: string): number | undefined {
  const match = text.match(/(?:hit\s*die|hd)\s*[:=—-]?\s*d(6|8|10|12)\b/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function detectSkillRanks(text: string): number | undefined {
  const match = text.match(/([2468])\s*\+\s*int/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function classSkillsNamedIn(text: string, skills: SkillItem[]): string[] {
  const names: string[] = [];
  for (const skill of skills) {
    const full = skill.name.toLowerCase();
    if (full.includes('(')) {
      const subtype = full.match(/\((.+)\)/)?.[1] || '';
      const subtypePattern = subtype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (
        text.toLowerCase().includes(full) ||
        (subtype && new RegExp(`knowledge\\s*\\([^)]*${subtypePattern}[^)]*\\)`, 'i').test(text)) ||
        (subtype && new RegExp(`\\b${full.split(' (')[0]}\\s*\\([^)]*${subtypePattern}[^)]*\\)`, 'i').test(text))
      ) {
        names.push(skill.name);
      }
      continue;
    }
    const base = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${base}\\b`, 'i').test(text)) names.push(skill.name);
  }
  return names;
}

function classSummary(classes: CharacterClassEntry[]): string {
  return classes
    .map((entry) => `${entry.name}${entry.archetype ? ` (${entry.archetype})` : ''} ${entry.level}`.trim())
    .join(' / ');
}

function hitDiceSummary(classes: CharacterClassEntry[]): string {
  return classes
    .map((entry) => (entry.hitDie ? `${entry.level}d${entry.hitDie}` : `${entry.level} HD`))
    .join(' + ');
}

function gridIdFor(name: string, classes: CharacterClassEntry[], grids: Record<string, CustomClassGrid>): string {
  const needle = name.toLowerCase();
  const existingClass = classes.find((entry) => entry.name.toLowerCase() === needle);
  if (existingClass?.id) return existingClass.id;
  const grid = Object.entries(grids).find(
    ([, value]) => value.className.replace(/\s*\(unused\)\s*$/i, '').trim().toLowerCase() === needle
  );
  if (grid) return grid[0];
  const used = new Set([...classes.map((entry) => entry.id), ...Object.keys(grids)]);
  let n = 1;
  while (used.has(`class${n}`)) n += 1;
  return `class${n}`;
}

export function syncSharedClassState(
  character: PF1Character,
  input: {
    className?: string;
    archetype?: string;
    level?: number | string;
    hitDie?: number | string;
    skillPointsPerLevel?: number | string;
    classMode?: 'set' | 'add';
  },
  context?: SheetWriteContext
): ClassSyncResult {
  const questions: string[] = [];
  let missingSotRequest: ClassSyncResult['missingSotRequest'] = null;
  const pages = pagesOf(character, context);
  const previousClasses = [...(character.classes || [])];
  const grids: Record<string, CustomClassGrid> = { ...(character.customClassGrids || {}) };
  const requestedName = asString(input.className);
  const requestedLevel = asInt(input.level);
  const requestedDie = asInt(input.hitDie);
  const requestedSp = asInt(input.skillPointsPerLevel);
  const mode = input.classMode || (requestedName ? 'set' : 'add');

  if (requestedDie !== undefined && !HIT_DICE.has(requestedDie)) {
    return {
      character,
      summary: `Hit die d${requestedDie} was not saved`,
      questions: [
        `d${requestedDie} is not a Pathfinder class hit die (d6, d8, d10, or d12). I did not invent one or change the class record.`,
      ],
      missingSotRequest: null,
      classSkillNames: [],
    };
  }

  const primary = previousClasses[0];
  const name = requestedName || primary?.name || character.characterClass || '';
  const id = name ? gridIdFor(name, previousClasses, grids) : primary?.id || Object.keys(grids)[0] || 'class1';
  const previousEntry = previousClasses.find((entry) => entry.id === id || entry.name.toLowerCase() === name.toLowerCase());
  const previousGrid = grids[id];
  const classPage = name ? findClassPage(pages, name) : undefined;
  const pastedRows = classPage ? parsePastedProgressionRows(classPage.plainText || '') : [];
  const pageText = classPage?.plainText || '';
  const sotDie = pageText ? detectHitDie(pageText) : undefined;
  const sotSp = pageText ? detectSkillRanks(pageText) : undefined;
  const hitDie = requestedDie ?? sotDie ?? previousEntry?.hitDie ?? previousGrid?.hitDie ?? character.hpBreakdown?.hitDiceSize ?? 0;
  const level = Math.max(1, Math.min(20, requestedLevel ?? previousEntry?.level ?? (character.level || 1)));
  const skillPoints = requestedSp ?? sotSp ?? previousEntry?.skillPointsPerLevel ?? previousGrid?.skillPointsPerLevel ?? character.classSkillPointsPerLevel ?? 0;
  const classSkillNames = pageText ? classSkillsNamedIn(pageText, character.skills || []) : [];

  if (requestedName && pastedRows.length === 0) {
    missingSotRequest = {
      title: requestedName,
      category: 'Class',
      reason: 'No pasted class progression grid is saved in SOT.',
    };
    questions.push(
      `I saved ${requestedName} on the class list, but there is no pasted progression grid for it. I did not invent a class table. Paste the SRD progression into SOT or open Add Class.`
    );
  }
  if (!hitDie) {
    questions.push(`What hit die does ${name || 'this class'} use? I did not invent one.`);
  }

  const archetype = asString(input.archetype) || previousEntry?.archetype;
  if (asString(input.archetype)) {
    const archetypePage = findArchetypePage(pages, asString(input.archetype) || '');
    if (!archetypePage) {
      missingSotRequest = {
        title: asString(input.archetype) || 'Archetype',
        category: 'Archetype',
        reason: 'That archetype is not in the saved SOT documents.',
      };
      questions.push(
        `${asString(input.archetype)} is not in your SOT documents. I recorded the name and did not invent archetype features or a replacement class table.`
      );
    }
  }

  const entry: CharacterClassEntry = {
    id,
    name: name || previousEntry?.name || '',
    archetype,
    level,
    hitDie: hitDie || 0,
    skillPointsPerLevel: skillPoints,
    babProgression: previousEntry?.babProgression || 'full',
    isFavoredClass: previousEntry?.isFavoredClass ?? previousClasses.length === 0,
    ...(previousEntry?.skillPointsMacro ? { skillPointsMacro: previousEntry.skillPointsMacro } : {}),
  };

  let classes: CharacterClassEntry[];
  if (requestedName && mode === 'set') {
    classes = [entry];
    for (const old of previousClasses) {
      if (old.id === id || old.name.toLowerCase() === entry.name.toLowerCase()) continue;
      const existing = grids[old.id];
      grids[old.id] = {
        id: old.id,
        className: existing?.className?.replace(/\s*\(unused\)\s*$/i, '').trim() || old.name,
        level: existing?.level ?? old.level,
        hitDie: existing?.hitDie ?? old.hitDie,
        skillPointsPerLevel: existing?.skillPointsPerLevel ?? old.skillPointsPerLevel,
        proficiencies: existing?.proficiencies || '',
        rawText: existing?.rawText || '',
        rows: existing?.rows || [],
        classSkillsText: existing?.classSkillsText,
        archetypeId: existing?.archetypeId || old.archetype,
        starterKitName: existing?.starterKitName,
        unused: true,
      };
    }
    for (const [gid, grid] of Object.entries(grids)) {
      const gridName = grid.className.replace(/\s*\(unused\)\s*$/i, '').trim().toLowerCase();
      if (gid !== id && gridName !== entry.name.toLowerCase()) {
        grids[gid] = { ...grid, unused: true };
      }
    }
  } else if (previousEntry) {
    classes = previousClasses.map((old) => (old.id === previousEntry.id ? entry : old));
  } else if (requestedName || requestedLevel !== undefined || requestedDie !== undefined) {
    classes = [...previousClasses, entry];
  } else {
    classes = previousClasses;
  }

  const grid: CustomClassGrid = {
    id,
    className: entry.name,
    level: entry.level,
    hitDie: entry.hitDie,
    skillPointsPerLevel: entry.skillPointsPerLevel,
    proficiencies: previousGrid?.proficiencies || '',
    rawText: pastedRows.length > 0 ? pageText : previousGrid?.rawText || '',
    rows: pastedRows.length > 0 ? pastedRows : previousGrid?.rows || [],
    classSkillsText: previousGrid?.classSkillsText,
    archetypeId: archetype || previousGrid?.archetypeId,
    starterKitName: previousGrid?.starterKitName,
    unused: false,
  };
  grids[id] = grid;

  let skills = character.skills || [];
  if (context?.markClassSkills !== false && classSkillNames.length > 0 && pastedRows.length > 0) {
    const wanted = new Set(classSkillNames.map((skill) => skill.toLowerCase()));
    skills = skills.map((skill) => (wanted.has(skill.name.toLowerCase()) ? { ...skill, isClassSkill: true } : skill));
  } else if (context?.markClassSkills === false && classSkillNames.length > 0 && pastedRows.length > 0) {
    questions.push('Skills are in a blind spot, so the class-skill checkboxes were left unchanged.');
  }

  const totalLevel = classes.reduce((sum, item) => sum + (item.level || 0), 0) || level;
  const primaryDie = classes[0]?.hitDie || hitDie || character.hpBreakdown?.hitDiceSize || 0;

  return {
    character: {
      ...character,
      classes,
      customClassGrids: grids,
      characterClass: classSummary(classes),
      level: totalLevel,
      hitDice: hitDiceSummary(classes),
      classSkillPointsPerLevel: classes[0]?.skillPointsPerLevel ?? character.classSkillPointsPerLevel,
      skills,
      hpBreakdown: {
        ...character.hpBreakdown,
        hitDiceCount: totalLevel,
        hitDiceSize: primaryDie,
      },
    },
    summary: `${classSummary(classes)} | ${hitDiceSummary(classes)}`,
    questions,
    missingSotRequest,
    classSkillNames,
  };
}

function upsertByName<T extends { id: string; name: string }>(
  list: T[] | undefined,
  item: T
): T[] {
  const current = list || [];
  const index = current.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
  if (index < 0) return [...current, item];
  const next = current.slice();
  next[index] = { ...current[index], ...item, id: current[index].id };
  return next;
}

function withoutName<T extends { name: string }>(list: T[] | undefined, name: string): T[] {
  return (list || []).filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
}

function applyScalarIdentity(character: PF1Character, values: Record<string, unknown>): PF1Character {
  const next = { ...character };
  for (const key of ['name', 'player', 'alignment', 'race', 'deity', 'gender', 'height', 'weight', 'eyes', 'hair', 'campaign'] as const) {
    const value = asString(values[key]);
    if (value) (next as unknown as Record<string, unknown>)[key] = value;
  }
  for (const key of ['age', 'currentXP', 'nextLevelXP', 'heroPoints'] as const) {
    const value = asInt(values[key]);
    if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value;
  }
  const size = asString(values.size);
  if (size && SIZES.has(size)) next.size = size as PF1Character['size'];
  if (Array.isArray(values.languages)) {
    next.languages = values.languages.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  }
  return next;
}

function applyCollection(character: PF1Character, update: StructuredSheetUpdate): { character: PF1Character; label: string } | { error: string } {
  const category = update.category || '';
  const add = update.add || {};
  const name = asString(add.name) || asString(update.remove);
  if (update.remove && !name) return { error: 'Name the record to remove.' };

  if (category === 'feats') {
    if (update.remove && name) {
      return {
        character: { ...character, characterFeats: withoutName(character.characterFeats, name) },
        label: `Removed feat ${name}`,
      };
    }
    if (!asString(add.name)) return { error: 'A feat needs a name.' };
    const feat: FeatItem = {
      id: nextId('feat'),
      name: asString(add.name) || 'Feat',
      type: asString(add.type) || 'General',
      prerequisites: asString(add.prerequisites) || 'None',
      summary: asString(add.summary) || asString(add.description) || 'Added from Complete Sheet.',
      description: asString(add.description),
      levelGranted: asInt(add.levelGranted),
    };
    return {
      character: { ...character, characterFeats: upsertByName(character.characterFeats, feat) },
      label: `Feat: ${feat.name}`,
    };
  }

  if (category === 'inventory') {
    if (update.remove && name) {
      return { character: { ...character, inventory: withoutName(character.inventory, name) }, label: `Removed ${name}` };
    }
    if (!asString(add.name)) return { error: 'An inventory item needs a name.' };
    const item: InventoryItem = {
      id: nextId('inv'),
      name: asString(add.name) || 'Item',
      quantity: asInt(add.quantity) ?? 1,
      weight: asNumber(add.weight) ?? 0,
      location: asString(add.location) || 'Backpack',
      storageType:
        asString(add.storageType) === 'worn' || asString(add.storageType) === 'companion'
          ? (asString(add.storageType) as 'worn' | 'companion')
          : 'stored',
      category: (asString(add.category) as InventoryItem['category']) || 'Gear',
      notes: asString(add.notes),
      valueGp: asNumber(add.valueGp),
    };
    return {
      character: { ...character, inventory: upsertByName(character.inventory, item) },
      label: `Inventory: ${item.quantity}x ${item.name}`,
    };
  }

  if (category === 'spellsAndMagic') {
    const next = { ...character };
    const casterLevel = asInt(update.values?.casterLevel);
    if (casterLevel !== undefined) next.casterLevel = casterLevel;
    const key = asString(update.values?.spellKeyAbility);
    if (key && abilityKey(key)) next.spellKeyAbility = abilityKey(key)!;
    if (update.remove && name) {
      next.spells = withoutName(character.spells, name);
      return { character: next, label: `Removed spell ${name}` };
    }
    if (asString(add.name)) {
      const spell: SpellItem = {
        id: nextId('spell'),
        name: asString(add.name) || 'Spell',
        level: asInt(add.level) ?? 0,
        school: asString(add.school) || 'Universal',
        castTime: asString(add.castTime) || '',
        range: asString(add.range) || '',
        duration: asString(add.duration) || '',
        save: asString(add.save) || '',
        spellResistance: asString(add.spellResistance) || '',
        preparedCount: asInt(add.preparedCount) ?? 0,
        isCast: false,
        description: asString(add.description) || '',
      };
      next.spells = upsertByName(character.spells, spell);
      return { character: next, label: `Spell: ${spell.name}` };
    }
    if (casterLevel !== undefined || key) return { character: next, label: 'Spellcasting updated' };
    return { error: 'A spell update needs a name or a caster field.' };
  }

  if (category === 'attacksAndWeapons') {
    const next = { ...character };
    if (asInt(update.values?.baseAttackBonus) !== undefined) next.baseAttackBonus = asInt(update.values?.baseAttackBonus)!;
    if (asInt(update.values?.initMiscMod) !== undefined) next.initMiscMod = asInt(update.values?.initMiscMod)!;
    if (update.remove && name) {
      next.weapons = withoutName(character.weapons, name);
      return { character: next, label: `Removed weapon ${name}` };
    }
    if (asString(add.name)) {
      const categoryName = asString(add.category) === 'Ranged' ? 'Ranged' : 'Melee';
      const weapon: WeaponAttack = {
        id: nextId('wp'),
        name: asString(add.name) || 'Weapon',
        category: categoryName,
        attackBonus: asInt(add.attackBonus),
        damageBonus: asInt(add.damageBonus),
        damageFormula: asString(add.damageFormula) || '1d4',
        critical: asString(add.critical) || '20/x2',
        range: asString(add.range) || (categoryName === 'Ranged' ? '30 ft' : 'Melee'),
        damageType: asString(add.damageType) || '',
        weight: asNumber(add.weight) ?? 0,
        isEquipped: coerceBoolean(add.isEquipped) ?? true,
      };
      next.weapons = upsertByName(character.weapons, weapon);
      return { character: next, label: `Weapon: ${weapon.name}` };
    }
    if (next.baseAttackBonus !== character.baseAttackBonus || next.initMiscMod !== character.initMiscMod) {
      return { character: next, label: 'Attack bonuses updated' };
    }
    return { error: 'A weapon update needs a name or an attack field.' };
  }

  if (category === 'armorAndGear') {
    if (update.remove && name) {
      return { character: { ...character, armor: withoutName(character.armor, name) }, label: `Removed armor ${name}` };
    }
    if (!asString(add.name)) return { error: 'Armor needs a name.' };
    const type = (asString(add.type) as ArmorItem['type']) || 'Light';
    const armor: ArmorItem = {
      id: nextId('ar'),
      name: asString(add.name) || 'Armor',
      type,
      acBonus: asInt(add.acBonus) ?? 0,
      maxDex: asInt(add.maxDex) ?? 0,
      checkPenalty: asInt(add.checkPenalty) ?? 0,
      spellFailure: asInt(add.spellFailure) ?? 0,
      speed30: asInt(add.speed30) ?? 30,
      weight: asNumber(add.weight) ?? 0,
      isEquipped: coerceBoolean(add.isEquipped) ?? true,
      notes: asString(add.notes),
    };
    return { character: { ...character, armor: upsertByName(character.armor, armor) }, label: `Armor: ${armor.name}` };
  }

  if (category === 'actionsAndResources') {
    if (update.resetPools) {
      return {
        character: {
          ...character,
          characterActions: (character.characterActions || []).map((action) =>
            action.hasResourcePool && typeof action.resourceMax === 'number'
              ? { ...action, resourceCurrent: action.resourceMax }
              : action
          ),
          resourceTrackers: (character.resourceTrackers || []).map((tracker) => ({ ...tracker, current: tracker.max })),
        },
        label: 'Reset resource pools',
      };
    }
    const kind = asString(add.kind);
    if (kind === 'resource' || asInt(add.max) !== undefined && !asString(add.description)) {
      if (update.remove && name) {
        return {
          character: { ...character, resourceTrackers: withoutName(character.resourceTrackers, name) },
          label: `Removed resource ${name}`,
        };
      }
      if (!asString(add.name)) return { error: 'A resource needs a name.' };
      const max = asInt(add.max) ?? 0;
      const tracker: ResourceTracker = {
        id: nextId('res'),
        name: asString(add.name) || 'Resource',
        max,
        current: asInt(add.current) ?? max,
        category: 'Class Resource',
        notes: asString(add.notes),
      };
      return {
        character: { ...character, resourceTrackers: upsertByName(character.resourceTrackers, tracker) },
        label: `Resource: ${tracker.name}`,
      };
    }
    if (update.remove && name) {
      return {
        character: { ...character, characterActions: withoutName(character.characterActions, name) },
        label: `Removed action ${name}`,
      };
    }
    if (!asString(add.name)) return { error: 'An action needs a name.' };
    const action: CharacterActionItem = {
      id: nextId('act'),
      name: asString(add.name) || 'Action',
      category: 'Class Ability',
      actionType: (asString(add.actionType) as CharacterActionItem['actionType']) || 'Standard',
      description: asString(add.description) || '',
      shortSummary: asString(add.shortSummary) || asString(add.description) || '',
      hasResourcePool: coerceBoolean(add.hasResourcePool),
      resourceMax: asInt(add.resourceMax),
      resourceCurrent: asInt(add.resourceCurrent) ?? asInt(add.resourceMax),
    };
    return {
      character: { ...character, characterActions: upsertByName(character.characterActions, action) },
      label: `Action: ${action.name}`,
    };
  }

  if (category === 'companionsAndMount') {
    if (update.remove && name) {
      return { character: { ...character, companions: withoutName(character.companions, name) }, label: `Removed ${name}` };
    }
    if (!asString(add.name)) return { error: 'A companion needs a name.' };
    const companionTypes = new Set<CompanionNPC['type']>([
      'Familiar',
      'Animal Companion',
      "Nature's Bond",
      'NPC',
      'Summon',
      'Mount',
      'Eidolon',
      'Other',
    ]);
    const requestedType = asString(add.type) as CompanionNPC['type'];
    const companion: CompanionNPC = {
      id: nextId('comp'),
      name: asString(add.name) || 'Companion',
      type: companionTypes.has(requestedType) ? requestedType : 'Animal Companion',
      relation: asString(add.relation) || 'Companion',
      notes: asString(add.notes),
      hp: asString(add.hp),
      ac: asString(add.ac),
    };
    return {
      character: { ...character, companions: upsertByName(character.companions, companion) },
      label: `Companion: ${companion.name}`,
    };
  }

  if (category === 'journal') {
    if (!asString(add.title) && !asString(add.content)) return { error: 'A journal entry needs a title or text.' };
    const entry: JournalEntry = {
      id: nextId('journal'),
      title: asString(add.title) || 'Session note',
      sessionDate: asString(add.sessionDate) || '',
      location: asString(add.location),
      content: asString(add.content) || '',
      recalledNotes: Array.isArray(add.recalledNotes)
        ? add.recalledNotes.filter((note): note is string => typeof note === 'string')
        : [],
      images: [],
      tags: Array.isArray(add.tags) ? add.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { character: { ...character, journal: [...(character.journal || []), entry] }, label: `Journal: ${entry.title}` };
  }

  if (category === 'customFormulas') {
    if (update.remove && name) {
      return { character: { ...character, customObjects: withoutName(character.customObjects, name) }, label: `Removed formula ${name}` };
    }
    if (!asString(add.name) || !asString(add.formula)) return { error: 'A formula needs a name and a formula.' };
    const formula: CustomFormulaObject = {
      id: nextId('formula'),
      name: asString(add.name) || 'formula',
      formula: asString(add.formula) || '',
      description: asString(add.description) || '',
      category: (asString(add.category) as CustomFormulaObject['category']) || 'logic',
    };
    return {
      character: { ...character, customObjects: upsertByName(character.customObjects, formula) },
      label: `Formula: ${formula.name}`,
    };
  }

  return { error: `No structured add for ${category}.` };
}

function applyFlatValues(character: PF1Character, category: string, values: Record<string, unknown>): PF1Character | null {
  if (category === 'hp' || category === 'armorClass') {
    const next = { ...character };
    for (const key of ['hpCurrent', 'hpTotalMax', 'hpNonlethal', 'hpTemp', 'spellResistance', 'naturalArmorMod', 'deflectionMod', 'dodgeMod', 'acMiscMod'] as const) {
      const value = asInt(values[key]);
      if (value !== undefined && key in next) (next as unknown as Record<string, unknown>)[key] = value;
    }
    for (const key of ['damageReduction', 'fastHealing', 'resistances', 'immunities'] as const) {
      const value = asString(values[key]);
      if (value) (next as unknown as Record<string, unknown>)[key] = value;
    }
    return next;
  }
  if (category === 'saves') {
    const saves = {
      fortitude: { ...character.saves.fortitude },
      reflex: { ...character.saves.reflex },
      will: { ...character.saves.will },
    };
    for (const save of ['fortitude', 'reflex', 'will'] as const) {
      const block = values[save];
      if (block && typeof block === 'object') {
        for (const field of ['base', 'magicMod', 'miscMod', 'tempMod'] as const) {
          const value = asInt((block as Record<string, unknown>)[field]);
          if (value !== undefined) saves[save][field] = value;
        }
      }
      for (const field of ['base', 'magicMod', 'miscMod', 'tempMod'] as const) {
        const value = asInt(values[`${save}${field.charAt(0).toUpperCase()}${field.slice(1)}`]);
        if (value !== undefined) saves[save][field] = value;
      }
    }
    return { ...character, saves };
  }
  if (category === 'conditions') {
    const conditions = { ...character.conditions };
    let changed = false;
    for (const key of CONDITION_KEYS) {
      if (key in values) {
        const flag = coerceBoolean(values[key]);
        if (flag !== undefined) {
          conditions[key] = flag;
          changed = true;
        }
      }
    }
    return changed ? { ...character, conditions } : null;
  }
  if (category === 'currency') {
    const currency = { ...character.currency };
    let changed = false;
    for (const key of ['cp', 'sp', 'gp', 'pp'] as const) {
      const value = asInt(values[key]);
      if (value !== undefined) {
        currency[key] = value;
        changed = true;
      }
    }
    return changed ? { ...character, currency } : null;
  }
  if (category === 'bioAndProfile') {
    const biography = { ...character.biography };
    let changed = false;
    for (const key of ['description', 'personality', 'traits', 'flaws', 'allies', 'enemies', 'notes'] as const) {
      const value = asString(values[key]);
      if (value) {
        biography[key] = value;
        changed = true;
      }
    }
    return changed ? { ...character, biography } : null;
  }
  if (category === 'notes') {
    const next = { ...character };
    const scratch = asString(values.scratchpad);
    if (scratch !== undefined) {
      next.characterBio = {
        portraits: character.characterBio?.portraits || [],
        currentPortraitIndex: character.characterBio?.currentPortraitIndex || 0,
        bioSections: character.characterBio?.bioSections || [],
        skin: character.characterBio?.skin || '',
        ...character.characterBio,
        scratchpad: scratch,
      };
    }
    const rollup = asString(values.rollup);
    if (rollup) next.rollupNotes = { content: rollup, isRolledUp: character.rollupNotes?.isRolledUp ?? false };
    const bioNotes = asString(values.notes);
    if (bioNotes) next.biography = { ...character.biography, notes: bioNotes };
    return next;
  }
  if (category === 'coreIdentity') return applyScalarIdentity(character, values);
  if (category === 'attacksAndWeapons') {
    const next = { ...character };
    const bab = asInt(values.baseAttackBonus);
    const init = asInt(values.initMiscMod);
    if (bab !== undefined) next.baseAttackBonus = bab;
    if (init !== undefined) next.initMiscMod = init;
    return next;
  }
  if (category === 'spellsAndMagic') {
    const next = { ...character };
    const casterLevel = asInt(values.casterLevel);
    if (casterLevel !== undefined) next.casterLevel = casterLevel;
    const key = asString(values.spellKeyAbility);
    if (key && abilityKey(key)) next.spellKeyAbility = abilityKey(key)!;
    return next;
  }
  return null;
}

const FIELD_CATEGORIES = new Set<keyof AIModuleSettings['allowedFields']>([
  'hp',
  'conditions',
  'currency',
  'inventory',
  'notes',
  'journal',
  'customFormulas',
  'coreIdentity',
  'abilities',
  'armorClass',
  'saves',
  'attacksAndWeapons',
  'armorAndGear',
  'actionsAndResources',
  'feats',
  'skills',
  'spellsAndMagic',
  'companionsAndMount',
  'bioAndProfile',
]);

function isFieldCategory(value: string): value is keyof AIModuleSettings['allowedFields'] {
  return FIELD_CATEGORIES.has(value as keyof AIModuleSettings['allowedFields']);
}

export function applyStructuredSheetUpdates(
  character: PF1Character,
  rawUpdates: unknown,
  permissions: AIModuleSettings['allowedFields'],
  context?: SheetWriteContext
): StructuredWriteResult {
  const updates = Array.isArray(rawUpdates) ? rawUpdates : rawUpdates && typeof rawUpdates === 'object' ? [rawUpdates] : [];
  let current = character;
  const appliedLabels: string[] = [];
  const blocked: StructuredWriteResult['blocked'] = [];
  const rejected: StructuredWriteResult['rejected'] = [];
  const questions: string[] = [];
  let missingSotRequest: StructuredWriteResult['missingSotRequest'] = null;
  let abilityAttempted = false;

  const allowed = (category: keyof AIModuleSettings['allowedFields']) => (permissions?.[category] ?? true) !== false;

  for (const raw of updates) {
    if (!raw || typeof raw !== 'object') continue;
    const update = raw as StructuredSheetUpdate;
    if (containsSecretKey(update)) {
      rejected.push({
        label: 'Refused secret-like field',
        details: 'That update names a secret, token, password, or API key. It was not written onto the character.',
      });
      continue;
    }
    const category = typeof update.category === 'string' ? update.category : '';
    if (!isFieldCategory(category)) {
      rejected.push({
        label: 'Unknown sheet field',
        details: `"${category || 'missing category'}" is not an authorized sheet field, so nothing was written.`,
      });
      continue;
    }
    if (!allowed(category)) {
      blocked.push({
        label: `${category} is in a blind spot`,
        details: `${category} is unauthorized. That part of the character was left unchanged.`,
      });
      continue;
    }

    if (category === 'skills') {
      const result = applySkillWrite(current, update);
      if (!result.saved) {
        rejected.push({ label: result.label, details: result.details });
        if (result.question) questions.push(result.question);
      } else {
        current = result.character;
        appliedLabels.push(result.label);
      }
      continue;
    }

    if (category === 'abilities') {
      abilityAttempted = true;
      const result = applyAbilityWrite(current, update, context);
      if (result.blockedModule) {
        blocked.push({ label: result.label, details: result.details });
      } else if (!result.saved) {
        rejected.push({ label: result.label, details: result.details });
        if (result.question) questions.push(result.question);
      } else {
        current = result.character;
        appliedLabels.push(result.label);
      }
      continue;
    }

    const classInput = {
      className: update.className ?? asString(update.values?.className),
      archetype: update.archetype ?? asString(update.values?.archetype),
      level: update.level ?? (update.values ? asInt(update.values.level) : undefined),
      hitDie: update.hitDie ?? (update.values ? asInt(update.values.hitDie) : undefined),
      skillPointsPerLevel: update.skillPointsPerLevel,
      classMode: update.classMode,
    };
    const classTouch =
      classInput.className !== undefined ||
      classInput.level !== undefined ||
      classInput.hitDie !== undefined ||
      classInput.archetype !== undefined ||
      classInput.skillPointsPerLevel !== undefined;
    if (classTouch && (category === 'coreIdentity' || category === 'hp')) {
      const synced = syncSharedClassState(current, classInput, {
        ...context,
        markClassSkills: context?.markClassSkills !== false && allowed('skills'),
      });
      const refused = synced.character === current && /was not saved/i.test(synced.summary);
      if (refused) {
        rejected.push({ label: synced.summary, details: synced.questions.join(' ') || synced.summary });
        questions.push(...synced.questions);
      } else {
        current = synced.character;
        appliedLabels.push(synced.summary);
        questions.push(...synced.questions);
        if (synced.missingSotRequest && !missingSotRequest) missingSotRequest = synced.missingSotRequest;
      }
    }

    if (update.values && Object.keys(update.values).length > 0) {
      const flat = applyFlatValues(current, category, update.values);
      if (flat) {
        current = flat;
        appliedLabels.push(update.label || `${category} fields`);
      }
    }

    if (update.appendNote || update.setNote) {
      const scratch = update.setNote
        ? update.setNote
        : `${current.characterBio?.scratchpad || ''}\n- ${update.appendNote}`.trim();
      current = {
        ...current,
        characterBio: {
          portraits: current.characterBio?.portraits || [],
          currentPortraitIndex: current.characterBio?.currentPortraitIndex || 0,
          bioSections: current.characterBio?.bioSections || [],
          skin: current.characterBio?.skin || '',
          ...current.characterBio,
          scratchpad: scratch,
        },
      };
      appliedLabels.push('Notes updated');
    }

    if (update.add || update.remove || update.resetPools) {
      const collection = applyCollection(current, update);
      if ('error' in collection) {
        if (update.add || update.remove || update.resetPools) {
          rejected.push({ label: `${category} update skipped`, details: collection.error });
        }
      } else {
        current = collection.character;
        appliedLabels.push(collection.label);
      }
    }
  }

  return {
    character: current,
    appliedLabels,
    blocked,
    rejected,
    questions,
    missingSotRequest,
    abilityAttempted,
  };
}
