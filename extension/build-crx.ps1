# Seastar GW - CRX Builder
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILDDIR = Join-Path $ROOT "_build"
# swgs/ 자체 폴더 안의 .keys/ 사용 (자체 완결)
$KEYDIR = Join-Path (Split-Path -Parent $ROOT) ".keys"
$KEY = Join-Path $KEYDIR "swgs.pem"
$STAGE = Join-Path $BUILDDIR "crx-stage"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) { throw "chrome.exe not found" }

if (-not (Test-Path $BUILDDIR)) { New-Item -ItemType Directory -Path $BUILDDIR | Out-Null }
if (-not (Test-Path $KEYDIR))   { New-Item -ItemType Directory -Path $KEYDIR | Out-Null }

$manifest = Get-Content (Join-Path $ROOT "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $manifest.version
Write-Host "[CRX] Seastar GW v$ver" -ForegroundColor Cyan

if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
$exclude = @('_build', '_deploy', 'node_modules', '.git', 'README.md', 'build*.ps1', 'deploy*.ps1', 'install*.bat', 'uninstall*.bat')
Get-ChildItem $ROOT | Where-Object { $name = $_.Name; -not ($exclude | Where-Object { $name -like $_ }) } | ForEach-Object {
  Copy-Item $_.FullName -Destination $STAGE -Recurse -Force
}

$args = @("--pack-extension=`"$STAGE`"")
if (Test-Path $KEY) { $args += "--pack-extension-key=`"$KEY`"" }

Start-Process -FilePath $chrome -ArgumentList $args -Wait -WindowStyle Hidden
Start-Sleep -Seconds 2

$generatedCrx = $STAGE + ".crx"
$generatedPem = $STAGE + ".pem"
if (-not (Test-Path $generatedCrx)) { throw "CRX 생성 실패" }

$crxName = "swgs-v$ver.crx"
$crxPath = Join-Path $BUILDDIR $crxName
$crxLatest = Join-Path $BUILDDIR "swgs-latest.crx"
Move-Item $generatedCrx $crxPath -Force
Copy-Item $crxPath $crxLatest -Force
if ((Test-Path $generatedPem) -and (-not (Test-Path $KEY))) { Move-Item $generatedPem $KEY -Force; Write-Host "[CRX] Key saved: $KEY" -ForegroundColor Green }
elseif (Test-Path $generatedPem) { Remove-Item $generatedPem -Force }

Remove-Item $STAGE -Recurse -Force -ErrorAction SilentlyContinue
$kb = [math]::Round((Get-Item $crxPath).Length / 1024, 1)
Write-Host ("[CRX] " + $crxName + " (" + $kb + " KB)") -ForegroundColor Green
