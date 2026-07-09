@echo off
title Seastar Groupware - 사내 자동 설치

:: ================================================================
::  * Seastar Groupware 설치 (One-Click Launcher)
::  본체 로직은 서버의 Install-SGW.ps1 - 이 .bat은 launcher일 뿐.
::  코드가 갱신되어도 사용자가 .bat 다시 받을 필요 없음 (서버에서 항상 최신).
:: ================================================================

:: ── MOTW 차단 해제 ──
powershell -NoProfile -Command "Unblock-File -LiteralPath '%~f0'" >nul 2>&1

:: ── 관리자 권한 확인 + 자동 상승 ──
net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0E
    echo.
    echo  관리자 권한 자동 요청 중... UAC 창에서 [예]를 눌러주세요.
    timeout /t 2 /nobreak >nul
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

color 0B
cls
echo.
echo  ================================================================
echo                *  Seastar Groupware 사내 자동 설치
echo                  (서버에서 최신 설치 스크립트 가져오는 중)
echo  ================================================================
echo.
echo  > 잠시만 기다려주세요... 자동으로 진행됩니다.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { iex (irm 'https://sgw-install.pages.dev/installer/Install-SGW.ps1') } catch { Write-Host ('  [실패] ' + $_) -ForegroundColor Red; Read-Host '엔터를 누르면 종료' }"

exit /b
