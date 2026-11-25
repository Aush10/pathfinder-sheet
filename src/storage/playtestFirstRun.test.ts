/// <reference types="node" />

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createBlankCharacter } from '../data/defaultCharacter';
import { createListenersOffAiSettings } from '../engine/aiService';
import {
  PLAYTEST_CRASH_LOG_KEY,
  detectPlaytestRuntimeContext,
  evaluatePlaytestFirstRunGate,
  readPlaytestCrashLog,
  resetPlaytestInit,
  type StorageLike,
} from './playtestFirstRun';
import { buildZipBuffer } from '../../scripts/lib/zipWriter.mjs';
import {
  createApiKeyholeFiles,
  createGeminiKitFiles,
  createOpenAiKitFiles,
  createSotIngestKitFiles,
} from '../../scripts/lib/kitPayloads.mjs';
import {
  buildMacroniBibleHtml,
  buildPlaytestGuideHtml,
  buildPlaytestLauncherPs1,
} from '../../scripts/lib/playtestDocs.mjs';

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test('playtest crash log gates when #inits is 0 and runs when #inits is 1', () => {
  const storage = makeMemoryStorage();
  assert.equal(readPlaytestCrashLog(storage).inits, 0);

  const firstRunRuntime = detectPlaytestRuntimeContext({
    search: '?playtest=1',
    protocol: 'http:',
    port: '38173',
    hasExportedCharacter: false,
    isBuildPlaytestKit: true,
  });
  const firstDecision = evaluatePlaytestFirstRunGate(firstRunRuntime, storage);
  assert.equal(firstDecision.gate, true);
  assert.equal(firstDecision.nextInits, 1);
  assert.equal(readPlaytestCrashLog(storage).inits, 1);

  const secondDecision = evaluatePlaytestFirstRunGate(firstRunRuntime, storage);
  assert.equal(secondDecision.gate, false);
  assert.equal(secondDecision.nextInits, 1);

  const reset = resetPlaytestInit(storage);
  assert.equal(reset.inits, 0);
  const reArmed = evaluatePlaytestFirstRunGate(firstRunRuntime, storage);
  assert.equal(reArmed.gate, true);
});

test('launcher kitInit=1 syncs regular-window crash log without re-gating and character exports skip gate', () => {
  const storage = makeMemoryStorage();
  const regularAfterLauncher = detectPlaytestRuntimeContext({
    search: '?playtest=1&kitInit=1&cmd=Start-PF1MW.ps1',
    protocol: 'http:',
    port: '38173',
    hasExportedCharacter: false,
    isBuildPlaytestKit: true,
  });
  const syncedDecision = evaluatePlaytestFirstRunGate(regularAfterLauncher, storage);
  assert.equal(syncedDecision.gate, false);
  assert.equal(syncedDecision.syncedFromLauncher, true);
  assert.equal(JSON.parse(storage.getItem(PLAYTEST_CRASH_LOG_KEY) || '{}').inits, 1);

  const freshStorage = makeMemoryStorage();
  const exportedSheetRuntime = detectPlaytestRuntimeContext({
    search: '',
    protocol: 'file:',
    port: '',
    hasExportedCharacter: true,
    isBuildPlaytestKit: true,
  });
  const exportedDecision = evaluatePlaytestFirstRunGate(exportedSheetRuntime, freshStorage);
  assert.equal(exportedDecision.gate, false);
  assert.equal(readPlaytestCrashLog(freshStorage).inits, 0);
});

test('AI Companion defaults to uninstalled and listeners start OFF when freshly installed', () => {
  const blank = createBlankCharacter();
  assert.equal(blank.installedModules?.aiCompanion, false);
  assert.equal(blank.installedModules?.aiSettings?.isInstalled, false);

  const offSettings = createListenersOffAiSettings();
  assert.equal(offSettings.isInstalled, true);
  for (const val of Object.values(offSettings.allowedModules || {})) {
    assert.equal(val, false);
  }
  for (const val of Object.values(offSettings.allowedFields)) {
    assert.equal(val, false);
  }
});

test('SheetPage4FormulaStudio includes updated Macroni XDX Bible terminology', () => {
  const studioPath = path.join(process.cwd(), 'src/components/sheet/SheetPage4FormulaStudio.tsx');
  const source = fs.readFileSync(studioPath, 'utf8');
  for (const term of [
    'Macro Native Index',
    'instate',
    'populate',
    'Elevate',
    'copulate',
    'agitate',
    'escalate',
    'insinuate',
    'calculate',
    '{capsulate}',
    '"Yapulate"',
    '{Xd8}',
  ]) {
    assert.ok(source.includes(term), `Missing Macroni XDX Bible term: ${term}`);
  }
});

test('Playtest Kit builders produce guide, Bible, launcher, and secret-free downloadable kits', () => {
  const guideHtml = buildPlaytestGuideHtml();
  assert.match(guideHtml, /Wait it's dangerous out there\. Read this o7/);
  assert.match(guideHtml, /github\.com\/Aush10\/pathfinder-sheet\/issues/);
  assert.match(guideHtml, /kits\/openai-ai-kit\.zip/);
  assert.match(guideHtml, /kits\/gemini-ai-kit\.zip/);
  assert.match(guideHtml, /kits\/api-keyhole\.zip/);
  assert.match(guideHtml, /kits\/sot-ingest-kit\.zip/);

  const bibleHtml = buildMacroniBibleHtml();
  assert.match(bibleHtml, /Marconi = Macro Native Index/);
  assert.match(bibleHtml, /\{Xd8\}/);

  const ps1 = buildPlaytestLauncherPs1();
  assert.match(ps1, /Get-PlaytestInits/);
  assert.match(ps1, /--incognito/);
  assert.match(ps1, /kitInit=1/);

  const keyhole = createApiKeyholeFiles();
  assert.deepEqual(
    keyhole.map((f) => f.name).sort(),
    ['.env.local', 'README.txt', 'api-keyhole.json'],
  );
  const envFile = keyhole.find((f) => f.name === '.env.local')!.content;
  assert.doesNotMatch(envFile, /sk-[A-Za-z0-9]{10,}|AIza[A-Za-z0-9_-]{10,}/);

  for (const kitFiles of [
    createOpenAiKitFiles(),
    createGeminiKitFiles(),
    createSotIngestKitFiles(process.cwd()),
  ]) {
    const zip = buildZipBuffer(kitFiles);
    assert.equal(zip.subarray(0, 2).toString('ascii'), 'PK');
    assert.ok(zip.length > 500);
  }
});
