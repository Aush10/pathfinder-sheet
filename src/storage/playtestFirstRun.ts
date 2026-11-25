/**
 * Playtest Kit First-Run Gate & Browser Crash Log Tracker
 *
 * Persists `#inits` (0 = gate to warning, 1 = run sheet) in the browser crash log
 * (`pf1e_playtest_crash_log_v1`) so the first time the Playtest Kit opens, it gates
 * to the safety quick guide before running the sheet on subsequent launches.
 */

export const PLAYTEST_CRASH_LOG_KEY = 'pf1e_playtest_crash_log_v1';

export const DEFAULT_PLAYTEST_SHELL_COMMAND =
  'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ".\\Start-Autosheet-Playtest-Kit.ps1"';

export interface PlaytestCrashLogEntry {
  inits: 0 | 1;
  firstRunTriggeredAt?: string;
  lastOpenedAt?: string;
  lastLauncherCommand?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlaytestRuntimeContext {
  isPlaytestMode: boolean;
  hasExportedCharacter: boolean;
  isReadOnly: boolean;
  skipGate: boolean;
  forceGate: boolean;
  kitInitSynced: boolean;
  launcherCommand: string;
}

export interface PlaytestFirstRunDecision {
  gate: boolean;
  nextInits: 0 | 1;
  syncedFromLauncher: boolean;
  launcherCommand: string;
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function clampPlaytestInits(value: unknown): 0 | 1 {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return 1;
}

export function readPlaytestCrashLog(storage: StorageLike | null = getDefaultStorage()): PlaytestCrashLogEntry {
  if (!storage) return { inits: 0 };
  try {
    const raw = storage.getItem(PLAYTEST_CRASH_LOG_KEY);
    if (!raw) return { inits: 0 };
    const parsed = JSON.parse(raw) as Partial<PlaytestCrashLogEntry> | null;
    if (!parsed || typeof parsed !== 'object') return { inits: 0 };
    return {
      inits: clampPlaytestInits(parsed.inits),
      ...(typeof parsed.firstRunTriggeredAt === 'string'
        ? { firstRunTriggeredAt: parsed.firstRunTriggeredAt }
        : {}),
      ...(typeof parsed.lastOpenedAt === 'string' ? { lastOpenedAt: parsed.lastOpenedAt } : {}),
      ...(typeof parsed.lastLauncherCommand === 'string'
        ? { lastLauncherCommand: parsed.lastLauncherCommand.slice(0, 500) }
        : {}),
    };
  } catch {
    return { inits: 0 };
  }
}

export function writePlaytestCrashLog(
  entry: PlaytestCrashLogEntry,
  storage: StorageLike | null = getDefaultStorage(),
): PlaytestCrashLogEntry {
  const safe: PlaytestCrashLogEntry = {
    inits: clampPlaytestInits(entry.inits),
    ...(entry.firstRunTriggeredAt ? { firstRunTriggeredAt: entry.firstRunTriggeredAt } : {}),
    ...(entry.lastOpenedAt ? { lastOpenedAt: entry.lastOpenedAt } : {}),
    ...(entry.lastLauncherCommand
      ? { lastLauncherCommand: entry.lastLauncherCommand.slice(0, 500) }
      : {}),
  };
  if (storage) {
    try {
      storage.setItem(PLAYTEST_CRASH_LOG_KEY, JSON.stringify(safe));
    } catch {
      // Ignore quota / private mode restrictions; caller still has in-memory result.
    }
  }
  return safe;
}

export function markPlaytestInit(
  launcherCommand?: string,
  storage: StorageLike | null = getDefaultStorage(),
): PlaytestCrashLogEntry {
  const existing = readPlaytestCrashLog(storage);
  const now = new Date().toISOString();
  return writePlaytestCrashLog(
    {
      inits: 1,
      firstRunTriggeredAt: existing.firstRunTriggeredAt || now,
      lastOpenedAt: now,
      lastLauncherCommand: launcherCommand || existing.lastLauncherCommand || DEFAULT_PLAYTEST_SHELL_COMMAND,
    },
    storage,
  );
}

export function resetPlaytestInit(storage: StorageLike | null = getDefaultStorage()): PlaytestCrashLogEntry {
  const existing = readPlaytestCrashLog(storage);
  return writePlaytestCrashLog(
    {
      inits: 0,
      ...(existing.lastLauncherCommand ? { lastLauncherCommand: existing.lastLauncherCommand } : {}),
    },
    storage,
  );
}

function isPlaytestBuildFlag(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_PLAYTEST_KIT === '1';
  } catch {
    return false;
  }
}

export function detectPlaytestRuntimeContext(
  options?: {
    search?: string;
    protocol?: string;
    port?: string;
    hasExportedCharacter?: boolean;
    isBuildPlaytestKit?: boolean;
  },
): PlaytestRuntimeContext {
  const hasWindow = typeof window !== 'undefined';
  const search = options?.search ?? (hasWindow ? window.location.search : '');
  const protocol = options?.protocol ?? (hasWindow ? window.location.protocol : '');
  const port = options?.port ?? (hasWindow ? window.location.port : '');
  const hasExportedCharacter =
    options?.hasExportedCharacter ??
    Boolean(hasWindow && (window as unknown as { __INITIAL_CHARACTER__?: unknown }).__INITIAL_CHARACTER__);

  const params = new URLSearchParams(search);
  const isReadOnly = params.get('readonly') === '1';
  const skipGate = params.get('skipPlaytestGate') === '1';
  const forceGate = params.get('firstRun') === '1' || params.get('playtestGate') === '1';
  const kitInitSynced = params.get('kitInit') === '1';
  const isPlaytestQuery = params.get('playtest') === '1';
  const cmdParam = params.get('cmd');
  const launcherCommand =
    cmdParam && cmdParam.trim() ? cmdParam.trim().slice(0, 500) : DEFAULT_PLAYTEST_SHELL_COMMAND;

  const isPlaytestBuild = options?.isBuildPlaytestKit ?? isPlaytestBuildFlag();
  const isPlaytestOrigin = protocol === 'file:' || port === '38173';
  const isPlaytestMode = Boolean(isPlaytestBuild || isPlaytestOrigin || isPlaytestQuery || forceGate);

  return {
    isPlaytestMode,
    hasExportedCharacter,
    isReadOnly,
    skipGate,
    forceGate,
    kitInitSynced,
    launcherCommand,
  };
}

export function evaluatePlaytestFirstRunGate(
  runtime: PlaytestRuntimeContext,
  storage: StorageLike | null = getDefaultStorage(),
): PlaytestFirstRunDecision {
  const current = readPlaytestCrashLog(storage);
  if (runtime.isReadOnly || runtime.hasExportedCharacter || runtime.skipGate) {
    return {
      gate: false,
      nextInits: current.inits,
      syncedFromLauncher: false,
      launcherCommand: runtime.launcherCommand,
    };
  }

  if (runtime.kitInitSynced) {
    const saved = markPlaytestInit(runtime.launcherCommand, storage);
    return {
      gate: false,
      nextInits: saved.inits,
      syncedFromLauncher: true,
      launcherCommand: runtime.launcherCommand,
    };
  }

  if (runtime.forceGate) {
    const saved = markPlaytestInit(runtime.launcherCommand, storage);
    return {
      gate: true,
      nextInits: saved.inits,
      syncedFromLauncher: false,
      launcherCommand: runtime.launcherCommand,
    };
  }

  if (runtime.isPlaytestMode && current.inits === 0) {
    const saved = markPlaytestInit(runtime.launcherCommand, storage);
    return {
      gate: true,
      nextInits: saved.inits,
      syncedFromLauncher: false,
      launcherCommand: runtime.launcherCommand,
    };
  }

  return {
    gate: false,
    nextInits: current.inits,
    syncedFromLauncher: false,
    launcherCommand: runtime.launcherCommand,
  };
}
