import type { PF1Character } from '../types/character';
import {
  LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX,
  LEGACY_GLOBAL_HOST_SRD_INDEX_KEY,
  referenceSrdPagesForStorage,
  rehydrateSrdPagesFromHost,
} from '../engine/sotEngine';
import type {
  ActiveCharacterReference,
  LoadedCharacter,
  SaveReceipt,
  StorageAdapter,
  StorageResult,
  StorageStatus,
  StoredCharacterSummary,
  StoredPlayer,
} from './types';

/** Browser-only folder storage. Call pickFolderAndOpen from a user gesture. */
export const STORAGE_ROOT_NAME = 'AIgamesheet';
export const STORAGE_USERS_NAME = 'pfmusers';
export const STORAGE_CRASH_NAME = 'Crash';
export const CHARACTER_FILE_NAME = 'character.json';
export const ACTIVE_FILE_NAME = 'active.json';
export const CHARACTER_EXPORTS_FOLDER = 'exports';
const RESERVED_CHARACTER_FOLDER_NAMES = ['settings', 'dsl', 'backups'];

const CHARACTER_FORMAT = 'pf1e-character';
const PROJECTION_FORMAT = 'pf1e-storage-projection';
const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_APP_VERSION = '0.0.0';
const MAX_SEGMENT_LENGTH = 60;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;
const MAX_ARRAY_ITEMS = 50_000;
const MAX_OBJECT_KEYS = 20_000;
const MAX_BACKUPS_PER_FILE = 10;

const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const WINDOWS_DEVICE_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SYSTEM_FOLDER_NAMES = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'users',
  'system32',
  'appdata',
  '$recycle.bin',
  '$winreagent',
  'recovery',
  'boot',
]);

type PermissionValue = 'granted' | 'prompt' | 'denied';

export interface FsFileLike {
  size: number;
  text(): Promise<string>;
}

export interface FsWritableFileLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FsFileHandleLike {
  kind?: 'file';
  name?: string;
  getFile(): Promise<FsFileLike>;
  createWritable(): Promise<FsWritableFileLike>;
}

export interface FsDirectoryHandleLike {
  kind?: 'directory';
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandleLike>;
  entries?(): AsyncIterableIterator<[string, FsDirectoryHandleLike | FsFileHandleLike]>;
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission?(descriptor?: { mode: 'readwrite' }): Promise<PermissionValue>;
  requestPermission?(descriptor?: { mode: 'readwrite' }): Promise<PermissionValue>;
}

export interface DirectoryHandleStore {
  get(): Promise<FsDirectoryHandleLike | undefined>;
  set(handle: FsDirectoryHandleLike): Promise<void>;
}

export interface FsStorageAdapterOptions {
  folderPicker?: (options?: { mode: 'readwrite' }) => Promise<FsDirectoryHandleLike>;
  handleStore?: DirectoryHandleStore;
  appVersion?: string;
  schemaVersion?: number;
  now?: () => Date;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface StoredEnvelope {
  format: string;
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  sha256: string;
  characterId?: string;
  data: JsonValue;
}

interface CharacterLayout {
  root: FsDirectoryHandleLike;
  images: FsDirectoryHandleLike;
  dslMacros: FsDirectoryHandleLike;
  dslStepper: FsDirectoryHandleLike;
  dslXdx: FsDirectoryHandleLike;
  srd: FsDirectoryHandleLike;
  ai: FsDirectoryHandleLike;
  aiReadOnly: FsDirectoryHandleLike;
  notebook: FsDirectoryHandleLike;
  tools: FsDirectoryHandleLike;
  modules: FsDirectoryHandleLike;
  backups: FsDirectoryHandleLike;
  exports: FsDirectoryHandleLike;
}

class StorageFault extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StorageFault';
  }
}

function failure(code: string, message: string): StorageResult<never> {
  return { ok: false, error: { code, message } };
}

function toFailure(error: unknown, operation: 'picker' | 'storage' = 'storage'): StorageResult<never> {
  if (error instanceof StorageFault) {
    return failure(error.code, error.message);
  }
  const name = error instanceof Error || isRecord(error) ? error.name : undefined;
  const message = error instanceof Error || isRecord(error) ? error.message : undefined;
  if (typeof message === 'string' && message.includes('Page.setInterceptFileChooserDialog')) {
    return failure(
      'FILE_PICKER_BLOCKED',
      'This browser blocked the folder picker while the page is shared with an agent. Stop sharing the page and try again, or open the app in Edge or Chrome. Export JSON first to move this sheet to another browser.',
    );
  }
  if (name === 'AbortError' && operation === 'picker') {
    return failure('PICKER_CANCELLED', 'Folder selection was cancelled.');
  }
  if (name === 'AbortError') {
    return failure('OPERATION_ABORTED', 'The folder operation was interrupted before it finished. Reconnect the folder and try again.');
  }
  if (name === 'NotAllowedError') {
    return failure('PERMISSION_DENIED', 'Folder access was denied. Reconnect the save folder and allow read/write access.');
  }
  if (name === 'SecurityError') {
    return failure('SECURITY_ERROR', 'The browser blocked folder access. Open the app directly in Edge or Chrome and choose the folder from the Save button.');
  }
  if (name === 'NotFoundError') {
    return failure('NOT_FOUND', 'The save folder or file is no longer available. Reconnect the save folder.');
  }
  if (name === 'QuotaExceededError') {
    return failure('STORAGE_FULL', 'Storage is full. Free some space and try saving again.');
  }
  if (name === 'NoModificationAllowedError' || name === 'InvalidStateError') {
    return failure('FILE_UNAVAILABLE', 'The save file is locked or unavailable. Close other apps using it and try again.');
  }
  return failure('STORAGE_ERROR', 'The folder storage operation could not be completed.');
}

function assert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new StorageFault(code, message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && (error.name === 'NotFoundError' || error.code === 'ENOENT');
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const providerCredential = /(?:openai|gemini|google|anthropic|claude|azure|mistral|cohere|groq|together|deepseek)(?:api)?(?:key|token)$/;
  return (
    normalized === 'env' ||
    normalized === 'environment' ||
    normalized === 'processenv' ||
    normalized === 'envvars' ||
    normalized === 'environmentvariables' ||
    normalized === 'environmentvalues' ||
    normalized.startsWith('sessionstorage') ||
    normalized === 'token' ||
    normalized === 'accesstoken' ||
    normalized === 'authtoken' ||
    normalized === 'apitoken' ||
    normalized === 'aikey' ||
    normalized === 'key' ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('aikey') ||
    normalized.endsWith('apitoken') ||
    normalized.endsWith('authtoken') ||
    providerCredential.test(normalized) ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('credential') ||
    normalized === 'authorization'
  );
}

/** Produces one Windows-safe folder segment; it never resolves a path. */
export function sanitizePathSegment(value: string): string | null {
  if (typeof value !== 'string') return null;

  const stripped = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '')
    .replace(/(?:\.\.)+/g, '')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, MAX_SEGMENT_LENGTH)
    .replace(/[. ]+$/g, '');

  const baseName = stripped.split('.')[0].replace(/[. ]+$/g, '');
  return !stripped || WINDOWS_DEVICE_NAME.test(stripped) || WINDOWS_DEVICE_BASENAME.test(baseName) ? null : stripped;
}

function isSafeStoredSegment(value: string): boolean {
  return sanitizePathSegment(value) === value;
}

function assertAllowedEntityName(value: string, scope: 'player' | 'character'): string {
  const safe = sanitizePathSegment(value);
  assert(safe, 'INVALID_NAME', 'Use a non-empty player or character name that is valid for a Windows folder.');
  if (scope === 'player' && safe.toLowerCase() === STORAGE_CRASH_NAME.toLowerCase()) {
    throw new StorageFault('RESERVED_NAME', '"Crash" is reserved for recovery data and cannot be a player folder.');
  }
  if (scope === 'character' && RESERVED_CHARACTER_FOLDER_NAMES.includes(safe.toLowerCase())) {
    throw new StorageFault('RESERVED_NAME', 'This character name is reserved by the storage layout.');
  }
  return safe;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

function cloneForStorage(value: unknown, depth = 0, nodes = { count: 0 }): JsonValue {
  assert(depth <= MAX_JSON_DEPTH, 'DATA_TOO_DEEP', 'Saved data is nested too deeply.');
  nodes.count += 1;
  assert(nodes.count <= MAX_JSON_NODES, 'DATA_TOO_LARGE', 'Saved data contains too many values.');

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    assert(Number.isFinite(value), 'INVALID_DATA', 'Saved data contains an invalid number.');
    return value;
  }
  if (Array.isArray(value)) {
    assert(value.length <= MAX_ARRAY_ITEMS, 'DATA_TOO_LARGE', 'Saved data contains an oversized list.');
    return value.map((item) => cloneForStorage(item, depth + 1, nodes));
  }

  assert(isRecord(value), 'INVALID_DATA', 'Saved data must be plain JSON-compatible data.');
  const keys = Object.keys(value);
  assert(keys.length <= MAX_OBJECT_KEYS, 'DATA_TOO_LARGE', 'Saved data contains an oversized object.');
  const output: { [key: string]: JsonValue } = Object.create(null) as { [key: string]: JsonValue };
  for (const key of keys) {
    assert(!FORBIDDEN_JSON_KEYS.has(key), 'UNSAFE_DATA', `Saved data contains a forbidden key: ${key}.`);
    // Do not persist credentials, environment values, or browser session data.
    if (isSensitiveKey(key)) continue;
    const item = value[key];
    if (typeof item !== 'undefined') output[key] = cloneForStorage(item, depth + 1, nodes);
  }
  return output;
}

function validateLoadedJson(value: unknown, depth = 0, nodes = { count: 0 }): asserts value is JsonValue {
  assert(depth <= MAX_JSON_DEPTH, 'DATA_TOO_DEEP', 'The stored JSON is nested too deeply.');
  nodes.count += 1;
  assert(nodes.count <= MAX_JSON_NODES, 'DATA_TOO_LARGE', 'The stored JSON contains too many values.');

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    assert(Number.isFinite(value), 'INVALID_DATA', 'The stored JSON contains an invalid number.');
    return;
  }
  if (Array.isArray(value)) {
    assert(value.length <= MAX_ARRAY_ITEMS, 'DATA_TOO_LARGE', 'The stored JSON contains an oversized list.');
    for (const item of value) validateLoadedJson(item, depth + 1, nodes);
    return;
  }

  assert(isRecord(value), 'INVALID_DATA', 'The stored JSON has an unsupported value.');
  const keys = Object.keys(value);
  assert(keys.length <= MAX_OBJECT_KEYS, 'DATA_TOO_LARGE', 'The stored JSON contains an oversized object.');
  for (const key of keys) {
    assert(!FORBIDDEN_JSON_KEYS.has(key), 'UNSAFE_DATA', `The stored JSON contains a forbidden key: ${key}.`);
    validateLoadedJson(value[key], depth + 1, nodes);
  }
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function assertFileSize(text: string): void {
  assert(encodeUtf8(text).byteLength <= MAX_FILE_BYTES, 'FILE_TOO_LARGE', 'The storage file exceeds the 5 MiB safety limit.');
}

async function sha256(value: JsonValue): Promise<string> {
  const cryptoApi = globalThis.crypto;
  assert(cryptoApi?.subtle, 'CRYPTO_UNAVAILABLE', 'Web Crypto is required to verify saved data.');
  const encoded = encodeUtf8(canonicalJson(value));
  const bytes = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(bytes).set(encoded);
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createCharacterId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  assert(cryptoApi?.getRandomValues, 'CRYPTO_UNAVAILABLE', 'Web Crypto is required to create a character ID.');
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

const FOLDER_STORAGE_DB_NAME = 'pf1e-folder-storage';
const FOLDER_STORAGE_DB_VERSION = 2;

function openFolderStorageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FOLDER_STORAGE_DB_NAME, FOLDER_STORAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('handles')) {
        request.result.createObjectStore('handles');
      }
      if (!request.result.objectStoreNames.contains('srdArtifacts')) {
        request.result.createObjectStore('srdArtifacts');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbHandleStore(): DirectoryHandleStore {
  return {
    async get(): Promise<FsDirectoryHandleLike | undefined> {
      if (typeof indexedDB === 'undefined') return undefined;
      const database = await openFolderStorageDatabase();
      try {
        const transaction = database.transaction('handles', 'readonly');
        const value = await requestToPromise(transaction.objectStore('handles').get('root'));
        await transactionToPromise(transaction);
        return value as FsDirectoryHandleLike | undefined;
      } finally {
        database.close();
      }
    },
    async set(handle: FsDirectoryHandleLike): Promise<void> {
      assert(typeof indexedDB !== 'undefined', 'INDEXED_DB_UNAVAILABLE', 'IndexedDB is required to remember the selected folder.');
      const database = await openFolderStorageDatabase();
      try {
        const transaction = database.transaction('handles', 'readwrite');
        transaction.objectStore('handles').put(handle, 'root');
        await transactionToPromise(transaction);
      } finally {
        database.close();
      }
    },
  };
}

async function listEntries(directory: FsDirectoryHandleLike): Promise<Array<[string, FsDirectoryHandleLike | FsFileHandleLike]>> {
  assert(directory.entries, 'API_UNSUPPORTED', 'This browser does not support directory enumeration. Use current Edge or Chrome.');
  const entries: Array<[string, FsDirectoryHandleLike | FsFileHandleLike]> = [];
  for await (const entry of directory.entries()) entries.push(entry);
  return entries;
}

function isDirectoryHandle(handle: FsDirectoryHandleLike | FsFileHandleLike): handle is FsDirectoryHandleLike {
  return handle.kind === undefined || handle.kind === 'directory';
}

async function getInternalDirectory(
  parent: FsDirectoryHandleLike,
  desiredName: string,
  create: boolean,
): Promise<FsDirectoryHandleLike> {
  const matches = (await listEntries(parent)).filter(
    ([name, handle]) => isSafeStoredSegment(name) && name.toLowerCase() === desiredName.toLowerCase() && isDirectoryHandle(handle),
  );
  assert(matches.length <= 1, 'NAME_COLLISION', `More than one folder matches ${desiredName}.`);
  if (matches.length === 1) return parent.getDirectoryHandle(matches[0][0]);
  assert(create, 'NOT_FOUND', `The ${desiredName} folder does not exist.`);
  return parent.getDirectoryHandle(desiredName, { create: true });
}

async function getNamedDirectory(
  parent: FsDirectoryHandleLike,
  rawName: string,
  scope: 'player' | 'character',
  create: boolean,
): Promise<{ directory: FsDirectoryHandleLike; name: string }> {
  const safeName = assertAllowedEntityName(rawName, scope);
  const matches = (await listEntries(parent)).filter(
    ([name, handle]) => isSafeStoredSegment(name) && name.toLowerCase() === safeName.toLowerCase() && isDirectoryHandle(handle),
  );
  assert(matches.length <= 1, 'NAME_COLLISION', `More than one folder matches "${safeName}".`);

  if (matches.length === 1) {
    assert(
      matches[0][0] === safeName,
      'NAME_COLLISION',
      `"${safeName}" collides with the existing folder "${matches[0][0]}". Folder names are case-insensitive.`,
    );
    return { directory: await parent.getDirectoryHandle(matches[0][0]), name: safeName };
  }

  assert(create, 'NOT_FOUND', `No ${scope} named "${safeName}" exists.`);
  return { directory: await parent.getDirectoryHandle(safeName, { create: true }), name: safeName };
}

function assertSelectableRootName(name: string): void {
  const normalized = name.trim().toLowerCase();
  assert(normalized.length > 0, 'UNSAFE_ROOT', 'Do not select a drive root. Choose an empty folder or an AIgamesheet folder.');
  assert(!/^[a-z]:[\\/]*$/i.test(normalized), 'UNSAFE_ROOT', 'Do not select a drive root. Choose an empty folder or an AIgamesheet folder.');
  assert(!SYSTEM_FOLDER_NAMES.has(normalized), 'UNSAFE_ROOT', 'Do not select a system folder. Choose an empty folder or an AIgamesheet folder.');
}

async function getManagedRoot(selectedRoot: FsDirectoryHandleLike, create: boolean): Promise<FsDirectoryHandleLike> {
  assertSelectableRootName(selectedRoot.name);
  if (selectedRoot.name.toLowerCase() === STORAGE_ROOT_NAME.toLowerCase()) return selectedRoot;

  const entries = await listEntries(selectedRoot);
  const appFolders = entries.filter(
    ([name, handle]) => isSafeStoredSegment(name) && name.toLowerCase() === STORAGE_ROOT_NAME.toLowerCase() && isDirectoryHandle(handle),
  );
  assert(appFolders.length <= 1, 'NAME_COLLISION', 'The selected folder contains conflicting AIgamesheet folders.');
  if (appFolders.length === 1) return selectedRoot.getDirectoryHandle(appFolders[0][0]);

  assert(entries.length === 0, 'UNSAFE_ROOT', 'Choose an empty folder, or a folder that already contains AIgamesheet.');
  assert(create, 'NOT_FOUND', 'The selected folder has no AIgamesheet directory.');
  return selectedRoot.getDirectoryHandle(STORAGE_ROOT_NAME, { create: true });
}

async function ensureCharacterLayout(root: FsDirectoryHandleLike): Promise<CharacterLayout> {
  const images = await getInternalDirectory(root, 'images', true);
  const dsl = await getInternalDirectory(root, 'DSL', true);
  const dslMacros = await getInternalDirectory(dsl, 'macros', true);
  const dslStepper = await getInternalDirectory(dsl, 'stepper', true);
  const dslXdx = await getInternalDirectory(dsl, 'xdx', true);
  const srd = await getInternalDirectory(root, 'SRD', true);
  const ai = await getInternalDirectory(root, 'AI', true);
  const aiReadOnly = await getInternalDirectory(ai, 'read_only', true);
  const notebook = await getInternalDirectory(root, 'notebook', true);
  const tools = await getInternalDirectory(root, 'tools', true);
  const modules = await getInternalDirectory(root, 'Modules', true);
  const backups = await getInternalDirectory(root, 'backups', true);
  const exportsDir = await getInternalDirectory(root, CHARACTER_EXPORTS_FOLDER, true);
  return { root, images, dslMacros, dslStepper, dslXdx, srd, ai, aiReadOnly, notebook, tools, modules, backups, exports: exportsDir };
}

async function ensureBaseTree(selectedRoot: FsDirectoryHandleLike): Promise<{
  managedRoot: FsDirectoryHandleLike;
  users: FsDirectoryHandleLike;
  crash: CharacterLayout;
}> {
  const managedRoot = await getManagedRoot(selectedRoot, true);
  const users = await getInternalDirectory(managedRoot, STORAGE_USERS_NAME, true);
  const crashRoot = await getInternalDirectory(users, STORAGE_CRASH_NAME, true);
  return { managedRoot, users, crash: await ensureCharacterLayout(crashRoot) };
}

function assertSafeFileName(name: string): void {
  assert(sanitizePathSegment(name) === name, 'UNSAFE_PATH', 'Storage attempted to use an unsafe file name.');
}

async function readTextFromFile(handle: FsFileHandleLike): Promise<string> {
  const file = await handle.getFile();
  assert(file.size <= MAX_FILE_BYTES, 'FILE_TOO_LARGE', 'The storage file exceeds the 5 MiB safety limit.');
  const text = await file.text();
  assertFileSize(text);
  return text;
}

async function readTextIfPresent(directory: FsDirectoryHandleLike, fileName: string): Promise<string | null> {
  assertSafeFileName(fileName);
  try {
    return await readTextFromFile(await directory.getFileHandle(fileName));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function writeDirect(directory: FsDirectoryHandleLike, fileName: string, text: string): Promise<void> {
  assertSafeFileName(fileName);
  assertFileSize(text);
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    try {
      await writable.close();
    } catch {
      // The original error is more useful than a close failure.
    }
    throw error;
  }
}

function backupFileName(backupKey: string, sequence: number): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return `${backupKey}.${timestamp}.${sequence.toString().padStart(4, '0')}.bak`;
}

async function trimBackups(backupDirectory: FsDirectoryHandleLike, backupKey: string): Promise<void> {
  const backups = (await listEntries(backupDirectory))
    .filter(([name, handle]) => !isDirectoryHandle(handle) && name.startsWith(`${backupKey}.`) && name.endsWith('.bak'))
    .map(([name]) => name)
    .sort();
  const excess = backups.length - MAX_BACKUPS_PER_FILE;
  if (excess <= 0) return;
  assert(backupDirectory.removeEntry, 'API_UNSUPPORTED', 'This browser cannot prune old backups.');
  for (const name of backups.slice(0, excess)) await backupDirectory.removeEntry(name);
}

interface BackupEnvelopeOptions {
  format: string;
  schemaVersion: number;
  appVersion: string;
}

async function sanitizedEnvelopeBackup(text: string, options: BackupEnvelopeOptions): Promise<string | null> {
  try {
    const prior = await parseEnvelope(text, options.format, options.schemaVersion);
    const safeData = cloneForStorage(prior.data);
    const safeCharacterId =
      options.format === CHARACTER_FORMAT && typeof prior.characterId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prior.characterId)
        ? prior.characterId
        : options.format === CHARACTER_FORMAT
          ? createCharacterId()
          : undefined;
    const safeEnvelope = await createEnvelope(
      options.format,
      safeData,
      options.schemaVersion,
      options.appVersion,
      new Date().toISOString(),
      safeCharacterId,
    );
    return JSON.stringify(safeEnvelope, null, 2);
  } catch {
    // Never turn malformed or untrusted raw text into a backup. Character data
    // remains protected by the previous valid backup, if one exists.
    return null;
  }
}

async function writeSafely(
  directory: FsDirectoryHandleLike,
  fileName: string,
  text: string,
  backupDirectory: FsDirectoryHandleLike,
  backupKey = fileName,
  backupEnvelope?: BackupEnvelopeOptions,
): Promise<void> {
  assertSafeFileName(fileName);
  assertSafeFileName(backupKey);
  const temporaryName = `${fileName}.tmp`;
  assertSafeFileName(temporaryName);

  await writeDirect(directory, temporaryName, text);
  const temporaryText = await readTextIfPresent(directory, temporaryName);
  assert(temporaryText === text, 'VERIFY_FAILED', `Temporary ${fileName} verification failed.`);

  const priorText = await readTextIfPresent(directory, fileName);
  const safePriorText = priorText !== null && backupEnvelope ? await sanitizedEnvelopeBackup(priorText, backupEnvelope) : null;
  if (safePriorText !== null) {
    let sequence = 0;
    let candidate = backupFileName(backupKey, sequence);
    while ((await readTextIfPresent(backupDirectory, candidate)) !== null) {
      sequence += 1;
      candidate = backupFileName(backupKey, sequence);
    }
    await writeDirect(backupDirectory, candidate, safePriorText);
    const verifiedBackup = await readTextIfPresent(backupDirectory, candidate);
    assert(verifiedBackup === safePriorText, 'VERIFY_FAILED', `Backup ${fileName} verification failed.`);
  }

  await writeDirect(directory, fileName, text);
  const finalText = await readTextIfPresent(directory, fileName);
  assert(finalText === text, 'VERIFY_FAILED', `${fileName} verification failed.`);
  assert(directory.removeEntry, 'API_UNSUPPORTED', 'This browser cannot remove temporary storage files.');
  await directory.removeEntry(temporaryName);
  await trimBackups(backupDirectory, backupKey);
}

function parseUntrustedJson(text: string): JsonValue {
  assertFileSize(text);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new StorageFault('INVALID_JSON', 'A storage JSON file is malformed.');
  }
  validateLoadedJson(value);
  return value;
}

async function createEnvelope(
  format: string,
  data: JsonValue,
  schemaVersion: number,
  appVersion: string,
  savedAt: string,
  characterId?: string,
): Promise<StoredEnvelope> {
  return {
    format,
    schemaVersion,
    appVersion,
    savedAt,
    sha256: await sha256(data),
    ...(characterId ? { characterId } : {}),
    data,
  };
}

async function parseEnvelope(text: string, expectedFormat: string, schemaVersion: number): Promise<StoredEnvelope> {
  const value = parseUntrustedJson(text);
  assert(isRecord(value), 'INVALID_ENVELOPE', 'The storage file does not contain a valid data envelope.');
  const format = value.format;
  const storedVersion = value.schemaVersion;
  const appVersion = value.appVersion;
  const savedAt = value.savedAt;
  const checksum = value.sha256;
  const data = value.data;
  assert(format === expectedFormat, 'INVALID_ENVELOPE', 'The storage file has an unexpected format.');
  assert(storedVersion === schemaVersion, 'UNSUPPORTED_VERSION', 'The storage file uses an unsupported schema version.');
  assert(typeof appVersion === 'string' && typeof savedAt === 'string', 'INVALID_ENVELOPE', 'The storage file metadata is invalid.');
  assert(typeof checksum === 'string' && /^[a-f0-9]{64}$/i.test(checksum), 'INVALID_ENVELOPE', 'The storage checksum is invalid.');
  validateLoadedJson(data);
  assert((await sha256(data)) === checksum, 'CHECKSUM_MISMATCH', 'The storage file failed its integrity check.');

  const characterId = value.characterId;
  if (expectedFormat === CHARACTER_FORMAT) {
    assert(typeof characterId === 'string' && characterId.length > 0 && characterId.length <= 128, 'INVALID_ENVELOPE', 'The character ID is invalid.');
  }
  return { format, schemaVersion: storedVersion, appVersion, savedAt, sha256: checksum, data, ...(typeof characterId === 'string' ? { characterId } : {}) };
}

function characterFromEnvelope(envelope: StoredEnvelope): LoadedCharacter {
  assert(isRecord(envelope.data), 'INVALID_CHARACTER', 'The stored character is not an object.');
  assert(typeof envelope.data.name === 'string' && typeof envelope.data.player === 'string', 'INVALID_CHARACTER', 'The stored character is missing its identity fields.');
  // A fresh JSON-only clone removes any manually injected sensitive fields before returning it to UI code.
  const cloned = cloneForStorage(envelope.data) as unknown as PF1Character;
  const characterId = envelope.characterId as string;
  return {
    character: rehydrateSrdPagesFromHost(cloned, characterId),
    characterId,
    savedAt: envelope.savedAt,
    sha256: envelope.sha256,
  };
}

async function readCharacterEnvelopeIfPresent(
  directory: FsDirectoryHandleLike,
  schemaVersion: number,
): Promise<StoredEnvelope | null> {
  const text = await readTextIfPresent(directory, CHARACTER_FILE_NAME);
  return text === null ? null : parseEnvelope(text, CHARACTER_FORMAT, schemaVersion);
}

async function readProjectionIfPresent(
  directory: FsDirectoryHandleLike,
  fileName: string,
  schemaVersion: number,
): Promise<JsonValue | null> {
  const text = await readTextIfPresent(directory, fileName);
  if (text === null) return null;
  return (await parseEnvelope(text, PROJECTION_FORMAT, schemaVersion)).data;
}

async function writeProjection(
  directory: FsDirectoryHandleLike,
  fileName: string,
  data: unknown,
  backupDirectory: FsDirectoryHandleLike,
  schemaVersion: number,
  appVersion: string,
  savedAt: string,
  backupKey = fileName,
): Promise<void> {
  const safeData = cloneForStorage(data);
  const envelope = await createEnvelope(PROJECTION_FORMAT, safeData, schemaVersion, appVersion, savedAt);
  await writeSafely(
    directory,
    fileName,
    JSON.stringify(envelope, null, 2),
    backupDirectory,
    backupKey,
    { format: PROJECTION_FORMAT, schemaVersion, appVersion },
  );
}

/** Escape dynamic text before placing it in the printable HTML export. */
export function escapePrintableText(value: string): string {
  // Escaping every '<' also neutralizes '<!--' and '</script>'; separators are
  // encoded so they cannot terminate a JavaScript/string context if exported.
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\u2028/g, '&#8232;')
    .replace(/\u2029/g, '&#8233;');
}

function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

function printableNotes(character: PF1Character): string {
  const biography: Record<string, unknown> = isRecord(character.biography) ? character.biography : {};
  const characterBio: Record<string, unknown> = isRecord(character.characterBio) ? character.characterBio : {};
  const journals = Array.isArray(character.journal) ? character.journal : [];
  const journalText = journals
    .map((entry) => {
      if (!isRecord(entry)) return '';
      return [plainText(entry.title), plainText(entry.sessionDate), plainText(entry.content)].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

  return [
    plainText(biography.description),
    plainText(biography.personality),
    plainText(biography.traits),
    plainText(biography.flaws),
    plainText(biography.allies),
    plainText(biography.enemies),
    plainText(biography.notes),
    plainText(characterBio.scratchpad),
    journalText,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function renderPrintableSheet(character: PF1Character): string {
  const name = escapePrintableText(plainText(character.name));
  const player = escapePrintableText(plainText(character.player));
  const characterClass = escapePrintableText(plainText(character.characterClass));
  const level = escapePrintableText(plainText(character.level));
  const race = escapePrintableText(plainText(character.race));
  const notes = escapePrintableText(printableNotes(character));

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name || 'Character sheet'}</title>
<style>body{font-family:system-ui,sans-serif;max-width:8.5in;margin:0 auto;padding:1in;color:#111}dl{display:grid;grid-template-columns:10rem 1fr;gap:.35rem}dt{font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@media print{body{padding:0}}</style></head>
<body><h1>${name || 'Character sheet'}</h1><dl><dt>Player</dt><dd>${player}</dd><dt>Class</dt><dd>${characterClass}</dd><dt>Level</dt><dd>${level}</dd><dt>Race</dt><dd>${race}</dd></dl><h2>Notes &amp; journal</h2><pre>${notes}</pre></body>
</html>`;
}

function csvCell(value: unknown): string {
  return `"${plainText(value).replace(/"/g, '""')}"`;
}

function renderIndexCsv(character: PF1Character, characterId: string, savedAt: string): string {
  return [
    'characterId,name,player,class,level,race,savedAt',
    [characterId, character.name, character.player, character.characterClass, character.level, character.race, savedAt].map(csvCell).join(','),
  ].join('\r\n');
}

function getArrayProjection(data: JsonValue | null, property: string): JsonValue[] {
  return isRecord(data) && Array.isArray(data[property]) ? data[property] : [];
}

function mergeProjectionArray(previous: JsonValue[], current: JsonValue[]): JsonValue[] {
  const merged = new Map<string, JsonValue>();
  for (const item of previous) merged.set(canonicalJson(item), item);
  for (const item of current) merged.set(canonicalJson(item), item);
  return Array.from(merged.values());
}

async function writePlayerData(
  playerDirectory: FsDirectoryHandleLike,
  playerName: string,
  character: PF1Character,
  schemaVersion: number,
  appVersion: string,
  savedAt: string,
): Promise<void> {
  const settings = await getInternalDirectory(playerDirectory, 'settings', true);
  const dsl = await getInternalDirectory(playerDirectory, 'dsl', true);
  const playerBackups = await getInternalDirectory(playerDirectory, 'backups', true);
  // Validate shared untrusted data before changing any player projection.
  const existingMacros = await readProjectionIfPresent(dsl, 'macros.json', schemaVersion);
  const existingXdx = await readProjectionIfPresent(dsl, 'xdx.json', schemaVersion);
  const customObjects = cloneForStorage(character.customObjects ?? []);
  const xdxMacros = cloneForStorage(character.xdxMacros ?? []);
  await writeProjection(settings, 'storage.json', { player: playerName }, playerBackups, schemaVersion, appVersion, savedAt, 'settings-storage.json');
  await writeProjection(
    dsl,
    'macros.json',
    { customObjects: mergeProjectionArray(getArrayProjection(existingMacros, 'customObjects'), Array.isArray(customObjects) ? customObjects : []) },
    playerBackups,
    schemaVersion,
    appVersion,
    savedAt,
    'dsl-macros.json',
  );
  await writeProjection(
    dsl,
    'xdx.json',
    { xdxMacros: mergeProjectionArray(getArrayProjection(existingXdx, 'xdxMacros'), Array.isArray(xdxMacros) ? xdxMacros : []) },
    playerBackups,
    schemaVersion,
    appVersion,
    savedAt,
    'dsl-xdx.json',
  );
}

async function rewriteAiReadOnlyDirectory(directory: FsDirectoryHandleLike): Promise<void> {
  const entries = await listEntries(directory);
  const staleEntries = entries.filter(([name]) => name !== 'README.txt');
  if (staleEntries.length === 0) return;
  assert(directory.removeEntry, 'API_UNSUPPORTED', 'This browser cannot refresh AI/read_only safely.');
  for (const [name] of staleEntries) {
    // Entry names from a picked folder are still untrusted; do not use an
    // unsafe one as a child path.
    assert(isSafeStoredSegment(name), 'UNSAFE_PATH', 'AI/read_only contains an unsafe entry name.');
    await directory.removeEntry(name, { recursive: true });
  }
}

async function writeCharacterTree(
  layout: CharacterLayout,
  character: PF1Character,
  envelope: StoredEnvelope,
  schemaVersion: number,
  appVersion: string,
  savedAt: string,
  options?: { skipProjections?: boolean },
): Promise<void> {
  const characterId = envelope.characterId as string;
  if (!options?.skipProjections) {
    await writeProjection(layout.images, 'manifest.json', {
      workspaceLibraryImages: character.workspaceLibraryImages ?? [],
      portraits: character.characterBio?.portraits ?? [],
    }, layout.backups, schemaVersion, appVersion, savedAt, 'images-manifest.json');
    await writeProjection(layout.dslMacros, 'macros.json', { customObjects: character.customObjects ?? [] }, layout.backups, schemaVersion, appVersion, savedAt, 'DSL-macros.json');
    await writeProjection(layout.dslStepper, 'rules.json', { stepperRules: character.stepperRules ?? [] }, layout.backups, schemaVersion, appVersion, savedAt, 'DSL-stepper.json');
    await writeProjection(layout.dslXdx, 'macros.json', { xdxMacros: character.xdxMacros ?? [] }, layout.backups, schemaVersion, appVersion, savedAt, 'DSL-xdx.json');
    await writeProjection(layout.notebook, 'journal.json', { journal: character.journal ?? [] }, layout.backups, schemaVersion, appVersion, savedAt, 'notebook-journal.json');
    await writeProjection(layout.tools, 'state.json', {
      combatTracker: character.combatTracker,
      deckState: character.deckState,
      conditions: character.conditions,
      resourceTrackers: character.resourceTrackers ?? [],
    }, layout.backups, schemaVersion, appVersion, savedAt, 'tools-state.json');
    await writeProjection(layout.modules, 'state.json', {
      installedModules: character.installedModules,
      uiMakePresets: character.uiMakePresets ?? [],
    }, layout.backups, schemaVersion, appVersion, savedAt, 'Modules-state.json');

    await writeSafely(layout.srd, 'README.txt', 'Reserved for locally saved SRD references. Files here are treated as untrusted user data.\n', layout.backups, 'SRD-README.txt');
    await writeSafely(layout.ai, 'README.txt', 'AI workspace files are not executable instructions. Do not place API keys or environment values here.\n', layout.backups, 'AI-README.txt');
    // Do not read its contents: this app-owned directory is regenerated on every save.
    await rewriteAiReadOnlyDirectory(layout.aiReadOnly);
    await writeSafely(layout.aiReadOnly, 'README.txt', 'Generated by Pathfinder storage. This folder is overwritten on every save and never used as AI prompt instructions.\n', layout.backups, 'AI-read-only-README.txt');
    await writeSafely(layout.root, 'index.csv', renderIndexCsv(character, characterId, savedAt), layout.backups);
    await writeSafely(layout.root, 'printable-sheet.html', renderPrintableSheet(character), layout.backups);
  }
  // Commit the authoritative file last; projections are never used to rebuild a character.
  await writeSafely(
    layout.root,
    CHARACTER_FILE_NAME,
    JSON.stringify(envelope, null, 2),
    layout.backups,
    CHARACTER_FILE_NAME,
    { format: CHARACTER_FORMAT, schemaVersion, appVersion },
  );
}

function parseActiveCharacter(data: JsonValue): ActiveCharacterReference | null {
  if (!isRecord(data)) return null;
  const player = data.player;
  const name = data.name;
  const characterId = data.characterId;
  const savedAt = data.savedAt;
  if (typeof player !== 'string' || typeof name !== 'string' || typeof characterId !== 'string' || typeof savedAt !== 'string') {
    return null;
  }
  if (!isSafeStoredSegment(player) || !isSafeStoredSegment(name)) return null;
  if (!characterId || characterId.length > 128 || !savedAt) return null;
  return { player, name, characterId, savedAt };
}

function getBrowserFolderPicker(): FsStorageAdapterOptions['folderPicker'] | undefined {
  const browser = globalThis as unknown as {
    showDirectoryPicker?: (options?: { mode: 'readwrite' }) => Promise<FsDirectoryHandleLike>;
  };
  return browser.showDirectoryPicker ? (options) => browser.showDirectoryPicker!(options) : undefined;
}

async function ensureReadWritePermission(handle: FsDirectoryHandleLike): Promise<void> {
  const descriptor = { mode: 'readwrite' as const };
  const current = handle.queryPermission ? await handle.queryPermission(descriptor) : undefined;
  if (current === 'granted') return;
  if (handle.requestPermission) {
    const requested = await handle.requestPermission(descriptor);
    if (requested === 'granted') return;
  }
  if (!handle.queryPermission && !handle.requestPermission) return;
  throw new StorageFault('PERMISSION_DENIED', 'Read/write permission for the selected folder was not granted.');
}

function publicPermission(value: PermissionValue | undefined): StorageStatus['permission'] {
  return value ?? 'unknown';
}

function safeDirectoryNames(
  entries: Array<[string, FsDirectoryHandleLike | FsFileHandleLike]>,
  excludedNames: string[] = [],
): string[] {
  const excluded = new Set(excludedNames.map((name) => name.toLowerCase()));
  const seen = new Map<string, string>();
  const names: string[] = [];
  for (const [name, handle] of entries) {
    if (!isDirectoryHandle(handle) || !isSafeStoredSegment(name) || excluded.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    const previous = seen.get(key);
    assert(!previous || previous === name, 'NAME_COLLISION', `Storage contains case-insensitive folder collisions for "${name}".`);
    seen.set(key, name);
    names.push(name);
  }
  return names.sort((left, right) => left.localeCompare(right));
}

export const SRD_INGEST_ARTIFACT_FILES = ['table.json', 'links.json', 'text.md', 'index.json'] as const;
export type SrdIngestArtifactFile = (typeof SRD_INGEST_ARTIFACT_FILES)[number];
export const HOST_SRD_INGEST_MIGRATION_KEY = 'pf1e_host_srd_migrated_to_ingest_v1';
const RESERVED_SRD_DOC_FOLDER_NAMES = new Set(['readme', 'readme.txt', 'backups']);
const LEGACY_GLOBAL_ARTIFACT_OWNER = 'legacy-global';

export interface SrdIngestArtifacts {
  'table.json': object;
  'links.json': object;
  'text.md': string;
  'index.json': object;
}

export type SrdArtifactStorageKind = 'folder' | 'indexeddb';

export interface StoredSrdArtifactRecord {
  characterId: string;
  docFolder: string;
  documentId: string;
  relativePath: string;
  artifacts: Record<SrdIngestArtifactFile, string>;
  storedAt: string;
}

export interface SrdArtifactStore {
  get(key: string): Promise<StoredSrdArtifactRecord | undefined>;
  set(key: string, value: StoredSrdArtifactRecord): Promise<void>;
}

export interface SrdIngestClient {
  ingest(source: { name: string; content: string; path?: string }): Promise<{
    documentId: string;
    title: string;
    artifacts: SrdIngestArtifacts;
  }>;
}

export interface PersistSrdIngestParams {
  player?: string;
  characterName?: string;
  characterId: string;
  artifacts: SrdIngestArtifacts;
  docFolder?: string;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
  artifactStore?: SrdArtifactStore;
  now?: () => Date;
}

export interface PersistSrdIngestReceipt {
  stored: SrdArtifactStorageKind;
  relativePath: string;
  docFolder: string;
  documentId: string;
  hostSavedKey: string;
}

function srdArtifactStoreKey(characterId: string, docFolder: string): string {
  return `${characterId}/${docFolder}`;
}

function createIndexedDbSrdArtifactStore(): SrdArtifactStore {
  return {
    async get(key: string): Promise<StoredSrdArtifactRecord | undefined> {
      if (typeof indexedDB === 'undefined') return undefined;
      const database = await openFolderStorageDatabase();
      try {
        const transaction = database.transaction('srdArtifacts', 'readonly');
        const value = await requestToPromise(transaction.objectStore('srdArtifacts').get(key));
        await transactionToPromise(transaction);
        return value as StoredSrdArtifactRecord | undefined;
      } finally {
        database.close();
      }
    },
    async set(key: string, value: StoredSrdArtifactRecord): Promise<void> {
      assert(typeof indexedDB !== 'undefined', 'INDEXED_DB_UNAVAILABLE', 'IndexedDB is required to cache SRD ingest artifacts when no folder is connected.');
      const database = await openFolderStorageDatabase();
      try {
        const transaction = database.transaction('srdArtifacts', 'readwrite');
        transaction.objectStore('srdArtifacts').put(value, key);
        await transactionToPromise(transaction);
      } finally {
        database.close();
      }
    },
  };
}

export function srdDocFolderName(title: string, documentId: string): string {
  const fromTitle = sanitizePathSegment(title);
  if (fromTitle && !RESERVED_SRD_DOC_FOLDER_NAMES.has(fromTitle.toLowerCase())) return fromTitle;
  const fromId = sanitizePathSegment(documentId.replace(/[^a-zA-Z0-9_-]+/g, '-'))
    ?? sanitizePathSegment(`doc-${documentId.replace(/[^a-zA-Z0-9]/g, '').slice(-16)}`);
  assert(fromId && !RESERVED_SRD_DOC_FOLDER_NAMES.has(fromId.toLowerCase()), 'INVALID_NAME', 'SRD document folder name is invalid.');
  return fromId;
}

function documentIdFromArtifacts(artifacts: SrdIngestArtifacts): string {
  const index = artifacts['index.json'];
  if (isRecord(index) && isRecord(index.document) && typeof index.document.id === 'string' && index.document.id) {
    return index.document.id;
  }
  const table = artifacts['table.json'];
  if (isRecord(table) && typeof table.documentId === 'string' && table.documentId) return table.documentId;
  throw new StorageFault('INVALID_DATA', 'Ingest artifacts are missing a document id.');
}

function titleFromArtifacts(artifacts: SrdIngestArtifacts): string {
  const index = artifacts['index.json'];
  if (isRecord(index) && isRecord(index.document) && typeof index.document.title === 'string' && index.document.title.trim()) {
    return index.document.title.trim();
  }
  return 'Imported document';
}

function serializedArtifacts(artifacts: SrdIngestArtifacts): Record<SrdIngestArtifactFile, string> {
  assert(artifacts && typeof artifacts === 'object', 'INVALID_DATA', 'Ingest artifacts are required.');
  assert(typeof artifacts['text.md'] === 'string', 'INVALID_DATA', 'text.md must be a string.');
  assert(isRecord(artifacts['table.json']), 'INVALID_DATA', 'table.json must be an object.');
  assert(isRecord(artifacts['links.json']), 'INVALID_DATA', 'links.json must be an object.');
  assert(isRecord(artifacts['index.json']), 'INVALID_DATA', 'index.json must be an object.');
  const table = JSON.stringify(cloneForStorage(artifacts['table.json']), null, 2);
  const links = JSON.stringify(cloneForStorage(artifacts['links.json']), null, 2);
  const index = JSON.stringify(cloneForStorage(artifacts['index.json']), null, 2);
  const text = artifacts['text.md'];
  assertFileSize(table);
  assertFileSize(links);
  assertFileSize(index);
  assertFileSize(text);
  return { 'table.json': table, 'links.json': links, 'text.md': text, 'index.json': index };
}

function parseStoredArtifacts(serialized: Record<SrdIngestArtifactFile, string>): SrdIngestArtifacts {
  assert(typeof serialized['text.md'] === 'string', 'INVALID_DATA', 'text.md must be a string.');
  return {
    'table.json': parseUntrustedJson(serialized['table.json']) as object,
    'links.json': parseUntrustedJson(serialized['links.json']) as object,
    'text.md': serialized['text.md'],
    'index.json': parseUntrustedJson(serialized['index.json']) as object,
  };
}

async function resolveSelectedHandle(options: {
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
}): Promise<FsDirectoryHandleLike | undefined> {
  if (options.handle) {
    await ensureReadWritePermission(options.handle);
    return options.handle;
  }
  if (!options.handleStore) return undefined;
  const stored = await options.handleStore.get();
  if (!stored) return undefined;
  await ensureReadWritePermission(stored);
  return stored;
}

async function characterLayoutFromRoot(
  selectedRoot: FsDirectoryHandleLike,
  player: string,
  characterName: string,
): Promise<CharacterLayout> {
  const tree = await ensureBaseTree(selectedRoot);
  const storedPlayer = await getNamedDirectory(tree.users, player, 'player', true);
  const storedCharacter = await getNamedDirectory(storedPlayer.directory, characterName, 'character', true);
  return ensureCharacterLayout(storedCharacter.directory);
}

export async function persistSrdIngestArtifacts(
  params: PersistSrdIngestParams,
): Promise<StorageResult<PersistSrdIngestReceipt>> {
  try {
    assert(typeof params.characterId === 'string' && params.characterId.trim(), 'INVALID_CHARACTER', 'A character id is required to persist SRD ingest artifacts.');
    const serialized = serializedArtifacts(params.artifacts);
    const documentId = documentIdFromArtifacts(params.artifacts);
    const requestedFolder = params.docFolder ? sanitizePathSegment(params.docFolder) : null;
    if (params.docFolder) {
      assert(requestedFolder && !RESERVED_SRD_DOC_FOLDER_NAMES.has(requestedFolder.toLowerCase()), 'INVALID_NAME', 'SRD document folder name is invalid.');
    }
    const docFolder = requestedFolder ?? srdDocFolderName(titleFromArtifacts(params.artifacts), documentId);
    const storedAt = (params.now ?? (() => new Date()))().toISOString();
    const relativePath = `SRD/${docFolder}`;
    const record: StoredSrdArtifactRecord = {
      characterId: params.characterId,
      docFolder,
      documentId,
      relativePath,
      artifacts: serialized,
      storedAt,
    };

    const handle = await resolveSelectedHandle(params);
    if (handle && params.player && params.characterName) {
      const layout = await characterLayoutFromRoot(handle, params.player, params.characterName);
      const docDir = await getInternalDirectory(layout.srd, docFolder, true);
      await writeSafely(docDir, 'table.json', serialized['table.json'], layout.backups, `${docFolder}-table.json`);
      await writeSafely(docDir, 'links.json', serialized['links.json'], layout.backups, `${docFolder}-links.json`);
      await writeSafely(docDir, 'text.md', serialized['text.md'], layout.backups, `${docFolder}-text.md`);
      await writeSafely(docDir, 'index.json', serialized['index.json'], layout.backups, `${docFolder}-index.json`);
      return {
        ok: true,
        stored: 'folder',
        relativePath,
        docFolder,
        documentId,
        hostSavedKey: `folder:${relativePath}`,
      };
    }

    const store = params.artifactStore ?? createIndexedDbSrdArtifactStore();
    await store.set(srdArtifactStoreKey(params.characterId, docFolder), record);
    return {
      ok: true,
      stored: 'indexeddb',
      relativePath,
      docFolder,
      documentId,
      hostSavedKey: `idb:${params.characterId}/${docFolder}`,
    };
  } catch (error) {
    return toFailure(error);
  }
}

export async function loadSrdIngestArtifacts(params: {
  player?: string;
  characterName?: string;
  characterId: string;
  docFolder: string;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
  artifactStore?: SrdArtifactStore;
}): Promise<StorageResult<{ artifacts: SrdIngestArtifacts; stored: SrdArtifactStorageKind; relativePath: string }>> {
  try {
    const docFolder = sanitizePathSegment(params.docFolder);
    assert(docFolder, 'INVALID_NAME', 'SRD document folder name is invalid.');
    const handle = await resolveSelectedHandle(params);
    if (handle && params.player && params.characterName) {
      const layout = await characterLayoutFromRoot(handle, params.player, params.characterName);
      const docDir = await getInternalDirectory(layout.srd, docFolder, false);
      const table = await readTextIfPresent(docDir, 'table.json');
      const links = await readTextIfPresent(docDir, 'links.json');
      const text = await readTextIfPresent(docDir, 'text.md');
      const index = await readTextIfPresent(docDir, 'index.json');
      assert(table && links && text !== null && index, 'NOT_FOUND', 'This SRD document is missing ingest artifacts.');
      return {
        ok: true,
        stored: 'folder',
        relativePath: `SRD/${docFolder}`,
        artifacts: parseStoredArtifacts({
          'table.json': table,
          'links.json': links,
          'text.md': text,
          'index.json': index,
        }),
      };
    }
    const store = params.artifactStore ?? createIndexedDbSrdArtifactStore();
    const record = await store.get(srdArtifactStoreKey(params.characterId, docFolder));
    assert(record, 'NOT_FOUND', 'No ingest artifacts are cached for this SRD document.');
    return {
      ok: true,
      stored: 'indexeddb',
      relativePath: record.relativePath,
      artifacts: parseStoredArtifacts(record.artifacts),
    };
  } catch (error) {
    return toFailure(error);
  }
}

function createDefaultSrdIngestClient(): SrdIngestClient | null {
  if (typeof fetch !== 'function') return null;
  return {
    async ingest(source) {
      const response = await fetch('/api/sot/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: source.name,
          content: source.content,
          ...(source.path ? { path: source.path } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({ error: 'Ingest returned a non-JSON response.' })) as {
        error?: unknown;
        artifacts?: SrdIngestArtifacts;
        documentId?: unknown;
        title?: unknown;
      };
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : `Ingest failed with status ${response.status}.`;
        throw new StorageFault(response.status === 413 ? 'FILE_TOO_LARGE' : 'INVALID_DATA', message);
      }
      if (!payload.artifacts) {
        throw new StorageFault('INVALID_DATA', 'Ingest response is missing artifacts.');
      }
      const artifacts = payload.artifacts;
      const documentId = typeof payload.documentId === 'string' ? payload.documentId : documentIdFromArtifacts(artifacts);
      const title = typeof payload.title === 'string' ? payload.title : titleFromArtifacts(artifacts);
      return { documentId, title, artifacts };
    },
  };
}

export async function ingestAndPersistSrdDocument(params: {
  name: string;
  content: string;
  path?: string;
  player?: string;
  characterName?: string;
  characterId: string;
  ingestClient?: SrdIngestClient;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
  artifactStore?: SrdArtifactStore;
  now?: () => Date;
}): Promise<StorageResult<PersistSrdIngestReceipt & { title: string }>> {
  try {
    const client = params.ingestClient ?? createDefaultSrdIngestClient();
    assert(client, 'API_UNSUPPORTED', 'No ingest client is available. POST /api/sot/ingest requires a running server.');
    const ingested = await client.ingest({ name: params.name, content: params.content, path: params.path });
    const persisted = await persistSrdIngestArtifacts({
      player: params.player,
      characterName: params.characterName,
      characterId: params.characterId,
      artifacts: ingested.artifacts,
      handle: params.handle,
      handleStore: params.handleStore,
      artifactStore: params.artifactStore,
      now: params.now,
    });
    if (!persisted.ok) return persisted;
    return { ...persisted, title: ingested.title };
  } catch (error) {
    return toFailure(error);
  }
}

export type WriteCharacterExportReceipt =
  | { stored: 'folder'; relativePath: string; fileName: string }
  | { stored: 'skipped' };

function defaultExportHandleStore(): DirectoryHandleStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  return createIndexedDbHandleStore();
}

async function resolveExportCharacterLayout(params: {
  player?: string;
  characterName?: string;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
}): Promise<CharacterLayout | undefined> {
  const handle = await resolveSelectedHandle({
    handle: params.handle,
    handleStore: params.handleStore ?? defaultExportHandleStore(),
  });
  if (!handle) return undefined;

  let player = params.player?.trim();
  let characterName = params.characterName?.trim();
  if (!player || !characterName) {
    const tree = await ensureBaseTree(handle);
    const text = await readTextIfPresent(tree.managedRoot, ACTIVE_FILE_NAME);
    if (text) {
      try {
        const envelope = await parseEnvelope(text, PROJECTION_FORMAT, DEFAULT_SCHEMA_VERSION);
        const active = parseActiveCharacter(envelope.data);
        if (active) {
          player = player || active.player;
          characterName = characterName || active.name;
        }
      } catch {
        // Active pointer is optional for exports; skip to Blob fallback.
      }
    }
  }
  if (!player || !characterName) return undefined;
  return characterLayoutFromRoot(handle, player, characterName);
}

/** Writes a downloadable export into `<character>/exports/` when a folder is connected. */
export async function writeCharacterExportFile(params: {
  fileName: string;
  contents: string;
  player?: string;
  characterName?: string;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
}): Promise<StorageResult<WriteCharacterExportReceipt>> {
  try {
    assert(typeof params.contents === 'string', 'INVALID_DATA', 'Export contents must be text.');
    assertFileSize(params.contents);
    const leaf = params.fileName.split(/[/\\]/).pop() ?? '';
    const fileName = sanitizePathSegment(leaf);
    assert(fileName, 'INVALID_NAME', 'Export file name is invalid.');

    const layout = await resolveExportCharacterLayout(params);
    if (!layout) return { ok: true, stored: 'skipped' };

    await writeSafely(layout.exports, fileName, params.contents, layout.backups, `exports-${fileName}`);
    return {
      ok: true,
      stored: 'folder',
      relativePath: `${CHARACTER_EXPORTS_FOLDER}/${fileName}`,
      fileName,
    };
  } catch (error) {
    return toFailure(error);
  }
}

function listLocalStorageKeys(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

export function hostSrdMigrationPending(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(HOST_SRD_INGEST_MIGRATION_KEY) === '1') return false;
    return listLocalStorageKeys().some(
      (key) => key === LEGACY_GLOBAL_HOST_SRD_INDEX_KEY
        || key.startsWith(LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX)
        || /^pf1e_host_srd_index_.+_v1$/.test(key),
    );
  } catch {
    return false;
  }
}

function parseHostPage(raw: string | null): { id: string; title: string; htmlContent?: string; plainText?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; title?: unknown; htmlContent?: unknown; plainText?: unknown };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string' || typeof parsed.title !== 'string') return null;
    return parsed as { id: string; title: string; htmlContent?: string; plainText?: string };
  } catch {
    return null;
  }
}

function sourceFromHostPage(page: { id: string; title: string; htmlContent?: string; plainText?: string }): { name: string; content: string } | null {
  const html = typeof page.htmlContent === 'string' ? page.htmlContent : '';
  const plain = typeof page.plainText === 'string' ? page.plainText : '';
  const content = html || plain;
  if (!content.trim()) return null;
  return { name: `${page.title || page.id}.html`, content };
}

function stripHostPageRecord(raw: string, hostSavedKey: string): string {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return JSON.stringify({
    ...parsed,
    htmlContent: '',
    plainText: '',
    hostSavedKey,
  });
}

function readJsonStringArray(key: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function ownerKeyPart(characterId: string): string {
  return characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export interface MigrateLegacyHostSrdParams {
  player?: string;
  characterName?: string;
  characterId?: string;
  attachLegacyGlobals?: boolean;
  ingestClient?: SrdIngestClient;
  handle?: FsDirectoryHandleLike;
  handleStore?: DirectoryHandleStore;
  artifactStore?: SrdArtifactStore;
  now?: () => Date;
}

export interface MigrateLegacyHostSrdReceipt {
  migrated: number;
  skipped: boolean;
  stored: Array<{ id: string; stored: SrdArtifactStorageKind; relativePath: string }>;
}

export async function migrateLegacyHostSrdDocsOnce(
  params: MigrateLegacyHostSrdParams = {},
): Promise<StorageResult<MigrateLegacyHostSrdReceipt>> {
  try {
    if (typeof localStorage === 'undefined') {
      return { ok: true, migrated: 0, skipped: true, stored: [] };
    }
    if (localStorage.getItem(HOST_SRD_INGEST_MIGRATION_KEY) === '1') {
      return { ok: true, migrated: 0, skipped: true, stored: [] };
    }
    if (!hostSrdMigrationPending()) {
      localStorage.setItem(HOST_SRD_INGEST_MIGRATION_KEY, '1');
      return { ok: true, migrated: 0, skipped: true, stored: [] };
    }

    const client = params.ingestClient ?? createDefaultSrdIngestClient();
    assert(client, 'API_UNSUPPORTED', 'Host SRD migration needs POST /api/sot/ingest or an injected ingest client.');

    const stored: Array<{ id: string; stored: SrdArtifactStorageKind; relativePath: string }> = [];
    const processedKeys = new Set<string>();
    const owners: string[] = [];
    for (const key of listLocalStorageKeys()) {
      const match = /^pf1e_host_srd_index_(.+)_v1$/.exec(key);
      if (match) owners.push(match[1]);
    }

    const persistPage = async (
      page: { id: string; title: string; htmlContent?: string; plainText?: string },
      storageKey: string,
      ownerCharacterId: string,
      attachToFolder: boolean,
      removeKey: boolean,
    ) => {
      processedKeys.add(storageKey);
      const source = sourceFromHostPage(page);
      let hostSavedKey = '';
      if (source) {
        const ingested = await client.ingest(source);
        const persisted = await persistSrdIngestArtifacts({
          player: attachToFolder ? params.player : undefined,
          characterName: attachToFolder ? params.characterName : undefined,
          characterId: ownerCharacterId,
          artifacts: ingested.artifacts,
          handle: attachToFolder ? params.handle : undefined,
          handleStore: attachToFolder ? params.handleStore : undefined,
          artifactStore: params.artifactStore,
          now: params.now,
        });
        if (!persisted.ok) {
          throw new StorageFault(persisted.error.code, persisted.error.message);
        }
        hostSavedKey = persisted.hostSavedKey;
        stored.push({ id: page.id, stored: persisted.stored, relativePath: persisted.relativePath });
      }
      if (removeKey) {
        localStorage.removeItem(storageKey);
        return;
      }
      const raw = localStorage.getItem(storageKey);
      if (raw) localStorage.setItem(storageKey, stripHostPageRecord(raw, hostSavedKey || 'srd-artifact'));
    };

    for (const owner of owners) {
      const indexKey = `pf1e_host_srd_index_${owner}_v1`;
      const attachToFolder = Boolean(
        params.characterId
        && owner === ownerKeyPart(params.characterId)
        && params.player
        && params.characterName,
      );
      for (const id of readJsonStringArray(indexKey)) {
        const docKey = `${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}${owner}_${id}`;
        const page = parseHostPage(localStorage.getItem(docKey));
        if (!page) {
          processedKeys.add(docKey);
          continue;
        }
        await persistPage(page, docKey, owner, attachToFolder, false);
      }
    }

    const attachGlobals = Boolean(params.attachLegacyGlobals && params.player && params.characterName && params.characterId);
    const globalOwner = attachGlobals && params.characterId ? params.characterId : LEGACY_GLOBAL_ARTIFACT_OWNER;
    const globalIds = readJsonStringArray(LEGACY_GLOBAL_HOST_SRD_INDEX_KEY);
    for (const id of globalIds) {
      const docKey = `${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}${id}`;
      const page = parseHostPage(localStorage.getItem(docKey));
      if (!page) {
        processedKeys.add(docKey);
        continue;
      }
      await persistPage(page, docKey, globalOwner, attachGlobals, true);
    }

    for (const key of listLocalStorageKeys()) {
      if (!key.startsWith(LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX) || processedKeys.has(key)) continue;
      const scoped = owners.some((owner) => key.startsWith(`${LEGACY_GLOBAL_HOST_SRD_DOC_PREFIX}${owner}_`));
      if (scoped) continue;
      const page = parseHostPage(localStorage.getItem(key));
      if (!page) {
        processedKeys.add(key);
        continue;
      }
      await persistPage(page, key, globalOwner, attachGlobals, true);
    }

    localStorage.removeItem(LEGACY_GLOBAL_HOST_SRD_INDEX_KEY);
    localStorage.setItem(HOST_SRD_INGEST_MIGRATION_KEY, '1');
    return { ok: true, migrated: stored.length, skipped: false, stored };
  } catch (error) {
    return toFailure(error);
  }
}

export function createFsStorageAdapter(options: FsStorageAdapterOptions = {}): StorageAdapter {
  const folderPicker = options.folderPicker ?? getBrowserFolderPicker();
  const handleStore = options.handleStore ?? createIndexedDbHandleStore();
  const schemaVersion = options.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const appVersion = options.appVersion ?? DEFAULT_APP_VERSION;
  const now = options.now ?? (() => new Date());
  let rememberedHandle: FsDirectoryHandleLike | undefined;
  let handlePersistenceWarning: string | undefined;
  let lastNamedCharacterId: string | undefined;
  let writeLock: Promise<void> = Promise.resolve();

  async function withWriteLock<T>(op: () => Promise<T>): Promise<T> {
    const previous = writeLock;
    let release: () => void = () => {};
    writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await op();
    } finally {
      release();
    }
  }

  async function selectedHandle(): Promise<FsDirectoryHandleLike> {
    if (!rememberedHandle) rememberedHandle = await handleStore.get();
    assert(rememberedHandle, 'FOLDER_NOT_SELECTED', 'Choose a storage folder before loading or saving characters.');
    await ensureReadWritePermission(rememberedHandle);
    return rememberedHandle;
  }

  async function baseTree() {
    return ensureBaseTree(await selectedHandle());
  }

  async function saveLayout(
    layout: CharacterLayout,
    character: PF1Character,
    savedAt = now().toISOString(),
    options?: { characterId?: string; reuseExistingId?: boolean; skipProjections?: boolean },
  ): Promise<{ characterId: string; savedAt: string }> {
    const copied = cloneForStorage(character);
    assert(isRecord(copied), 'INVALID_CHARACTER', 'A character must be a JSON object.');
    assert(typeof copied.name === 'string' && typeof copied.player === 'string', 'INVALID_CHARACTER', 'A character is missing its identity fields.');
    const prior = await readCharacterEnvelopeIfPresent(layout.root, schemaVersion);
    const characterId =
      options?.characterId
      ?? (options?.reuseExistingId === false ? undefined : prior?.characterId)
      ?? createCharacterId();
    const referenced = referenceSrdPagesForStorage(copied as unknown as PF1Character, characterId);
    const envelopeData = cloneForStorage(referenced);
    const envelope = await createEnvelope(CHARACTER_FORMAT, envelopeData, schemaVersion, appVersion, savedAt, characterId);
    await writeCharacterTree(
      layout,
      referenced,
      envelope,
      schemaVersion,
      appVersion,
      savedAt,
      { skipProjections: Boolean(options?.skipProjections && prior) },
    );
    return { characterId, savedAt };
  }

  async function rememberActive(managedRoot: FsDirectoryHandleLike, ref: ActiveCharacterReference): Promise<void> {
    const safeData = cloneForStorage(ref);
    const envelope = await createEnvelope(PROJECTION_FORMAT, safeData, schemaVersion, appVersion, ref.savedAt);
    await writeDirect(managedRoot, ACTIVE_FILE_NAME, JSON.stringify(envelope, null, 2));
  }

  async function archiveAndRemoveCrash(layout: CharacterLayout): Promise<void> {
    const text = await readTextIfPresent(layout.root, CHARACTER_FILE_NAME);
    if (text !== null) {
      const safePrior = await sanitizedEnvelopeBackup(text, {
        format: CHARACTER_FORMAT,
        schemaVersion,
        appVersion,
      });
      if (safePrior !== null) {
        let sequence = 0;
        let candidate = backupFileName(CHARACTER_FILE_NAME, sequence);
        while ((await readTextIfPresent(layout.backups, candidate)) !== null) {
          sequence += 1;
          candidate = backupFileName(CHARACTER_FILE_NAME, sequence);
        }
        await writeDirect(layout.backups, candidate, safePrior);
        await trimBackups(layout.backups, CHARACTER_FILE_NAME);
      }
    }
    assert(layout.root.removeEntry, 'API_UNSUPPORTED', 'This browser cannot clear crash recovery data.');
    for (const fileName of [CHARACTER_FILE_NAME, `${CHARACTER_FILE_NAME}.tmp`]) {
      try {
        await layout.root.removeEntry(fileName);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
  }

  return {
    async pickFolderAndOpen(): Promise<StorageResult<{ rootName: string }>> {
      try {
        if (!rememberedHandle) rememberedHandle = await handleStore.get();
        if (rememberedHandle) {
          try {
            await ensureReadWritePermission(rememberedHandle);
            const tree = await ensureBaseTree(rememberedHandle);
            handlePersistenceWarning = undefined;
            try {
              await handleStore.set(rememberedHandle);
            } catch {
              handlePersistenceWarning = 'Connected for this session. This browser could not remember the folder; reconnect it next time.';
            }
            return { ok: true, rootName: tree.managedRoot.name };
          } catch {
            rememberedHandle = undefined;
          }
        }
        assert(folderPicker, 'API_UNSUPPORTED', 'Folder storage requires Edge or Chrome with the File System Access API.');
        let selected: FsDirectoryHandleLike;
        try {
          selected = await folderPicker({ mode: 'readwrite' });
        } catch (error) {
          return toFailure(error, 'picker');
        }
        await ensureReadWritePermission(selected);
        const tree = await ensureBaseTree(selected);
        rememberedHandle = selected;
        handlePersistenceWarning = undefined;
        try {
          await handleStore.set(selected);
        } catch {
          handlePersistenceWarning = 'Connected for this session. This browser could not remember the folder; reconnect it next time.';
        }
        return { ok: true, rootName: tree.managedRoot.name };
      } catch (error) {
        return toFailure(error);
      }
    },

    async getStatus(): Promise<StorageResult<StorageStatus>> {
      try {
        const supported = Boolean(folderPicker);
        if (!rememberedHandle) rememberedHandle = await handleStore.get();
        if (!rememberedHandle) {
          return { ok: true, supported, selected: false, permission: 'unknown', message: 'No storage folder has been selected.' };
        }
        const permission = rememberedHandle.queryPermission
          ? publicPermission(await rememberedHandle.queryPermission({ mode: 'readwrite' }))
          : 'unknown';
        return { ok: true, supported, selected: true, permission, rootName: rememberedHandle.name, message: handlePersistenceWarning };
      } catch (error) {
        return toFailure(error);
      }
    },

    async saveCharacter(player: string, character: PF1Character): Promise<StorageResult<SaveReceipt>> {
      try {
        return await withWriteLock(async () => {
          assert(typeof character?.name === 'string', 'INVALID_CHARACTER', 'A character needs a name before it can be saved.');
          const tree = await baseTree();
          const storedPlayer = await getNamedDirectory(tree.users, player, 'player', true);
          const storedCharacter = await getNamedDirectory(storedPlayer.directory, character.name, 'character', true);
          const layout = await ensureCharacterLayout(storedCharacter.directory);
          const savedAt = now().toISOString();
          // Validate/update non-authoritative shared projections first. If they
          // are malformed, do not report a failed save after committing source data.
          await writePlayerData(storedPlayer.directory, storedPlayer.name, character, schemaVersion, appVersion, savedAt);
          const receipt = await saveLayout(layout, character, savedAt, { reuseExistingId: true });
          const attachLegacyGlobals = lastNamedCharacterId === receipt.characterId;
          lastNamedCharacterId = receipt.characterId;
          if (hostSrdMigrationPending()) {
            try {
              await migrateLegacyHostSrdDocsOnce({
                player: storedPlayer.name,
                characterName: storedCharacter.name,
                characterId: receipt.characterId,
                attachLegacyGlobals,
                handle: rememberedHandle,
                handleStore,
              });
            } catch {
              // Migration is best-effort; the named save already committed.
            }
          }
          try {
            await saveLayout(tree.crash, character, savedAt, {
              characterId: receipt.characterId,
              reuseExistingId: false,
              skipProjections: true,
            });
          } catch {
            // Named save is authoritative; crash refresh is best-effort so checksums can match.
          }
          try {
            await rememberActive(tree.managedRoot, {
              player: storedPlayer.name,
              name: storedCharacter.name,
              characterId: receipt.characterId,
              savedAt: receipt.savedAt,
            });
          } catch {
            // active.json is non-authoritative metadata.
          }
          return { ok: true, player: storedPlayer.name, name: storedCharacter.name, ...receipt };
        });
      } catch (error) {
        return toFailure(error);
      }
    },

    async autosaveCrash(character: PF1Character): Promise<StorageResult<Omit<SaveReceipt, 'player'>>> {
      try {
        return await withWriteLock(async () => {
          assert(typeof character?.name === 'string', 'INVALID_CHARACTER', 'A character needs a name before it can be crash-saved.');
          const tree = await baseTree();
          const receipt = await saveLayout(tree.crash, character, now().toISOString(), {
            characterId: lastNamedCharacterId,
            reuseExistingId: false,
            skipProjections: true,
          });
          return { ok: true, name: STORAGE_CRASH_NAME, ...receipt };
        });
      } catch (error) {
        return toFailure(error);
      }
    },

    async loadCrash(): Promise<StorageResult<{ character: LoadedCharacter | null }>> {
      try {
        const tree = await baseTree();
        const envelope = await readCharacterEnvelopeIfPresent(tree.crash.root, schemaVersion);
        return { ok: true, character: envelope ? characterFromEnvelope(envelope) : null };
      } catch (error) {
        return toFailure(error);
      }
    },

    async dismissCrash(): Promise<StorageResult<{ dismissed: true }>> {
      try {
        const tree = await baseTree();
        await archiveAndRemoveCrash(tree.crash);
        return { ok: true, dismissed: true };
      } catch (error) {
        return toFailure(error);
      }
    },

    async getActiveCharacter(): Promise<StorageResult<{ activeCharacter: ActiveCharacterReference | null }>> {
      try {
        const tree = await baseTree();
        const text = await readTextIfPresent(tree.managedRoot, ACTIVE_FILE_NAME);
        if (text === null) return { ok: true, activeCharacter: null };
        try {
          const envelope = await parseEnvelope(text, PROJECTION_FORMAT, schemaVersion);
          return { ok: true, activeCharacter: parseActiveCharacter(envelope.data) };
        } catch {
          return { ok: true, activeCharacter: null };
        }
      } catch (error) {
        return toFailure(error);
      }
    },

    async listPlayers(): Promise<StorageResult<{ players: StoredPlayer[] }>> {
      try {
        const tree = await baseTree();
        const players = safeDirectoryNames(await listEntries(tree.users), [STORAGE_CRASH_NAME]).map((name) => ({ name }));
        return { ok: true, players };
      } catch (error) {
        return toFailure(error);
      }
    },

    async listCharacters(player: string): Promise<StorageResult<{ characters: StoredCharacterSummary[] }>> {
      try {
        const tree = await baseTree();
        const storedPlayer = await getNamedDirectory(tree.users, player, 'player', false);
        const names = safeDirectoryNames(await listEntries(storedPlayer.directory), ['settings', 'dsl', 'backups']);
        const characters: StoredCharacterSummary[] = [];
        for (const name of names) {
          const directory = await storedPlayer.directory.getDirectoryHandle(name);
          const envelope = await readCharacterEnvelopeIfPresent(directory, schemaVersion);
          if (envelope) characters.push({ name, characterId: envelope.characterId as string, savedAt: envelope.savedAt });
        }
        return { ok: true, characters };
      } catch (error) {
        return toFailure(error);
      }
    },

    async loadCharacter(player: string, name: string): Promise<StorageResult<LoadedCharacter>> {
      try {
        const tree = await baseTree();
        const storedPlayer = await getNamedDirectory(tree.users, player, 'player', false);
        const storedCharacter = await getNamedDirectory(storedPlayer.directory, name, 'character', false);
        const envelope = await readCharacterEnvelopeIfPresent(storedCharacter.directory, schemaVersion);
        assert(envelope, 'NOT_FOUND', 'This character has no character.json file.');
        const loaded = characterFromEnvelope(envelope);
        lastNamedCharacterId = loaded.characterId;
        if (hostSrdMigrationPending()) {
          try {
            await migrateLegacyHostSrdDocsOnce({
              player: storedPlayer.name,
              characterName: storedCharacter.name,
              characterId: loaded.characterId,
              attachLegacyGlobals: false,
              handle: rememberedHandle,
              handleStore,
            });
          } catch {
            // Migration is best-effort; the loaded character is still returned.
          }
        }
        try {
          await rememberActive(tree.managedRoot, {
            player: storedPlayer.name,
            name: storedCharacter.name,
            characterId: loaded.characterId,
            savedAt: loaded.savedAt,
          });
        } catch {
          // active.json is non-authoritative metadata.
        }
        return { ok: true, ...loaded };
      } catch (error) {
        return toFailure(error);
      }
    },
  };
}
