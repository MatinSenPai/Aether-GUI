# Downloads the pinned Aether release binary for Windows into
# src-tauri/binaries/, verified against its published SHA256SUMS.txt.
# Run this before `tauri dev` / `tauri build` (wire into CI for each target).
$ErrorActionPreference = "Stop"

$AetherVersion = "v1.2.0"
$Repo          = "CluvexStudio/Aether"
$DestDir       = Split-Path -Parent $MyInvocation.MyCommand.Path

$Asset    = "aether-windows-x86_64.zip"
$Url      = "https://github.com/$Repo/releases/download/$AetherVersion/$Asset"
$SumsUrl  = "https://github.com/$Repo/releases/download/$AetherVersion/SHA256SUMS.txt"
$TmpDir   = Join-Path $DestDir "_tmp_aether"

Write-Host "Downloading Aether $AetherVersion for Windows..."
Invoke-WebRequest -Uri $Url -OutFile (Join-Path $DestDir $Asset) -UseBasicParsing

Write-Host "Downloading SHA256 checksums..."
$SumsContent = (Invoke-WebRequest -Uri $SumsUrl -UseBasicParsing).Content

Write-Host "Verifying checksum..."
$Expected = ($SumsContent -split "`n" | Where-Object { $_ -match $Asset } | Select-Object -First 1) -replace "\s+.*", ""
$Hash = (Get-FileHash (Join-Path $DestDir $Asset) -Algorithm SHA256).Hash.ToLower()
if ($Hash -ne $Expected.ToLower()) {
    Remove-Item (Join-Path $DestDir $Asset) -Force -ErrorAction SilentlyContinue
    Write-Error "Checksum verification failed for $Asset`n  Expected: $Expected`n  Got:      $Hash"
}

Write-Host "Extracting Aether..."
Expand-Archive -Path (Join-Path $DestDir $Asset) -DestinationPath $TmpDir -Force

$AetherExe = Get-ChildItem -Path $TmpDir -Recurse -Filter "aether.exe" | Select-Object -First 1
if ($AetherExe) {
    Copy-Item $AetherExe.FullName (Join-Path $DestDir "aether.exe") -Force
    Write-Host "aether.exe ready"
} else {
    Write-Error "aether.exe not found in archive"
}

# Cleanup
Remove-Item (Join-Path $DestDir $Asset) -Force -ErrorAction SilentlyContinue
Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Aether binary ready at $DestDir\aether.exe"
