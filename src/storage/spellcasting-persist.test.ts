/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../server/ingest/ingest.ts';
import { createBlankCharacter } from '../data/defaultCharacter.ts';
import {
  SPELL_BOOK_PAGE_COUNT,
  SPELL_BOOK_TAG,
  SPELL_KNOWN_REMAINING_TAB_ID,
  SPELL_SLOT_STEPPER_MACRO,
  formatSpellTablesForCompleteSheet,
  getPersistedSpellProgressionRow,
  getSpellSlotCastBinding,
  normalizeCharacter,
  persistCollectedSpellTables,
  persistSpellTablesFromIngest,
  spellBookPageId,
  spellSlotActionId,
  spellSlotResourceId,
  spellSlotStepperScopeId,
} from './characterState.ts';
import { collectSpellProgressionTables } from '../engine/spellTables.ts';
import type { SpellProgressionTable } from '../types/character.ts';

const html = `
<table>
  <tr><th>Level</th><th colspan="3">Spells Per Day</th></tr>
  <tr><th>Level</th><th>0</th><th>1</th><th>2</th></tr>
  <tr><td>1st</td><td>3</td><td>1</td><td>—</td></tr>
  <tr><td>2nd</td><td>4</td><td>2</td><td>—</td></tr>
</table>
<table>
  <tr><th>HD</th><th colspan="2">Spells Known</th></tr>
  <tr><th>HD</th><th>0</th><th>1</th></tr>
  <tr><td>1</td><td>4</td><td>2</td></tr>
  <tr><td>2</td><td>5</td><td>3</td></tr>
</table>`;

function samplePerDay(): SpellProgressionTable {
  const columns = ['spd_0', 'spd_1', 'spd_2'];
  return {
    kind: 'spells-per-day',
    columns,
    rows: Array.from({ length: 20 }, (_, index) => ({
      level: index + 1,
      values: {
        spd_0: index === 0 ? '3' : '4',
        spd_1: index === 0 ? '1' : '2',
        spd_2: '—',
      },
    })),
  };
}

test('legacy saves without spellTables stay valid and do not grow a Spell Book', () => {
  const blank = normalizeCharacter(createBlankCharacter());
  assert.equal(blank.spellTables, undefined);
  assert.equal((blank.journal || []).some((entry) => entry.tags?.includes(SPELL_BOOK_TAG)), false);
  assert.equal((blank.resourceTrackers || []).some((tracker) => tracker.category === 'Spell Slot'), false);
});

test('normalizes CX7 tables, pads 20 rows, and strips hostile keys', () => {
  const loaded = normalizeCharacter({
    ...createBlankCharacter(),
    level: 1,
    spellTables: {
      constructor: { polluted: true },
      spellsPerDay: {
        kind: 'spells-per-day',
        columns: ['spd_1', 'nope'],
        sourceTableId: 'table-1',
        rows: [{ level: 1, values: { spd_1: '2', extra: 'drop-me' } }],
      },
    },
  });
  assert.ok(loaded.spellTables?.spellsPerDay);
  assert.equal(loaded.spellTables?.spellsPerDay?.rows.length, 20);
  assert.deepEqual(loaded.spellTables?.spellsPerDay?.columns, ['spd_1']);
  assert.equal(loaded.spellTables?.spellsPerDay?.rows[0].values.spd_1, '2');
  assert.equal('extra' in (loaded.spellTables?.spellsPerDay?.rows[0].values || {}), false);
  assert.equal(Object.hasOwn(loaded.spellTables || {}, 'constructor'), false);
});

test('reload keeps spent slot current, Spell Book pages, and a user journal entry', () => {
  const first = persistCollectedSpellTables(
    { ...createBlankCharacter(), level: 1, journal: [{
      id: 'user-log',
      title: 'Watch notes',
      sessionDate: '',
      content: 'The marsh gate is shut.',
      recalledNotes: [],
      images: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    }] },
    { spellsPerDay: samplePerDay() },
  );
  const slot = first.resourceTrackers?.find((tracker) => tracker.id === spellSlotResourceId(1));
  assert.ok(slot);
  const spent = {
    ...first,
    resourceTrackers: first.resourceTrackers?.map((tracker) => (
      tracker.id === spellSlotResourceId(1) ? { ...tracker, current: 0 } : tracker
    )),
  };
  const reloaded = normalizeCharacter(JSON.parse(JSON.stringify(spent)));
  assert.equal(reloaded.resourceTrackers?.find((tracker) => tracker.id === spellSlotResourceId(1))?.current, 0);
  assert.equal(reloaded.journal?.some((entry) => entry.id === 'user-log'), true);
  assert.equal((reloaded.journal || []).filter((entry) => entry.tags?.includes(SPELL_BOOK_TAG)).length, SPELL_BOOK_PAGE_COUNT);
  assert.equal(reloaded.journal?.some((entry) => entry.id === spellBookPageId(9)), true);
});

test('slot bars use stepper -1 and Cast bindings; known-spell tabs include Remaining spells', () => {
  const character = persistCollectedSpellTables(
    { ...createBlankCharacter(), level: 1 },
    { spellsPerDay: samplePerDay(), spellsKnown: {
      kind: 'spells-known',
      columns: ['sk_0', 'sk_1'],
      rows: Array.from({ length: 20 }, (_, index) => ({
        level: index + 1,
        values: { sk_0: '4', sk_1: index === 0 ? '2' : '3' },
      })),
    } },
  );
  const action = character.characterActions?.find((item) => item.id === spellSlotActionId(1));
  assert.equal(action?.stepperMacro, SPELL_SLOT_STEPPER_MACRO);
  assert.equal(action?.linkedResourceId, spellSlotResourceId(1));
  const binding = getSpellSlotCastBinding(character, 1);
  assert.equal(binding?.stepperMacro, SPELL_SLOT_STEPPER_MACRO);
  assert.equal(binding?.stepperScopeId, spellSlotStepperScopeId(1));
  assert.equal(character.characterActions?.find((item) => item.id === spellSlotActionId(2)), undefined);
  assert.ok(character.actionDirectoryTabs?.some((tab) => tab.id === SPELL_KNOWN_REMAINING_TAB_ID));
  assert.ok(character.actionDirectoryTabs?.some((tab) => tab.id === 'spell-known-1' && tab.entryIds.length === 0));
});

test('assigned ! stepper macros seed the CX6 store without clobbering an existing count', () => {
  const seeded = persistCollectedSpellTables({ ...createBlankCharacter(), level: 1 }, { spellsPerDay: samplePerDay() });
  const withBang = {
    ...seeded,
    characterActions: seeded.characterActions?.map((item) => (
      item.id === spellSlotActionId(1) ? { ...item, stepperMacro: '<<[6+!*1]' } : item
    )),
    macaroniStepperStore: { [`${spellSlotStepperScopeId(1)}::bang-1`]: 4 },
  };
  const reloaded = normalizeCharacter(withBang);
  assert.equal(reloaded.macaroniStepperStore?.[`${spellSlotStepperScopeId(1)}::bang-1`], 4);
  const binding = getSpellSlotCastBinding(reloaded, 1);
  assert.equal(binding?.stepperMacro, '<<[6+!*1]');
  assert.deepEqual(binding?.bangIds, [`${spellSlotStepperScopeId(1)}::bang-1`]);
});

test('CX7 collect output persists and Complete Sheet can read the current-level row', () => {
  const outputs = ingestSource({ name: 'example.html', content: html });
  const tables = collectSpellProgressionTables(outputs['table.json'].tables, outputs['table.json'].documentId);
  const character = persistCollectedSpellTables({ ...createBlankCharacter(), level: 2 }, tables);
  const row = getPersistedSpellProgressionRow(character, 'spells-per-day', 2);
  assert.equal(row?.values.spd_1, '2');
  const summary = formatSpellTablesForCompleteSheet(character);
  assert.match(summary, /spells-per-day/);
  assert.match(summary, /spd_1=2/);
  assert.doesNotMatch(summary, /<table|htmlContent/i);
});

test('persistSpellTablesFromIngest collects classified tables then persists', () => {
  const outputs = ingestSource({ name: 'example.html', content: html });
  const character = persistSpellTablesFromIngest(
    { ...createBlankCharacter(), level: 1 },
    outputs['table.json'].tables,
    outputs['table.json'].documentId,
  );
  assert.equal(getPersistedSpellProgressionRow(character, 'spells-per-day', 1)?.values.spd_1, '1');
});
