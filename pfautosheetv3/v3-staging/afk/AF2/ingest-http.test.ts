/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_SOURCE_BYTES } from '../../../../server/ingest/ingest.ts';
import { ingestFromRequestBody } from '../../../../server/ingest/http.ts';

test('POST ingest returns the four artifacts and never executes source content', () => {
  const marker = '__ingestExecuted';
  (globalThis as Record<string, unknown>)[marker] = undefined;
  const result = ingestFromRequestBody({
    name: 'trap.html',
    content: `<h1>Fighter</h1><script>globalThis.${marker}=true</script><table><tr><th>Level</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th></tr><tr><td>1</td><td>+1</td><td>+2</td><td>+0</td><td>+0</td><td>Feat</td></tr></table>`,
  });
  assert.equal(result.status, 200);
  assert.equal((globalThis as Record<string, unknown>)[marker], undefined);
  assert.equal(result.payload.schemaVersion, 'PF1E_SOT_INGEST_V1');
  if (result.status !== 200) return;
  assert.equal(typeof result.payload.artifacts['text.md'], 'string');
  assert.ok(Array.isArray(result.payload.artifacts['table.json'].tables));
  assert.ok(Array.isArray(result.payload.artifacts['links.json'].links));
  assert.ok(result.payload.artifacts['index.json'].document.id);
  assert.match(result.payload.artifacts['text.md'], /Fighter/);
});

test('rejects oversized sources, unknown JSON, and unsafe envelope keys', () => {
  const oversized = ingestFromRequestBody({
    name: 'huge.html',
    content: 'x'.repeat(MAX_SOURCE_BYTES + 1),
  });
  assert.equal(oversized.status, 413);

  const unknown = ingestFromRequestBody({
    name: 'unknown.json',
    content: '{"oops":true}',
  });
  assert.equal(unknown.status, 400);
  assert.match(String(unknown.payload.error), /Unknown JSON input/);

  const unsafe = ingestFromRequestBody({
    name: 'x.html',
    content: '<p>ok</p>',
    constructor: { prototype: { polluted: true } },
  });
  assert.equal(unsafe.status, 400);
  assert.match(String(unsafe.payload.error), /unsafe JSON key/);

  const notAString = ingestFromRequestBody({
    name: 'x.html',
    content: { eval: 'this should not run' },
  });
  assert.equal(notAString.status, 400);
  assert.match(String(notAString.payload.error), /never executed/);
});
