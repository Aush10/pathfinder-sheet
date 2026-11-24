/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../../../../src/data/defaultCharacter';
import { restoreSheetFromStorage } from '../../../../src/storage/characterState';
import {
  createFsStorageAdapter,
  type DirectoryHandleStore,
  type FsDirectoryHandleLike,
  type FsFileHandleLike,
  type FsFileLike,
  type FsWritableFileLike,
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

function sample(name: string, player: string) {
  const character = createBlankCharacter();
  character.name = name;
  character.player = player;
  return character;
}

async function memoryFile(root: MemoryDirectoryHandle, ...names: string[]): Promise<MemoryFileHandle> {
  const fileName = names.pop();
  assert.ok(fileName);
  let current = root;
  for (const name of names) current = await current.getDirectoryHandle(name);
  return current.getFileHandle(fileName);
}

test('deliberate save refreshes Crash with the same checksum and characterId', async () => {
  const root = new MemoryDirectoryHandle('Chosen Storage');
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: new MemoryHandleStore(),
    now: () => new Date('2026-11-24T12:00:00.000Z'),
  });
  assert.ok((await adapter.pickFolderAndOpen()).ok);
  const hero = sample('Hero', 'Alice');
  hero.biography.notes = 'deliberate save notes';
  const saved = await adapter.saveCharacter('Alice', hero);
  assert.ok(saved.ok);
  const crash = await adapter.loadCrash();
  assert.ok(crash.ok && crash.character);
  assert.equal(crash.character?.characterId, saved.ok ? saved.characterId : '');
  const namedFile = await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'character.json');
  const crashFile = await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Crash', 'character.json');
  assert.equal(JSON.parse(namedFile.content).sha256, JSON.parse(crashFile.content).sha256);
  assert.equal(JSON.parse(crashFile.content).characterId, JSON.parse(namedFile.content).characterId);
});

test('restore ignores an older crash and a cross-character crash', async () => {
  const root = new MemoryDirectoryHandle('Chosen Storage');
  const store = new MemoryHandleStore();
  const namedAdapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: store,
    now: () => new Date('2026-11-24T09:00:00.000Z'),
  });
  assert.ok((await namedAdapter.pickFolderAndOpen()).ok);
  const named = sample('Hero', 'Alice');
  named.biography.notes = 'deliberate save notes';
  assert.ok((await namedAdapter.saveCharacter('Alice', named)).ok);

  const olderAdapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: store,
    now: () => new Date('2026-11-24T08:00:00.000Z'),
  });
  assert.ok((await olderAdapter.pickFolderAndOpen()).ok);
  assert.ok((await olderAdapter.loadCharacter('Alice', 'Hero')).ok);
  const older = sample('Hero', 'Alice');
  older.biography.notes = 'older crash notes';
  assert.ok((await olderAdapter.autosaveCrash(older)).ok);

  const restoredAfterSave = await restoreSheetFromStorage(namedAdapter);
  assert.equal(restoredAfterSave.recoveredFromCrash, false);
  assert.equal(restoredAfterSave.character?.biography.notes, 'deliberate save notes');
  assert.equal(restoredAfterSave.pendingCrash, undefined);

  const other = sample('Other', 'Bob');
  other.biography.notes = 'someone else';
  assert.ok((await namedAdapter.saveCharacter('Bob', other)).ok);
  const leftoverHero = sample('Hero', 'Alice');
  leftoverHero.biography.notes = 'stale hero crash';
  assert.ok((await namedAdapter.autosaveCrash(leftoverHero)).ok);
  const cross = await restoreSheetFromStorage(namedAdapter);
  assert.equal(cross.character?.name, 'Other');
  assert.equal(cross.recoveredFromCrash, false);
  assert.equal(cross.pendingCrash, undefined);
});

test('newer same-character crash is pending and does not silently replace the named save', async () => {
  const root = new MemoryDirectoryHandle('Chosen Storage');
  let tick = 0;
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: new MemoryHandleStore(),
    now: () => new Date(Date.UTC(2026, 10, 24, 9, 0, tick++)),
  });
  assert.ok((await adapter.pickFolderAndOpen()).ok);
  const named = sample('Control', 'aush');
  named.abilities.STR.base = 15;
  named.biography.notes = 'named save';
  assert.ok((await adapter.saveCharacter('aush', named)).ok);

  const crashSheet = sample('Control', 'aush');
  crashSheet.abilities.STR.base = 0;
  crashSheet.abilities.DEX.base = 0;
  crashSheet.abilities.CON.base = 0;
  crashSheet.abilities.INT.base = 0;
  crashSheet.abilities.WIS.base = 0;
  crashSheet.abilities.CHA.base = 0;
  crashSheet.biography.notes = 'zeroed crash';
  assert.ok((await adapter.autosaveCrash(crashSheet)).ok);

  const restored = await restoreSheetFromStorage(adapter);
  assert.equal(restored.character?.biography.notes, 'named save');
  assert.equal(restored.character?.abilities.STR.base, 15);
  assert.equal(restored.recoveredFromCrash, false);
  assert.equal(restored.pendingCrash?.character.biography.notes, 'zeroed crash');
  assert.equal(restored.pendingCrash?.character.abilities.STR.base, 0);
});

test('crash autosave skips projection rewrites and does not reuse a previous crash characterId', async () => {
  const root = new MemoryDirectoryHandle('Chosen Storage');
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: new MemoryHandleStore(),
  });
  assert.ok((await adapter.pickFolderAndOpen()).ok);
  const first = sample('Temp', 'Alice');
  const crashOne = await adapter.autosaveCrash(first);
  assert.ok(crashOne.ok);
  const named = sample('Hero', 'Alice');
  const saved = await adapter.saveCharacter('Alice', named);
  assert.ok(saved.ok);
  const crashTwo = await adapter.autosaveCrash(named);
  assert.ok(crashTwo.ok);
  if (crashOne.ok && crashTwo.ok && saved.ok) {
    assert.equal(crashTwo.characterId, saved.characterId);
    assert.notEqual(crashOne.characterId, crashTwo.characterId);
  }
  const crashDir = await root.getDirectoryHandle('AIgamesheet');
  const users = await crashDir.getDirectoryHandle('pfmusers');
  const crash = await users.getDirectoryHandle('Crash');
  const images = await crash.getDirectoryHandle('images', { create: true });
  const manifest = await images.getFileHandle('manifest.json', { create: true });
  manifest.content = 'keep-me';
  named.biography.notes = 'after';
  assert.ok((await adapter.autosaveCrash(named)).ok);
  assert.equal(manifest.content, 'keep-me', 'crash autosave must not rewrite image projections');
});

test('overlapping saveCharacter and autosaveCrash complete without a locked-file error', async () => {
  const root = new MemoryDirectoryHandle('Chosen Storage');
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: new MemoryHandleStore(),
  });
  assert.ok((await adapter.pickFolderAndOpen()).ok);
  const character = sample('Hero', 'Alice');
  const results = await Promise.all([
    adapter.saveCharacter('Alice', character),
    adapter.autosaveCrash({ ...character, biography: { ...character.biography, notes: 'a' } }),
    adapter.autosaveCrash({ ...character, biography: { ...character.biography, notes: 'b' } }),
  ]);
  for (const result of results) {
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  }
});
