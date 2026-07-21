param(
    [string]$DestDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$AetherVersion = "v1.3.0"
$Repo = "CluvexStudio/Aether"
$AssetName = "aether-windows-x86_64.zip"
$BaseUrl = "https://github.com/$Repo/releases/download/$AetherVersion"

# Windows PowerShell 5.1 can otherwise negotiate an obsolete TLS version on
# older machines. GitHub requires modern TLS.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-DownloadWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [int]$Attempts = 3
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            Remove-Item $OutFile -Force -ErrorAction SilentlyContinue
            Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 90
            if (-not (Test-Path $OutFile) -or (Get-Item $OutFile).Length -le 0) {
                throw "Downloaded file is empty: $OutFile"
            }
            return
        }
        catch {
            Remove-Item $OutFile -Force -ErrorAction SilentlyContinue
            if ($attempt -eq $Attempts) {
                throw
            }
            Start-Sleep -Seconds (2 * $attempt)
        }
    }
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aether-gui-fetch-" + [guid]::NewGuid().ToString("N"))
$ArchivePath = Join-Path $TempDir $AssetName
$SumsPath = Join-Path $TempDir "SHA256SUMS.txt"
$ExtractDir = Join-Path $TempDir "extract"
$Target = Join-Path $DestDir "aether.exe"

New-Item -ItemType Directory -Force -Path $TempDir, $ExtractDir | Out-Null

try {
    Write-Host "Downloading Aether $AetherVersion ($AssetName)..."
    Invoke-DownloadWithRetry -Uri "$BaseUrl/$AssetName" -OutFile $ArchivePath
    Invoke-DownloadWithRetry -Uri "$BaseUrl/SHA256SUMS.txt" -OutFile $SumsPath

    $ChecksumLine = Get-Content $SumsPath |
        Where-Object { $_ -match ("\s" + [regex]::Escape($AssetName) + "$") } |
        Select-Object -First 1
    if (-not $ChecksumLine) {
        throw "No checksum entry found for $AssetName"
    }

    $Expected = ($ChecksumLine -split "\s+")[0].ToLowerInvariant()
    $Actual = (Get-FileHash $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -ne $Expected) {
        throw "Checksum mismatch for $AssetName`: $Actual != $Expected"
    }

    Expand-Archive -Path $ArchivePath -DestinationPath $ExtractDir -Force
    $DownloadedExe = Get-ChildItem -Path $ExtractDir -Recurse -Filter "aether.exe" | Select-Object -First 1
    if (-not $DownloadedExe -or $DownloadedExe.Length -le 0) {
        throw "aether.exe was not found or is empty inside $AssetName"
    }

    $TemporaryTarget = "$Target.new"
    Remove-Item $TemporaryTarget -Force -ErrorAction SilentlyContinue
    Copy-Item $DownloadedExe.FullName $TemporaryTarget -Force
    if ((Get-Item $TemporaryTarget).Length -le 0) {
        throw "Prepared Aether binary is empty"
    }

    Remove-Item $Target -Force -ErrorAction SilentlyContinue
    Move-Item $TemporaryTarget $Target -Force
    Write-Host "Aether binary ready at $Target (SHA-256 verified)"
}
finally {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
