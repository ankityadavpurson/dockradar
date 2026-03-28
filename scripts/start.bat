@echo off
:: ─────────────────────────────────────────────────────────────
::  start.bat — DockRadar launcher (Windows CMD)
::  Starts both the backend (FastAPI) and frontend (Vite dev server)
:: ─────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set VENV_DIR=venv
set REQUIREMENTS=backend\requirements.txt
set ENV_FILE=.env
set ENV_EXAMPLE=.env.example
set MARKER=%VENV_DIR%\.installed_marker
set YARN_MARKER=frontend\node_modules\.yarn_installed_marker

:: ── Check Python ─────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://www.python.org/
    pause & exit /b 1
)

:: ── Check Yarn ───────────────────────────────────────────────
where yarn >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Yarn not found. Install with: npm install -g yarn
    pause & exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
for /f "tokens=*" %%v in ('yarn --version 2^>^&1') do set YARN_VER=%%v
echo [DockRadar] Using %PY_VER%  ^|  Yarn %YARN_VER%

:: ── Create venv if needed ────────────────────────────────────
if not exist "%VENV_DIR%\" (
    echo [DockRadar] Creating virtual environment...
    python -m venv %VENV_DIR%
    if errorlevel 1 ( echo [ERROR] Failed to create venv. & pause & exit /b 1 )
    echo [DockRadar] Virtual environment created.
) else (
    echo [DockRadar] Virtual environment exists — skipping.
)

call "%VENV_DIR%\Scripts\activate.bat"
echo [DockRadar] Virtual environment activated.

:: ── Python dependencies ──────────────────────────────────────
set NEEDS_INSTALL=0
if not exist "%MARKER%" set NEEDS_INSTALL=1
if "%NEEDS_INSTALL%"=="0" (
    for %%A in ("%REQUIREMENTS%") do set REQ_DATE=%%~tA
    for %%A in ("%MARKER%")       do set MRK_DATE=%%~tA
    if "!REQ_DATE!" GTR "!MRK_DATE!" set NEEDS_INSTALL=1
)
if "%NEEDS_INSTALL%"=="1" (
    echo [DockRadar] Installing Python dependencies...
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r %REQUIREMENTS%
    if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )
    type nul > "%MARKER%"
    echo [DockRadar] Python dependencies installed.
) else (
    echo [DockRadar] Python dependencies up to date — skipping.
)

:: ── Frontend dependencies (yarn) ─────────────────────────────
set NEEDS_YARN=0
if not exist "frontend\node_modules\" set NEEDS_YARN=1
if "%NEEDS_YARN%"=="0" (
    if not exist "%YARN_MARKER%" set NEEDS_YARN=1
)
if "%NEEDS_YARN%"=="0" (
    for %%A in ("frontend\yarn.lock")   do set LOCK_DATE=%%~tA
    for %%A in ("frontend\package.json") do set PKG_DATE=%%~tA
    for %%A in ("%YARN_MARKER%")         do set YMK_DATE=%%~tA
    if "!LOCK_DATE!" GTR "!YMK_DATE!" set NEEDS_YARN=1
    if "!PKG_DATE!"  GTR "!YMK_DATE!" set NEEDS_YARN=1
)
if "%NEEDS_YARN%"=="1" (
    echo [DockRadar] Installing frontend dependencies with Yarn...
    cd frontend && yarn install --silent
    if errorlevel 1 ( echo [ERROR] yarn install failed. & pause & exit /b 1 )
    cd ..
    type nul > "%YARN_MARKER%"
    echo [DockRadar] Frontend dependencies installed.
) else (
    echo [DockRadar] Frontend dependencies up to date — skipping.
)

:: ── .env ──────────────────────────────────────────────────────
if not exist "%ENV_FILE%" (
    if exist "%ENV_EXAMPLE%" (
        copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
        echo [DockRadar] .env created from .env.example — review it and re-run.
        pause & exit /b 0
    ) else (
        echo [WARNING] .env not found — proceeding without it.
    )
)

:: ── Start both servers ────────────────────────────────────────
echo.
echo [DockRadar] Starting DockRadar...
echo   Backend  -^> http://localhost:8080
echo   Docs     -^> http://localhost:8080/docs
echo   Frontend -^> http://localhost:5173
echo.

start "DockRadar Backend"  cmd /k "cd backend && python -m app.main"
start "DockRadar Frontend" cmd /k "cd frontend && yarn dev --host 0.0.0.0"

echo [DockRadar] Both servers started in separate windows.
echo [DockRadar] Close those windows to stop the servers.
pause
