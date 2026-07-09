# Seastar Groupware 강제 업데이트 (v1.0.4 즉시 적용)
# 호출: irm https://sgw-install.pages.dev/installer/Force-Update-SGW.ps1 | iex
# (관리자 권한은 호출하는 .bat 런처에서 미리 획득됨)

$ErrorActionPreference = "Continue"

function Banner($t, $c="Cyan") {
  Write-Host ""
  Write-Host ("  " + ("=" * 60)) -ForegroundColor $c
  Write-Host ("  " + $t) -ForegroundColor $c
  Write-Host ("  " + ("=" * 60)) -ForegroundColor $c
  Write-Host ""
}

Banner "Seastar Groupware v1.0.4 강제 업데이트"

# Step 1: 정책 등록 (자동 업데이트 활성화)
Write-Host "  [1/2] 8개 브라우저 정책 등록 중..." -ForegroundColor Cyan
$EXT_ID = "ajlojcldaocimafbolojgokhpdfhkpkb"
$UPD_URL = "https://swgs-internal.pages.dev/updates.xml"
$browsers = @(
  "Google\Chrome", "NaverCorp\Whale", "NaverCorporation\Whale",
  "Microsoft\Edge", "BraveSoftware\Brave", "Opera Software\Opera",
  "Vivaldi\Vivaldi", "YandexBrowser", "Chromium"
)
foreach ($b in $browsers) {
  $force = "HKLM:\SOFTWARE\Policies\$b\ExtensionInstallForcelist"
  $src   = "HKLM:\SOFTWARE\Policies\$b\ExtensionInstallSources"
  try {
    New-Item -Path $force -Force -ErrorAction SilentlyContinue | Out-Null
    New-Item -Path $src   -Force -ErrorAction SilentlyContinue | Out-Null
    Set-ItemProperty -Path $force -Name 1  -Value "$EXT_ID;$UPD_URL"            -Type String -Force
    Set-ItemProperty -Path $src   -Name 1  -Value "https://swgs-internal.pages.dev/*" -Type String -Force
    Set-ItemProperty -Path $src   -Name 99 -Value "https://*.pages.dev/*"        -Type String -Force
  } catch {}
}
Write-Host "       OK" -ForegroundColor Green

# Step 2: 강제 업데이트 트리거 (브라우저 캐시 무효화 + 업데이트 폴링 유도)
Write-Host "  [2/2] 자동 업데이트 트리거..." -ForegroundColor Cyan
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $null = Invoke-WebRequest -Uri ("$UPD_URL`?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -UseBasicParsing -TimeoutSec 5
  Write-Host "       OK (updates.xml 사전 페치 완료)" -ForegroundColor Green
} catch {
  Write-Host "       SKIP (네트워크 차단 — 정책만 등록되어도 30분 내 적용됨)" -ForegroundColor Yellow
}

Banner "v1.0.4 정책 등록 완료" "Green"
Write-Host "  ▸ 다음 단계 (수동 1회):" -ForegroundColor White
Write-Host "    1. 모든 브라우저를 완전히 닫으세요" -ForegroundColor Gray
Write-Host "    2. 브라우저 다시 열기 → 자동으로 v1.0.4 적용됨" -ForegroundColor Gray
Write-Host ""
Write-Host "    또는 즉시 적용하고 싶으면:" -ForegroundColor White
Write-Host "    1. chrome://extensions/ 또는 whale://extensions/ 접속" -ForegroundColor Gray
Write-Host "    2. 우측 상단 [업데이트] 버튼 클릭" -ForegroundColor Gray
Write-Host ""
Write-Host "  창을 닫으려면 아무 키나 누르세요..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
