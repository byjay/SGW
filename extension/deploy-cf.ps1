# Seastar GW - Cloudflare Pages Deploy
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILDDIR = Join-Path $ROOT "_build"
$DEPLOY = Join-Path $ROOT "_deploy"
$PROJECT = "swgs-internal"

Write-Host "=== Seastar GW Deploy ===" -ForegroundColor Cyan

& powershell -ExecutionPolicy Bypass -File (Join-Path $ROOT "build.ps1")
& powershell -ExecutionPolicy Bypass -File (Join-Path $ROOT "build-crx.ps1")

$manifest = Get-Content (Join-Path $ROOT "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $manifest.version
$zipName = "swgs-v" + $ver + ".zip"
$crxName = "swgs-v" + $ver + ".crx"
$zipPath = Join-Path $BUILDDIR $zipName
$crxPath = Join-Path $BUILDDIR $crxName
$crxLatest = Join-Path $BUILDDIR "swgs-latest.crx"

if (Test-Path $DEPLOY) { Remove-Item $DEPLOY -Recurse -Force }
New-Item -ItemType Directory -Path $DEPLOY | Out-Null

Copy-Item $zipPath (Join-Path $DEPLOY $zipName) -Force
Copy-Item $zipPath (Join-Path $DEPLOY "swgs-latest.zip") -Force
if (Test-Path $crxPath)   { Copy-Item $crxPath   (Join-Path $DEPLOY $crxName) -Force }
if (Test-Path $crxLatest) { Copy-Item $crxLatest (Join-Path $DEPLOY "swgs-latest.crx") -Force }
Copy-Item (Join-Path $ROOT "install-internal.bat") (Join-Path $DEPLOY "install-internal.bat") -Force -ErrorAction SilentlyContinue

# version.json
$verJson = @{
  version = $ver
  zip = "/swgs-v$ver.zip"
  zip_latest = "/swgs-latest.zip"
  crx = "/swgs-v$ver.crx"
  crx_latest = "/swgs-latest.crx"
  changelog = "v$ver"
  updated = (Get-Date -Format "yyyy-MM-dd HH:mm")
} | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "version.json"), $verJson, [System.Text.UTF8Encoding]::new($false))

# updates.xml (정확한 Extension ID)
$idFile = Join-Path $BUILDDIR "extension-id.txt"
$extId = if (Test-Path $idFile) { (Get-Content $idFile -Raw).Trim() } else { "ajlojcldaocimafbolojgokhpdfhkpkb" }
$crxUrl = "https://$PROJECT.pages.dev/swgs-latest.crx"
$updatesXml = @"
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$extId'>
    <updatecheck codebase='$crxUrl' version='$ver' />
  </app>
</gupdate>
"@
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "updates.xml"), $updatesXml, [System.Text.UTF8Encoding]::new($false))

# Landing page
$indexHtml = @'
<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>Seastar GW</title>
<style>body{font-family:system-ui;background:#0d1117;color:#c9d1d9;padding:40px 20px;text-align:center}
.wrap{max-width:600px;margin:0 auto}h1{color:#2f81f7;margin:0 0 8px}
.btn{display:inline-block;background:#2f81f7;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:800;margin:8px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:14px 0;text-align:left}
ol{padding-left:24px;line-height:1.8}code{background:#0d1117;padding:2px 6px;border-radius:3px}</style>
</head><body><div class="wrap">
<h1>⭐ Seastar Groupware</h1>
<p style="color:#8b949e">사내 통합 도우미 v__VER__</p>
<a class="btn" href="/install-internal.bat" download>📥 IT 관리자: 자동 설치 .bat</a>
<a class="btn" style="background:#3dc96b" href="/swgs-latest.crx" download>📦 CRX</a>
<a class="btn" style="background:#a371f7" href="/swgs-latest.zip" download>📂 ZIP</a>
<div class="card"><h3 style="color:#2f81f7;margin-top:0">자동 설치 (관리자)</h3>
<ol><li>install-internal.bat 다운로드</li><li>관리자 권한으로 실행</li><li>브라우저 재시작 → 자동 설치</li><li>이후 모든 업데이트 자동</li></ol></div>
<p style="color:#8b949e;font-size:11px">Extension ID: <code id="eid">__EID__</code></p>
</div></body></html>
'@
$indexHtml = $indexHtml.Replace('__VER__', $ver).Replace('__EID__', $extId)
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "index.html"), $indexHtml, [System.Text.UTF8Encoding]::new($false))

$headers = @"
/version.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300
/updates.xml
  Access-Control-Allow-Origin: *
  Content-Type: application/xml; charset=utf-8
/swgs-*.crx
  Content-Type: application/x-chrome-extension
  Cache-Control: public, max-age=600
/swgs-*.zip
  Cache-Control: public, max-age=3600
"@
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "_headers"), $headers, [System.Text.UTF8Encoding]::new($false))

Write-Host "[Deploy] Staged at $DEPLOY" -ForegroundColor Green
Push-Location $ROOT
try {
  npx wrangler pages deploy $DEPLOY --project-name=$PROJECT --commit-dirty=true 2>&1
  Write-Host "  Landing : https://$PROJECT.pages.dev/" -ForegroundColor Cyan
  Write-Host "  CRX     : https://$PROJECT.pages.dev/swgs-latest.crx" -ForegroundColor Cyan
  Write-Host "  Updates : https://$PROJECT.pages.dev/updates.xml" -ForegroundColor Cyan
} finally { Pop-Location }
