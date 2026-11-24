import { createBlankCharacter } from '../data/defaultCharacter';
import { EMPTY_SOT_CATALOGUE, rehydrateSrdPagesFromHost, setActiveHostSrdOwner } from '../engine/sotEngine';
import type { AbilityName, PF1Character } from '../types/character';
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

  return normalized;
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
