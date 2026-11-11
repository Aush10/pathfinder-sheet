/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../data/defaultCharacter';
import type { CustomClassGrid, PF1Character, SOTRichTextPage } from '../types/character';
import {
  DEFAULT_AI_MODULE_SETTINGS,
  parseNaturalLanguageSheetUpdates,
  runCompleteSheetWrites,
} from './aiService';
import { applyStructuredSheetUpdates, pointBuyCost } from './sheetFieldWrites';

const permissions = DEFAULT_AI_MODULE_SETTINGS.allowedFields;

function skill(character: PF1Character, name: string) {
  const found = character.skills.find((row) => row.name === name);
  assert.ok(found, `skills matrix is missing ${name}`);
  return found;
}

function withBudget(budget: number, level = 1): PF1Character {
  const character = createBlankCharacter();
  character.level = level;
  character.pointBuyBudget = budget;
  character.sotCatalogue = { weblinks: [], overridePages: [] };
  for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const) {
    character.abilities[ability] = { ...character.abilities[ability], base: 10, levelAsiMod: 0 };
  }
  return character;
}

const wardenPage: SOTRichTextPage = {
  id: 'sot-warden',
  title: 'Warden',
  category: 'Full Class SRD',
  htmlContent: '',
  plainText: [
    'Warden',
    'Hit Die: d10',
    'Skill Ranks per Level: 4 + Int',
    'Class Skills: Perception, Stealth, and Survival.',
    '1st +1 +2 +0 +0 Watch the tree line',
    '2nd +2 +3 +0 +0 Terrain bond',
  ].join('\n'),
  isOverride: true,
  tags: ['Warden'],
  updatedAt: 1,
};

test('class-skill true and false update the skills matrix without touching ranks or misc', () => {
  const character = createBlankCharacter();
  const on = applyStructuredSheetUpdates(
    character,
    [{ category: 'skills', skill: 'Perception', isClassSkill: true, ranks: 4, miscMod: 2 }],
    permissions
  );
  assert.equal(on.rejected.length, 0);
  assert.equal(skill(on.character, 'Perception').isClassSkill, true);
  assert.equal(skill(on.character, 'Perception').ranks, 4);
  assert.equal(skill(on.character, 'Perception').miscMod, 2);
  assert.equal(skill(on.character, 'Stealth').isClassSkill, false);

  const off = applyStructuredSheetUpdates(
    on.character,
    [{ category: 'skills', skill: 'Perception', isClassSkill: false }],
    permissions
  );
  assert.equal(skill(off.character, 'Perception').isClassSkill, false);
  assert.equal(skill(off.character, 'Perception').ranks, 4);
  assert.equal(skill(off.character, 'Perception').miscMod, 2);
});

test('english class-skill command toggles the same checkbox the sheet reads', () => {
  let character = createBlankCharacter();
  const enable = parseNaturalLanguageSheetUpdates(
    'set Perception class skill to true',
    character,
    permissions
  );
  assert.equal(enable.some((action) => action.isRejected || action.isBlockedByBlindSpot), false);
  character = enable.reduce((sheet, action) => action.apply(sheet), character);
  assert.equal(skill(character, 'Perception').isClassSkill, true);
  assert.equal(skill(character, 'Perception').ranks, 0);

  const disable = parseNaturalLanguageSheetUpdates(
    'set Perception class skill to false',
    character,
    permissions
  );
  character = disable.reduce((sheet, action) => action.apply(sheet), character);
  assert.equal(skill(character, 'Perception').isClassSkill, false);
  assert.equal(skill(character, 'Perception').ranks, 0);
});

test('feats, inventory, and journal writes land on the sheet collections', () => {
  const result = applyStructuredSheetUpdates(
    createBlankCharacter(),
    [
      { category: 'feats', add: { name: 'Power Attack', summary: 'Trade attack for damage.' } },
      { category: 'inventory', add: { name: 'Hempen rope', quantity: 1, weight: 10 } },
      { category: 'journal', add: { title: 'First watch', content: 'The marsh gate is shut.' } },
      { category: 'customFormulas', add: { name: 'firebreath', formula: '2d6', description: 'Breath' } },
    ],
    permissions
  );
  assert.equal(result.character.characterFeats?.some((feat) => feat.name === 'Power Attack'), true);
  assert.equal(result.character.inventory.some((item) => item.name === 'Hempen rope' && item.quantity === 1), true);
  assert.equal(result.character.journal?.some((entry) => entry.title === 'First watch'), true);
  assert.equal(result.character.customObjects.some((formula) => formula.name === 'firebreath'), true);
});

test('class, level, and hit die stay on the class list and Add Class grid', () => {
  const character = createBlankCharacter();
  character.level = 2;
  character.characterClass = 'Fighter 2';
  character.classes = [
    {
      id: 'class1',
      name: 'Fighter',
      level: 2,
      hitDie: 10,
      skillPointsPerLevel: 2,
      babProgression: 'full',
      isFavoredClass: true,
    },
  ];
  character.customClassGrids = {
    class9: {
      id: 'class9',
      className: 'Oracle',
      level: 3,
      hitDie: 8,
      skillPointsPerLevel: 4,
      proficiencies: 'kept',
      rawText: 'oracle row',
      rows: [{ level: 1, bab: 0, fort: 0, ref: 0, will: 2, special: 'mystery' }],
    },
  };
  character.sotCatalogue = { weblinks: [], overridePages: [] };

  const result = applyStructuredSheetUpdates(
    character,
    [{ category: 'coreIdentity', className: 'Warden', level: 4, hitDie: 10, classMode: 'set' }],
    permissions
  );

  assert.equal(result.character.classes.length, 1);
  assert.equal(result.character.classes[0].name, 'Warden');
  assert.equal(result.character.classes[0].level, 4);
  assert.equal(result.character.classes[0].hitDie, 10);
  assert.equal(result.character.level, 4);
  assert.match(result.character.characterClass, /Warden 4/);
  assert.equal(result.character.hitDice, '4d10');
  assert.equal(result.character.hpBreakdown.hitDiceSize, 10);

  const warden = Object.values(result.character.customClassGrids || {}).find((grid) => grid.className === 'Warden');
  assert.ok(warden);
  assert.equal(warden.level, 4);
  assert.equal(warden.hitDie, 10);
  assert.deepEqual(warden.rows, []);
  assert.equal(warden.unused, false);

  const oracle = result.character.customClassGrids?.class9 as CustomClassGrid;
  assert.equal(oracle.unused, true);
  assert.equal(oracle.rows[0].special, 'mystery');
  assert.equal(oracle.proficiencies, 'kept');
  const fighter = result.character.customClassGrids?.class1;
  assert.equal(fighter?.unused, true);
  assert.equal(fighter?.className, 'Fighter');
  assert.match(result.questions.join(' '), /did not invent/i);
  assert.equal(result.missingSotRequest?.category, 'Class');
});

test('a pasted SOT progression grid is copied and an unknown archetype is not invented', () => {
  const character = createBlankCharacter();
  character.sotCatalogue = { weblinks: [], overridePages: [wardenPage] };
  const result = applyStructuredSheetUpdates(
    character,
    [
      {
        category: 'coreIdentity',
        className: 'Warden',
        archetype: 'Stygian Warden',
        level: 2,
        classMode: 'set',
      },
    ],
    permissions
  );
  const warden = Object.values(result.character.customClassGrids || {}).find((grid) => grid.className === 'Warden');
  assert.ok(warden);
  assert.equal(warden.rows.length, 2);
  assert.match(warden.rows[0].special, /Watch the tree line/);
  assert.equal(warden.rows.some((row) => /stygian/i.test(row.special)), false);
  assert.equal(result.character.classes[0].archetype, 'Stygian Warden');
  assert.equal(result.character.classes[0].hitDie, 10);
  assert.equal(result.missingSotRequest?.category, 'Archetype');
  assert.equal(skill(result.character, 'Perception').isClassSkill, true);
  assert.equal(skill(result.character, 'Perception').ranks, 0);
  assert.equal(skill(result.character, 'Acrobatics').isClassSkill, false);
});

test('english set class, level, and hit die write the shared class record', () => {
  let character = createBlankCharacter();
  character.sotCatalogue = { weblinks: [], overridePages: [] };
  const context = { sotPages: [] as SOTRichTextPage[] };
  for (const command of ['set class to Warden', 'set level to 4', 'set hit die to d8']) {
    const actions = parseNaturalLanguageSheetUpdates(command, character, permissions, context);
    const applicable = actions.filter((action) => !action.isBlockedByBlindSpot && !action.isRejected);
    assert.ok(applicable.length > 0, command);
    character = applicable.reduce((sheet, action) => action.apply(sheet), character);
  }
  assert.equal(character.classes[0].name, 'Warden');
  assert.equal(character.classes[0].level, 4);
  assert.equal(character.classes[0].hitDie, 8);
  assert.equal(character.level, 4);
  assert.equal(character.customClassGrids?.class1?.className, 'Warden');
  assert.equal(character.customClassGrids?.class1?.level, 4);
  assert.equal(character.customClassGrids?.class1?.hitDie, 8);
  assert.equal(character.hpBreakdown.hitDiceSize, 8);
  assert.deepEqual(character.customClassGrids?.class1?.rows, []);
});

test('over-budget point buy and extra level increases are not saved', () => {
  const character = withBudget(15, 1);
  const over = applyStructuredSheetUpdates(
    character,
    [
      {
        category: 'abilities',
        scores: { STR: 18, DEX: 18, CON: 18, INT: 18, WIS: 18, CHA: 18 },
      },
    ],
    permissions
  );
  assert.equal(over.character.abilities.STR.base, 10);
  assert.match(over.rejected.map((item) => item.details).join(' '), /not saved/i);

  const asi = applyStructuredSheetUpdates(
    character,
    [
      {
        category: 'abilities',
        scores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        levelIncreases: { STR: 2 },
      },
    ],
    permissions
  );
  assert.equal(asi.character.abilities.STR.base, 10);
  assert.equal(asi.character.abilities.STR.levelAsiMod, 0);
  assert.match(asi.rejected.map((item) => item.details).join(' '), /level increases/i);

  const legal = applyStructuredSheetUpdates(
    character,
    [
      {
        category: 'abilities',
        scores: { STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 10, CHA: 10 },
      },
    ],
    permissions
  );
  assert.equal(legal.rejected.length, 0);
  assert.equal(legal.character.abilities.STR.base, 15);
  const spent = (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).reduce(
    (sum, ability) => sum + (pointBuyCost(legal.character.abilities[ability].base) ?? 0),
    0
  );
  assert.ok(spent <= 15);
});

test('a missing point-buy budget is a question and does not save scores', () => {
  const character = createBlankCharacter();
  const result = applyStructuredSheetUpdates(
    character,
    [{ category: 'abilities', scores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 } }],
    permissions
  );
  assert.equal(result.character.abilities.STR.base, 0);
  assert.match(result.questions.join(' '), /point-buy budget/i);
  assert.equal(result.character.pointBuyBudget, undefined);
});

test('random assignment retries illegal arrays and does not keep them', () => {
  const legal = [8 / 12 + 0.001, 7 / 12 + 0.001, 6 / 12 + 0.001, 5 / 12 + 0.001, 3 / 12 + 0.001, 3 / 12 + 0.001];
  let calls = 0;
  const rng = () => {
    calls += 1;
    if (calls <= 12) return 0.999;
    return legal[calls - 13];
  };
  const character = withBudget(20, 1);
  const result = runCompleteSheetWrites({
    character,
    userPrompt: 'Please roll a random 20-point buy ability score array',
    allowRandom: true,
    rng,
    sheetUpdates: [
      {
        category: 'abilities',
        random: true,
        scores: { STR: 18, DEX: 18, CON: 18, INT: 18, WIS: 18, CHA: 18 },
      },
    ],
  });
  const scores = (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map(
    (ability) => result.character.abilities[ability].base
  );
  const spent = scores.reduce((sum, score) => sum + (pointBuyCost(score) ?? 999), 0);
  assert.ok(calls > 6);
  assert.ok(spent <= 20);
  assert.equal(scores.every((score) => score === 18), false);
  assert.equal(result.rejected.some((item) => /not saved|over budget/i.test(item.details)), true);
});

test('random scores are not assigned unless the player asked', () => {
  const character = withBudget(20, 1);
  const result = applyStructuredSheetUpdates(
    character,
    [{ category: 'abilities', random: true }],
    permissions,
    { allowRandom: false }
  );
  assert.equal(result.character.abilities.STR.base, 10);
  assert.match(result.rejected.map((item) => `${item.label} ${item.details}`).join(' '), /not requested/i);
});

test('blind-spotted fields stay unchanged and secret-like names are refused', () => {
  const character = withBudget(20, 1);
  const beforeSkills = JSON.stringify(character.skills);
  const beforeFeats = JSON.stringify(character.characterFeats);
  const blocked = applyStructuredSheetUpdates(
    character,
    [
      { category: 'skills', skill: 'Stealth', isClassSkill: true, ranks: 3, miscMod: 1 },
      { category: 'feats', add: { name: 'Dodge', summary: 'AC.' } },
      { category: 'inventory', add: { name: 'Torch', quantity: 2 } },
    ],
    { ...permissions, skills: false, feats: false }
  );
  assert.equal(JSON.stringify(blocked.character.skills), beforeSkills);
  assert.equal(JSON.stringify(blocked.character.characterFeats), beforeFeats);
  assert.equal(blocked.character.inventory.some((item) => item.name === 'Torch'), true);
  assert.equal(blocked.blocked.length, 2);

  const secretBefore = JSON.stringify(character);
  const secret = applyStructuredSheetUpdates(
    character,
    [{ category: 'notes', values: { apiKey: 'sk-live-secret' }, appendNote: 'do not store this' }],
    permissions
  );
  assert.equal(JSON.stringify(secret.character), secretBefore);
  assert.match(secret.rejected.map((item) => item.label).join(' '), /secret/i);

  const moduleBlocked = applyStructuredSheetUpdates(
    character,
    [{ category: 'abilities', scores: { STR: 14, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 } }],
    permissions,
    { allowedModules: { ...DEFAULT_AI_MODULE_SETTINGS.allowedModules!, pointBuy: false } }
  );
  assert.equal(moduleBlocked.character.abilities.STR.base, 10);
  assert.equal(moduleBlocked.blocked.length, 1);
});
