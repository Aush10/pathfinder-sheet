/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_SOT_CATALOGUE,
  loadAllHostDeviceSrdDocs,
  loadHostSrdDocsForCharacter,
  referenceSrdPagesForStorage,
  rehydrateSrdPagesFromHost,
  saveSrdDocForCharacter,
  saveSrdDocToHostDeviceStorage,
  setActiveHostSrdOwner,
} from '../../../../src/engine/sotEngine';
import type { SOTRichTextPage } from '../../../../src/types/character';

class MemoryLocalStorage {
  private readonly store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function installLocalStorage(): void {
  const memory = new MemoryLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memory,
  });
}

function samplePage(id: string, title: string): SOTRichTextPage {
  return {
    id,
    title,
    category: 'Full Class SRD',
    htmlContent: `<h1>${title}</h1>`,
    plainText: title,
    isOverride: true,
    tags: [],
    updatedAt: 1,
  };
}

test('host SRDs are scoped per character and a new owner inherits nothing', () => {
  installLocalStorage();
  setActiveHostSrdOwner('char-a');
  const key = saveSrdDocForCharacter('char-a', samplePage('slayer', 'Slayer'));
  assert.ok(key);
  assert.equal(loadHostSrdDocsForCharacter('char-a').length, 1);
  assert.equal(loadHostSrdDocsForCharacter('char-b').length, 0);
  setActiveHostSrdOwner('char-b');
  assert.equal(loadAllHostDeviceSrdDocs().length, 0);
  assert.equal(saveSrdDocToHostDeviceStorage(samplePage('armorist', 'Armorist')).includes('char-b'), true);
  assert.equal(loadHostSrdDocsForCharacter('char-a')[0]?.title, 'Slayer');
  assert.equal(loadAllHostDeviceSrdDocs()[0]?.title, 'Armorist');
});

test('character.json references SRDs instead of embedding HTML when host storage works', () => {
  installLocalStorage();
  const character = {
    sotCatalogue: {
      ...EMPTY_SOT_CATALOGUE,
      overridePages: [samplePage('armorist', 'Armorist')],
    },
  };
  const stored = referenceSrdPagesForStorage(character, 'char-a');
  assert.equal(stored.sotCatalogue.overridePages[0].htmlContent, '');
  assert.equal(stored.sotCatalogue.overridePages[0].plainText, '');
  assert.ok(stored.sotCatalogue.overridePages[0].hostSavedKey);
  const live = rehydrateSrdPagesFromHost(stored, 'char-a');
  assert.equal(live.sotCatalogue.overridePages[0].plainText, 'Armorist');
  assert.match(live.sotCatalogue.overridePages[0].htmlContent, /Armorist/);
});

test('loadAllHostDeviceSrdDocs returns empty without an active owner (no inheritance)', () => {
  installLocalStorage();
  setActiveHostSrdOwner(null);
  saveSrdDocForCharacter('someone-else', samplePage('slayer', 'Slayer'));
  assert.deepEqual(loadAllHostDeviceSrdDocs(), []);
});
