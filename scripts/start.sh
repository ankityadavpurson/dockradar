#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  start.sh — DockRadar launcher (Linux / macOS / WSL)
#  Starts both the backend (FastAPI) and frontend (Vite dev server)
# ─────────────────────────────────────────────────────────────

set -e

VENV_DIR="venv"
PYTHON="python3"
REQUIREMENTS="backend/requirements.txt"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
MARKER="$VENV_DIR/.installed_marker"
YARN_MARKER="frontend/node_modules/.yarn_installed_marker"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[DockRadar]${NC} $1"; }
success() { echo -e "${GREEN}[DockRadar]${NC} $1"; }
warn()    { echo -e "${YELLOW}[DockRadar]${NC} $1"; }
error()   { echo -e "${RED}[DockRadar]${NC} $1"; exit 1; }

# ── Check Python ─────────────────────────────────────────────
if ! command -v "$PYTHON" &>/dev/null; then
    error "Python 3 not found. Install it from https://www.python.org/"
fi

# ── Check Yarn ────────────────────────────────────────────────
if ! command -v yarn &>/dev/null; then
    error "Yarn not found. Install it with: npm install -g yarn"
fi

PYTHON_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
YARN_VERSION=$(yarn --version)
info "Using Python $PYTHON_VERSION  |  Yarn $YARN_VERSION"

# ── Python venv ───────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    info "Creating virtual environment in ./$VENV_DIR ..."
    "$PYTHON" -m venv "$VENV_DIR"
    success "Virtual environment created."
else
    info "Virtual environment already exists — skipping creation."
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
success "Virtual environment activated."

# ── Python dependencies ───────────────────────────────────────
needs_install=false
if [ ! -f "$MARKER" ]; then
    needs_install=true
elif [ "$REQUIREMENTS" -nt "$MARKER" ]; then
    needs_install=true
fi

if [ "$needs_install" = true ]; then
    info "Installing Python dependencies..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$REQUIREMENTS"
    touch "$MARKER"
    success "Python dependencies installed."
else
    info "Python dependencies up to date — skipping."
fi

# ── Frontend dependencies (yarn) ──────────────────────────────
# Re-install if node_modules is missing or yarn.lock is newer than the marker
needs_yarn=false
if [ ! -d "frontend/node_modules" ]; then
    needs_yarn=true
elif [ ! -f "$YARN_MARKER" ]; then
    needs_yarn=true
elif [ "frontend/yarn.lock" -nt "$YARN_MARKER" ] || [ "frontend/package.json" -nt "$YARN_MARKER" ]; then
    needs_yarn=true
fi

if [ "$needs_yarn" = true ]; then
    info "Installing frontend dependencies with Yarn..."
    (cd frontend && yarn install --silent)
    touch "$YARN_MARKER"
    success "Frontend dependencies installed."
else
    info "Frontend dependencies up to date — skipping."
fi

# ── .env ──────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        warn ".env created from .env.example — review it and re-run."
        exit 0
    else
        warn ".env not found — proceeding without it."
    fi
fi

# ── Cleanup on exit ───────────────────────────────────────────
cleanup() {
    echo ""
    info "Shutting down..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    success "Stopped."
}
trap cleanup EXIT INT TERM

# ── Start both servers ────────────────────────────────────────
echo ""
success "Starting DockRadar..."
echo -e "  ${CYAN}Backend ${NC} → http://localhost:8080"
echo -e "  ${CYAN}Docs    ${NC} → http://localhost:8080/docs"
echo -e "  ${CYAN}Frontend${NC} → http://localhost:5173"
echo ""

(cd backend && python -m app.main) &
BACKEND_PID=$!

(cd frontend && yarn dev --host 0.0.0.0) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
