/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../../data/defaultCharacter';
import { buildFormulaContext } from '../formula';
import {
  applyMacaroniToCharacter,
  applyModifierPromptSelection,
  executeMacaroni,
  parseNoodleFormatting,
  parseSigilEnvelope,
  resolveQueryOptionAction,
  validateObjectName,
  type MacaroniExecutionContext,
  type MacaroniListenerEntry,
} from './index';
import type { PF1Character } from '../../types/character';

function makeChar(overrides: Partial<PF1Character> = {}): PF1Character {
  const base = createBlankCharacter();
  base.level = 5;
  base.abilities.STR.base = 16;
  base.classes = [
    {
      id: 'cls-a',
      name: 'Fighter',
      level: 3,
      hitDie: 10,
      skillPointsPerLevel: 2,
      babProgression: 'full',
      isFavoredClass: true,
    },
    {
      id: 'cls-b',
      name: 'Wizard',
      level: 2,
      hitDie: 6,
      skillPointsPerLevel: 2,
      babProgression: 'half',
      isFavoredClass: false,
    },
  ];
  base.customObjects = [
    { id: 'obj-strdmg', name: 'strdmg', description: '', category: 'placeholder', formula: '==[3+1]' },
    { id: 'obj-firebreath', name: 'firebreath', description: '', category: 'action', formula: '<<[10+2]' },
    { id: 'obj-morefire', name: 'morefire', description: '', category: 'placeholder', formula: '==[8]' },
    { id: 'obj-fire', name: 'fire', description: '', category: 'action', formula: '<>[12+6]' },
    { id: 'obj-ice', name: 'ice', description: '', category: 'action', formula: '<<[9+1]' },
    { id: 'obj-elec', name: 'electricity', description: '', category: 'placeholder', formula: '==[15]' },
    {
      id: 'obj-query',
      name: 'ask_element',
      description: '',
      category: 'logic',
      formula: '<?> "Fire or Ice"|"I choose fire"={fire}|"no fire for me thanks"={ice}|{electricity}',
    },
    { id: 'obj-q-a', name: 'q_a', description: '', category: 'logic', formula: '<?> "A"|{q_b}' },
    { id: 'obj-q-b', name: 'q_b', description: '', category: 'logic', formula: '<?> "B"|{q_c}' },
    { id: 'obj-q-c', name: 'q_c', description: '', category: 'logic', formula: '<?> "C"|{q_d}' },
    { id: 'obj-q-d', name: 'q_d', description: '', category: 'logic', formula: '<?> "D"|{q_e}' },
    { id: 'obj-q-e', name: 'q_e', description: '', category: 'logic', formula: '<?> "E"|{q_f}' },
    { id: 'obj-q-f', name: 'q_f', description: '', category: 'logic', formula: '<?> "F"|{fire}' },
    { id: 'obj-q-loop', name: 'q_loop', description: '', category: 'logic', formula: '<?> "Loop"|{q_loop}' },
    { id: 'obj-arr-fire', name: 'fire&', description: '', category: 'placeholder', formula: '== ([3]&[5]&[8])' },
    { id: 'obj-arr-six', name: 'toomany&', description: '', category: 'placeholder', formula: '== 1|2|3|4|5|6' },
    { id: 'obj-arr-nested', name: 'nested&', description: '', category: 'placeholder', formula: '== {fire&}|10' },
    { id: 'obj-loop-self', name: 'loop_self', description: '', category: 'action', formula: '>{loop_self}<+1' },
  ];
  return { ...base, ...overrides };
}

function makeCtx(character: PF1Character, extra: Partial<MacaroniExecutionContext> = {}): MacaroniExecutionContext {
  const formulaContext = buildFormulaContext(character, { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 });
  return {
    character,
    formulaContext,
    ...extra,
  };
}

test('strict v1.2 sigils reject missing sigil, [[ / {{ lookalikes, and nested sigils', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  for (const bad of ['10+5', '[10+5]', '[[10+5]]', '{{10+5}}', '<<[<<5]', '<> [<^>2]']) {
    const res = executeMacaroni(bad, ctx);
    assert.equal(res.isError, true, `Expected error for "${bad}", got output "${res.fullOutput}"`);
  }

  assert.equal(parseSigilEnvelope('==[1+2]').kind, 'neutral');
  assert.equal(parseSigilEnvelope('<<[1+2]').kind, 'pull');
  assert.equal(parseSigilEnvelope('<>[1+2]').kind, 'make');
  assert.equal(parseSigilEnvelope('<?> "Hi"|{fire}').kind, 'query');
  assert.equal(parseSigilEnvelope('<^>[3]').kind, 'modifier');
  assert.equal(parseSigilEnvelope('<!>[6+!*1]').kind, 'stepper');
  assert.equal(parseSigilEnvelope('>strength<+{strdmg}').kind, 'merge');
});

test('neutral == is a no-op when run directly, while << and <> evaluate cleanly without leaking sigils', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  const neutralRes = executeMacaroni('==[10+5]', ctx);
  assert.equal(neutralRes.isError, false);
  assert.equal(neutralRes.isNoOp, true);
  assert.equal(neutralRes.fullOutput, '');

  const pullRes = executeMacaroni('<<[10+5]', ctx);
  assert.equal(pullRes.isError, false);
  assert.equal(pullRes.fullOutput, '15');

  const makeRes = executeMacaroni('<>[10+5]', ctx);
  assert.equal(makeRes.isError, false);
  assert.equal(makeRes.fullOutput, '15');
  assert.equal(makeRes.makePopup?.result, '15');
  assert.equal(makeRes.makePopup?.title.includes('<>'), false);
});

test('PEMDAS precedence, nested brackets, and bracket adjacency rules', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  const pemdas = executeMacaroni('<<[[10+5]+5*[10+1]]', ctx);
  assert.equal(pemdas.isError, false);
  assert.equal(pemdas.fullOutput, '70');

  const nested = executeMacaroni('<<[2*[3+[4*2]]]', ctx);
  assert.equal(nested.isError, false);
  assert.equal(nested.fullOutput, '22');

  const insideMult = executeMacaroni('<<[4[3]]', ctx);
  assert.equal(insideMult.isError, false);
  assert.equal(insideMult.fullOutput, '12');

  const outsideMult = executeMacaroni('<<4[3]', ctx);
  assert.equal(outsideMult.isError, true);
});

test('reserved dN object names and uncached fresh {dN} dice rolls', () => {
  assert.equal(validateObjectName('d6').valid, false);
  assert.equal(validateObjectName('d20').valid, false);
  assert.equal(validateObjectName('D100').valid, false);
  assert.equal(validateObjectName('fire').valid, true);
  assert.equal(validateObjectName('dmg1').valid, true);

  const char = makeChar();
  const ctx = makeCtx(char);
  const outcomes = new Set<number>();
  for (let i = 0; i < 25; i++) {
    const res = executeMacaroni('<<{d100}', ctx);
    assert.equal(res.isError, false);
    assert.equal(res.rollable, true);
    const val = Number(res.fullOutput);
    assert.ok(val >= 1 && val <= 100, `Unexpected d100 value: ${res.fullOutput}`);
    outcomes.add(val);
  }
  assert.ok(outcomes.size > 1, 'Expected uncached fresh dice rolls across 25 runs');
});

test('resolution order handles {object}, #legacy, levela/hda class variables, and merge into fields/objects', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  const classVars = executeMacaroni('<<[#levela+#hdb+#LEVEL]', ctx);
  assert.equal(classVars.isError, false);
  assert.equal(classVars.fullOutput, '14'); // 3 + 6 + 5

  // Field merge
  const fieldMerge = executeMacaroni('>strength<+{strdmg}', ctx);
  assert.equal(fieldMerge.isError, false);
  assert.equal(fieldMerge.mergeResult?.kind, 'field');
  assert.equal(fieldMerge.mergeResult?.previousValue, 16);
  assert.equal(fieldMerge.mergeResult?.newValue, 20);
  const appliedField = applyMacaroniToCharacter(char, fieldMerge);
  assert.equal(appliedField.updatedCharacter.abilities.STR.miscMod, 4);
  const afterCtx = buildFormulaContext(appliedField.updatedCharacter, { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 });
  assert.equal(afterCtx.strength, 20);

  // Field subtract respects target on left: >strength<-{strdmg}
  const fieldSub = executeMacaroni('>strength<-{strdmg}', ctx);
  assert.equal(fieldSub.isError, false);
  assert.equal(fieldSub.mergeResult?.newValue, 12);

  // Object merge appends operator + operand temporarily without mutating stored firebreath
  const objMerge = executeMacaroni('>{firebreath}<+{morefire}', ctx);
  assert.equal(objMerge.isError, false);
  assert.equal(objMerge.mergeResult?.kind, 'object');
  assert.equal(objMerge.fullOutput, '20'); // (10+2) + 8
  assert.equal(char.customObjects?.find((o) => o.name === 'firebreath')?.formula, '<<[10+2]');
});

test('stepper ! increments from 0 to 1 on first run before multiplication and resets cleanly', () => {
  const char = makeChar();
  const stepperStore: Record<string, number> = {};

  const r1 = executeMacaroni('<<[6+!*1]', makeCtx(char, { stepperStore, stepperScopeId: 'slot-a' }));
  assert.equal(r1.isError, false);
  assert.equal(r1.fullOutput, '7');

  const r2 = executeMacaroni('<<[6+!*1]', makeCtx(char, { stepperStore, stepperScopeId: 'slot-a' }));
  assert.equal(r2.fullOutput, '8');

  const r3 = executeMacaroni('<!>[10+!*2]', makeCtx(char, { stepperStore, stepperScopeId: 'slot-b' }));
  assert.equal(r3.isError, false);
  assert.equal(r3.stepperWindow?.currentStep, 1);
  assert.equal(r3.stepperWindow?.result, '12');

  const r4 = executeMacaroni('<!>[10+!*2]', makeCtx(char, { stepperStore, stepperScopeId: 'slot-b' }));
  assert.equal(r4.stepperWindow?.currentStep, 2);
  assert.equal(r4.stepperWindow?.result, '14');
});

test('query <?> parses options, dispatches option sigils (<>, <<, ==), enforces depth-5 & loop guard, and supports pull vs inline', () => {
  const char = makeChar();
  const queryDisplayStore: Record<string, string> = { ask_element: '18' };
  const ctx = makeCtx(char, { queryDisplayStore });

  const qRes = executeMacaroni(
    '<?> "Fire or Ice"|"I choose fire"={fire}|"no fire for me thanks"={ice}|{electricity}',
    ctx
  );
  assert.equal(qRes.isError, false);
  assert.ok(qRes.queryEvent);
  assert.equal(qRes.queryEvent.prompt, 'Fire or Ice');
  assert.equal(qRes.queryEvent.options.length, 3);
  assert.equal(qRes.queryEvent.options[0].label, 'I choose fire');
  assert.equal(qRes.queryEvent.options[0].targetSigil, 'make');
  assert.equal(qRes.queryEvent.options[1].label, 'no fire for me thanks');
  assert.equal(qRes.queryEvent.options[1].targetSigil, 'pull');
  assert.equal(qRes.queryEvent.options[2].label, 'electricity');
  assert.equal(qRes.queryEvent.options[2].targetSigil, 'neutral');

  const clickMake = resolveQueryOptionAction(qRes.queryEvent.options[0], ctx, qRes.queryEvent);
  assert.equal(clickMake.action, 'replace_window');
  assert.equal(clickMake.message, '18');

  const clickPull = resolveQueryOptionAction(qRes.queryEvent.options[1], ctx, qRes.queryEvent);
  assert.equal(clickPull.action, 'show_in_place');
  assert.equal(clickPull.message, '10');

  const clickNeutral = resolveQueryOptionAction(qRes.queryEvent.options[2], ctx, qRes.queryEvent);
  assert.equal(clickNeutral.action, 'noop');

  // Loop stop: clicking q_loop inside q_loop
  const loopDirect = executeMacaroni(char.customObjects!.find((o) => o.name === 'q_loop')!.formula, ctx);
  assert.ok(loopDirect.queryEvent);
  const loopClick = resolveQueryOptionAction(loopDirect.queryEvent.options[0], ctx, {
    ...loopDirect.queryEvent,
    visitedQueryKeys: ['q_loop'],
  });
  assert.equal(loopClick.action, 'stopped');

  // Depth limit (5 levels)
  const qE = executeMacaroni(char.customObjects!.find((o) => o.name === 'q_e')!.formula, ctx);
  assert.ok(qE.queryEvent);
  const depth6Click = resolveQueryOptionAction(qE.queryEvent.options[0], ctx, {
    ...qE.queryEvent,
    depth: 5,
    visitedQueryKeys: ['q_a', 'q_b', 'q_c', 'q_d', 'q_e'],
  });
  assert.equal(depth6Click.action, 'stopped');

  // Calling a query with << shows its displayed value now
  const pullQueryNow = executeMacaroni('<<{ask_element}', ctx);
  assert.equal(pullQueryNow.isError, false);
  assert.equal(pullQueryNow.fullOutput, '18');

  // Calling a query inline with {} asks the question, then evaluates using inlineQueryAnswers
  const inlineAsk = executeMacaroni('<<[{ask_element}+2]', makeCtx(char));
  assert.equal(inlineAsk.isError, false);
  assert.equal(inlineAsk.queryEvent?.inlineCallSite?.targetQueryName, 'ask_element');

  const inlineAnswered = executeMacaroni(
    '<<[{ask_element}+2]',
    makeCtx(char, { inlineQueryAnswers: { ask_element: '12' } })
  );
  assert.equal(inlineAnswered.isError, false);
  assert.equal(inlineAnswered.fullOutput, '14');
});

test('modifier <^> identifies buffs by (name, bonusType) and updates in place without duplicating', () => {
  const char = makeChar();
  const promptRes = executeMacaroni('<^>[4+2]', makeCtx(char));
  assert.equal(promptRes.isError, false);
  assert.equal(promptRes.modifierPrompt?.numericValue, 6);

  const first = applyModifierPromptSelection(char, {
    name: 'Bull Strength',
    target: 'str',
    bonusType: 'Enhancement',
    value: 4,
  });
  assert.equal(first.updatedCharacter.customBuffs?.length, 1);
  assert.equal(first.updatedCharacter.customBuffs?.[0].values.str, 4);

  const second = applyModifierPromptSelection(first.updatedCharacter, {
    name: 'Bull Strength',
    target: 'str',
    bonusType: 'Enhancement',
    value: 6,
  });
  assert.equal(second.updatedCharacter.customBuffs?.length, 1);
  assert.equal(second.updatedCharacter.customBuffs?.[0].values.str, 6);

  const differentName = applyModifierPromptSelection(second.updatedCharacter, {
    name: 'Bull Strength II',
    target: 'str',
    bonusType: 'Enhancement',
    value: 2,
  });
  assert.equal(differentName.updatedCharacter.customBuffs?.length, 2);
});

test('Part 2 reserved symbols (>>, $, stray #, stray ^) reject loudly while {XdN} & min 1 die work', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  for (const reservedExpr of ['>>{fire}', '<<$5', '<<5 # 2', '<<[2^3]', '#LEVEL', '$foo']) {
    const res = executeMacaroni(reservedExpr, ctx);
    assert.equal(res.isError, true, `Expected reserved symbol error for ${reservedExpr}`);
    assert.match(res.errorMessage || '', /reserved/i);
  }

  assert.equal(validateObjectName('2d6').valid, false);
  assert.equal(validateObjectName('fire&').valid, true);

  const multiDice = executeMacaroni('<<{2d6}', ctx);
  assert.equal(multiDice.isError, false);
  const val = Number(multiDice.fullOutput);
  assert.ok(val >= 2 && val <= 12);

  const zeroDice = executeMacaroni('<<{0d6}', ctx);
  assert.equal(zeroDice.isError, true);
  assert.match(zeroDice.errorMessage || '', /1 die is the minimum/i);
});

test('Part 2 arrays ({fire&}, {fire&2}, out-of-range -> 0, 5-item limit, no nested arrays)', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  const wholeArr = executeMacaroni('<<{fire&}', ctx);
  assert.equal(wholeArr.isError, false);
  assert.equal(wholeArr.fullOutput, '3, 5, 8');

  const pick2 = executeMacaroni('<<{fire&2}', ctx);
  assert.equal(pick2.isError, false);
  assert.equal(pick2.fullOutput, '5');

  const outOfRange = executeMacaroni('<<{fire&9}', ctx);
  assert.equal(outOfRange.isError, false);
  assert.equal(outOfRange.fullOutput, '0');

  const sixItems = executeMacaroni('<<{toomany&2}', ctx);
  assert.equal(sixItems.isError, true);
  assert.match(sixItems.errorMessage || '', /maximum 5 items/i);

  const nestedArr = executeMacaroni('<<{nested&1}', ctx);
  assert.equal(nestedArr.isError, true);
  assert.match(nestedArr.errorMessage || '', /arrays of arrays are disabled/i);
});

test('Pasta layer: (pasta) sequential assignment, calculator comparisons (= <= =< >= => <>), <booli>, noodles & bare / guard', () => {
  const char = makeChar();
  const ctx = makeCtx(char);

  const calcBool = executeMacaroni('<<[2+2=4]', ctx);
  assert.equal(calcBool.isError, false);
  assert.equal(calcBool.fullOutput, 'true');

  const notEqCalc = executeMacaroni('<<[2+2<>5]', ctx);
  assert.equal(notEqCalc.isError, false);
  assert.equal(notEqCalc.fullOutput, 'true');

  const leAlias = executeMacaroni('<<[5=<5]', ctx);
  assert.equal(leAlias.isError, false);
  assert.equal(leAlias.fullOutput, 'true');

  // Austin's worked pasta example (fixed without not-symbol ambiguity):
  const pastaWorked = executeMacaroni(
    '<<("thetest"=[2+2]) ({thetest}?=4/"we are safe") ({thetest}?<>4/"that was close"\\"we have a "+"+problem+")',
    ctx
  );
  assert.equal(pastaWorked.isError, false);
  assert.equal(pastaWorked.fullOutput, 'we are safe we have a +problem+');

  // Bare / outside [...] and outside booli is an error
  const bareSlash = executeMacaroni('<<10/2', ctx);
  assert.equal(bareSlash.isError, true);

  // Safe noodle parser handles +bold+, _underline_, #color# and rejects unknown colors as plain text
  const segs = parseNoodleFormatting('#red#+bold+ _under_ #unknown#plain');
  assert.ok(segs.some((s) => s.bold && s.color === 'red' && s.text === 'bold'));
  assert.ok(segs.some((s) => s.underline && s.text === 'under'));
  assert.ok(segs.some((s) => s.text.includes('#unknown#plain')));
});

test('Part 2 scope & safety: permissions, whitelisted merge targets, self-loop guard, private cross-sheet reads, and inert listeners', () => {
  const char = makeChar();
  const otherChar = makeChar({ name: 'GLYPH-5', level: 4 });
  const listeners: Record<string, MacaroniListenerEntry> = {
    inbox: { name: 'inbox', allowedSenders: ['gm', 'alyx', char.name.toLowerCase()] },
  };
  const externalSheets = {
    glyph: {
      id: 'glyph',
      name: 'GLYPH-5',
      character: otherChar,
      formulaContext: { perception: 14, str: 10 },
      permissions: { readAllowlist: ['gm'], revokedSenders: ['rogue'] },
    },
  };

  // Whitelisted unknown merge target rejected
  const badField = executeMacaroni('>evil_internal<=999', makeCtx(char));
  assert.equal(badField.isError, true);
  assert.match(badField.errorMessage || '', /whitelisted/i);

  // Self-loop merge rejected
  const selfLoop = executeMacaroni('>{loop_self}<+1', makeCtx(char));
  assert.equal(selfLoop.isError, true);
  assert.match(selfLoop.errorMessage || '', /loop stopped/i);

  // Permission denial when sheet forbids modifier or write
  const noMod = executeMacaroni('<^>[4]', makeCtx(char, { permissions: { allowModifier: false } }));
  assert.equal(noMod.isError, true);

  // Cross-sheet read denied to non-GM, allowed privately to GM
  const deniedRead = executeMacaroni('<<{sheet:glyph.perception}', makeCtx(char, { externalSheets, requesterId: 'player1' }));
  assert.equal(deniedRead.isError, true);

  const gmRead = executeMacaroni('<<[{sheet:glyph.perception}+{d1}]', makeCtx(char, { externalSheets, requesterId: 'gm' }));
  assert.equal(gmRead.isError, false);
  assert.equal(gmRead.fullOutput, '15');
  assert.equal(gmRead.privateOutput, true);

  // Listener push rejects unknown listener and stores inert data for opt-in listener without executing sigils
  const missingListener = executeMacaroni('>{listener:nonexistent}<=42', makeCtx(char, { permissions: { listeners } }));
  assert.equal(missingListener.isError, true);

  const inertPush = executeMacaroni(
    '>{listener:inbox}<="<<[999]"',
    makeCtx(char, { permissions: { listeners }, requesterId: 'gm' })
  );
  assert.equal(inertPush.isError, false);
  assert.equal(listeners.inbox.lastValue, '<<[999]');
  const readBack = executeMacaroni('<<{listener:inbox}', makeCtx(char, { permissions: { listeners } }));
  assert.equal(readBack.fullOutput, '<<[999]'); // Inert data, never executed!
});
