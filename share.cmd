@echo off
REM Share the running LightPM with someone via a temporary Cloudflare quick tunnel.
REM Start dev.cmd first, then run this. Ctrl+C closes the tunnel.
setlocal
cd /d "%~dp0"

where cloudflared >nul 2>nul
if errorlevel 1 (
  for /f "delims=" %%i in ('where /r "%LOCALAPPDATA%\Microsoft\WinGet\Packages" cloudflared.exe 2^>nul') do set "CLOUDFLARED=%%i"
) else (
  set "CLOUDFLARED=cloudflared"
)

if "%CLOUDFLARED%"=="" (
  echo.
  echo   cloudflared was not found.
  echo.
  echo   Install it with:  winget install Cloudflare.cloudflared
  echo.
  exit /b 1
)

echo.
echo   Opening a temporary public URL for http://localhost:3000
echo   The URL printed below works for anyone you give it to.
echo   LightPM's own login still applies, so share the URL, not the passwords.
echo   Press Ctrl+C to close it.
echo.

"%CLOUDFLARED%" tunnel --url http://localhost:3000
endlocal
