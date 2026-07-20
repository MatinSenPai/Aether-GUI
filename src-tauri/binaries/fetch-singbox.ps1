# Downloads the pinned sing-box release binary and wintun.dll for Windows
# into src-tauri/binaries/.
# Run this before `tauri dev` / `tauri build` (wire into CI for each target).
$ErrorActionPreference = "Stop"

$SingboxVersion = "1.13.14"
$WintunVersion  = "0.14.1"
$DestDir        = Split-Path -Parent $MyInvocation.MyCommand.Path

$Archive   = "sing-box-$SingboxVersion-windows-amd64.zip"
$Url       = "https://github.com/SagerNet/sing-box/releases/download/v$SingboxVersion/$Archive"
$TmpDir    = Join-Path $DestDir "_tmp_singbox"

Write-Host "Downloading sing-box $SingboxVersion for windows-amd64..."
Invoke-WebRequest -Uri $Url -OutFile (Join-Path $DestDir $Archive) -UseBasicParsing

Write-Host "Extracting sing-box..."
Expand-Archive -Path (Join-Path $DestDir $Archive) -DestinationPath $TmpDir -Force

# Copy sing-box.exe
$SbExe = Get-ChildItem -Path $TmpDir -Recurse -Filter "sing-box.exe" | Select-Object -First 1
if ($SbExe) {
    Copy-Item $SbExe.FullName (Join-Path $DestDir "sing-box.exe") -Force
    Write-Host "sing-box.exe ready"
} else {
    Write-Error "sing-box.exe not found in archive"
}

# Copy libcronet.dll (Chromium network stack for QUIC/HTTP3 support)
$CronetDll = Get-ChildItem -Path $TmpDir -Recurse -Filter "libcronet.dll" | Select-Object -First 1
if ($CronetDll) {
    Copy-Item $CronetDll.FullName (Join-Path $DestDir "libcronet.dll") -Force
    Write-Host "libcronet.dll ready"
}

# Copy wintun.dll if present in the archive
$WintunDll = Get-ChildItem -Path $TmpDir -Recurse -Filter "wintun.dll" | Select-Object -First 1
if ($WintunDll) {
    Copy-Item $WintunDll.FullName (Join-Path $DestDir "wintun.dll") -Force
    Write-Host "wintun.dll extracted from sing-box archive"
}

# Download wintun.dll from wintun.net if not present
if (-not (Test-Path (Join-Path $DestDir "wintun.dll"))) {
    Write-Host "Downloading wintun $WintunVersion..."
    $WintunArchive = "wintun-$WintunVersion.zip"
    $WintunUrl     = "https://www.wintun.net/builds/$WintunArchive"
    Invoke-WebRequest -Uri $WintunUrl -OutFile (Join-Path $DestDir $WintunArchive) -UseBasicParsing

    $WintunTmp = Join-Path $DestDir "_tmp_wintun"
    Expand-Archive -Path (Join-Path $DestDir $WintunArchive) -DestinationPath $WintunTmp -Force

    $WintunDll = Get-ChildItem -Path $WintunTmp -Recurse -Filter "wintun.dll" | Where-Object {
        $_.DirectoryName -match "amd64"
    } | Select-Object -First 1

    if (-not $WintunDll) {
        $WintunDll = Get-ChildItem -Path $WintunTmp -Recurse -Filter "wintun.dll" | Select-Object -First 1
    }

    if ($WintunDll) {
        Copy-Item $WintunDll.FullName (Join-Path $DestDir "wintun.dll") -Force
        Write-Host "wintun.dll ready"
    } else {
        Write-Warning "Could not find wintun.dll in archive"
    }

    Remove-Item (Join-Path $DestDir $WintunArchive) -Force -ErrorAction SilentlyContinue
    Remove-Item $WintunTmp -Recurse -Force -ErrorAction SilentlyContinue
}

# Cleanup
Remove-Item (Join-Path $DestDir $Archive) -Force -ErrorAction SilentlyContinue
Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "All binaries ready at $DestDir"
