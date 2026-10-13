@echo off
REM Start LightPM locally against the on-disk store in data\lightpm.db.
REM No Supabase, no Vercel, no account needed.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on PATH.
  echo.
  echo   Install it with:  winget install OpenJS.NodeJS.LTS
  echo   ...or run this project from WorkBuddy, which ships its own Node.
  echo.
  exit /b 1
)

if not exist "node_modules" (
  echo   Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 exit /b 1
)

echo.
echo   LightPM starting on http://localhost:3000
echo   Data file: data\lightpm.db
echo   Sign in as admin / password123
echo.

call npm run dev
endlocal
