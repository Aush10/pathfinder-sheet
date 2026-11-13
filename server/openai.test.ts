/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadServerEnvironment } from './env';
import { generateContentWithFallback, getOpenAIModelsToTry } from './openai';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const fakeApiKey = 'unit-test-placeholder-key';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('generation uses the OpenAI chat endpoint with the supplied key, model, and JSON instructions', async (context) => {
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    requests += 1;
    assert.equal(input, OPENAI_CHAT_URL);
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), `Bearer ${fakeApiKey}`);
    assert.equal(headers.get('Content-Type'), 'application/json');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      model: getOpenAIModelsToTry()[0],
      messages: [
        { role: 'system', content: 'Return one structured character update.' },
        { role: 'user', content: 'Choose a character name.' },
      ],
      response_format: { type: 'json_object' },
    });
    return jsonResponse({ choices: [{ message: { content: '  {"name":"Mira"}  ' } }] });
  });

  const result = await generateContentWithFallback(fakeApiKey, {
    contents: 'Choose a character name.',
    config: { systemInstruction: 'Return one structured character update.', responseMimeType: 'application/json' },
  });
  assert.deepEqual(result, { text: '{"name":"Mira"}' });
  assert.equal(requests, 1);
});

test('a failed model falls back to another model on the same OpenAI endpoint', async (context) => {
  const requestedModels: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    assert.equal(input, OPENAI_CHAT_URL, 'fallback must stay with OpenAI');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${fakeApiKey}`);
    const body = JSON.parse(String(init?.body));
    requestedModels.push(body.model);
    assert.deepEqual(body.messages, [{ role: 'user', content: 'Continue the character.' }]);
    assert.equal('response_format' in body, false);
    if (requestedModels.length === 1) return jsonResponse({ error: { message: 'First model unavailable (mock).' } }, 503);
    return jsonResponse({ choices: [{ message: { content: 'Second OpenAI model succeeded.' } }] });
  });

  const result = await generateContentWithFallback(fakeApiKey, { contents: 'Continue the character.' });
  assert.deepEqual(requestedModels, getOpenAIModelsToTry().slice(0, 2));
  assert.deepEqual(result, { text: 'Second OpenAI model succeeded.' });
});

test('an OpenAI key error never switches providers', async (context) => {
  const requestedModels: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    assert.equal(input, OPENAI_CHAT_URL, 'authentication failure must not send any request to another provider');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${fakeApiKey}`);
    const body = JSON.parse(String(init?.body));
    requestedModels.push(body.model);
    return jsonResponse({ error: { message: 'Invalid OpenAI API key (mock).' } }, 401);
  });

  await assert.rejects(
    generateContentWithFallback(fakeApiKey, { contents: 'Do not change providers.' }),
    /Invalid OpenAI API key \(mock\)\./,
  );
  assert.deepEqual(requestedModels, getOpenAIModelsToTry());
});

test('the OpenAI model is read after local environment settings load', async (context) => {
  const prefix = join(tmpdir(), 'pf1e-model-env-test-');
  const root = await mkdtemp(prefix);
  const previousModel = process.env.OPENAI_MODEL;
  const previousNodeEnv = process.env.NODE_ENV;
  context.after(async () => {
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    assert.ok(root.startsWith(prefix));
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(join(root, '.env.local'), 'OPENAI_MODEL=fake-post-load-model\n', 'utf8');
  process.env.NODE_ENV = 'development';
  process.env.OPENAI_MODEL = 'fake-inherited-model';
  loadServerEnvironment(root);
  assert.equal(getOpenAIModelsToTry()[0], 'fake-post-load-model');

  context.mock.method(globalThis, 'fetch', async (input: unknown, init?: RequestInit) => {
    assert.equal(input, OPENAI_CHAT_URL);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'fake-post-load-model');
    return jsonResponse({ choices: [{ message: { content: 'Configured model used.' } }] });
  });
  const result = await generateContentWithFallback(fakeApiKey, { contents: 'Use the loaded model.' });
  assert.equal(result.text, 'Configured model used.');
});
