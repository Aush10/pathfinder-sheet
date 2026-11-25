import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../../data/defaultCharacter.ts';
import { projectMacaroniResult } from '../characterIntegration.ts';
import { executeMacaroni } from './index.ts';

function run(character: ReturnType<typeof createBlankCharacter>) {
  const result = executeMacaroni('<<[6+!*1]', {
    character,
    formulaContext: {},
    stepperStore: { ...(character.macaroniStepperStore || {}) },
  });
  assert.equal(result.isError, false);
  return { output: result.fullOutput, character: projectMacaroniResult(character, result).character };
}

test('Macaroni ! increments, contributes to output, and survives a serialized character reload', () => {
  const first = run(createBlankCharacter());
  assert.equal(first.output, '7');
  const second = run(first.character);
  assert.equal(second.output, '8');
  const reloaded = JSON.parse(JSON.stringify(second.character)) as ReturnType<typeof createBlankCharacter>;
  const third = run(reloaded);
  assert.equal(third.output, '9');
  assert.equal(Object.values(third.character.macaroniStepperStore || {})[0], 3);
});
