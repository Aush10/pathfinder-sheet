import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../data/defaultCharacter.ts';
import { DEFAULT_SOT_CATALOGUE, buildSOTContextForAI, parseSrdSkillsAndProficiencies, tapTestNeedsInput } from './aiService.ts';

test('blank characters do not inherit the legacy Slayer SOT demo', () => {
  const character = createBlankCharacter();
  assert.deepEqual(character.sotCatalogue, { weblinks: [], overridePages: [], macaroniSuggestions: [] });
  character.sotCatalogue = undefined;
  assert.deepEqual(DEFAULT_SOT_CATALOGUE, { weblinks: [], overridePages: [], macaroniSuggestions: [] });
  assert.deepEqual(buildSOTContextForAI(character), { overrideText: '', activeUrls: [] });
});

test('parseSrdSkillsAndProficiencies stays inside delimited Class Skills and proficiency fields', () => {
  const parsed = parseSrdSkillsAndProficiencies(
    `Class Skills: Acrobatics (Dex), Knowledge (arcana) (Int)\nSkill Ranks Per Level: 3 + Int\nHit Die: d8\nWeapon and Armor Proficiency: Simple weapons.\nClass Feature: proficient with every weapon and Climb.`,
  );
  assert.deepEqual(parsed.cleanedSkillsList, ['Acrobatics', 'Knowledge (Arcana)']);
  assert.equal(parsed.cleanedProficiencies, 'Simple weapons.');
  assert.equal(parsed.detectedHitDie, 8);
  assert.equal(parsed.detectedSkillRanksPerLevel, 3);
  assert.ok(!parsed.cleanedSkillsList.includes('Climb'));
});

test('an identity no-op does not trap the tap test, but later no-ops and explicit questions do', () => {
  const quietIdentity = { missingSotRequest: null, rejectedCount: 0, questionCount: 0, modelHasQuestion: false, appliedCount: 0, blockedCount: 0 };
  assert.equal(tapTestNeedsInput({ step: 0, budget: 20 }, quietIdentity), false);
  assert.equal(tapTestNeedsInput({ step: 1, budget: 20 }, quietIdentity), true);
  assert.equal(tapTestNeedsInput({ step: 0, budget: 20 }, { ...quietIdentity, modelHasQuestion: true }), true);
});
