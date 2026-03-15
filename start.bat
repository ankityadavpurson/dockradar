@echo off
:: ─────────────────────────────────────────────────────────────
::  start.bat — DockRadar backend launcher (Windows CMD)
::
::  Usage:
::    Double-click start.bat, or run from Command Prompt:
::    start.bat
::
::  What it does:
::    1. Creates a virtual environment in .\venv if one doesn't exist
::    2. Activates it
::    3. Installs / updates dependencies from requirements.txt
::    4. Copies .env.example -> .env if no .env exists yet
::    5. Starts server.py
:: ─────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set VENV_DIR=venv
set REQUIREMENTS=requirements.txt
set ENV_FILE=.env
set ENV_EXAMPLE=.env.example

:: ── Check Python ─────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install it from https://www.python.org/
    echo         Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [DockRadar] Using %PY_VER%

:: ── Create venv if needed ─────────────────────────────────────
if not exist "%VENV_DIR%\" (
    echo [DockRadar] Creating virtual environment in .\%VENV_DIR% ...
    python -m venv %VENV_DIR%
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [DockRadar] Virtual environment created.
) else (
    echo [DockRadar] Virtual environment already exists -- skipping creation.
)

:: ── Activate ──────────────────────────────────────────────────
call "%VENV_DIR%\Scripts\activate.bat"
echo [DockRadar] Virtual environment activated.

:: ── Install / update dependencies (only when requirements.txt changed) ───────
set MARKER=%VENV_DIR%\.installed_marker

set NEEDS_INSTALL=0
if not exist "%MARKER%" set NEEDS_INSTALL=1

:: Compare modification times if marker exists
if "%NEEDS_INSTALL%"=="0" (
    for %%A in ("%REQUIREMENTS%") do set REQ_DATE=%%~tA
    for %%A in ("%MARKER%")       do set MRK_DATE=%%~tA
    if "!REQ_DATE!" GTR "!MRK_DATE!" set NEEDS_INSTALL=1
)

if "%NEEDS_INSTALL%"=="1" (
    echo [DockRadar] Installing dependencies from %REQUIREMENTS% ...
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r %REQUIREMENTS%
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    type nul > "%MARKER%"
    echo [DockRadar] Dependencies installed.
) else (
    echo [DockRadar] Dependencies are up to date -- skipping install.
)

:: ── Create .env if missing ────────────────────────────────────
if not exist "%ENV_FILE%" (
    if exist "%ENV_EXAMPLE%" (
        copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
        echo [DockRadar] .env not found -- created from .env.example.
        echo [DockRadar] Please review .env before continuing, then re-run this script.
        pause
        exit /b 0
    ) else (
        echo [WARNING] .env not found. Proceeding without it.
    )
)

:: ── Start server ──────────────────────────────────────────────
echo.
echo [DockRadar] Starting DockRadar...
echo   API  -^> http://localhost:8080
echo   Docs -^> http://localhost:8080/docs
echo   UI   -^> http://localhost:5173  (run: cd frontend ^&^& npm run dev)
echo.

python server.py
pause
