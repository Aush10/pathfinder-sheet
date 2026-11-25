param(
  [switch]$Server,
  [switch]$ResetFirstRun
)

$ErrorActionPreference = 'Stop'
$port = 38173
$appDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$playtestStatePath = Join-Path $appDirectory 'playtest-state.json'
$htmlPath = Join-Path $appDirectory 'index.html'
$iconPath = Join-Path $appDirectory 'chirpy.ico'
$runtimeManifestPath = Join-Path $appDirectory 'runtime-manifest.json'
$memoryTemplatePath = Join-Path $appDirectory 'memory-bank-template\manifest.json'
$aiStudioAssetDirectory = Join-Path $appDirectory 'assets\aistudio'
$serverEntryPath = Join-Path $appDirectory 'server.ts'
$distIndexPath = Join-Path $appDirectory 'dist\index.html'
$address = "http://127.0.0.1:$port/"
$apiStatusAddress = "http://127.0.0.1:$port/api/openai/status"

function Get-PF1MWBrowserPath {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return $candidate
    }
  }

  foreach ($commandName in @('msedge.exe', 'chrome.exe')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }

  throw 'Microsoft Edge or Google Chrome is required to open the app in its mini-browser window.'
}

function Test-PF1MWHttpOk {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [long]$ExpectedLength = -1
  )

  $request = [System.Net.HttpWebRequest]::Create($Url)
  $request.Method = 'GET'
  $request.Timeout = 1000
  $request.ReadWriteTimeout = 1000
  try {
    $response = [System.Net.HttpWebResponse]$request.GetResponse()
    try {
      if ($response.StatusCode -ne [System.Net.HttpStatusCode]::OK) {
        return $false
      }
      if ($ExpectedLength -ge 0 -and $response.ContentLength -ne $ExpectedLength) {
        return $false
      }
      return $true
    } finally {
      $response.Dispose()
    }
  } catch [System.Net.WebException] {
    return $false
  }
}

function Test-PF1MWNodeVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    return $false
  }
  $raw = (& node -p "process.versions.node" 2>$null | Select-Object -First 1)
  if ($raw -notmatch '^(\d+)\.') {
    return $false
  }
  return ([int]$Matches[1] -ge 22)
}

function Install-PF1MWNodeModules {
  param([Parameter(Mandatory = $true)][string]$AppDirectory)

  $expressPath = Join-Path $AppDirectory 'node_modules\express'
  if (Test-Path -LiteralPath $expressPath -PathType Container) {
    return $true
  }
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npm) {
    return $false
  }
  Push-Location -LiteralPath $AppDirectory
  try {
    & npm ci --no-fund --no-audit
    return ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $expressPath -PathType Container))
  } catch {
    Write-Warning "npm ci failed: $($_.Exception.Message)"
    return $false
  } finally {
    Pop-Location
  }
}

function Get-PF1MWUseApiServer {
  if (-not (Test-Path -LiteralPath $serverEntryPath -PathType Leaf)) {
    return $false
  }
  if (-not (Test-Path -LiteralPath $distIndexPath -PathType Leaf)) {
    return $false
  }
  if (-not (Test-PF1MWNodeVersion)) {
    return $false
  }
  return (Install-PF1MWNodeModules -AppDirectory $appDirectory)
}

function Start-PF1MWApiServer {
  $previousNodeEnv = $env:NODE_ENV
  $previousPort = $env:PORT
  $env:NODE_ENV = 'production'
  $env:PORT = "$port"
  try {
    Set-Location -LiteralPath $appDirectory
    & node --experimental-strip-types server.ts
    if ($LASTEXITCODE -ne 0) {
      throw "server.ts exited with code $LASTEXITCODE"
    }
  } finally {
    $env:NODE_ENV = $previousNodeEnv
    $env:PORT = $previousPort
  }
}

function Start-PF1MWStaticServer {
  $htmlBytes = [System.IO.File]::ReadAllBytes($htmlPath)
  $iconBytes = [System.IO.File]::ReadAllBytes($iconPath)
  $runtimeManifestBytes = [System.IO.File]::ReadAllBytes($runtimeManifestPath)
  $memoryTemplateBytes = [System.IO.File]::ReadAllBytes($memoryTemplatePath)
  $aiStudioAssets = @{}
  foreach ($asset in Get-ChildItem -LiteralPath $aiStudioAssetDirectory -File -Filter '*.png') {
    if ($asset.Name -notmatch '^image_[a-z0-9]+\.png$') {
      throw "The installed AI Studio asset name is invalid: $($asset.Name)"
    }
    $aiStudioAssets[$asset.Name] = [System.IO.File]::ReadAllBytes($asset.FullName)
  }
  if ($aiStudioAssets.Count -eq 0) {
    throw "No AI Studio image assets were installed: $aiStudioAssetDirectory"
  }
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  $listener.Start()
  try {
    while ($true) {
      $client = $listener.AcceptTcpClient()
      try {
        $client.ReceiveTimeout = 5000
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000
        $reader = [System.IO.StreamReader]::new(
          $stream,
          [System.Text.Encoding]::ASCII,
          $false,
          1024,
          $true
        )
        $requestLine = $reader.ReadLine()
        $contentLength = 0
        while (($header = $reader.ReadLine()) -and $header.Length -gt 0) {
          if ($header -match '^Content-Length:\s*(\d+)$') {
            $contentLength = [Math]::Min(4096, [int]$Matches[1])
          }
        }
        $bodyText = ''
        if ($contentLength -gt 0) {
          $charBuf = New-Object char[] $contentLength
          $readCount = $reader.Read($charBuf, 0, $contentLength)
          if ($readCount -gt 0) {
            $bodyText = -join $charBuf[0..($readCount - 1)]
          }
        }

        $status = '404 Not Found'
        $body = [byte[]]@()
        $contentType = 'text/plain; charset=utf-8'
        $sendBody = $true

        if ($requestLine -match '^GET /api/playtest/update-status(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $updaterPath = Join-Path $appDirectory 'Update-PF1MW.ps1'
          if (Test-Path -LiteralPath $updaterPath -PathType Leaf) {
            $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $jsonOut = (& $psExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $updaterPath -TargetDirectory $appDirectory -DryRun -Json 2>$null | Select-Object -Last 1)
            if ($jsonOut) {
              $status = '200 OK'
              $body = [System.Text.Encoding]::UTF8.GetBytes([string]$jsonOut)
              $contentType = 'application/json; charset=utf-8'
            }
          }
        } elseif ($requestLine -match '^POST /api/playtest/update(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $updaterPath = Join-Path $appDirectory 'Update-PF1MW.ps1'
          if (Test-Path -LiteralPath $updaterPath -PathType Leaf) {
            $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $updArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $updaterPath, '-TargetDirectory', $appDirectory, '-Json')
            if ($bodyText -match '"dryRun"\s*:\s*true') { $updArgs += '-DryRun' }
            if ($bodyText -match '"allKits"\s*:\s*true') { $updArgs += '-AllKits' }
            $jsonOut = (& $psExe @updArgs 2>$null | Select-Object -Last 1)
            if ($jsonOut) {
              $status = if ($LASTEXITCODE -eq 0) { '200 OK' } else { '500 Internal Server Error' }
              $body = [System.Text.Encoding]::UTF8.GetBytes([string]$jsonOut)
              $contentType = 'application/json; charset=utf-8'
            }
          }
        } elseif ($requestLine -match '^(GET|HEAD) /(chirpy\.ico|chirpy-updated\.ico|chirpy-updated\.png)(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $requestMethod = $Matches[1]
          $iconAssetName = $Matches[2]
          $iconAssetPath = Join-Path $appDirectory $iconAssetName
          if (Test-Path -LiteralPath $iconAssetPath -PathType Leaf) {
            $status = '200 OK'
            $body = [System.IO.File]::ReadAllBytes($iconAssetPath)
            $contentType = if ($iconAssetName.EndsWith('.png')) { 'image/png' } else { 'image/x-icon' }
            $sendBody = $requestMethod -eq 'GET'
          } elseif ($iconAssetName -eq 'chirpy.ico') {
            $status = '200 OK'
            $body = $iconBytes
            $contentType = 'image/x-icon'
            $sendBody = $requestMethod -eq 'GET'
          } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
          }
        } elseif ($requestLine -match '^(GET|HEAD) /runtime-manifest\.json(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $status = '200 OK'
          $body = $runtimeManifestBytes
          $contentType = 'application/json; charset=utf-8'
          $sendBody = $Matches[1] -eq 'GET'
        } elseif ($requestLine -match '^(GET|HEAD) /memory-bank-template/manifest\.json(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $status = '200 OK'
          $body = $memoryTemplateBytes
          $contentType = 'application/json; charset=utf-8'
          $sendBody = $Matches[1] -eq 'GET'
        } elseif (
          $requestLine -match '^(GET|HEAD) /character-sheet-icons/(01-flat-enamel|02-beveled-token|03-arcane-stamp|04-generic-portraits)/([a-z0-9-]+\.png)(?:\?[^ ]*)? HTTP/1\.[01]$'
        ) {
          $requestMethod = $Matches[1]
          $assetStyle = $Matches[2]
          $assetName = $Matches[3]
          $assetPath = Join-Path `
            (Join-Path $appDirectory 'character-sheet-icons') `
            (Join-Path $assetStyle $assetName)
          if (Test-Path -LiteralPath $assetPath -PathType Leaf) {
            $status = '200 OK'
            $body = [System.IO.File]::ReadAllBytes($assetPath)
            $contentType = 'image/png'
            $sendBody = $requestMethod -eq 'GET'
          } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
          }
        } elseif ($requestLine -match '^(GET|HEAD) /assets/aistudio/(image_[a-z0-9]+\.png)(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $requestMethod = $Matches[1]
          $assetName = $Matches[2]
          if ($aiStudioAssets.ContainsKey($assetName)) {
            $status = '200 OK'
            $body = $aiStudioAssets[$assetName]
            $contentType = 'image/png'
            $sendBody = $requestMethod -eq 'GET'
          } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
          }
        } elseif ($requestLine -match '^(GET|HEAD) /(launch-warning\.html|PLAYTEST_GUIDE\.html|MACRONI_XDX_BIBLE\.html)(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $requestMethod = $Matches[1]
          $docPath = Join-Path $appDirectory $Matches[2]
          if (Test-Path -LiteralPath $docPath -PathType Leaf) {
            $status = '200 OK'
            $body = [System.IO.File]::ReadAllBytes($docPath)
            $contentType = 'text/html; charset=utf-8'
            $sendBody = $requestMethod -eq 'GET'
          } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
          }
        } elseif ($requestLine -match '^(GET|HEAD) /(?:index\.html)?(?:\?[^ ]*)? HTTP/1\.[01]$') {
          $status = '200 OK'
          $body = $htmlBytes
          $contentType = 'text/html; charset=utf-8'
          $sendBody = $Matches[1] -eq 'GET'
        } elseif ($requestLine -match '^HEAD /[^ ]* HTTP/1\.[01]$') {
          $status = '404 Not Found'
          $sendBody = $false
        } else {
          $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        }

        $headers = @(
          "HTTP/1.1 $status",
          "Content-Type: $contentType",
          "Content-Length: $($body.Length)",
          'Cache-Control: no-store',
          'X-Content-Type-Options: nosniff',
          "X-PF1MW-Runtime-Version: $runtimeVersion",
          'Connection: close',
          '',
          ''
        ) -join "`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($sendBody -and $body.Length -gt 0) {
          $stream.Write($body, 0, $body.Length)
        }
        $stream.Flush()
      } catch {
        Write-Warning "Could not serve a local browser request: $($_.Exception.Message)"
      } finally {
        $client.Dispose()
      }
    }
  } finally {
    $listener.Stop()
  }
}

foreach ($requiredFile in @($htmlPath, $iconPath, $runtimeManifestPath, $memoryTemplatePath)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "A required installed runtime file is missing: $requiredFile"
  }
}
if (-not (Test-Path -LiteralPath $aiStudioAssetDirectory -PathType Container)) {
  throw "The installed AI Studio asset directory is missing: $aiStudioAssetDirectory"
}

$runtimeManifest = Get-Content -LiteralPath $runtimeManifestPath -Raw | ConvertFrom-Json -ErrorAction Stop
if ($runtimeManifest.format -ne 'pf1mw-runtime-manifest' -or $runtimeManifest.schemaVersion -ne 1) {
  throw "The installed runtime manifest has an unsupported format: $runtimeManifestPath"
}
$runtimeVersion = [string]$runtimeManifest.releaseVersion
if ($runtimeVersion -notmatch '^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$') {
  throw "The installed runtime manifest has an invalid release version: $runtimeManifestPath"
}

if ($ResetFirstRun) {
  [System.IO.File]::WriteAllText($playtestStatePath, '{"inits":0}' + "`n", [System.Text.UTF8Encoding]::new($false))
  Write-Output 'Reset playtest #inits to 0. Next launch will open the first-run warning in a private window.'
  return
}

function Get-PF1MWPlaytestInits {
  if (-not (Test-Path -LiteralPath $playtestStatePath -PathType Leaf)) {
    return 0
  }
  try {
    $parsed = Get-Content -LiteralPath $playtestStatePath -Raw | ConvertFrom-Json -ErrorAction Stop
    if ([int]$parsed.inits -ge 1) { return 1 }
    return 0
  } catch {
    return 0
  }
}

function Set-PF1MWPlaytestInits {
  param([int]$Value)
  $clamped = if ($Value -ge 1) { 1 } else { 0 }
  $payload = (@{ inits = $clamped; updatedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json) + "`n"
  [System.IO.File]::WriteAllText($playtestStatePath, $payload, [System.Text.UTF8Encoding]::new($false))
}

$useApiServer = Get-PF1MWUseApiServer

if ($Server) {
  if ($useApiServer) {
    Start-PF1MWApiServer
    return
  }
  Start-PF1MWStaticServer
  return
}

$browserPath = Get-PF1MWBrowserPath
$expectedLength = (Get-Item -LiteralPath $htmlPath).Length
$hostReady = $false
if ($useApiServer) {
  $hostReady = Test-PF1MWHttpOk -Url $apiStatusAddress
} else {
  $hostReady = Test-PF1MWHttpOk -Url $address -ExpectedLength $expectedLength
}

if (-not $hostReady) {
  $powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  if (-not (Test-Path -LiteralPath $powershellPath -PathType Leaf)) {
    throw "Windows PowerShell was not found: $powershellPath"
  }

  $serverArguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Server"
  Start-Process -FilePath $powershellPath -ArgumentList $serverArguments -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    Start-Sleep -Milliseconds 250
    if ($useApiServer) {
      if (Test-PF1MWHttpOk -Url $apiStatusAddress) {
        $ready = $true
        break
      }
    } elseif (Test-PF1MWHttpOk -Url $address -ExpectedLength $expectedLength) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "The local app server did not start at $address. Port $port may already be in use."
  }
}

$playtestInits = Get-PF1MWPlaytestInits
$launcherCommandText = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
$encodedLauncherCmd = [System.Uri]::EscapeDataString($launcherCommandText)

if ($playtestInits -eq 0) {
  Set-PF1MWPlaytestInits -Value 1
  $firstRunUrl = "${address}?playtest=1&firstRun=1&cmd=$encodedLauncherCmd"
  $privateFlag = if ([System.IO.Path]::GetFileName($browserPath) -match 'chrome\.exe') { '--incognito' } else { '--inprivate' }
  Start-Process -FilePath $browserPath -ArgumentList @($privateFlag, "--app=$firstRunUrl")
} else {
  $regularUrl = "${address}?playtest=1&kitInit=1&cmd=$encodedLauncherCmd"
  Start-Process -FilePath $browserPath -ArgumentList "--app=$regularUrl"
}
