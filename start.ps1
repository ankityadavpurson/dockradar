# ─────────────────────────────────────────────────────────────
#  start.ps1 — DockRadar backend launcher (Windows PowerShell)
#
#  Usage (first time — allow local scripts to run):
#    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#    .\start.ps1
#
#  Usage (subsequent runs):
#    .\start.ps1
#
#  What it does:
#    1. Creates a virtual environment in .\venv if one doesn't exist
#    2. Activates it
#    3. Installs / updates dependencies from requirements.txt
#    4. Copies .env.example -> .env if no .env exists yet
#    5. Starts server.py
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$VenvDir      = "venv"
$Requirements = "requirements.txt"
$EnvFile      = ".env"
$EnvExample   = ".env.example"

function Write-Info    ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Cyan }
function Write-Success ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Green }
function Write-Warn    ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Yellow }
function Write-Err     ($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

# ── Check Python ─────────────────────────────────────────────
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Err "Python not found. Install it from https://www.python.org/ and ensure it's on your PATH."
}

$pyVersion = python --version 2>&1
Write-Info "Using $pyVersion"

# ── Create venv if needed ─────────────────────────────────────
if (-not (Test-Path $VenvDir)) {
    Write-Info "Creating virtual environment in .\$VenvDir ..."
    python -m venv $VenvDir
    Write-Success "Virtual environment created."
} else {
    Write-Info "Virtual environment already exists -- skipping creation."
}

# ── Activate ──────────────────────────────────────────────────
& ".\$VenvDir\Scripts\Activate.ps1"
Write-Success "Virtual environment activated."

# ── Install / update dependencies (only when requirements.txt changed) ───────
$Marker = Join-Path $VenvDir ".installed_marker"

$needsInstall = $false
if (-not (Test-Path $Marker)) {
    $needsInstall = $true
} elseif ((Get-Item $Requirements).LastWriteTime -gt (Get-Item $Marker).LastWriteTime) {
    $needsInstall = $true
}

if ($needsInstall) {
    Write-Info "Installing dependencies from $Requirements ..."
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r $Requirements
    New-Item -ItemType File -Path $Marker -Force | Out-Null
    Write-Success "Dependencies installed."
} else {
    Write-Info "Dependencies are up to date -- skipping install."
}

# ── Create .env if missing ────────────────────────────────────
if (-not (Test-Path $EnvFile)) {
    if (Test-Path $EnvExample) {
        Copy-Item $EnvExample $EnvFile
        Write-Warn ".env not found -- created from .env.example."
        Write-Warn "Please review .env before continuing, then re-run this script."
        Read-Host "Press Enter to exit"
        exit 0
    } else {
        Write-Warn ".env not found. Proceeding without it."
    }
}

# ── Start server ──────────────────────────────────────────────
Write-Host ""
Write-Success "Starting DockRadar..."
Write-Host "  API  -> http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Docs -> http://localhost:8080/docs" -ForegroundColor Cyan
Write-Host "  UI   -> http://localhost:5173  (run: cd frontend; npm run dev)" -ForegroundColor Cyan
Write-Host ""

python server.py
