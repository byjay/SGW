@echo off
:: ====================================================================
:: Seastar Groupware - 사내 자동 설치 정책
:: ====================================================================
:: IT 관리자가 각 직원 PC에서 한 번만 실행:
:: 1. 선택한 브라우저에 Seastar GW 자동 설치 (정책 기반)
:: 2. Chrome/Edge: 새 버전 배포 시 자동 업데이트
::    Whale: 정책 자동설치 미지원 확인(2026-07-03) - 수동설치 안내만 표시
:: 3. 이후 사용자는 클릭 0회 - 사이드패널만 열면 바로 사용
:: ====================================================================

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
if %errorLevel% neq 0 (
  echo [ERROR] 관리자 권한이 필요합니다.
  echo         이 파일을 우클릭 - "관리자 권한으로 실행" 하세요.
  pause
  exit /b 1
)

echo  설치할 브라우저를 선택하세요.
echo.
echo   [1] Chrome           - 자동설치 + 자동업데이트 확인됨 (권장)
echo   [2] Edge             - 자동설치 + 자동업데이트 확인됨
echo   [3] Chrome + Edge    - 둘 다 (기본값)
echo   [4] Whale(네이버)    - 정책 자동설치 미지원 확인됨, 수동설치 안내만 표시
echo.
choice /c 1234 /m "선택"
set SEL=%errorlevel%

set DO_CHROME=0
set DO_EDGE=0
set DO_WHALE=0
if "%SEL%"=="1" set DO_CHROME=1
if "%SEL%"=="2" set DO_EDGE=1
if "%SEL%"=="3" set DO_CHROME=1
if "%SEL%"=="3" set DO_EDGE=1
if "%SEL%"=="4" set DO_WHALE=1

echo.

if "%DO_WHALE%"=="1" (
  echo ============================================================
  echo  [Whale 안내] Whale은 정책 기반 자동설치를 지원하지 않는 것으로
  echo  확인되었습니다 - 2026-07-03 실측, whale://policy 에 미등록.
  echo  아래 방법으로 수동 설치하세요.
  echo ============================================================
  echo.
  echo   1. Whale 주소창에 chrome://extensions 입력
  echo   2. 우측 상단 "개발자 모드" 켜기
  echo   3. "압축해제 된 확장앱 설치" 클릭
  echo   4. 이 파일과 같은 위치의 SeastarGW 폴더 선택
  echo   5. 새 버전이 나올 때마다 그 카드의 새로고침 아이콘을 수동으로 클릭
  echo      Whale은 자동 업데이트가 되지 않습니다.
  echo.
  goto :end
)

if "%DO_CHROME%"=="0" if "%DO_EDGE%"=="0" (
  echo 선택된 브라우저가 없습니다. 종료합니다.
  goto :end
)

if "%DO_CHROME%"=="1" (
  echo [Chrome] 정책 등록...
  reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul
  reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallSources" /v 1 /t REG_SZ /d "https://swgs-internal.pages.dev/*" /f >nul
)

if "%DO_EDGE%"=="1" (
  echo [Edge] 정책 등록...
  reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul 2>&1
)

echo.
echo ============================================================
echo  레지스트리 등록 완료!
echo ============================================================
echo.
echo  [중요] 정책은 브라우저를 "완전히 종료"해야만 적용됩니다.
echo  창을 닫는 것만으로는 부족합니다 (백그라운드 실행 때문).
echo.
choice /c YN /m "지금 브라우저를 자동으로 완전히 재시작할까요? (Y=예 자동재시작 / N=아니오 나중에 직접)"
if errorlevel 2 goto :manual
if errorlevel 1 goto :autorestart

:autorestart
echo.
echo  브라우저를 완전히 종료합니다...
if "%DO_CHROME%"=="1" taskkill /F /IM chrome.exe /T >nul 2>&1
if "%DO_EDGE%"=="1" taskkill /F /IM msedge.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
if "%DO_CHROME%"=="1" (
  echo  Chrome을 다시 시작합니다...
  start "" "chrome.exe" >nul 2>&1
)
if "%DO_EDGE%"=="1" (
  echo  Edge를 다시 시작합니다...
  start "" "msedge.exe" >nul 2>&1
)
echo.
echo ============================================================
echo  완료! 잠시 후 브라우저가 열리며 확장이 자동 설치됩니다.
echo  (주소창에 chrome://policy 또는 edge://policy 입력 - 등록 확인 가능)
echo ============================================================
goto :end

:manual
echo.
echo ============================================================
echo  등록 완료. 아래 방법으로 "작업관리자에서 완전히 종료" 후
echo  다시 켜면 자동 설치됩니다. (창만 닫으면 적용 안 될 수 있음)
echo  (주소창에 chrome://policy 또는 edge://policy 입력 - 등록 확인 가능)
echo ============================================================

:end
pause
