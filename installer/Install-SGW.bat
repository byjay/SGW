@echo off
chcp 65001 >nul 2>&1
title Seastar Groupware - 사내 자동 설치
setlocal EnableDelayedExpansion

:: ════════════════════════════════════════════════════════════════
::  ⭐ Seastar Groupware 전용 설치기
::  사원번호 로그인 + 연차/SEDMS + 활동 알림
::  사내 PC 직원용 — SDU 확장은 별도
:: ════════════════════════════════════════════════════════════════

set "EXT_ID=ajlojcldaocimafbolojgokhpdfhkpkb"
set "UPDATE_URL=https://swgs-internal.pages.dev/updates.xml"
set "SOURCE_HOST=https://swgs-internal.pages.dev/*"
set "INSTALLER_URL=https://sgw-install.pages.dev/installer/Seastar-GW-Installer.zip"
set "TEMP_DIR=%TEMP%\sgw-install"

net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0E
    echo.
    echo  ┌────────────────────────────────────────────────────────────┐
    echo  │   관리자 권한이 필요합니다.                                │
    echo  │   UAC 창에서 [예]를 눌러 주세요.                           │
    echo  └────────────────────────────────────────────────────────────┘
    timeout /t 3 /nobreak >nul
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    timeout /t 2 /nobreak >nul
    exit /b
)

color 0B
cls
echo.
echo  ════════════════════════════════════════════════════════════════
echo                ⭐  S E A S T A R   GROUPWARE  ⭐
echo                       사내 자동 설치
echo  ════════════════════════════════════════════════════════════════
echo.
echo  ▸ 설치 항목: Seastar Groupware 확장만
echo  ▸ Extension ID: %EXT_ID%
echo  ▸ Update URL: %UPDATE_URL%
echo.

echo  [1/3] 8개 브라우저 정책 등록 중...
call :reg_browsers "%EXT_ID%;%UPDATE_URL%" "%SOURCE_HOST%" 1
echo         OK
echo.

echo  [2/3] 외부 호스팅 허용 글로벌 정책...
call :reg_global_sources
echo         OK
echo.

echo  [3/3] 정리...
echo         OK
echo.

color 0A
echo  ════════════════════════════════════════════════════════════════
echo                    ✓  설  치  완  료
echo  ════════════════════════════════════════════════════════════════
echo.
echo   ▸ 다음 단계:
echo      1. 모든 브라우저를 완전히 닫으세요
echo      2. 브라우저 다시 열기
echo      3. 1~2분 후 도구 모음에 ⭐ 아이콘 자동 표시
echo      4. 사이드 패널에서 [🌐 그룹웨어 열기] → 사원번호 로그인
echo      5. 새 버전은 30분 내 자동 업데이트
echo.
echo   ▸ 매뉴얼: https://sgw-install.pages.dev/manual.html
echo.
echo  ────────────────────────────────────────────────────────────────
echo   창을 닫으려면 아무 키나 누르세요...
echo  ────────────────────────────────────────────────────────────────
pause >nul
exit /b 0

:reg_browsers
set "POL=%~1"
for %%P in (
    "Google\Chrome"
    "NaverCorp\Whale"
    "NaverCorporation\Whale"
    "Microsoft\Edge"
    "BraveSoftware\Brave"
    "Opera Software\Opera"
    "Vivaldi\Vivaldi"
    "YandexBrowser"
    "Chromium"
) do (
    reg add "HKLM\SOFTWARE\Policies\%%~P\ExtensionInstallForcelist" /v %~3 /t REG_SZ /d "%POL%" /f >nul 2>&1
    reg add "HKLM\SOFTWARE\Policies\%%~P\ExtensionInstallSources" /v %~3 /t REG_SZ /d "%~2" /f >nul 2>&1
)
exit /b

:reg_global_sources
for %%P in (
    "Google\Chrome" "NaverCorp\Whale" "NaverCorporation\Whale" "Microsoft\Edge"
    "BraveSoftware\Brave" "Opera Software\Opera" "Vivaldi\Vivaldi" "YandexBrowser" "Chromium"
) do (
    reg add "HKLM\SOFTWARE\Policies\%%~P\ExtensionInstallSources" /v 99 /t REG_SZ /d "https://*.pages.dev/*" /f >nul 2>&1
)
exit /b
