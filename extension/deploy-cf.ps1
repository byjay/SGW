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

# ── ★ 공유폴더 배포용 언팩 폴더 자동 갱신 (배치파일 없이 "Load unpacked"로 설치) ──
$SHAREDIR = Join-Path $ROOT "_share\SeastarGW"
if (Test-Path $SHAREDIR) { Remove-Item $SHAREDIR -Recurse -Force }
New-Item -ItemType Directory -Path $SHAREDIR -Force | Out-Null
$shareIncludes = @('manifest.json', 'background', 'content', 'icons', 'lib', 'sidepanel', 'options')
foreach ($p in $shareIncludes) {
  $src = Join-Path $ROOT $p
  if (Test-Path $src -PathType Container) { Copy-Item $src (Join-Path $SHAREDIR $p) -Recurse -Force }
  else { Copy-Item $src $SHAREDIR -Force }
}
$guideHtml = @'
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Seastar GW 설치 방법</title>
<style>
  body{font-family:'Malgun Gothic',Pretendard,sans-serif;background:#0e0e0e;color:#f2f2f2;max-width:640px;margin:40px auto;padding:0 24px;line-height:1.7}
  h1{color:#3ecf8e;font-size:26px;margin-bottom:4px}
  .sub{color:#aeaeae;font-size:14px;margin-bottom:28px}
  .step{background:#181818;border:1px solid #2b2b2b;border-radius:12px;padding:20px 22px;margin-bottom:16px;display:flex;gap:16px;align-items:flex-start}
  .num{background:#0e7a4d;color:#fff;font-weight:800;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px}
  .step h3{margin:0 0 6px;font-size:16px;color:#f2f2f2}
  .step p{margin:0;color:#cfcfcf;font-size:14px}
  code{background:#0e0e0e;color:#3ecf8e;padding:2px 8px;border-radius:4px;font-size:14px}
  .note{background:rgba(62,207,142,.08);border:1px solid rgba(62,207,142,.25);border-radius:10px;padding:14px 18px;margin-top:24px;font-size:13px;color:#bfebd5}
  .warn{background:rgba(217,119,87,.1);border:1px solid rgba(217,119,87,.3);border-radius:10px;padding:14px 18px;margin-top:12px;font-size:13px;color:#f3c9b3}
</style>
</head>
<body>
  <h1>&#11088; Seastar Groupware 설치</h1>
  <div class="sub">딱 4단계, 관리자 권한도 재시작도 필요 없습니다. (약 1분) &middot; v__VER__</div>

  <div class="step">
    <div class="num">1</div>
    <div><h3>Chrome 주소창에 아래 주소 입력</h3>
      <p><code>chrome://extensions</code> 입력 후 엔터</p></div>
  </div>

  <div class="step">
    <div class="num">2</div>
    <div><h3>오른쪽 위 "개발자 모드" 켜기</h3>
      <p>화면 우측 상단의 스위치를 클릭해서 켜주세요 (파란색으로 바뀜)</p></div>
  </div>

  <div class="step">
    <div class="num">3</div>
    <div><h3>"압축해제된 확장 프로그램을 로드합니다" 클릭</h3>
      <p>왼쪽 위에 새로 생긴 버튼을 누르고, <b>지금 이 파일이 들어있는 폴더</b>(SeastarGW)를 선택하세요.</p></div>
  </div>

  <div class="step">
    <div class="num">4</div>
    <div><h3>완료! 툴바에 별 아이콘이 생깁니다</h3>
      <p>아이콘을 클릭하면 사이드패널이 열립니다. 회사 이메일 + 초기 비밀번호 <code>1</code>로 로그인하세요.</p></div>
  </div>

  <div class="note">
    &#128161; <b>새 버전으로 업데이트하는 법</b> — 공유폴더의 파일이 새 버전으로 바뀐 뒤에는,
    <code>chrome://extensions</code> 페이지에서 이 확장 카드의 &#128260;(새로고침) 아이콘을 한 번 눌러주세요.
    (또는 크롬을 완전히 껐다 켜도 됩니다) 버튼을 누르지 않으면 이전 버전이 계속 쓰입니다.
  </div>
  <div class="warn">
    &#9888;&#65039; 크롬이 가끔 "개발자 모드 확장 프로그램" 알림 배너를 띄울 수 있는데, 무시하셔도 됩니다(정상입니다).
  </div>
</body>
</html>
'@
$guideHtml = $guideHtml.Replace('__VER__', $ver)
[System.IO.File]::WriteAllText((Join-Path $SHAREDIR "설치방법.html"), $guideHtml, [System.Text.UTF8Encoding]::new($false))
Write-Host "[Share] 공유폴더용 언팩 패키지 갱신: $SHAREDIR (v$ver)" -ForegroundColor Green

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

# Landing page (SEcMS 그린 브랜드 통일)
$indexHtml = @'
<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seastar GW 설치</title>
<style>body{font-family:system-ui,Pretendard,sans-serif;background:#0e0e0e;color:#f2f2f2;padding:40px 20px;text-align:center;line-height:1.6}
.wrap{max-width:640px;margin:0 auto}h1{color:#3ecf8e;margin:0 0 8px}
.btn{display:inline-block;background:#0e7a4d;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:800;margin:8px}
.card{background:#181818;border:1px solid #2b2b2b;border-radius:10px;padding:20px;margin:14px 0;text-align:left}
ol{padding-left:24px;line-height:1.9}code{background:#0e0e0e;padding:2px 6px;border-radius:4px;color:#3ecf8e}
.muted{color:#aeaeae;font-size:12px}</style>
</head><body><div class="wrap">
<h1>⭐ Seastar Groupware</h1>
<p class="muted">사내 통합 도우미 확장앱 · v__VER__</p>
<a class="btn" href="/install-internal.bat" download>📥 IT 관리자용 자동 설치 (.bat)</a>
<a class="btn" style="background:#27b074" href="/swgs-latest.crx" download>📦 CRX 다운로드</a>
<a class="btn" style="background:#3a3a3a" href="/swgs-latest.zip" download>📂 ZIP 다운로드</a>
<div class="card"><h3 style="color:#3ecf8e;margin-top:0">방법 A · 자동 설치 (권장, Chrome·Edge)</h3>
<ol><li><b>install-internal.bat</b> 다운로드</li><li>우클릭 → <b>관리자 권한으로 실행</b></li><li>설치할 브라우저 선택(Chrome/Edge/둘 다)</li><li>브라우저 완전 종료 후 재시작 → 자동 설치</li><li>이후 모든 업데이트 자동 적용</li></ol></div>
<div class="card"><h3 style="color:#3ecf8e;margin-top:0">방법 B · 수동 설치 (Whale 필수, 개발자 모드)</h3>
<ol><li>Whale은 정책 자동설치 미지원 확인됨 — 아래 방법 필수</li><li><b>ZIP</b> 다운로드 후 압축 해제</li><li><code>chrome://extensions</code> 접속 → 개발자 모드 ON</li><li><b>압축해제된 확장 프로그램 로드</b> → 해제한 폴더 선택</li><li>새 버전 나올 때마다 수동으로 새로고침 필요(자동업데이트 안 됨)</li></ol></div>
<div class="card"><h3 style="color:#3ecf8e;margin-top:0">첫 사용</h3>
<ol><li>툴바의 SEASTAR 아이콘 클릭 → 사이드패널 열림</li><li>회사 이메일 + 초기 비밀번호 <code>1</code>로 로그인 (그룹웨어 창이 열립니다)</li><li>로그인하면 사이드패널이 자동 연결 — 이후 컴퓨터를 켤 때마다 자동 로그인 유지</li><li><b>🏠 앱</b> 탭에서 그룹웨어 전체 기능 사용, <b>🗖 전체화면</b>으로 새 탭 이동 가능</li></ol></div>
<p class="muted">Extension ID: <code id="eid">__EID__</code> · 문의: designsir@seastargo.com</p>
</div></body></html>
'@
$indexHtml = $indexHtml.Replace('__VER__', $ver).Replace('__EID__', $extId)
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "index.html"), $indexHtml, [System.Text.UTF8Encoding]::new($false))

$headers = @"
/version.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=60
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
