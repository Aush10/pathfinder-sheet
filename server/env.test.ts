/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { loadServerEnvironment } from './env';

async function fixture(context: TestContext, files: Record<string, string>): Promise<string> {
  const prefix = join(tmpdir(), 'pf1e-env-test-');
  const root = await mkdtemp(prefix);
  context.after(async () => {
    assert.ok(root.startsWith(prefix), 'temporary fixture must remain inside its intended temporary directory');
    await rm(root, { recursive: true, force: true });
  });
  for (const [fileName, contents] of Object.entries(files)) await writeFile(join(root, fileName), contents, 'utf8');
  return root;
}

test('development local settings override inherited and base OpenAI settings quietly', async (context) => {
  const root = await fixture(context, {
    '.env': 'OPENAI_API_KEY=fake-base-key\nOPENAI_MODEL=fake-base-model\nBASE_ONLY=base-value\n',
    '.env.local': 'OPENAI_API_KEY=fake-local-key\nOPENAI_MODEL=fake-local-model\nLOCAL_ONLY=local-value\n',
  });
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    OPENAI_API_KEY: 'fake-inherited-key',
    OPENAI_MODEL: 'fake-inherited-model',
  };
  const log = context.mock.method(console, 'log', () => {});

  loadServerEnvironment(root, environment);

  assert.equal(environment.OPENAI_API_KEY, 'fake-local-key');
  assert.equal(environment.OPENAI_MODEL, 'fake-local-model');
  assert.equal(environment.BASE_ONLY, 'base-value');
  assert.equal(environment.LOCAL_ONLY, 'local-value');
  assert.equal(log.mock.callCount(), 0, 'loading local configuration must not print environment details');
});

test('local settings override base defaults when no settings were inherited', async (context) => {
  const root = await fixture(context, {
    '.env': 'OPENAI_API_KEY=fake-base-key\nOPENAI_MODEL=fake-base-model\n',
    '.env.local': 'OPENAI_API_KEY=fake-local-key\nOPENAI_MODEL=fake-local-model\n',
  });
  const environment: NodeJS.ProcessEnv = {};

  loadServerEnvironment(root, environment);

  assert.equal(environment.OPENAI_API_KEY, 'fake-local-key');
  assert.equal(environment.OPENAI_MODEL, 'fake-local-model');
});

test('production preserves hosting settings when base and local files also define them', async (context) => {
  const root = await fixture(context, {
    '.env': 'OPENAI_API_KEY=fake-base-key\nOPENAI_MODEL=fake-base-model\nBASE_ONLY=base-value\n',
    '.env.local': 'OPENAI_API_KEY=fake-local-key\nOPENAI_MODEL=fake-local-model\n',
  });
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    OPENAI_API_KEY: 'fake-hosting-key',
    OPENAI_MODEL: 'fake-hosting-model',
  };

  loadServerEnvironment(root, environment);

  assert.equal(environment.OPENAI_API_KEY, 'fake-hosting-key');
  assert.equal(environment.OPENAI_MODEL, 'fake-hosting-model');
  assert.equal(environment.NODE_ENV, 'production');
  assert.equal(environment.BASE_ONLY, 'base-value');
});

test('without a local file inherited settings stay intact and base values fill only missing fields', async (context) => {
  const root = await fixture(context, {
    '.env': 'OPENAI_API_KEY=fake-base-key\nOPENAI_MODEL=fake-base-model\nBASE_ONLY=base-value\n',
  });
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    OPENAI_API_KEY: 'fake-inherited-key',
  };

  loadServerEnvironment(root, environment);

  assert.equal(environment.OPENAI_API_KEY, 'fake-inherited-key');
  assert.equal(environment.OPENAI_MODEL, 'fake-base-model');
  assert.equal(environment.BASE_ONLY, 'base-value');
});
