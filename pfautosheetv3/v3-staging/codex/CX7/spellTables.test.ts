import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../../../server/ingest/ingest';
import {
  attachSpellProgressionTable,
  collectSpellProgressionTables,
  getSpellProgressionRow,
  toSpellProgressionMatrix,
} from './spellTables';

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

test('collects structured spell tables with 20 fixed progression rows', () => {
  const outputs = ingestSource({ name: 'example.html', content: html });
  const tables = collectSpellProgressionTables(outputs['table.json'].tables, outputs['table.json'].documentId);
  assert.equal(tables.spellsPerDay?.rows.length, 20);
  assert.equal(tables.spellsKnown?.rows.length, 20);
  assert.equal(tables.spellsPerDay?.rows[0].values.spd_1, '1');
  assert.equal(tables.spellsPerDay?.rows[0].values.spd_2, '—');
  assert.equal(tables.spellsKnown?.rows[1].values.sk_1, '3');
  assert.equal(tables.spellsKnown?.sourceDocumentId, outputs['table.json'].documentId);
});

test('provides immutable attach, query, and matrix helpers', () => {
  const outputs = ingestSource({ name: 'example.html', content: html });
  const tables = collectSpellProgressionTables(outputs['table.json'].tables);
  const attached = attachSpellProgressionTable({ spellTables: {} }, tables.spellsPerDay!);
  const row = getSpellProgressionRow(attached, 'spells-per-day', 2);
  assert.equal(row?.values.spd_0, '4');
  const matrix = toSpellProgressionMatrix(tables.spellsPerDay!);
  assert.deepEqual(matrix.columns, ['level', 'spd_0', 'spd_1', 'spd_2']);
  assert.equal(matrix.rows[19].level, 20);
});
