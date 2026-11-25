/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../../../server/ingest/ingest.ts';
import {
  LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX,
  LEGACY_GLOBAL_HOST_SRD_INDEX_KEY,
  saveSrdDocForCharacter,
} from '../../../../src/engine/sotEngine';
import {
  HOST_SRD_INGEST_MIGRATION_KEY,
  migrateLegacyHostSrdDocsOnce,
  type DirectoryHandleStore,
  type FsDirectoryHandleLike,
  type FsFileHandleLike,
  type FsFileLike,
  type FsWritableFileLike,
  type SrdArtifactStore,
  type SrdIngestClient,
  type StoredSrdArtifactRecord,
} from '../../../../src/storage/fsAdapter';

function notFound(): Error {
  const error = new Error('Not found') as Error & { name: string; code?: string };
  error.name = 'NotFoundError';
  error.code = 'ENOENT';
  return error;
}

class MemoryFileHandle implements FsFileHandleLike {
  readonly kind = 'file' as const;
  content = '';
  constructor(readonly name: string) {}
  async getFile(): Promise<FsFileLike> {
    const text = this.content;
    return { size: new TextEncoder().encode(text).byteLength, text: async () => text };
  }
  async createWritable(): Promise<FsWritableFileLike> {
    let next = '';
    return {
      write: async (data: string) => {
        next = data;
      },
      close: async () => {
        this.content = next;
      },
    };
  }
}

class MemoryDirectoryHandle implements FsDirectoryHandleLike {
  readonly kind = 'directory' as const;
  readonly children = new Map<string, MemoryDirectoryHandle | MemoryFileHandle>();
  constructor(readonly name: string) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectoryHandle> {
    const child = this.children.get(name);
    if (child instanceof MemoryDirectoryHandle) return child;
    if (child) throw new Error(`${name} is a file`);
    if (!options?.create) throw notFound();
    const directory = new MemoryDirectoryHandle(name);
    this.children.set(name, directory);
    return directory;
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFileHandle> {
    const child = this.children.get(name);
    if (child instanceof MemoryFileHandle) return child;
    if (child) throw new Error(`${name} is a directory`);
    if (!options?.create) throw notFound();
    const file = new MemoryFileHandle(name);
    this.children.set(name, file);
    return file;
  }
  async *entries(): AsyncIterableIterator<[string, MemoryDirectoryHandle | MemoryFileHandle]> {
    for (const entry of this.children.entries()) yield entry;
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.children.delete(name)) throw notFound();
  }
  async queryPermission(): Promise<'granted'> {
    return 'granted';
  }
  async requestPermission(): Promise<'granted'> {
    return 'granted';
  }
}

class MemoryHandleStore implements DirectoryHandleStore {
  constructor(private handle?: FsDirectoryHandleLike) {}
  async get(): Promise<FsDirectoryHandleLike | undefined> {
    return this.handle;
  }
  async set(handle: FsDirectoryHandleLike): Promise<void> {
    this.handle = handle;
  }
}

class MemoryArtifactStore implements SrdArtifactStore {
  readonly records = new Map<string, StoredSrdArtifactRecord>();
  async get(key: string): Promise<StoredSrdArtifactRecord | undefined> {
    return this.records.get(key);
  }
  async set(key: string, value: StoredSrdArtifactRecord): Promise<void> {
    this.records.set(key, value);
  }
}

class MemoryLocalStorage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
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

function installLocalStorage(): MemoryLocalStorage {
  const memory = new MemoryLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memory,
  });
  return memory;
}

function ingestClient(): SrdIngestClient {
  return {
    async ingest(source) {
      const artifacts = ingestSource(source);
      return {
        documentId: artifacts['index.json'].document.id,
        title: artifacts['index.json'].document.title,
        artifacts,
      };
    },
  };
}

async function memoryFile(root: MemoryDirectoryHandle, ...names: string[]): Promise<MemoryFileHandle> {
  const fileName = names.pop();
  assert.ok(fileName);
  let current = root;
  for (const name of names) current = await current.getDirectoryHandle(name);
  return current.getFileHandle(fileName);
}

test('migrates leftover global host SRDs once without attaching them to a new sheet', async () => {
  const storage = installLocalStorage();
  const globalPage = {
    id: 'slayer',
    title: 'Slayer',
    category: 'Full Class SRD',
    htmlContent: '<h1>Slayer</h1><p>Studied Target.</p>',
    plainText: 'Slayer Studied Target.',
    isOverride: true,
    tags: [],
    updatedAt: 1,
  };
  storage.setItem(`${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}slayer`, JSON.stringify(globalPage));
  storage.setItem(LEGACY_GLOBAL_HOST_SRD_INDEX_KEY, JSON.stringify(['slayer']));

  const artifactStore = new MemoryArtifactStore();
  const first = await migrateLegacyHostSrdDocsOnce({
    characterId: 'brand-new-character',
    attachLegacyGlobals: false,
    ingestClient: ingestClient(),
    artifactStore,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.skipped, false);
  assert.equal(first.migrated, 1);
  assert.equal(storage.getItem(LEGACY_GLOBAL_HOST_SRD_INDEX_KEY), null);
  assert.equal(storage.getItem(`${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}slayer`), null);
  assert.equal(storage.getItem('pf1e_host_srd_index_brand-new-character_v1'), null);
  assert.equal(storage.getItem(`${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}brand-new-character_slayer`), null);
  assert.equal(storage.getItem(HOST_SRD_INGEST_MIGRATION_KEY), '1');
  assert.equal([...artifactStore.records.keys()].some((key) => key.startsWith('legacy-global/')), true);
  assert.equal([...artifactStore.records.values()][0]?.artifacts['text.md'].includes('Slayer'), true);

  const second = await migrateLegacyHostSrdDocsOnce({
    characterId: 'brand-new-character',
    attachLegacyGlobals: false,
    ingestClient: ingestClient(),
    artifactStore,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.skipped, true);
  assert.equal(second.migrated, 0);
});

test('migrates per-character host SRD HTML onto disk and strips localStorage bodies', async () => {
  const storage = installLocalStorage();
  const characterId = 'char-a';
  saveSrdDocForCharacter(characterId, {
    id: 'armorist',
    title: 'Armorist',
    category: 'Full Class SRD',
    htmlContent: '<h1>Armorist</h1><p>Summon armor.</p>',
    plainText: 'Armorist Summon armor.',
    isOverride: true,
    tags: [],
    updatedAt: 1,
  });
  const scopedKey = `${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}${characterId}_armorist`;
  assert.match(storage.getItem(scopedKey) || '', /Summon armor/);

  const root = new MemoryDirectoryHandle('save-root');
  const handleStore = new MemoryHandleStore(root);
  const result = await migrateLegacyHostSrdDocsOnce({
    player: 'Alice',
    characterName: 'Hero',
    characterId,
    attachLegacyGlobals: true,
    ingestClient: ingestClient(),
    handle: root,
    handleStore,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.skipped, false);
  assert.equal(result.migrated, 1);

  const stripped = JSON.parse(storage.getItem(scopedKey) || '{}') as { htmlContent?: string; plainText?: string };
  assert.equal(stripped.htmlContent, '');
  assert.equal(stripped.plainText, '');
  const text = await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'SRD', 'Armorist', 'text.md');
  assert.match(text.content, /Armorist/);
  const table = await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'SRD', 'Armorist', 'table.json');
  assert.match(table.content, /PF1E_SOT_INGEST_V1/);
});
