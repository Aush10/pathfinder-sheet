import { createBlankCharacter } from '../data/defaultCharacter';
import type { AbilityName, PF1Character } from '../types/character';
import type { StorageAdapter } from './types';

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
  }

  return normalized;
}

/**
 * Restores the on-screen sheet from the selected storage tree.
 * Crash recovery wins when its checksum differs from the last deliberate save.
 */
export async function restoreSheetFromStorage(adapter: StorageAdapter): Promise<{
  character: PF1Character | null;
  recoveredFromCrash: boolean;
}> {
  const crashRes = await adapter.loadCrash();
  const crash = crashRes.ok ? crashRes.character : null;
  const activeRes = await adapter.getActiveCharacter();
  const active = activeRes.ok ? activeRes.activeCharacter : null;

  let saved = null;
  if (active) {
    const listed = await adapter.listCharacters(active.player);
    const stillPresent = listed.ok && listed.characters.some((entry) => entry.name === active.name);
    if (stillPresent) {
      const loaded = await adapter.loadCharacter(active.player, active.name);
      if (loaded.ok) saved = loaded;
    }
  }

  if (crash) {
    const sameAsSaved = Boolean(saved?.sha256 && crash.sha256 && saved.sha256 === crash.sha256);
    if (!sameAsSaved) {
      return { character: normalizeCharacter(crash.character), recoveredFromCrash: true };
    }
  }

  if (saved) {
    return { character: normalizeCharacter(saved.character), recoveredFromCrash: false };
  }

  return { character: null, recoveredFromCrash: false };
}
