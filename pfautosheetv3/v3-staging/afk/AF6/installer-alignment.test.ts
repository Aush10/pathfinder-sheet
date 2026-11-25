import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const installerDir = path.join(root, 'installer');

function readInstaller(name: string): string {
  return fs.readFileSync(path.join(installerDir, name), 'utf8');
}

const contract = readInstaller('PF1MW-RuntimeContract.ps1');
const packager = readInstaller('Package-PF1MW.ps1');
const install = readInstaller('Install-PF1MW.ps1');
const installLocal = readInstaller('Install-PF1MW-Local.ps1');
const start = readInstaller('Start-PF1MW.ps1');

const powershell = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

function runPowerShell(script: string): string {
  return execFileSync(
    powershell,
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', cwd: root },
  ).trim();
}

test('all installer scripts parse in Windows PowerShell 5.1', () => {
  for (const name of [
    'PF1MW-RuntimeContract.ps1',
    'Package-PF1MW.ps1',
    'Install-PF1MW.ps1',
    'Install-PF1MW-Local.ps1',
    'Start-PF1MW.ps1',
  ]) {
    const scriptPath = path.join(installerDir, name).replace(/'/g, "''");
    const output = runPowerShell(
      `$errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${scriptPath}', [ref]$null, [ref]$errors); if ($errors -and $errors.Count) { $errors | ForEach-Object { $_.ToString() }; exit 1 } else { 'ok' }`,
    );
    assert.equal(output, 'ok', `${name} failed to parse`);
  }
});

test('shared contract allowlist accepts the aligned runtime and rejects secrets and staging', () => {
  const allowed = [
    'index.html',
    'chirpy.ico',
    'Start-PF1MW.ps1',
    'runtime-manifest.json',
    'memory-bank-template/manifest.json',
    'package.json',
    'package-lock.json',
    '.env.example',
    'server.ts',
    'server/env.ts',
    'server/ingest/ingest.ts',
    'server/ingest/output-schemas.json',
    'assets/aistudio/image_14f1e2fd.png',
    'character-sheet-icons/01-flat-enamel/blue-sword.png',
    'dist/index.html',
    'dist/assets/index-CrtIC_ra.js',
    'dist/assets/index-BwafXlp0.css',
    'pt-kit/README.md',
    'pt-kit/ingest/run.ts',
    'launch-warning.html',
  ];
  const denied = [
    '.env',
    '.env.local',
    'node_modules/express/index.js',
    'src/App.tsx',
    'pfautosheetv3/v3-staging/afk/AF6/installer-alignment.test.ts',
    '../server.ts',
    'server/openai.test.ts',
    'dist/pathfinder_sheet_latest.zip',
    'dist/pf1mw-runtime.zip',
    'pt-kit/ingest/out/table.json',
  ];

  const probe = [...allowed, ...denied]
    .map((entry) => `'${entry.replace(/'/g, "''")}'`)
    .join(', ');
  const script = [
    `. '${path.join(installerDir, 'PF1MW-RuntimeContract.ps1').replace(/'/g, "''")}'`,
    `$paths = @(${probe})`,
    '$paths | ForEach-Object { if (Test-PF1MWAllowedRuntimeEntry $_) { "allow:$_" } else { "deny:$_" } }',
  ].join('; ');
  const lines = runPowerShell(script).split(/\r?\n/).filter(Boolean);
  for (const entry of allowed) {
    assert.ok(lines.includes(`allow:${entry}`), `expected allow ${entry}`);
  }
  for (const entry of denied) {
    assert.ok(lines.includes(`deny:${entry}`), `expected deny ${entry}`);
  }
});

test('Package, Install, and Start agree on server.ts plus the files Start already required', () => {
  assert.match(contract, /Get-PF1MWRequiredRuntimeEntries/);
  assert.match(contract, /server\.ts/);
  assert.match(contract, /runtime-manifest\.json/);
  assert.match(contract, /memory-bank-template\/manifest\.json/);
  assert.match(contract, /assets\/aistudio/);
  assert.match(contract, /dist\/index\.html/);
  assert.match(contract, /pt-kit\/README\.md/);
  assert.match(contract, /launch-warning\\.html/);

  assert.match(packager, /PF1MW-RuntimeContract\.ps1/);
  assert.match(packager, /Get-PF1MWPackagedServerFiles/);
  assert.match(packager, /apiEntry = 'server\.ts'/);
  assert.match(packager, /npm run build/);
  assert.doesNotMatch(packager, /Copy-PF1MWStagedFile[^\n]*\.env\.local/);

  assert.match(install, /PF1MW-RuntimeContract\.ps1/);
  assert.match(install, /Test-PF1MWAllowedRuntimeEntry/);
  assert.match(install, /Get-PF1MWRequiredRuntimeEntries/);
  assert.match(install, /assets\/aistudio\/image_/);
  assert.match(install, /dist\\index\.html/);
  assert.match(install, /npm ci/);
  assert.match(install, /OPENAI_API_KEY in \.env\.local/);

  assert.match(start, /server\.ts/);
  assert.match(start, /--experimental-strip-types/);
  assert.match(start, /NODE_ENV = 'production'/);
  assert.match(start, /PORT = "\$port"/);
  assert.match(start, /\/api\/openai\/status/);
  assert.match(start, /TcpListener/);
  assert.match(start, /runtime-manifest\.json/);
  assert.match(start, /memory-bank-template\\manifest\.json/);
  assert.match(start, /assets\\aistudio/);
});

test('Install-PF1MW-Local is a wrapper around Package then Install -PackagePath', () => {
  assert.match(installLocal, /Package-PF1MW\.ps1/);
  assert.match(installLocal, /Install-PF1MW\.ps1/);
  assert.match(installLocal, /-PackagePath/);
  assert.match(installLocal, /pf1mw-runtime\.zip/);
  assert.doesNotMatch(installLocal, /pathfinder1e_standalone\.html/);
  assert.doesNotMatch(installLocal, /WScript\.Shell/);
});

test('none of the installer scripts copy secrets or pfautosheetv3', () => {
  for (const [name, source] of [
    ['contract', contract],
    ['package', packager],
    ['install', install],
    ['local', installLocal],
    ['start', start],
  ] as const) {
    assert.doesNotMatch(source, /pfautosheetv3/, `${name} mentions pfautosheetv3`);
    assert.doesNotMatch(source, /Copy-Item[^\n]*\.env\.local/, `${name} copies .env.local`);
    assert.doesNotMatch(source, /OPENAI_API_KEY\s*=\s*['"]sk-/, `${name} hardcodes a key`);
  }
});
