/// <reference types="node" />

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildUpdatedCommandString,
  detectExistingKits,
  getPlaytestUpdateStatus,
  isLoopbackAddress,
  resolveUpdaterScriptPath,
} from './playtestUpdate.ts';

test('isLoopbackAddress allows only loopback callers', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.42'), false);
  assert.equal(isLoopbackAddress('10.0.0.5'), false);
  assert.equal(isLoopbackAddress(undefined), false);
});

test('detectExistingKits identifies only kits actually present in a test folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf1mw-kit-detect-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'Start-Autosheet-Playtest-Kit.ps1'), '');
    fs.mkdirSync(path.join(dir, 'kits'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'kits', 'openai-ai-kit.zip'), 'zip');
    fs.writeFileSync(path.join(dir, 'kits', 'sot-ingest-kit.zip'), 'zip');
    fs.mkdirSync(path.join(dir, 'pt-kit', 'ingest'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pt-kit', 'ingest', 'run.ts'), '');

    const detected = detectExistingKits(dir);
    const ids = detected.map((item) => item.id);
    assert.ok(ids.includes('standalone_core'));
    assert.ok(ids.includes('kit_openai_ai'));
    assert.ok(ids.includes('kit_sot_ingest'));
    assert.ok(ids.includes('pt_kit_ingest'));
    assert.equal(ids.includes('kit_gemini_ai'), false);
    assert.equal(ids.includes('kit_api_keyhole'), false);
    assert.equal(ids.includes('chirpy_runtime'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveUpdaterScriptPath prefers Updated.ps1 then Update-PF1MW.ps1 then installer/Update-PF1MW.ps1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf1mw-updater-path-'));
  try {
    fs.mkdirSync(path.join(dir, 'installer'), { recursive: true });
    const inst = path.join(dir, 'installer', 'Update-PF1MW.ps1');
    fs.writeFileSync(inst, '# installer');
    assert.equal(resolveUpdaterScriptPath(dir), inst);

    const rootUpdate = path.join(dir, 'Update-PF1MW.ps1');
    fs.writeFileSync(rootUpdate, '# runtime');
    assert.equal(resolveUpdaterScriptPath(dir), rootUpdate);

    const updatedPs1 = path.join(dir, 'Updated.ps1');
    fs.writeFileSync(updatedPs1, '# standalone');
    assert.equal(resolveUpdaterScriptPath(dir), updatedPs1);
    assert.match(buildUpdatedCommandString(dir), /Updated\.ps1/);

    const status = getPlaytestUpdateStatus(dir);
    assert.equal(status.ok, true);
    assert.equal(status.updaterPath, updatedPs1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
