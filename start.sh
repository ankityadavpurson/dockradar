#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  start.sh — DockRadar backend launcher (Linux / macOS / WSL)
#
#  Usage:
#    chmod +x start.sh   (first time only)
#    ./start.sh
#
#  What it does:
#    1. Creates a virtual environment in ./venv if one doesn't exist
#    2. Activates it
#    3. Installs / updates dependencies from requirements.txt
#    4. Copies .env.example → .env if no .env exists yet
#    5. Starts server.py
# ─────────────────────────────────────────────────────────────

set -e  # exit on any error

VENV_DIR="venv"
PYTHON="python3"
REQUIREMENTS="requirements.txt"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# ── Colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

info()    { echo -e "${CYAN}[DockRadar]${NC} $1"; }
success() { echo -e "${GREEN}[DockRadar]${NC} $1"; }
warn()    { echo -e "${YELLOW}[DockRadar]${NC} $1"; }
error()   { echo -e "${RED}[DockRadar]${NC} $1"; exit 1; }

# ── Check Python ─────────────────────────────────────────────
if ! command -v "$PYTHON" &>/dev/null; then
    error "Python 3 not found. Install it from https://www.python.org/"
fi

PYTHON_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Using Python $PYTHON_VERSION"

# ── Create venv if needed ─────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    info "Creating virtual environment in ./$VENV_DIR ..."
    "$PYTHON" -m venv "$VENV_DIR"
    success "Virtual environment created."
else
    info "Virtual environment already exists — skipping creation."
fi

# ── Activate ──────────────────────────────────────────────────
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
success "Virtual environment activated."

# ── Install / update dependencies (only when requirements.txt changed) ───────
MARKER="$VENV_DIR/.installed_marker"

needs_install=false
if [ ! -f "$MARKER" ]; then
    needs_install=true
elif [ "$REQUIREMENTS" -nt "$MARKER" ]; then
    needs_install=true
fi

if [ "$needs_install" = true ]; then
    info "Installing dependencies from $REQUIREMENTS ..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$REQUIREMENTS"
    touch "$MARKER"
    success "Dependencies installed."
else
    info "Dependencies are up to date — skipping install."
fi

# ── Create .env if missing ────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        warn ".env not found — created from .env.example. Please review it before continuing."
        warn "Edit .env now if needed, then re-run this script."
        exit 0
    else
        warn ".env not found and no .env.example to copy from. Proceeding without it."
    fi
fi

# ── Start server ──────────────────────────────────────────────
echo ""
success "Starting DockRadar..."
echo -e "  ${CYAN}API ${NC} → http://localhost:8080"
echo -e "  ${CYAN}Docs${NC} → http://localhost:8080/docs"
echo -e "  ${CYAN}UI  ${NC} → http://localhost:5173  (run: cd frontend && npm run dev)"
echo ""

exec python server.py
