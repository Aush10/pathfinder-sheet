import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankCharacter } from '../data/defaultCharacter';
import { applyCareerProgressionToCharacter } from './characterIntegration';
import {
  buildActionFromMacroResult,
  evaluateDirectoryMacroValue,
  filterDirectoryEntries,
  getAltsForEntry,
  getAvailableDirectorySpells,
  isAltEligibleEntry,
  normalizeDirectoryEntries,
  resolveActionEntryType,
  searchCharacterMacros,
  stepResourceBarValue,
} from './actionDirectory';

test('normalizeDirectoryEntries preserves legacy actions and standalone resource trackers', () => {
  const merged = normalizeDirectoryEntries(
    [
      {
        id: 'act-1',
        name: 'Power Attack',
        category: 'Feats',
        description: 'Trade attack for damage.',
      },
      {
        id: 'act-2',
        name: 'Fireball',
        category: 'Spells',
        description: '1d6/lvl fire',
      },
    ],
    [
      {
        id: 'res-ki',
        name: 'Ki Pool',
        current: 4,
        max: 6,
        macroKey: 'KI',
        category: 'Class Resource',
      },
    ]
  );

  assert.equal(merged.length, 3);
  assert.equal(resolveActionEntryType(merged[0]), 'ability');
  assert.equal(resolveActionEntryType(merged[1]), 'spell');
  assert.equal(resolveActionEntryType(merged[2]), 'resource');
  assert.equal(merged[2].resourceCurrent, 4);
  assert.equal(merged[2].resourceMax, 6);
});

test('stepResourceBarValue steps numeric deltas and ! stepper expressions independently', () => {
  const char = createBlankCharacter();
  const simpleRes = {
    id: 'res-1',
    name: 'Arcane Pool',
    entryType: 'resource' as const,
    category: 'Class Resource' as const,
    description: 'Pool',
    hasResourcePool: true,
    resourceCurrent: 5,
    resourceMax: 5,
    stepperMacro: '-1',
  };

  const step1 = stepResourceBarValue(simpleRes, char);
  assert.equal(step1.nextCurrent, 4);
  assert.equal(step1.nextStepCount, 1);

  const bangRes = {
    id: 'res-2',
    name: 'Escalation',
    entryType: 'resource' as const,
    category: 'Class Resource' as const,
    description: 'Step up',
    hasResourcePool: true,
    resourceCurrent: 6,
    resourceMax: 12,
    stepperMacro: '<<[6+!*1]',
    stepperStepCount: 0,
  };

  const bang1 = stepResourceBarValue(bangRes, char);
  assert.equal(bang1.nextCurrent, 7);
  assert.equal(bang1.nextStepCount, 1);

  const bang2 = stepResourceBarValue(
    { ...bangRes, resourceCurrent: bang1.nextCurrent, stepperStepCount: bang1.nextStepCount },
    char
  );
  assert.equal(bang2.nextCurrent, 8);
  assert.equal(bang2.nextStepCount, 2);
});

test('evaluateDirectoryMacroValue evaluates counters and DC macros', () => {
  const char = createBlankCharacter();
  char.level = 7;
  char.abilities.INT.base = 16; // +3 mod

  const lvlCounter = evaluateDirectoryMacroValue('<<#LEVEL', char);
  assert.equal(lvlCounter.display, '7');
  assert.equal(lvlCounter.numeric, 7);

  const dcEval = evaluateDirectoryMacroValue('DC+#INT', char);
  assert.equal(dcEval.display, '16'); // 10 + floor(7/2) + 3
});

test('alts stay hidden from default results, appear in search, and exclude resources/counters', () => {
  const ability = {
    id: 'ab-1',
    name: 'Smite Evil',
    entryType: 'ability' as const,
    category: 'Class Ability' as const,
    description: 'Standard smite',
    showAltCorner: true,
  };
  const resource = {
    id: 'res-1',
    name: 'Lay on Hands',
    entryType: 'resource' as const,
    category: 'Class Resource' as const,
    description: 'Pool',
  };
  const counter = {
    id: 'cnt-1',
    name: 'Rounds',
    entryType: 'counter' as const,
    category: 'Other' as const,
    description: 'Counter',
    totalCountMacro: '3',
  };
  const alt = {
    id: 'alt-1',
    name: 'Smite Chaos',
    entryType: 'alt' as const,
    parentActionId: 'ab-1',
    altTargetType: 'ability' as const,
    category: 'Class Ability' as const,
    description: 'Variant smite',
  };

  assert.equal(isAltEligibleEntry(ability), true);
  assert.equal(isAltEligibleEntry(resource), false);
  assert.equal(isAltEligibleEntry(counter), false);

  const entries = [ability, resource, counter, alt];
  assert.deepEqual(
    filterDirectoryEntries(entries, { search: '' }).map((e) => e.id),
    ['ab-1', 'res-1', 'cnt-1']
  );
  assert.deepEqual(
    filterDirectoryEntries(entries, { search: 'Chaos' }).map((e) => e.id),
    ['alt-1']
  );
  assert.deepEqual(
    getAltsForEntry(entries, 'ab-1').map((e) => e.id),
    ['alt-1']
  );
});

test('getAvailableDirectorySpells populates Journal list strictly from available directory spells', () => {
  const char = createBlankCharacter();
  char.spells = [
    {
      id: 'p3-sp-1',
      level: 1,
      name: 'Shield',
      school: 'Abjuration',
      castTime: '1 standard action',
      range: 'Personal',
      duration: '1 min/lvl',
      save: 'None',
      spellResistance: 'No',
      preparedCount: 1,
      isCast: false,
      description: 'Page 3 spellbook entry',
    },
  ];
  char.characterActions = [
    {
      id: 'dir-sp-1',
      name: 'Bless',
      entryType: 'spell',
      category: 'Spells',
      spellLevel: 1,
      isAvailable: true,
      description: '+1 morale attack & fear saves',
    },
    {
      id: 'dir-sp-2',
      name: 'Grease',
      entryType: 'spell',
      category: 'Spells',
      spellLevel: 1,
      isAvailable: false,
      description: 'Slippery ground',
    },
  ];

  const avail = getAvailableDirectorySpells(char);
  assert.deepEqual(
    avail.map((s) => s.name),
    ['Bless']
  );
  assert.equal(char.spells[0].preparedCount, 1);
  assert.equal(char.spells[0].isCast, false);
});

test('searchCharacterMacros finds custom macros and builds directory items for Add to list', () => {
  const char = createBlankCharacter();
  char.customObjects = [
    {
      id: 'obj-1',
      name: 'dragon_claw',
      description: 'Claw slash',
      formula: '[1d6 + #STR] "slashing"',
      category: 'action',
    },
  ];

  const results = searchCharacterMacros(char, 'dragon_claw');
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'dragon_claw');

  const added = buildActionFromMacroResult(results[0]);
  assert.equal(added.entryType, 'ability');
  assert.equal(added.macroKey, 'DRAGON_CLAW');
  assert.equal(added.macroFormula, '[1d6 + #STR] "slashing"');
});

test('applyCareerProgressionToCharacter syncs class abilities to directory without duplicates or clobbering edits', () => {
  const char = createBlankCharacter();
  char.customClassGrids = {
    class1: {
      id: 'class1',
      className: 'Samurai',
      level: 2,
      hitDie: 10,
      skillPointsPerLevel: 4,
      proficiencies: 'Martial weapons',
      rawText: '',
      rows: [
        { level: 1, bab: 1, babString: '+1', fort: 2, ref: 0, will: 0, special: 'Challenge 1/day, Mount, Order' },
        { level: 2, bab: 2, babString: '+2', fort: 3, ref: 0, will: 0, special: 'Order Ability' },
      ],
    },
  };
  char.careerData = {
    mode: 'standard',
    useFractionalBab: false,
    useFractionalSaves: false,
    levels: [
      { level: 1, primaryClassId: 'class1', primaryClassLevel: 1, isGestalt: false, favoredClassBonus: 'hp' },
      { level: 2, primaryClassId: 'class1', primaryClassLevel: 2, isGestalt: false, favoredClassBonus: 'hp' },
    ],
    archetypes: [],
  };

  const firstPass = applyCareerProgressionToCharacter(char);
  const actions1 = firstPass.updatedCharacter.characterActions || [];
  assert.equal(actions1.length, 4);
  assert.equal(actions1[0].sourceClassName, 'Samurai');

  // Edit one ability in the directory and reapply progression -> must not duplicate or overwrite edit
  const editedChar = {
    ...firstPass.updatedCharacter,
    characterActions: actions1.map((a) =>
      a.name === 'Mount' ? { ...a, description: 'Custom bonded steed notes' } : a
    ),
  };
  const secondPass = applyCareerProgressionToCharacter(editedChar);
  const actions2 = secondPass.updatedCharacter.characterActions || [];
  assert.equal(actions2.length, 4);
  const mount = actions2.find((a) => a.name === 'Mount');
  assert.equal(mount?.description, 'Custom bonded steed notes');
});
