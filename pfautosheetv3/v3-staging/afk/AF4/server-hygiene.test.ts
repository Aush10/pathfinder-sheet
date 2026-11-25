/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Express } from 'express';
import {
  DEFAULT_SERVER_PORT,
  formatPortInUseMessage,
  inspectReadonlySotFetchUrl,
  isReadonlySotHostAllowed,
  registerApiRoutes,
  resolveServerPort,
  shouldServeSpaFallback,
} from '../../../../server/routes.ts';

test('PORT env falls back to 3000 and accepts a valid override (B18)', () => {
  assert.equal(resolveServerPort({}), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: '' }), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: '   ' }), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: 'not-a-port' }), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: '0' }), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: '70000' }), DEFAULT_SERVER_PORT);
  assert.equal(resolveServerPort({ PORT: '3001' }), 3001);
  assert.equal(resolveServerPort({ PORT: '8080' }), 8080);
});

test('EADDRINUSE message names the busy port and suggests PORT=3001 (B18)', () => {
  const message = formatPortInUseMessage(3000);
  assert.match(message, /3000/);
  assert.match(message, /PORT=3001/);
  assert.match(message, /already in use/i);
});

test('production SPA fallback is Express 4 GET/HEAD and skips /api (B17)', () => {
  assert.equal(shouldServeSpaFallback('GET', '/character/alice/hero'), true);
  assert.equal(shouldServeSpaFallback('HEAD', '/sheet'), true);
  assert.equal(shouldServeSpaFallback('GET', '/api/openai/status'), false);
  assert.equal(shouldServeSpaFallback('POST', '/character/alice/hero'), false);
  assert.equal(shouldServeSpaFallback('GET', '/api/sot/ingest'), false);
});

test('read-only SOT fetch allowlists d20pfsrd, aonprd, paizo, and spheres wikidot', () => {
  assert.equal(isReadonlySotHostAllowed('https://www.d20pfsrd.com/classes/core-classes/fighter/'), true);
  assert.equal(isReadonlySotHostAllowed('https://aonprd.com/SpellDisplay.aspx?ItemName=Fireball'), true);
  assert.equal(isReadonlySotHostAllowed('https://paizo.com/pathfinder'), true);
  assert.equal(isReadonlySotHostAllowed('http://spheresofpower.wikidot.com/armorist'), true);
  assert.equal(isReadonlySotHostAllowed('https://d20pfsrd.com.evil.example/'), false);
  assert.equal(isReadonlySotHostAllowed('https://evil.com/'), false);
  assert.equal(isReadonlySotHostAllowed('http://127.0.0.1/secret'), false);
  assert.equal(isReadonlySotHostAllowed('http://localhost:3000/'), false);
  assert.equal(isReadonlySotHostAllowed('https://169.254.169.254/latest/meta-data/'), false);
});

test('fetch-readonly-page rejects missing URLs, webhooks, and off-allowlist hosts', () => {
  const missing = inspectReadonlySotFetchUrl(undefined);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 400);

  const webhook = inspectReadonlySotFetchUrl('https://discord.com/api/webhooks/123/abc');
  assert.equal(webhook.ok, false);
  if (!webhook.ok) assert.equal(webhook.status, 403);

  const blocked = inspectReadonlySotFetchUrl('https://example.com/fighter');
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.status, 403);
    assert.match(blocked.error, /allowlist/i);
  }

  const allowed = inspectReadonlySotFetchUrl('https://www.d20pfsrd.com/classes/core-classes/fighter/');
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.url, 'https://www.d20pfsrd.com/classes/core-classes/fighter/');
});

test('Gemini aliases are not registered; OpenAI and SOT routes remain', () => {
  const posts: string[] = [];
  const gets: string[] = [];
  const app = {
    get(path: string) {
      gets.push(path);
    },
    post(path: string) {
      posts.push(path);
    },
  } as unknown as Express;

  registerApiRoutes(app);

  assert.deepEqual(
    posts.filter((path) => path.startsWith('/api/gemini')),
    [],
  );
  assert.ok(posts.includes('/api/openai/generate'));
  assert.ok(posts.includes('/api/openai/lookup'));
  assert.ok(posts.includes('/api/openai/complete-sheet'));
  assert.ok(posts.includes('/api/sot/fetch-readonly-page'));
  assert.ok(posts.includes('/api/sot/ingest'));
  assert.ok(gets.includes('/api/openai/status'));
});
