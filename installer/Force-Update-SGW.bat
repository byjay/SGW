@echo off
title Seastar Groupware 강제 업데이트

:: ================================================================
::  * Seastar Groupware 강제 업데이트 (One-Click Launcher)
::  더블클릭 → UAC [예] → 끝 (서버에서 최신 스크립트 자동 실행)
:: ================================================================

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
echo                *  Seastar Groupware 강제 업데이트
echo                     (서버에서 최신 v1.0.4 적용)
echo  ================================================================
echo.
echo  > 잠시만 기다려주세요... 자동으로 진행됩니다.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { iex (irm 'https://sgw-install.pages.dev/installer/Force-Update-SGW.ps1') } catch { Write-Host ('  [실패] ' + $_) -ForegroundColor Red; Read-Host '엔터를 누르면 종료' }"

exit /b
