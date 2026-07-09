# Seastar Groupware - One-Line PowerShell Installer
# 호출: 관리자 권한 PowerShell에 다음 한 줄 붙여넣기
#   iwr -UseB https://sgw-install.pages.dev/installer/Install-SGW.ps1 | iex
#
# (관리자 권한이 아니면 자동 상승함)

$ErrorActionPreference = "Continue"

function Banner($t, $c="Cyan") {
  Write-Host ""
  Write-Host ("  " + ("=" * 60)) -ForegroundColor $c
  Write-Host ("  " + $t) -ForegroundColor $c
  Write-Host ("  " + ("=" * 60)) -ForegroundColor $c
  Write-Host ""
}

# ── 관리자 권한 자동 상승 ──
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "  [정보] 관리자 권한 자동 요청 — UAC 창에서 [예]를 눌러주세요..." -ForegroundColor Yellow
  $cmd = "iwr -UseB https://sgw-install.pages.dev/installer/Install-SGW.ps1 | iex; pause"
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"$cmd`""
  exit 0
}

Banner "Seastar Groupware 사내 자동 설치"

$EXT_ID  = "ajlojcldaocimafbolojgokhpdfhkpkb"
$UPD_URL = "https://swgs-internal.pages.dev/updates.xml"
$SRC_URL = "https://swgs-internal.pages.dev/*"
$browsers = @(
  "Google\Chrome", "NaverCorp\Whale", "NaverCorporation\Whale",
  "Microsoft\Edge", "BraveSoftware\Brave", "Opera Software\Opera",
  "Vivaldi\Vivaldi", "YandexBrowser", "Chromium"
)

Write-Host "  [1/3] 9개 브라우저 정책 등록 중..." -ForegroundColor Cyan
$ok = 0; $fail = 0
foreach ($b in $browsers) {
  $force = "HKLM:\SOFTWARE\Policies\$b\ExtensionInstallForcelist"
  $src   = "HKLM:\SOFTWARE\Policies\$b\ExtensionInstallSources"
  try {
    New-Item -Path $force -Force -ErrorAction Stop | Out-Null
    New-Item -Path $src   -Force -ErrorAction Stop | Out-Null
    Set-ItemProperty -Path $force -Name 1  -Value "$EXT_ID;$UPD_URL"        -Type String -Force
    Set-ItemProperty -Path $src   -Name 1  -Value $SRC_URL                   -Type String -Force
    Set-ItemProperty -Path $src   -Name 99 -Value "https://*.pages.dev/*"    -Type String -Force
    $ok++
  } catch { $fail++ }
}
Write-Host ("       시도 " + $browsers.Count + " | 성공 $ok | 실패 $fail") -ForegroundColor Green

Write-Host "  [2/3] 등록 결과 검증..." -ForegroundColor Cyan
$verifyKey = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
if (Test-Path $verifyKey) {
  $val = (Get-ItemProperty -Path $verifyKey).1
  if ($val) {
    Write-Host "       OK  Chrome 정책 등록 확인" -ForegroundColor Green
    Write-Host ("            값: " + $val) -ForegroundColor Gray
  } else {
    Write-Host "       ⚠  Chrome 정책 키는 있는데 값이 비어있음" -ForegroundColor Yellow
  }
} else {
  Write-Host "       ⚠  Chrome 정책 키가 만들어지지 않음 (GPO 충돌 가능성)" -ForegroundColor Yellow
}

Write-Host "  [3/3] 그룹 정책 즉시 갱신..." -ForegroundColor Cyan
& gpupdate /target:computer /force 2>&1 | Out-Null
Write-Host "       OK" -ForegroundColor Green

if ($fail -eq 0) {
  Banner "✓ 설치 완료" "Green"
  Write-Host "  ▸ 다음 단계 (필수):" -ForegroundColor White
  Write-Host "    1. 모든 브라우저를 완전히 닫으세요" -ForegroundColor Gray
  Write-Host "    2. 브라우저 다시 열기" -ForegroundColor Gray
  Write-Host "    3. 1~2분 후 도구 모음에 ⭐ 아이콘 자동 표시" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  ▸ 정책 적용 확인: chrome://policy/  또는  whale://policy/" -ForegroundColor White
} else {
  Banner "⚠ 일부 실패" "Yellow"
  Write-Host ("  $fail 개 브라우저 정책 등록 실패 (회사 GPO 충돌 가능)") -ForegroundColor Yellow
  Write-Host "  사내 IT 담당자에게 문의하세요." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  창을 닫으려면 아무 키나 누르세요..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
