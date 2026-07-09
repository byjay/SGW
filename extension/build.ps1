# Seastar GW Extension - Build
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILDDIR = Join-Path $ROOT "_build"

$manifest = Get-Content (Join-Path $ROOT "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $manifest.version
$zipName = "swgs-v" + $ver + ".zip"
$zipPath = Join-Path $BUILDDIR $zipName
if (-not (Test-Path $BUILDDIR)) { New-Item -ItemType Directory -Path $BUILDDIR | Out-Null }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$includePatterns = @('manifest.json', 'background/*', 'content/*', 'icons/icon-*.png', 'lib/*', 'sidepanel/*', 'options/*')

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs  = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
$count = 0
foreach ($pat in $includePatterns) {
  Get-ChildItem -Path (Join-Path $ROOT $pat) -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring($ROOT.Length + 1).Replace('\', '/')
    $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $es = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $es.Write($bytes, 0, $bytes.Length); $es.Close()
    $count++
  }
}
$zip.Dispose(); $fs.Close()
$kb = [math]::Round((Get-Item $zipPath).Length / 1024, 1)
Write-Host ("[Build] Files: " + $count + ", Size: " + $kb + " KB") -ForegroundColor Green
Write-Host ("[Build] ZIP : " + $zipPath) -ForegroundColor Green
