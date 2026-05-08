@echo off
:: ═══════════════════════════════════════════════════════════════════
:: Seastar Groupware - 사내 PC 자동 설치 + 자동 업데이트 정책
:: ═══════════════════════════════════════════════════════════════════
:: IT 관리자가 각 직원 PC에서 한 번만 실행:
:: 1. Chrome/Whale에 Seastar GW 자동 설치 (다음 시작 시)
:: 2. 새 버전 배포 시 자동 업데이트
:: 3. 사용자 클릭 0회 — 사이드 패널 클릭으로 즉시 사용
:: ═══════════════════════════════════════════════════════════════════

setlocal
set EXT_ID=ajlojcldaocimafbolojgokhpdfhkpkb
set UPDATE_URL=https://swgs-internal.pages.dev/updates.xml

echo.
echo ============================================================
echo  Seastar Groupware - 사내 자동 설치 정책
echo ============================================================
echo  Extension ID : %EXT_ID%
echo  Update URL   : %UPDATE_URL%
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (echo [ERROR] 관리자 권한 필요. & pause & exit /b 1)

echo [1/3] Chrome 정책 등록...
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallSources" /v 1 /t REG_SZ /d "https://swgs-internal.pages.dev/*" /f >nul

echo [2/3] Whale 정책 등록...
reg add "HKLM\SOFTWARE\Policies\NaverCorp\Whale\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul
reg add "HKLM\SOFTWARE\Policies\NaverCorporation\Whale\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul 2>&1

echo [3/3] Edge 정책 등록...
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul 2>&1

echo.
echo 완료. 모든 브라우저 완전 종료 후 재시작 → 자동 설치
pause
