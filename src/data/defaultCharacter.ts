import { PF1Character, BuffBoxData, BuffBonusType, BuffStatTarget, SkillItem, XdxMacroEntry } from '../types/character';
import defaultSheetJson from '../../default_sheet.json';

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

export const BUFF_STAT_KEYS: BuffStatTarget[] = [
  'hp',
  'mattack',
  'rattack',
  'fort',
  'ref',
  'will',
  'ac',
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
  'str_mod',
  'dex_mod',
  'con_mod',
  'int_mod',
  'wis_mod',
  'cha_mod',
];

export function createEmptyBuffMatrix(): BuffBoxData {
  const matrix = {} as BuffBoxData;
  for (const bType of BUFF_BONUS_TYPES) {
    matrix[bType] = {} as Partial<Record<BuffStatTarget, number>>;
    for (const sKey of BUFF_STAT_KEYS) {
      matrix[bType][sKey] = 0;
    }
  }
  return matrix;
}

export const DEFAULT_XDX_MACROS: XdxMacroEntry[] = [
  {
    id: 'm-1',
    name: 'firebreath',
    formula: '2d6+(5*floor(#level/2)+1) "fire"',
    description: 'Dragon fire breath',
  },
  {
    id: 'm-2',
    name: 'mainattack',
    formula: 'd20+#bab+#str | 1d8+#str "slashing"',
    description: 'Primary weapon attack',
  },
  {
    id: 'm-3',
    name: 'blood_drain',
    formula: '"blood" >>HP-5',
    description: 'Drain 5 HP from character',
  },
  {
    id: 'm-4',
    name: 'spell_dc',
    formula: 'DC+#CON "Fort DC"',
    description: 'Standard ability DC',
  },
];

export const INITIAL_SKILLS: SkillItem[] = [
  { id: 'sk-1', name: 'Acrobatics', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-2', name: 'Appraise', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-3', name: 'Bluff', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-4', name: 'Climb', keyAbility: 'STR', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-5', name: 'Craft (Armor)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-6', name: 'Diplomacy', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-7', name: 'Disable Device', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: true },
  { id: 'sk-8', name: 'Disguise', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-9', name: 'Escape Artist', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-10', name: 'Fly', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-11', name: 'Handle Animal', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-12', name: 'Heal', keyAbility: 'WIS', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-13', name: 'Intimidate', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-14', name: 'Knowledge (Arcana)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-15', name: 'Knowledge (Dungeoneering)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-16', name: 'Knowledge (Engineering)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-17', name: 'Knowledge (Geography)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-18', name: 'Knowledge (History)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-19', name: 'Knowledge (Local)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-20', name: 'Knowledge (Nature)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-21', name: 'Knowledge (Nobility)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-22', name: 'Knowledge (Planes)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-23', name: 'Knowledge (Religion)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-24', name: 'Linguistics', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-25', name: 'Perception', keyAbility: 'WIS', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-26', name: 'Perform (Oratory)', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-27', name: 'Profession (Soldier)', keyAbility: 'WIS', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-28', name: 'Ride', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-29', name: 'Sense Motive', keyAbility: 'WIS', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-30', name: 'Sleight of Hand', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: true },
  { id: 'sk-31', name: 'Spellcraft', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
  { id: 'sk-32', name: 'Stealth', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-33', name: 'Survival', keyAbility: 'WIS', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: false },
  { id: 'sk-34', name: 'Swim', keyAbility: 'STR', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: false, hasArmorCheckPenalty: true },
  { id: 'sk-35', name: 'Use Magic Device', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, isTrainedOnly: true, hasArmorCheckPenalty: false },
];

export const DEFAULT_CHARACTER: PF1Character = {
  ...(defaultSheetJson as unknown as PF1Character),
  buffBox: createEmptyBuffMatrix(),
  skills: INITIAL_SKILLS.map((skill) => ({ ...skill })),
  xdxMacros: DEFAULT_XDX_MACROS.map((macro) => ({ ...macro })),
};

export function createBlankCharacter(): PF1Character {
  return {
    name: '',
    player: '',
    alignment: '',
    characterClass: '',
    classes: [],
    level: 0,
    deity: '',
    race: '',
    size: 'Medium',
    gender: '',
    age: 0,
    height: '',
    weight: '',
    eyes: '',
    hair: '',
    campaign: '',
    currentXP: 0,
    nextLevelXP: 0,
    heroPoints: 0,
    classSkillPointsPerLevel: 0,
    abilities: {
      STR: { name: 'STR', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      DEX: { name: 'DEX', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      CON: { name: 'CON', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      INT: { name: 'INT', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      WIS: { name: 'WIS', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      CHA: { name: 'CHA', base: 0, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
    },
    hpTotalMax: 0,
    hpCurrent: 0,
    hpNonlethal: 0,
    hpTemp: 0,
    hitDice: '',
    deathSaves: [false, false, false],
    damageReduction: '',
    fastHealing: '',
    spellResistance: 0,
    resistances: '',
    immunities: '',
    hpBreakdown: {
      calcMethod: 'max',
      hitDiceCount: 0,
      hitDiceSize: 0,
      hitDiceRolledBase: 0,
      additionalBonuses: [],
    },
    combatTracker: {
      round: 0,
      turn: 0,
      isInCombat: false,
    },
    initMiscMod: 0,
    speedBase: 0,
    speedClimb: 0,
    speedSwim: 0,
    speedFly: 0,
    flyManeuverability: '',
    baseAttackBonus: 0,
    naturalArmorMod: 0,
    deflectionMod: 0,
    dodgeMod: 0,
    acMiscMod: 0,
    saves: {
      fortitude: { name: 'Fortitude', base: 0, magicMod: 0, miscMod: 0, tempMod: 0 },
      reflex: { name: 'Reflex', base: 0, magicMod: 0, miscMod: 0, tempMod: 0 },
      will: { name: 'Will', base: 0, magicMod: 0, miscMod: 0, tempMod: 0 },
    },
    buffBox: createEmptyBuffMatrix(),
    customBuffs: [],
    weapons: [],
    armor: [],
    featsAndAbilities: [],
    characterFeats: [],
    generatedOddFeatLevels: [],
    resourceTrackers: [],
    characterActions: [],
    skills: INITIAL_SKILLS.map((skill) => ({
      ...skill,
      isClassSkill: false,
      ranks: 0,
      miscMod: 0,
    })),
    favoredClassSkillRanks: 0,
    inventory: [],
    currency: {
      cp: 0,
      sp: 0,
      gp: 0,
      pp: 0,
    },
    downtimeCapital: {
      currentGp: 0,
      bankGp: 0,
      level: 0,
      totalDp: 0,
      goods: 0,
      influence: 0,
      labor: 0,
      magic: 0,
      kbp: 0,
    },
    languages: [],
    casterLevel: 0,
    spellKeyAbility: 'INT',
    spellSlots: [],
    spells: [],
    conditions: {
      blinded: false,
      cowering: false,
      dazzled: false,
      deafened: false,
      entangled: false,
      exhausted: false,
      fatigued: false,
      frightened: false,
      grappled: false,
      panicked: false,
      pinned: false,
      prone: false,
      shaken: false,
      sickened: false,
      stunned: false,
      haste: false,
      prayer: false,
      enlarge: false,
      reduce: false,
      heroism: false,
    },
    customObjects: [],
    biography: {
      description: '',
      personality: '',
      traits: '',
      flaws: '',
      allies: '',
      enemies: '',
      notes: '',
    },
    xdxMacros: DEFAULT_XDX_MACROS.map((macro) => ({ ...macro })),
    companions: [],
    journal: [],
    rollupNotes: {
      content: '',
      isRolledUp: false,
    },
    customClassGrids: {},
    careerData: {
      mode: 'standard',
      useFractionalBab: false,
      useFractionalSaves: false,
      levels: [],
      archetypes: [],
      variantMulticlassing: {
        enabled: false,
        secondaryClass: '',
      },
      thirdPartySupport: {
        pathOfWarEnabled: false,
        spheresEnabled: false,
      },
    },
    characterBio: {
      scratchpad: '',
      portraits: [],
      currentPortraitIndex: 0,
      bioSections: [],
      skin: '',
    },
    profileData: {
      avatarUrl: '',
      customFields: [],
    },
    activeStorageTab: 'worn',
    installedModules: {
      aiCompanion: true,
      aiSettings: {
        isInstalled: true,
        allowedFields: {
          hp: true,
          conditions: true,
          currency: true,
          inventory: true,
          notes: true,
          journal: true,
          customFormulas: true,
          coreIdentity: true,
          abilities: true,
          armorClass: true,
          saves: true,
          attacksAndWeapons: true,
          armorAndGear: true,
          actionsAndResources: true,
          feats: true,
          skills: true,
          spellsAndMagic: true,
          companionsAndMount: true,
          bioAndProfile: true,
        },
        allowedModules: {
          stepper: true,
          buffBox: true,
          dslStudio: true,
          addClass: true,
          journalVoice: true,
          journalSketch: true,
          scratchpad: true,
          sotCatalogue: true,
          deckTool: true,
          xdxTool: true,
          cmbTool: true,
          pointBuy: true,
          loadoutTool: true,
          imageBrowser: true,
        },
        preferredVoice: '',
        voiceSampleText: '',
        artStylePrompt: 'Pathfinder 1e fantasy sketchbook charcoal and sepia ink illustration',
        defaultSketchQuality: 'tasteful',
      },
    },
    workspaceLibraryImages: [],
    memoryBank: {
      schemaVersion: 1,
      pinnedFacts: [],
    },
    uiMakePresets: [
      {
        tag: 1,
        name: 'Default Tabletop Alert',
        layout: 'floating_card',
        font: 'serif',
        theme: 'default_amber',
        soundCue: 'bell',
      },
    ],
  };
}

export const BLANK_CHARACTER = createBlankCharacter();

/**
 * Automatically generates a Feat entry for every odd character level (1, 3, 5, 7, ..., <= character.level)
 * that has not yet been generated. Leaves user additions and deletions intact unless forceRestoreMissing is true.
 */
export function syncOddLevelFeats(
  char: PF1Character,
  forceRestoreMissing: boolean = false
): PF1Character {
  const targetLevel = Math.max(0, Math.min(20, char.level ?? 0));
  if (targetLevel <= 0 && !forceRestoreMissing) {
    return char;
  }

  const oddLevelsUpToCurrent: number[] = [];
  for (let lvl = 1; lvl <= targetLevel; lvl += 2) {
    oddLevelsUpToCurrent.push(lvl);
  }

  let existingFeats = [...(char.characterFeats || [])];
  let trackedOddLevels = Array.isArray(char.generatedOddFeatLevels)
    ? [...char.generatedOddFeatLevels]
    : [];

  // Backward compatibility: if existing feats have no levelGranted and trackedOddLevels is empty,
  // tag existing feats sequentially with odd levels 1, 3, 5...
  if (trackedOddLevels.length === 0 && existingFeats.length > 0) {
    existingFeats = existingFeats.map((feat, idx) => {
      const oddLvl = idx * 2 + 1;
      if (!feat.levelGranted && oddLvl <= 19) {
        trackedOddLevels.push(oddLvl);
        return { ...feat, levelGranted: oddLvl, isOddLevelSlot: true };
      }
      if (feat.levelGranted && feat.levelGranted % 2 === 1) {
        trackedOddLevels.push(feat.levelGranted);
      }
      return feat;
    });
  }

  let changed = false;
  const updatedFeats = [...existingFeats];
  const updatedTracked = new Set<number>(trackedOddLevels);

  for (const oddLvl of oddLevelsUpToCurrent) {
    const alreadyHasFeatAtLevel = updatedFeats.some((f) => f.levelGranted === oddLvl);
    const wasAlreadyGenerated = updatedTracked.has(oddLvl);

    if (!alreadyHasFeatAtLevel && (!wasAlreadyGenerated || forceRestoreMissing)) {
      updatedFeats.push({
        id: `feat-odd-lvl-${oddLvl}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Level ${oddLvl} Feat (Select Feat)`,
        type: 'General',
        prerequisites: `Character Level ${oddLvl}`,
        summary: `Odd-level progression feat gained at Level ${oddLvl}. Click Edit to customize or Delete to remove.`,
        levelGranted: oddLvl,
        isOddLevelSlot: true,
      });
      updatedTracked.add(oddLvl);
      changed = true;
    } else if (alreadyHasFeatAtLevel && !wasAlreadyGenerated) {
      updatedTracked.add(oddLvl);
      changed = true;
    }
  }

  if (!changed && char.generatedOddFeatLevels) {
    return char;
  }

  // Also keep legacy featsAndAbilities string list in sync for newly generated odd-level slots
  const updatedFeatsAndAbilities = [...(char.featsAndAbilities || [])];
  updatedFeats.forEach((f) => {
    if (
      f.name &&
      !updatedFeatsAndAbilities.some((s) => s.toLowerCase() === f.name.toLowerCase())
    ) {
      updatedFeatsAndAbilities.push(f.name);
    }
  });

  return {
    ...char,
    characterFeats: updatedFeats,
    generatedOddFeatLevels: Array.from(updatedTracked).sort((a, b) => a - b),
    featsAndAbilities: updatedFeatsAndAbilities,
  };
}
