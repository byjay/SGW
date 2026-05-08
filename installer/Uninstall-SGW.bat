@echo off
chcp 65001 >nul 2>&1
title Seastar Groupware - 제거

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Seastar Groupware 정책 제거 중...
for %%P in (
    "Google\Chrome" "NaverCorp\Whale" "NaverCorporation\Whale" "Microsoft\Edge"
    "BraveSoftware\Brave" "Opera Software\Opera" "Vivaldi\Vivaldi" "YandexBrowser" "Chromium"
) do (
    reg delete "HKLM\SOFTWARE\Policies\%%~P\ExtensionInstallForcelist" /v 1 /f >nul 2>&1
)
echo 제거 완료. 브라우저 재시작 시 자동 제거됩니다.
pause
