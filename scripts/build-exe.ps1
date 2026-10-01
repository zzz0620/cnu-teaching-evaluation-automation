$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $root "release"
$exePath = Join-Path $releaseDir "cnu-teaching-evaluation-automation.exe"
$blobPath = Join-Path $root "dist\sea-prep.blob"
$nodePath = (Get-Command node).Source

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
Copy-Item -LiteralPath $nodePath -Destination $exePath -Force
Push-Location $root
try {
  npx postject ".\release\cnu-teaching-evaluation-automation.exe" NODE_SEA_BLOB ".\dist\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite
} finally {
  Pop-Location
}

Copy-Item -LiteralPath (Join-Path $root "evaluation.config.example.json") -Destination (Join-Path $releaseDir "evaluation.config.example.json") -Force
Copy-Item -LiteralPath (Join-Path $root "LICENSE") -Destination (Join-Path $releaseDir "LICENSE.txt") -Force
Copy-Item -LiteralPath (Join-Path $root "NOTICE.md") -Destination (Join-Path $releaseDir "NOTICE.md") -Force
Copy-Item -LiteralPath (Join-Path $root "THIRD_PARTY_NOTICES.md") -Destination (Join-Path $releaseDir "THIRD_PARTY_NOTICES.md") -Force
$thirdPartyZip = Join-Path $releaseDir "third-party-licenses.zip"
if (Test-Path -LiteralPath $thirdPartyZip) {
  Remove-Item -LiteralPath $thirdPartyZip -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $root "third_party_licenses"), $thirdPartyZip)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($exePath)
try {
  $hashBytes = $sha256.ComputeHash($stream)
  $hash = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
} finally {
  $stream.Dispose()
  $sha256.Dispose()
}
Set-Content -LiteralPath (Join-Path $releaseDir "SHA256SUMS.txt") -Value "$hash  cnu-teaching-evaluation-automation.exe" -Encoding ascii
Write-Host "Built $exePath"
