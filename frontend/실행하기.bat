@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
echo Node 버전:
node -v
if not exist .env (
  copy .env.example .env >nul
  echo .env 파일을 만들었습니다 - 목업 모드
)
if not exist node_modules (
  echo.
  echo [1/2] 패키지 설치 중... 처음 한 번만, 1~2분 걸립니다.
  call npm install
  if errorlevel 1 ( echo [!] npm install 실패 & pause & exit /b 1 )
)
echo.
echo [2/2] 개발 서버 실행 - 브라우저가 자동으로 열립니다. 끄려면 이 창에서 Ctrl+C
call npm run dev -- --open
pause
