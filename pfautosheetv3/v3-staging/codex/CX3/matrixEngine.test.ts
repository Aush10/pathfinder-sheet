import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../CX2/ingest';
import { createBlankCharacter } from '../../../../src/data/defaultCharacter';
import { applyMatrixProgressionToCharacter } from '../../../../src/engine/characterIntegration';
import {
  MATRIX_MAX_ROWS,
  deriveMatrix,
  indexFromClassifiedTables,
  materializeTrack,
  migrateClassGrid,
  parseHeaderFill,
  parseIndexToken,
} from './matrixEngine';
import type { UserMatrixIndex } from '../../../../src/types/character';

const fighter: UserMatrixIndex = {
  id: 'fighter', name: 'Fighter',
  columns: [
    { id: 'level', header: 'Level', type: 'number' },
    { id: 'bab', header: 'Base Attack Bonus', type: 'number' },
    { id: 'fort', header: 'Fort', type: 'number' },
    { id: 'special', header: 'Special', type: 'ability-list' },
  ],
  rows: Array.from({ length: 8 }, (_, offset) => ({ level: offset + 1, values: { level: String(offset + 1), bab: String(offset + 1), fort: String(Math.floor((offset + 3) / 2)), special: `Fighter feature ${offset + 1}` } })),
};
const wizard: UserMatrixIndex = {
  id: 'wizard', name: 'Wizard',
  columns: fighter.columns.map((column) => ({ ...column })),
  rows: Array.from({ length: 8 }, (_, offset) => ({ level: offset + 1, values: { level: String(offset + 1), bab: String(Math.floor((offset + 1) / 2)), fort: String(Math.floor(offset / 3)), special: `Wizard feature ${offset + 1}` } })),
};

test('parses all CX3 header and index notation', () => {
  assert.deepEqual(parseHeaderFill('=wizard'), { kind: 'constant', value: 'wizard' });
  assert.deepEqual(parseHeaderFill('+1>3'), { kind: 'sequence', start: 1, direction: 1, count: 3, every: undefined });
  assert.deepEqual(parseHeaderFill('+1!2'), { kind: 'sequence', start: 1, direction: 1, count: undefined, every: 2 });
  assert.deepEqual(parseIndexToken('fighter=bab+special'), { indexName: 'fighter', normalizedIndexName: 'fighter', explicitCount: undefined, dominant: false, include: ['bab', 'special'], exclude: [] });
  assert.deepEqual(parseIndexToken('Fighter-bab-special'), { indexName: 'Fighter', normalizedIndexName: 'fighter', explicitCount: undefined, dominant: false, include: undefined, exclude: ['bab', 'special'] });
  assert.deepEqual(parseIndexToken('*wizard'), { indexName: 'wizard', normalizedIndexName: 'wizard', explicitCount: undefined, dominant: true, include: undefined, exclude: [] });
});

test('materializes header fills without replacing manual cells and guards 40 rows', () => {
  assert.deepEqual(materializeTrack({ id: 'one', header: '+1>3', cells: ['', 'manual', '', ''] }, 4).cells, ['1', 'manual', '3', '']);
  assert.deepEqual(materializeTrack({ id: 'two', header: '+1!2', cells: [] }, 4).cells, ['1', '', '2', '']);
  assert.match(materializeTrack({ id: 'cap', header: '=fighter', cells: Array.from({ length: MATRIX_MAX_ROWS + 1 }, () => '') }).error || '', /40/);
});

test('counts fighter4 then continues fighter at five, and renders cell states', () => {
  const matrix = deriveMatrix({ fighter }, { tracks: [{ id: 'track-a', header: '', cells: ['fighter4', 'fighter'] }] }, 2);
  assert.equal(matrix.rows[0].values.bab, '4');
  assert.equal(matrix.rows[1].values.bab, '5');
  assert.equal(matrix.cellStates['track-a:0'], 'green');
  assert.equal(matrix.cellStates['track-a:1'], 'green');
  assert.equal(deriveMatrix({ fighter }, { tracks: [{ id: 'missing', header: '', cells: ['magus'] }] }, 1).cellStates['missing:0'], 'red');
});

test('gestalt uses first/dominant values within one track and highest numeric values across tracks', () => {
  const matrix = deriveMatrix(
    { fighter, wizard },
    { tracks: [
      { id: 'first', header: '', cells: ['fighter,*wizard'] },
      { id: 'second', header: '', cells: ['fighter'] },
    ] },
    1,
  );
  assert.equal(matrix.rows[0].values.bab, '1'); // dominant wizard has 0, second track fighter raises to 1
  assert.equal(matrix.rows[0].values.special, 'Wizard feature 1, Fighter feature 1');
});

test('migrates legacy fixed grids losslessly', () => {
  const migrated = migrateClassGrid({ id: 'class1', className: 'Fighter', level: 1, hitDie: 10, skillPointsPerLevel: 2, proficiencies: '', rawText: '', rows: [{ level: 1, bab: 1, fort: 2, ref: 0, will: 0, special: 'Bonus Feat' }] });
  assert.equal(migrated.rows[0].values.special, 'Bonus Feat');
  assert.equal(migrated.columns.find((column) => column.id === 'bab')?.header, 'Base Attack Bonus');
});

test('builds an SRD index from class and spell extensions but never lookup tables', () => {
  const output = ingestSource({ name: 'sorcerer.html', content: `
    <table><tr><th>Level</th><th>Base Attack Bonus</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th></tr><tr><td>1</td><td>+0</td><td>0</td><td>0</td><td>2</td><td>Bloodline</td></tr><tr><td>2</td><td>+1</td><td>0</td><td>0</td><td>3</td><td>-</td></tr></table>
    <table><tr><th>Spells Known</th><th>Spells Known</th><th>Spells Known</th></tr><tr><th>Level</th><th>0</th><th>1</th></tr><tr><td>1</td><td>4</td><td>2</td></tr><tr><td>2</td><td>5</td><td>2</td></tr></table>
    <table><tr><th>Ignored Lookup</th><th>Value</th></tr><tr><td>foo</td><td>bar</td></tr></table>`, });
  const index = indexFromClassifiedTables('sorcerer', 'Sorcerer', output['table.json'].tables);
  assert.ok(!('error' in index));
  if ('error' in index) return;
  assert.ok(index.columns.some((column) => column.header === 'sk_0'));
  assert.ok(!index.columns.some((column) => column.header === 'Ignored Lookup'));
  assert.equal(index.rows[0].values[index.columns.find((column) => column.header === 'sk_1')!.id], '2');
});

test('projects an explicitly reviewed derived matrix onto sheet combat fields', () => {
  const character = createBlankCharacter();
  const matrix = deriveMatrix({ fighter }, { tracks: [{ id: 'career', header: '', cells: ['fighter', 'fighter'] }] }, 2);
  const updated = applyMatrixProgressionToCharacter(character, matrix);
  assert.equal(updated.level, 2);
  assert.equal(updated.baseAttackBonus, 2);
  assert.equal(updated.saves.fortitude.base, 2);
  assert.ok(updated.featsAndAbilities.includes('Fighter feature 1'));
});
