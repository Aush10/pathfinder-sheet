# Installs the locally built runtime bundle for development and testing.
# Builds the same zip Package-PF1MW.ps1 publishes, then reuses Install-PF1MW.ps1.
param(
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'pf1mw')
)

$ErrorActionPreference = 'Stop'
$installerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryDirectory = Split-Path -Parent $installerDirectory
$packageScript = Join-Path $installerDirectory 'Package-PF1MW.ps1'
$installScript = Join-Path $installerDirectory 'Install-PF1MW.ps1'
$archivePath = Join-Path $repositoryDirectory 'dist\pf1mw-runtime.zip'

if (-not (Test-Path -LiteralPath $packageScript -PathType Leaf)) {
  throw "The packager is missing: $packageScript"
}
if (-not (Test-Path -LiteralPath $installScript -PathType Leaf)) {
  throw "The installer is missing: $installScript"
}

& $packageScript
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  throw "Package-PF1MW.ps1 failed with exit code $LASTEXITCODE"
}
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  throw "The packager did not produce: $archivePath"
}

& $installScript -PackagePath $archivePath -InstallDirectory $InstallDirectory
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  throw "Install-PF1MW.ps1 failed with exit code $LASTEXITCODE"
}
