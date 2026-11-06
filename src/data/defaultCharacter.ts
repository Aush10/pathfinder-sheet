/**
 * Default starter character data matching the rich Pathfinder 1e template
 * Includes custom formula objects like "firebreath" and "mainattack_with_fire"
 */

import { PF1Character, SkillItem } from '../types/character';

export const INITIAL_SKILLS: SkillItem[] = [
  { id: 'sk-1', name: 'Acrobatics', keyAbility: 'DEX', isClassSkill: true, ranks: 5, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-2', name: 'Appraise', keyAbility: 'INT', isClassSkill: false, ranks: 1, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-3', name: 'Bluff', keyAbility: 'CHA', isClassSkill: true, ranks: 10, miscMod: 2, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-4', name: 'Climb', keyAbility: 'STR', isClassSkill: true, ranks: 3, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-5', name: 'Craft (Alchemy)', keyAbility: 'INT', isClassSkill: true, ranks: 4, miscMod: 2, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-6', name: 'Diplomacy', keyAbility: 'CHA', isClassSkill: true, ranks: 12, miscMod: 3, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-7', name: 'Disable Device', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: true },
  { id: 'sk-8', name: 'Disguise', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-9', name: 'Escape Artist', keyAbility: 'DEX', isClassSkill: false, ranks: 1, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-10', name: 'Fly', keyAbility: 'DEX', isClassSkill: true, ranks: 8, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-11', name: 'Handle Animal', keyAbility: 'CHA', isClassSkill: false, ranks: 0, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-12', name: 'Heal', keyAbility: 'WIS', isClassSkill: false, ranks: 1, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-13', name: 'Intimidate', keyAbility: 'CHA', isClassSkill: true, ranks: 15, miscMod: 4, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-14', name: 'Knowledge (Arcana)', keyAbility: 'INT', isClassSkill: true, ranks: 12, miscMod: 3, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-15', name: 'Knowledge (Dungeoneering)', keyAbility: 'INT', isClassSkill: true, ranks: 5, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-16', name: 'Knowledge (Engineering)', keyAbility: 'INT', isClassSkill: false, ranks: 0, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-17', name: 'Knowledge (Geography)', keyAbility: 'INT', isClassSkill: false, ranks: 1, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-18', name: 'Knowledge (History)', keyAbility: 'INT', isClassSkill: true, ranks: 6, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-19', name: 'Knowledge (Local)', keyAbility: 'INT', isClassSkill: false, ranks: 2, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-20', name: 'Knowledge (Nature)', keyAbility: 'INT', isClassSkill: false, ranks: 2, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-21', name: 'Knowledge (Nobility)', keyAbility: 'INT', isClassSkill: true, ranks: 4, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-22', name: 'Knowledge (Planes)', keyAbility: 'INT', isClassSkill: true, ranks: 10, miscMod: 2, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-23', name: 'Knowledge (Religion)', keyAbility: 'INT', isClassSkill: true, ranks: 8, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-24', name: 'Linguistics', keyAbility: 'INT', isClassSkill: true, ranks: 4, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-25', name: 'Perception', keyAbility: 'WIS', isClassSkill: true, ranks: 15, miscMod: 2, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-26', name: 'Perform (Oratory)', keyAbility: 'CHA', isClassSkill: false, ranks: 1, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-27', name: 'Profession (Soldier)', keyAbility: 'WIS', isClassSkill: true, ranks: 3, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-28', name: 'Ride', keyAbility: 'DEX', isClassSkill: true, ranks: 5, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-29', name: 'Sense Motive', keyAbility: 'WIS', isClassSkill: true, ranks: 8, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-30', name: 'Sleight of Hand', keyAbility: 'DEX', isClassSkill: false, ranks: 0, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: true },
  { id: 'sk-31', name: 'Spellcraft', keyAbility: 'INT', isClassSkill: true, ranks: 16, miscMod: 3, hasArmorCheckPenalty: false, isTrainedOnly: true },
  { id: 'sk-32', name: 'Stealth', keyAbility: 'DEX', isClassSkill: false, ranks: 2, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-33', name: 'Survival', keyAbility: 'WIS', isClassSkill: false, ranks: 2, miscMod: 0, hasArmorCheckPenalty: false, isTrainedOnly: false },
  { id: 'sk-34', name: 'Swim', keyAbility: 'STR', isClassSkill: true, ranks: 2, miscMod: 0, hasArmorCheckPenalty: true, isTrainedOnly: false },
  { id: 'sk-35', name: 'Use Magic Device', keyAbility: 'CHA', isClassSkill: true, ranks: 14, miscMod: 3, hasArmorCheckPenalty: false, isTrainedOnly: true },
];

export const DEFAULT_CHARACTER: PF1Character = {
  "name": "New Adventurer",
  "player": "",
  "alignment": "Neutral",
  "characterClass": "Fighter",
  "level": 1,
  "race": "Human",
  "deity": "",
  "size": "Medium",
  "gender": "Male",
  "age": 20,
  "height": "5'10\"",
  "weight": "165 lbs",
  "eyes": "",
  "hair": "",
  "campaign": "",
  "currentXP": 0,
  "nextLevelXP": 2000,
  "heroPoints": 1,
  "classes": [
    {
      "id": "cls-1",
      "name": "Fighter",
      "level": 1,
      "hitDie": 10,
      "skillPointsPerLevel": 2,
      "babProgression": "full",
      "isFavoredClass": true
    }
  ],
  "deathSaves": [
    false,
    false,
    false
  ],
  "combatTracker": {
    "round": 1,
    "turn": 1,
    "isInCombat": false
  },
  "classSkillPointsPerLevel": 2,
  "abilities": {
    "STR": {
      "name": "STR",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "DEX": {
      "name": "DEX",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "CON": {
      "name": "CON",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "INT": {
      "name": "INT",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "WIS": {
      "name": "WIS",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "CHA": {
      "name": "CHA",
      "base": 10,
      "raceMod": 0,
      "levelAsiMod": 0,
      "enhMod": 0,
      "miscMod": 0,
      "tempMod": 0
    }
  },
  "hpTotalMax": 10,
  "hpCurrent": 10,
  "hpNonlethal": 0,
  "hpTemp": 0,
  "hitDice": "1d10",
  "hpBreakdown": {
    "calcMethod": "max",
    "hitDiceCount": 1,
    "hitDiceSize": 10,
    "hitDiceRolledBase": 10,
    "additionalBonuses": []
  },
  "damageReduction": "",
  "fastHealing": "",
  "spellResistance": 0,
  "resistances": "",
  "immunities": "",
  "buffBox": {
    "Enhancement": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Circumstance": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Competence": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Deflection": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Dodge": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Insight": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Item": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Inherent": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Luck": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Morale": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Pro/Sac": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Race": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "NAT armor": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Armor": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Level advance": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Shield": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Untyped": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Size": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    },
    "Alt size": {
      "hp": 0,
      "mattack": 0,
      "rattack": 0,
      "fort": 0,
      "ref": 0,
      "will": 0,
      "ac": 0,
      "str": 0,
      "dex": 0,
      "con": 0,
      "int": 0,
      "wis": 0,
      "cha": 0
    }
  },
  "initMiscMod": 0,
  "speedBase": 30,
  "speedClimb": 0,
  "speedSwim": 0,
  "speedFly": 0,
  "flyManeuverability": "Average",
  "baseAttackBonus": 1,
  "naturalArmorMod": 0,
  "deflectionMod": 0,
  "dodgeMod": 0,
  "acMiscMod": 0,
  "saves": {
    "fortitude": {
      "name": "Fortitude",
      "base": 2,
      "magicMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "reflex": {
      "name": "Reflex",
      "base": 0,
      "magicMod": 0,
      "miscMod": 0,
      "tempMod": 0
    },
    "will": {
      "name": "Will",
      "base": 0,
      "magicMod": 0,
      "miscMod": 0,
      "tempMod": 0
    }
  },
  "weapons": [
    {
      "id": "wp-1793487022524-1",
      "name": "Longsword",
      "category": "Melee",
      "damageFormula": "1d8 + str_mod",
      "critical": "19-20/x2",
      "range": "Melee",
      "damageType": "Slashing",
      "weight": 4,
      "isEquipped": true
    }
  ],
  "armor": [
    {
      "id": "ar-1793487022524-1",
      "name": "Chain Shirt",
      "type": "Light",
      "acBonus": 4,
      "maxDex": 4,
      "checkPenalty": -2,
      "spellFailure": 20,
      "speed30": 30,
      "weight": 25,
      "isEquipped": true
    }
  ],
  "featsAndAbilities": [
    "Power Attack",
    "Weapon Focus (Longsword)"
  ],
  "skills": [
    {
      "id": "sk-1",
      "name": "Acrobatics",
      "keyAbility": "DEX",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-2",
      "name": "Appraise",
      "keyAbility": "INT",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-3",
      "name": "Bluff",
      "keyAbility": "CHA",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-4",
      "name": "Climb",
      "keyAbility": "STR",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-5",
      "name": "Craft (Alchemy)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-6",
      "name": "Diplomacy",
      "keyAbility": "CHA",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-7",
      "name": "Disable Device",
      "keyAbility": "DEX",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": true
    },
    {
      "id": "sk-8",
      "name": "Disguise",
      "keyAbility": "CHA",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-9",
      "name": "Escape Artist",
      "keyAbility": "DEX",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-10",
      "name": "Fly",
      "keyAbility": "DEX",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-11",
      "name": "Handle Animal",
      "keyAbility": "CHA",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-12",
      "name": "Heal",
      "keyAbility": "WIS",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-13",
      "name": "Intimidate",
      "keyAbility": "CHA",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-14",
      "name": "Knowledge (Arcana)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-15",
      "name": "Knowledge (Dungeoneering)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-16",
      "name": "Knowledge (Engineering)",
      "keyAbility": "INT",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-17",
      "name": "Knowledge (Geography)",
      "keyAbility": "INT",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-18",
      "name": "Knowledge (History)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-19",
      "name": "Knowledge (Local)",
      "keyAbility": "INT",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-20",
      "name": "Knowledge (Nature)",
      "keyAbility": "INT",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-21",
      "name": "Knowledge (Nobility)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-22",
      "name": "Knowledge (Planes)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-23",
      "name": "Knowledge (Religion)",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-24",
      "name": "Linguistics",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-25",
      "name": "Perception",
      "keyAbility": "WIS",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-26",
      "name": "Perform (Oratory)",
      "keyAbility": "CHA",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-27",
      "name": "Profession (Soldier)",
      "keyAbility": "WIS",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-28",
      "name": "Ride",
      "keyAbility": "DEX",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-29",
      "name": "Sense Motive",
      "keyAbility": "WIS",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-30",
      "name": "Sleight of Hand",
      "keyAbility": "DEX",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": true
    },
    {
      "id": "sk-31",
      "name": "Spellcraft",
      "keyAbility": "INT",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    },
    {
      "id": "sk-32",
      "name": "Stealth",
      "keyAbility": "DEX",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-33",
      "name": "Survival",
      "keyAbility": "WIS",
      "isClassSkill": false,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": false
    },
    {
      "id": "sk-34",
      "name": "Swim",
      "keyAbility": "STR",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": true,
      "isTrainedOnly": false
    },
    {
      "id": "sk-35",
      "name": "Use Magic Device",
      "keyAbility": "CHA",
      "isClassSkill": true,
      "ranks": 0,
      "miscMod": 0,
      "hasArmorCheckPenalty": false,
      "isTrainedOnly": true
    }
  ],
  "favoredClassSkillRanks": 1,
  "inventory": [
    {
      "id": "inv-1793487022524-1",
      "name": "Backpack (Leather)",
      "quantity": 1,
      "weight": 2,
      "location": "Back",
      "storageType": "worn",
      "category": "Gear",
      "isEquipped": true,
      "valueGp": 2,
      "shortDescription": "Standard sturdy adventurer backpack."
    },
    {
      "id": "inv-1793487022524-2",
      "name": "Bedroll & Blanket",
      "quantity": 1,
      "weight": 5,
      "location": "Backpack",
      "storageType": "stored",
      "category": "Gear",
      "valueGp": 0.5
    },
    {
      "id": "inv-1793487022524-3",
      "name": "Trail Rations (5 days)",
      "quantity": 5,
      "weight": 5,
      "location": "Backpack",
      "storageType": "stored",
      "category": "Gear",
      "valueGp": 2.5
    },
    {
      "id": "inv-1793487022524-4",
      "name": "Waterskin",
      "quantity": 1,
      "weight": 4,
      "location": "Backpack",
      "storageType": "stored",
      "category": "Gear",
      "valueGp": 1
    },
    {
      "id": "inv-1793487022524-5",
      "name": "Torches (5)",
      "quantity": 5,
      "weight": 5,
      "location": "Backpack",
      "storageType": "stored",
      "category": "Gear",
      "valueGp": 0.05
    }
  ],
  "currency": {
    "cp": 0,
    "sp": 0,
    "gp": 50,
    "pp": 0
  },
  "languages": [
    "Common"
  ],
  "casterLevel": 0,
  "spellKeyAbility": "INT",
  "spellSlots": [],
  "spells": [],
  "conditions": {
    "blinded": false,
    "cowering": false,
    "dazzled": false,
    "deafened": false,
    "entangled": false,
    "exhausted": false,
    "fatigued": false,
    "frightened": false,
    "grappled": false,
    "panicked": false,
    "pinned": false,
    "prone": false,
    "shaken": false,
    "sickened": false,
    "stunned": false,
    "haste": false,
    "prayer": false,
    "enlarge": false,
    "reduce": false,
    "heroism": false
  },
  "customObjects": [],
  "biography": {
    "description": "",
    "personality": "",
    "traits": "",
    "flaws": "",
    "allies": "",
    "enemies": "",
    "notes": ""
  },
  "profileData": {
    "avatarUrl": "",
    "customFields": [
      {
        "id": "f-1",
        "title": "Physical Appearance & Attire",
        "content": ""
      },
      {
        "id": "f-2",
        "title": "Backstory & Bloodline",
        "content": ""
      },
      {
        "id": "f-3",
        "title": "Deity & Code of Conduct",
        "content": ""
      }
    ]
  },
  "rollupNotes": {
    "content": "== Current Quest: Defense of Kenabres ==\n- Met with High Priestess Althea at the temple\n- Need to investigate the subterranean cavern beneath the market square\n- Track demonic cultists carrying the sign of Deskari\n- Stock up on holy water and cold iron arrows before descending",
    "isRolledUp": false
  },
  "customClassGrids": {
    "class1": {
      "id": "class1",
      "className": "Cavalier",
      "level": 12,
      "hitDie": 10,
      "skillPointsPerLevel": 4,
      "proficiencies": "Simple and martial weapons, light, medium, and heavy armor, shields (except tower shields)",
      "starterKitName": "Cavalier's Kit",
      "rawText": "1\t+1\t+2\t+0\t+0\tChallenge 1/day, mount, order, tactician 9/day\n2\t+2\t+3\t+0\t+0\tOrder ability\n3\t+3\t+3\t+1\t+1\tCavalier's charge\n4\t+4\t+4\t+1\t+1\tChallenge 2/day, expert trainer\n5\t+5\t+4\t+1\t+1\tBanner\n6\t+6/+1\t+5\t+2\t+2\tBonus feat\n7\t+7/+2\t+5\t+2\t+2\tChallenge 3/day\n8\t+8/+3\t+6\t+2\t+2\tOrder ability\n9\t+9/+4\t+6\t+3\t+3\tGreater tactician\n10\t+10/+5\t+7\t+3\t+3\tChallenge 4/day\n11\t+11/+6/+1\t+7\t+3\t+3\tMighty charge\n12\t+12/+7/+2\t+8\t+4\t+4\tBonus feat\n13\t+13/+8/+3\t+8\t+4\t+4\tChallenge 5/day\n14\t+14/+9/+4\t+9\t+4\t+4\tGreater banner\n15\t+15/+10/+5\t+9\t+5\t+5\tOrder ability\n16\t+16/+11/+6/+1\t+10\t+5\t+5\tChallenge 6/day\n17\t+17/+12/+7/+2\t+10\t+5\t+5\tMaster tactician\n18\t+18/+13/+8/+3\t+11\t+6\t+6\tBonus feat\n19\t+19/+14/+9/+4\t+11\t+6\t+6\tChallenge 7/day\n20\t+20/+15/+10/+5\t+12\t+6\t+6\tLast stand, supreme charge",
      "rows": [
        {
          "level": 1,
          "bab": 1,
          "babString": "+1",
          "fort": 2,
          "ref": 0,
          "will": 0,
          "special": "Challenge 1/day, mount, order, tactician 9/day"
        },
        {
          "level": 2,
          "bab": 2,
          "babString": "+2",
          "fort": 3,
          "ref": 0,
          "will": 0,
          "special": "Order ability"
        },
        {
          "level": 3,
          "bab": 3,
          "babString": "+3",
          "fort": 3,
          "ref": 1,
          "will": 1,
          "special": "Cavalier's charge"
        },
        {
          "level": 4,
          "bab": 4,
          "babString": "+4",
          "fort": 4,
          "ref": 1,
          "will": 1,
          "special": "Challenge 2/day, expert trainer"
        },
        {
          "level": 5,
          "bab": 5,
          "babString": "+5",
          "fort": 4,
          "ref": 1,
          "will": 1,
          "special": "Banner"
        },
        {
          "level": 6,
          "bab": 6,
          "babString": "+6/+1",
          "fort": 5,
          "ref": 2,
          "will": 2,
          "special": "Bonus feat"
        },
        {
          "level": 7,
          "bab": 7,
          "babString": "+7/+2",
          "fort": 5,
          "ref": 2,
          "will": 2,
          "special": "Challenge 3/day"
        },
        {
          "level": 8,
          "bab": 8,
          "babString": "+8/+3",
          "fort": 6,
          "ref": 2,
          "will": 2,
          "special": "Order ability"
        },
        {
          "level": 9,
          "bab": 9,
          "babString": "+9/+4",
          "fort": 6,
          "ref": 3,
          "will": 3,
          "special": "Greater tactician"
        },
        {
          "level": 10,
          "bab": 10,
          "babString": "+10/+5",
          "fort": 7,
          "ref": 3,
          "will": 3,
          "special": "Challenge 4/day"
        },
        {
          "level": 11,
          "bab": 11,
          "babString": "+11/+6/+1",
          "fort": 7,
          "ref": 3,
          "will": 3,
          "special": "Mighty charge"
        },
        {
          "level": 12,
          "bab": 12,
          "babString": "+12/+7/+2",
          "fort": 8,
          "ref": 4,
          "will": 4,
          "special": "Bonus feat"
        },
        {
          "level": 13,
          "bab": 13,
          "babString": "+13/+8/+3",
          "fort": 8,
          "ref": 4,
          "will": 4,
          "special": "Challenge 5/day"
        },
        {
          "level": 14,
          "bab": 14,
          "babString": "+14/+9/+4",
          "fort": 9,
          "ref": 4,
          "will": 4,
          "special": "Greater banner"
        },
        {
          "level": 15,
          "bab": 15,
          "babString": "+15/+10/+5",
          "fort": 9,
          "ref": 5,
          "will": 5,
          "special": "Order ability"
        },
        {
          "level": 16,
          "bab": 16,
          "babString": "+16/+11/+6/+1",
          "fort": 10,
          "ref": 5,
          "will": 5,
          "special": "Challenge 6/day"
        },
        {
          "level": 17,
          "bab": 17,
          "babString": "+17/+12/+7/+2",
          "fort": 10,
          "ref": 5,
          "will": 5,
          "special": "Master tactician"
        },
        {
          "level": 18,
          "bab": 18,
          "babString": "+18/+13/+8/+3",
          "fort": 11,
          "ref": 6,
          "will": 6,
          "special": "Bonus feat"
        },
        {
          "level": 19,
          "bab": 19,
          "babString": "+19/+14/+9/+4",
          "fort": 11,
          "ref": 6,
          "will": 6,
          "special": "Challenge 7/day"
        },
        {
          "level": 20,
          "bab": 20,
          "babString": "+20/+15/+10/+5",
          "fort": 12,
          "ref": 6,
          "will": 6,
          "special": "Last stand, supreme charge"
        }
      ]
    }
  },
  "customBuffs": [],
  "resourceTrackers": [
    {
      "id": "res-smite",
      "name": "Smite Evil",
      "current": 1,
      "max": 3,
      "macroKey": "SMITE",
      "category": "Class Resource",
      "notes": "+4 attack (CHA), +12 damage (level), double on first hit vs evil dragons/undead/outsiders"
    },
    {
      "id": "res-challenge",
      "name": "Cavalier Challenge",
      "current": 2,
      "max": 4,
      "macroKey": "CHALLENGE",
      "category": "Class Resource",
      "notes": "+12 damage against challenged target, -2 AC to other foes"
    },
    {
      "id": "res-lay-hands",
      "name": "Lay on Hands / Healing",
      "current": 4,
      "max": 6,
      "macroKey": "LAY_ON_HANDS",
      "category": "Resource Pool",
      "notes": "Heals 6d6 as standard action (swift on self)"
    },
    {
      "id": "res-spells-1",
      "name": "1st-Level Spells",
      "current": 3,
      "max": 3,
      "macroKey": "SPELL_SLOT_1",
      "category": "Spell Slot",
      "notes": "Paladin / Cleric 1st circle spell slots"
    }
  ],
  "characterActions": [
    {
      "id": "act-smite",
      "name": "Smite Evil!",
      "category": "Class Ability",
      "actionType": "Swift",
      "macroFormula": "2d6+CHA",
      "macroKey": "SMITE_EVIL",
      "icon": "sparkles",
      "description": "Adds CHA mod (+4) to attack rolls and level (+12) to damage against evil targets. On the first successful hit against evil dragons, undead, or fiends, damage increases to 2 per level (+24). Bypasses DR and grants +4 deflection AC vs target.",
      "shortSummary": "Swift action. +4 attack, +12 dmg, bypass DR",
      "usesPerDay": "1/3 used",
      "range": "Line of sight",
      "target": "One evil creature"
    },
    {
      "id": "act-breath",
      "name": "Dragon Breath",
      "category": "Racial",
      "actionType": "Standard",
      "macroFormula": "2d6+5",
      "macroKey": "DRAGON_BREATH",
      "icon": "flame",
      "description": "Exhales a 30-foot cone of searing dragonfire dealing 2d6+5 fire damage to all creatures in the area. DC 17 Reflex save for half damage.",
      "shortSummary": "30-ft cone, 2d6+5 fire, Reflex DC 17 half",
      "saveDC": "DC 17 Reflex",
      "range": "30 ft cone"
    },
    {
      "id": "act-power-atk",
      "name": "Power Attack",
      "category": "Feats",
      "actionType": "Free",
      "macroFormula": "-3/+9",
      "macroKey": "POWER_ATTACK",
      "icon": "swords",
      "description": "Take a -3 penalty on all melee attack rolls to gain a +9 bonus on all melee damage rolls when wielding a two-handed weapon (such as the Greataxe). Lasts until next turn.",
      "shortSummary": "Free action. -3 attack, +9 damage (2H)"
    },
    {
      "id": "act-heroism",
      "name": "Heroism",
      "category": "Spells",
      "actionType": "Standard",
      "macroFormula": "1d20+2",
      "macroKey": "HEROISM",
      "icon": "shield",
      "description": "Imbues a single touched creature with heroic bravery, granting a +2 morale bonus on attack rolls, saving throws, and skill checks for 120 minutes.",
      "shortSummary": "+2 morale bonus to attacks, saves, skills for 120 min",
      "duration": "120 min",
      "range": "Touch"
    },
    {
      "id": "act-challenge",
      "name": "Cavalier's Challenge",
      "category": "Class Ability",
      "actionType": "Swift",
      "macroFormula": "1d20+12",
      "macroKey": "CHALLENGE",
      "icon": "crosshair",
      "description": "Issue a formal combat challenge to a single foe in sight. Melee attacks deal +12 damage to the target, but you suffer a -2 AC penalty against all other attacks.",
      "shortSummary": "+12 damage to challenged target, -2 AC to others"
    }
  ],
  "characterFeats": [
    {
      "id": "feat-1",
      "name": "Power Attack",
      "type": "Combat",
      "prerequisites": "Str 13, BAB +1",
      "summary": "Trade melee attack bonus for extra damage (-3 to hit / +9 damage two-handed)."
    },
    {
      "id": "feat-2",
      "name": "Furious Focus",
      "type": "Combat",
      "prerequisites": "Str 13, Power Attack, BAB +1",
      "summary": "No penalty on first melee attack when two-handing with Power Attack."
    },
    {
      "id": "feat-3",
      "name": "Weapon Focus (Greataxe)",
      "type": "Combat",
      "prerequisites": "Proficiency with weapon, BAB +1",
      "summary": "+1 bonus on all attack rolls with greataxe."
    },
    {
      "id": "feat-4",
      "name": "Toughness",
      "type": "General",
      "prerequisites": "None",
      "summary": "+3 hit points, +1 per Hit Die beyond 3rd (+12 HP total)."
    },
    {
      "id": "feat-5",
      "name": "Iron Will",
      "type": "General",
      "prerequisites": "None",
      "summary": "+2 bonus on all Will saving throws."
    },
    {
      "id": "feat-6",
      "name": "Combat Reflexes",
      "type": "Combat",
      "prerequisites": "None",
      "summary": "Make additional attacks of opportunity equal to Dex bonus (+3 AoOs/round)."
    }
  ],
  "downtimeCapital": {
    "currentGp": 50,
    "bankGp": 0,
    "level": 1,
    "totalDp": 0,
    "goods": 0,
    "influence": 0,
    "labor": 0,
    "magic": 0,
    "kbp": 0
  },
  "magicItemSlots": {},
  "companions": [],
  "characterBio": {
    "scratchpad": "== Character Notes ==\n- Session 1 notes...",
    "portraits": [],
    "currentPortraitIndex": 0,
    "bioSections": [
      {
        "id": "bio-bg-new",
        "title": "Background & Origins",
        "content": ""
      }
    ],
    "skin": ""
  },
  "activeStorageTab": "worn",
  "droppedBags": {},
  "memoryBank": {
    "schemaVersion": 1,
    "pinnedFacts": []
  }
};

/**
 * Creates a pristine, completely blank Level 1 character sheet
 */
export function createBlankCharacter(): PF1Character {
  return {
    name: 'New Adventurer',
    player: '',
    alignment: 'Neutral',
    characterClass: '',
    level: 1,
    race: '',
    deity: '',
    size: 'Medium',
    gender: '',
    age: 0,
    height: '',
    weight: '',
    eyes: '',
    hair: '',
    campaign: '',
    currentXP: 0,
    nextLevelXP: 2000,
    heroPoints: 0,
    classes: [],
    deathSaves: [false, false, false],
    combatTracker: {
      round: 1,
      turn: 1,
      isInCombat: false,
    },
    classSkillPointsPerLevel: 2,
    abilities: {
      STR: { name: 'STR', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      DEX: { name: 'DEX', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      CON: { name: 'CON', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      INT: { name: 'INT', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      WIS: { name: 'WIS', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      CHA: { name: 'CHA', base: 10, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
    },
    hpTotalMax: 0,
    hpCurrent: 0,
    hpNonlethal: 0,
    hpTemp: 0,
    hitDice: '',
    hpBreakdown: {
      calcMethod: 'max',
      hitDiceCount: 1,
      hitDiceSize: 0,
      hitDiceRolledBase: 0,
      additionalBonuses: [],
    },
    damageReduction: '',
    fastHealing: '',
    spellResistance: 0,
    resistances: '',
    immunities: '',
    buffBox: {
      Enhancement: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Circumstance: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Competence: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Deflection: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Dodge: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Insight: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Item: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Inherent: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Luck: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Morale: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      'Pro/Sac': { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Race: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      'NAT armor': { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Armor: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      'Level advance': { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Shield: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Untyped: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      Size: { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      'Alt size': { hp: 0, mattack: 0, rattack: 0, fort: 0, ref: 0, will: 0, ac: 0, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    },
    customBuffs: [],
    initMiscMod: 0,
    speedBase: 30,
    speedClimb: 0,
    speedSwim: 0,
    speedFly: 0,
    flyManeuverability: 'Average',
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
    weapons: [],
    armor: [],
    featsAndAbilities: [],
    characterFeats: [],
    generatedOddFeatLevels: [],
    skills: INITIAL_SKILLS.map((s) => ({
      ...s,
      isClassSkill: false,
      ranks: 0,
      miscMod: 0,
    })),
    favoredClassSkillRanks: 0,
    inventory: [],
    droppedBags: {},
    currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
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
    characterBio: {
      scratchpad: '',
      portraits: [],
      currentPortraitIndex: 0,
      bioSections: [
        {
          id: 'bio-bg-new',
          title: 'Background & Origins',
          content: '',
        },
      ],
      skin: '',
    },
    profileData: {
      avatarUrl: '',
      customFields: [
        { id: 'f-1', title: 'Physical Appearance & Attire', content: '' },
        { id: 'f-2', title: 'Backstory & Bloodline', content: '' },
        { id: 'f-3', title: 'Deity & Code of Conduct', content: '' },
      ],
    },
    magicItemSlots: {},
    companions: [],
    downtimeCapital: {
      currentGp: 0,
      bankGp: 0,
      level: 1,
      totalDp: 0,
      goods: 0,
      influence: 0,
      labor: 0,
      magic: 0,
      kbp: 0,
    },
    activeStorageTab: 'worn',
    journal: [],
    installedModules: {
      aiCompanion: false,
      aiSettings: {
        isInstalled: false,
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
  const targetLevel = Math.max(1, Math.min(20, char.level || 1));
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



