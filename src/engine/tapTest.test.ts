/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../data/defaultCharacter';
import { completeSheetConverse } from './aiService';
import { pointBuyCost } from './sheetFieldWrites';
import {
  TAP_TEST_STEPS,
  buildTapTestTurnInstruction,
  filterTapTestUpdates,
  isTapTestCommand,
} from './tapTest';

const abilityNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

function currentCharacter() {
  const character = createBlankCharacter();
  character.name = 'Existing Hero';
  character.pointBuyBudget = 20;
  character.sotCatalogue = { weblinks: [], overridePages: [] };
  for (const ability of abilityNames) character.abilities[ability].base = 10;
  return character;
}

test('only the literal trimmed tap test command starts the staged test', () => {
  for (const text of ['tap test', 'TAP TEST', '  TaP TeSt\n']) {
    assert.equal(isTapTestCommand(text), true, text);
  }
  for (const text of ['', 'tap', 'test', 'tap testing', 'please tap test', 'tap test now', 'tap  test', 'tap\ttest']) {
    assert.equal(isTapTestCommand(text), false, text);
  }
});

test('each tap test turn names its stage and point-buy budget and requires one update', () => {
  assert.deepEqual(TAP_TEST_STEPS.map((step) => step.id), [
    'identity', 'class', 'abilities', 'hp', 'skills', 'feats', 'attacks', 'armor', 'inventory', 'biography',
  ]);
  assert.deepEqual(TAP_TEST_STEPS.map((step) => step.category), [
    'coreIdentity', 'coreIdentity', 'abilities', 'hp', 'skills', 'feats', 'attacksAndWeapons', 'armorAndGear', 'inventory', 'bioAndProfile',
  ]);
  for (let index = 0; index < TAP_TEST_STEPS.length; index += 1) {
    const instruction = buildTapTestTurnInstruction(index, 20);
    assert.ok(instruction.includes(TAP_TEST_STEPS[index].label));
    assert.match(instruction, /20/);
    assert.match(instruction, /at most one\s+(?:structured\s+)?(?:sheet\s*updates?|update)/i);
  }
  for (const step of [-1, TAP_TEST_STEPS.length, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(buildTapTestTurnInstruction(step, 20), '');
    assert.deepEqual(filterTapTestUpdates([{ category: 'coreIdentity', values: { name: 'Ignored' } }], step), []);
  }
  for (const budget of [-1, 101, 20.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(buildTapTestTurnInstruction(0, budget), '');
  }
});

test('identity accepts one identity update and strips class fields and off-stage writes', () => {
  const source = [
    { category: 'inventory', add: { name: 'Premature rope' } },
    {
      category: 'coreIdentity',
      className: 'Wizard',
      level: 9,
      hitDie: 6,
      scores: { STR: 18 },
      values: { name: 'Mira', race: 'Elf', alignment: 'Neutral Good', className: 'Wizard', level: 9, hitDie: 6, STR: 18 },
    },
    { category: 'coreIdentity', values: { name: 'Second update must be ignored' } },
  ];
  const before = JSON.stringify(source);
  const filtered = filterTapTestUpdates(source, 0);
  assert.deepEqual(filtered, [{ category: 'coreIdentity', values: { name: 'Mira', race: 'Elf', alignment: 'Neutral Good' } }]);
  assert.equal(JSON.stringify(source), before, 'filtering must not mutate a model response');
});

test('the class turn cannot rename the character or change ability scores', () => {
  const filtered = filterTapTestUpdates([
    {
      category: 'coreIdentity',
      className: 'Fighter',
      level: 1,
      hitDie: 10,
      archetype: 'Archer',
      classMode: 'set',
      scores: { STR: 18 },
      values: { name: 'Wrong name', race: 'Dwarf', alignment: 'Lawful Evil' },
    },
    { category: 'abilities', random: true, budget: 20 },
  ], 1);
  assert.equal(filtered.length, 1);
  const update = filtered[0] as Record<string, unknown>;
  assert.equal(update.className, 'Fighter');
  assert.equal(update.level, 1);
  assert.equal(update.hitDie, 10);
  assert.equal(update.classMode, 'set');
  assert.equal('scores' in update, false);
  assert.equal('values' in update, false);
});

test('HP cannot carry class identity or ability changes inside its values', () => {
  const filtered = filterTapTestUpdates([
    {
      category: 'hp',
      className: 'Wizard',
      level: 20,
      scores: { STR: 18 },
      random: true,
      values: { hpCurrent: 12, hpTotalMax: 12, className: 'Wizard', level: 20, STR: 18, name: 'Injected name' },
    },
    { category: 'abilities', scores: { STR: 18 } },
  ], 3);
  assert.deepEqual(filtered, [{ category: 'hp', values: { hpCurrent: 12, hpTotalMax: 12 } }]);
});

test('collection turns reject bulk add lists and apply at most one on-stage item', () => {
  for (const [step, category] of [[5, 'feats'], [6, 'attacksAndWeapons'], [7, 'armorAndGear'], [8, 'inventory']] as const) {
    assert.deepEqual(filterTapTestUpdates([{ category, add: [{ name: 'First' }, { name: 'Second' }] }], step), []);
    assert.deepEqual(filterTapTestUpdates([
      { category: 'abilities', random: true },
      { category, add: { name: 'First item' } },
      { category, add: { name: 'Second item' } },
    ], step), [{ category, add: { name: 'First item' } }]);
  }
  for (const input of [undefined, null, 'bulk text', {}, { sheetUpdates: [] }, [null, false, 'invalid']]) {
    assert.deepEqual(filterTapTestUpdates(input, 0), []);
  }
});

test('tap-test conversation sends its stage and ignores model bulk, legacy, and off-stage writes', async (context) => {
  const character = currentCharacter();
  const originalAbilities = structuredClone(character.abilities);
  const originalInventory = structuredClone(character.inventory);
  const abortController = new AbortController();
  let requestBody: Record<string, unknown> | undefined;
  context.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    assert.equal(_input, '/api/openai/complete-sheet');
    assert.equal(init?.signal, abortController.signal);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ rawText: JSON.stringify({
      replyText: 'Identity applied.',
      fieldUpdates: ['set STR to 18', 'equip weapon Longsword | 1d8 | 19-20/x2 | melee | slashing'],
      sheetUpdates: [
        { category: 'inventory', add: [{ name: 'Bulk sword' }, { name: 'Bulk armor' }] },
        { category: 'abilities', random: true, budget: 20 },
        { category: 'coreIdentity', className: 'Wizard', level: 20, values: { name: 'Mira', race: 'Elf', alignment: 'Neutral Good', className: 'Wizard' } },
        { category: 'coreIdentity', values: { name: 'Second name' } },
      ],
    }) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const result = await completeSheetConverse({
    character,
    conversation: [],
    userPrompt: 'tap test',
    isRandomRequested: true,
    tapTest: { step: 0, budget: 20 },
    signal: abortController.signal,
  });
  assert.deepEqual(requestBody?.tapTest, { step: 0, budget: 20 });
  assert.equal(result.updatedCharacter.name, 'Mira');
  assert.equal(result.updatedCharacter.race, 'Elf');
  assert.equal(result.updatedCharacter.characterClass, character.characterClass);
  assert.equal(result.updatedCharacter.level, character.level);
  assert.deepEqual(result.updatedCharacter.abilities, originalAbilities);
  assert.deepEqual(result.updatedCharacter.inventory, originalInventory);
  assert.deepEqual(result.updatedCharacter.weapons, character.weapons);
});

test('invalid staged context is rejected before requesting a model response', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Invalid context must not call the model.');
  });
  const character = currentCharacter();
  const original = structuredClone(character);
  for (const tapTest of [{ step: -1, budget: 20 }, { step: 0, budget: 101 }, { step: 2, budget: Number.NaN }]) {
    await assert.rejects(completeSheetConverse({ character, conversation: [], userPrompt: 'tap test', tapTest }), /invalid tap test/i);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(character, original);
});

test('tap-test random abilities are authorized on the abilities turn only and respect its budget', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ rawText: JSON.stringify({
    replyText: 'Rolled the ability scores.',
    sheetUpdates: [{ category: 'abilities', random: true, budget: 100 }],
  }) }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const character = currentCharacter();
  const result = await completeSheetConverse({
    character,
    conversation: [],
    userPrompt: 'Continue tap test. Randomly assign abilities.',
    tapTest: { step: 2, budget: 20 },
  });
  const scores = abilityNames.map((name) => result.updatedCharacter.abilities[name].base);
  const costs = scores.map(pointBuyCost);
  assert.ok(costs.every((cost) => cost !== null), 'every random base score must be a legal point-buy score');
  assert.ok(costs.reduce<number>((sum, cost) => sum + (cost ?? 999), 0) <= 20);
  assert.ok(result.appliedActions.some((action) => /abilit|point.buy/i.test(action.label)));
  assert.equal(result.updatedCharacter.pointBuyBudget, 20);

  const laterTurn = await completeSheetConverse({
    character: result.updatedCharacter,
    conversation: [],
    userPrompt: 'Continue tap test. Randomize the abilities again.',
    isRandomRequested: true,
    tapTest: { step: 3, budget: 20 },
  });
  assert.deepEqual(laterTurn.updatedCharacter.abilities, result.updatedCharacter.abilities, 'later stages must preserve the completed ability array');
  assert.equal(laterTurn.updatedCharacter.pointBuyBudget, 20);
});
