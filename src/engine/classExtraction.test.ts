import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { ingestSource } from '../../server/ingest/ingest.ts';
import { extractClassFromClassifiedTables, parseClassSkills, parseProficiencies } from './classExtraction.ts';
import { extractClassFromSrdDoc } from './sotEngine.ts';

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
