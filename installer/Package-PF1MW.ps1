param(
  [string]$ReleaseVersion
)

$ErrorActionPreference = 'Stop'
$repositoryDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$contractPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'PF1MW-RuntimeContract.ps1'
if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
  throw "The runtime contract is missing: $contractPath"
}
. $contractPath

$runtimeFiles = @(
  @{ Source = Join-Path $repositoryDirectory 'public\pathfinder1e_standalone.html'; Name = 'index.html' },
  @{ Source = Join-Path $repositoryDirectory 'public\chirpy.ico'; Name = 'chirpy.ico' },
  @{ Source = Join-Path $repositoryDirectory 'installer\Start-PF1MW.ps1'; Name = 'Start-PF1MW.ps1' }
)
$assetDirectory = Join-Path $repositoryDirectory 'public\character-sheet-icons'
$aiStudioAssetDirectory = Join-Path $repositoryDirectory 'public\assets\aistudio'
$memoryTemplateDirectory = Join-Path $repositoryDirectory 'public\memory-bank-template'
$memoryTemplatePath = Join-Path $memoryTemplateDirectory 'manifest.json'
$distDirectory = Join-Path $repositoryDirectory 'dist'
$outputDirectory = $distDirectory
$archivePath = Join-Path $outputDirectory 'pf1mw-runtime.zip'
$checksumPath = "$archivePath.sha256"
$stageDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
  'pf1mw-package-' + [Guid]::NewGuid().ToString('N')
)

function Get-PF1MWSourceRevision {
  $revision = (& git -C $repositoryDirectory rev-parse --short=12 HEAD 2>$null | Select-Object -First 1)
  $revision = [string]$revision
  if ($revision -match '^[0-9a-f]{7,40}$') {
    return $revision
  }
  return 'unknown'
}

function Get-PF1MWReleaseVersion {
  if (-not [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    $candidate = $ReleaseVersion.Trim()
  } elseif ($env:GITHUB_REF_TYPE -eq 'tag' -and -not [string]::IsNullOrWhiteSpace($env:GITHUB_REF_NAME)) {
    $candidate = $env:GITHUB_REF_NAME.Trim()
  } else {
    $candidate = "dev-$(Get-PF1MWSourceRevision)"
  }

  if ($candidate -notmatch '^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$') {
    throw "The release version is invalid: $candidate"
  }
  return $candidate
}

function Test-PF1MWMemoryTemplate {
  param([string]$Path)

  try {
    $template = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "The memory-bank template is not valid JSON: $Path"
  }

  if ($template.format -ne 'pf1mw-memory-bank-template' -or $template.schemaVersion -ne 1) {
    throw "The memory-bank template has an unsupported format or schema: $Path"
  }
  if (-not $template.characterMemory -or -not $template.characterMemory.files) {
    throw "The memory-bank template does not declare character memory files: $Path"
  }
}

function Copy-PF1MWStagedFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$RelativeName
  )

  $normalized = $RelativeName.Replace('\', '/')
  if (-not (Test-PF1MWAllowedRuntimeEntry -Path $normalized)) {
    throw "Refusing to package a path outside the runtime allowlist: $normalized"
  }
  if ($normalized -match '(^|/)\.env(\.local)?$') {
    throw "Refusing to package an env file: $normalized"
  }
  $destination = Join-Path $stageDirectory ($normalized.Replace('/', '\'))
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $Source -Destination $destination
}

foreach ($file in $runtimeFiles) {
  if (-not (Test-Path -LiteralPath $file.Source -PathType Leaf)) {
    throw "Required runtime file is missing: $($file.Source)"
  }
}
if (-not (Test-Path -LiteralPath $assetDirectory -PathType Container) -or
    -not (Get-ChildItem -LiteralPath $assetDirectory -Recurse -File -Filter '*.png')) {
  throw "Required character sheet image assets are missing: $assetDirectory"
}
if (-not (Test-Path -LiteralPath $aiStudioAssetDirectory -PathType Container) -or
    -not (Get-ChildItem -LiteralPath $aiStudioAssetDirectory -File -Filter '*.png')) {
  throw "Required AI Studio image assets are missing: $aiStudioAssetDirectory"
}
if (-not (Test-Path -LiteralPath $memoryTemplatePath -PathType Leaf)) {
  throw "Required memory-bank template is missing: $memoryTemplatePath"
}
Test-PF1MWMemoryTemplate -Path $memoryTemplatePath

foreach ($relative in Get-PF1MWPackagedServerFiles) {
  $source = Join-Path $repositoryDirectory ($relative.Replace('/', '\'))
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Required API runtime file is missing: $source"
  }
}

$distIndex = Join-Path $distDirectory 'index.html'
if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
  Write-Output 'dist/index.html is missing; running npm run build so the installed server.ts can serve production assets...'
  Push-Location -LiteralPath $repositoryDirectory
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}
if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
  throw "Required production bundle is missing: $distIndex"
}

$characterSheetAssetNames = @(
  Get-ChildItem -LiteralPath $assetDirectory -Recurse -File -Filter '*.png' |
    ForEach-Object {
      'character-sheet-icons/' + $_.FullName.Substring($assetDirectory.Length + 1).Replace('\', '/')
    }
)
$aiStudioAssetNames = @(
  Get-ChildItem -LiteralPath $aiStudioAssetDirectory -File -Filter '*.png' |
    ForEach-Object { 'assets/aistudio/' + $_.Name }
)
if ($aiStudioAssetNames | Where-Object { $_ -notmatch '^assets/aistudio/image_[a-z0-9]+\.png$' }) {
  throw 'AI Studio image asset names must match assets/aistudio/image_<id>.png.'
}

$resolvedReleaseVersion = Get-PF1MWReleaseVersion
$sourceRevision = Get-PF1MWSourceRevision

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stageDirectory | Out-Null
try {
  foreach ($file in $runtimeFiles) {
    Copy-PF1MWStagedFile -Source $file.Source -RelativeName $file.Name
  }
  Get-ChildItem -LiteralPath $assetDirectory -Recurse -File -Filter '*.png' | ForEach-Object {
    $relative = 'character-sheet-icons/' + $_.FullName.Substring($assetDirectory.Length + 1).Replace('\', '/')
    Copy-PF1MWStagedFile -Source $_.FullName -RelativeName $relative
  }
  Get-ChildItem -LiteralPath $aiStudioAssetDirectory -File -Filter '*.png' | ForEach-Object {
    Copy-PF1MWStagedFile -Source $_.FullName -RelativeName ('assets/aistudio/' + $_.Name)
  }
  Copy-PF1MWStagedFile -Source $memoryTemplatePath -RelativeName 'memory-bank-template/manifest.json'

  foreach ($relative in Get-PF1MWPackagedServerFiles) {
    Copy-PF1MWStagedFile `
      -Source (Join-Path $repositoryDirectory ($relative.Replace('/', '\'))) `
      -RelativeName $relative
  }

  Get-ChildItem -LiteralPath $distDirectory -Recurse -File | ForEach-Object {
    $relative = 'dist/' + $_.FullName.Substring($distDirectory.Length + 1).Replace('\', '/')
    if (Test-PF1MWAllowedRuntimeEntry -Path $relative) {
      Copy-PF1MWStagedFile -Source $_.FullName -RelativeName $relative
    }
  }

  $runtimeManifest = [ordered]@{
    format = 'pf1mw-runtime-manifest'
    schemaVersion = 1
    releaseVersion = $resolvedReleaseVersion
    sourceRevision = $sourceRevision
    builtAt = [DateTime]::UtcNow.ToString('o')
    apiEntry = 'server.ts'
    apiPort = Get-PF1MWInstalledApiPort
    indexHtmlSha256 = (Get-FileHash -LiteralPath (Join-Path $stageDirectory 'index.html') -Algorithm SHA256).Hash.ToLowerInvariant()
    memoryTemplateSha256 = (Get-FileHash -LiteralPath (Join-Path $stageDirectory 'memory-bank-template\manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
    characterSheetAssets = @($characterSheetAssetNames | Sort-Object)
    aiStudioAssets = @($aiStudioAssetNames | Sort-Object)
  }
  [System.IO.File]::WriteAllText(
    (Join-Path $stageDirectory 'runtime-manifest.json'),
    (($runtimeManifest | ConvertTo-Json -Depth 5) + "`n"),
    [System.Text.UTF8Encoding]::new($false)
  )

  $stagedNames = @(
    Get-ChildItem -LiteralPath $stageDirectory -Recurse -File -Force |
      ForEach-Object { $_.FullName.Substring($stageDirectory.Length + 1).Replace('\', '/') } |
      Sort-Object
  )
  foreach ($name in $stagedNames) {
    if (-not (Test-PF1MWAllowedRuntimeEntry -Path $name)) {
      throw "Staged runtime file is not on the allowlist: $name"
    }
  }
  foreach ($required in Get-PF1MWRequiredRuntimeEntries) {
    if ($stagedNames -notcontains $required) {
      throw "Staged runtime is missing required file: $required"
    }
  }
  if (-not ($stagedNames | Where-Object { $_ -match '^dist/assets/.+\.js$' })) {
    throw 'Staged runtime is missing the production JavaScript bundle under dist/assets/.'
  }
  if (-not ($stagedNames | Where-Object { $_ -match '^assets/aistudio/image_[a-z0-9]+\.png$' })) {
    throw 'Staged runtime is missing AI Studio PNG assets.'
  }
  if (-not ($stagedNames | Where-Object { $_ -match '^character-sheet-icons/' })) {
    throw 'Staged runtime is missing character sheet image assets.'
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $archivePath -PathType Leaf) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stageDirectory,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText(
    $checksumPath,
    "$hash  pf1mw-runtime.zip`n",
    [System.Text.Encoding]::ASCII
  )

  $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $names = @(
      $archive.Entries |
        Where-Object { $_.Name -ne '' } |
        ForEach-Object { $_.FullName.Replace('\', '/') } |
        Sort-Object
    )
    $expectedNames = @($stagedNames | Sort-Object)
    if (($names -join "`n") -ne ($expectedNames -join "`n")) {
      throw "Runtime ZIP contains unexpected files: $($names -join ', ')"
    }
  } finally {
    $archive.Dispose()
  }

  $manifestCheck = Get-Content -LiteralPath (Join-Path $stageDirectory 'runtime-manifest.json') -Raw | ConvertFrom-Json -ErrorAction Stop
  if ($manifestCheck.format -ne 'pf1mw-runtime-manifest' -or $manifestCheck.schemaVersion -ne 1 -or $manifestCheck.releaseVersion -ne $resolvedReleaseVersion) {
    throw 'Generated runtime manifest is invalid.'
  }
  if ($manifestCheck.apiEntry -ne 'server.ts' -or [int]$manifestCheck.apiPort -ne (Get-PF1MWInstalledApiPort)) {
    throw 'Generated runtime manifest is missing the server.ts API contract.'
  }
  if ($manifestCheck.indexHtmlSha256 -ne $runtimeManifest.indexHtmlSha256 -or $manifestCheck.memoryTemplateSha256 -ne $runtimeManifest.memoryTemplateSha256) {
    throw 'Generated runtime manifest hashes do not match staged runtime assets.'
  }
} finally {
  Remove-Item -LiteralPath $stageDirectory -Recurse -Force
}

Get-Item -LiteralPath $archivePath, $checksumPath | Select-Object Name, Length
Write-Output "Release version: $resolvedReleaseVersion"
Write-Output "Source revision: $sourceRevision"
Write-Output "SHA-256: $hash"
Write-Output 'Installed app runs server.ts when Node.js 22+ is present (AI / ingest / Complete Sheet). Standalone HTML is the fallback.'
