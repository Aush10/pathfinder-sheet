# Updated — pulls latest distros for all existing kits in the test folder without overwriting saves or secrets.
param(
  [string]$TargetDirectory,
  [string]$Repository = 'Aush10/pathfinder-sheet',
  [string]$Branch = 'Autosheet-PT-KIT',
  [string]$SourceRepo,
  [string]$PackagePath,
  [switch]$AllKits,
  [switch]$DryRun,
  [switch]$Json,
  [switch]$WaitOnExit
)

$ErrorActionPreference = 'Stop'
$scriptRootDir = $PSScriptRoot

function Resolve-TargetFolder {
  param([string]$ExplicitTarget)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitTarget)) {
    return [System.IO.Path]::GetFullPath($ExplicitTarget)
  }

  $scriptDir = if (-not [string]::IsNullOrWhiteSpace($scriptRootDir)) {
    $scriptRootDir
  } else {
    [string](Get-Location)
  }
  $leaf = Split-Path -Leaf $scriptDir
  $parentDir = Split-Path -Parent $scriptDir

  if ($leaf -eq 'installer' -and $parentDir -and (Test-Path -LiteralPath (Join-Path $parentDir '.git'))) {
    return [System.IO.Path]::GetFullPath($parentDir)
  }
  if ($leaf -eq 'shortcuts' -and $parentDir -and (
    (Test-Path -LiteralPath (Join-Path $parentDir 'index.html') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $parentDir 'kits') -PathType Container)
  )) {
    return [System.IO.Path]::GetFullPath($parentDir)
  }
  return [System.IO.Path]::GetFullPath($scriptDir)
}

function Write-UpdaterLog {
  param([string]$Message)
  if (-not $Json) {
    Write-Output $Message
  }
}

function Ensure-Directory {
  param([string]$DirPath)
  if (-not (Test-Path -LiteralPath $DirPath -PathType Container)) {
    New-Item -ItemType Directory -Path $DirPath -Force | Out-Null
  }
}

function Copy-DirectoryFiltered {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$DestDir,
    [string[]]$ExcludeRelativeRegex = @()
  )

  if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) { return 0 }
  Ensure-Directory $DestDir
  $copied = 0
  $sourceFull = [System.IO.Path]::GetFullPath($SourceDir)
  foreach ($file in (Get-ChildItem -LiteralPath $sourceFull -Recurse -File)) {
    $rel = $file.FullName.Substring($sourceFull.Length + 1).Replace('\', '/')
    $skip = $false
    foreach ($pattern in $ExcludeRelativeRegex) {
      if ($rel -match $pattern) { $skip = $true; break }
    }
    if ($skip) { continue }
    $destPath = Join-Path $DestDir ($rel.Replace('/', '\'))
    Ensure-Directory (Split-Path -Parent $destPath)
    Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force
    $copied++
  }
  return $copied
}

function Detect-ExistingKits {
  param([string]$Root)

  $kits = @()
  if (Test-Path -LiteralPath (Join-Path $Root '.git')) {
    $kits += [pscustomobject]@{ id = 'git_repo'; label = 'Git Playtest Repo'; path = $Root }
  }
  if (
    (Test-Path -LiteralPath (Join-Path $Root 'runtime-manifest.json') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'Start-PF1MW.ps1') -PathType Leaf)
  ) {
    $kits += [pscustomobject]@{ id = 'chirpy_runtime'; label = 'Chirpy Desktop Runtime'; path = $Root }
  }
  $hasStandalone = (
    (Test-Path -LiteralPath (Join-Path $Root 'Start-Autosheet-Playtest-Kit.ps1') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'PLAYTEST_GUIDE.html') -PathType Leaf) -or
    (
      (Test-Path -LiteralPath (Join-Path $Root 'index.html') -PathType Leaf) -and
      -not (Test-Path -LiteralPath (Join-Path $Root 'runtime-manifest.json') -PathType Leaf) -and
      -not (Test-Path -LiteralPath (Join-Path $Root 'package.json') -PathType Leaf)
    )
  )
  if ($hasStandalone) {
    $kits += [pscustomobject]@{ id = 'standalone_core'; label = 'Autosheet Playtest Kit Core'; path = $Root }
  }
  if (Test-Path -LiteralPath (Join-Path $Root 'dist-standalone\index.html') -PathType Leaf) {
    $kits += [pscustomobject]@{ id = 'dist_standalone'; label = 'Exportable dist-standalone Kit'; path = (Join-Path $Root 'dist-standalone') }
  }
  if (Test-Path -LiteralPath (Join-Path $Root 'dist\pf1mw-runtime.zip') -PathType Leaf) {
    $kits += [pscustomobject]@{ id = 'runtime_archive'; label = 'Chirpy Runtime Archive (pf1mw-runtime.zip)'; path = (Join-Path $Root 'dist\pf1mw-runtime.zip') }
  }
  if (Test-Path -LiteralPath (Join-Path $Root 'pt-kit\ingest\run.ts') -PathType Leaf) {
    $kits += [pscustomobject]@{ id = 'pt_kit_ingest'; label = 'PT-Kit Headless SOT Ingest'; path = (Join-Path $Root 'pt-kit\ingest') }
  }
  if (
    (Test-Path -LiteralPath (Join-Path $Root 'kits\api-keyhole.zip') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'api-keyhole\api-keyhole.json') -PathType Leaf)
  ) {
    $kits += [pscustomobject]@{ id = 'kit_api_keyhole'; label = 'API Keyhole Kit'; path = (Join-Path $Root 'kits\api-keyhole.zip') }
  }
  if (
    (Test-Path -LiteralPath (Join-Path $Root 'kits\openai-ai-kit.zip') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'openai-ai-kit\server-openai-kit.mjs') -PathType Leaf)
  ) {
    $kits += [pscustomobject]@{ id = 'kit_openai_ai'; label = 'OpenAI AI Kit'; path = (Join-Path $Root 'kits\openai-ai-kit.zip') }
  }
  if (
    (Test-Path -LiteralPath (Join-Path $Root 'kits\gemini-ai-kit.zip') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'gemini-ai-kit\server-gemini-kit.mjs') -PathType Leaf)
  ) {
    $kits += [pscustomobject]@{ id = 'kit_gemini_ai'; label = 'Experimental Gemini AI Kit'; path = (Join-Path $Root 'kits\gemini-ai-kit.zip') }
  }
  if (
    (Test-Path -LiteralPath (Join-Path $Root 'kits\sot-ingest-kit.zip') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $Root 'sot-ingest-kit\server-ingest-kit.mjs') -PathType Leaf)
  ) {
    $kits += [pscustomobject]@{ id = 'kit_sot_ingest'; label = 'SOT Ingest Kit'; path = (Join-Path $Root 'kits\sot-ingest-kit.zip') }
  }

  return $kits
}

function Extract-ZipPreserveSecrets {
  param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$DestDir
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  Ensure-Directory $DestDir
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    foreach ($entry in $archive.Entries) {
      if ([string]::IsNullOrEmpty($entry.Name)) { continue }
      $rel = $entry.FullName.Replace('\', '/')
      if ($rel.Contains('..') -or $rel.StartsWith('/')) { continue }
      # Never clobber user's local secrets if already present
      if ($rel -match '(^|/)\.env(\.local)?$') {
        $existingSecret = Join-Path $DestDir ($rel.Replace('/', '\'))
        if (Test-Path -LiteralPath $existingSecret -PathType Leaf) { continue }
      }
      if ($rel -match '(^|/)api-keyhole\.json$') {
        $existingKeyhole = Join-Path $DestDir ($rel.Replace('/', '\'))
        if (Test-Path -LiteralPath $existingKeyhole -PathType Leaf) { continue }
      }
      $destFile = Join-Path $DestDir ($rel.Replace('/', '\'))
      Ensure-Directory (Split-Path -Parent $destFile)
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
    }
  } finally {
    $archive.Dispose()
  }
}

function Invoke-GitCapture {
  param(
    [Parameter(Mandatory = $true)][string]$RepoDir,
    [Parameter(Mandatory = $true)][string[]]$GitArgs
  )

  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = (& git -C $RepoDir @GitArgs 2>&1 | Out-String).Trim()
    $code = $LASTEXITCODE
    return @{ exitCode = $code; output = $output }
  } catch {
    return @{ exitCode = 1; output = $_.Exception.Message }
  } finally {
    $ErrorActionPreference = $prevPref
  }
}

function Invoke-GitSafePull {
  param(
    [string]$RepoDir,
    [string]$BranchName
  )

  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if (-not $gitCmd) {
    throw 'git is required to pull updates in a repository test folder.'
  }

  $fetchRes = Invoke-GitCapture -RepoDir $RepoDir -GitArgs @('fetch', 'origin', $BranchName)
  if ($fetchRes.exitCode -ne 0) {
    throw "git fetch failed: $($fetchRes.output)"
  }

  $branchRes = Invoke-GitCapture -RepoDir $RepoDir -GitArgs @('rev-parse', '--abbrev-ref', 'HEAD')
  $currentBranch = if ($branchRes.exitCode -eq 0) { ($branchRes.output -split "\r?\n" | Select-Object -First 1) } else { '' }
  if ($currentBranch -eq $BranchName) {
    $pullRes = Invoke-GitCapture -RepoDir $RepoDir -GitArgs @('pull', '--ff-only', 'origin', $BranchName)
    if ($pullRes.exitCode -ne 0) {
      throw "git pull --ff-only failed: $($pullRes.output)"
    }
    $pullOut = $pullRes.output
  } else {
    $pullRes = Invoke-GitCapture -RepoDir $RepoDir -GitArgs @('merge', '--ff-only', "origin/$BranchName")
    if ($pullRes.exitCode -ne 0) {
      throw "git merge --ff-only origin/$BranchName failed: $($pullRes.output)"
    }
    $pullOut = $pullRes.output
  }

  $revRes = Invoke-GitCapture -RepoDir $RepoDir -GitArgs @('rev-parse', '--short=12', 'HEAD')
  $rev = if ($revRes.exitCode -eq 0) { ($revRes.output -split "\r?\n" | Select-Object -First 1) } else { '' }
  return @{ revision = [string]$rev; detail = $pullOut }
}

function Build-SelectiveKitsWithNode {
  param(
    [Parameter(Mandatory = $true)][string]$RepoSourceDir,
    [Parameter(Mandatory = $true)][string]$OutStageDir,
    [Parameter(Mandatory = $true)][string[]]$KitIds
  )

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) { return $false }

  Ensure-Directory $OutStageDir
  $standaloneSrc = Join-Path $RepoSourceDir 'public\pathfinder1e_standalone.html'
  if (Test-Path -LiteralPath $standaloneSrc -PathType Leaf) {
    Copy-Item -LiteralPath $standaloneSrc -Destination (Join-Path $OutStageDir 'index.html') -Force
  }

  $wantsAll = $AllKits -or ($KitIds -contains 'standalone_core') -or ($KitIds -contains 'dist_standalone')
  $wantApiKeyhole = $wantsAll -or ($KitIds -contains 'kit_api_keyhole')
  $wantOpenAi = $wantsAll -or ($KitIds -contains 'kit_openai_ai')
  $wantGemini = $wantsAll -or ($KitIds -contains 'kit_gemini_ai')
  $wantSotIngest = $wantsAll -or ($KitIds -contains 'kit_sot_ingest')

  $runnerPath = Join-Path $OutStageDir '_build-kits.mjs'
  $repoEsc = $RepoSourceDir.Replace('\', '\\').Replace("'", "\'")
  $outEsc = $OutStageDir.Replace('\', '\\').Replace("'", "\'")
  $js = @"
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = '$repoEsc';
const outDir = '$outEsc';

const { buildZipBuffer } = await import(pathToFileURL(path.join(repoRoot, 'scripts/lib/zipWriter.mjs')).href);
const kits = await import(pathToFileURL(path.join(repoRoot, 'scripts/lib/kitPayloads.mjs')).href);
const docs = await import(pathToFileURL(path.join(repoRoot, 'scripts/lib/playtestDocs.mjs')).href);

if ($($wantsAll.ToString().ToLowerInvariant())) {
  fs.writeFileSync(path.join(outDir, 'PLAYTEST_GUIDE.html'), docs.buildPlaytestGuideHtml(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'launch-warning.html'), docs.buildPlaytestGuideHtml(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'MACRONI_XDX_BIBLE.html'), docs.buildMacroniBibleHtml(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'README.md'), docs.buildPlaytestReadmeMd(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'Start-Autosheet-Playtest-Kit.ps1'), docs.buildPlaytestLauncherPs1(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'Start-Autosheet-Playtest-Kit.bat'), docs.buildPlaytestLauncherBat(), 'utf8');
  if (typeof docs.buildUpdatedAppBat === 'function') {
    fs.writeFileSync(path.join(outDir, 'Updated.bat'), docs.buildUpdatedAppBat(), 'utf8');
  }
  const shortcutsDir = path.join(outDir, 'shortcuts');
  fs.mkdirSync(shortcutsDir, { recursive: true });
  for (const sc of docs.buildShortcutsFiles()) {
    fs.writeFileSync(path.join(shortcutsDir, sc.name), sc.content, 'utf8');
  }
}

const kitsDir = path.join(outDir, 'kits');
fs.mkdirSync(kitsDir, { recursive: true });
if ($($wantApiKeyhole.ToString().ToLowerInvariant())) {
  fs.writeFileSync(path.join(kitsDir, 'api-keyhole.zip'), buildZipBuffer(kits.createApiKeyholeFiles()));
}
if ($($wantOpenAi.ToString().ToLowerInvariant())) {
  fs.writeFileSync(path.join(kitsDir, 'openai-ai-kit.zip'), buildZipBuffer(kits.createOpenAiKitFiles()));
}
if ($($wantGemini.ToString().ToLowerInvariant())) {
  fs.writeFileSync(path.join(kitsDir, 'gemini-ai-kit.zip'), buildZipBuffer(kits.createGeminiKitFiles()));
}
if ($($wantSotIngest.ToString().ToLowerInvariant())) {
  fs.writeFileSync(path.join(kitsDir, 'sot-ingest-kit.zip'), buildZipBuffer(kits.createSotIngestKitFiles(repoRoot)));
}
"@
  [System.IO.File]::WriteAllText($runnerPath, $js, [System.Text.UTF8Encoding]::new($false))
  try {
    & node $runnerPath | Out-Null
    return ($LASTEXITCODE -eq 0)
  } finally {
    Remove-Item -LiteralPath $runnerPath -Force -ErrorAction SilentlyContinue
  }
}

function Refresh-UpdatedShortcuts {
  param([string]$Root, [string[]]$KitIds)

  if ($env:OS -ne 'Windows_NT') { return }
  $updatedIcon = Join-Path $Root 'chirpy-updated.ico'
  $chirpyIcon = Join-Path $Root 'chirpy.ico'
  $iconToUse = if (Test-Path -LiteralPath $updatedIcon -PathType Leaf) { $updatedIcon } elseif (Test-Path -LiteralPath $chirpyIcon -PathType Leaf) { $chirpyIcon } else { $null }
  $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  if (-not (Test-Path -LiteralPath $psExe -PathType Leaf)) { return }

  $scriptTarget = if (Test-Path -LiteralPath (Join-Path $Root 'Updated.ps1') -PathType Leaf) {
    Join-Path $Root 'Updated.ps1'
  } elseif (Test-Path -LiteralPath (Join-Path $Root 'Update-PF1MW.ps1') -PathType Leaf) {
    Join-Path $Root 'Update-PF1MW.ps1'
  } else {
    $null
  }
  if (-not $scriptTarget) { return }

  $shell = New-Object -ComObject WScript.Shell
  try {
    if ($KitIds -contains 'standalone_core') {
      $scDir = Join-Path $Root 'shortcuts'
      Ensure-Directory $scDir
      foreach ($lnkPath in @((Join-Path $Root 'Updated.lnk'), (Join-Path $scDir 'Updated.lnk'))) {
        $sc = $shell.CreateShortcut($lnkPath)
        $sc.TargetPath = $psExe
        $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptTarget`" -WaitOnExit"
        $sc.WorkingDirectory = $Root
        $sc.Description = 'Updated — Pull latest distros for all existing kits in this Autosheet Playtest Kit folder'
        if ($iconToUse) { $sc.IconLocation = "$iconToUse,0" }
        $sc.Save()
      }
    }
    $desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
    if (-not [string]::IsNullOrWhiteSpace($desktopDir) -and (Test-Path -LiteralPath $desktopDir -PathType Container)) {
      $mainDesktopShortcut = Join-Path $desktopDir 'Pathfinder 1e Modular Workspace.lnk'
      if (($KitIds -contains 'chirpy_runtime') -and (Test-Path -LiteralPath $mainDesktopShortcut -PathType Leaf)) {
        $dSc = $shell.CreateShortcut((Join-Path $desktopDir 'Updated.lnk'))
        $dSc.TargetPath = $psExe
        $dSc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptTarget`" -WaitOnExit"
        $dSc.WorkingDirectory = $Root
        $dSc.Description = 'Updated — Pull latest distros for all existing Autosheet kits'
        if ($iconToUse) { $dSc.IconLocation = "$iconToUse,0" }
        $dSc.Save()
      }
    }
  } finally {
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
  }
}

$resolvedTarget = Resolve-TargetFolder -ExplicitTarget $TargetDirectory
if (-not (Test-Path -LiteralPath $resolvedTarget -PathType Container)) {
  throw "Target test folder does not exist: $resolvedTarget"
}

$detected = @(Detect-ExistingKits -Root $resolvedTarget)
$kitIds = @($detected | ForEach-Object { $_.id })
$updatedKits = @()
$notes = @()
$sourceRevision = ''
$upstreamMode = 'unknown'

try {
  Write-UpdaterLog "[Updated] Target folder: $resolvedTarget"
  if ($kitIds.Count -eq 0) {
    $notes += 'No existing Autosheet kits were detected in this folder.'
  } else {
    Write-UpdaterLog ("[Updated] Existing kits detected: " + ($kitIds -join ', '))
  }

  # Mode 1: Git checkout test folder
  if (($kitIds -contains 'git_repo') -and [string]::IsNullOrWhiteSpace($PackagePath) -and [string]::IsNullOrWhiteSpace($SourceRepo)) {
    $upstreamMode = 'git-pull'
    $revCheck = Invoke-GitCapture -RepoDir $resolvedTarget -GitArgs @('rev-parse', '--short=12', 'HEAD')
    $sourceRevision = if ($revCheck.exitCode -eq 0) { ($revCheck.output -split "\r?\n" | Select-Object -First 1) } else { '' }
    if ($DryRun) {
      $notes += "Dry-run: would git pull origin/$Branch into $resolvedTarget and refresh existing built distros."
    } else {
      $pullRes = Invoke-GitSafePull -RepoDir $resolvedTarget -BranchName $Branch
      $sourceRevision = $pullRes.revision
      $updatedKits += 'git_repo'
      if ($kitIds -contains 'pt_kit_ingest') { $updatedKits += 'pt_kit_ingest' }

      $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
      $hasNodeModules = Test-Path -LiteralPath (Join-Path $resolvedTarget 'node_modules') -PathType Container
      if ($npmCmd -and $hasNodeModules -and (($kitIds -contains 'dist_standalone') -or $AllKits)) {
        Push-Location -LiteralPath $resolvedTarget
        try {
          & npm run build:standalone | Out-Null
          if ($LASTEXITCODE -eq 0) { $updatedKits += 'dist_standalone' }
        } finally {
          Pop-Location
        }
      }
      if (($kitIds -contains 'runtime_archive') -or $AllKits) {
        $packager = Join-Path $resolvedTarget 'installer\Package-PF1MW.ps1'
        if (Test-Path -LiteralPath $packager -PathType Leaf) {
          & $packager | Out-Null
          if ($LASTEXITCODE -eq 0) { $updatedKits += 'runtime_archive' }
        }
      }
    }
  } else {
    # Mode 2: Installed Chirpy runtime, standalone dist-standalone, or selective unpacked kits folder
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('pf1mw-updated-' + [Guid]::NewGuid().ToString('N'))
    Ensure-Directory $tempRoot
    try {
      $resolvedRepoDir = $null
      $resolvedRuntimeZip = $null

      if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
        $upstreamMode = 'local-package'
        $resolvedRuntimeZip = (Resolve-Path -LiteralPath $PackagePath).Path
      } elseif (-not [string]::IsNullOrWhiteSpace($SourceRepo)) {
        $upstreamMode = 'local-source-repo'
        $resolvedRepoDir = (Resolve-Path -LiteralPath $SourceRepo).Path
        $revCheck = Invoke-GitCapture -RepoDir $resolvedRepoDir -GitArgs @('rev-parse', '--short=12', 'HEAD')
        $sourceRevision = if ($revCheck.exitCode -eq 0) { ($revCheck.output -split "\r?\n" | Select-Object -First 1) } else { '' }
      } else {
        $upstreamMode = "github:$Repository@$Branch"
        $headers = @{ 'User-Agent' = 'PF1MW-Updated'; Accept = 'application/vnd.github+json' }
        try {
          $commitMeta = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/commits/$Branch" -Headers $headers
          if ($commitMeta -and $commitMeta.sha) {
            $sourceRevision = ([string]$commitMeta.sha).Substring(0, [Math]::Min(12, ([string]$commitMeta.sha).Length))
          }
        } catch {
          $notes += "Could not query GitHub commit API: $($_.Exception.Message)"
        }

        if (-not $DryRun) {
          $branchZip = Join-Path $tempRoot 'branch-source.zip'
          $branchUrl = "https://github.com/$Repository/archive/refs/heads/$Branch.zip"
          Write-UpdaterLog "[Updated] Downloading latest $Branch snapshot from $branchUrl ..."
          Invoke-WebRequest -Uri $branchUrl -Headers @{ 'User-Agent' = 'PF1MW-Updated' } -OutFile $branchZip
          $extractDir = Join-Path $tempRoot 'branch-extracted'
          Ensure-Directory $extractDir
          Add-Type -AssemblyName System.IO.Compression.FileSystem
          [System.IO.Compression.ZipFile]::ExtractToDirectory($branchZip, $extractDir)
          $firstDir = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
          if (-not $firstDir) { throw 'Downloaded GitHub archive did not contain a repository root folder.' }
          $resolvedRepoDir = $firstDir.FullName
        }
      }

      if ($DryRun) {
        $notes += "Dry-run: would pull $upstreamMode$(if ($sourceRevision) { " ($sourceRevision)" }) and update existing kits: $($kitIds -join ', ')."
      } else {
        if ($resolvedRuntimeZip -and (Test-Path -LiteralPath $resolvedRuntimeZip -PathType Leaf)) {
          $pkgStage = Join-Path $tempRoot 'runtime-pkg'
          Extract-ZipPreserveSecrets -ZipPath $resolvedRuntimeZip -DestDir $pkgStage
          if (($kitIds -contains 'chirpy_runtime') -or $AllKits) {
            [void](Copy-DirectoryFiltered -SourceDir $pkgStage -DestDir $resolvedTarget -ExcludeRelativeRegex @('^playtest-state\.json$', '^pt-kit/ingest/out/'))
            $updatedKits += 'chirpy_runtime'
          }
          if ($kitIds -contains 'pt_kit_ingest') {
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $pkgStage 'pt-kit') -DestDir (Join-Path $resolvedTarget 'pt-kit') -ExcludeRelativeRegex @('^ingest/out/'))
            $updatedKits += 'pt_kit_ingest'
          }
          if ($kitIds -contains 'standalone_core') {
            foreach ($file in @('index.html', 'launch-warning.html', 'chirpy.ico', 'chirpy-updated.ico', 'chirpy-updated.png')) {
              $srcFile = Join-Path $pkgStage $file
              if (Test-Path -LiteralPath $srcFile -PathType Leaf) {
                Copy-Item -LiteralPath $srcFile -Destination (Join-Path $resolvedTarget $file) -Force
              }
            }
            $updatedKits += 'standalone_core'
          }
        }

        if ($resolvedRepoDir) {
          $kitStage = Join-Path $tempRoot 'kit-stage'
          $builtKits = Build-SelectiveKitsWithNode -RepoSourceDir $resolvedRepoDir -OutStageDir $kitStage -KitIds $kitIds

          if ($kitIds -contains 'chirpy_runtime') {
            $pairs = @(
              @{ src = 'public\pathfinder1e_standalone.html'; dst = 'index.html' },
              @{ src = 'public\launch-warning.html'; dst = 'launch-warning.html' },
              @{ src = 'public\chirpy.ico'; dst = 'chirpy.ico' },
              @{ src = 'public\chirpy-updated.ico'; dst = 'chirpy-updated.ico' },
              @{ src = 'public\chirpy-updated.png'; dst = 'chirpy-updated.png' },
              @{ src = 'installer\Start-PF1MW.ps1'; dst = 'Start-PF1MW.ps1' },
              @{ src = 'installer\Update-PF1MW.ps1'; dst = 'Update-PF1MW.ps1' },
              @{ src = 'server.ts'; dst = 'server.ts' },
              @{ src = 'package.json'; dst = 'package.json' },
              @{ src = 'package-lock.json'; dst = 'package-lock.json' },
              @{ src = '.env.example'; dst = '.env.example' }
            )
            foreach ($p in $pairs) {
              $s = Join-Path $resolvedRepoDir $p.src
              if (Test-Path -LiteralPath $s -PathType Leaf) {
                Copy-Item -LiteralPath $s -Destination (Join-Path $resolvedTarget $p.dst) -Force
              }
            }
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'server') -DestDir (Join-Path $resolvedTarget 'server') -ExcludeRelativeRegex @('\.test\.ts$'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'pt-kit') -DestDir (Join-Path $resolvedTarget 'pt-kit') -ExcludeRelativeRegex @('^ingest/out/'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'public\character-sheet-icons') -DestDir (Join-Path $resolvedTarget 'character-sheet-icons'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'public\assets\aistudio') -DestDir (Join-Path $resolvedTarget 'assets\aistudio'))

            $repoDistDir = Join-Path $resolvedRepoDir 'dist'
            $repoDistIndex = Join-Path $repoDistDir 'index.html'
            if (-not (Test-Path -LiteralPath $repoDistIndex -PathType Leaf)) {
              $npmExe = Get-Command npm -ErrorAction SilentlyContinue
              if ($npmExe) {
                Push-Location -LiteralPath $resolvedRepoDir
                try {
                  & npm ci --no-fund --no-audit | Out-Null
                  if ($LASTEXITCODE -eq 0) {
                    & npm run build | Out-Null
                  }
                } catch {
                } finally {
                  Pop-Location
                }
              }
            }
            $targetDistDir = Join-Path $resolvedTarget 'dist'
            if (Test-Path -LiteralPath $repoDistIndex -PathType Leaf) {
              [void](Copy-DirectoryFiltered -SourceDir $repoDistDir -DestDir $targetDistDir -ExcludeRelativeRegex @('^pf1mw-runtime\.zip(\.sha256)?$'))
            } else {
              # Ensure production server.ts serves the fresh single-file bundle rather than stale dist/index.html
              Ensure-Directory $targetDistDir
              $standaloneHtml = Join-Path $resolvedRepoDir 'public\pathfinder1e_standalone.html'
              if (Test-Path -LiteralPath $standaloneHtml -PathType Leaf) {
                Copy-Item -LiteralPath $standaloneHtml -Destination (Join-Path $targetDistDir 'index.html') -Force
              }
              foreach ($pubFile in @('launch-warning.html', 'chirpy.ico', 'chirpy-updated.ico', 'chirpy-updated.png')) {
                $pf = Join-Path $resolvedRepoDir ("public\" + $pubFile)
                if (Test-Path -LiteralPath $pf -PathType Leaf) {
                  Copy-Item -LiteralPath $pf -Destination (Join-Path $targetDistDir $pubFile) -Force
                }
              }
            }

            $updatedBatContent = "@echo off`r`nsetlocal`r`ncd /d `"%~dp0`"`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0Update-PF1MW.ps1`" -WaitOnExit %*`r`n"
            [System.IO.File]::WriteAllText((Join-Path $resolvedTarget 'Updated.bat'), $updatedBatContent, [System.Text.Encoding]::ASCII)
            $updatedKits += 'chirpy_runtime'
          }

          if ($kitIds -contains 'pt_kit_ingest') {
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'pt-kit') -DestDir (Join-Path $resolvedTarget 'pt-kit') -ExcludeRelativeRegex @('^ingest/out/'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'server\ingest') -DestDir (Join-Path $resolvedTarget 'server\ingest') -ExcludeRelativeRegex @('\.test\.ts$'))
            $updatedKits += 'pt_kit_ingest'
          }

          if (($kitIds -contains 'standalone_core') -or $AllKits) {
            foreach ($p in @(
              @{ src = 'public\pathfinder1e_standalone.html'; dst = 'index.html' },
              @{ src = 'public\launch-warning.html'; dst = 'launch-warning.html' },
              @{ src = 'public\launch-warning.html'; dst = 'PLAYTEST_GUIDE.html' },
              @{ src = 'public\chirpy.ico'; dst = 'chirpy.ico' },
              @{ src = 'public\chirpy-updated.ico'; dst = 'chirpy-updated.ico' },
              @{ src = 'public\chirpy-updated.png'; dst = 'chirpy-updated.png' },
              @{ src = 'installer\Update-PF1MW.ps1'; dst = 'Updated.ps1' }
            )) {
              $s = Join-Path $resolvedRepoDir $p.src
              if (Test-Path -LiteralPath $s -PathType Leaf) {
                Copy-Item -LiteralPath $s -Destination (Join-Path $resolvedTarget $p.dst) -Force
              }
            }
            if ($builtKits) {
              [void](Copy-DirectoryFiltered -SourceDir $kitStage -DestDir $resolvedTarget -ExcludeRelativeRegex @('^kits/'))
            }
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'public\character-sheet-icons') -DestDir (Join-Path $resolvedTarget 'character-sheet-icons'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'public\assets\aistudio') -DestDir (Join-Path $resolvedTarget 'assets\aistudio'))
            [void](Copy-DirectoryFiltered -SourceDir (Join-Path $resolvedRepoDir 'public\memory-bank-template') -DestDir (Join-Path $resolvedTarget 'memory-bank-template'))
            $updatedKits += 'standalone_core'
          }

          if ($builtKits) {
            $kitMap = @(
              @{ id = 'kit_api_keyhole'; zip = 'api-keyhole.zip'; folder = 'api-keyhole'; marker = 'api-keyhole.json' },
              @{ id = 'kit_openai_ai'; zip = 'openai-ai-kit.zip'; folder = 'openai-ai-kit'; marker = 'server-openai-kit.mjs' },
              @{ id = 'kit_gemini_ai'; zip = 'gemini-ai-kit.zip'; folder = 'gemini-ai-kit'; marker = 'server-gemini-kit.mjs' },
              @{ id = 'kit_sot_ingest'; zip = 'sot-ingest-kit.zip'; folder = 'sot-ingest-kit'; marker = 'server-ingest-kit.mjs' }
            )
            foreach ($km in $kitMap) {
              $zipSrc = Join-Path $kitStage ("kits\" + $km.zip)
              if (-not (Test-Path -LiteralPath $zipSrc -PathType Leaf)) { continue }
              $zipDest = Join-Path $resolvedTarget ("kits\" + $km.zip)
              $unpackedDir = Join-Path $resolvedTarget $km.folder
              $didUpdateThis = $false
              if ((Test-Path -LiteralPath $zipDest -PathType Leaf) -or $AllKits) {
                Ensure-Directory (Split-Path -Parent $zipDest)
                Copy-Item -LiteralPath $zipSrc -Destination $zipDest -Force
                $didUpdateThis = $true
              }
              if (Test-Path -LiteralPath (Join-Path $unpackedDir $km.marker) -PathType Leaf) {
                Extract-ZipPreserveSecrets -ZipPath $zipSrc -DestDir $unpackedDir
                $didUpdateThis = $true
              }
              if ($didUpdateThis) { $updatedKits += $km.id }
            }
          }
        }

        Refresh-UpdatedShortcuts -Root $resolvedTarget -KitIds $kitIds
        $updatedKits = @($updatedKits | Sort-Object -Unique)

        $receipt = [ordered]@{
          format = 'pf1mw-playtest-update'
          updatedAt = [DateTime]::UtcNow.ToString('o')
          targetDirectory = $resolvedTarget
          upstream = $upstreamMode
          sourceRevision = $sourceRevision
          detectedKits = $kitIds
          updatedKits = $updatedKits
        }
        [System.IO.File]::WriteAllText(
          (Join-Path $resolvedTarget 'playtest-update.json'),
          (($receipt | ConvertTo-Json -Depth 4) + "`n"),
          [System.Text.UTF8Encoding]::new($false)
        )
      }
    } finally {
      Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  $updatedKits = @($updatedKits | Sort-Object -Unique)
  $resultObj = [ordered]@{
    ok = $true
    dryRun = [bool]$DryRun
    targetDirectory = $resolvedTarget
    upstream = $upstreamMode
    sourceRevision = $sourceRevision
    detectedKits = $kitIds
    updatedKits = $updatedKits
    notes = $notes
    command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  }

  if ($Json) {
    Write-Output ($resultObj | ConvertTo-Json -Depth 5 -Compress)
  } else {
    Write-Output ("[Updated] Upstream: $upstreamMode" + $(if ($sourceRevision) { " ($sourceRevision)" }))
    Write-Output ("[Updated] Updated kits: " + $(if ($updatedKits.Count -gt 0) { $updatedKits -join ', ' } else { 'none (dry-run or no matching kits)' }))
    foreach ($n in $notes) { Write-Output "[Updated] $n" }
  }
} catch {
  $errMsg = $_.Exception.Message
  if ($Json) {
    $errObj = [ordered]@{
      ok = $false
      dryRun = [bool]$DryRun
      targetDirectory = $resolvedTarget
      detectedKits = $kitIds
      updatedKits = $updatedKits
      error = $errMsg
    }
    Write-Output ($errObj | ConvertTo-Json -Depth 4 -Compress)
    exit 1
  }
  Write-Error $errMsg
  if ($WaitOnExit) {
    Write-Host ''
    Read-Host 'Update failed. Press Enter to close'
  }
  exit 1
}

if ($WaitOnExit -and -not $Json) {
  Write-Host ''
  Read-Host 'Updated finished. Press Enter to close'
}
