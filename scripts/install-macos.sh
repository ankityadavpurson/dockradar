#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  install-macos.sh — native macOS installer for DockRadar (launchd)
#
#  Install / upgrade (latest release) — run as your normal user, NOT sudo:
#    curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install-macos.sh | bash
#
#  Options (when piping, pass them after "bash -s --"):
#    --version X.Y.Z     install a specific release instead of the latest
#    --tarball PATH      install from a local dockradar-X.Y.Z-linux.tar.gz
#    --non-interactive   never prompt (email settings come from env vars)
#    --uninstall         remove the LaunchAgent and application files
#    --purge             with --uninstall: also delete config, compose files, logs
#
#  Unattended email setup:
#    curl -fsSL …/install-macos.sh | SMTP_HOST=smtp.example.com \
#      EMAIL_TO=me@example.com bash -s -- --non-interactive
#
#  Layout (per user):
#    ~/Library/Application Support/DockRadar/app-X.Y.Z      application (current -> active)
#    ~/Library/Application Support/DockRadar/venv           Python virtual environment
#    ~/Library/Application Support/DockRadar/dockradar.env  configuration (SMTP, API_KEY, …)
#    ~/Library/Application Support/DockRadar/compose_files  data
#    ~/Library/Logs/DockRadar/                              logs
#    ~/Library/LaunchAgents/com.dockradar.plist             LaunchAgent (starts at login)
#
#  The release tarball is platform-independent (Python + prebuilt frontend);
#  Linux and macOS use the same file.
#
#  Compatible with macOS's built-in bash 3.2.
# ─────────────────────────────────────────────────────────────

set -euo pipefail
umask 022

REPO="${DOCKRADAR_REPO:-ankityadavpurson/dockradar}"
LABEL="com.dockradar"
APP_ROOT="$HOME/Library/Application Support/DockRadar"
ENV_FILE="$APP_ROOT/dockradar.env"
DATA_DIR="$APP_ROOT/compose_files"
LOG_DIR="$HOME/Library/Logs/DockRadar"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
MIN_PY_MAJOR=3
MIN_PY_MINOR=10

EMAIL_VARS=(SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM EMAIL_TO APP_URL)

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[DockRadar]${NC} $1"; }
success() { echo -e "${GREEN}[DockRadar]${NC} $1"; }
warn()    { echo -e "${YELLOW}[DockRadar]${NC} $1"; }
error()   { echo -e "${RED}[DockRadar]${NC} $1" >&2; exit 1; }

usage() { sed -n '2,31p' "$0" 2>/dev/null | sed 's/^#  \{0,1\}//'; exit 0; }

# ── Arguments ─────────────────────────────────────────────────
VERSION=""
TARBALL=""
INTERACTIVE=true
UNINSTALL=false
PURGE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --version)         VERSION="${2:?--version needs a value}"; VERSION="${VERSION#v}"; shift 2 ;;
        --tarball)         TARBALL="${2:?--tarball needs a path}"; shift 2 ;;
        --non-interactive) INTERACTIVE=false; shift ;;
        --uninstall)       UNINSTALL=true; shift ;;
        --purge)           PURGE=true; shift ;;
        -h|--help)         usage ;;
        *)                 error "Unknown option: $1 (see --help)" ;;
    esac
done

[ "$(uname -s)" = "Darwin" ] || error "This installer is for macOS. On Linux, use install.sh."
[ "$(id -u)" -ne 0 ] || error "Run as your normal user, without sudo — DockRadar runs as a per-user LaunchAgent so it can reach Docker Desktop."
[ -n "${HOME:-}" ] && [ -d "$HOME" ] || error "HOME is not set."

stop_agent() {
    launchctl bootout "$DOMAIN/$LABEL" </dev/null 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        launchctl print "$DOMAIN/$LABEL" </dev/null &>/dev/null || return 0
        sleep 0.5
    done
}

# ── Uninstall ─────────────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
    info "Stopping and removing the DockRadar LaunchAgent..."
    stop_agent
    rm -f "$PLIST"
    rm -rf "$APP_ROOT"/app-* "$APP_ROOT/current" "$APP_ROOT/venv"
    if [ "$PURGE" = true ]; then
        rm -rf "$APP_ROOT" "$LOG_DIR"
        success "DockRadar removed, including config, compose files and logs."
    else
        success "DockRadar removed."
        info "Kept: $ENV_FILE (config), $DATA_DIR (compose files), $LOG_DIR (logs). Use --uninstall --purge to delete them."
    fi
    exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────
for cmd in tar curl shasum launchctl plutil; do
    command -v "$cmd" &>/dev/null || error "'$cmd' is required but not found."
done

# Prefer a versioned Homebrew/python.org interpreter. Skip Apple's
# /usr/bin/python3 stub when the Command Line Tools are absent — calling it
# would pop up an install dialog.
find_python() {
    local c p
    for c in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
        for p in "$(command -v "$c" 2>/dev/null || true)" "/opt/homebrew/bin/$c" "/usr/local/bin/$c"; do
            [ -n "$p" ] && [ -x "$p" ] || continue
            if [ "$p" = "/usr/bin/python3" ] && ! xcode-select -p &>/dev/null; then continue; fi
            if "$p" -c "import sys; sys.exit(sys.version_info < ($MIN_PY_MAJOR, $MIN_PY_MINOR))" &>/dev/null \
                && "$p" -c "import venv, ensurepip" &>/dev/null; then
                echo "$p"
                return 0
            fi
        done
    done
    return 1
}

PYTHON="$(find_python)" \
    || error "Python ${MIN_PY_MAJOR}.${MIN_PY_MINOR}+ not found. Install it: brew install python@3.12 (or https://www.python.org/downloads/macos/)"
info "Using $("$PYTHON" -V 2>&1) ($PYTHON)"

find_docker() {
    local p
    for p in "$(command -v docker 2>/dev/null || true)" /usr/local/bin/docker /opt/homebrew/bin/docker \
             "$HOME/.docker/bin/docker" /Applications/Docker.app/Contents/Resources/bin/docker \
             "$HOME/.orbstack/bin/docker"; do
        [ -n "$p" ] && [ -x "$p" ] && { echo "$p"; return 0; }
    done
    return 1
}

DOCKER_BIN="$(find_docker || true)"
if [ -z "$DOCKER_BIN" ]; then
    warn "Docker CLI not found. Install Docker Desktop (https://www.docker.com/products/docker-desktop/), OrbStack or Colima."
elif ! "$DOCKER_BIN" info </dev/null &>/dev/null; then
    warn "Docker is installed but not running — start Docker Desktop. DockRadar connects once it is up."
elif ! "$DOCKER_BIN" compose version </dev/null &>/dev/null && ! command -v docker-compose &>/dev/null; then
    warn "Docker Compose not found — compose-based updates will be unavailable."
fi

# ── Fetch the release ─────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "$TARBALL" ]; then
    [ -f "$TARBALL" ] || error "Tarball not found: $TARBALL"
    if [ -f "$TARBALL.sha256" ]; then
        info "Verifying checksum..."
        (cd "$(dirname "$TARBALL")" && shasum -a 256 -c "$(basename "$TARBALL").sha256" >/dev/null) \
            || error "Checksum verification failed for $TARBALL"
    fi
    ARCHIVE="$TARBALL"
else
    if [ -z "$VERSION" ]; then
        info "Looking up the latest release of $REPO..."
        VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
            | awk -F'"' '/"tag_name"/ {print $4; exit}')"
        VERSION="${VERSION#v}"
        [ -n "$VERSION" ] || error "Could not determine the latest release. Try --version X.Y.Z."
    fi
    ASSET="dockradar-$VERSION-linux.tar.gz"
    BASE_URL="https://github.com/$REPO/releases/download/v$VERSION"
    info "Downloading DockRadar v$VERSION..."
    curl -fsSL -o "$TMP/$ASSET" "$BASE_URL/$ASSET" \
        || error "Download failed: $BASE_URL/$ASSET"
    curl -fsSL -o "$TMP/$ASSET.sha256" "$BASE_URL/$ASSET.sha256" \
        || error "Checksum download failed: $BASE_URL/$ASSET.sha256"
    (cd "$TMP" && shasum -a 256 -c "$ASSET.sha256" >/dev/null) \
        || error "Checksum verification failed — refusing to install."
    success "Checksum verified."
    ARCHIVE="$TMP/$ASSET"
fi

mkdir -p "$TMP/extract"
tar -xzf "$ARCHIVE" -C "$TMP/extract" --strip-components=1
[ -f "$TMP/extract/backend/app/main.py" ] || error "Archive does not look like a DockRadar release."
[ -n "$VERSION" ] || VERSION="$(cat "$TMP/extract/VERSION" 2>/dev/null || echo local)"

# ── Install application ───────────────────────────────────────
mkdir -p "$APP_ROOT" "$DATA_DIR" "$LOG_DIR" "$(dirname "$PLIST")"
APP_DIR="$APP_ROOT/app-$VERSION"
VENV_PY="$APP_ROOT/venv/bin/python"
PREVIOUS="$(readlink "$APP_ROOT/current" 2>/dev/null || true)"
rm -rf "$APP_DIR"
mv "$TMP/extract" "$APP_DIR"

info "Setting up Python environment..."
if [ -e "$APP_ROOT/venv" ] && ! "$VENV_PY" -c "import sys" &>/dev/null; then
    rm -rf "$APP_ROOT/venv"   # stale venv (e.g. Homebrew upgraded Python)
fi
[ -d "$APP_ROOT/venv" ] || "$PYTHON" -m venv "$APP_ROOT/venv"
# "python -m pip" instead of bin/pip: the venv path contains a space
# ("Application Support"), which breaks console-script shebangs.
"$VENV_PY" -m pip install --quiet --disable-pip-version-check --upgrade pip </dev/null
"$VENV_PY" -m pip install --quiet --disable-pip-version-check -r "$APP_DIR/backend/requirements.txt" </dev/null

ln -sfn "app-$VERSION" "$APP_ROOT/current"

# Keep only the active and previous versions for rollback.
for dir in "$APP_ROOT"/app-*; do
    [ -e "$dir" ] || continue
    name="$(basename "$dir")"
    [ "$name" = "app-$VERSION" ] || [ "$name" = "$PREVIOUS" ] || rm -rf "$dir"
done
success "Installed DockRadar v$VERSION to $APP_DIR"

# ── Configuration ─────────────────────────────────────────────
# Set KEY=VALUE in the env file (replaces an existing or commented-out line,
# otherwise appends). Done in Python so any character survives; values with
# special characters are single-quoted in python-dotenv syntax, which is
# exactly how the app reads this file.
set_env() {
    "$PYTHON" - "$ENV_FILE" "$1" "$2" <<'PY'
import re, sys
path, key, val = sys.argv[1:4]
if "\n" in val or "\r" in val:
    sys.exit(f"{key} must be a single line.")
if any(c in val for c in " \t\"'\\#$;`"):
    val = "'" + val.replace("\\", "\\\\").replace("'", "\\'") + "'"
with open(path, encoding="utf-8") as fh:
    lines = fh.read().splitlines()
pattern = re.compile(r"^[#\s]*" + re.escape(key) + "=")
for i, line in enumerate(lines):
    if pattern.match(line):
        lines[i] = f"{key}={val}"
        break
else:
    lines.append(f"{key}={val}")
with open(path, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
PY
}

# Read a value exactly the way the app will (python-dotenv, from the venv).
get_env() {
    "$VENV_PY" - "$ENV_FILE" "$1" <<'PY'
import sys
from dotenv import dotenv_values
print(dotenv_values(sys.argv[1], interpolate=False).get(sys.argv[2]) or "")
PY
}

have_tty() { { true </dev/tty; } 2>/dev/null; }

ask() {  # ask "Prompt" "default" → answer on stdout
    local reply
    read -r -p "  $1${2:+ [$2]}: " reply </dev/tty
    printf '%s' "${reply:-$2}"
}

ask_secret() {
    local reply
    read -r -s -p "  $1: " reply </dev/tty
    echo >&2
    printf '%s' "$reply"
}

host_ip() {
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

configure_email_interactive() {
    echo ""
    info "Email notifications — DockRadar can email you when image updates are found."
    local answer
    read -r -p "  Configure email notifications now? [y/N]: " answer </dev/tty
    case "$answer" in [yY]*) ;; *)
        info "Skipped. You can set SMTP_* / EMAIL_TO in $ENV_FILE later."
        return ;;
    esac

    echo "  (Gmail: use smtp.gmail.com, port 587, and an App Password — https://myaccount.google.com/apppasswords)"
    local host port user pass from to url
    host="$(ask "SMTP host" "smtp.gmail.com")"
    port="$(ask "SMTP port (587 = STARTTLS, 465 = SSL)" "587")"
    user="$(ask "SMTP username (blank for no auth)" "")"
    pass=""
    [ -z "$user" ] || pass="$(ask_secret "SMTP password / app password (hidden)")"
    from="$(ask "From address" "${user:-dockradar@example.com}")"
    to="$(ask "Send notifications to" "")"
    url="$(ask "DockRadar URL for email links" "http://localhost:$(get_env PORT)")"
    url="${url%:}"

    set_env SMTP_HOST "$host"
    set_env SMTP_PORT "$port"
    set_env SMTP_USER "$user"
    set_env SMTP_PASSWORD "$pass"
    set_env EMAIL_FROM "$from"
    set_env EMAIL_TO "$to"
    set_env APP_URL "$url"
    if [ -z "$to" ]; then
        warn "No recipient given — email notifications stay disabled."
    else
        success "Email settings saved."
    fi
}

configure_email_from_env() {
    local var any=false
    for var in "${EMAIL_VARS[@]}"; do
        if printenv "$var" >/dev/null; then
            set_env "$var" "$(printenv "$var")"
            any=true
        fi
    done
    [ "$any" = false ] || success "Email settings applied from environment variables."
}

FIRST_INSTALL=false
if [ ! -f "$ENV_FILE" ]; then
    FIRST_INSTALL=true
    cp "$APP_DIR/.env.example" "$ENV_FILE"
    # Neutralise the example's placeholder email values. Listen on localhost
    # only by default — no macOS firewall prompt, not exposed to the network.
    for var in SMTP_USER SMTP_PASSWORD EMAIL_TO APP_URL; do set_env "$var" ""; done
    set_env HOST "127.0.0.1"
    info "Created $ENV_FILE"
fi
chmod 600 "$ENV_FILE"

# Storage and log paths must never point into the (replaceable) app folder.
[ -n "$(get_env COMPOSE_DIR)" ] || set_env COMPOSE_DIR "$DATA_DIR"
case "$(get_env LOG_FILE)" in /*) ;; *) set_env LOG_FILE "$LOG_DIR/dockradar.log" ;; esac

# Docker Desktop, OrbStack and Colima may not provide /var/run/docker.sock;
# point the Docker SDK at the active context's socket instead.
if [ -z "$(get_env DOCKER_HOST)" ] && [ ! -S /var/run/docker.sock ] && [ -n "$DOCKER_BIN" ]; then
    endpoint="$("$DOCKER_BIN" context inspect --format '{{.Endpoints.docker.Host}}' </dev/null 2>/dev/null || true)"
    case "$endpoint" in
        unix://*) set_env DOCKER_HOST "$endpoint"; info "Using Docker socket $endpoint" ;;
    esac
fi

configure_email_from_env
if [ "$FIRST_INSTALL" = true ] && [ "$INTERACTIVE" = true ]; then
    if have_tty; then
        configure_email_interactive
    else
        warn "No terminal available — skipping email prompts. Edit $ENV_FILE to configure email."
    fi
fi

# ── LaunchAgent ───────────────────────────────────────────────
xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

# launchd starts agents with a minimal PATH; include the Docker CLI's folder
# so compose-based updates can run `docker compose`.
AGENT_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
[ -z "$DOCKER_BIN" ] || AGENT_PATH="$(dirname "$DOCKER_BIN"):$AGENT_PATH"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(xml_escape "$VENV_PY")</string>
        <string>-m</string>
        <string>app.main</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$(xml_escape "$APP_ROOT/current/backend")</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DOCKRADAR_ENV_FILE</key>
        <string>$(xml_escape "$ENV_FILE")</string>
        <key>PATH</key>
        <string>$(xml_escape "$AGENT_PATH")</string>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
        <key>PYTHONDONTWRITEBYTECODE</key>
        <string>1</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>/dev/null</string>
    <key>StandardErrorPath</key>
    <string>$(xml_escape "$LOG_DIR/dockradar.err.log")</string>
</dict>
</plist>
EOF
plutil -lint "$PLIST" >/dev/null || error "Generated LaunchAgent is invalid: $PLIST"

info "Starting DockRadar..."
stop_agent
launchctl enable "$DOMAIN/$LABEL" </dev/null 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST" </dev/null \
    || error "launchctl could not load $PLIST — see: launchctl print $DOMAIN/$LABEL"

PORT="$(get_env PORT)"
PORT="${PORT:-8086}"
healthy=false
for _ in $(seq 1 20); do
    curl -fsS "http://127.0.0.1:$PORT/api/health" &>/dev/null && { healthy=true; break; }
    sleep 1
done

echo ""
if [ "$healthy" = true ]; then
    success "DockRadar v$VERSION is running."
else
    warn "DockRadar did not answer on port $PORT yet. Check: tail -n 50 \"$LOG_DIR/dockradar.err.log\" \"$LOG_DIR/dockradar.log\""
fi
echo -e "  ${CYAN}UI      ${NC} → http://localhost:$PORT"
echo -e "  ${CYAN}Config  ${NC} → $ENV_FILE"
echo -e "  ${CYAN}Restart ${NC} → launchctl kickstart -k $DOMAIN/$LABEL"
echo -e "  ${CYAN}Logs    ${NC} → tail -f \"$LOG_DIR/dockradar.log\""
echo -e "  ${CYAN}Email   ${NC} → change SMTP_* / EMAIL_TO in the config, restart, then use \"Send test\" in the UI"
echo -e "  ${CYAN}Upgrade ${NC} → re-run this installer"
echo -e "  ${CYAN}Remove  ${NC} → curl -fsSL https://github.com/$REPO/releases/latest/download/install-macos.sh | bash -s -- --uninstall [--purge]"
echo -e "            (or offline: bash \"$APP_ROOT/current/install-macos.sh\" --uninstall)"
echo ""
if [ "$(get_env HOST)" = "127.0.0.1" ]; then
    info "DockRadar listens on this Mac only. To reach it from other devices, set HOST=0.0.0.0 (and API_KEY) in the config, then restart."
elif [ -z "$(get_env API_KEY)" ]; then
    warn "DockRadar controls Docker on this Mac. If port $PORT is reachable from other devices, set API_KEY in the config."
fi
