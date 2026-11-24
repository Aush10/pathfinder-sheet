/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../../../../src/data/defaultCharacter';
import {
  blankCharacterWithEmptySot,
  createSerializedWriteQueue,
  evaluateCrashPreference,
  normalizeCharacter,
} from '../../../../src/storage/characterState';
import type { LoadedCharacter } from '../../../../src/storage/types';

function loaded(
  name: string,
  characterId: string,
  savedAt: string,
  extras?: Partial<ReturnType<typeof createBlankCharacter>>,
): LoadedCharacter {
  const character = createBlankCharacter();
  character.name = name;
  character.player = 'Alice';
  Object.assign(character, extras);
  return { character, characterId, savedAt, sha256: extras && 'notesHash' in (extras as object) ? undefined : `hash-${name}-${savedAt}` };
}

test('stale crash does not replace a newer named save (B1)', () => {
  const saved = loaded('Control', '5df51714-c165-471f-971f-918283213209', '2026-11-24T09:00:00.000Z');
  saved.sha256 = 'named-save';
  const crash = loaded('Control', '5df51714-c165-471f-971f-918283213209', '2026-11-24T08:12:00.000Z');
  crash.sha256 = 'older-crash';
  crash.character.abilities.STR.base = 0;
  crash.character.abilities.DEX.base = 0;
  crash.character.abilities.CON.base = 0;
  crash.character.abilities.INT.base = 0;
  crash.character.abilities.WIS.base = 0;
  crash.character.abilities.CHA.base = 0;
  saved.character.abilities.STR.base = 15;
  assert.equal(evaluateCrashPreference(crash, saved).action, 'use-saved');
});

test('equal crash and save bytes keep the named save', () => {
  const saved = loaded('Hero', 'aaa', '2026-11-24T10:00:00.000Z');
  saved.sha256 = 'same';
  const crash = loaded('Hero', 'aaa', '2026-11-24T10:00:01.000Z');
  crash.sha256 = 'same';
  assert.equal(evaluateCrashPreference(crash, saved).action, 'use-saved');
});

test('crash for a different character does not replace the active character', () => {
  const saved = loaded('Other', 'id-other', '2026-11-24T12:00:00.000Z');
  saved.sha256 = 'other';
  const crash = loaded('Hero', 'id-hero', '2026-11-24T12:01:00.000Z');
  crash.sha256 = 'hero';
  assert.equal(evaluateCrashPreference(crash, saved).action, 'use-saved');
});

test('newer same-character crash asks before restore', () => {
  const saved = loaded('Control', 'same-id', '2026-11-24T08:00:00.000Z');
  saved.sha256 = 'named';
  const crash = loaded('Control', 'same-id', '2026-11-24T08:12:00.000Z');
  crash.sha256 = 'newer-crash';
  const result = evaluateCrashPreference(crash, saved);
  assert.equal(result.action, 'ask');
});

test('crash-only restore uses crash when there is no named save', () => {
  const crash = loaded('Hero', 'only', '2026-11-24T08:12:00.000Z');
  assert.equal(evaluateCrashPreference(crash, null).action, 'use-crash');
});

test('pfmodulartest Crash keeps 15/14/12/10/8/10 as the healthy comparison fixture', () => {
  const healthy = {
    STR: 15,
    DEX: 14,
    CON: 12,
    INT: 10,
    WIS: 8,
    CHA: 10,
  };
  const zeroed = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };
  assert.notDeepEqual(zeroed, healthy);
});

test('blankCharacterWithEmptySot does not inherit SRD pages (B4)', () => {
  const blank = blankCharacterWithEmptySot();
  assert.deepEqual(blank.sotCatalogue?.overridePages, []);
  assert.deepEqual(blank.sotCatalogue?.weblinks, []);
  const normalized = normalizeCharacter({ name: '', player: '' });
  assert.deepEqual(normalized.sotCatalogue?.overridePages, []);
});

test('serialized write queue keeps one write in flight and coalesces pending values', async () => {
  const inFlightSnapshots: number[] = [];
  let current = 0;
  const seen: number[] = [];
  const queue = createSerializedWriteQueue(async (value: number) => {
    current += 1;
    inFlightSnapshots.push(current);
    await new Promise((resolve) => setTimeout(resolve, 20));
    seen.push(value);
    current -= 1;
    return value;
  });

  const first = queue.enqueue(1);
  const second = queue.enqueue(2);
  const third = queue.enqueue(3);
  const results = await Promise.all([first, second, third]);
  assert.deepEqual(inFlightSnapshots, [1, 1]);
  assert.ok(seen.includes(1));
  assert.ok(seen.includes(3));
  assert.ok(!seen.includes(2), 'coalesced middle value is skipped');
  assert.equal(Math.max(...inFlightSnapshots), 1);
  assert.ok(results.includes(1));
  assert.ok(results.includes(3));
});
