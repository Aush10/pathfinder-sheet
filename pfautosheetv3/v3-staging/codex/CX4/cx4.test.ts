import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../../../../src/data/defaultCharacter.ts';
import { DEFAULT_SOT_CATALOGUE, buildSOTContextForAI, tapTestNeedsInput } from '../../../../src/engine/aiService.ts';

test('blank characters do not inherit the legacy Slayer SOT demo', () => {
  const character = createBlankCharacter();
  character.sotCatalogue = undefined;
  assert.deepEqual(DEFAULT_SOT_CATALOGUE, { weblinks: [], overridePages: [], macaroniSuggestions: [] });
  assert.deepEqual(buildSOTContextForAI(character), { overrideText: '', activeUrls: [] });
});

test('an identity no-op does not trap the tap test, but later no-ops and explicit questions do', () => {
  const quietIdentity = { missingSotRequest: null, rejectedCount: 0, questionCount: 0, modelHasQuestion: false, appliedCount: 0, blockedCount: 0 };
  assert.equal(tapTestNeedsInput({ step: 0, budget: 20 }, quietIdentity), false);
  assert.equal(tapTestNeedsInput({ step: 1, budget: 20 }, quietIdentity), true);
  assert.equal(tapTestNeedsInput({ step: 0, budget: 20 }, { ...quietIdentity, modelHasQuestion: true }), true);
});
