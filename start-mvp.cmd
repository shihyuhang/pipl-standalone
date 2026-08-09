@echo off
setlocal

cd /d "%~dp0"

set "PIPL_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "PIPL_NODE=C:\Users\shihy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

"%PIPL_NODE%" --version >nul 2>nul
if errorlevel 1 goto node_missing

if not exist ".env.local" copy /Y ".env.example" ".env.local" >nul

if exist "node_modules\next\dist\bin\next" goto start_app

set "PIPL_PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "PIPL_PNPM=C:\Users\shihy\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

call "%PIPL_PNPM%" --version >nul 2>nul
if errorlevel 1 goto pnpm_missing

echo Installing project dependencies...
call "%PIPL_PNPM%" install
if errorlevel 1 goto install_failed

:start_app
echo.
echo PIPL MVP is starting...
echo Open http://localhost:3000 after the server is ready.
echo Press Ctrl+C to stop the server.
echo.
"%PIPL_NODE%" "node_modules\next\dist\bin\next" dev
exit /b %errorlevel%

:node_missing
echo [ERROR] Node.js was not found.
echo Install Node.js 22 or later and run start-mvp.cmd again.
pause
exit /b 1

:pnpm_missing
echo [ERROR] Dependencies are missing and pnpm was not found.
echo Install Node.js, run "corepack enable", then run "pnpm install".
pause
exit /b 1

:install_failed
echo [ERROR] Dependency installation failed.
pause
exit /b 1
