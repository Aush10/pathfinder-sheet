import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZipBuffer } from './lib/zipWriter.mjs';
import {
  createApiKeyholeFiles,
  createGeminiKitFiles,
  createOpenAiKitFiles,
  createSotIngestKitFiles,
} from './lib/kitPayloads.mjs';
import {
  buildMacroniBibleHtml,
  buildPlaytestGuideHtml,
  buildPlaytestLauncherBat,
  buildPlaytestLauncherPs1,
  buildPlaytestReadmeMd,
  buildShortcutsFiles,
} from './lib/playtestDocs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'dist-standalone');

function walkFiles(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, base));
    } else if (entry.isFile()) {
      const rel = path.relative(base, full).replace(/\\/g, '/');
      const stat = fs.statSync(full);
      results.push({ path: rel, bytes: stat.size });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function tryCreateWindowsLnkShortcuts(shortcutsDir) {
  if (process.platform !== 'win32') return;
  const sysRoot = process.env.SystemRoot || 'C:\\Windows';
  const psPath = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (!fs.existsSync(psPath)) return;

  const escapedDir = shortcutsDir.replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
try {
  $fw = $shell.CreateShortcut('${escapedDir}\\Windows Defender Firewall.lnk')
  $fw.TargetPath = "$env:SystemRoot\\System32\\control.exe"
  $fw.Arguments = 'firewall.cpl'
  $fw.Description = 'Open Windows Defender Firewall settings'
  $fw.Save()

  $fwAdv = $shell.CreateShortcut('${escapedDir}\\Windows Defender Firewall (Advanced).lnk')
  $fwAdv.TargetPath = "$env:SystemRoot\\System32\\mmc.exe"
  $fwAdv.Arguments = "$env:SystemRoot\\System32\\wf.msc"
  $fwAdv.Description = 'Open Windows Defender Firewall with Advanced Security'
  $fwAdv.Save()
} finally {
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
`;
  try {
    execFileSync(psPath, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      stdio: 'ignore',
    });
  } catch (err) {
    console.warn('[playtest-kit] Could not generate .lnk shortcuts:', err instanceof Error ? err.message : err);
  }
}

export function buildPlaytestKit() {
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    throw new Error(`Expected standalone bundle at ${path.join(outDir, 'index.html')}. Run vite singlefile build first.`);
  }

  // Copy updated standalone HTML back to public/pathfinder1e_standalone.html for exportStandaloneHTMLBundle & installer
  fs.copyFileSync(
    path.join(outDir, 'index.html'),
    path.join(repoRoot, 'public', 'pathfinder1e_standalone.html'),
  );
  // Remove stale duplicate inside dist-standalone if copied from public/ before this build
  const nestedStandaloneCopy = path.join(outDir, 'pathfinder1e_standalone.html');
  if (fs.existsSync(nestedStandaloneCopy)) {
    fs.rmSync(nestedStandaloneCopy, { force: true });
  }

  // Top-level Playtest Kit guides, README & Windows chirpy launcher
  fs.writeFileSync(path.join(outDir, 'PLAYTEST_GUIDE.html'), buildPlaytestGuideHtml(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'MACRONI_XDX_BIBLE.html'), buildMacroniBibleHtml(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'README.md'), buildPlaytestReadmeMd(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'Start-Autosheet-Playtest-Kit.ps1'), buildPlaytestLauncherPs1(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'Start-Autosheet-Playtest-Kit.bat'), buildPlaytestLauncherBat(), 'utf8');

  // Downloadable add-on kits
  const kitsDir = path.join(outDir, 'kits');
  fs.mkdirSync(kitsDir, { recursive: true });
  fs.writeFileSync(path.join(kitsDir, 'api-keyhole.zip'), buildZipBuffer(createApiKeyholeFiles()));
  fs.writeFileSync(path.join(kitsDir, 'openai-ai-kit.zip'), buildZipBuffer(createOpenAiKitFiles()));
  fs.writeFileSync(path.join(kitsDir, 'gemini-ai-kit.zip'), buildZipBuffer(createGeminiKitFiles()));
  fs.writeFileSync(path.join(kitsDir, 'sot-ingest-kit.zip'), buildZipBuffer(createSotIngestKitFiles(repoRoot)));

  // Windows shortcuts folder
  const shortcutsDir = path.join(outDir, 'shortcuts');
  fs.mkdirSync(shortcutsDir, { recursive: true });
  for (const sc of buildShortcutsFiles()) {
    fs.writeFileSync(path.join(shortcutsDir, sc.name), sc.content, 'utf8');
  }
  tryCreateWindowsLnkShortcuts(shortcutsDir);

  // Baggage manifest & readable ITEM_LIST.md
  const preManifestFiles = walkFiles(outDir).filter(
    (item) => item.path !== 'baggage-list.json' && item.path !== 'ITEM_LIST.md',
  );
  const fullList = [
    ...preManifestFiles,
    { path: 'ITEM_LIST.md', bytes: 0 },
    { path: 'baggage-list.json', bytes: 0 },
  ].sort((a, b) => a.path.localeCompare(b.path));

  const itemListMd = [
    "# Autosheet Playtest Kit — Included Baggage & Item List",
    "",
    "Repository: https://github.com/Aush10/pathfinder-sheet",
    "",
    "| Item | Size (bytes) |",
    "| --- | ---: |",
    ...fullList.map((item) => `| \`${item.path}\` | ${item.bytes} |`),
    "",
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'ITEM_LIST.md'), itemListMd, 'utf8');

  const finalFiles = walkFiles(outDir).filter((item) => item.path !== 'baggage-list.json');
  const manifest = {
    name: 'Autosheet Playtest Kit',
    version: '1.3.0',
    generatedAt: new Date().toISOString(),
    itemCount: finalFiles.length + 1,
    items: finalFiles,
  };
  fs.writeFileSync(path.join(outDir, 'baggage-list.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`[playtest-kit] Built Autosheet Playtest Kit in dist-standalone/ (${finalFiles.length + 1} files)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPlaytestKit();
}
