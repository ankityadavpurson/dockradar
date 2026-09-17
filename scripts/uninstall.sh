#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  uninstall.sh — removes a native DockRadar install (Linux and macOS)
#
#  Undoes what install.sh set up: the systemd service on Linux, the
#  per-user LaunchAgent on macOS, and the application files.
#
#  Uninstall (keeps config, compose files and logs):
#    Linux:  curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/uninstall.sh | sudo bash
#    macOS:  curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/uninstall.sh | bash
#
#  Offline, from the installed copy:
#    Linux:  sudo bash /opt/dockradar/current/uninstall.sh
#    macOS:  bash ~/Library/Application\ Support/DockRadar/current/uninstall.sh
#
#  Options (when piping, pass them after "bash -s --"):
#    --purge   also delete config, compose files and logs (asks first)
#    --yes     do not ask for confirmation
#
#  Written for bash 3.2+ (the bash that ships with macOS).
# ─────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[DockRadar]${NC} $1"; }
success() { echo -e "${GREEN}[DockRadar]${NC} $1"; }
warn()    { echo -e "${YELLOW}[DockRadar]${NC} $1"; }
error()   { echo -e "${RED}[DockRadar]${NC} $1" >&2; exit 1; }

STEP=0
STEPS=2
step() {
    STEP=$((STEP + 1))
    echo "" >&2
    echo -e "${GREEN}[${STEP}/${STEPS}]${NC} $1" >&2
}

usage() {
    if [ -f "$0" ]; then
        awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
    else
        echo "Usage: uninstall.sh [--purge] [--yes]"
    fi
    exit 0
}

# ── Arguments ─────────────────────────────────────────────────
PURGE=false
ASSUME_YES=false

while [ $# -gt 0 ]; do
    case "$1" in
        --purge)      PURGE=true; shift ;;
        -y|--yes)     ASSUME_YES=true; shift ;;
        --uninstall)  shift ;;   # accepted for compatibility with install.sh
        -h|--help)    usage ;;
        *)            error "Unknown option: $1 (see --help)" ;;
    esac
done

# ── Operating system ──────────────────────────────────────────
case "$(uname -s)" in
    Linux)  OS="linux" ;;
    Darwin) OS="macos" ;;
    *)      error "Unsupported operating system: $(uname -s)." ;;
esac

# Keep these paths in sync with install.sh.
if [ "$OS" = "linux" ]; then
    [ "$(id -u)" -eq 0 ] || error "On Linux, run the uninstaller as root: curl … | sudo bash"
    APP_ROOT="/opt/dockradar"
    CONF_DIR="/etc/dockradar"
    ENV_FILE="$CONF_DIR/dockradar.env"
    STATE_DIR="/var/lib/dockradar"
    DATA_DIR="$STATE_DIR/compose_files"
    LOG_DIR="/var/log/dockradar"
    SVC_NAME="dockradar"
    SVC_USER="dockradar"
    UNIT_PATH="/etc/systemd/system/$SVC_NAME.service"
else
    [ "$(id -u)" -ne 0 ] || error "On macOS, run the uninstaller as your normal user, without sudo."
    if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then error "HOME is not set."; fi
    APP_ROOT="$HOME/Library/Application Support/DockRadar"
    ENV_FILE="$APP_ROOT/dockradar.env"
    DATA_DIR="$APP_ROOT/compose_files"
    LOG_DIR="$HOME/Library/Logs/DockRadar"
    LABEL="com.dockradar"
    PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
    DOMAIN="gui/$(id -u)"
fi

# ── Confirmation ──────────────────────────────────────────────
have_tty() { { true </dev/tty; } 2>/dev/null; }

if [ "$PURGE" = true ]; then
    STEPS=3
    if [ "$ASSUME_YES" = false ]; then
        have_tty || error "--purge deletes your config and compose files. Without a terminal to confirm, add --yes."
        if [ "$OS" = "linux" ]; then
            warn "This permanently deletes $CONF_DIR, $STATE_DIR and $LOG_DIR."
        else
            warn "This permanently deletes $APP_ROOT (including config and compose files) and $LOG_DIR."
        fi
        read -r -p "  Continue? [y/N]: " answer </dev/tty
        case "$answer" in [yY]*) ;; *) info "Cancelled — nothing was removed."; exit 0 ;; esac
    fi
fi

# ── 1. Service ────────────────────────────────────────────────
step "Stopping the DockRadar service"
if [ "$OS" = "linux" ]; then
    info "Stopping and disabling $SVC_NAME, removing $UNIT_PATH..."
    if command -v systemctl &>/dev/null; then
        systemctl disable --now "$SVC_NAME" </dev/null 2>/dev/null || true
        rm -f "$UNIT_PATH"
        systemctl daemon-reload
    else
        rm -f "$UNIT_PATH"
    fi
else
    info "Unloading LaunchAgent $LABEL, removing $PLIST..."
    launchctl bootout "$DOMAIN/$LABEL" </dev/null 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        launchctl print "$DOMAIN/$LABEL" </dev/null &>/dev/null || break
        sleep 0.5
    done
    rm -f "$PLIST"
fi
success "Service removed."

# ── 2. Application files ──────────────────────────────────────
step "Removing application files"
if [ "$OS" = "linux" ]; then
    info "Deleting $APP_ROOT..."
    rm -rf "$APP_ROOT"
else
    # On macOS the app folder also holds config and compose files.
    info "Deleting application and Python environment from $APP_ROOT..."
    rm -rf "$APP_ROOT"/app-* "$APP_ROOT/current" "$APP_ROOT/venv"
fi
success "Application files removed."

# ── 3. Data (--purge) ─────────────────────────────────────────
if [ "$PURGE" = true ]; then
    step "Removing config, compose files and logs"
    if [ "$OS" = "linux" ]; then
        info "Deleting $CONF_DIR, $STATE_DIR and $LOG_DIR..."
        rm -rf "$CONF_DIR" "$STATE_DIR" "$LOG_DIR"
        if id -u "$SVC_USER" &>/dev/null; then
            info "Removing system user '$SVC_USER'..."
            userdel "$SVC_USER" 2>/dev/null || true
        fi
    else
        info "Deleting $APP_ROOT and $LOG_DIR..."
        rm -rf "$APP_ROOT" "$LOG_DIR"
    fi
    echo ""
    success "DockRadar removed, including config, compose files and logs."
else
    echo ""
    success "DockRadar removed."
    info "Kept: $ENV_FILE (config), $DATA_DIR (compose files), $LOG_DIR (logs). Use --purge to delete them."
fi
