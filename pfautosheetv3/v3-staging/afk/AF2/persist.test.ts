/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSource } from '../../../../server/ingest/ingest.ts';
import { createBlankCharacter } from '../../../../src/data/defaultCharacter';
import {
  createFsStorageAdapter,
  ingestAndPersistSrdDocument,
  loadSrdIngestArtifacts,
  persistSrdIngestArtifacts,
  SRD_INGEST_ARTIFACT_FILES,
  type DirectoryHandleStore,
  type FsDirectoryHandleLike,
  type FsFileHandleLike,
  type FsFileLike,
  type FsWritableFileLike,
  type SrdArtifactStore,
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

async function memoryDirectory(root: MemoryDirectoryHandle, ...names: string[]): Promise<MemoryDirectoryHandle> {
  let current = root;
  for (const name of names) current = await current.getDirectoryHandle(name);
  return current;
}

async function memoryFile(root: MemoryDirectoryHandle, ...names: string[]): Promise<MemoryFileHandle> {
  const fileName = names.pop();
  assert.ok(fileName);
  return (await memoryDirectory(root, ...names)).getFileHandle(fileName);
}

function sampleCharacter(name: string, player: string) {
  const character = createBlankCharacter();
  character.name = name;
  character.player = player;
  return character;
}

const SAMPLE_HTML = `<h1>Armorist</h1><table><tr><th>Level</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th><th>Max Bonus</th></tr><tr><td>1</td><td>+0</td><td>+2</td><td>+0</td><td>+2</td><td>Summon</td><td>+1</td></tr></table>`;

test('loading an SRD writes the four ingest files under the character SRD folder', async () => {
  const root = new MemoryDirectoryHandle('save-root');
  const handleStore = new MemoryHandleStore();
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore,
    now: () => new Date('2026-11-24T12:00:00.000Z'),
  });
  const picked = await adapter.pickFolderAndOpen();
  assert.equal(picked.ok, true);
  const saved = await adapter.saveCharacter('Alice', sampleCharacter('Hero', 'Alice'));
  assert.equal(saved.ok, true);
  if (!saved.ok) return;

  const artifacts = ingestSource({ name: 'Armorist.html', content: SAMPLE_HTML });
  const persisted = await persistSrdIngestArtifacts({
    player: 'Alice',
    characterName: 'Hero',
    characterId: saved.characterId,
    artifacts,
    handle: root,
  });
  assert.equal(persisted.ok, true);
  if (!persisted.ok) return;
  assert.equal(persisted.stored, 'folder');
  assert.equal(persisted.relativePath, 'SRD/Armorist');

  const srd = await memoryDirectory(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'SRD', 'Armorist');
  for (const fileName of SRD_INGEST_ARTIFACT_FILES) {
    const file = await srd.getFileHandle(fileName);
    assert.ok(file.content.length > 0, `${fileName} should be written`);
  }
  const table = JSON.parse((await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'SRD', 'Armorist', 'table.json')).content);
  assert.equal(table.schemaVersion, 'PF1E_SOT_INGEST_V1');
  assert.equal(table.tables[0].kind, 'class-grid');

  const loaded = await loadSrdIngestArtifacts({
    player: 'Alice',
    characterName: 'Hero',
    characterId: saved.characterId,
    docFolder: 'Armorist',
    handle: root,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.stored, 'folder');
  assert.equal(loaded.artifacts['text.md'], artifacts['text.md']);
});

test('falls back to reference/IndexedDB storage when no folder is connected', async () => {
  const artifactStore = new MemoryArtifactStore();
  const artifacts = ingestSource({ name: 'Armorist.html', content: SAMPLE_HTML });
  const persisted = await persistSrdIngestArtifacts({
    characterId: 'char-offline',
    artifacts,
    artifactStore,
  });
  assert.equal(persisted.ok, true);
  if (!persisted.ok) return;
  assert.equal(persisted.stored, 'indexeddb');
  assert.equal(artifactStore.records.size, 1);
  const loaded = await loadSrdIngestArtifacts({
    characterId: 'char-offline',
    docFolder: persisted.docFolder,
    artifactStore,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.stored, 'indexeddb');
  assert.match(loaded.artifacts['text.md'], /Armorist/);
});

test('ingestAndPersistSrdDocument uses the ingest client then writes artifacts', async () => {
  const artifactStore = new MemoryArtifactStore();
  const artifacts = ingestSource({ name: 'notes.md', content: '# Rules\n\nHello.' });
  const result = await ingestAndPersistSrdDocument({
    name: 'notes.md',
    content: '# Rules\n\nHello.',
    characterId: 'char-offline',
    artifactStore,
    ingestClient: {
      async ingest() {
        return { documentId: artifacts['index.json'].document.id, title: 'Rules', artifacts };
      },
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.stored, 'indexeddb');
  assert.equal(result.title, 'Rules');
});
