import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DetectedKitInfo {
  id:
    | 'git_repo'
    | 'chirpy_runtime'
    | 'standalone_core'
    | 'dist_standalone'
    | 'runtime_archive'
    | 'pt_kit_ingest'
    | 'kit_api_keyhole'
    | 'kit_openai_ai'
    | 'kit_gemini_ai'
    | 'kit_sot_ingest';
  label: string;
  path: string;
}

export interface PlaytestUpdateStatusResult {
  ok: boolean;
  targetDirectory: string;
  updaterAvailable: boolean;
  updaterPath: string | null;
  command: string;
  detectedKits: DetectedKitInfo[];
}

export interface PlaytestUpdateResult {
  ok: boolean;
  dryRun: boolean;
  targetDirectory: string;
  upstream?: string;
  sourceRevision?: string;
  detectedKits: string[];
  updatedKits: string[];
  notes?: string[];
  command: string;
  error?: string;
}

export function isLoopbackAddress(remoteAddress: string | undefined | null): boolean {
  if (!remoteAddress) return false;
  const cleaned = remoteAddress.trim().toLowerCase().split('%')[0];
  return cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === '::ffff:127.0.0.1';
}

function existsFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function existsAny(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

export function detectExistingKits(targetDir: string): DetectedKitInfo[] {
  const root = path.resolve(targetDir);
  const found: DetectedKitInfo[] = [];

  if (existsAny(path.join(root, '.git'))) {
    found.push({ id: 'git_repo', label: 'Git Playtest Repo', path: root });
  }
  if (
    existsFile(path.join(root, 'runtime-manifest.json')) ||
    existsFile(path.join(root, 'Start-PF1MW.ps1'))
  ) {
    found.push({ id: 'chirpy_runtime', label: 'Chirpy Desktop Runtime', path: root });
  }
  const hasStandalone =
    existsFile(path.join(root, 'Start-Autosheet-Playtest-Kit.ps1')) ||
    existsFile(path.join(root, 'PLAYTEST_GUIDE.html')) ||
    (existsFile(path.join(root, 'index.html')) &&
      !existsFile(path.join(root, 'runtime-manifest.json')) &&
      !existsFile(path.join(root, 'package.json')));
  if (hasStandalone) {
    found.push({ id: 'standalone_core', label: 'Autosheet Playtest Kit Core', path: root });
  }
  if (existsFile(path.join(root, 'dist-standalone', 'index.html'))) {
    found.push({
      id: 'dist_standalone',
      label: 'Exportable dist-standalone Kit',
      path: path.join(root, 'dist-standalone'),
    });
  }
  if (existsFile(path.join(root, 'dist', 'pf1mw-runtime.zip'))) {
    found.push({
      id: 'runtime_archive',
      label: 'Chirpy Runtime Archive (pf1mw-runtime.zip)',
      path: path.join(root, 'dist', 'pf1mw-runtime.zip'),
    });
  }
  if (existsFile(path.join(root, 'pt-kit', 'ingest', 'run.ts'))) {
    found.push({
      id: 'pt_kit_ingest',
      label: 'PT-Kit Headless SOT Ingest',
      path: path.join(root, 'pt-kit', 'ingest'),
    });
  }
  if (
    existsFile(path.join(root, 'kits', 'api-keyhole.zip')) ||
    existsFile(path.join(root, 'api-keyhole', 'api-keyhole.json'))
  ) {
    found.push({
      id: 'kit_api_keyhole',
      label: 'API Keyhole Kit',
      path: path.join(root, 'kits', 'api-keyhole.zip'),
    });
  }
  if (
    existsFile(path.join(root, 'kits', 'openai-ai-kit.zip')) ||
    existsFile(path.join(root, 'openai-ai-kit', 'server-openai-kit.mjs'))
  ) {
    found.push({
      id: 'kit_openai_ai',
      label: 'OpenAI AI Kit',
      path: path.join(root, 'kits', 'openai-ai-kit.zip'),
    });
  }
  if (
    existsFile(path.join(root, 'kits', 'gemini-ai-kit.zip')) ||
    existsFile(path.join(root, 'gemini-ai-kit', 'server-gemini-kit.mjs'))
  ) {
    found.push({
      id: 'kit_gemini_ai',
      label: 'Experimental Gemini AI Kit',
      path: path.join(root, 'kits', 'gemini-ai-kit.zip'),
    });
  }
  if (
    existsFile(path.join(root, 'kits', 'sot-ingest-kit.zip')) ||
    existsFile(path.join(root, 'sot-ingest-kit', 'server-ingest-kit.mjs'))
  ) {
    found.push({
      id: 'kit_sot_ingest',
      label: 'SOT Ingest Kit',
      path: path.join(root, 'kits', 'sot-ingest-kit.zip'),
    });
  }

  return found;
}

export function resolveUpdaterScriptPath(targetDir: string): string | null {
  const root = path.resolve(targetDir);
  const candidates = [
    path.join(root, 'Updated.ps1'),
    path.join(root, 'Update-PF1MW.ps1'),
    path.join(root, 'installer', 'Update-PF1MW.ps1'),
  ];
  for (const candidate of candidates) {
    if (existsFile(candidate)) return candidate;
  }
  return null;
}

export function buildUpdatedCommandString(targetDir: string): string {
  const updater = resolveUpdaterScriptPath(targetDir);
  const relOrFull = updater ? path.relative(path.resolve(targetDir), updater) : 'Updated.ps1';
  const scriptRef = relOrFull.startsWith('..') ? updater || '.\\Updated.ps1' : `.\\${relOrFull}`;
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptRef}"`;
}

export function getPlaytestUpdateStatus(targetDir: string): PlaytestUpdateStatusResult {
  const resolved = path.resolve(targetDir);
  const updaterPath = resolveUpdaterScriptPath(resolved);
  return {
    ok: true,
    targetDirectory: resolved,
    updaterAvailable: Boolean(updaterPath) && process.platform === 'win32',
    updaterPath,
    command: buildUpdatedCommandString(resolved),
    detectedKits: detectExistingKits(resolved),
  };
}

export async function runPlaytestUpdate(options: {
  targetDir: string;
  dryRun?: boolean;
  allKits?: boolean;
  sourceRepo?: string;
  packagePath?: string;
}): Promise<PlaytestUpdateResult> {
  const resolved = path.resolve(options.targetDir);
  const dryRun = Boolean(options.dryRun);
  const detected = detectExistingKits(resolved);
  const command = buildUpdatedCommandString(resolved);
  const scriptPath = resolveUpdaterScriptPath(resolved);

  if (process.platform !== 'win32') {
    return {
      ok: false,
      dryRun,
      targetDirectory: resolved,
      detectedKits: detected.map((k) => k.id),
      updatedKits: [],
      command,
      error: 'The Windows PowerShell Updated runner requires a Windows host.',
    };
  }
  if (!scriptPath) {
    return {
      ok: false,
      dryRun,
      targetDirectory: resolved,
      detectedKits: detected.map((k) => k.id),
      updatedKits: [],
      command,
      error: 'Update-PF1MW.ps1 / Updated.ps1 was not found in the active folder.',
    };
  }

  const psExe = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-TargetDirectory',
    resolved,
    '-Json',
  ];
  if (dryRun) args.push('-DryRun');
  if (options.allKits) args.push('-AllKits');
  if (options.sourceRepo) args.push('-SourceRepo', options.sourceRepo);
  if (options.packagePath) args.push('-PackagePath', options.packagePath);

  try {
    const { stdout } = await execFileAsync(psExe, args, {
      cwd: resolved,
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const lastLine = stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .pop();
    if (!lastLine) {
      return {
        ok: false,
        dryRun,
        targetDirectory: resolved,
        detectedKits: detected.map((k) => k.id),
        updatedKits: [],
        command,
        error: 'Updated script returned empty output.',
      };
    }
    const parsed = JSON.parse(lastLine) as Partial<PlaytestUpdateResult>;
    return {
      ok: Boolean(parsed.ok),
      dryRun: Boolean(parsed.dryRun ?? dryRun),
      targetDirectory: parsed.targetDirectory || resolved,
      upstream: parsed.upstream,
      sourceRevision: parsed.sourceRevision,
      detectedKits: Array.isArray(parsed.detectedKits)
        ? parsed.detectedKits
        : detected.map((k) => k.id),
      updatedKits: Array.isArray(parsed.updatedKits) ? parsed.updatedKits : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      command: parsed.command || command,
      error: parsed.error,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      dryRun,
      targetDirectory: resolved,
      detectedKits: detected.map((k) => k.id),
      updatedKits: [],
      command,
      error: message,
    };
  }
}
