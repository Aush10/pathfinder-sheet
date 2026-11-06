param(
  [string]$ReleaseVersion
)

$ErrorActionPreference = 'Stop'
$repositoryDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeFiles = @(
  @{ Source = Join-Path $repositoryDirectory 'public\pathfinder1e_standalone.html'; Name = 'index.html' },
  @{ Source = Join-Path $repositoryDirectory 'public\chirpy.ico'; Name = 'chirpy.ico' },
  @{ Source = Join-Path $repositoryDirectory 'installer\Start-PF1MW.ps1'; Name = 'Start-PF1MW.ps1' }
)
$assetDirectory = Join-Path $repositoryDirectory 'public\character-sheet-icons'
$aiStudioAssetDirectory = Join-Path $repositoryDirectory 'public\assets\aistudio'
$memoryTemplateDirectory = Join-Path $repositoryDirectory 'public\memory-bank-template'
$memoryTemplatePath = Join-Path $memoryTemplateDirectory 'manifest.json'
$outputDirectory = Join-Path $repositoryDirectory 'dist'
$archivePath = Join-Path $outputDirectory 'pf1mw-runtime.zip'
$checksumPath = "$archivePath.sha256"
$stageDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
  'pf1mw-package-' + [Guid]::NewGuid().ToString('N')
)

function Get-PF1MWSourceRevision {
  $revision = (& git -C $repositoryDirectory rev-parse --short=12 HEAD 2>$null | Select-Object -First 1)
  if ($LASTEXITCODE -eq 0 -and $revision -and $revision -match '^[0-9a-f]{7,40}$') {
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
$expectedNames = @(
  'Start-PF1MW.ps1',
  'chirpy.ico',
  'index.html',
  'memory-bank-template/manifest.json',
  'runtime-manifest.json'
) + $characterSheetAssetNames + $aiStudioAssetNames
$expectedNames = @($expectedNames | Sort-Object)

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stageDirectory | Out-Null
try {
  foreach ($file in $runtimeFiles) {
    Copy-Item -LiteralPath $file.Source -Destination (Join-Path $stageDirectory $file.Name)
  }
  Copy-Item -LiteralPath $assetDirectory -Destination $stageDirectory -Recurse
  New-Item -ItemType Directory -Path (Join-Path $stageDirectory 'assets') | Out-Null
  Copy-Item -LiteralPath $aiStudioAssetDirectory -Destination (Join-Path $stageDirectory 'assets') -Recurse
  Copy-Item -LiteralPath $memoryTemplateDirectory -Destination $stageDirectory -Recurse

  $runtimeManifest = [ordered]@{
    format = 'pf1mw-runtime-manifest'
    schemaVersion = 1
    releaseVersion = $resolvedReleaseVersion
    sourceRevision = $sourceRevision
    builtAt = [DateTime]::UtcNow.ToString('o')
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

  Compress-Archive `
    -Path (Join-Path $stageDirectory '*') `
    -DestinationPath $archivePath `
    -CompressionLevel Optimal `
    -Force

  $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText(
    $checksumPath,
    "$hash  pf1mw-runtime.zip`n",
    [System.Text.Encoding]::ASCII
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $names = @(
      $archive.Entries |
        ForEach-Object { $_.FullName.Replace('\', '/') } |
        Sort-Object
    )
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
