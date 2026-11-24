import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ingestSource, normalizeHeader } from './ingest.ts';

test('classifies Armorist deterministically and retains extra named columns', async () => {
  const content = await readFile(new URL('../../../../save tree test/armorist.srd.json', import.meta.url), 'utf8');
  const first = ingestSource({ name: 'armorist.srd.json', content });
  const second = ingestSource({ name: 'armorist.srd.json', content });
  assert.deepEqual(first, second);
  const table = first['table.json'].tables.find((candidate) => candidate.kind === 'class-grid');
  assert.ok(table);
  assert.equal(table.headerMap['Max Bonus'], 'max_bonus');
  assert.equal(table.headerMap['Magic Talents'], 'magic_talents');
  assert.ok(table.cells.some((cell) => cell.text === 'Level' && cell.isHeader));
  assert.match(first['text.md'], /\[Table:.*table_id=table-/);
  assert.ok(first['index.json'].termIndex.armorist);
});

test('handles Markdown headings, tables and links as deterministic source content', () => {
  const result = ingestSource({ name: 'notes.md', content: '# Rules\n\n| Level | BAB | Fort | Ref | Will | Special |\n| --- | --- | --- | --- | --- | --- |\n| 1 | +1 | +2 | 0 | 0 | Feat |\n\n[Reference](https://example.test/rules)' });
  assert.equal(result['table.json'].tables[0].kind, 'class-grid');
  assert.equal(result['links.json'].links[0].href, 'https://example.test/rules');
  assert.equal(result['index.json'].toc[0].headingPath.at(-1), 'Rules');
});

test('handles merged and repeated stacked spell headers without treating the group row as data', () => {
  const html = `<h1>Sorcerer</h1><table><tr><th>Level</th><th colspan="2">Spells per Day</th></tr><tr><th>Level</th><th>0</th><th>1</th></tr><tr><td>1</td><td>3</td><td>1</td></tr></table>
  <table><tr><th>Level</th><th>Spells Known</th><th>Spells Known</th></tr><tr><th>Level</th><th>0</th><th>1</th></tr><tr><td>1</td><td>4</td><td>2</td></tr></table>`;
  const tables = ingestSource({ name: 'sorcerer.html', content: html })['table.json'].tables;
  assert.deepEqual(tables[0].headers, ['Level', 'spd_0', 'spd_1']);
  assert.deepEqual(tables[0].rows, [['1', '3', '1']]);
  assert.deepEqual(tables[1].headers, ['Level', 'sk_0', 'sk_1']);
  assert.equal(tables[0].kind, 'extended-grid');
});

test('never classifies a lookup table as a class grid and rejects unrecognised JSON', () => {
  const result = ingestSource({ name: 'fighter.html', content: `<table><tr><th>Level</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th></tr><tr><td>1</td><td>+1</td><td>+2</td><td>+0</td><td>+0</td><td>Feat</td></tr></table><table><tr><th>Result</th><th>Effect</th></tr><tr><td>1</td><td>Fine</td></tr></table>` });
  assert.equal(result['table.json'].tables[0].kind, 'class-grid');
  assert.equal(result['table.json'].tables[1].kind, 'lookup-table');
  assert.throws(() => ingestSource({ name: 'unknown.json', content: '{"oops":true}' }), /Unknown JSON input/);
  assert.equal(normalizeHeader('Base Attack Bonus'), 'bab');
});
