<#
.SYNOPSIS
Downloads the pinned Aether release binary for Windows into src-tauri/binaries/,
verified against its published SHA256SUMS.txt.

.DESCRIPTION
The Windows counterpart to fetch-aether.sh. Run it before `tauri dev` or
`tauri build`; without it the app builds fine but boots straight into its
"engine missing" screen, because Aether-GUI drives the real aether executable
and does not vendor it.

Both scripts read the same AETHER_VERSION file, so the pin can only ever be
bumped in one place — an earlier split between this script and the workflow
was exactly how a local Windows build silently shipped with no engine.
#>
[CmdletBinding()]
param(
    # Overrides the pinned version, e.g. -Version v1.7.0.
    [string]$Version,
    # Re-download even when src-tauri/binaries/aether.exe already exists.
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$destDir = $PSScriptRoot
$dest = Join-Path $destDir "aether.exe"

if ((Test-Path $dest) -and -not $Force) {
    Write-Host "Aether binary already present at $dest (use -Force to re-download)."
    exit 0
}

if (-not $Version) {
    $pinFile = Join-Path $destDir "AETHER_VERSION"
    if (-not (Test-Path $pinFile)) { throw "Missing version pin: $pinFile" }
    $Version = (Get-Content $pinFile -First 1).Trim()
}

$asset = if ($env:AETHER_ASSET) { $env:AETHER_ASSET } else { "aether-windows-x86_64.zip" }
$base = "https://github.com/CluvexStudio/Aether/releases/download/$Version"

# A temp dir keeps the archive, the checksum file and the extracted tree out
# of binaries/ — anything left there gets swept into the bundle by
# tauri.conf.json's "resources": ["binaries/*"] glob.
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("aether-fetch-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null

try {
    $zip = Join-Path $work $asset
    $sums = Join-Path $work "SHA256SUMS.txt"

    Write-Host "Downloading $asset ($Version)..."
    Invoke-WebRequest -Uri "$base/$asset" -OutFile $zip -UseBasicParsing
    Invoke-WebRequest -Uri "$base/SHA256SUMS.txt" -OutFile $sums -UseBasicParsing

    # Match the filename field exactly rather than substring-matching the
    # line — the release also publishes per-asset .sha256 files, and a bare
    # match would happily pick one of those up if they landed in this list.
    $expected = $null
    foreach ($line in Get-Content $sums) {
        $f = ($line -split '\s+') | Where-Object { $_ }
        if ($f.Count -ge 2 -and ($f[1] -eq $asset -or $f[1] -eq "*$asset")) {
            $expected = $f[0].ToLower()
            break
        }
    }
    if (-not $expected) { throw "$asset is not listed in SHA256SUMS.txt for $Version" }
    $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        throw "Checksum verification failed for ${asset}: $actual != $expected"
    }

    Expand-Archive -Path $zip -DestinationPath (Join-Path $work "extract") -Force
    $exe = Get-ChildItem -Path (Join-Path $work "extract") -Filter "aether.exe" -Recurse |
        Select-Object -First 1
    if (-not $exe) { throw "aether.exe not found inside $asset" }

    Move-Item -Path $exe.FullName -Destination $dest -Force
    Write-Host "Aether binary ready at $dest"
} finally {
    Remove-Item -Path $work -Recurse -Force -ErrorAction SilentlyContinue
}
