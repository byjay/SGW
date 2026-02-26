@echo off
REM 그룹웨어 자동 배포 스케줄러 설정 스크립트
REM 이 스크립트를 실행하면 Windows 작업 스케줄러에 배포 작업이 등록됩니다

setlocal enabledelayedexpansion

echo ========================================
echo  그룹웨어 자동 배포 스케줄러 설정
echo ========================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if errorlevel 1 (
    echo ⚠️  오류: 관리자 권한 필요합니다
    echo    이 스크립트를 관리자 권한으로 다시 실행해주세요
    echo.
    pause
    exit /b 1
)

REM 배포 스크립트 경로 설정
set SCRIPT_DIR=%~dp0
set DEPLOY_SCRIPT=%SCRIPT_DIR%deploy.bat

REM 작업 이름 설정
set TASK_NAME=SGW_AutoDeploy

REM 배포 주기 설정 (기본: 매일 오전 9시)
set SCHEDULE_HOURS=9
set SCHEDULE_MINUTES=0

echo 📋 배포 설정
echo    작업 이름: %TASK_NAME%
echo    배포 스크립트: %DEPLOY_SCRIPT%
echo    배포 주기: 매일 %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
echo.

REM 기존 작업 확인 및 삭제
echo 🔄 기존 작업 확인 중...
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if errorlevel 0 (
    echo ⚠️  기존 작업 발견: %TASK_NAME%
    choice /c yn /m "기존 작업을 삭제하시겠습니까? (y/n)"
    if errorlevel 2 (
        echo ❌ 작업 삭제 취소
        echo    기존 작업을 유지합니다
    ) else (
        echo 🗑️  기존 작업 삭제 중...
        schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
        if errorlevel 1 (
            echo ❌ 작업 삭제 실패
        ) else (
            echo ✅ 기존 작업 삭제 완료
        )
    )
    echo.
) else (
    echo ℹ️  기존 작업 없음
)

REM 작업 등록 옵션 선택
echo.
echo ========================================
echo  배포 주기 선택
echo ========================================
echo.
echo 1. 매일 (기본 시간)
echo 2. 매주 (특정 요일)
echo 3. 매월 (특정 날짜)
echo 4. 매시간 (주기적)
echo 5. 수동으로만 실행 (작업 스케줄러 등록 안 함)
echo.

choice /c 12345 /m "옵션을 선택하세요 (1-5):"

if errorlevel 5 goto MANUAL_ONLY
if errorlevel 4 goto HOURLY
if errorlevel 3 goto MONTHLY
if errorlevel 2 goto WEEKLY
if errorlevel 1 goto DAILY

:DAILY
echo.
set /p SCHEDULE_HOURS="배포 시간을 입력하세요 (0-23, 기본: 9): "
if "%SCHEDULE_HOURS%"=="" set SCHEDULE_HOURS=9
set SCHEDULE_MINUTES=0
set SCHEDULE_TYPE=DAILY
goto CREATE_TASK

:WEEKLY
echo.
set /p SCHEDULE_DAYS="배포 요일을 입력하세요 (MON, TUE, WED, THU, FRI, SAT, SUN): "
set SCHEDULE_DAYS=%SCHEDULE_DAYS%
set /p SCHEDULE_HOURS="배포 시간을 입력하세요 (0-23): "
set /p SCHEDULE_MINUTES="배포 분을 입력하세요 (0-59): "
set SCHEDULE_TYPE=WEEKLY
goto CREATE_TASK

:MONTHLY
echo.
set /p SCHEDULE_DATE="배포 날짜를 입력하세요 (1-31): "
set /p SCHEDULE_HOURS="배포 시간을 입력하세요 (0-23): "
set /p SCHEDULE_MINUTES="배포 분을 입력하세요 (0-59): "
set SCHEDULE_TYPE=MONTHLY
goto CREATE_TASK

:HOURLY
echo.
set /p SCHEDULE_INTERVAL="배포 간격을 입력하세요 (분, 예: 60분마다): "
set SCHEDULE_TYPE=HOURLY
goto CREATE_TASK

:MANUAL_ONLY
echo.
echo ℹ️  수동 모드 선택됨
echo    작업 스케줄러에 등록하지 않습니다
echo    deploy.bat를 직접 실행하세요
echo.
pause
exit /b 0

:CREATE_TASK
echo.
echo ========================================
echo  자동 배포 작업 등록 중...
echo ========================================
echo.

REM 배포 스크립트 존재 확인
if not exist "%DEPLOY_SCRIPT%" (
    echo ❌ 오류: 배포 스크립트를 찾을 수 없습니다
    echo    경로: %DEPLOY_SCRIPT%
    echo.
    pause
    exit /b 1
)

REM 배포 스크립트를 절대 경로로 변환
for /f "delims=" %%i in ('cd /d "%SCRIPT_DIR%" ^&^& cd') do set ABS_SCRIPT_DIR=%%i
set ABS_DEPLOY_SCRIPT=%ABS_SCRIPT_DIR%\deploy.bat

echo 📁 배포 스크립트 경로: %ABS_DEPLOY_SCRIPT%
echo.

REM 작업 생성 명령어 빌드
set TASK_CMD=schtasks /create /tn "%TASK_NAME%" /tr "알림: 그룹웨어 자동 배포" /sc "%SCHEDULE_TYPE%"

REM 배포 주기에 따른 명령어 설정
if "%SCHEDULE_TYPE%"=="DAILY" (
    set TASK_CMD=%TASK_CMD% /st "%SCHEDULE_HOURS%:%SCHEDULE_MINUTES%"
    echo 📅 배포 주기: 매일 %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
)

if "%SCHEDULE_TYPE%"=="WEEKLY" (
    set TASK_CMD=%TASK_CMD% /d "%SCHEDULE_DAYS%" /st "%SCHEDULE_HOURS%:%SCHEDULE_MINUTES%"
    echo 📅 배포 주기: 매주 %SCHEDULE_DAYS% %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
)

if "%SCHEDULE_TYPE%"=="MONTHLY" (
    set TASK_CMD=%TASK_CMD% /d "%SCHEDULE_DATE%" /st "%SCHEDULE_HOURS%:%SCHEDULE_MINUTES%"
    echo 📅 배포 주기: 매월 %SCHEDULE_DATE%일 %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
)

if "%SCHEDULE_TYPE%"=="HOURLY" (
    set TASK_CMD=%TASK_CMD% /mo %SCHEDULE_INTERVAL%
    echo 📅 배포 주기: 매 %SCHEDULE_INTERVAL%분마다
)

REM 작업 명령어 완성
set TASK_CMD=%TASK_CMD% /ri %SCHEDULE_INTERVAL% /ru highest /f

REM 실행할 프로그램 설정 (cmd 또는 배치 파일)
set PROGRAM=cmd.exe

REM 작업 등록
echo 🚀 작업 등록 명령어:
echo    %TASK_CMD% /t %PROGRAM% /c "%ABS_DEPLOY_SCRIPT%"
echo.

%TASK_CMD% /t %PROGRAM% /c "%ABS_DEPLOY_SCRIPT%"

if errorlevel 1 (
    echo.
    echo ❌ 작업 등록 실패
    echo    관리자 권한을 확인해주세요
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo ✅ 작업 등록 완료
    echo ========================================
    echo.
    echo 📋 작업 정보:
    echo    작업 이름: %TASK_NAME%
    echo    실행 프로그램: %PROGRAM%
    echo    배포 스크립트: %ABS_DEPLOY_SCRIPT%
    if "%SCHEDULE_TYPE%"=="DAILY" echo    배포 시간: 매일 %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
    if "%SCHEDULE_TYPE%"=="WEEKLY" echo    배포 시간: 매주 %SCHEDULE_DAYS% %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
    if "%SCHEDULE_TYPE%"=="MONTHLY" echo    배포 시간: 매월 %SCHEDULE_DATE%일 %SCHEDULE_HOURS%시 %SCHEDULE_MINUTES%분
    if "%SCHEDULE_TYPE%"=="HOURLY" echo    배포 시간: 매 %SCHEDULE_INTERVAL%분마다
    echo.
    echo 📖 작업 스케줄러 확인:
    echo    - 작업 스케줄러(Windows 검색) 열기
    echo    - 또는: taskschd.msc
    echo.
    echo 🚀 배포 테스트:
    echo    - 작업 스케줄러에서 작업 선택 후 '실행' 클릭
    echo    - 또는: schtasks /run /tn "%TASK_NAME%"
    echo.
    echo ⚠️  주의:
    echo    - 첫 번째 배포 시 반드시 컴퓨터가 켜져 있어야 합니다
    echo    - 배포 로그는 콘솔창에 표시됩니다
    echo.
    pause
)
