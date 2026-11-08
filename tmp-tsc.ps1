npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
  Write-Output "TSC_PASS"
} else {
  Write-Output "TSC_FAIL exit=$LASTEXITCODE"
}
