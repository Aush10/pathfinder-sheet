/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCharacter } from '../data/defaultCharacter';
import {
  CHARACTER_EXPORTS_FOLDER,
  createFsStorageAdapter,
  writeCharacterExportFile,
  type DirectoryHandleStore,
  type FsDirectoryHandleLike,
  type FsFileHandleLike,
  type FsFileLike,
  type FsWritableFileLike,
} from '../storage/fsAdapter';
import {
  isImportableCharacter,
  parseImportedCharacterJson,
  unwrapImportedJsonPayload,
} from './sheetExporters';

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

test('import accepts a save-tree envelope and a blank name (B16)', () => {
  const envelope = {
    format: 'pf1e-character',
    schemaVersion: 1,
    appVersion: '0.0.0',
    savedAt: '2026-11-24T12:00:00.000Z',
    sha256: 'abc',
    characterId: '11111111-1111-1111-1111-111111111111',
    data: {
      name: '',
      player: 'Alice',
      abilities: {
        STR: { name: 'STR', base: 12, raceMod: 0, levelAsiMod: 0, enhMod: 0, miscMod: 0, tempMod: 0 },
      },
      spellTables: {
        spellsPerDay: {
          kind: 'spells-per-day',
          columns: ['spd_1'],
          rows: [{ level: 1, values: { spd_1: '1' } }],
        },
      },
    },
  };
  const unwrapped = unwrapImportedJsonPayload(envelope);
  assert.equal(isImportableCharacter(unwrapped), true);
  const imported = parseImportedCharacterJson(JSON.stringify(envelope));
  assert.equal(imported.name, '');
  assert.ok(imported.abilities.STR);
  assert.equal(imported.spellTables?.spellsPerDay?.kind, 'spells-per-day');
});

test('import still rejects JSON that has no abilities object (B16)', () => {
  assert.throws(
    () => parseImportedCharacterJson(JSON.stringify({ name: 'Hero', player: 'Alice' })),
    /Invalid character sheet format/,
  );
  assert.equal(isImportableCharacter({ name: 'Hero' }), false);
});

test('loadout envelope unwrap leaves sectional payloads intact (I7)', () => {
  const loadout = {
    _format: 'PF1e-Modular-Loadout-v1',
    characterName: 'Hero',
    sections: { weapons: [{ id: 'w1', name: 'Longsword' }] },
  };
  assert.equal(unwrapImportedJsonPayload(loadout), loadout);

  const wrapped = {
    format: 'pf1e-character',
    data: loadout,
  };
  assert.deepEqual(unwrapImportedJsonPayload(wrapped), loadout);
});

test('connected-folder export writes into <character>/exports/ (I4)', async () => {
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

  const contents = JSON.stringify({ name: 'Hero', abilities: { STR: { base: 12 } } }, null, 2);
  const written = await writeCharacterExportFile({
    fileName: 'Hero_pf1e_sheet.json',
    contents,
    player: 'Alice',
    characterName: 'Hero',
    handle: root,
  });
  assert.equal(written.ok, true);
  if (!written.ok) return;
  assert.equal(written.stored, 'folder');
  if (written.stored !== 'folder') return;
  assert.equal(written.relativePath, `${CHARACTER_EXPORTS_FOLDER}/Hero_pf1e_sheet.json`);

  const file = await memoryFile(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'exports', 'Hero_pf1e_sheet.json');
  assert.equal(file.content, contents);

  const exportsDir = await memoryDirectory(root, 'AIgamesheet', 'pfmusers', 'Alice', 'Hero', 'exports');
  assert.equal(exportsDir.name, 'exports');
});

test('export helper skips when no folder is connected so callers can Blob-download (I4)', async () => {
  const skipped = await writeCharacterExportFile({
    fileName: 'Hero_pf1e_sheet.json',
    contents: '{}',
  });
  assert.equal(skipped.ok, true);
  if (!skipped.ok) return;
  assert.equal(skipped.stored, 'skipped');
});

test('export helper sanitizes path separators out of the file name', async () => {
  const root = new MemoryDirectoryHandle('save-root');
  const adapter = createFsStorageAdapter({
    folderPicker: async () => root,
    handleStore: new MemoryHandleStore(),
  });
  await adapter.pickFolderAndOpen();
  await adapter.saveCharacter('Alice', sampleCharacter('Hero', 'Alice'));

  const written = await writeCharacterExportFile({
    fileName: '..\\windows\\Hero.json',
    contents: '{}',
    player: 'Alice',
    characterName: 'Hero',
    handle: root,
  });
  assert.equal(written.ok, true);
  if (!written.ok) return;
  assert.equal(written.stored, 'folder');
  if (written.stored !== 'folder') return;
  assert.equal(written.fileName, 'Hero.json');
});
