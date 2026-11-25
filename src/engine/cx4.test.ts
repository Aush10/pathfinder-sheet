import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../server/ingest/ingest.ts';
import { SOT_CONTEXT_CHAR_BUDGET } from '../../server/sotContext.ts';
import { createBlankCharacter } from '../data/defaultCharacter.ts';
import { DEFAULT_SOT_CATALOGUE, buildSOTContextForAI, completeSheetConverse, lookupRulesWithSOT, parseSrdSkillsAndProficiencies, tapTestNeedsInput } from './aiService.ts';

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

test('Lookup and Complete Sheet use persisted SOT sections and retain the legacy excerpt fallback', async (context) => {
  const character = createBlankCharacter();
  character.name = 'Fighter Character';
  const artifacts = ingestSource({
    name: 'fighter.html',
    content: '<h1>Fighter</h1><h2>Weapon Training</h2><p>Weapon training grants attack bonuses.</p>'
      + '<h2>Unrelated Lore</h2><p>This private filler should stay local.</p>',
  });
  const storedArtifacts = { artifacts: { ...artifacts,
    'table.json': JSON.stringify(artifacts['table.json']),
    'links.json': JSON.stringify(artifacts['links.json']),
    'index.json': JSON.stringify(artifacts['index.json']),
  } };
  const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      const result = {
        close() {},
        transaction(storeName: string) {
          assert.equal(storeName, 'srdArtifacts');
          const transaction = { oncomplete: undefined as (() => void) | undefined, objectStore() {
            return { get(key: string) {
              const request = {
                result: key === 'Fighter Character/fighter-index' ? storedArtifacts : undefined,
                onsuccess: undefined as (() => void) | undefined,
              };
              setImmediate(() => { request.onsuccess?.(); setImmediate(() => transaction.oncomplete?.()); });
              return request;
            } };
          } };
          return transaction;
        },
      };
      const request = { result, onsuccess: undefined as (() => void) | undefined };
      setImmediate(() => request.onsuccess?.());
      return request;
    },
  } });
  context.after(() => {
    if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  const fighterPage = {
    id: 'fighter-index', title: 'Fighter Reference', category: 'General Rule' as const,
    isOverride: true, tags: [], updatedAt: 0, htmlContent: '', plainText: '',
  };
  character.sotCatalogue!.overridePages = [fighterPage];
  const requests: Array<{ sotEvidence: string; sotDocuments?: unknown; characterSummary: string }> = [];
  context.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return url === '/api/openai/lookup'
      ? Response.json({ text: '{"matched":false}' })
      : Response.json({ rawText: '{"replyText":"Rules found."}' });
  });

  const query = 'Explain weapon training attack bonuses';
  await lookupRulesWithSOT(query, 'All', character);
  await completeSheetConverse({ character, conversation: [], userPrompt: query });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.match(request.sotEvidence, /Weapon training grants attack bonuses/);
    assert.doesNotMatch(request.sotEvidence, /private filler/);
    assert.ok(request.sotEvidence.length <= SOT_CONTEXT_CHAR_BUDGET);
    assert.equal(request.sotDocuments, undefined);
  }

  character.sotCatalogue!.overridePages = [{
    ...fighterPage, id: 'legacy-page', plainText: 'Weapon training grants an older rule excerpt.',
  }];
  await lookupRulesWithSOT(query, 'All', character);
  assert.match(requests.at(-1)!.sotEvidence, /an older rule excerpt/);

  character.sotCatalogue!.overridePages = [fighterPage];
  const allowedModules = character.installedModules?.aiSettings?.allowedModules;
  assert.ok(allowedModules);
  allowedModules.sotCatalogue = false;
  await lookupRulesWithSOT(query, 'All', character);
  await completeSheetConverse({ character, conversation: [], userPrompt: query });
  assert.equal(requests.at(-2)!.sotEvidence, 'None saved.');
  assert.equal(requests.at(-1)!.sotEvidence, 'None saved in SOT Catalogue.');
  assert.doesNotMatch(requests.at(-1)!.characterSummary, /Fighter Reference/);
});
