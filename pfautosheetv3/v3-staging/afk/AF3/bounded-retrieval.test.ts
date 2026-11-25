/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../../../server/ingest/ingest.ts';
import {
  SOT_CONTEXT_CHAR_BUDGET,
  selectBoundedSotContext,
} from '../../../../server/sotContext.ts';

test('AF3 ingest path queries index.json and omits unmatched sections from a real CX2 artifact', () => {
  const ingest = ingestSource({
    name: 'multisection.html',
    content: `<h1>Ranger</h1><p>Favored enemy against a chosen creature type.</p>
      <h2>Hunter's Bond</h2><p>Hunter's bond shares favored enemy bonuses with companions.</p>
      <h2>Woodland Stride</h2><p>Woodland stride ignores natural undergrowth.</p>`,
  });
  const result = selectBoundedSotContext({
    documents: [{
      id: ingest['index.json'].document.id,
      title: ingest['index.json'].document.title,
      category: 'Class',
      ingest,
    }],
    query: "hunter's bond companions",
  });
  assert.equal(result.mode, 'ingest');
  assert.ok(result.selectedSectionIds.length >= 1);
  assert.match(result.text, /Hunter's Bond|Hunters Bond|hunter/i);
  assert.doesNotMatch(result.text, /Woodland stride ignores natural undergrowth/);
  assert.ok(result.text.length <= SOT_CONTEXT_CHAR_BUDGET);
  assert.match(result.text, /Loaded SOT documents/);
});

test('legacy full pages still get the 12k cap and never leak raw HTML tags', () => {
  const dump = `<h1>Dump</h1><p>${'power attack '.repeat(2000)} filler ${'x'.repeat(8000)}</p>`;
  const result = selectBoundedSotContext({
    documents: [{
      id: 'legacy',
      title: 'Legacy Full Page',
      category: 'Feat',
      htmlContent: dump,
    }],
    query: 'power attack',
  });
  assert.ok(result.text.length <= SOT_CONTEXT_CHAR_BUDGET);
  assert.doesNotMatch(result.text, /<h1>|<p>/);
  assert.match(result.text, /power attack/i);
});
