# Checks the files of an eQMS backup export package against PACKAGE-SHA256SUMS on Windows.
# It does NOT check the signatures: Windows PowerShell has no Ed25519. Use tools/verify-chain.sh (needs openssl 3) for that.
param([string]$Folder = ".")
Set-Location $Folder
$bad = 0; $count = 0
Get-Content PACKAGE-SHA256SUMS | ForEach-Object {
  if ($_ -match '^([0-9a-f]{64})  (.+)$') {
    $count++
    $want = $Matches[1]; $path = $Matches[2]
    if (-not (Test-Path -LiteralPath $path)) { Write-Host "MISSING  $path"; $bad++ }
    elseif ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower() -ne $want) { Write-Host "CHANGED  $path"; $bad++ }
  }
}
if ($bad -eq 0) { Write-Host "OK: $count files match. Signatures were not checked; run verify-chain.sh for that." } else { Write-Host "FAILED: $bad of $count files do not match. Do not use this package."; exit 1 }
