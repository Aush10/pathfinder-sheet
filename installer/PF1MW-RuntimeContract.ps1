# Shared allowlist and required entries for Package-PF1MW.ps1 and Install-PF1MW.ps1.
# Start-PF1MW.ps1 stays self-contained inside the zip and does not dot-source this file.
# Never allow node_modules, .env, .env.local, or src/.

function Get-PF1MWInstalledApiPort {
  38173
}

function Get-PF1MWPackagedServerFiles {
  @(
    'server.ts',
    'package.json',
    'package-lock.json',
    '.env.example',
    'server/env.ts',
    'server/lockFiles.ts',
    'server/openai.ts',
    'server/prompts.ts',
    'server/routes.ts',
    'server/sotContext.ts',
    'server/ingest/http.ts',
    'server/ingest/index.ts',
    'server/ingest/ingest.ts',
    'server/ingest/output-schemas.json'
  )
}

function Get-PF1MWRequiredRuntimeEntries {
  @(
    'index.html',
    'chirpy.ico',
    'Start-PF1MW.ps1',
    'runtime-manifest.json',
    'memory-bank-template/manifest.json'
  ) + (Get-PF1MWPackagedServerFiles) + @(
    'dist/index.html'
  )
}

function Test-PF1MWAllowedRuntimeEntry {
  param([Parameter(Mandatory = $true)][string]$Path)

  $name = $Path.Replace('\', '/')
  if (
    [string]::IsNullOrWhiteSpace($name) -or
    $name.Contains('..') -or
    $name.StartsWith('/') -or
    $name -match '/{2,}'
  ) {
    return $false
  }

  switch -Regex ($name) {
    '^(index\.html|chirpy\.ico|Start-PF1MW\.ps1|runtime-manifest\.json|package\.json|package-lock\.json|\.env\.example|server\.ts)$' {
      return $true
    }
    '^memory-bank-template/manifest\.json$' { return $true }
    '^character-sheet-icons/(01-flat-enamel|02-beveled-token|03-arcane-stamp|04-generic-portraits)/[a-z0-9-]+\.png$' {
      return $true
    }
    '^assets/aistudio/image_[a-z0-9]+\.png$' { return $true }
    '^server/(env|lockFiles|openai|prompts|routes|sotContext)\.ts$' { return $true }
    '^server/ingest/(http|index|ingest)\.ts$' { return $true }
    '^server/ingest/output-schemas\.json$' { return $true }
    '^dist/index\.html$' { return $true }
    '^dist/chirpy\.ico$' { return $true }
    '^dist/memory-bank-template/manifest\.json$' { return $true }
    '^dist/assets/[A-Za-z0-9._-]+\.(js|css)$' { return $true }
    '^dist/assets/aistudio/image_[a-z0-9]+\.png$' { return $true }
    '^dist/character-sheet-icons/(01-flat-enamel|02-beveled-token|03-arcane-stamp|04-generic-portraits)/[a-z0-9-]+\.png$' {
      return $true
    }
    default { return $false }
  }
}
