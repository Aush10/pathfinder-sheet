/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { compactSotDocumentsForRequest, REQUEST_SOT_EXCERPT_CAP } from '../../../../src/engine/aiService.ts';
import { LOOKUP_SYSTEM_INSTRUCTION, buildCompleteSheetSystemInstruction } from '../../../../server/prompts.ts';

const routesSource = readFileSync(join(process.cwd(), 'server/routes.ts'), 'utf8');
const promptsSource = readFileSync(join(process.cwd(), 'server/prompts.ts'), 'utf8');

test('compact payload sends ids and query-sized excerpts, never htmlContent', () => {
  const pages = [
    {
      id: 'page-1',
      title: 'Fighter SRD',
      category: 'Class',
      isOverride: true,
      htmlContent: `<h1>Fighter</h1><p>${'bonus feat '.repeat(3000)}</p>`,
      plainText: `Fighter bonus feat ${'alpha '.repeat(3000)}`,
    },
    {
      id: 'page-2',
      title: 'Ingested Ranger',
      category: 'Class',
      htmlContent: '<h1>ShouldNotTravel</h1>',
      ingest: {
        'index.json': { sections: [{ id: 's1', headingPath: ['Ranger'], text: 'Favored enemy' }] },
        'text.md': '# Ranger\n\nFavored enemy',
        'table.json': { tables: [] },
      },
    },
  ];
  const compact = compactSotDocumentsForRequest(pages);
  assert.equal(compact.length, 2);
  assert.equal(compact[0].id, 'page-1');
  assert.equal(compact[0].title, 'Fighter SRD');
  assert.equal(typeof compact[0].excerpt, 'string');
  assert.ok(String(compact[0].excerpt).length <= REQUEST_SOT_EXCERPT_CAP);
  assert.equal('htmlContent' in compact[0], false);
  assert.equal('plainText' in compact[0], false);
  assert.equal('htmlContent' in compact[1], false);
  assert.ok(compact[1].ingest);
  assert.match(routesSource, /sotDocuments \?\? sotOverridePages/);
  assert.match(routesSource, /query: userPrompt|query = ''/);
});

test('prompts drop the Slayer example and mark sheet text as untrusted content', () => {
  const complete = buildCompleteSheetSystemInstruction('');
  assert.doesNotMatch(LOOKUP_SYSTEM_INSTRUCTION, /Slayer/);
  assert.doesNotMatch(complete, /Slayer/);
  assert.doesNotMatch(promptsSource, /Slayer/);
  assert.match(complete, /className": "Fighter"/);
  assert.match(LOOKUP_SYSTEM_INSTRUCTION, /UNTRUSTED CONTENT/);
  assert.match(complete, /UNTRUSTED CONTENT/);
  assert.match(complete, /omission as absence|omitted excerpt|does not mean/i);
  assert.match(routesSource, /asUntrustedContent\('CHARACTER SHEET'/);
  assert.match(routesSource, /asUntrustedContent\('SOT EXCERPTS'/);
  assert.match(routesSource, /asUntrustedContent\('CONVERSATION'/);
});

test('tap-test raw model JSON is logged in development only and keys are redacted', () => {
  assert.match(routesSource, /function logTapTestModelJson/);
  assert.match(routesSource, /NODE_ENV === 'production'/);
  assert.match(routesSource, /\[tap-test raw model json\]/);
  assert.match(routesSource, /redactSecretsForLog/);
  assert.match(routesSource, /logTapTestModelJson\(tapTestContext, rawText\)/);
});
