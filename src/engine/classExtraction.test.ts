import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { ingestSource } from '../../server/ingest/ingest.ts';
import { extractClassFromClassifiedTables, parseClassSkills, parseProficiencies } from './classExtraction.ts';
import { collectSpellProgressionTables } from './spellTables.ts';
import { extractClassFromSrdDoc, extractClassFromSrdDocWithIngest } from './sotEngine.ts';

const armoristPath = join(process.cwd(), 'save tree test', 'armorist.srd.json');

test('extracts Armorist from its classified class grid without sacrificing named numeric columns', async () => {
  const content = await readFile(armoristPath, 'utf8');
  const ingested = ingestSource({ name: 'armorist.srd.json', content });
  const result = extractClassFromClassifiedTables({ title: 'armorist', plainText: ingested['text.md'], tables: ingested['table.json'].tables });
  assert.equal(result.matched, true);
  assert.equal(result.className, 'The Armorist');
  assert.equal(result.rows.length, 20);
  assert.equal(result.cleanedSkillsList.length, 13);
  assert.ok(result.columns.some((column) => column.header === 'Magic Talents'));
  assert.ok(result.columns.some((column) => column.header === 'Max Bonus'));
});

test('uses only a bounded proficiency section and only the Class Skills line', () => {
  const text = `Class Skills: Acrobatics (Dex), Knowledge (arcana) (Int), and Spellcraft (Int)\nSkill Ranks Per Level: 3 + Int\nWeapon and Armor Proficiency: Simple weapons.\nClass Feature: A later sentence says proficient with every weapon.`;
  assert.deepEqual(parseClassSkills(text).skills, ['Acrobatics', 'Knowledge (Arcana)', 'Spellcraft']);
  assert.equal(parseProficiencies(text), 'Simple weapons.');
});

test('extractClassFromSrdDoc maps classified rows and refuses to synthesize a prose grid', async () => {
  const content = await readFile(armoristPath, 'utf8');
  const ingested = ingestSource({ name: 'armorist.srd.json', content });
  const doc = {
    id: 'armorist',
    title: 'Armorist',
    category: 'Full Class SRD' as const,
    htmlContent: '',
    plainText: ingested['text.md'],
    isOverride: false,
    tags: [],
    updatedAt: 0,
  };
  const extracted = extractClassFromSrdDoc(doc, 'Armorist', ingested['table.json'].tables, ingested['text.md']);
  assert.equal(extracted.matched, true);
  assert.equal(extracted.rows.length, 20);
  assert.ok(extracted.columns.some((column) => column.header === 'Magic Talents'));
  const unmatched = extractClassFromSrdDoc({
    ...doc,
    plainText: 'At 1st level, the fighter gains a bonus feat.\nHit Die: d10',
  });
  assert.equal(unmatched.matched, false);
  assert.equal(unmatched.rows.length, 0);
  assert.equal(unmatched.hitDie, 10);
});

test('never treats a lookup table or prose as a class grid', () => {
  const tables = ingestSource({ name: 'tables.html', content: '<table><tr><th>Roll</th><th>Result</th></tr><tr><td>1</td><td>Fine</td></tr></table>' })['table.json'].tables;
  const result = extractClassFromClassifiedTables({ title: 'Fighter', plainText: 'Table: Fighter\nClass Skills: Climb (Str)', tables });
  assert.equal(result.matched, false);
  assert.match(result.summaryMessage, /no classified class grid/);
});

test('reuses saved class and spell progression and falls back when document IDs differ', async (t) => {
  const artifacts = ingestSource({
    name: 'Battle Mage.html',
    content: `<h1>Battle Mage</h1><p>Hit Die: d10</p>
      <table>
        <tr><th>Level</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th></tr>
        <tr><td>1</td><td>+0</td><td>+0</td><td>+0</td><td>+2</td><td>Cantrips</td></tr>
      </table>
      <table>
        <tr><th rowspan="2">Level</th><th colspan="2">Spells per day</th></tr>
        <tr><th>0</th><th>1</th></tr>
        <tr><td>1</td><td>3</td><td>1</td></tr>
      </table>`,
  });
  const doc = {
    id: 'battle-mage',
    title: 'Battle Mage',
    category: 'Full Class SRD' as const,
    htmlContent: '',
    plainText: '',
    isOverride: true,
    tags: [],
    updatedAt: 0,
  };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({
    documentId: artifacts['table.json'].documentId,
    artifacts,
  }));

  const extracted = await extractClassFromSrdDocWithIngest(doc, 'Battle Mage', artifacts);

  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(extracted.matched, true);
  assert.equal(extracted.hitDie, 10);
  assert.equal(extracted.rows[0]?.special, 'Cantrips');
  const { spellsPerDay } = collectSpellProgressionTables(extracted.tables, extracted.documentId);
  assert.equal(spellsPerDay?.rows[0].values.spd_1, '1');
  assert.equal(spellsPerDay?.sourceDocumentId, artifacts['table.json'].documentId);

  const fallback = await extractClassFromSrdDocWithIngest(
    { ...doc, htmlContent: '<h1>Battle Mage</h1>' },
    'Battle Mage',
    {
      ...artifacts,
      'index.json': {
        ...artifacts['index.json'],
        document: { ...artifacts['index.json'].document, id: 'different-document' },
      },
    },
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(fallback.documentId, artifacts['table.json'].documentId);
  assert.equal(fallback.rows[0]?.special, 'Cantrips');
});
