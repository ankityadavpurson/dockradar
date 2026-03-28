# ─────────────────────────────────────────────────────────────
#  start.ps1 — DockRadar launcher (Windows PowerShell)
#  Starts both the backend (FastAPI) and frontend (Vite dev server)
#
#  First time only:
#    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#    .\scripts\start.ps1
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$VenvDir      = "venv"
$Requirements = "backend/requirements.txt"
$EnvFile      = ".env"
$EnvExample   = ".env.example"
$Marker       = "$VenvDir/.installed_marker"
$YarnMarker   = "frontend/node_modules/.yarn_installed_marker"

function Write-Info    ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Cyan   }
function Write-Success ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Green  }
function Write-Warn    ($msg) { Write-Host "[DockRadar] $msg" -ForegroundColor Yellow }
function Write-Err     ($msg) { Write-Host "[ERROR] $msg"     -ForegroundColor Red; exit 1 }

# ── Check Python ─────────────────────────────────────────────
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Err "Python not found. Install from https://www.python.org/"
}

# ── Check Yarn ────────────────────────────────────────────────
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Err "Yarn not found. Install with: npm install -g yarn"
}

$pyVersion   = python --version 2>&1
$yarnVersion = yarn --version
Write-Info "Using $pyVersion  |  Yarn $yarnVersion"

# ── Python venv ───────────────────────────────────────────────
if (-not (Test-Path $VenvDir)) {
    Write-Info "Creating virtual environment..."
    python -m venv $VenvDir
    Write-Success "Virtual environment created."
} else {
    Write-Info "Virtual environment exists — skipping."
}

& ".\$VenvDir\Scripts\Activate.ps1"
Write-Success "Virtual environment activated."

# ── Python dependencies ───────────────────────────────────────
$needsInstall = $false
if (-not (Test-Path $Marker)) {
    $needsInstall = $true
} elseif ((Get-Item $Requirements).LastWriteTime -gt (Get-Item $Marker).LastWriteTime) {
    $needsInstall = $true
}

if ($needsInstall) {
    Write-Info "Installing Python dependencies..."
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r $Requirements
    New-Item -ItemType File -Path $Marker -Force | Out-Null
    Write-Success "Python dependencies installed."
} else {
    Write-Info "Python dependencies up to date — skipping."
}

# ── Frontend dependencies (yarn) ──────────────────────────────
$needsYarn = $false
if (-not (Test-Path "frontend/node_modules")) {
    $needsYarn = $true
} elseif (-not (Test-Path $YarnMarker)) {
    $needsYarn = $true
} else {
    $yarnMarkerTime = (Get-Item $YarnMarker).LastWriteTime
    $lockTime       = (Get-Item "frontend/yarn.lock"    -ErrorAction SilentlyContinue)?.LastWriteTime
    $pkgTime        = (Get-Item "frontend/package.json" -ErrorAction SilentlyContinue)?.LastWriteTime
    if ($lockTime -and $lockTime -gt $yarnMarkerTime) { $needsYarn = $true }
    if ($pkgTime  -and $pkgTime  -gt $yarnMarkerTime) { $needsYarn = $true }
}

if ($needsYarn) {
    Write-Info "Installing frontend dependencies with Yarn..."
    Push-Location frontend
    yarn install --silent
    Pop-Location
    New-Item -ItemType File -Path $YarnMarker -Force | Out-Null
    Write-Success "Frontend dependencies installed."
} else {
    Write-Info "Frontend dependencies up to date — skipping."
}

# ── .env ──────────────────────────────────────────────────────
if (-not (Test-Path $EnvFile)) {
    if (Test-Path $EnvExample) {
        Copy-Item $EnvExample $EnvFile
        Write-Warn ".env created from .env.example — review it and re-run."
        Read-Host "Press Enter to exit"
        exit 0
    } else {
        Write-Warn ".env not found — proceeding without it."
    }
}

# ── Start both servers ────────────────────────────────────────
Write-Host ""
Write-Success "Starting DockRadar..."
Write-Host "  Backend  -> http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Docs     -> http://localhost:8080/docs" -ForegroundColor Cyan
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location backend; python -m app.main" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; yarn dev --host 0.0.0.0" -WindowStyle Normal

Write-Success "Both servers started in separate windows."
Write-Info "Close those windows to stop the servers."
