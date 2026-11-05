/**
 * Pathfinder 1e Modular AI Engine & Source of Truth (SOT) Service
 * Provides:
 * - Server-side Gemini API integration (/api/gemini/generate & /api/gemini/lookup)
 * - Online SRD Lookup (Google Search + URL Context) with Source of Truth (SOT) Rich-Text Override priority
 * - Plain English to DSL Macro & Buff Box <^...> generation
 * - First-Person Character Voice Journal Generator
 * - Journal Pencil Sketch generator (crude, passible, tasteful, astounding)
 * - Broad Sheet Authority & Granular AI Blind Spot Enforcement across all modules and tools
 */

import {
  PF1Character,
  SketchDetailQuality,
  AIModuleSettings,
  BuffBonusType,
  BuffStatTarget,
  MacaroniCategory,
  ClassGridRow,
  SOTCatalogueData,
  SOTCategory,
  AbilityName,
} from '../types/character';
import { generateProceduralPencilSketch } from './sketchRenderer';

// Legacy no-op helpers kept for backward compatibility with existing module imports
export function getSessionApiKey(): string {
  return '';
}
export function setSessionApiKey(_key: string): void {}
export function clearSessionApiKey(): void {}

export const DEFAULT_AI_MODULE_SETTINGS: AIModuleSettings = {
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
  preferredVoice: 'Terse, serious, no-nonsense, short sentences, gruff veteran',
  voiceSampleText:
    'Rations low. Blades sharp. The marsh smells of rot and old magic—we move at first light.',
  artStylePrompt: 'Graphite cross-hatch on weathered parchment, field journal illustration',
  defaultSketchQuality: 'tasteful',
};

export const DEFAULT_SOT_CATALOGUE: SOTCatalogueData = {
  weblinks: [
    {
      id: 'sot-link-1',
      title: 'd20PFSRD — Pathfinder 1e SRD Database',
      url: 'https://www.d20pfsrd.com/',
      category: 'General Rule',
      notes: 'Primary reference for PF1e feats, classes, archetypes, spells, and 3rd-party rules. Opens 1 page & halts (Read-Only).',
      isActive: true,
      createdAt: 1730000000000,
    },
    {
      id: 'sot-link-2',
      title: 'Archives of Nethys — Official Paizo PF1e PRD',
      url: 'https://aonprd.com/',
      category: 'General Rule',
      notes: 'Official Paizo Pathfinder 1st Edition rules, deities, archetypes, and feats. Opens 1 page & halts (Read-Only).',
      isActive: true,
      createdAt: 1730000001000,
    },
    {
      id: 'sot-link-3',
      title: 'Spheres of Power & Might / Path of War Wiki',
      url: 'http://spheresofpower.wikidot.com/',
      category: 'Power',
      notes: 'Reference for martial maneuvers, spheres talents, and 3rd-party powers. Opens 1 page & halts (Read-Only).',
      isActive: true,
      createdAt: 1730000002000,
    },
  ],
  overridePages: [
    {
      id: 'sot-page-1',
      title: 'Campaign House Rule: Elephant in the Room Feat Taxes',
      category: 'Feat',
      htmlContent:
        '<h3><strong>Power Attack, Deadly Aim &amp; Combat Expertise (Campaign Override)</strong></h3><p>Every character with at least <strong>BAB +1</strong> automatically gains the benefits of <em>Power Attack</em> (melee), <em>Deadly Aim</em> (ranged), and <em>Combat Expertise</em> without spending a feat slot. You can take a –1 penalty on attack rolls per 4 points of base attack bonus to gain a +2 bonus on damage rolls.</p><ul><li><strong>Weapon Finesse:</strong> Free with any light or finessable weapon.</li><li><strong>Dodge &amp; Mobility:</strong> Merged into a single feat (<strong>Dodge</strong> grants +1 dodge bonus to AC at 1st level, increasing by +1 for every four levels beyond 1st).</li></ul>',
      plainText:
        'Power Attack, Deadly Aim & Combat Expertise (Campaign Override): Every character with at least BAB +1 automatically gains the benefits of Power Attack (melee), Deadly Aim (ranged), and Combat Expertise without spending a feat slot. You can take a -1 penalty on attack rolls per 4 points of base attack bonus to gain a +2 bonus on damage rolls. Weapon Finesse is free with any light or finessable weapon. Dodge & Mobility are merged into a single feat (Dodge grants +1 dodge bonus to AC at 1st level, increasing by +1 for every four levels beyond 1st).',
      isOverride: true,
      isReadOnly: true,
      tags: ['Feat Tax', 'Power Attack', 'Dodge', 'House Rule'],
      updatedAt: 1730000005000,
      incidentalLinks: [
        {
          url: 'https://www.d20pfsrd.com/feats/combat-feats/power-attack-combat/',
          label: 'd20PFSRD: Power Attack (Incidental Reference)',
          isWebhookOrSuspicious: false,
        },
        {
          url: 'https://www.d20pfsrd.com/feats/combat-feats/dodge-combat/',
          label: 'd20PFSRD: Dodge (Incidental Reference)',
          isWebhookOrSuspicious: false,
        },
      ],
      securityAudit: {
        isReadOnly: true,
        strippedScriptsCount: 0,
        strippedWebhooksCount: 0,
        strippedCodeSnipsCount: 0,
        incidentalLinksCount: 2,
        sanitizedAt: 1730000005000,
      },
    },
    {
      id: 'sot-page-2',
      title: 'Full Class SRD: Slayer (Hybrid Ranger/Rogue Browser Dump)',
      category: 'Full Class SRD',
      htmlContent:
        '<h3><strong>Table: Slayer (Hit Die: d10 | Skill Ranks per Level: 6 + Int modifier)</strong></h3><p><strong>Class Skills:</strong> Acrobatics (Dex), Bluff (Cha), Climb (Str), Craft (Int), Disguise (Cha), Heal (Wis), Intimidate (Cha), Knowledge (dungeoneering) (Int), Knowledge (geography) (Int), Knowledge (local) (Int), Perception (Wis), Profession (Wis), Ride (Dex), Sense Motive (Wis), Stealth (Dex), Survival (Wis), Swim (Str).</p><p><strong>Weapon and Armor Proficiency:</strong> A slayer is proficient with all simple and martial weapons, as well as with light armor, medium armor, and shields (except tower shields).</p><p><strong>Studied Target (Ex):</strong> At 1st level, a slayer gains a +1 competence bonus on Bluff, Knowledge, Perception, Sense Motive, and Survival checks, and a +1 bonus on weapon attack and damage rolls against his studied target, increasing by +1 for every five levels beyond 1st. The DCs of slayer class abilities against that opponent have a DC equal to 10 + 1/2 the slayer’s level + the slayer’s Intelligence modifier.</p><p><strong>Sneak Attack (Ex):</strong> At 3rd level, a slayer deals 1d6 points of precision damage for every two levels beyond 1st when flanking or when target is denied Dexterity to AC.</p>',
      plainText:
        `Table: Slayer\nHit Die: d10.\nSkill Ranks per Level: 6 + Int modifier.\nClass Skills: The slayer's class skills are Acrobatics (Dex), Bluff (Cha), Climb (Str), Craft (Int), Disguise (Cha), Heal (Wis), Intimidate (Cha), Knowledge (dungeoneering) (Int), Knowledge (geography) (Int), Knowledge (local) (Int), Perception (Wis), Profession (Wis), Ride (Dex), Sense Motive (Wis), Stealth (Dex), Survival (Wis), and Swim (Str).\nWeapon and Armor Proficiency: A slayer is proficient with all simple and martial weapons, as well as with light armor, medium armor, and shields (except tower shields).\n1st +1 +2 +2 +0 Studied target, track\n2nd +2 +3 +3 +0 Slayer talent\n3rd +3 +3 +3 +1 Sneak attack +1d6\n4th +4 +4 +4 +1 Slayer talent\n5th +5 +4 +4 +1 2nd studied target\n6th +6/+1 +5 +5 +2 Sneak attack +2d6, slayer talent\n7th +7/+2 +5 +5 +2 Stalker\n8th +8/+3 +6 +6 +2 Slayer talent\n9th +9/+4 +6 +6 +3 Sneak attack +3d6\n10th +10/+5 +7 +7 +3 3rd studied target, advanced talents, slayer talent\n11th +11/+6/+1 +7 +7 +3 Swift tracker\n12th +12/+7/+2 +8 +8 +4 Sneak attack +4d6, slayer talent\n13th +13/+8/+3 +8 +8 +4 Slayer's advance 1/day\n14th +14/+9/+4 +9 +9 +4 Quarry, slayer talent\n15th +15/+10/+5 +9 +9 +5 4th studied target, sneak attack +5d6\n16th +16/+11/+6/+1 +10 +10 +5 Slayer talent\n17th +17/+12/+7/+2 +10 +10 +5 Slayer's advance 2/day\n18th +18/+13/+8/+3 +11 +11 +6 Sneak attack +6d6, slayer talent\n19th +19/+14/+9/+4 +11 +11 +6 Improved quarry\n20th +20/+15/+10/+5 +12 +12 +6 5th studied target, master slayer, slayer talent\nStudied Target (Ex): At 1st level, a slayer gains a +1 competence bonus on attack and damage rolls against his studied target, increasing by +1 for every five levels beyond 1st. The DC is equal to 10 + 1/2 the slayer's level + Intelligence modifier.\nSneak Attack (Ex): Deals 1d6 points of precision damage for every two levels when flanking.`,
      isOverride: true,
      isReadOnly: true,
      tags: ['Slayer', 'Full Class SRD', 'Studied Target', 'Sneak Attack'],
      updatedAt: 1730000008000,
      incidentalLinks: [
        {
          url: 'https://www.d20pfsrd.com/classes/hybrid-classes/slayer/',
          label: 'd20PFSRD: Slayer Hybrid Class',
          isWebhookOrSuspicious: false,
        },
        {
          url: 'https://www.d20pfsrd.com/classes/hybrid-classes/slayer/slayer-talents/',
          label: 'd20PFSRD: Slayer Talents List (Incidental)',
          isWebhookOrSuspicious: false,
        },
      ],
      securityAudit: {
        isReadOnly: true,
        strippedScriptsCount: 0,
        strippedWebhooksCount: 0,
        strippedCodeSnipsCount: 0,
        incidentalLinksCount: 2,
        sanitizedAt: 1730000008000,
      },
    },
  ],
  macaroniSuggestions: [
    {
      id: 'mac-sugg-default-1',
      sourceDocId: 'sot-page-2',
      sourceDocTitle: 'Full Class SRD: Slayer (Hybrid Ranger/Rogue Browser Dump)',
      abilityName: 'Studied Target Scaling Bonus',
      mathBreakdownText:
        'At 1st level, a slayer gains a +1 competence bonus on attack and damage rolls against his studied target, increasing by +1 for every five levels beyond 1st.',
      suggestedFormula: 'StudiedTarget:|<^MATTACK.Competence+[1 + floor(#LEVEL / 5)], RATTACK.Competence+[1 + floor(#LEVEL / 5)]>|$',
      category: 'action',
      explanation: 'Scales +1 Competence to Attack/Damage at 1st level, +1 per 5 Slayer levels.',
      createdAt: 1730000009000,
    },
    {
      id: 'mac-sugg-default-2',
      sourceDocId: 'sot-page-2',
      sourceDocTitle: 'Full Class SRD: Slayer (Hybrid Ranger/Rogue Browser Dump)',
      abilityName: 'Slayer Ability Save DC',
      mathBreakdownText:
        "The DCs of slayer class abilities against that opponent have a DC equal to 10 + 1/2 the slayer's level + the slayer's Intelligence modifier.",
      suggestedFormula: '"Slayer Ability DC" [10 + floor(#LEVEL / 2) + #INT]',
      category: 'logic',
      explanation: 'Calculates 10 + 1/2 Level + #INT modifier.',
      createdAt: 1730000010000,
    },
    {
      id: 'mac-sugg-default-3',
      sourceDocId: 'sot-page-1',
      sourceDocTitle: 'Campaign House Rule: Elephant in the Room Feat Taxes',
      abilityName: 'Dodge Scaling (SOT Override)',
      mathBreakdownText:
        'Dodge grants +1 dodge bonus to AC at 1st level, increasing by +1 for every four levels beyond 1st.',
      suggestedFormula: 'DodgeSOT:|<^AC.Dodge+[1 + floor((#LEVEL - 1) / 4)]>|$',
      category: 'action',
      explanation: 'Applies scaling Dodge bonus to AC in Buff Box based on SOT Override math.',
      createdAt: 1730000011000,
    },
  ],
};

// Helper to gather active SOT context from character
export function buildSOTContextForAI(character: PF1Character): {
  overrideText: string;
  activeUrls: string[];
} {
  const sot = character.sotCatalogue || DEFAULT_SOT_CATALOGUE;
  const isSotAllowed =
    (character.installedModules?.aiSettings?.allowedModules?.sotCatalogue ?? true) !== false;

  if (!isSotAllowed) {
    return { overrideText: '', activeUrls: [] };
  }

  const activePages = (sot.overridePages || []).filter((p) => p.isOverride);
  const overrideText =
    activePages.length > 0
      ? activePages
          .map(
            (p) =>
              `[SOT OVERRIDE PAGE (${p.category}): "${p.title}"]\n${p.plainText || p.htmlContent}`
          )
          .join('\n\n')
      : '';

  const activeUrls = (sot.weblinks || [])
    .filter((l) => l.isActive && l.url)
    .map((l) => l.url);

  return { overrideText, activeUrls };
}

// Helper to call server-side /api/gemini/generate
async function callServerGeminiGenerate(params: {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  urls?: string[];
}): Promise<string | null> {
  try {
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null;
  } catch {
    return null;
  }
}

// Helper to extract JSON from a string that might contain markdown fences
function safeParseJson<T = any>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ==========================================
// 0. Online SRD + SOT Catalogue Lookup Engine (Feats, Class Abilities, Spells, Powers)
// ==========================================

export interface RulesLookupModifiers {
  featType?: string;
  levelGranted?: string | number;
  prerequisites?: string;
  summaryHint?: string;
  directoryCategory?: string;
  actionEconomy?: string;
  macroKey?: string;
  range?: string;
  saveDC?: string;
  descriptionHint?: string;
  hasResourcePool?: boolean;
}

export interface RulesLookupResult {
  matched: boolean;
  title: string;
  category: SOTCategory;
  featType?: string;
  macroKey?: string;
  sourceAuthority: 'SOT Override Page' | 'SOT Weblink' | 'Online SRD';
  prerequisites: string;
  actionType:
    | 'Standard'
    | 'Swift'
    | 'Move'
    | 'Immediate'
    | 'Free'
    | 'Full-Round'
    | '1 Round'
    | 'Passive / Pool';
  range?: string;
  duration?: string;
  saveDC?: string;
  hasResourcePool?: boolean;
  resourceMax?: number;
  summary: string;
  fullDescription: string;
  suggestedMacro: string;
  sourceNotes: string;
  sourceUrls: Array<{ title: string; uri: string }>;
}

interface VerifiedCompendiumEntry {
  keywords: string[];
  title: string;
  category: SOTCategory;
  featType?: string;
  macroKey: string;
  prerequisites: string;
  actionType: RulesLookupResult['actionType'];
  range?: string;
  duration?: string;
  saveDC?: string;
  hasResourcePool?: boolean;
  resourceMax?: number;
  summary: string;
  fullDescription: string;
  suggestedMacro: string;
  sourceNotes: string;
  srdUrl: string;
}

const VERIFIED_PF1E_COMPENDIUM: VerifiedCompendiumEntry[] = [
  {
    keywords: ['power attack', 'melee damage penalty', 'p.a.'],
    title: 'Power Attack',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'POWER_ATTACK',
    prerequisites: 'Str 13, base attack bonus +1',
    actionType: 'Free',
    summary: 'Trade -1 melee attack (plus -1 per +4 BAB) for +2 melee damage (+3 with two-handed weapon).',
    fullDescription:
      'You can choose to take a –1 penalty on all melee attack rolls and combat maneuver checks to gain a +2 bonus on all melee damage rolls. This bonus to damage is increased by half (+50%) if you are making an attack with a two-handed weapon, a one handed weapon using two hands, or a primary natural weapon that adds 1-1/2 times your Strength modifier on damage rolls. When your base attack bonus reaches +4, and every 4 points thereafter, the penalty increases by –1 and the bonus to damage increases by +2.',
    suggestedMacro: '[1d20 + #BAB + #STR - (1 + floor(#BAB / 4))] "Power Attack" & [2d6 + floor(#STR * 1.5) + ((1 + floor(#BAB / 4)) * 3)] "2H Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/power-attack-combat/',
  },
  {
    keywords: ['deadly aim', 'ranged power attack'],
    title: 'Deadly Aim',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'DEADLY_AIM',
    prerequisites: 'Dex 13, base attack bonus +1',
    actionType: 'Free',
    summary: 'Trade -1 ranged attack (plus -1 per +4 BAB) for +2 ranged damage (plus +2 per +4 BAB).',
    fullDescription:
      'You can choose to take a –1 penalty on all ranged attack rolls to gain a +2 bonus on all ranged damage rolls. When your base attack bonus reaches +4, and every +4 thereafter, the penalty increases by –1 and the bonus to damage increases by +2. You must choose to use this feat before making an attack roll and its effects last until your next turn. The bonus damage does not apply to touch attacks or effects that do not deal hit point damage.',
    suggestedMacro: '[1d20 + #BAB + #DEX - (1 + floor(#BAB / 4))] "Deadly Aim" & [1d8 + ((1 + floor(#BAB / 4)) * 2)] "Ranged Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/deadly-aim-combat/',
  },
  {
    keywords: ['combat expertise'],
    title: 'Combat Expertise',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'COMBAT_EXPERTISE',
    prerequisites: 'Int 13',
    actionType: 'Free',
    summary: 'Trade -1 melee attack (plus -1 per +4 BAB) for +1 dodge bonus to Armor Class.',
    fullDescription:
      'You can choose to take a –1 penalty on melee attack rolls and combat maneuver checks to gain a +1 dodge bonus to your Armor Class. When your base attack bonus reaches +4, and every +4 thereafter, the penalty increases by –1 and the dodge bonus increases by +1. You can only choose to use this feat when you declare that you are making an attack or a full-attack action with a melee weapon.',
    suggestedMacro: 'CombatExpertise:|<^MATTACK-1, AC.Dodge+1>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/combat-expertise-combat/',
  },
  {
    keywords: ['weapon finesse', 'dex to attack', 'finesse'],
    title: 'Weapon Finesse',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'WEAPON_FINESSE',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'Use your Dexterity modifier instead of your Strength modifier on attack rolls with light weapons, rapiers, whips, and spiked chains.',
    fullDescription:
      'With a light weapon, elven curve blade, rapier, whip, or spiked chain made for a creature of your size category, you may use your Dexterity modifier instead of your Strength modifier on attack rolls. If you carry a shield, its armor check penalty applies to your attack rolls.',
    suggestedMacro: '[1d20 + #BAB + #DEX] "Finesse Attack"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/weapon-finesse-combat/',
  },
  {
    keywords: ['weapon focus'],
    title: 'Weapon Focus',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'WEAPON_FOCUS',
    prerequisites: 'Proficiency with selected weapon, base attack bonus +1',
    actionType: 'Passive / Pool',
    summary: 'You gain a +1 bonus on all attack rolls you make using the selected weapon.',
    fullDescription:
      'You gain a +1 bonus on all attack rolls you make using the selected weapon. You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new type of weapon.',
    suggestedMacro: 'WeaponFocus:|<^MATTACK+1>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/weapon-focus-combat/',
  },
  {
    keywords: ['dodge'],
    title: 'Dodge',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'DODGE',
    prerequisites: 'Dex 13',
    actionType: 'Passive / Pool',
    summary: 'You gain a +1 dodge bonus to your AC. A condition that makes you lose your Dexterity bonus to AC also makes you lose the benefits of this feat.',
    fullDescription:
      'You gain a +1 dodge bonus to your AC. A condition that makes you lose your Dexterity bonus to AC also makes you lose the benefits of this feat.',
    suggestedMacro: 'Dodge:|<^AC.Dodge+1>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/dodge-combat/',
  },
  {
    keywords: ['cleave'],
    title: 'Cleave',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'CLEAVE',
    prerequisites: 'Str 13, Power Attack, base attack bonus +1',
    actionType: 'Standard',
    summary: 'Standard action: make a single melee attack at full BAB; if you hit, make an additional attack against an adjacent foe at -2 AC.',
    fullDescription:
      'As a standard action, you can make a single attack at your full base attack bonus against a foe within reach. If you hit, you deal damage normally and can make an additional attack (using your full base attack bonus) against a foe that is adjacent to the first and also within reach. You can only make one additional attack per round with this feat. When you use this feat, you take a –2 penalty to your Armor Class until your next turn.',
    suggestedMacro: '[1d20 + #BAB + #STR] "Cleave Hit 1" & [1d20 + #BAB + #STR] "Adjacent Cleave" & <^AC-2>',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/cleave-combat/',
  },
  {
    keywords: ['vital strike'],
    title: 'Vital Strike',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'VITAL_STRIKE',
    prerequisites: 'Base attack bonus +6',
    actionType: 'Standard',
    summary: 'When you use the attack action, roll the weapon’s damage dice for the attack twice and add the results together before adding bonuses.',
    fullDescription:
      'When you use the attack action, you can make one attack at your highest base attack bonus that deals additional damage. Roll the weapon’s damage dice for the attack twice and add the results together before adding bonuses from Strength, weapon abilities (such as flaming), precision-based damage, and other damage bonuses. These extra weapon damage dice are not multiplied on a critical hit, but are added to the total.',
    suggestedMacro: '[1d20 + #BAB + #STR] "Vital Strike" & [2d8 + #STR] "Vital Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/vital-strike-combat/',
  },
  {
    keywords: ['improved initiative'],
    title: 'Improved Initiative',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'IMPROVED_INITIATIVE',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'You get a +4 bonus on initiative checks.',
    fullDescription:
      'Your quick reflexes allow you to rapidly react to danger. You get a +4 bonus on initiative checks.',
    suggestedMacro: '[1d20 + #DEX + 4] "Initiative"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/improved-initiative-combat/',
  },
  {
    keywords: ['toughness'],
    title: 'Toughness',
    category: 'Feat',
    featType: 'General',
    macroKey: 'TOUGHNESS',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'You gain +3 hit points. For every Hit Die you possess beyond 3, you gain an additional +1 hit point.',
    fullDescription:
      'You have enhanced physical stamina. You gain +3 hit points. For every Hit Die you possess beyond 3, you gain an additional +1 hit point. If you have more than 3 Hit Dice, you gain +1 hit points whenever you gain a Hit Die (such as when you gain a level).',
    suggestedMacro: 'Toughness:|<^HP+3>|$',
    sourceNotes: 'Pathfinder Core Rulebook — General Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/general-feats/toughness/',
  },
  {
    keywords: ['iron will'],
    title: 'Iron Will',
    category: 'Feat',
    featType: 'General',
    macroKey: 'IRON_WILL',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'You get a +2 bonus on all Will saving throws.',
    fullDescription: 'You are more resistant to mental effects. You get a +2 bonus on all Will saving throws.',
    suggestedMacro: 'IronWill:|<^WILL+2>|$',
    sourceNotes: 'Pathfinder Core Rulebook — General Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/general-feats/iron-will/',
  },
  {
    keywords: ['lightning reflexes'],
    title: 'Lightning Reflexes',
    category: 'Feat',
    featType: 'General',
    macroKey: 'LIGHTNING_REFLEXES',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'You get a +2 bonus on all Reflex saving throws.',
    fullDescription: 'You have faster reflexes than normal. You get a +2 bonus on all Reflex saving throws.',
    suggestedMacro: 'LightningReflexes:|<^REF+2>|$',
    sourceNotes: 'Pathfinder Core Rulebook — General Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/general-feats/lightning-reflexes/',
  },
  {
    keywords: ['great fortitude'],
    title: 'Great Fortitude',
    category: 'Feat',
    featType: 'General',
    macroKey: 'GREAT_FORTITUDE',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'You get a +2 bonus on all Fortitude saving throws.',
    fullDescription: 'You are resistant to poisons, diseases, and other mortal maladies. You get a +2 bonus on all Fortitude saving throws.',
    suggestedMacro: 'GreatFortitude:|<^FORT+2>|$',
    sourceNotes: 'Pathfinder Core Rulebook — General Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/general-feats/great-fortitude/',
  },
  {
    keywords: ['point-blank shot', 'point blank shot'],
    title: 'Point-Blank Shot',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'POINT_BLANK_SHOT',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    range: '30 ft.',
    summary: 'You get a +1 bonus on attack and damage rolls with ranged weapons at ranges of up to 30 feet.',
    fullDescription:
      'You are especially accurate when making ranged attacks against close targets. You get a +1 bonus on attack and damage rolls with ranged weapons at ranges of up to 30 feet.',
    suggestedMacro: '[1d20 + #BAB + #DEX + 1] "Point-Blank Shot" & [1d8 + 1] "Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/point-blank-shot-combat/',
  },
  {
    keywords: ['precise shot'],
    title: 'Precise Shot',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'PRECISE_SHOT',
    prerequisites: 'Point-Blank Shot',
    actionType: 'Passive / Pool',
    summary: 'You can shoot or throw ranged weapons at an opponent engaged in melee without taking the standard –4 penalty on your attack roll.',
    fullDescription:
      'You are adept at firing ranged attacks into melee. You can shoot or throw ranged weapons at an opponent engaged in melee without taking the standard –4 penalty on your attack roll.',
    suggestedMacro: '[1d20 + #BAB + #DEX] "Precise Ranged Attack"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/precise-shot-combat/',
  },
  {
    keywords: ['rapid shot'],
    title: 'Rapid Shot',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'RAPID_SHOT',
    prerequisites: 'Dex 13, Point-Blank Shot',
    actionType: 'Full-Round',
    summary: 'When making a full-attack action with a ranged weapon, you can fire one additional time this round at your highest bonus. All attack rolls take a –2 penalty.',
    fullDescription:
      'You can make an additional ranged attack. When making a full-attack action with a ranged weapon, you can fire one additional time this round at your highest bonus. All of your attack rolls take a –2 penalty when using Rapid Shot.',
    suggestedMacro: '[1d20 + #BAB + #DEX - 2] "Rapid Shot 1" & [1d20 + #BAB + #DEX - 2] "Rapid Shot 2"',
    sourceNotes: 'Pathfinder Core Rulebook — Combat Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/rapid-shot-combat/',
  },
  {
    keywords: ['outflank'],
    title: 'Outflank',
    category: 'Feat',
    featType: 'Combat',
    macroKey: 'OUTFLANK',
    prerequisites: 'Base attack bonus +4',
    actionType: 'Passive / Pool',
    summary: 'Whenever you and an ally who also has this feat are flanking the same creature, your flanking bonus on attack rolls increases to +4.',
    fullDescription:
      'Whenever you and an ally who also has this feat are flanking the same creature, your flanking bonus on attack rolls increases to +4. In addition, whenever you score a critical hit against the flanked creature, it provokes an attack of opportunity from your ally.',
    suggestedMacro: '[1d20 + #BAB + #STR + 4] "Outflank Attack"',
    sourceNotes: 'Advanced Player’s Guide — Combat / Teamwork Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/combat-feats/outflank-combat-teamwork/',
  },
  {
    keywords: ['empower spell'],
    title: 'Empower Spell (Metamagic)',
    category: 'Feat',
    featType: 'Metamagic',
    macroKey: 'EMPOWER_SPELL',
    prerequisites: 'None',
    actionType: 'Passive / Pool',
    summary: 'All variable, numeric effects of an empowered spell are increased by half (+50%). Uses a spell slot two levels higher.',
    fullDescription:
      'All variable, numeric effects of an empowered spell are increased by half including bonuses to those dice rolls. Saving throws and opposed rolls are not affected, nor are spells without random variables. An empowered spell uses up a spell slot two levels higher than the spell’s actual level.',
    suggestedMacro: '[floor((6d6) * 1.5)] "Empowered Spell Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Metamagic Feat',
    srdUrl: 'https://www.d20pfsrd.com/feats/metamagic-feats/empower-spell-metamagic/',
  },
  {
    keywords: ['smite evil', 'smite'],
    title: 'Smite Evil (Su)',
    category: 'Class Ability',
    macroKey: 'SMITE_EVIL',
    prerequisites: 'Paladin 1',
    actionType: 'Swift',
    range: 'Line of Sight',
    hasResourcePool: true,
    resourceMax: 1,
    summary: 'Add CHA bonus to attack rolls and Paladin level to damage rolls against target evil foe; bypasses all DR.',
    fullDescription:
      'Once per day, a paladin can call out to the powers of good to aid her in her struggle against evil. As a swift action, the paladin chooses one target within sight to smite. If this target is evil, the paladin adds her Cha bonus (if any) to her attack rolls and adds her paladin level to all damage rolls made against the target of her smite. Smite evil attacks automatically bypass any DR the creature might possess. At 4th level, and at every three levels thereafter, the paladin may smite evil one additional time per day.',
    suggestedMacro: '[1d20 + #BAB + #STR + #CHA] "Smite Attack" & [1d8 + #STR + #LEVEL] "Smite Damage"',
    sourceNotes: 'Pathfinder Core Rulebook — Paladin Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/paladin/#Smite_Evil_Su',
  },
  {
    keywords: ['barbarian rage', 'rage', 'bloodrage'],
    title: 'Rage (Ex)',
    category: 'Class Ability',
    macroKey: 'RAGE',
    prerequisites: 'Barbarian 1',
    actionType: 'Free',
    range: 'Personal',
    hasResourcePool: true,
    resourceMax: 6,
    summary: 'Free action: +4 morale bonus to STR and CON, +2 morale bonus on Will saves, and -2 penalty to AC.',
    fullDescription:
      'A barbarian can call upon inner reserves of ferocity and strength, granting her additional combat prowess. At 1st level, a barbarian can rage for a number of rounds per day equal to 4 + her Constitution modifier. At each level after 1st, she can rage for 2 additional rounds. While in rage, a barbarian gains a +4 morale bonus to her Strength and Constitution, as well as a +2 morale bonus on Will saves. In addition, she takes a –2 penalty to Armor Class.',
    suggestedMacro: 'BarbarianRage: <^STR.Morale+4, CON.Morale+4, WILL.Morale+2, AC-2>',
    sourceNotes: 'Pathfinder Core Rulebook — Barbarian Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/barbarian/#Rage_Ex',
  },
  {
    keywords: ['lay on hands'],
    title: 'Lay on Hands (Su)',
    category: 'Class Ability',
    macroKey: 'LAY_ON_HANDS',
    prerequisites: 'Paladin 2',
    actionType: 'Swift',
    range: 'Touch (Swift on self, Standard on others)',
    hasResourcePool: true,
    resourceMax: 3,
    summary: 'Heals 1d6 hit points per 2 paladin levels (1/2 level + CHA mod uses/day). Swift action on self, Standard action on allies.',
    fullDescription:
      'Beginning at 2nd level, a paladin can heal wounds (her own or those of others) by touch. Each day she can use this ability a number of times equal to 1/2 her paladin level plus her Charisma modifier. With one use of this ability, a paladin can heal 1d6 hit points of damage for every two paladin levels she possesses. Using this ability is a standard action, unless the paladin targets herself, in which case it is a swift action.',
    suggestedMacro: '[max(1, floor(#LEVEL / 2))d6] "Lay on Hands Healing"',
    sourceNotes: 'Pathfinder Core Rulebook — Paladin Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/paladin/#Lay_On_Hands_Su',
  },
  {
    keywords: ['channel positive energy', 'channel energy'],
    title: 'Channel Energy (Su)',
    category: 'Class Ability',
    macroKey: 'CHANNEL_ENERGY',
    prerequisites: 'Cleric 1 / Paladin 4',
    actionType: 'Standard',
    range: '30-ft. burst centered on caster',
    saveDC: 'Will half (DC 10 + 1/2 level + CHA)',
    hasResourcePool: true,
    resourceMax: 4,
    summary: '30-ft. burst that heals living creatures or harms undead for 1d6 + 1d6 per two cleric levels beyond 1st (3 + CHA mod uses/day).',
    fullDescription:
      'Regardless of alignment, any cleric can release a wave of energy by channeling the power of her faith through her holy (or unholy) symbol. Channeling energy causes a burst that affects all creatures of one type (either undead or living) in a 30-foot radius centered on the cleric. The amount of damage dealt or healed is equal to 1d6 points of damage plus 1d6 points of damage for every two cleric levels beyond 1st (2d6 at 3rd, 3d6 at 5th, and so on).',
    suggestedMacro: '[ceil(#LEVEL / 2)d6] "Channel Energy" & "Will DC" [10 + floor(#LEVEL / 2) + #CHA]',
    sourceNotes: 'Pathfinder Core Rulebook — Cleric Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/cleric/#Channel_Energy_Su',
  },
  {
    keywords: ['bardic performance', 'inspire courage'],
    title: 'Bardic Performance: Inspire Courage (Su)',
    category: 'Class Ability',
    macroKey: 'INSPIRE_COURAGE',
    prerequisites: 'Bard 1',
    actionType: 'Standard',
    range: 'Allies able to perceive performance',
    hasResourcePool: true,
    resourceMax: 6,
    summary: 'Allies gain +1 morale bonus on saves vs charm/fear and +1 competence bonus on attack and weapon damage rolls (+1 per 6 levels after 5th).',
    fullDescription:
      'A 1st-level bard can use his performance to inspire courage in his allies (including himself), bolstering them against fear and improving their combat abilities. An affected ally receives a +1 morale bonus on saving throws against charm and fear effects and a +1 competence bonus on attack and weapon damage rolls. At 5th level, and every six bard levels thereafter, this bonus increases by +1.',
    suggestedMacro: 'InspireCourage: <^MATTACK.Competence+1, RATTACK.Competence+1, WILL.Morale+1>',
    sourceNotes: 'Pathfinder Core Rulebook — Bard Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/bard/#Bardic_Performance',
  },
  {
    keywords: ['ki pool', 'ki point'],
    title: 'Ki Pool (Su)',
    category: 'Class Ability',
    macroKey: 'KI_POOL',
    prerequisites: 'Monk 4 / Ninja 2',
    actionType: 'Swift',
    range: 'Personal',
    hasResourcePool: true,
    resourceMax: 4,
    summary: 'Pool of ki points (1/2 level + WIS or CHA mod). Spend 1 point as a swift action for +1 flurry attack, +20 ft. speed, or +4 dodge to AC for 1 round.',
    fullDescription:
      'At 4th level, a monk gains a pool of ki points, supernatural energy he can use to accomplish amazing feats. The number of points in a monk’s ki pool is equal to 1/2 his monk level + his Wisdom modifier. By spending 1 point from his ki pool, a monk can make one additional attack at his highest attack bonus when making a flurry of blows attack, increase his speed by 20 feet for 1 round, or give himself a +4 dodge bonus to AC for 1 round.',
    suggestedMacro: 'KiDefense:|<^AC.Dodge+4>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Monk Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/monk/#Ki_Pool_Su',
  },
  {
    keywords: ['sneak attack'],
    title: 'Sneak Attack (Ex)',
    category: 'Class Ability',
    macroKey: 'SNEAK_ATTACK',
    prerequisites: 'Rogue 1 / Slayer 3 / Vivisectionist 1',
    actionType: 'Passive / Pool',
    summary: 'Deals +1d6 precision damage (+1d6 every 2 rogue levels after 1st) when target is denied Dexterity to AC or flanked.',
    fullDescription:
      'If a rogue can catch an opponent when he is unable to defend himself effectively from her attack, she can strike a vital spot for extra damage. The rogue’s attack deals extra damage anytime her target would be denied a Dexterity bonus to AC (whether the target actually has a Dexterity bonus or not), or when the rogue flanks her target. This extra damage is 1d6 at 1st level, and increases by 1d6 every two rogue levels thereafter.',
    suggestedMacro: '[ceil(#LEVEL / 2)d6] "Sneak Attack Precision"',
    sourceNotes: 'Pathfinder Core Rulebook — Rogue Class Feature',
    srdUrl: 'https://www.d20pfsrd.com/classes/core-classes/rogue/#Sneak_Attack',
  },
  {
    keywords: ['haste'],
    title: 'Haste',
    category: 'Spell',
    macroKey: 'HASTE',
    prerequisites: 'Sorcerer/Wizard 3, Bard 3, Alchemist 3, Magus 3, Summoner 2',
    actionType: 'Standard',
    range: 'Close (25 ft. + 5 ft./2 levels)',
    duration: '1 round/level',
    saveDC: 'Fortitude negates (harmless)',
    summary: '+1 bonus on attack rolls, +1 dodge bonus to AC and Reflex saves, +30 ft. enhancement to speed, and 1 extra attack on a full attack.',
    fullDescription:
      'The transmuted creatures move and act more quickly than normal. When making a full attack action, a hasted creature may make one extra attack with one natural or manufactured weapon at its highest base attack bonus. It also gains a +1 bonus on attack rolls and a +1 dodge bonus to AC and Reflex saves, and all of its modes of movement increase by 30 feet.',
    suggestedMacro: 'Haste:|<^MATTACK+1, RATTACK+1, AC.Dodge+1, REF.Dodge+1>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Transmutation',
    srdUrl: 'https://www.d20pfsrd.com/magic/all-spells/h/haste/',
  },
  {
    keywords: ['fireball'],
    title: 'Fireball',
    category: 'Spell',
    macroKey: 'FIREBALL',
    prerequisites: 'Sorcerer/Wizard 3, Magus 3, Bloodrager 3',
    actionType: 'Standard',
    range: 'Long (400 ft. + 40 ft./level) • 20-ft.-radius spread',
    duration: 'Instantaneous',
    saveDC: 'Reflex half (DC 13 + #INT)',
    summary: 'Deals 1d6 fire damage per caster level (maximum 10d6) to every creature within a 20-ft.-radius spread.',
    fullDescription:
      'A fireball spell generates a searing explosion of flame that detonates with a low roar and deals 1d6 points of fire damage per caster level (maximum 10d6) to every creature within the area. Unattended objects also take this damage.',
    suggestedMacro: '[min(10, #CL)d6] "Fireball Damage" & "Reflex DC" [13 + #INT]',
    sourceNotes: 'Pathfinder Core Rulebook — Evocation [Fire]',
    srdUrl: 'https://www.d20pfsrd.com/magic/all-spells/f/fireball/',
  },
  {
    keywords: ['mage armor'],
    title: 'Mage Armor',
    category: 'Spell',
    macroKey: 'MAGE_ARMOR',
    prerequisites: 'Sorcerer/Wizard 1, Summoner 1, Witch 1, Bloodrager 1',
    actionType: 'Standard',
    range: 'Touch',
    duration: '1 hour/level (D)',
    saveDC: 'Will negates (harmless)',
    summary: 'An invisible but tangible field of force surrounds the subject, providing a +4 armor bonus to AC.',
    fullDescription:
      'An invisible but tangible field of force surrounds the subject of a mage armor spell, providing a +4 armor bonus to AC. Unlike mundane armor, mage armor entails no armor check penalty, arcane spell failure chance, or speed reduction. Since mage armor is made of force, incorporeal creatures can’t bypass it the way they do normal armor.',
    suggestedMacro: 'MageArmor:|<^AC.Armor+4>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Conjuration (Creation) [Force]',
    srdUrl: 'https://www.d20pfsrd.com/magic/all-spells/m/mage-armor/',
  },
  {
    keywords: ['cure light wounds', 'clw'],
    title: 'Cure Light Wounds',
    category: 'Spell',
    macroKey: 'CURE_LIGHT_WOUNDS',
    prerequisites: 'Cleric/Oracle 1, Bard 1, Druid 1, Paladin 1, Ranger 2, Alchemist 1',
    actionType: 'Standard',
    range: 'Touch',
    duration: 'Instantaneous',
    saveDC: 'Will half (harmless); see text',
    summary: 'Cures 1d8 points of damage + 1 point per caster level (maximum +5).',
    fullDescription:
      'When laying your hand upon a living creature, you channel positive energy that cures 1d8 points of damage + 1 point per caster level (maximum +5). Since undead are powered by negative energy, this spell deals damage to them instead of curing their wounds.',
    suggestedMacro: '[1d8 + min(5, #CL)] "HP Healed"',
    sourceNotes: 'Pathfinder Core Rulebook — Conjuration (Healing)',
    srdUrl: 'https://www.d20pfsrd.com/magic/all-spells/c/cure-light-wounds/',
  },
  {
    keywords: ['divine favor'],
    title: 'Divine Favor',
    category: 'Spell',
    macroKey: 'DIVINE_FAVOR',
    prerequisites: 'Cleric/Oracle 1, Paladin 1, Inquisitor 1, Warpriest 1',
    actionType: 'Standard',
    range: 'Personal',
    duration: '1 minute',
    summary: 'You gain a +1 luck bonus on attack and weapon damage rolls for every three caster levels you have (at least +1, maximum +3).',
    fullDescription:
      'Calling upon the strength and wisdom of a deity, you gain a +1 luck bonus on attack and weapon damage rolls for every three caster levels you have (at least +1, maximum +3). The bonus doesn’t apply to spell damage.',
    suggestedMacro: 'DivineFavor:|<^MATTACK.Luck+1, RATTACK.Luck+1>|$',
    sourceNotes: 'Pathfinder Core Rulebook — Evocation',
    srdUrl: 'https://www.d20pfsrd.com/magic/all-spells/d/divine-favor/',
  },
];

export async function lookupRulesWithSOT(
  query: string,
  categoryFilter: string,
  character: PF1Character,
  modifiers?: RulesLookupModifiers
): Promise<RulesLookupResult> {
  const cleanQuery = query.trim();
  const lowerQuery = cleanQuery.toLowerCase();
  const sot = character.sotCatalogue || DEFAULT_SOT_CATALOGUE;
  const activeSotUrls = (sot.weblinks || [])
    .filter((l) => l.isActive)
    .map((l) => ({ title: l.title, uri: l.url }));

  // Build combined search tokens from query + non-empty modifiers
  const modifierTerms = [
    modifiers?.prerequisites,
    modifiers?.summaryHint,
    modifiers?.descriptionHint,
    modifiers?.macroKey,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => s.length >= 3);

  // =========================================================================
  // STEP 1: START WITH SOT DOCS (Saved Rich-Text Override Pages)
  // =========================================================================
  const matchingOverridePage = (sot.overridePages || []).find((p) => {
    if (!p.isOverride) return false;
    const titleLower = p.title.toLowerCase();
    const textLower = (p.plainText || p.htmlContent || '').toLowerCase();
    const directNameMatch =
      cleanQuery.length >= 2 &&
      (titleLower.includes(lowerQuery) ||
        lowerQuery.includes(titleLower) ||
        p.tags.some((t) => lowerQuery.includes(t.toLowerCase()) || t.toLowerCase().includes(lowerQuery)) ||
        textLower.includes(lowerQuery));
    if (directNameMatch) return true;
    // Also check if user searched via description/prereq modifier and left Name broad
    if (!cleanQuery && modifierTerms.length > 0) {
      return modifierTerms.some((term) => textLower.includes(term) || titleLower.includes(term));
    }
    return false;
  });

  if (matchingOverridePage) {
    return {
      matched: true,
      title: cleanQuery || matchingOverridePage.title,
      category: matchingOverridePage.category,
      featType: matchingOverridePage.category === 'Feat' ? (modifiers?.featType || 'Combat') : undefined,
      macroKey: (cleanQuery || matchingOverridePage.title)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
      sourceAuthority: 'SOT Override Page',
      prerequisites: modifiers?.prerequisites || 'See SOT Override Doc',
      actionType:
        (modifiers?.actionEconomy as RulesLookupResult['actionType']) ||
        (matchingOverridePage.category === 'Spell' ? 'Standard' : 'Free'),
      range: modifiers?.range,
      saveDC: modifiers?.saveDC,
      hasResourcePool: modifiers?.hasResourcePool ?? false,
      summary: matchingOverridePage.plainText.slice(0, 180),
      fullDescription: matchingOverridePage.plainText,
      suggestedMacro: lowerQuery.includes('dodge')
        ? 'DodgeSOT:|<^AC.Dodge+1>|$'
        : lowerQuery.includes('power attack')
        ? '[1d20 + #BAB + #STR - (1 + floor(#BAB / 4))] "SOT Power Attack"'
        : '[1d20 + #BAB + #STR] "SOT Override"',
      sourceNotes: `Matched in Step 1 (SOT Doc Override): "${matchingOverridePage.title}"`,
      sourceUrls: activeSotUrls,
    };
  }

  // =========================================================================
  // STEP 2 & 3: CHECK SOT LINKS NEXT, THEN VERIFIED ONLINE SRD VIA GEMINI
  // =========================================================================
  try {
    const response = await fetch('/api/gemini/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: cleanQuery || modifierTerms.join(' '),
        category: categoryFilter,
        modifiers: modifiers || {},
        sotOverridePages: (sot.overridePages || []).filter((p) => p.isOverride),
        sotWeblinks: (sot.weblinks || []).filter((l) => l.isActive),
        characterSummary: `${character.name || 'Character'} (Lvl ${character.level} ${character.characterClass})`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const parsed = data.text ? safeParseJson<any>(data.text) : null;
      if (parsed && typeof parsed.matched === 'boolean') {
        if (!parsed.matched) {
          return {
            matched: false,
            title: cleanQuery,
            category: categoryFilter !== 'All' ? (categoryFilter as SOTCategory) : 'Feat',
            sourceAuthority: 'Online SRD',
            prerequisites: '',
            actionType: 'Standard',
            summary: '',
            fullDescription: '',
            suggestedMacro: '',
            sourceNotes:
              parsed.sourceNotes ||
              `No verified match found in SOT Docs, SOT Weblinks, or Pathfinder 1e SRD for "${cleanQuery}". Fields were left unchanged.`,
            sourceUrls: [],
          };
        }

        if (parsed.title) {
          return {
            matched: true,
            title: parsed.title,
            category:
              parsed.category || (categoryFilter !== 'All' ? (categoryFilter as SOTCategory) : 'Feat'),
            featType: parsed.featType || modifiers?.featType || 'Combat',
            macroKey:
              parsed.macroKey ||
              parsed.title
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, '_')
                .replace(/^_|_$/g, ''),
            sourceAuthority: parsed.sourceAuthority || 'Online SRD',
            prerequisites: parsed.prerequisites || 'None',
            actionType: parsed.actionType || 'Standard',
            range: parsed.range || undefined,
            duration: parsed.duration || undefined,
            saveDC: parsed.saveDC || undefined,
            hasResourcePool: Boolean(parsed.hasResourcePool),
            resourceMax: parsed.resourceMax ? Number(parsed.resourceMax) : undefined,
            summary: parsed.summary || '',
            fullDescription: parsed.fullDescription || parsed.summary || '',
            suggestedMacro: parsed.suggestedMacro || '',
            sourceNotes: parsed.sourceNotes || 'Verified via SOT Weblinks & Online PF1e SRD',
            sourceUrls: Array.isArray(data.sourceUrls) && data.sourceUrls.length > 0
              ? data.sourceUrls
              : activeSotUrls,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Online lookup fallback to local verified PF1e compendium:', err);
  }

  // =========================================================================
  // OFFLINE VERIFIED PF1E COMPENDIUM CHECK (NO GUESSING OR FABRICATING!)
  // =========================================================================
  // Check SOT Weblinks first if the query matches a saved SOT Weblink title or notes
  const matchedWeblink = (sot.weblinks || []).find(
    (l) =>
      l.isActive &&
      cleanQuery.length >= 3 &&
      (l.title.toLowerCase().includes(lowerQuery) ||
        (l.notes && l.notes.toLowerCase().includes(lowerQuery)))
  );

  // Check verified PF1e compendium using Name query + modifiers
  const verifiedEntry = VERIFIED_PF1E_COMPENDIUM.find((entry) => {
    const nameMatched =
      cleanQuery.length >= 2 &&
      (entry.title.toLowerCase() === lowerQuery ||
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.keywords.some((kw) => lowerQuery.includes(kw) || kw.includes(lowerQuery)) ||
        (modifiers?.macroKey &&
          entry.macroKey.toLowerCase() === String(modifiers.macroKey).trim().toLowerCase()));

    if (nameMatched) return true;

    // If Name is empty or partial, check if modifiers uniquely identify an entry
    if (modifierTerms.length > 0) {
      return modifierTerms.some(
        (term) =>
          entry.summary.toLowerCase().includes(term) ||
          entry.fullDescription.toLowerCase().includes(term) ||
          entry.prerequisites.toLowerCase().includes(term)
      );
    }
    return false;
  });

  if (verifiedEntry) {
    return {
      matched: true,
      title: verifiedEntry.title,
      category: verifiedEntry.category,
      featType: verifiedEntry.featType,
      macroKey: verifiedEntry.macroKey,
      sourceAuthority: matchedWeblink ? 'SOT Weblink' : 'Online SRD',
      prerequisites: verifiedEntry.prerequisites,
      actionType: verifiedEntry.actionType,
      range: verifiedEntry.range,
      duration: verifiedEntry.duration,
      saveDC: verifiedEntry.saveDC,
      hasResourcePool: verifiedEntry.hasResourcePool,
      resourceMax: verifiedEntry.resourceMax,
      summary: verifiedEntry.summary,
      fullDescription: verifiedEntry.fullDescription,
      suggestedMacro: verifiedEntry.suggestedMacro,
      sourceNotes: matchedWeblink
        ? `Matched via SOT Link ("${matchedWeblink.title}") & ${verifiedEntry.sourceNotes}`
        : verifiedEntry.sourceNotes,
      sourceUrls: [
        { title: `d20PFSRD: ${verifiedEntry.title}`, uri: verifiedEntry.srdUrl },
        ...activeSotUrls,
      ],
    };
  }

  // STRICT NO-GUESSING POLICY: If no proper match was found in SOT Docs, SOT Weblinks, or Verified SRD,
  // return matched: false and do NOT make up fields!
  return {
    matched: false,
    title: cleanQuery,
    category: categoryFilter !== 'All' ? (categoryFilter as SOTCategory) : 'Feat',
    sourceAuthority: 'Online SRD',
    prerequisites: '',
    actionType: 'Standard',
    summary: '',
    fullDescription: '',
    suggestedMacro: '',
    sourceNotes: `No verified match found in SOT Docs, SOT Links, or PF1e SRD for "${
      cleanQuery || modifierTerms.join(', ')
    }". Fields were not populated to avoid guessing.`,
    sourceUrls: [],
  };
}

// ==========================================
// 1. Plain English to Macaroni DSL Macro Generator
// ==========================================

export interface GeneratedMacroResult {
  formula: string;
  name: string;
  description: string;
  category: MacaroniCategory;
  explanation: string;
}

export async function generateMacroFromEnglish(
  prompt: string,
  character: PF1Character,
  _apiKey?: string
): Promise<GeneratedMacroResult> {
  const { overrideText, activeUrls } = buildSOTContextForAI(character);

  const systemInstruction = `You are an expert Pathfinder 1st Edition system master and Macaroni Macro Language engineer.
Translate the user's natural language rule request into a valid Macaroni verb-centric macro expression.
${overrideText ? `\nIMPORTANT SOURCE OF TRUTH OVERRIDES (OBEY THESE OVER STANDARD SRD):\n${overrideText}\n` : ''}
Macaroni Symbolic Grammar Rules:
- #CALL constants: #HP, #STR, #DEX, #CON, #INT, #WIS, #CHA, #BAB, #LEVEL, #CL, #AC, #FORT, #REF, #WILL, #CMB, #CMD, #INIT.
- [] Evaluate calculation: [1d20 + #BAB + #STR]
- & Multi-slot separator: [1d20 + #BAB + #STR] "to hit" & [1d8 + #STR] "slashing"
- "" Written flavor text: ignored when called in math context {macro_name}
- <11"Message"> Tagged UI Alert card
- <^...> Buff-making construct: e.g. MageArmor:|<^{7:2}+4>|$ or <^STR.Morale+4, CON.Morale+4, WILL.Morale+2, AC-2>
- this: 10-1! | this=0 | $ Stepper countdown
- Categories: "action" | "step" | "logic" | "placeholder"
- Current Character Context:
  Name: ${character.name}, Level: ${character.level}, Class: ${character.characterClass}, BAB: ${character.baseAttackBonus}

Return ONLY a valid JSON object with these keys:
{
  "formula": "the valid Macaroni expression string",
  "name": "concise_identifier",
  "description": "brief 1-sentence summary of what this does in PF1e",
  "category": "action" | "step" | "logic" | "placeholder",
  "explanation": "concise breakdown of how the PF1e math and Macaroni symbols work"
}`;

  const serverText = await callServerGeminiGenerate({
    prompt: `User Request: ${prompt}`,
    systemInstruction,
    responseMimeType: 'application/json',
    urls: activeUrls,
  });

  if (serverText) {
    const parsed = safeParseJson<any>(serverText);
    if (parsed && parsed.formula) {
      const rawCat = String(parsed.category || 'action').toLowerCase();
      const validCat: MacaroniCategory = ['action', 'step', 'logic', 'placeholder'].includes(rawCat)
        ? (rawCat as MacaroniCategory)
        : 'action';
      return {
        formula: parsed.formula,
        name: (parsed.name || 'custom_macro').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        description: parsed.description || prompt,
        category: validCat,
        explanation: parsed.explanation || 'Calculated using Pathfinder 1e Macaroni grammar & SOT context.',
      };
    }
  }

  const lower = prompt.toLowerCase();
  if (lower.includes('power attack')) {
    const bab = character.baseAttackBonus || 1;
    const penalty = 1 + Math.floor(bab / 4);
    const bonus = penalty * 2;
    return {
      formula: `[1d20 + #BAB + #STR - ${penalty}] "to hit" & [1d8 + #STR + ${bonus}] "slashing"`,
      name: 'power_attack',
      description: `Power Attack (BAB +${bab}: -${penalty} attack, +${bonus} damage)`,
      category: 'action',
      explanation: `Uses Macaroni [] evaluation brackets and & multi-slot separator (.1 attack, .2 damage) with PF1e Power Attack scaling.`,
    };
  }

  if (lower.includes('sneak attack')) {
    const dice = Math.ceil(character.level / 2);
    return {
      formula: `[1d20 + #BAB + #DEX + 2] "flanking to hit" & [1d6 + #STR] "blade" & [${dice}d6] "sneak precision"`,
      name: 'flanking_sneak_attack',
      description: `Flanking Sneak Attack (+2 to hit, +${dice}d6 precision damage)`,
      category: 'action',
      explanation: `Separates attack (.1), weapon damage (.2), and ${dice}d6 sneak precision damage (.3) using & so crits only multiply weapon damage.`,
    };
  }

  if (lower.includes('smite') || lower.includes('smite evil')) {
    return {
      formula: `[1d20 + #BAB + #CHA] "smite to hit" & [1d8 + #STR + #LEVEL] "sacred damage" & <11"Smite Evil Unleashed!">`,
      name: 'smite_evil',
      description: `Smite Evil (+#CHA to hit, +#LEVEL to damage, +Alert)`,
      category: 'action',
      explanation: `Adds #CHA to attack, #LEVEL to damage, and fires a Tag 11 UI Make alert card.`,
    };
  }

  if (lower.includes('fireball') || lower.includes('dragon') || lower.includes('breath')) {
    const diceCount = Math.min(10, Math.max(1, character.level));
    return {
      formula: `[${diceCount}d6 + (floor(#LEVEL / 2) * 2)] "fire damage" & "Reflex DC" [10 + floor(#LEVEL / 2) + #CON]`,
      name: 'draconic_fire_burst',
      description: `Area fire blast (${diceCount}d6 + scaling DC)`,
      category: 'action',
      explanation: `Rolls ${diceCount}d6 fire damage in slot .1 and calculates the Reflex Save DC in slot .2.`,
    };
  }

  if (lower.includes('cure') || lower.includes('heal')) {
    return {
      formula: `[1d8 + min(5, #CL)] "HP healed" & HP^+1d8`,
      name: 'cure_light_wounds',
      description: 'Cure Light Wounds: [1d8 + min(5, #CL)] hit points',
      category: 'action',
      explanation: 'Evaluates 1d8 + caster level (capped at +5) and uses ^ mutator syntax.',
    };
  }

  if (lower.includes('step') || lower.includes('countdown') || lower.includes('round')) {
    return {
      formula: `this: 10-1! | this=0 | $`,
      name: 'buff_countdown',
      description: '10-round self-altering stepper countdown that terminates with $ at 0',
      category: 'step',
      explanation: 'Uses ! to advance the stepper count each round and pipes | this=0 | $ to finish at zero.',
    };
  }

  return {
    formula: `[1d20 + #BAB + #STR] "to hit" & [1d8 + #STR] "damage"`,
    name: 'standard_attack_macro',
    description: `Standard Melee Attack with #BAB and #STR`,
    category: 'action',
    explanation: `Evaluates [1d20 + #BAB + #STR] in slot .1 and [1d8 + #STR] in slot .2.`,
  };
}

// ==========================================
// 1B. AI Buff Maker (Plain English to <^...> Buff Macro & Buff Box Item)
// ==========================================

export interface GeneratedBuffResult {
  name: string;
  category: 'activatable' | 'permanent' | 'debuff';
  bonusType: BuffBonusType;
  values: Partial<Record<BuffStatTarget, number>>;
  macaroniSyntax: string;
  coordinateSyntax: string;
  allCapsSyntax: string;
  explanation: string;
  quirkyQuote: string;
}

export async function generateBuffFromEnglish(
  prompt: string,
  character: PF1Character,
  _apiKey?: string
): Promise<GeneratedBuffResult> {
  const { overrideText } = buildSOTContextForAI(character);

  const systemInstruction = `You are a Pathfinder 1st Edition Buff Box & Macaroni <^...> Macro specialist.
Convert the user's natural language buff, spell, feat, or condition request into a structured PF1e Buff Box effect and Macaroni <^...> macro.
${overrideText ? `\nSOURCE OF TRUTH OVERRIDES:\n${overrideText}\n` : ''}
Buff Box 19 Columns (1-indexed):
1:hp, 2:mattack, 3:rattack, 4:fort, 5:ref, 6:will, 7:ac, 8:str, 9:dex, 10:con, 11:int, 12:wis, 13:cha, 14:str_mod, 15:dex_mod, 16:con_mod, 17:int_mod, 18:wis_mod, 19:cha_mod.
Buff Box 19 Rows (1-indexed):
1:Untyped, 2:Enhancement, 3:Circumstance, 4:Competence, 5:Deflection, 6:Dodge, 7:Insight, 8:Item, 9:Inherent, 10:Luck, 11:Morale, 12:Pro/Sac, 13:Race, 14:NAT armor, 15:Armor, 16:Level advance, 17:Shield, 18:Size, 19:Alt size.

Return ONLY valid JSON with these keys:
{
  "name": "CleanIdentifierName",
  "category": "activatable" | "permanent" | "debuff",
  "bonusType": "one of the 19 BuffBonusType strings",
  "values": { "ac": 4 },
  "macaroniSyntax": "e.g. MageArmor:|<^AC.Enhancement+4>|$",
  "coordinateSyntax": "e.g. MageArmor:|<^{7:2}+4>|$",
  "allCapsSyntax": "e.g. MageArmor:|<^ENHANCEMENTBONUSTOAC+4>|$",
  "explanation": "Brief explanation of the PF1e bonus type and matrix coordinates",
  "quirkyQuote": "A witty, cheese-themed Pathfinder 1e tabletop quip"
}`;

  const serverText = await callServerGeminiGenerate({
    prompt: `User Buff Request: ${prompt}`,
    systemInstruction,
    responseMimeType: 'application/json',
  });

  if (serverText) {
    const parsed = safeParseJson<any>(serverText);
    if (parsed && parsed.name) {
      return {
        name: parsed.name || 'CustomBuff',
        category: parsed.category || 'activatable',
        bonusType: parsed.bonusType || 'Untyped',
        values: parsed.values || { ac: 4 },
        macaroniSyntax: parsed.macaroniSyntax || 'CustomBuff:|<^AC+4>|$',
        coordinateSyntax: parsed.coordinateSyntax || 'CustomBuff:|<^{7:1}+4>|$',
        allCapsSyntax: parsed.allCapsSyntax || 'CustomBuff:|<^UNTYPEDBONUSTOAC+4>|$',
        explanation: parsed.explanation || 'Applies modifiers directly to the 19x19 Buff Box.',
        quirkyQuote: parsed.quirkyQuote || 'Aged Golarion cheddar: +4 to survival!',
      };
    }
  }

  const lower = prompt.toLowerCase();
  if (lower.includes('mage armor') || (lower.includes('armor') && lower.includes('+4'))) {
    return {
      name: 'MageArmor',
      category: 'activatable',
      bonusType: 'Enhancement',
      values: { ac: 4 },
      macaroniSyntax: 'MageArmor:|<^AC.Enhancement+4>|$',
      coordinateSyntax: 'MageArmor:|<^{7:2}+4>|$',
      allCapsSyntax: 'MageArmor:|<^ENHANCEMENTBONUSTOAC+4>|$',
      explanation: 'Targets Column 7 (AC), Row 2 (Enhancement) with +4. Terminated with $ so re-running will not double-stack.',
      quirkyQuote: 'Invisible force-cheese! Incorporeal touch attacks hate this one weird trick.',
    };
  }

  if (lower.includes('+10') && lower.includes('ac')) {
    return {
      name: 'SustainedWard',
      category: 'activatable',
      bonusType: 'Untyped',
      values: { ac: 10 },
      macaroniSyntax: 'SustainedWard:|<^AC+10>|$',
      coordinateSyntax: 'SustainedWard:|<^{7:1}+10>|$',
      allCapsSyntax: 'SustainedWard:|<^UNTYPEDBONUSTOAC+10>|$',
      explanation: 'Creates a sustained +10 Untyped bonus to AC at Matrix {7:1} (Column 7: AC, Row 1: Untyped) and locks with $.',
      quirkyQuote: '+10 Untyped AC?! The GM just flipped the bestiary to the CR 20 pages.',
    };
  }

  if (lower.includes('bard') || lower.includes('inspire') || lower.includes('inspiration')) {
    return {
      name: 'BardicInspiration',
      category: 'activatable',
      bonusType: 'Competence',
      values: { mattack: 2, rattack: 2, will: 2 },
      macaroniSyntax: 'BardicInspiration: <^MATTACK.Competence+2, RATTACK.Competence+2, WILL.Morale+2>',
      coordinateSyntax: 'BardicInspiration: <^{2:4}+2, {3:4}+2, {6:11}+2>',
      allCapsSyntax: 'BardicInspiration: <^COMPETENCEBONUSTOMATTACK+2, COMPETENCEBONUSTORATTACK+2>',
      explanation: 'Applies +2 Competence to Melee Attack {2:4} and Ranged Attack {3:4}, plus +2 Morale to Will {6:11}.',
      quirkyQuote: 'Lute solo intensifies! Everyone gets +2 extra sharp competence.',
    };
  }

  if (lower.includes('rage') || lower.includes('barbarian')) {
    return {
      name: 'BarbarianRage',
      category: 'activatable',
      bonusType: 'Morale',
      values: { str: 4, con: 4, will: 2, ac: -2 },
      macaroniSyntax: 'BarbarianRage: <^STR.Morale+4, CON.Morale+4, WILL.Morale+2, AC-2>',
      coordinateSyntax: 'BarbarianRage: <^{8:11}+4, {10:11}+4, {6:11}+2, {7:1}-2>',
      allCapsSyntax: 'BarbarianRage: <^MORALEBONUSTOSTR+4, MORALEBONUSTOCON+4, MORALEBONUSTOWILL+2>',
      explanation: 'Grants +4 Morale to STR {8:11} and CON {10:11}, +2 Morale to Will {6:11}, and -2 penalty to AC {7:1}.',
      quirkyQuote: 'Too angry to do algebra! Smash first, count morale bonuses later.',
    };
  }

  if (lower.includes('dodge')) {
    return {
      name: 'DodgeFeat',
      category: 'permanent',
      bonusType: 'Dodge',
      values: { ac: 2 },
      macaroniSyntax: 'DodgeFeat:|<^AC.Dodge+2>|$',
      coordinateSyntax: 'DodgeFeat:|<^{7:6}+2>|$',
      allCapsSyntax: 'DodgeFeat:|<^DODGEBONUSTOAC+2>|$',
      explanation: 'Permanent +2 Dodge bonus to AC at Matrix {7:6} (Column 7: AC, Row 6: Dodge), locked with $.',
      quirkyQuote: 'Dodge bonuses stack with everything—the purest form of Pathfinder cheese!',
    };
  }

  if (lower.includes('grapple')) {
    return {
      name: 'Grappled',
      category: 'debuff',
      bonusType: 'Untyped',
      values: { dex: -4, mattack: -2, rattack: -2 },
      macaroniSyntax: 'Grappled: <^DEX-4, MATTACK-2, RATTACK-2>',
      coordinateSyntax: 'Grappled: <^{9:1}-4, {2:1}-2, {3:1}-2>',
      allCapsSyntax: 'Grappled: <^UNTYPEDPENALTYTODEX-4, UNTYPEDPENALTYTOMATTACK-2>',
      explanation: 'Applies -4 penalty to Dexterity {9:1} and -2 penalty to Melee {2:1} & Ranged {3:1} attacks.',
      quirkyQuote: 'Someone brought a tentacle monster to a sword fight. Check your CMD!',
    };
  }

  if (lower.includes('sicken')) {
    return {
      name: 'Sickened',
      category: 'debuff',
      bonusType: 'Untyped',
      values: { mattack: -2, rattack: -2, fort: -2, ref: -2, will: -2 },
      macaroniSyntax: 'Sickened: <^MATTACK-2, RATTACK-2, FORT-2, REF-2, WILL-2>',
      coordinateSyntax: 'Sickened: <^{2:1}-2, {3:1}-2, {4:1}-2, {5:1}-2, {6:1}-2>',
      allCapsSyntax: 'Sickened: <^UNTYPEDPENALTYTOMATTACK-2, UNTYPEDPENALTYTOFORT-2>',
      explanation: 'Applies -2 untyped penalty across Attacks and all three Saving Throws.',
      quirkyQuote: 'Never eat the goblin-aged Limburger found in a chest.',
    };
  }

  if (lower.includes('shaken') || lower.includes('fear')) {
    return {
      name: 'Shaken',
      category: 'debuff',
      bonusType: 'Untyped',
      values: { mattack: -2, rattack: -2, fort: -2, ref: -2, will: -2 },
      macaroniSyntax: 'Shaken: <^MATTACK-2, RATTACK-2, FORT-2, REF-2, WILL-2>',
      coordinateSyntax: 'Shaken: <^{2:1}-2, {3:1}-2, {4:1}-2, {5:1}-2, {6:1}-2>',
      allCapsSyntax: 'Shaken: <^UNTYPEDPENALTYTOMATTACK-2, UNTYPEDPENALTYTOWILL-2>',
      explanation: 'Applies -2 untyped penalty on attack rolls and saving throws while Shaken.',
      quirkyQuote: 'Knees weak, greatsword heavy, -2 on saves already (mom’s macaroni).',
    };
  }

  return {
    name: 'ArcaneBolster',
    category: 'activatable',
    bonusType: 'Enhancement',
    values: { ac: 4, mattack: 2 },
    macaroniSyntax: 'ArcaneBolster:|<^AC.Enhancement+4, MATTACK.Enhancement+2>|$',
    coordinateSyntax: 'ArcaneBolster:|<^{7:2}+4, {2:2}+2>|$',
    allCapsSyntax: 'ArcaneBolster:|<^ENHANCEMENTBONUSTOAC+4>|$',
    explanation: `Custom buff forged for ${character.name}: +4 Enhancement to AC {7:2} and +2 to Melee Attack {2:2}.`,
    quirkyQuote: 'Freshly grated arcane Parmesan sprinkled directly onto your combat stats!',
  };
}

// ==========================================
// 2. Character Voice Journal Generator
// ==========================================

export interface GeneratedJournalResult {
  title: string;
  sessionDate: string;
  content: string;
  recalledNotes: string[];
  tags: string[];
}

export async function generateJournalEntryInVoice(
  prompt: string,
  voiceSetting: string,
  character: PF1Character,
  _apiKey?: string
): Promise<GeneratedJournalResult> {
  const voice = voiceSetting.trim() || 'Terse, serious, no-nonsense, short sentences, gruff veteran';

  const systemInstruction = `You are roleplaying directly as the Pathfinder 1e character below, writing a private field journal entry into their physical leatherbound diary.
Character Dossier:
- Name: ${character.name}
- Class: ${character.characterClass} (Level ${character.level})
- Race: ${character.race}, Gender: ${character.gender || 'Unknown'}
- Alignment: ${character.alignment}, Deity: ${character.deity || 'None'}
- Personality & Background: ${character.biography?.personality || 'Hardened adventurer'}
- Voice Persona requested by player: "${voice}"

Guidelines:
1. Write in the FIRST PERSON ("I", "we", "my blade").
2. Strictly adhere to the requested voice style.
3. Extract 2-4 critical "recalled notes" to store in the journal's recall checklist.
4. Output valid JSON only with keys:
{
  "title": "Evocative session title",
  "sessionDate": "Session X - 471X AR",
  "content": "The in-character narrative text (3-5 evocative paragraphs)",
  "recalledNotes": ["Note 1", "Note 2", "Note 3"],
  "tags": ["Combat", "NPC", "Loot"]
}`;

  const serverText = await callServerGeminiGenerate({
    prompt: `Session Events to Write About: ${prompt}`,
    systemInstruction,
    responseMimeType: 'application/json',
  });

  if (serverText) {
    const parsed = safeParseJson<any>(serverText);
    if (parsed && parsed.content) {
      return {
        title: parsed.title || `Entry: ${prompt.substring(0, 30)}...`,
        sessionDate: parsed.sessionDate || `Session log - ${new Date().toLocaleDateString()}`,
        content: parsed.content,
        recalledNotes: Array.isArray(parsed.recalledNotes)
          ? parsed.recalledNotes
          : ['Check perimeter at dawn', 'Restock rations'],
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['Session Log', 'Adventure'],
      };
    }
  }

  const isGruff = /gruff|terse|serious|short|veteran/i.test(voice);
  const title = `The Blood of the Borderland`;
  const dateStr = `Session ${(character.journal?.length || 0) + 1} - 4714 AR`;

  const content = isGruff
    ? `Rain soaked through the mail before nightfall. Mud and blood underfoot. We met them near the old crossroads. No speeches. No parley. Just steel meeting iron and the stench of brimstone.\n\n` +
      `${character.name} held the line. Took a glancing cut across the pauldron, but my return strike ended the discussion. The party survived, though the horses are spooked and the rations are damp.\n\n` +
      `We made camp behind the crumbled watchtower. Fire's low to keep our presence hidden. Tomorrow we push deeper.`
    : `The winds carried the smell of ash long before we glimpsed the ruined ramparts. As ${character.name}, oath-bound to ${character.deity || 'the light'}, every step through this forsaken mire tests our resolve.\n\n` +
      `We encountered resistance where the old stone bridge arches over the gorge. Steel clashed against claws; our companions fought with admirable ferocity. The foe retreated into the gloom, leaving behind cryptic marks etched upon the basalt.\n\n` +
      `We have secured a temporary camp beneath the ruins. We tend our wounds, record what was witnessed, and prepare for the morrow.`;

  return {
    title,
    sessionDate: dateStr,
    content,
    recalledNotes: [
      `Cryptic obsidian markings spotted near the bridge`,
      `Replenish torches and holy water in next settlement`,
      `Keep second watch vigilant against stealth infiltrators`,
    ],
    tags: ['Session Log', 'Combat', 'Travel'],
  };
}

// ==========================================
// 3. Journal Pencil Sketch Generator
// ==========================================

export interface GeneratedSketchResult {
  imageUrl: string;
  quality: SketchDetailQuality;
  caption: string;
  prompt: string;
}

export async function generatePencilSketch(
  prompt: string,
  quality: SketchDetailQuality,
  _apiKey?: string
): Promise<GeneratedSketchResult> {
  const proceduralDataUrl = generateProceduralPencilSketch({
    subject: prompt,
    quality,
    width: 560,
    height: 400,
    tint: 'graphite',
  });

  return {
    imageUrl: proceduralDataUrl,
    quality,
    caption: `Graphite pencil sketch: ${prompt} [${quality} detail]`,
    prompt,
  };
}

// ==========================================
// 4. Broad Sheet Authority & Blind Spot Enforced Field Modifier
// ==========================================

export interface SheetModificationAction {
  category: keyof AIModuleSettings['allowedFields'];
  label: string;
  details: string;
  isBlockedByBlindSpot?: boolean;
  blindSpotLabel?: string;
  apply: (prev: PF1Character) => PF1Character;
}

export function parseNaturalLanguageSheetUpdates(
  instruction: string,
  character: PF1Character,
  permissions: AIModuleSettings['allowedFields']
): SheetModificationAction[] {
  const actions: SheetModificationAction[] = [];
  const text = instruction.toLowerCase();

  const isAllowed = (key: keyof AIModuleSettings['allowedFields']) => {
    return (permissions?.[key] ?? true) !== false;
  };

  const pushActionOrBlindSpot = (
    category: keyof AIModuleSettings['allowedFields'],
    blindSpotLabel: string,
    label: string,
    details: string,
    apply: (prev: PF1Character) => PF1Character
  ) => {
    if (!isAllowed(category)) {
      actions.push({
        category,
        label: `[AI Blind Spot Blocked] ${label}`,
        details: `${blindSpotLabel} is currently in the AI's Blind Spots (Module Permissions). Enable it to allow this update.`,
        isBlockedByBlindSpot: true,
        blindSpotLabel,
        apply: (prev) => prev,
      });
    } else {
      actions.push({
        category,
        label,
        details,
        apply,
      });
    }
  };

  // 1. HP & Vitals modification: e.g. "take 12 damage", "heal 8 hp", "add 10 temp hp"
  const damageMatch = text.match(/(?:take|took|suffer|lose|lost)\s+(\d+)\s*(?:points?\s+of\s+)?(?:damage|dmg|hp|health)/);
  if (damageMatch) {
    const amount = parseInt(damageMatch[1], 10);
    pushActionOrBlindSpot(
      'hp',
      'HP & Vitals',
      `Apply ${amount} Damage`,
      `Reduce current HP from ${character.hpCurrent} to ${Math.max(-10, character.hpCurrent - amount)}`,
      (prev) => ({
        ...prev,
        hpCurrent: Math.max(-10, prev.hpCurrent - amount),
      })
    );
  }

  const healMatch = text.match(/(?:heal|healed|recover|recovered|gain|gained)\s+(\d+)\s*(?:points?\s+of\s+)?(?:hp|health|hit points?)/);
  if (healMatch) {
    const amount = parseInt(healMatch[1], 10);
    pushActionOrBlindSpot(
      'hp',
      'HP & Vitals',
      `Heal +${amount} HP`,
      `Increase current HP from ${character.hpCurrent} to ${Math.min(character.hpTotalMax, character.hpCurrent + amount)}`,
      (prev) => ({
        ...prev,
        hpCurrent: Math.min(prev.hpTotalMax, prev.hpCurrent + amount),
      })
    );
  }

  const tempHpMatch = text.match(/(?:gain|add|set)\s+(\d+)\s*(?:temp|temporary)\s*(?:hp|hit points?)/);
  if (tempHpMatch) {
    const amount = parseInt(tempHpMatch[1], 10);
    pushActionOrBlindSpot(
      'hp',
      'HP & Vitals',
      `Set Temporary HP to ${amount}`,
      `Update Temp HP from ${character.hpTemp} to ${amount}`,
      (prev) => ({ ...prev, hpTemp: amount })
    );
  }

  // 2. Ability Scores (STR, DEX, CON, INT, WIS, CHA): e.g. "set str to 18", "increase dex by 2"
  const bundleStatsMatch = instruction.match(/(?:set\s+stats|stats:?)\s*(.*)/i);
  if (bundleStatsMatch) {
    const raw = bundleStatsMatch[1];
    const statMatches = Array.from(raw.matchAll(/(STR|DEX|CON|INT|WIS|CHA)\s*[:=]?\s*(\d+)/gi));
    if (statMatches.length > 0) {
      const summaryList = statMatches.map((m) => `${m[1].toUpperCase()} ${m[2]}`).join(', ');
      pushActionOrBlindSpot(
        'abilities',
        'Ability Scores',
        `Set Ability Array (${summaryList})`,
        `Update ability scores to ${summaryList}`,
        (prev) => {
          const updated = { ...prev.abilities };
          for (const m of statMatches) {
            const ab = m[1].toUpperCase() as AbilityName;
            const score = parseInt(m[2], 10);
            if (updated[ab]) {
              updated[ab] = { ...updated[ab], base: score };
            }
          }
          return { ...prev, abilities: updated };
        }
      );
    }
  }

  const abilSetMatch = text.match(/(?:set|change)\s+(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(?:to\s+)?(\d+)/i);
  if (abilSetMatch) {
    const rawAb = abilSetMatch[1].toUpperCase().slice(0, 3) as AbilityName;
    const score = parseInt(abilSetMatch[2], 10);
    pushActionOrBlindSpot(
      'abilities',
      'Ability Scores',
      `Set ${rawAb} Base Score to ${score}`,
      `Change ${rawAb} base from ${character.abilities[rawAb]?.base ?? 10} to ${score}`,
      (prev) => ({
        ...prev,
        abilities: {
          ...prev.abilities,
          [rawAb]: { ...prev.abilities[rawAb], base: score },
        },
      })
    );
  }

  // 3. Core Identity, Level & XP: e.g. "set name to Ailen Vane", "set race to Elf", "set class to Slayer"
  const nameMatch = instruction.match(/(?:set\s+name\s+to|name:\s*)([^\n,]+)/i);
  if (nameMatch) {
    const val = nameMatch[1].trim();
    if (val && val.length > 1) {
      pushActionOrBlindSpot(
        'coreIdentity',
        'Core Identity & Level',
        `Set Character Name: ${val}`,
        `Update character name from "${character.name || 'Unnamed'}" to "${val}"`,
        (prev) => ({ ...prev, name: val })
      );
    }
  }

  const raceMatch = instruction.match(/(?:set\s+race\s+to|race:\s*)([^\n,]+)/i);
  if (raceMatch) {
    const val = raceMatch[1].trim();
    if (val) {
      pushActionOrBlindSpot(
        'coreIdentity',
        'Core Identity & Level',
        `Set Race: ${val}`,
        `Update race to "${val}"`,
        (prev) => ({ ...prev, race: val })
      );
    }
  }

  const classMatch = instruction.match(/(?:set\s+class\s+to|class:\s*)([^\n,]+)/i);
  if (classMatch) {
    const val = classMatch[1].trim();
    if (val) {
      pushActionOrBlindSpot(
        'coreIdentity',
        'Core Identity & Level',
        `Set Class: ${val}`,
        `Update character class to "${val}"`,
        (prev) => ({ ...prev, characterClass: val })
      );
    }
  }

  const alignMatch = instruction.match(/(?:set\s+alignment\s+to|alignment:\s*)([^\n,]+)/i);
  if (alignMatch) {
    const val = alignMatch[1].trim();
    if (val) {
      pushActionOrBlindSpot(
        'coreIdentity',
        'Core Identity & Level',
        `Set Alignment: ${val}`,
        `Update alignment to "${val}"`,
        (prev) => ({ ...prev, alignment: val })
      );
    }
  }

  const deityMatch = instruction.match(/(?:set\s+deity\s+to|deity:\s*)([^\n,]+)/i);
  if (deityMatch) {
    const val = deityMatch[1].trim();
    if (val) {
      pushActionOrBlindSpot(
        'coreIdentity',
        'Core Identity & Level',
        `Set Deity: ${val}`,
        `Update deity to "${val}"`,
        (prev) => ({ ...prev, deity: val })
      );
    }
  }

  const levelSetMatch = text.match(/(?:set\s+level\s+to|level\s+up\s+to)\s+(\d+)/i);
  if (levelSetMatch) {
    const newLvl = Math.max(1, Math.min(20, parseInt(levelSetMatch[1], 10)));
    pushActionOrBlindSpot(
      'coreIdentity',
      'Core Identity & Level',
      `Set Character Level to ${newLvl}`,
      `Update character level from ${character.level} to ${newLvl} (triggers odd-level feat check)`,
      (prev) => ({ ...prev, level: newLvl })
    );
  } else if (text.includes('level up')) {
    const newLvl = Math.min(20, (character.level || 1) + 1);
    pushActionOrBlindSpot(
      'coreIdentity',
      'Core Identity & Level',
      `Level Up to Level ${newLvl}`,
      `Advance character level from ${character.level} to ${newLvl}`,
      (prev) => ({ ...prev, level: newLvl })
    );
  }

  const xpMatch = text.match(/(?:add|gain|earned)\s+(\d+)\s*xp/i);
  if (xpMatch) {
    const xpAdd = parseInt(xpMatch[1], 10);
    pushActionOrBlindSpot(
      'coreIdentity',
      'Core Identity & Level',
      `Add +${xpAdd} XP`,
      `Increase XP from ${character.currentXP} to ${character.currentXP + xpAdd}`,
      (prev) => ({ ...prev, currentXP: (prev.currentXP || 0) + xpAdd })
    );
  }

  // 4. Armor Class (Natural, Deflection, Dodge, Misc): e.g. "set natural armor to 3", "add 2 deflection to ac"
  const acModMatch = text.match(/(?:set|add)\s+\+?(-?\d+)\s+(natural(?:\s+armor)?|deflection|dodge)\s*(?:to\s+ac|bonus|armor)?/i);
  if (acModMatch) {
    const val = parseInt(acModMatch[1], 10);
    const kind = acModMatch[2].toLowerCase();
    const fieldKey = kind.startsWith('natural')
      ? 'naturalArmorMod'
      : kind.startsWith('deflection')
      ? 'deflectionMod'
      : 'dodgeMod';
    pushActionOrBlindSpot(
      'armorClass',
      'Armor Class & Defenses',
      `Set ${acModMatch[2]} AC Bonus to ${val >= 0 ? `+${val}` : val}`,
      `Update ${fieldKey} to ${val}`,
      (prev) => ({ ...prev, [fieldKey]: val })
    );
  }

  // 5. Saving Throws: e.g. "set base fort to 6", "set will base to 5"
  const saveMatch = text.match(/set\s+(?:base\s+)?(fort|fortitude|ref|reflex|will)\s+(?:base\s+)?to\s+\+?(\d+)/i);
  if (saveMatch) {
    const rawSave = saveMatch[1].toLowerCase();
    const saveKey = rawSave.startsWith('fort')
      ? 'fortitude'
      : rawSave.startsWith('ref')
      ? 'reflex'
      : 'will';
    const val = parseInt(saveMatch[2], 10);
    pushActionOrBlindSpot(
      'saves',
      'Saving Throws',
      `Set ${saveKey.toUpperCase()} Base Save to +${val}`,
      `Update ${saveKey} base save to +${val}`,
      (prev) => ({
        ...prev,
        saves: {
          ...prev.saves,
          [saveKey]: { ...prev.saves[saveKey], base: val },
        },
      })
    );
  }

  // 6. Feats: e.g. "add feat Outflank", "learn feat Dodge"
  const featAddMatch = instruction.match(/(?:add|learn|gain)\s+feat\s+([^:.\n]+)(?:[:.-]\s*(.+))?/i);
  if (featAddMatch) {
    const fName = featAddMatch[1].trim();
    const fSum = (featAddMatch[2] || 'Added via AI Sheet Authority.').trim();
    pushActionOrBlindSpot(
      'feats',
      'Feats & Special Qualities',
      `Add Feat: ${fName}`,
      `Add "${fName}" to character feats list`,
      (prev) => ({
        ...prev,
        characterFeats: [
          ...(prev.characterFeats || []),
          {
            id: `feat-ai-${Date.now()}`,
            name: fName,
            type: 'General',
            prerequisites: 'None',
            summary: fSum,
          },
        ],
      })
    );
  }

  // 7. Actions & Class Resources: e.g. "reset all pools", "add action Studied Target: +1 attack and damage", "add resource Ki Pool max 4"
  const actionAddMatch = instruction.match(/(?:add|learn|gain)\s+action\s+([^:.\n]+)(?:[:.-]\s*(.+))?/i);
  if (actionAddMatch) {
    const aName = actionAddMatch[1].trim();
    const aDesc = (actionAddMatch[2] || 'Added via AI Sheet Authority.').trim();
    pushActionOrBlindSpot(
      'actionsAndResources',
      'Action & Class Resource Directory',
      `Add Action: ${aName}`,
      `Add "${aName}" to Actions & Resource Directory`,
      (prev) => ({
        ...prev,
        characterActions: [
          ...(prev.characterActions || []),
          {
            id: `act-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: aName,
            category: 'Class Ability',
            actionType: 'Standard',
            description: aDesc,
            shortSummary: aDesc.slice(0, 80),
          },
        ],
      })
    );
  }

  const resAddMatch = instruction.match(/add\s+resource\s+([^:.\n]+?)\s+max\s+(\d+)/i);
  if (resAddMatch) {
    const rName = resAddMatch[1].trim();
    const rMax = parseInt(resAddMatch[2], 10);
    pushActionOrBlindSpot(
      'actionsAndResources',
      'Action & Class Resource Directory',
      `Add Resource: ${rName} (Max ${rMax})`,
      `Add "${rName}" pool with ${rMax} daily uses`,
      (prev) => ({
        ...prev,
        resourceTrackers: [
          ...(prev.resourceTrackers || []),
          {
            id: `res-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: rName,
            current: rMax,
            max: rMax,
            category: 'Class Resource',
          },
        ],
      })
    );
  }

  if (text.includes('reset all pool') || text.includes('refresh all pool') || text.includes('long rest')) {
    pushActionOrBlindSpot(
      'actionsAndResources',
      'Action & Class Resource Directory',
      'Reset All Daily Class Resource Pools',
      'Restore all action & resource trackers to their maximum uses',
      (prev) => ({
        ...prev,
        characterActions: (prev.characterActions || []).map((a) =>
          a.hasResourcePool && typeof a.resourceMax === 'number'
            ? { ...a, resourceCurrent: a.resourceMax }
            : a
        ),
        resourceTrackers: (prev.resourceTrackers || []).map((r) => ({ ...r, current: r.max })),
      })
    );
  }

  // 8. Skills & Class Skills: e.g. "set perception ranks to 5", "unlock class skills: Acrobatics, Stealth", "clear class skills", "train stealth"
  if (text.includes('clear class skills') || text.includes('reset class skills')) {
    pushActionOrBlindSpot(
      'skills',
      'Skills Matrix',
      'Clear All Checked Class Skills',
      'Uncheck isClassSkill on all 35 skills',
      (prev) => ({
        ...prev,
        skills: (prev.skills || []).map((s) => ({ ...s, isClassSkill: false })),
      })
    );
  }

  const unlockSkillsMatch = instruction.match(/(?:unlock\s+class\s+skills|set\s+class\s+skills\s+to)\s*:\s*(.+)/i);
  if (unlockSkillsMatch) {
    const rawList = unlockSkillsMatch[1]
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (rawList.length > 0) {
      pushActionOrBlindSpot(
        'skills',
        'Skills Matrix',
        `Unlock ${rawList.length} Class Skill(s)`,
        `Mark class skills: ${unlockSkillsMatch[1].slice(0, 80)}`,
        (prev) => ({
          ...prev,
          skills: (prev.skills || []).map((sk) => {
            const skLower = sk.name.toLowerCase();
            const isMatch = rawList.some(
              (target) =>
                skLower === target ||
                skLower.startsWith(target) ||
                target.startsWith(skLower.split(' (')[0])
            );
            return isMatch ? { ...sk, isClassSkill: true } : sk;
          }),
        })
      );
    }
  }

  const skillRankMatch = text.match(/set\s+([a-z\s()]+?)\s+ranks?\s+to\s+(\d+)/i);
  if (skillRankMatch) {
    const targetSkill = skillRankMatch[1].trim().toLowerCase();
    const ranks = parseInt(skillRankMatch[2], 10);
    pushActionOrBlindSpot(
      'skills',
      'Skills Matrix',
      `Set "${skillRankMatch[1].trim()}" Ranks to ${ranks}`,
      `Update skill ranks to ${ranks}`,
      (prev) => ({
        ...prev,
        skills: (prev.skills || []).map((s) =>
          s.name.toLowerCase().includes(targetSkill) ? { ...s, ranks } : s
        ),
      })
    );
  }

  const trainSkillMatch = instruction.match(/(?:train|max\s+out)\s+([a-z\s(),and]+?)(?:\s+skills?)?$/i);
  if (trainSkillMatch && !text.includes('armor training') && !text.includes('weapon training')) {
    const mentionedSkills = PF1E_CANONICAL_SKILLS.filter((canonical) =>
      trainSkillMatch[1].toLowerCase().includes(canonical.toLowerCase().split(' (')[0])
    );
    if (mentionedSkills.length > 0) {
      pushActionOrBlindSpot(
        'skills',
        'Skills Matrix',
        `Train Skill(s): ${mentionedSkills.join(', ')}`,
        `Set ranks to character level (${character.level || 1}) and mark as class skill`,
        (prev) => ({
          ...prev,
          skills: (prev.skills || []).map((s) =>
            mentionedSkills.some((m) => s.name.toLowerCase().startsWith(m.toLowerCase().split(' (')[0]))
              ? { ...s, isClassSkill: true, ranks: Math.max(s.ranks, prev.level || 1) }
              : s
          ),
        })
      );
    }
  }

  // 9. Conditions toggle: e.g. "become fatigued", "remove shaken", "add prone"
  const conditionKeys: Array<keyof typeof character.conditions> = [
    'fatigued',
    'exhausted',
    'shaken',
    'frightened',
    'sickened',
    'stunned',
    'blinded',
    'prone',
    'entangled',
    'grappled',
    'pinned',
    'haste',
    'heroism',
  ];

  for (const cond of conditionKeys) {
    if (text.includes(`remove ${cond}`) || text.includes(`cure ${cond}`) || text.includes(`clear ${cond}`)) {
      pushActionOrBlindSpot(
        'conditions',
        'Conditions & Status Effects',
        `Clear Condition: ${cond.toUpperCase()}`,
        `Set ${cond} condition to FALSE`,
        (prev) => ({
          ...prev,
          conditions: { ...prev.conditions, [cond]: false },
        })
      );
    } else if (
      text.includes(cond) &&
      (text.includes('become') ||
        text.includes('apply') ||
        text.includes('is now') ||
        text.includes('got') ||
        text.includes('gained'))
    ) {
      pushActionOrBlindSpot(
        'conditions',
        'Conditions & Status Effects',
        `Apply Condition: ${cond.toUpperCase()}`,
        `Set ${cond} condition to TRUE`,
        (prev) => ({
          ...prev,
          conditions: { ...prev.conditions, [cond]: true },
        })
      );
    }
  }

  // 10. Currency modification: e.g. "found 150 gp", "spent 25 gold"
  const gpGainMatch = text.match(/(?:found|gain|gained|earned|receive|received|add|set\s+gold\s+to)\s+(\d+)\s*(?:gp|gold)/);
  if (gpGainMatch) {
    const amount = parseInt(gpGainMatch[1], 10);
    pushActionOrBlindSpot(
      'currency',
      'Currency & Wealth',
      `Add +${amount} GP`,
      `Gold increases from ${character.currency.gp} to ${character.currency.gp + amount} gp`,
      (prev) => ({
        ...prev,
        currency: { ...prev.currency, gp: prev.currency.gp + amount },
      })
    );
  }

  const gpSpendMatch = text.match(/(?:spent|spend|paid|pay|lose|lost)\s+(\d+)\s*(?:gp|gold)/);
  if (gpSpendMatch) {
    const amount = parseInt(gpSpendMatch[1], 10);
    pushActionOrBlindSpot(
      'currency',
      'Currency & Wealth',
      `Deduct -${amount} GP`,
      `Gold decreases from ${character.currency.gp} to ${Math.max(0, character.currency.gp - amount)} gp`,
      (prev) => ({
        ...prev,
        currency: { ...prev.currency, gp: Math.max(0, prev.currency.gp - amount) },
      })
    );
  }

  // 11. Inventory item addition: e.g. "add 2 potions of cure light wounds to backpack"
  const itemMatch = text.match(
    /(?:add|found|received?|loot|looted)\s+(\d+)?\s*([a-zA-Z\s]+?)\s*(?:to\s+(backpack|gear|inventory))?$/i
  );
  if (
    itemMatch &&
    !text.includes('damage') &&
    !text.includes('hp') &&
    !text.includes('feat') &&
    !text.includes('action') &&
    !text.includes('resource') &&
    !text.includes('spell') &&
    !text.includes('weapon') &&
    !text.includes('armor') &&
    !text.includes('xp')
  ) {
    const qty = itemMatch[1] ? parseInt(itemMatch[1], 10) : 1;
    const itemName = itemMatch[2].trim();
    if (itemName.length > 2 && !['gp', 'gold', 'hp', 'damage'].includes(itemName)) {
      pushActionOrBlindSpot(
        'inventory',
        'Inventory & Containers',
        `Add Item: ${qty}x ${itemName}`,
        `Add to stored inventory with quantity ${qty}`,
        (prev) => ({
          ...prev,
          inventory: [
            ...(prev.inventory || []),
            {
              id: `inv-ai-${Date.now()}`,
              name: itemName,
              quantity: qty,
              weight: 1,
              location: 'Backpack',
              storageType: 'stored',
              category: 'Gear',
              notes: 'Acquired during session',
            },
          ],
        })
      );
    }
  }

  // 12. Notes / Scratchpad append
  if (text.includes('note:') || text.includes('remind me') || text.includes('remember that')) {
    const cleanNote = instruction.replace(/^(?:add\s+)?(?:note|remind me|remember that):?\s*/i, '').trim();
    if (cleanNote) {
      pushActionOrBlindSpot(
        'notes',
        'Notes & Scratchpad',
        'Append to Scratchpad',
        `Add "${cleanNote}" to character session scratchpad`,
        (prev) => ({
          ...prev,
          characterBio: {
            portraits: prev.characterBio?.portraits || [],
            currentPortraitIndex: prev.characterBio?.currentPortraitIndex || 0,
            bioSections: prev.characterBio?.bioSections || [],
            skin: prev.characterBio?.skin || '',
            ...prev.characterBio,
            scratchpad: `${prev.characterBio?.scratchpad || ''}\n- [Session Note] ${cleanNote}`.trim(),
          },
        })
      );
    }
  }

  // 13. Hit Die, Max HP, BAB & Skill Points/Level: e.g. "set hit die to d10", "set max hp to 24", "set bab to 4", "set skill points per level to 6"
  const hdMatch = instruction.match(/set\s+hit\s*die\s+to\s+d?(\d+)/i);
  if (hdMatch) {
    const hd = parseInt(hdMatch[1], 10);
    pushActionOrBlindSpot(
      'hp',
      'HP & Vitals',
      `Set Hit Die: d${hd}`,
      `Update class hit die size to d${hd}`,
      (prev) => ({
        ...prev,
        hitDice: `${prev.level || 1}d${hd}`,
        hpBreakdown: { ...prev.hpBreakdown, hitDiceSize: hd },
      })
    );
  }

  const maxHpMatch = instruction.match(/set\s+max\s*(?:hp|hit\s*points?)\s+to\s+(\d+)/i);
  if (maxHpMatch) {
    const hpVal = parseInt(maxHpMatch[1], 10);
    pushActionOrBlindSpot(
      'hp',
      'HP & Vitals',
      `Set Max HP to ${hpVal}`,
      `Update maximum HP to ${hpVal}`,
      (prev) => ({
        ...prev,
        hpTotalMax: hpVal,
        hpCurrent: hpVal,
      })
    );
  }

  const babSetMatch = instruction.match(/set\s+(?:bab|base\s+attack\s+bonus)\s+to\s+\+?(\d+)/i);
  if (babSetMatch) {
    const babVal = parseInt(babSetMatch[1], 10);
    pushActionOrBlindSpot(
      'attacksAndWeapons',
      'Weapons & Attack Matrix',
      `Set Base Attack Bonus to +${babVal}`,
      `Update BAB to +${babVal}`,
      (prev) => ({
        ...prev,
        baseAttackBonus: babVal,
      })
    );
  }

  const spSetMatch = instruction.match(/set\s+skill\s+(?:points|ranks)\s+per\s+level\s+to\s+(\d+)/i);
  if (spSetMatch) {
    const spVal = parseInt(spSetMatch[1], 10);
    pushActionOrBlindSpot(
      'skills',
      'Skills Matrix',
      `Set Skill Ranks/Level to ${spVal} + INT`,
      `Update classSkillPointsPerLevel to ${spVal}`,
      (prev) => ({
        ...prev,
        classSkillPointsPerLevel: spVal,
      })
    );
  }

  // 14. Weapons & Armor: e.g. "equip weapon Kukri | 1d4 + str_mod | 18-20/x2 | Melee | Slashing"
  const weaponPipeMatch = instruction.match(/equip\s+weapon\s+([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)(?:\|(.+))?/i);
  if (weaponPipeMatch) {
    const wName = weaponPipeMatch[1].trim();
    const wDmg = weaponPipeMatch[2].trim();
    const wCrit = weaponPipeMatch[3].trim();
    const wCat = weaponPipeMatch[4].trim() as 'Melee' | 'Ranged';
    const wType = (weaponPipeMatch[5] || 'Slashing').trim();
    pushActionOrBlindSpot(
      'attacksAndWeapons',
      'Weapons & Attack Matrix',
      `Equip Weapon: ${wName} (${wDmg}, ${wCrit})`,
      `Add "${wName}" to equipped weapons`,
      (prev) => ({
        ...prev,
        weapons: [
          ...(prev.weapons || []).filter((w) => w.name.toLowerCase() !== wName.toLowerCase()),
          {
            id: `wp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: wName,
            category: wCat === 'Ranged' ? 'Ranged' : 'Melee',
            damageFormula: wDmg,
            critical: wCrit,
            range: wCat === 'Ranged' ? '80 ft.' : 'Melee',
            damageType: wType,
            weight: 3,
            isEquipped: true,
          },
        ],
      })
    );
  }

  const armorPipeMatch = instruction.match(/equip\s+armor\s+([^|]+)\|(\d+)\|(\d+)\|(-?\d+)\|(.+)/i);
  if (armorPipeMatch) {
    const aName = armorPipeMatch[1].trim();
    const aAc = parseInt(armorPipeMatch[2], 10);
    const aMaxDex = parseInt(armorPipeMatch[3], 10);
    const aAcp = parseInt(armorPipeMatch[4], 10);
    const aType = armorPipeMatch[5].trim() as 'Light' | 'Medium' | 'Heavy' | 'Shield';
    pushActionOrBlindSpot(
      'armorAndGear',
      'Equipped Armor & Shield',
      `Equip Armor: ${aName} (+${aAc} AC)`,
      `Equip "${aName}" (${aType}, +${aAc} AC, Max Dex +${aMaxDex})`,
      (prev) => ({
        ...prev,
        armor: [
          ...(prev.armor || []).filter((a) => a.name.toLowerCase() !== aName.toLowerCase()),
          {
            id: `ar-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: aName,
            type: aType,
            acBonus: aAc,
            maxDex: aMaxDex,
            checkPenalty: aAcp,
            spellFailure: aType === 'Light' ? 15 : aType === 'Medium' ? 25 : 35,
            speed30: aType === 'Light' ? 30 : 20,
            weight: aType === 'Light' ? 15 : 30,
            isEquipped: true,
          },
        ],
      })
    );
  }

  // 15. Spells: e.g. "add spell Haste level 3"
  const spellAddMatch = instruction.match(/add\s+spell\s+([^:.\n]+?)\s+level\s+(\d+)(?:[:.-]\s*(.+))?/i);
  if (spellAddMatch) {
    const sName = spellAddMatch[1].trim();
    const sLvl = parseInt(spellAddMatch[2], 10);
    const sDesc = (spellAddMatch[3] || 'Added via AI Sheet Authority.').trim();
    pushActionOrBlindSpot(
      'spellsAndMagic',
      'Spells & Magic System',
      `Add Spell: ${sName} (Lvl ${sLvl})`,
      `Add "${sName}" to spellbook at spell level ${sLvl}`,
      (prev) => ({
        ...prev,
        spells: [
          ...(prev.spells || []),
          {
            id: `spell-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: sName,
            level: sLvl,
            school: 'Transmutation',
            castTime: '1 standard action',
            range: 'Close',
            duration: '1 round/level',
            save: 'None',
            spellResistance: 'No',
            preparedCount: 1,
            isCast: false,
            description: sDesc,
          },
        ],
      })
    );
  }

  // 16. Bio & Profile Backstory: e.g. "set backstory to Veteran marsh scout..."
  const bioMatch = instruction.match(/set\s+backstory\s+to\s+(.+)/i);
  if (bioMatch) {
    const textVal = bioMatch[1].trim();
    pushActionOrBlindSpot(
      'bioAndProfile',
      'Character Profile & Bio',
      'Set Character Backstory',
      `Update backstory notes (${textVal.slice(0, 60)}...)`,
      (prev) => ({
        ...prev,
        characterBio: {
          portraits: prev.characterBio?.portraits || [],
          currentPortraitIndex: prev.characterBio?.currentPortraitIndex || 0,
          bioSections: prev.characterBio?.bioSections || [],
          skin: prev.characterBio?.skin || '',
          ...prev.characterBio,
          scratchpad: `${prev.characterBio?.scratchpad || ''}\n\n[Character Backstory]\n${textVal}`.trim(),
        },
      })
    );
  }

  return actions;
}

// ==========================================
// 5. Macro-Sensitive Scratchpad AI Listener (>>#AI$, >>AI$, >>#ai!, >>AI)
// ==========================================

export interface ScratchpadMacroRunResult {
  updatedText: string;
  generatedReply: string;
  matchedPrompt: string;
  directiveType: 'chat_locked' | 'idea_repeatable' | 'flavor_backstory' | 'unclosed_repeat';
  usedJournalContext: boolean;
}

const REPEATABLE_BUILD_SUGGESTIONS = [
  'Elf Barbarian (Invulnerable Rager) — Mayfly Bregata, wild marshlander who shrugs off bog-iron blades',
  'Half-Orc Warpriest / Totemist — Googler Dimcoc, sacred claw-channeler bound to ancient swamp totems',
  'Human Bard (Arcane Duelist / Fencer) — Flyn Penius, quick-witted rapier duelist who weaves spell-parries into every lunge',
  'Human Investigator (Empiricist) — Vance Halberg, alchemical sleuth cataloging cursed relics with cold precision',
  'Half-Elf Ranger (Trapper) / Rogue — Ailen Vane, marsh scout and snare-master on the run from rougarou enforcers',
  'Dwarf Inquisitor (Spellbreaker) — Torgga Ironvein, grumpy witch-hunter who dispels hexes with a warhammer',
  'Tiefling Magus (Bladebound) — Kaelen Ash, duelist whose sentient black-blade whispers forgotten tactical secrets',
];

export async function executeScratchpadAIMacro(
  fullScratchpadText: string,
  character: PF1Character,
  _apiKey?: string
): Promise<ScratchpadMacroRunResult> {
  const lines = fullScratchpadText.split(/\r?\n/);
  const aiDirectiveRegex = /^(.*?)\s*>>\s*(#?ai)([!$]?)(\s*)$/i;

  let targetLineIdx = -1;
  let promptText = '';
  let hasHash = false;
  let terminator = '';

  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(aiDirectiveRegex);
    if (m) {
      targetLineIdx = i;
      promptText = m[1].trim();
      hasHash = m[2].startsWith('#');
      terminator = m[3] || '';
      break;
    }
  }

  if (targetLineIdx === -1) {
    return {
      updatedText: fullScratchpadText,
      generatedReply:
        'Tip: Add >>#AI$ (chat/journal), >>AI$ (build suggestions), or >>#ai! (backstory/memo) at the end of a line and hit Run!',
      matchedPrompt: '',
      directiveType: 'chat_locked',
      usedJournalContext: false,
    };
  }

  const lowerPrompt = promptText.toLowerCase();
  const directiveType: ScratchpadMacroRunResult['directiveType'] =
    terminator === '!'
      ? 'flavor_backstory'
      : !terminator
      ? 'unclosed_repeat'
      : !hasHash
      ? 'idea_repeatable'
      : 'chat_locked';

  const journalAllowed =
    (character.installedModules?.aiSettings?.allowedFields?.journal ?? true) !== false;
  const journalEntries = journalAllowed ? character.journal || [] : [];
  const journalSummary =
    journalEntries.length > 0
      ? journalEntries
          .slice(0, 5)
          .map(
            (e) =>
              `[Journal: "${e.title}" | Location: ${e.location || 'Unknown'} | Content: ${e.content.slice(
                0,
                300
              )} | Recall Notes: ${(e.recalledNotes || []).join('; ')}]`
          )
          .join('\n')
      : journalAllowed
      ? '[No journal entries recorded yet]'
      : '[Journal is in AI Blind Spots — AI is not permitted to read Journal entries]';

  const { overrideText, activeUrls } = buildSOTContextForAI(character);

  const mentionsJournal =
    lowerPrompt.includes('journal') ||
    lowerPrompt.includes('notes') ||
    lowerPrompt.includes('setting') ||
    lowerPrompt.includes('log');

  const existingFollowupLines = lines.slice(targetLineIdx + 1).filter((l) => l.trim().length > 0);

  if (directiveType === 'chat_locked' && existingFollowupLines.length > 0) {
    return {
      updatedText: fullScratchpadText,
      generatedReply: `Locked by $: "${promptText}" already ran. Write a new line ending in >>#AI$ to continue the conversation, or use >>AI$ to generate multiple suggestions!`,
      matchedPrompt: promptText,
      directiveType,
      usedJournalContext: mentionsJournal,
    };
  }

  const systemInstruction = `You are an in-sheet Pathfinder 1st Edition Build Planner & Campaign Assistant living inside the player's Macaroni Scratchpad.
Current Character Sheet: ${character.name || 'Unnamed'} (${character.race || 'Human'} ${character.characterClass || 'Adventurer'} Lvl ${character.level || 1})
Campaign Journal Context:
${journalSummary}
${overrideText ? `\nSource of Truth (SOT) Override Rules:\n${overrideText}\n` : ''}
Recent Scratchpad Conversation:
${lines.slice(Math.max(0, targetLineIdx - 8), targetLineIdx + 1).join('\n')}

Rules based on Macaroni directive (${hasHash ? '#' : ''}AI${terminator}):
- If directive is >>AI$ or >>AI (repeatable suggestion mode): Output 1 concise, creative single-line Pathfinder 1e character build idea (Race + Class/Archetype + quirky character name + 5-word hook) that hasn't been listed in the scratchpad yet.
- If directive is >>#ai! (backstory/memo mode): Output a punchy 2-3 sentence character backstory or in-world campaign memo ready to copy to the Journal.
- If directive is >>#AI$ (conversational advisor): Answer in 1-3 concise lines. If the user asks "What should I make for this game" and hasn't specified the setting, ask "What's the setting of the adventure?" first. If they say "It's in my journal", explicitly reference their journal entry title/location/notes and suggest a fitting build!`;

  const repeatCount = directiveType === 'unclosed_repeat' ? 2 : 1;
  const generatedLines: string[] = [];

  for (let r = 0; r < repeatCount; r++) {
    const reply = await callServerGeminiGenerate({
      prompt: `Active Player Prompt: ${promptText}\nAlready suggested below this line: ${existingFollowupLines
        .concat(generatedLines)
        .join(' | ')}`,
      systemInstruction,
      urls: activeUrls,
    });
    if (reply) {
      generatedLines.push(reply);
    }
  }

  if (generatedLines.length > 0) {
    const combinedReply = generatedLines.join('\n');
    const updatedText = `${fullScratchpadText.trimEnd()}\n${combinedReply}`;
    return {
      updatedText,
      generatedReply: combinedReply,
      matchedPrompt: promptText,
      directiveType,
      usedJournalContext: mentionsJournal,
    };
  }

  // Intelligent Local PF1e Conversational & Build Engine
  let reply = '';

  if (
    lowerPrompt.includes('what should i make') ||
    lowerPrompt.includes('what to play') ||
    lowerPrompt.includes('build idea')
  ) {
    reply = "What's the setting of the adventure?";
  } else if (mentionsJournal) {
    if (!journalAllowed) {
      reply =
        '[AI Blind Spot Notice]: Session Journal is currently in my Blind Spots (Module Permissions). Enable Journal access there if you want me to read your journal setting!';
    } else {
      const firstEntry = journalEntries[0];
      const locName = firstEntry?.location || firstEntry?.title || 'Patrivia Marsh';
      const noteHint =
        firstEntry?.recalledNotes?.[0] || 'the local enforcers and treacherous terrain';
      reply = `I've read your journal entry for ${locName} (${noteHint}).\nTabaxi/Catfolk Rogue? Ailen the Catfolk Thief on the run from the rougarou enforcers—high Stealth, Climb, and Scout archetype for marsh ambushes!`;
    }
  } else if (
    directiveType === 'idea_repeatable' ||
    directiveType === 'unclosed_repeat' ||
    lowerPrompt.includes('suggestion') ||
    lowerPrompt.includes('more human') ||
    lowerPrompt.includes('couple')
  ) {
    const usedText = fullScratchpadText.toLowerCase();
    const available = REPEATABLE_BUILD_SUGGESTIONS.filter(
      (s) => !usedText.includes(s.slice(0, 22).toLowerCase())
    );
    const pool = available.length > 0 ? available : REPEATABLE_BUILD_SUGGESTIONS;

    if (directiveType === 'unclosed_repeat') {
      const batch = pool.slice(0, 2);
      reply = `${batch.join('\n')}\n[Note: Unclosed >>AI repeated 2x (scope-limited to prevent loop crashes; add $ to lock single runs)]`;
    } else {
      const nextPick = pool[existingFollowupLines.length % pool.length];
      reply = nextPick;
    }
  } else if (
    lowerPrompt.includes('fencer') ||
    lowerPrompt.includes('arcane duelist') ||
    lowerPrompt.includes('arch') ||
    lowerPrompt.includes('how is') ||
    lowerPrompt.includes("how's")
  ) {
    if (lowerPrompt.includes('fencer') || lowerPrompt.includes('bard') || lowerPrompt.includes('duelist')) {
      reply =
        'Bard Fencer (Arcane Duelist Archetype): Trades Bardic Knowledge & Versatile Performance for a martial edge—grants Arcane Strike (Lvl 1), Combat Casting (Lvl 2), Disruptive (Lvl 6), Spellbreaker (Lvl 10), an Arcane Bond weapon, and Bladethirst (+enhancement/keen/vorpal to your blade) while keeping Inspire Courage!';
    } else if (lowerPrompt.includes('totemist') || lowerPrompt.includes('warpriest') || lowerPrompt.includes('war priest')) {
      reply =
        'Warpriest (Sacred Fist / Totemist style): Uses Fervor to swift-cast divine buffs on yourself while scaling sacred weapon dice and channeling primal blessings in melee.';
    } else {
      reply =
        'That archetype swaps out utility ribbons for focused combat action economy—use the Add Class -> Archetype Shaper to map its level swaps directly onto your progression grid!';
    }
  } else if (directiveType === 'flavor_backstory' || lowerPrompt.includes('backstory') || lowerPrompt.includes('memo')) {
    const nameMatch = promptText.match(/(?:for|about)\s+([a-zA-Z\s]+)/i);
    const charSubject = nameMatch ? nameMatch[1].trim() : character.name || 'Flyn Penius';
    const locRef = journalEntries[0]?.location || 'the frontier marshes';
    reply = `[Backstory Memo — ${charSubject}]: Disgraced conservatory duelist who fled to ${locRef} after besting a corrupt magistrate's nephew in an unsanctioned rapier duel. Armed with a silver-inlaid blade and sharp tavern wit, ${charSubject} turns every skirmish into a theatrical masterclass.`;
  } else {
    reply = `[AI Build Advisor]: Based on ${character.name || 'your character'} (Lvl ${character.level} ${character.characterClass}) and your SOT Catalogue, consider pairing high action-economy feats with a 1-level dip or archetype swap in the Add Class tool.`;
  }

  const updatedText = `${fullScratchpadText.trimEnd()}\n${reply}`;
  return {
    updatedText,
    generatedReply: reply,
    matchedPrompt: promptText,
    directiveType,
    usedJournalContext: mentionsJournal,
  };
}

// ==========================================
// 6. Smart SRD Skills, Proficiencies & Archetype Grid Parser (Add Class Tool)
// ==========================================

export const PF1E_CANONICAL_SKILLS = [
  'Acrobatics',
  'Appraise',
  'Bluff',
  'Climb',
  'Craft',
  'Diplomacy',
  'Disable Device',
  'Disguise',
  'Escape Artist',
  'Fly',
  'Handle Animal',
  'Heal',
  'Intimidate',
  'Knowledge (Arcana)',
  'Knowledge (Dungeoneering)',
  'Knowledge (Engineering)',
  'Knowledge (Geography)',
  'Knowledge (History)',
  'Knowledge (Local)',
  'Knowledge (Nature)',
  'Knowledge (Nobility)',
  'Knowledge (Planes)',
  'Knowledge (Religion)',
  'Linguistics',
  'Perception',
  'Perform',
  'Profession',
  'Ride',
  'Sense Motive',
  'Sleight of Hand',
  'Spellcraft',
  'Stealth',
  'Survival',
  'Swim',
  'Use Magic Device',
];

export interface ParsedSrdClassDetails {
  cleanedSkillsList: string[];
  cleanedSkillsText: string;
  cleanedProficiencies: string;
  detectedSkillRanksPerLevel?: number;
  detectedHitDie?: number;
  ignoredFillerSummary?: string;
}

export function parseSrdSkillsAndProficiencies(rawInput: string): ParsedSrdClassDetails {
  const text = rawInput.trim();
  if (!text) {
    return {
      cleanedSkillsList: [],
      cleanedSkillsText: '',
      cleanedProficiencies: '',
    };
  }

  let detectedHitDie: number | undefined;
  const hdMatch = text.match(/(?:hit\s*die|hd)\s*[:=-]?\s*d(6|8|10|12)/i);
  if (hdMatch) {
    detectedHitDie = parseInt(hdMatch[1], 10);
  }

  let detectedSkillRanksPerLevel: number | undefined;
  const spMatch = text.match(/(?:skill\s*(?:ranks|points)\s*(?:per\s*level)?\s*[:=-]?\s*)?([2468])\s*\+\s*int/i);
  if (spMatch) {
    detectedSkillRanksPerLevel = parseInt(spMatch[1], 10);
  }

  const lower = text.toLowerCase();
  const matchedSkills = new Set<string>();

  if (/knowledge\s*\(\s*all\s*\)/i.test(text)) {
    PF1E_CANONICAL_SKILLS.filter((s) => s.startsWith('Knowledge')).forEach((k) => matchedSkills.add(k));
  }

  for (const canonical of PF1E_CANONICAL_SKILLS) {
    const baseName = canonical.toLowerCase();
    if (lower.includes(baseName)) {
      matchedSkills.add(canonical);
    } else if (canonical.startsWith('Knowledge (')) {
      const subType = canonical.replace(/Knowledge\s*\((.+)\)/i, '$1').toLowerCase();
      const knowBlockMatch = text.match(/knowledge\s*\(([^)]+)\)/gi);
      if (knowBlockMatch) {
        for (const kb of knowBlockMatch) {
          if (kb.toLowerCase().includes(subType)) {
            matchedSkills.add(canonical);
          }
        }
      }
    }
  }

  const sentences = text
    .replace(/\r?\n/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const profSentences: string[] = [];
  let ignoredCount = 0;

  for (const s of sentences) {
    const sl = s.toLowerCase();
    if (
      sl.includes('class skills') ||
      sl.includes('skill ranks per level') ||
      sl.includes('arcane spell failure') ||
      sl.includes('starting wealth')
    ) {
      ignoredCount++;
      continue;
    }

    if (
      sl.includes('proficient') ||
      sl.includes('proficiency') ||
      sl.includes('weapons') ||
      sl.includes('armor') ||
      sl.includes('shields') ||
      sl.includes('longsword') ||
      sl.includes('rapier') ||
      sl.includes('crossbow') ||
      sl.includes('simple') ||
      sl.includes('martial')
    ) {
      const cleaned = s
        .replace(/^weapon\s+and\s+armor\s+proficiency\s*:\s*/i, '')
        .replace(/^A\s+[a-zA-Z\s]+?\s+is\s+proficient\s+with\s+/i, 'Proficient with ')
        .trim();
      profSentences.push(cleaned);
    } else {
      ignoredCount++;
    }
  }

  const cleanedSkillsList = Array.from(matchedSkills);
  return {
    cleanedSkillsList,
    cleanedSkillsText: cleanedSkillsList.join(', '),
    cleanedProficiencies: profSentences.join(' '),
    detectedSkillRanksPerLevel,
    detectedHitDie,
    ignoredFillerSummary:
      ignoredCount > 0
        ? `Filtered ${ignoredCount} non-field rules/flavor sentence(s) automatically.`
        : undefined,
  };
}

export interface AdaptedArchetypeResult {
  archetypeName: string;
  lostFeatures: string[];
  levelAbilities: Record<number, string>;
  adaptedRows: ClassGridRow[];
  summary: string;
}

export async function adaptArchetypeIntoGrid(
  description: string,
  className: string,
  currentRows: ClassGridRow[],
  _apiKey?: string
): Promise<AdaptedArchetypeResult> {
  const cleanDesc = description.trim();
  const existingFeaturesByLevel = currentRows
    .map((r) => `Level ${r.level}: ${r.special}`)
    .join('\n');

  if (cleanDesc) {
    const systemInstruction = `You are a Pathfinder 1st Edition Archetype & Class Progression Grid Engine.
Given the base class "${className}", its current 1-20 progression features, and the player's archetype description:
1. Identify the archetype name.
2. Identify which base class features are replaced/lost (matching names in the existing progression grid where possible).
3. Map the new archetype abilities to the exact levels (1 to 20) where they are gained.

Current Base Class Features:
${existingFeaturesByLevel}

Return ONLY valid JSON with this structure:
{
  "archetypeName": "Name of Archetype",
  "lostFeatures": ["Exact Base Feature 1", "Exact Base Feature 2"],
  "levelAbilities": { "1": "New Feature A", "2": "New Feature B", "6": "New Feature C" },
  "summary": "1-sentence summary of how the grid was adapted"
}`;

    const serverText = await callServerGeminiGenerate({
      prompt: `Player Archetype Description:\n${cleanDesc}`,
      systemInstruction,
      responseMimeType: 'application/json',
    });

    if (serverText) {
      const parsed = safeParseJson<any>(serverText);
      if (parsed && parsed.archetypeName) {
        const lostFeatures: string[] = Array.isArray(parsed.lostFeatures) ? parsed.lostFeatures : [];
        const levelAbilities: Record<number, string> = {};
        if (parsed.levelAbilities && typeof parsed.levelAbilities === 'object') {
          for (const [k, v] of Object.entries(parsed.levelAbilities)) {
            const lvl = parseInt(k, 10);
            if (lvl >= 1 && lvl <= 20 && v) {
              levelAbilities[lvl] = String(v);
            }
          }
        }

        const adaptedRows = applyArchetypeSwapsToRows(currentRows, lostFeatures, levelAbilities);
        return {
          archetypeName: parsed.archetypeName || 'Custom Archetype',
          lostFeatures,
          levelAbilities,
          adaptedRows,
          summary:
            parsed.summary ||
            `Adapted ${parsed.archetypeName || 'Archetype'} into ${className} progression grid.`,
        };
      }
    }
  }

  const lostFeatures: string[] = [];
  const levelAbilities: Record<number, string> = {};

  let archetypeName = `${className} Archetype`;
  const titleMatch = cleanDesc.match(/^([A-Za-z0-9\s'-]{3,35})\s*[:–-]/);
  if (titleMatch) {
    archetypeName = titleMatch[1].trim();
  } else if (/fencer|arcane duelist/i.test(cleanDesc)) {
    archetypeName = 'Arcane Duelist (Bard Fencer)';
  }

  if (/fencer|arcane duelist/i.test(cleanDesc)) {
    lostFeatures.push('Bardic knowledge', 'Versatile performance', 'Well-versed', 'Lore master', 'Jack-of-all-trades');
    levelAbilities[1] = 'Arcane Strike, Rallying Cry';
    levelAbilities[2] = 'Combat Casting';
    levelAbilities[5] = 'Arcane Bond (Weapon)';
    levelAbilities[6] = 'Bladethirst +1, Disruptive';
    levelAbilities[10] = 'Spellbreaker, Mass Bladethirst';
    levelAbilities[14] = 'Penetrating Strike';
    levelAbilities[18] = 'Greater Penetrating Strike';
  }

  const replaceRegex = /replaces?\s+([^.;\n]+?)(?:\s+with\s+|\.|;|$)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = replaceRegex.exec(cleanDesc)) !== null) {
    const rawTargets = rm[1]
      .split(/,|and/i)
      .map((s) => s.replace(/^(the|a|an)\s+/i, '').trim())
      .filter((s) => s.length > 2);

    for (const target of rawTargets) {
      currentRows.forEach((row) => {
        row.special
          .split(',')
          .map((f) => f.trim())
          .forEach((feat) => {
            if (feat && feat !== '—' && feat.toLowerCase().includes(target.toLowerCase())) {
              if (!lostFeatures.includes(feat)) lostFeatures.push(feat);
            }
          });
      });
      if (!lostFeatures.some((lf) => lf.toLowerCase() === target.toLowerCase())) {
        lostFeatures.push(target);
      }
    }
  }

  const atLevelRegex =
    /(?:at\s+(\d+)(?:st|nd|rd|th)?\s+level[,:\s]+(?:gains?\s+|she\s+gains?\s+|he\s+gains?\s+)?([^.;\n]+))|(?:([A-Za-z0-9\s'+-]+?)\s+at\s+(\d+)(?:st|nd|rd|th)?\s+level)|(?:(?:level|lvl)\s*(\d+)\s*[:=-]\s*([^.;,\n]+))/gi;
  let lm: RegExpExecArray | null;
  while ((lm = atLevelRegex.exec(cleanDesc)) !== null) {
    const lvl = parseInt(lm[1] || lm[4] || lm[5], 10);
    const rawFeat = (lm[2] || lm[3] || lm[6] || '')
      .replace(/^(with|and|gains?|the)\s+/i, '')
      .trim();
    if (lvl >= 1 && lvl <= 20 && rawFeat && rawFeat.length > 2) {
      levelAbilities[lvl] = levelAbilities[lvl]
        ? `${levelAbilities[lvl]}, ${rawFeat}`
        : rawFeat;
    }
  }

  const adaptedRows = applyArchetypeSwapsToRows(currentRows, lostFeatures, levelAbilities);
  return {
    archetypeName,
    lostFeatures,
    levelAbilities,
    adaptedRows,
    summary: `Adapted ${archetypeName}: replaced ${lostFeatures.length} base feature(s) and mapped ${
      Object.keys(levelAbilities).length
    } level ability tier(s) into the grid.`,
  };
}

function applyArchetypeSwapsToRows(
  rows: ClassGridRow[],
  lostFeatures: string[],
  levelAbilities: Record<number, string>
): ClassGridRow[] {
  const lostLower = lostFeatures.map((f) => f.toLowerCase().trim()).filter(Boolean);
  return rows.map((row) => {
    const existingParts =
      row.special && row.special !== '—'
        ? row.special
            .split(/,\s*(?![^()]*\))/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const keptParts = existingParts.filter(
      (part) => !lostLower.some((lost) => part.toLowerCase().includes(lost) || lost.includes(part.toLowerCase()))
    );

    const gained = levelAbilities[row.level];
    if (gained && gained.trim()) {
      keptParts.push(`[Archetype] ${gained.trim()}`);
    }

    return {
      ...row,
      special: keptParts.length > 0 ? keptParts.join(', ') : '—',
    };
  });
}

// ==========================================
// 7. AI Complete Sheet: Conversational Character Builder Engine
// ==========================================

export interface CompleteSheetMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  appliedBadges?: string[];
  blockedBadges?: string[];
  missingSotRequest?: {
    title: string;
    category: string;
    reason?: string;
  } | null;
  timestamp: number;
}

export interface CompleteSheetConverseParams {
  conversation: CompleteSheetMessage[];
  character: PF1Character;
  userPrompt: string;
  isRandomRequested?: boolean;
}

export interface CompleteSheetConverseResult {
  updatedCharacter: PF1Character;
  replyMessage: CompleteSheetMessage;
  appliedActions: SheetModificationAction[];
}

const CANONICAL_PF1E_RACES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Gnome',
  'Half-Elf',
  'Half-Orc',
  'Tiefling',
  'Aasimar',
  'Catfolk',
  'Tengu',
  'Goblin',
  'Kobold',
  'Orc',
  'Ratfolk',
  'Kitsune',
  'Sylph',
  'Ifrit',
  'Oread',
  'Undine',
  'Dhampir',
  'Fetchling',
];

const CANONICAL_PF1E_CLASSES = [
  'Slayer',
  'Fighter',
  'Rogue',
  'Barbarian',
  'Bard',
  'Paladin',
  'Ranger',
  'Monk',
  'Cleric',
  'Druid',
  'Wizard',
  'Sorcerer',
  'Alchemist',
  'Cavalier',
  'Gunslinger',
  'Inquisitor',
  'Magus',
  'Oracle',
  'Summoner',
  'Witch',
  'Antipaladin',
  'Ninja',
  'Samurai',
  'Arcanist',
  'Bloodrager',
  'Brawler',
  'Hunter',
  'Investigator',
  'Shaman',
  'Skald',
  'Swashbuckler',
  'Warpriest',
  'Kineticist',
  'Medium',
  'Mesmerist',
  'Occultist',
  'Psychic',
  'Spiritualist',
];

const WEAPON_PRESETS: Array<{
  keywords: string[];
  name: string;
  dmg: string;
  crit: string;
  cat: 'Melee' | 'Ranged';
  type: string;
}> = [
  { keywords: ['kukri', 'kukris'], name: 'Kukri', dmg: '1d4 + str_mod', crit: '18-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['greatsword'], name: 'Greatsword', dmg: '2d6 + floor(str_mod * 1.5)', crit: '19-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['longsword'], name: 'Longsword', dmg: '1d8 + str_mod', crit: '19-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['rapier'], name: 'Rapier', dmg: '1d6 + str_mod', crit: '18-20/x2', cat: 'Melee', type: 'Piercing' },
  { keywords: ['scimitar'], name: 'Scimitar', dmg: '1d6 + str_mod', crit: '18-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['falchion'], name: 'Falchion', dmg: '2d4 + floor(str_mod * 1.5)', crit: '18-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['greataxe'], name: 'Greataxe', dmg: '1d12 + floor(str_mod * 1.5)', crit: '20/x3', cat: 'Melee', type: 'Slashing' },
  { keywords: ['warhammer'], name: 'Warhammer', dmg: '1d8 + str_mod', crit: '20/x3', cat: 'Melee', type: 'Bludgeoning' },
  { keywords: ['earth breaker', 'earthbreaker'], name: 'Earth Breaker', dmg: '2d6 + floor(str_mod * 1.5)', crit: '20/x3', cat: 'Melee', type: 'Bludgeoning' },
  { keywords: ['katana'], name: 'Katana', dmg: '1d8 + str_mod', crit: '18-20/x2', cat: 'Melee', type: 'Slashing' },
  { keywords: ['dagger', 'daggers', 'knife', 'knives'], name: 'Dagger', dmg: '1d4 + str_mod', crit: '19-20/x2', cat: 'Melee', type: 'Piercing/Slashing' },
  { keywords: ['short sword', 'shortsword'], name: 'Shortsword', dmg: '1d6 + str_mod', crit: '19-20/x2', cat: 'Melee', type: 'Piercing' },
  { keywords: ['longbow', 'composite longbow', 'bow'], name: 'Composite Longbow', dmg: '1d8 + str_mod', crit: '20/x3', cat: 'Ranged', type: 'Piercing' },
  { keywords: ['shortbow'], name: 'Shortbow', dmg: '1d6', crit: '20/x3', cat: 'Ranged', type: 'Piercing' },
  { keywords: ['crossbow'], name: 'Light Crossbow', dmg: '1d8', crit: '19-20/x2', cat: 'Ranged', type: 'Piercing' },
];

const ARMOR_PRESETS: Array<{
  keywords: string[];
  name: string;
  ac: number;
  maxDex: number;
  acp: number;
  type: 'Light' | 'Medium' | 'Heavy' | 'Shield';
}> = [
  { keywords: ['mithral chain shirt'], name: 'Mithral Chain Shirt', ac: 4, maxDex: 6, acp: 0, type: 'Light' },
  { keywords: ['chain shirt'], name: 'Chain Shirt', ac: 4, maxDex: 4, acp: -2, type: 'Light' },
  { keywords: ['studded leather'], name: 'Studded Leather', ac: 3, maxDex: 5, acp: -1, type: 'Light' },
  { keywords: ['leather armor'], name: 'Leather Armor', ac: 2, maxDex: 6, acp: 0, type: 'Light' },
  { keywords: ['breastplate'], name: 'Breastplate', ac: 6, maxDex: 3, acp: -4, type: 'Medium' },
  { keywords: ['scale mail'], name: 'Scale Mail', ac: 5, maxDex: 3, acp: -4, type: 'Medium' },
  { keywords: ['full plate', 'fullplate'], name: 'Full Plate', ac: 9, maxDex: 1, acp: -6, type: 'Heavy' },
  { keywords: ['buckler'], name: 'Buckler', ac: 1, maxDex: 99, acp: -1, type: 'Shield' },
  { keywords: ['heavy shield', 'steel shield'], name: 'Heavy Steel Shield', ac: 2, maxDex: 99, acp: -2, type: 'Shield' },
];

export async function completeSheetConverse(
  params: CompleteSheetConverseParams
): Promise<CompleteSheetConverseResult> {
  const { conversation, character, userPrompt, isRandomRequested } = params;
  const permissions = character.installedModules?.aiSettings?.allowedFields || DEFAULT_AI_MODULE_SETTINGS.allowedFields;
  const sot = character.sotCatalogue || DEFAULT_SOT_CATALOGUE;

  // Build a concise character snapshot for grounding
  const characterSummary = `Name: ${character.name || 'Unnamed'}
Race: ${character.race || 'Human'}
Class: ${character.characterClass || 'Adventurer'} Lvl ${character.level || 1}
Alignment: ${character.alignment || 'True Neutral'} | Deity: ${character.deity || 'None'}
Stats: STR ${character.abilities.STR.base}, DEX ${character.abilities.DEX.base}, CON ${character.abilities.CON.base}, INT ${character.abilities.INT.base}, WIS ${character.abilities.WIS.base}, CHA ${character.abilities.CHA.base}
Hit Die: ${character.hitDice || 'd10'} | Max HP: ${character.hpTotalMax} | Current HP: ${character.hpCurrent}
Feats (${(character.characterFeats || []).length}): ${(character.characterFeats || []).map((f) => f.name).join(', ') || 'None'}
Actions & Resources (${(character.characterActions || []).length}): ${(character.characterActions || []).map((a) => a.name).join(', ') || 'None'}
Loaded SOT SRD Documents: ${(sot.overridePages || []).map((p) => `"${p.title}" (${p.category})`).join(', ') || 'None'}
Active SOT Weblinks: ${(sot.weblinks || []).filter((w) => w.isActive).map((w) => w.title).join(', ') || 'None'}`;

  const messageHistory = [
    ...conversation.map((m) => ({ role: m.role, text: m.text })),
    { role: 'user' as const, text: userPrompt },
  ];

  let replyText = '';
  let fieldUpdates: string[] = [];
  let missingSotRequest: CompleteSheetMessage['missingSotRequest'] = null;

  // -------------------------------------------------------------------------
  // STEP 1: Extract any explicit plain-English updates directly from userPrompt
  // -------------------------------------------------------------------------
  const cleanPrompt = userPrompt.trim();
  const lower = cleanPrompt.toLowerCase();
  const directUserUpdates: string[] = [];

  // 1a. Name extraction: e.g. "name him Kaelen", "my name is Lyra", "call me Grimjaw", "named Vaelin"
  const explicitNameMatch = cleanPrompt.match(
    /(?:set\s+name\s+to|my\s+name\s+is|his\s+name\s+is|her\s+name\s+is|their\s+name\s+is|name\s+(?:him|her|them|me)|call\s+(?:him|her|them|me)|named)\s+([A-Z][A-Za-z0-9\s'-]{1,28}?)(?=\s+(?:and|who|the|a|an|with|at|level|lvl|,|\.)|$)/i
  );
  if (explicitNameMatch) {
    const candidateName = explicitNameMatch[1].trim();
    if (
      candidateName &&
      !CANONICAL_PF1E_RACES.some((r) => r.toLowerCase() === candidateName.toLowerCase()) &&
      !CANONICAL_PF1E_CLASSES.some((c) => c.toLowerCase() === candidateName.toLowerCase())
    ) {
      directUserUpdates.push(`set name to ${candidateName}`);
    }
  }

  // 1b. Race extraction
  for (const raceName of CANONICAL_PF1E_RACES) {
    const raceRegex = new RegExp(`\\b${raceName.replace('-', '[-\\s]?')}\\b`, 'i');
    if (raceRegex.test(cleanPrompt)) {
      directUserUpdates.push(`set race to ${raceName}`);
      break;
    }
  }

  // 1c. Alignment extraction
  const alignmentsMap: Record<string, string> = {
    'lawful good': 'Lawful Good',
    'neutral good': 'Neutral Good',
    'chaotic good': 'Chaotic Good',
    'lawful neutral': 'Lawful Neutral',
    'true neutral': 'True Neutral',
    'chaotic neutral': 'Chaotic Neutral',
    'lawful evil': 'Lawful Evil',
    'neutral evil': 'Neutral Evil',
    'chaotic evil': 'Chaotic Evil',
  };
  for (const [k, v] of Object.entries(alignmentsMap)) {
    if (lower.includes(k)) {
      directUserUpdates.push(`set alignment to ${v}`);
      break;
    }
  }

  // 1d. Level extraction: e.g. "level 5", "lvl 3", "start at 4th level"
  const lvlMatch = cleanPrompt.match(/(?:level|lvl)\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+level\b/i);
  if (lvlMatch && !lower.includes('spell level')) {
    const parsedLvl = parseInt(lvlMatch[1] || lvlMatch[2], 10);
    if (parsedLvl >= 1 && parsedLvl <= 20) {
      directUserUpdates.push(`set level to ${parsedLvl}`);
    }
  }

  // 1e. Ability Score pairs in user prompt: e.g. "str 18", "18 str", "dex 16", "strength 16"
  const abilPairs: string[] = [];
  const abilRegex = /\b(?:(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)\s*(?:to|is|at|=|:)?\s*(\d{1,2})|(\d{1,2})\s+(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma))\b/gi;
  let abm: RegExpExecArray | null;
  while ((abm = abilRegex.exec(cleanPrompt)) !== null) {
    const statKey = (abm[1] || abm[4]).toUpperCase().slice(0, 3);
    const val = parseInt(abm[2] || abm[3], 10);
    if (val >= 3 && val <= 30) {
      abilPairs.push(`${statKey} ${val}`);
    }
  }
  if (abilPairs.length > 0) {
    directUserUpdates.push(`set stats ${abilPairs.join(', ')}`);
  }

  // 1f. Weapon & Armor mentions in user prompt
  const matchedWeapons: string[] = [];
  for (const wp of WEAPON_PRESETS) {
    if (wp.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(cleanPrompt))) {
      directUserUpdates.push(`equip weapon ${wp.name} | ${wp.dmg} | ${wp.crit} | ${wp.cat} | ${wp.type}`);
      matchedWeapons.push(wp.name);
      if (lower.includes(`dual ${wp.keywords[0]}`) || lower.includes(`two ${wp.keywords[0]}`)) {
        directUserUpdates.push(`equip weapon Off-Hand ${wp.name} | ${wp.dmg} | ${wp.crit} | ${wp.cat} | ${wp.type}`);
      }
    }
  }

  const matchedArmors: string[] = [];
  for (const ar of ARMOR_PRESETS) {
    if (ar.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(cleanPrompt))) {
      directUserUpdates.push(`equip armor ${ar.name} | ${ar.ac} | ${ar.maxDex} | ${ar.acp} | ${ar.type}`);
      matchedArmors.push(ar.name);
      break;
    }
  }

  // 1g. Pass userPrompt itself if it matches any direct command in parseNaturalLanguageSheetUpdates
  const rawPromptActions = parseNaturalLanguageSheetUpdates(cleanPrompt, character, permissions);
  if (rawPromptActions.length > 0) {
    directUserUpdates.push(cleanPrompt);
  }

  // -------------------------------------------------------------------------
  // STEP 2: Try Server-Side Gemini Route (/api/gemini/complete-sheet)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch('/api/gemini/complete-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: messageHistory,
        characterSummary,
        sotOverridePages: sot.overridePages || [],
        sotWeblinks: sot.weblinks || [],
        allowedFields: permissions,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.rawText === 'string' && data.rawText.trim()) {
        const parsed = safeParseJson<{
          replyText?: string;
          fieldUpdates?: string[];
          missingSotRequest?: { title: string; category: string; reason?: string } | null;
        }>(data.rawText);

        if (parsed && parsed.replyText) {
          replyText = parsed.replyText;
          fieldUpdates = Array.isArray(parsed.fieldUpdates) ? parsed.fieldUpdates : [];
          missingSotRequest = parsed.missingSotRequest || null;
        } else {
          // If model returned plain text instead of JSON, still use its replyText!
          replyText = data.rawText.trim();
        }
      }
    }
  } catch (err) {
    console.warn('Server Complete Sheet fetch failed, using SOT-grounded conversational engine:', err);
  }

  // Always include explicit updates extracted from the player's own message
  for (const du of directUserUpdates) {
    if (!fieldUpdates.includes(du)) {
      fieldUpdates.push(du);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Reactive SOT-Grounded Conversational Engine (when offline / 429)
  // -------------------------------------------------------------------------
  if (!replyText) {
    const activePages = (sot.overridePages || []).filter((p) => p.isOverride);
    const loadedSotTitles = activePages.map((p) => `"${p.title}"`).join(', ') || 'None';
    const isAskingRandom =
      isRandomRequested ||
      /\b(random|roll\s+stat|roll\s+my|roll\s+20|roll\s+array|surprise\s+me|reroll)\b/i.test(cleanPrompt);

    // Check if player is saying "yes" / "sure" / "lock it in" / "do it" to previous AI suggestion
    const lastModelMsg = [...conversation].reverse().find((m) => m.role === 'model')?.text || '';
    const isAffirmation =
      /^(yes|yeah|yep|yup|sure|ok|okay|do it|lock it in|let's do it|lets do it|sounds good|go for it|apply|please|hell yeah|sweet|perfect)\b/i.test(
        cleanPrompt
      );

    // Check if user just uploaded a document via Quick SOT Upload
    const uploadedDocMatch = cleanPrompt.match(/uploaded\s+"([^"]+)"\s+to\s+my\s+SOT/i);

    // Search active SOT Override Pages for a matching Class or Archetype SRD
    const matchedSotClassDoc = activePages.find((p) => {
      if (uploadedDocMatch && p.title.toLowerCase() === uploadedDocMatch[1].toLowerCase()) {
        return true;
      }
      const docTitleClean = p.title
        .replace(/^(?:full\s+class\s+srd|srd|campaign\s+house\s+rule)\s*[:—-]?\s*/i, '')
        .split('(')[0]
        .trim()
        .toLowerCase();
      if (docTitleClean.length >= 3 && lower.includes(docTitleClean)) {
        return true;
      }
      return (p.tags || []).some((t) => t.length >= 4 && lower.includes(t.toLowerCase()));
    });

    // Check if user mentioned any canonical PF1e class
    const mentionedCanonicalClass = CANONICAL_PF1E_CLASSES.find((cls) =>
      new RegExp(`\\b${cls}\\b`, 'i').test(cleanPrompt)
    );

    // Check if user mentioned any feat/ability/spell in SOT or Verified Compendium
    const matchedCompendiumEntries = VERIFIED_PF1E_COMPENDIUM.filter((entry) =>
      entry.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(cleanPrompt))
    );

    if (isAskingRandom) {
      const arrays = [
        { STR: 16, DEX: 14, CON: 14, INT: 12, WIS: 12, CHA: 8, tag: 'Martial Powerhouse' },
        { STR: 12, DEX: 18, CON: 14, INT: 14, WIS: 10, CHA: 8, tag: 'Finesse / Agile Skirmisher' },
        { STR: 14, DEX: 16, CON: 14, INT: 14, WIS: 12, CHA: 8, tag: 'Tactical Slayer / Stalker' },
        { STR: 10, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10, tag: 'Arcane / Alchemical Scholar' },
        { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 16, tag: 'Divine Champion' },
      ];
      const picked = arrays[Math.floor(Math.random() * arrays.length)];
      fieldUpdates.push(
        `set stats STR ${picked.STR}, DEX ${picked.DEX}, CON ${picked.CON}, INT ${picked.INT}, WIS ${picked.WIS}, CHA ${picked.CHA}`
      );
      replyText = `Rolled a fresh 20-point buy array for you (**${picked.tag}**):\n• **STR ${picked.STR} | DEX ${picked.DEX} | CON ${picked.CON} | INT ${picked.INT} | WIS ${picked.WIS} | CHA ${picked.CHA}**\n\nI've plugged those base scores straight into your sheet! Want to shift any points around (like "set STR to 18") or lock in your class and weapons next?`;
    } else if (matchedSotClassDoc) {
      // Parse the matched SOT document for class chassis, skills, HD, and abilities!
      const docText = matchedSotClassDoc.plainText || matchedSotClassDoc.htmlContent;
      const srdDetails = parseSrdSkillsAndProficiencies(docText);
      const inferredClass =
        mentionedCanonicalClass ||
        matchedSotClassDoc.title
          .replace(/^(?:full\s+class\s+srd|srd|class)\s*[:—-]?\s*/i, '')
          .split('(')[0]
          .trim() ||
        'Slayer';
      const hd = srdDetails.detectedHitDie || 10;
      const sp = srdDetails.detectedSkillRanksPerLevel || 6;
      const targetLvl = character.level || 1;
      const conMod = Math.floor(((character.abilities.CON.base || 10) - 10) / 2);
      const calcHp = hd + conMod + (targetLvl - 1) * (Math.floor(hd / 2) + 1 + conMod);

      fieldUpdates.push(`set class to ${inferredClass}`);
      fieldUpdates.push(`set hit die to d${hd}`);
      fieldUpdates.push(`set max hp to ${Math.max(hd, calcHp)}`);
      fieldUpdates.push(`set skill points per level to ${sp}`);

      if (srdDetails.cleanedSkillsList.length > 0) {
        fieldUpdates.push('clear class skills');
        fieldUpdates.push(`unlock class skills: ${srdDetails.cleanedSkillsList.join(', ')}`);
      }

      // Extract named (Ex)/(Su)/(Sp) abilities from the SOT doc
      const extractedAbilities: string[] = [];
      const abilHeaderRegex = /([A-Z][A-Za-z0-9\s'-]{2,28}\s*\((?:Ex|Su|Sp)\))\s*[:—-]\s*([^\n.]+)/g;
      let am: RegExpExecArray | null;
      while ((am = abilHeaderRegex.exec(docText)) !== null && extractedAbilities.length < 4) {
        const abName = am[1].trim();
        const abDesc = am[2].trim();
        fieldUpdates.push(`add action ${abName}: ${abDesc}`);
        extractedAbilities.push(abName);
      }

      // Check if Elephant in the Room SOT doc is also active
      const hasEitr = activePages.some((p) => p.title.toLowerCase().includes('elephant'));
      if (hasEitr && hd >= 8) {
        fieldUpdates.push(
          'add feat Power Attack & Deadly Aim (SOT Override): Free at BAB +1 via Elephant in the Room SOT Override'
        );
      }

      replyText = `Awesome—pulling straight from your SOT document **"${matchedSotClassDoc.title}"**!\n\nHere's what I just wired onto your sheet:\n• **Class & Chassis**: **${inferredClass}** (d${hd} Hit Die, **${sp} + INT** skill ranks/level)\n• **Class Skills**: Cleared old checks and unlocked all **${srdDetails.cleanedSkillsList.length} ${inferredClass} class skills** (${srdDetails.cleanedSkillsList.slice(0, 6).join(', ')}${srdDetails.cleanedSkillsList.length > 6 ? '...' : ''})\n${
        extractedAbilities.length > 0
          ? `• **Class Abilities Added**: ${extractedAbilities.join(', ')}\n`
          : ''
      }${
        hasEitr
          ? `• **SOT House Rule Applied**: Added free *Power Attack & Deadly Aim* from your *Elephant in the Room* SOT doc!\n`
          : ''
      }\nWhat weapon style or stat array are you feeling for this ${inferredClass}? (e.g. "dual kukris with 18 DEX", "composite longbow sniper", or "greatsword with 18 STR")`;
    } else if (isAffirmation && lastModelMsg) {
      // User confirmed the previous suggestion!
      if (lastModelMsg.toLowerCase().includes('slayer') || character.characterClass.toLowerCase().includes('slayer')) {
        fieldUpdates.push('set class to Slayer');
        fieldUpdates.push('set hit die to d10');
        fieldUpdates.push('set stats STR 14, DEX 18, CON 14, INT 14, WIS 12, CHA 8');
        fieldUpdates.push('equip weapon Kukri | 1d4 + dex_mod | 18-20/x2 | Melee | Slashing');
        fieldUpdates.push('equip weapon Off-Hand Kukri | 1d4 + dex_mod | 18-20/x2 | Melee | Slashing');
        fieldUpdates.push('equip armor Studded Leather | 3 | 5 | -1 | Light');
        fieldUpdates.push('add feat Two-Weapon Fighting: Reduce two-weapon fighting penalties to -2/-2');
        fieldUpdates.push('train Stealth, Perception, Acrobatics');
        replyText = `Locked and loaded! I've outfitted your **Slayer** with an agile 20-point array (**DEX 18, STR 14, CON 14, INT 14, WIS 12**), dual **Kukris** (18–20 crit range), **Studded Leather**, **Two-Weapon Fighting**, and trained **Stealth, Perception, and Acrobatics**.\n\nWant to set a character name, race, or level up to 3rd level to grab *Sneak Attack +1d6*?`;
      } else {
        fieldUpdates.push('set stats STR 16, DEX 14, CON 14, INT 12, WIS 12, CHA 10');
        replyText = `Locked in! I've applied a balanced heroic ability array (**STR 16, DEX 14, CON 14, INT 12, WIS 12, CHA 10**) to your sheet. Tell me what weapons, feats, or skills you want to add next!`;
      }
    } else if (matchedCompendiumEntries.length > 0) {
      const addedNames: string[] = [];
      const hasEitr = activePages.some((p) => p.title.toLowerCase().includes('elephant'));

      for (const entry of matchedCompendiumEntries) {
        addedNames.push(entry.title);
        if (entry.category === 'Feat') {
          const eitrNote =
            hasEitr && ['power attack', 'deadly aim', 'combat expertise', 'weapon finesse', 'dodge'].includes(entry.title.toLowerCase())
              ? ' [SOT Override: Elephant in the Room]'
              : '';
          fieldUpdates.push(`add feat ${entry.title}${eitrNote}: ${entry.summary}`);
        } else if (entry.category === 'Spell') {
          fieldUpdates.push(`add spell ${entry.title} level 1: ${entry.summary}`);
        } else {
          fieldUpdates.push(`add action ${entry.title}: ${entry.summary}`);
          if (entry.hasResourcePool && entry.resourceMax) {
            fieldUpdates.push(`add resource ${entry.title} max ${entry.resourceMax}`);
          }
        }
      }

      replyText = `Got it! Added **${addedNames.join(', ')}** straight onto your sheet${
        hasEitr ? ' (cross-checked with your *Elephant in the Room* SOT Override rules)' : ''
      }.\n\n${matchedCompendiumEntries.map((e) => `• **${e.title}**: ${e.summary}`).join('\n')}\n\nWhat else should we add to your build?`;
    } else if (
      mentionedCanonicalClass &&
      !activePages.some((p) => p.title.toLowerCase().includes(mentionedCanonicalClass.toLowerCase()))
    ) {
      // Player asked for a specific PF1e class (e.g. Fighter, Wizard, Rogue, Paladin, Magus) that isn't in their SOT Override Pages yet!
      fieldUpdates.push(`set class to ${mentionedCanonicalClass}`);
      missingSotRequest = {
        title: `Full Class SRD: ${mentionedCanonicalClass}`,
        category: 'Full Class SRD',
        reason: `${mentionedCanonicalClass} SRD table & class skills are not in your loaded SOT docs yet.`,
      };
      replyText = `A **${directUserUpdates.find((u) => u.startsWith('set race'))?.replace('set race to ', '') || character.race || 'Human'} ${mentionedCanonicalClass}** sounds badass! I went ahead and updated your Class to **${mentionedCanonicalClass}**${
        directUserUpdates.length > 0 ? ' along with your other details' : ''
      } on the sheet.\n\nRight now your SOT Catalogue only has ${loadedSotTitles} loaded. Since I strictly never make up or guess class tables outside your Source of Truth, paste the **${mentionedCanonicalClass}** SRD text into the Quick Upload drawer below and I'll automatically extract its Hit Die, class skills, saves, and level abilities—or tell me your stats and gear directly in plain English!`;
    } else if (/\b([a-z]+)\s+archetype\b/i.test(cleanPrompt) || lower.includes('stygian')) {
      const archMatch = cleanPrompt.match(/([A-Za-z'-]+(?:\s+[A-Za-z'-]+)?)\s+archetype/i);
      const archName = lower.includes('stygian')
        ? 'Stygian Slayer'
        : archMatch
        ? `${archMatch[1].trim()} Archetype`
        : 'Requested Archetype';
      missingSotRequest = {
        title: archName,
        category: 'Archetype',
        reason: 'Not found in loaded SOT SRD documents.',
      };
      replyText = `**${archName}** is a killer option! However, I don't see **${archName}** in your loaded SOT documents (${loadedSotTitles}) yet. To make sure we never guess numbers or invent rules, paste the archetype text into the Quick Upload drawer below and I'll map its ability swaps straight onto your sheet!`;
    } else if (directUserUpdates.length > 0) {
      // The user gave plain English updates (name, race, level, stats, weapons, armor, skills, etc.)!
      replyText = `Done! I've updated your sheet live based on what you just told me:\n${directUserUpdates
        .map((u) => `• \`${u}\``)
        .join('\n')}\n\nYour sheet is now showing **${character.name || 'your character'}** (${character.race} ${character.characterClass} Lvl ${character.level}). Want to dial in ability scores, equip weapons/armor, or pull class features from your SOT Catalogue?`;
    } else if (
      /\b(stealth|sneak|assassin|dual|two-weapon|twf|archer|bow|sniper|ranged|tracker|scout|marsh|melee|frontline|tank|dps)\b/i.test(
        cleanPrompt
      )
    ) {
      // User described a combat style / concept vibe!
      const isRanged = /\b(archer|bow|sniper|ranged)\b/i.test(cleanPrompt);
      const isTwoHanded = /\b(greatsword|two-handed|2h|heavy|tank|bruiser)\b/i.test(cleanPrompt);

      if (isRanged) {
        replyText = `A stealthy ranged sniper fits your loaded **Slayer SRD** + **Elephant in the Room** SOT docs like a glove! With Slayer, you get d10 HD, full BAB, **Studied Target** (+1 attack/damage that scales), and **6 + INT** skill ranks for Stealth, Perception, and Survival—plus free *Deadly Aim* at BAB +1 from your SOT house rules!\n\nSay **"yes"** (or **"build Slayer from SOT"**) and I'll set up your Slayer chassis, unlock all 17 Slayer class skills, and equip a Composite Longbow!`;
      } else if (isTwoHanded) {
        replyText = `For a heavy-hitting frontline stalker, your loaded **Slayer SRD** + **Elephant in the Room** SOT docs are brutal: full d10 Hit Die, full BAB, **Studied Target**, Medium Armor proficiency, and automatic **Power Attack** at BAB +1 without spending a feat!\n\nTell me **"lock in Slayer"** or **"equip greatsword and breastplate with 18 STR"** and I'll populate the whole setup live!`;
      } else {
        replyText = `An agile skirmisher/flanker is right in the wheelhouse of your loaded **Slayer SRD** and **Elephant in the Room** SOT docs! You get **Weapon Finesse** for free on light weapons, **Studied Target** at 1st level, and **Sneak Attack** at 3rd level.\n\nSay **"yes"** to lock in the agile dual-kukri Slayer build, or tell me any race, name, stats, or class you want!`;
      }
    } else {
      // General conversational reply that directly acknowledges their message and current SOT state
      replyText = `Got you! Looking at your message (*"${cleanPrompt.slice(0, 80)}"*) and your active SOT Catalogue (${loadedSotTitles}):\n\n• If you want to build using your loaded **Slayer SRD** & **Elephant in the Room** rules, say **"build a Slayer"** or tell me your combat style (e.g. *dual kukris*, *longbow sniper*, or *greatsword*).\n• You can also tell me plain-English updates anytime—like **"name me Kaelen, Tiefling, level 3, STR 14 DEX 18 CON 14"**, **"train Stealth and Perception"**, or **"add feat Toughness"**.\n• Or if you want a different class/archetype, just name it and we'll pop open the Quick SOT Upload drawer!`;
    }
  }

  // Apply all valid field updates through Broad Sheet Authority
  let currentCharacter = { ...character };
  const appliedActions: SheetModificationAction[] = [];
  const appliedBadges: string[] = [];
  const blockedBadges: string[] = [];

  for (const updateCmd of fieldUpdates) {
    const actions = parseNaturalLanguageSheetUpdates(updateCmd, currentCharacter, permissions);
    for (const act of actions) {
      if (act.isBlockedByBlindSpot) {
        if (!blockedBadges.includes(act.label)) {
          blockedBadges.push(act.label);
        }
      } else {
        currentCharacter = act.apply(currentCharacter);
        appliedActions.push(act);
        if (!appliedBadges.includes(act.label)) {
          appliedBadges.push(act.label);
        }
      }
    }
  }

  const replyMessage: CompleteSheetMessage = {
    id: `msg-model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'model',
    text: replyText,
    appliedBadges: appliedBadges.length > 0 ? appliedBadges : undefined,
    blockedBadges: blockedBadges.length > 0 ? blockedBadges : undefined,
    missingSotRequest,
    timestamp: Date.now(),
  };

  return {
    updatedCharacter: currentCharacter,
    replyMessage,
    appliedActions,
  };
}


