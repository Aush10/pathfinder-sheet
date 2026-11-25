import { createBlankCharacter } from '../data/defaultCharacter';
import { EMPTY_SOT_CATALOGUE, rehydrateSrdPagesFromHost, setActiveHostSrdOwner } from '../engine/sotEngine';
import type {
  AbilityName,
  ActionDirectoryTab,
  CharacterActionItem,
  JournalEntry,
  PF1Character,
  ResourceTracker,
  SpellProgressionKind,
  SpellProgressionRow,
  SpellProgressionTable,
  SpellProgressionTables,
  SpellSlotLevel,
} from '../types/character';
import type { LoadedCharacter, StorageAdapter } from './types';

export const AUTOSAVE_DEBOUNCE_MS = 2500;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!FORBIDDEN_KEYS.has(key)) copy[key] = item;
  }
  return copy;
}

function arrayOr<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function mergeRecord<T extends object>(baseline: T, value: unknown): T {
  return { ...baseline, ...record(value) } as T;
}

export const SPELL_BOOK_JOURNAL_TITLE = 'Spell Book';
export const SPELL_BOOK_PAGE_COUNT = 9;
export const SPELL_SLOT_STEPPER_MACRO = '-1';
export const SPELL_BOOK_TAG = 'spell-book';
export const SPELL_KNOWN_REMAINING_TAB_ID = 'spell-known-remaining';

const SPELL_TABLE_LEVELS = 20;
const SPELL_CIRCLE_MAX = 9;
const MAX_ID_LENGTH = 120;

export function spellBookPageId(level: number): string {
  return `spell-book-${level}`;
}

export function spellSlotResourceId(level: number): string {
  return `spell-slot-level-${level}`;
}

export function spellSlotActionId(level: number): string {
  return `spell-slot-action-${level}`;
}

export function spellSlotStepperScopeId(level: number): string {
  return `spell-slot-${level}`;
}

export function spellKnownTabId(level: number): string {
  return `spell-known-${level}`;
}

function ordinal(level: number): string {
  const remainder = level % 10;
  const tens = level % 100;
  if (tens >= 11 && tens <= 13) return `${level}th`;
  if (remainder === 1) return `${level}st`;
  if (remainder === 2) return `${level}nd`;
  if (remainder === 3) return `${level}rd`;
  return `${level}th`;
}

function cappedId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return undefined;
  if (FORBIDDEN_KEYS.has(trimmed)) return undefined;
  return trimmed;
}

function parseSlotCount(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed || /^[-–—]+$/.test(trimmed)) return undefined;
  const match = /^(\d+)/.exec(trimmed);
  if (!match) return undefined;
  return Number(match[1]);
}

function columnPrefix(kind: SpellProgressionKind): string {
  return kind === 'spells-per-day' ? 'spd_' : 'sk_';
}

function asKind(value: unknown): SpellProgressionKind | undefined {
  return value === 'spells-per-day' || value === 'spells-known' ? value : undefined;
}

function normalizeProgressionTable(value: unknown, expected: SpellProgressionKind): SpellProgressionTable | undefined {
  const raw = record(value);
  const kind = asKind(raw.kind) || expected;
  if (kind !== expected) return undefined;
  const prefix = columnPrefix(kind);
  const columns = arrayOr<unknown>(raw.columns, [])
    .map((column) => (typeof column === 'string' ? column.trim() : ''))
    .filter((column) => column.startsWith(prefix) && column.length <= 16)
    .slice(0, SPELL_CIRCLE_MAX + 1);
  if (columns.length === 0) return undefined;

  const rowsByLevel = new Map<number, SpellProgressionRow>();
  for (const item of arrayOr(raw.rows, [])) {
    const row = record(item);
    const level = typeof row.level === 'number' && Number.isInteger(row.level) ? row.level : 0;
    if (level < 1 || level > SPELL_TABLE_LEVELS) continue;
    const valuesRecord = record(row.values);
    const values: Record<string, string> = {};
    for (const column of columns) {
      const cell = valuesRecord[column];
      values[column] = typeof cell === 'string' ? cell.slice(0, 32) : '';
    }
    rowsByLevel.set(level, { level, values });
  }

  const rows: SpellProgressionRow[] = [];
  for (let level = 1; level <= SPELL_TABLE_LEVELS; level += 1) {
    rows.push(rowsByLevel.get(level) || { level, values: Object.fromEntries(columns.map((column) => [column, ''])) });
  }

  const table: SpellProgressionTable = { kind, columns, rows };
  const sourceTableId = cappedId(raw.sourceTableId);
  const sourceDocumentId = cappedId(raw.sourceDocumentId);
  if (sourceTableId) table.sourceTableId = sourceTableId;
  if (sourceDocumentId) table.sourceDocumentId = sourceDocumentId;
  return table;
}

/** Drops hostile keys and pads to 20 rows so old saves stay valid without spellTables. */
export function normalizeSpellTables(value: unknown): Partial<SpellProgressionTables> | undefined {
  const raw = record(value);
  const spellsPerDay = normalizeProgressionTable(raw.spellsPerDay, 'spells-per-day');
  const spellsKnown = normalizeProgressionTable(raw.spellsKnown, 'spells-known');
  if (!spellsPerDay && !spellsKnown) return undefined;
  return {
    ...(spellsPerDay ? { spellsPerDay } : {}),
    ...(spellsKnown ? { spellsKnown } : {}),
  };
}

export function characterHasStructuredCasting(character: Pick<PF1Character, 'spellTables'>): boolean {
  return Boolean(character.spellTables?.spellsPerDay || character.spellTables?.spellsKnown);
}

export function getPersistedSpellProgressionTable(
  character: Pick<PF1Character, 'spellTables'>,
  kind: SpellProgressionKind,
): SpellProgressionTable | undefined {
  return kind === 'spells-per-day' ? character.spellTables?.spellsPerDay : character.spellTables?.spellsKnown;
}

export function getPersistedSpellProgressionRow(
  character: Pick<PF1Character, 'spellTables'>,
  kind: SpellProgressionKind,
  level: number,
): SpellProgressionRow | undefined {
  if (!Number.isInteger(level) || level < 1 || level > SPELL_TABLE_LEVELS) return undefined;
  return getPersistedSpellProgressionTable(character, kind)?.rows.find((row) => row.level === level);
}

export function formatSpellTablesForCompleteSheet(character: Pick<PF1Character, 'spellTables' | 'level'>): string {
  if (!characterHasStructuredCasting(character)) return '';
  const level = Math.min(SPELL_TABLE_LEVELS, Math.max(1, Number.isInteger(character.level) ? character.level : 1));
  const parts = [`Loaded spell tables (structured; not SOT prose):`];
  for (const kind of ['spells-per-day', 'spells-known'] as SpellProgressionKind[]) {
    const table = getPersistedSpellProgressionTable(character, kind);
    if (!table) continue;
    const row = getPersistedSpellProgressionRow(character, kind, level);
    const cells = table.columns.map((column) => `${column}=${row?.values[column] || '—'}`).join(' ');
    parts.push(`- ${kind} columns ${table.columns.join(', ')}; at level ${level}: ${cells}`);
  }
  return parts.join('\n');
}

export function getSpellSlotCastBinding(
  character: Pick<PF1Character, 'characterActions' | 'resourceTrackers' | 'macaroniStepperStore'>,
  spellLevel: number,
): { spellLevel: number; actionId?: string; resourceId?: string; stepperMacro: string; stepperScopeId: string; bangIds: string[] } | undefined {
  if (!Number.isInteger(spellLevel) || spellLevel < 0 || spellLevel > SPELL_CIRCLE_MAX) return undefined;
  const actionId = spellSlotActionId(spellLevel);
  const resourceId = spellSlotResourceId(spellLevel);
  const action = (character.characterActions || []).find((item) => item.id === actionId);
  const tracker = (character.resourceTrackers || []).find((item) => item.id === resourceId);
  if (!action && !tracker) return undefined;
  const stepperScopeId = spellSlotStepperScopeId(spellLevel);
  const bangIds = Object.keys(character.macaroniStepperStore || {}).filter((key) => key.startsWith(`${stepperScopeId}::`));
  return {
    spellLevel,
    actionId: action?.id,
    resourceId: tracker?.id,
    stepperMacro: action?.stepperMacro || SPELL_SLOT_STEPPER_MACRO,
    stepperScopeId,
    bangIds,
  };
}

function blankSpellBookPage(level: number): JournalEntry {
  return {
    id: spellBookPageId(level),
    title: `${ordinal(level)}-level spells`,
    sessionDate: '',
    content: '',
    recalledNotes: [],
    images: [],
    tags: [SPELL_BOOK_TAG],
    createdAt: 0,
    updatedAt: 0,
  };
}

function ensureSpellBookPages(journal: JournalEntry[]): JournalEntry[] {
  const byId = new Map(journal.map((entry) => [entry.id, entry]));
  const pages = [...journal];
  for (let level = 1; level <= SPELL_BOOK_PAGE_COUNT; level += 1) {
    const id = spellBookPageId(level);
    if (byId.has(id)) continue;
    pages.push(blankSpellBookPage(level));
  }
  return pages;
}

function slotName(level: number): string {
  return `${level} level spell slots`;
}

function ensureSpellSlotBars(character: PF1Character): {
  resourceTrackers: ResourceTracker[];
  characterActions: CharacterActionItem[];
  spellSlots: SpellSlotLevel[];
  macaroniStepperStore: Record<string, number>;
} {
  const table = character.spellTables?.spellsPerDay;
  const classLevel = Math.min(SPELL_TABLE_LEVELS, Math.max(1, Number.isInteger(character.level) ? character.level : 1));
  const row = table ? getPersistedSpellProgressionRow(character, 'spells-per-day', classLevel) : undefined;
  const trackers = [...(character.resourceTrackers || [])];
  const actions = [...(character.characterActions || [])];
  const spellSlots = [...(character.spellSlots || [])];
  const macaroniStepperStore = { ...(character.macaroniStepperStore || {}) };

  if (table && row) {
    for (const column of table.columns) {
      const match = /^spd_(\d+)$/.exec(column);
      if (!match) continue;
      const spellLevel = Number(match[1]);
      if (spellLevel < 0 || spellLevel > SPELL_CIRCLE_MAX) continue;
      const count = parseSlotCount(row.values[column] || '');
      if (count === undefined) continue;

      const resourceId = spellSlotResourceId(spellLevel);
      const actionId = spellSlotActionId(spellLevel);
      const trackerIndex = trackers.findIndex((item) => item.id === resourceId);
      if (trackerIndex >= 0) {
        const existingTracker = trackers[trackerIndex];
        trackers[trackerIndex] = {
          ...existingTracker,
          max: count,
          current: Math.max(0, Math.min(count, existingTracker.current)),
          name: slotName(spellLevel),
          category: 'Spell Slot',
        };
      } else {
        trackers.push({
          id: resourceId,
          name: slotName(spellLevel),
          current: count,
          max: count,
          category: 'Spell Slot',
          macroKey: `SPELL_SLOT_${spellLevel}`,
        });
      }

      const actionIndex = actions.findIndex((item) => item.id === actionId);
      if (actionIndex >= 0) {
        const existingAction = actions[actionIndex];
        actions[actionIndex] = {
          ...existingAction,
          name: slotName(spellLevel),
          entryType: 'resource',
          category: 'Spells',
          hasResourcePool: true,
          resourceMax: count,
          resourceCurrent: Math.max(0, Math.min(count, existingAction.resourceCurrent ?? count)),
          linkedResourceId: resourceId,
          spellLevel,
          stepperMacro: existingAction.stepperMacro || SPELL_SLOT_STEPPER_MACRO,
        };
      } else {
        actions.push({
          id: actionId,
          name: slotName(spellLevel),
          entryType: 'resource',
          category: 'Spells',
          description: '',
          stepperMacro: SPELL_SLOT_STEPPER_MACRO,
          hasResourcePool: true,
          resourceCurrent: count,
          resourceMax: count,
          linkedResourceId: resourceId,
          spellLevel,
          macroKey: `SPELL_SLOT_${spellLevel}`,
        });
      }

      const slotIndex = spellSlots.findIndex((item) => item.level === spellLevel);
      if (slotIndex >= 0) {
        spellSlots[slotIndex] = { ...spellSlots[slotIndex], spellsPerDay: count };
      } else {
        spellSlots.push({
          level: spellLevel,
          saveDC: 0,
          spellsPerDay: count,
          bonusSpells: 0,
          spellsKnown: 0,
          usedSlots: 0,
        });
      }

      const action = actions.find((item) => item.id === actionId);
      if (action?.stepperMacro?.includes('!')) {
        const bangId = `${spellSlotStepperScopeId(spellLevel)}::bang-1`;
        if (!(bangId in macaroniStepperStore)) macaroniStepperStore[bangId] = 0;
      }
    }
  }

  return { resourceTrackers: trackers, characterActions: actions, spellSlots, macaroniStepperStore };
}

function ensureSpellKnownTabs(character: PF1Character): ActionDirectoryTab[] {
  const tabs = [...(character.actionDirectoryTabs || [])];
  const table = character.spellTables?.spellsKnown;
  if (!table) return tabs;
  const classLevel = Math.min(SPELL_TABLE_LEVELS, Math.max(1, Number.isInteger(character.level) ? character.level : 1));
  const row = getPersistedSpellProgressionRow(character, 'spells-known', classLevel);
  const ensureTab = (id: string, name: string) => {
    if (!tabs.some((tab) => tab.id === id)) tabs.push({ id, name, entryIds: [] });
  };
  for (const column of table.columns) {
    const match = /^sk_(\d+)$/.exec(column);
    if (!match) continue;
    const spellLevel = Number(match[1]);
    if (spellLevel < 1 || spellLevel > SPELL_CIRCLE_MAX) continue;
    if (row && parseSlotCount(row.values[column] || '') === undefined) continue;
    ensureTab(spellKnownTabId(spellLevel), `${ordinal(spellLevel)}-level spells known`);
  }
  ensureTab(SPELL_KNOWN_REMAINING_TAB_ID, 'Remaining spells');
  return tabs;
}

/** Idempotent persist of Spell Book pages, slot bars, and known-spell tabs. */
export function applySpellcastingPersist(character: PF1Character): PF1Character {
  if (!characterHasStructuredCasting(character)) return character;
  const bars = ensureSpellSlotBars(character);
  return {
    ...character,
    journal: ensureSpellBookPages(character.journal || []),
    resourceTrackers: bars.resourceTrackers,
    characterActions: bars.characterActions,
    spellSlots: bars.spellSlots,
    macaroniStepperStore: bars.macaroniStepperStore,
    actionDirectoryTabs: ensureSpellKnownTabs({ ...character, ...bars }),
  };
}

/** Attach CX7-collected tables, then persist Spell Book / slot-bar connections. */
export function persistCollectedSpellTables(
  character: PF1Character,
  tables: Partial<SpellProgressionTables>,
): PF1Character {
  const merged = normalizeSpellTables({
    ...(character.spellTables || {}),
    ...tables,
  });
  return applySpellcastingPersist({
    ...character,
    ...(merged ? { spellTables: merged } : {}),
  });
}

/**
 * Makes legacy imports and folder saves safe for the live sheet to render.
 *
 * The folder adapter validates integrity and JSON safety; this is the UI
 * compatibility layer that restores fields introduced by later releases from
 * a fresh blank-sheet baseline.  It deliberately does not use the Valerius
 * demo as a fallback, so an incomplete save cannot repopulate a new character
 * with sample data.
 */
export function normalizeCharacter(input: unknown): PF1Character {
  const blank = createBlankCharacter();
  const source = record(input);
  const sourceAbilities = record(source.abilities);
  const sourceSaves = record(source.saves);
  const sourceCharacterBio = record(source.characterBio);
  const sourceProfile = record(source.profileData);
  const sourceInstalledModules = record(source.installedModules);
  const sourceAiSettings = record(sourceInstalledModules.aiSettings);
  const sourceSot = record(source.sotCatalogue);
  const sourceMemory = record(source.memoryBank);
  const rawMacaroniStepperStore = record(source.macaroniStepperStore);
  const macaroniStepperStore = Object.fromEntries(
    Object.entries(rawMacaroniStepperStore)
      .filter(([key, value]) => key.length > 0 && key.length <= 300 && typeof value === 'number' && Number.isFinite(value) && value >= 0)
      .map(([key, value]) => [key, Math.floor(value as number)])
  );

  const abilities = {} as PF1Character['abilities'];
  (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as AbilityName[]).forEach((ability) => {
    abilities[ability] = mergeRecord(blank.abilities[ability], sourceAbilities[ability]);
  });

  const rawDeathSaves = Array.isArray(source.deathSaves) ? source.deathSaves : blank.deathSaves;
  const rawPinnedFacts = Array.isArray(sourceMemory.pinnedFacts)
    ? sourceMemory.pinnedFacts.filter((fact): fact is string => typeof fact === 'string')
    : blank.memoryBank?.pinnedFacts || [];
  const summary = typeof sourceMemory.summary === 'string' ? sourceMemory.summary.slice(0, 8_000) : undefined;
  const updatedAt = typeof sourceMemory.updatedAt === 'number' && Number.isFinite(sourceMemory.updatedAt)
    ? sourceMemory.updatedAt
    : undefined;

  const spellTables = normalizeSpellTables(source.spellTables);

  const normalized: PF1Character = {
    ...blank,
    ...source,
    abilities,
    classes: arrayOr(source.classes, blank.classes),
    deathSaves: [Boolean(rawDeathSaves[0]), Boolean(rawDeathSaves[1]), Boolean(rawDeathSaves[2])],
    hpBreakdown: mergeRecord(blank.hpBreakdown, source.hpBreakdown),
    combatTracker: mergeRecord(blank.combatTracker, source.combatTracker),
    buffBox: mergeRecord(blank.buffBox, source.buffBox),
    customBuffs: arrayOr(source.customBuffs, blank.customBuffs || []),
    saves: {
      fortitude: mergeRecord(blank.saves.fortitude, sourceSaves.fortitude),
      reflex: mergeRecord(blank.saves.reflex, sourceSaves.reflex),
      will: mergeRecord(blank.saves.will, sourceSaves.will),
    },
    weapons: arrayOr(source.weapons, blank.weapons),
    armor: arrayOr(source.armor, blank.armor),
    featsAndAbilities: arrayOr(source.featsAndAbilities, blank.featsAndAbilities),
    skills: arrayOr(source.skills, blank.skills),
    inventory: arrayOr(source.inventory, blank.inventory),
    droppedBags: mergeRecord(blank.droppedBags || {}, source.droppedBags),
    currency: mergeRecord(blank.currency, source.currency),
    languages: arrayOr(source.languages, blank.languages),
    spellSlots: arrayOr(source.spellSlots, blank.spellSlots),
    spells: arrayOr(source.spells, blank.spells),
    conditions: mergeRecord(blank.conditions, source.conditions),
    customObjects: arrayOr(source.customObjects, blank.customObjects),
    biography: mergeRecord(blank.biography, source.biography),
    stepperRules: arrayOr(source.stepperRules, blank.stepperRules || []),
    macaroniStepperStore,
    xdxMacros: arrayOr(source.xdxMacros, blank.xdxMacros || []),
    resourceTrackers: arrayOr(source.resourceTrackers, blank.resourceTrackers || []),
    characterActions: arrayOr(source.characterActions, blank.characterActions || []),
    customAbilityTypes: arrayOr(source.customAbilityTypes, blank.customAbilityTypes || []),
    actionDirectoryTabs: arrayOr(source.actionDirectoryTabs, blank.actionDirectoryTabs || []),
    characterFeats: arrayOr(source.characterFeats, blank.characterFeats || []),
    generatedOddFeatLevels: arrayOr(source.generatedOddFeatLevels, blank.generatedOddFeatLevels || []),
    characterBio: {
      ...mergeRecord(blank.characterBio || { scratchpad: '', currentPortraitIndex: 0, portraits: [], bioSections: [] }, sourceCharacterBio),
      scratchpad: typeof sourceCharacterBio.scratchpad === 'string' ? sourceCharacterBio.scratchpad : blank.characterBio?.scratchpad || '',
      currentPortraitIndex: typeof sourceCharacterBio.currentPortraitIndex === 'number' ? sourceCharacterBio.currentPortraitIndex : blank.characterBio?.currentPortraitIndex || 0,
      portraits: arrayOr(sourceCharacterBio.portraits, blank.characterBio?.portraits || []),
      bioSections: arrayOr(sourceCharacterBio.bioSections, blank.characterBio?.bioSections || []),
    },
    profileData: {
      ...mergeRecord(blank.profileData || {}, sourceProfile),
      customFields: arrayOr(sourceProfile.customFields, blank.profileData?.customFields || []),
    },
    magicItemSlots: mergeRecord(blank.magicItemSlots || {}, source.magicItemSlots),
    companions: arrayOr(source.companions, blank.companions || []),
    journal: arrayOr(source.journal, blank.journal || []),
    installedModules: {
      ...mergeRecord(blank.installedModules || {}, sourceInstalledModules),
      aiSettings: {
        isInstalled: typeof sourceAiSettings.isInstalled === 'boolean' ? sourceAiSettings.isInstalled : blank.installedModules?.aiSettings?.isInstalled || false,
        ...mergeRecord(blank.installedModules?.aiSettings || {}, sourceAiSettings),
        allowedFields: {
          ...(blank.installedModules?.aiSettings?.allowedFields || {
            hp: true,
            conditions: true,
            currency: true,
            inventory: true,
            notes: true,
            journal: true,
            customFormulas: true,
          }),
          ...record(sourceAiSettings.allowedFields),
        },
        allowedModules: {
          ...(blank.installedModules?.aiSettings?.allowedModules || {
            stepper: true,
            buffBox: true,
            dslStudio: true,
            addClass: true,
            journalVoice: true,
            journalSketch: true,
            scratchpad: true,
          }),
          ...record(sourceAiSettings.allowedModules),
        },
      },
    },
    workspaceLibraryImages: arrayOr(source.workspaceLibraryImages, blank.workspaceLibraryImages || []),
    uiMakePresets: arrayOr(source.uiMakePresets, blank.uiMakePresets || []),
    memoryBank: {
      schemaVersion: 1,
      pinnedFacts: rawPinnedFacts.slice(0, 100).map((fact) => fact.slice(0, 1_000)),
      ...(summary ? { summary } : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    },
  };

  if (spellTables) normalized.spellTables = spellTables;
  else delete normalized.spellTables;

  if (Object.keys(sourceSot).length > 0) {
    normalized.sotCatalogue = {
      weblinks: arrayOr(sourceSot.weblinks, []),
      overridePages: arrayOr(sourceSot.overridePages, []),
      macaroniSuggestions: arrayOr(sourceSot.macaroniSuggestions, []),
    };
  } else {
    normalized.sotCatalogue = {
      weblinks: [...EMPTY_SOT_CATALOGUE.weblinks],
      overridePages: [...EMPTY_SOT_CATALOGUE.overridePages],
      macaroniSuggestions: [...EMPTY_SOT_CATALOGUE.macaroniSuggestions],
    };
  }

  return applySpellcastingPersist(normalized);
}

export function blankCharacterWithEmptySot(): PF1Character {
  const blank = createBlankCharacter();
  return {
    ...blank,
    sotCatalogue: {
      weblinks: [...EMPTY_SOT_CATALOGUE.weblinks],
      overridePages: [...EMPTY_SOT_CATALOGUE.overridePages],
      macaroniSuggestions: [...EMPTY_SOT_CATALOGUE.macaroniSuggestions],
    },
  };
}

export type CrashPreference =
  | { action: 'use-saved' }
  | { action: 'use-crash' }
  | { action: 'ask'; crash: LoadedCharacter };

/**
 * Prefer Crash only when it is the same characterId and newer than the named save.
 * An older crash or a crash for a different character never replaces the named save.
 */
export function evaluateCrashPreference(
  crash: LoadedCharacter | null,
  saved: LoadedCharacter | null,
): CrashPreference {
  if (!crash) return { action: 'use-saved' };
  if (!saved) return { action: 'use-crash' };
  if (crash.sha256 && saved.sha256 && crash.sha256 === saved.sha256) return { action: 'use-saved' };
  if (crash.characterId !== saved.characterId) return { action: 'use-saved' };
  const crashAt = Date.parse(crash.savedAt);
  const savedAt = Date.parse(saved.savedAt);
  if (!Number.isFinite(crashAt) || !Number.isFinite(savedAt) || crashAt <= savedAt) {
    return { action: 'use-saved' };
  }
  return { action: 'ask', crash };
}

export function createSerializedWriteQueue<T, R>(write: (value: T) => Promise<R>): {
  enqueue: (value: T) => Promise<R | undefined>;
  isInFlight: () => boolean;
} {
  let inFlight = false;
  let pending: { value: T; resolvers: Array<(result: R | undefined) => void> } | undefined;

  async function drain(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
      while (pending) {
        const job = pending;
        pending = undefined;
        try {
          const result = await write(job.value);
          for (const resolve of job.resolvers) resolve(result);
        } catch {
          for (const resolve of job.resolvers) resolve(undefined);
        }
      }
    } finally {
      inFlight = false;
      if (pending) void drain();
    }
  }

  return {
    enqueue(value: T) {
      return new Promise<R | undefined>((resolve) => {
        if (pending) {
          pending.value = value;
          pending.resolvers.push(resolve);
        } else {
          pending = { value, resolvers: [resolve] };
        }
        void drain();
      });
    },
    isInFlight: () => inFlight,
  };
}

export interface PendingCrashSnapshot {
  character: PF1Character;
  characterId: string;
  savedAt: string;
}

export interface RestoreSheetResult {
  character: PF1Character | null;
  recoveredFromCrash: boolean;
  characterId?: string;
  pendingCrash?: PendingCrashSnapshot;
}

function finishRestore(
  loaded: LoadedCharacter,
  recoveredFromCrash: boolean,
  pendingCrash?: PendingCrashSnapshot,
): RestoreSheetResult {
  const character = rehydrateSrdPagesFromHost(normalizeCharacter(loaded.character), loaded.characterId);
  setActiveHostSrdOwner(loaded.characterId);
  return {
    character,
    recoveredFromCrash,
    characterId: loaded.characterId,
    ...(pendingCrash ? { pendingCrash } : {}),
  };
}

/**
 * Restores the on-screen sheet from the selected storage tree.
 * Named saves win unless Crash is the same character and newer; that case asks first.
 */
export async function restoreSheetFromStorage(adapter: StorageAdapter): Promise<RestoreSheetResult> {
  const crashRes = await adapter.loadCrash();
  const crash = crashRes.ok ? crashRes.character : null;
  const activeRes = await adapter.getActiveCharacter();
  const active = activeRes.ok ? activeRes.activeCharacter : null;

  let saved: LoadedCharacter | null = null;
  if (active) {
    const listed = await adapter.listCharacters(active.player);
    const stillPresent = listed.ok && listed.characters.some((entry) => entry.name === active.name);
    if (stillPresent) {
      const loaded = await adapter.loadCharacter(active.player, active.name);
      if (loaded.ok) saved = loaded;
    }
  }

  const preference = evaluateCrashPreference(crash, saved);

  if (preference.action === 'use-saved' && crash && saved && crash.sha256 && saved.sha256 && crash.sha256 === saved.sha256) {
    try {
      await adapter.dismissCrash();
    } catch {
      // Matching crash leftovers are non-authoritative.
    }
  }

  if (preference.action === 'ask' && saved && crash) {
    return finishRestore(saved, false, {
      character: rehydrateSrdPagesFromHost(normalizeCharacter(crash.character), crash.characterId),
      characterId: crash.characterId,
      savedAt: crash.savedAt,
    });
  }

  if (preference.action === 'use-crash' && crash) {
    return finishRestore(crash, true);
  }

  if (saved) {
    return finishRestore(saved, false);
  }

  return { character: null, recoveredFromCrash: false };
}
