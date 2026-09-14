#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  install.sh — native Linux installer for DockRadar (systemd)
#
#  Install / upgrade (latest release):
#    curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash
#
#  Options:
#    --version X.Y.Z     install a specific release instead of the latest
#    --tarball PATH      install from a local dockradar-X.Y.Z-linux.tar.gz
#    --non-interactive   never prompt (email settings come from env vars)
#    --uninstall         remove the service and /opt/dockradar
#    --purge             with --uninstall: also delete config, data, logs, user
#
#  Options are passed after "bash -s --" when piping, e.g. uninstall:
#    curl -fsSL …/install.sh | sudo bash -s -- --uninstall
#
#  Unattended email setup (sudo strips env, so pass vars after sudo):
#    curl -fsSL …/install.sh | sudo SMTP_HOST=smtp.example.com \
#      EMAIL_TO=me@example.com bash -s -- --non-interactive
#
#  Layout:
#    /opt/dockradar/app-X.Y.Z    application (current -> active version)
#    /opt/dockradar/venv         Python virtual environment
#    /etc/dockradar/dockradar.env  configuration (SMTP, API_KEY, …)
#    /var/lib/dockradar          data (compose files)
#    /var/log/dockradar          log file (also: journalctl -u dockradar)
# ─────────────────────────────────────────────────────────────

set -euo pipefail
umask 022

REPO="${DOCKRADAR_REPO:-ankityadavpurson/dockradar}"
PREFIX="/opt/dockradar"
CONF_DIR="/etc/dockradar"
ENV_FILE="$CONF_DIR/dockradar.env"
DATA_DIR="/var/lib/dockradar"
LOG_DIR="/var/log/dockradar"
SVC_NAME="dockradar"
SVC_USER="dockradar"
UNIT_PATH="/etc/systemd/system/$SVC_NAME.service"
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

usage() { sed -n '2,26p' "$0" 2>/dev/null | sed 's/^#  \{0,1\}//'; exit 0; }

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

[ "$(id -u)" -eq 0 ] || error "Please run as root (e.g. curl … | sudo bash)."
[ -d /run/systemd/system ] || error "systemd is required but does not appear to be running."

# ── Uninstall ─────────────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
    info "Stopping and removing the $SVC_NAME service..."
    systemctl disable --now "$SVC_NAME" 2>/dev/null || true
    rm -f "$UNIT_PATH"
    systemctl daemon-reload
    rm -rf "$PREFIX"
    if [ "$PURGE" = true ]; then
        rm -rf "$CONF_DIR" "$DATA_DIR" "$LOG_DIR"
        id -u "$SVC_USER" &>/dev/null && userdel "$SVC_USER" 2>/dev/null || true
        success "DockRadar removed, including config, data, logs and the $SVC_USER user."
    else
        success "DockRadar removed."
        info "Kept: $CONF_DIR (config), $DATA_DIR (compose files), $LOG_DIR (logs). Use --uninstall --purge to delete them."
    fi
    exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────
for cmd in tar awk; do
    command -v "$cmd" &>/dev/null || error "'$cmd' is required but not installed."
done
if [ -z "$TARBALL" ]; then
    command -v curl &>/dev/null || error "'curl' is required but not installed."
    command -v sha256sum &>/dev/null || error "'sha256sum' is required but not installed."
fi

python_hint() {
    if   command -v apt-get &>/dev/null; then echo "sudo apt-get install -y python3 python3-venv"
    elif command -v dnf     &>/dev/null; then echo "sudo dnf install -y python3"
    elif command -v yum     &>/dev/null; then echo "sudo yum install -y python3"
    elif command -v pacman  &>/dev/null; then echo "sudo pacman -S python"
    elif command -v zypper  &>/dev/null; then echo "sudo zypper install python3"
    elif command -v apk     &>/dev/null; then echo "sudo apk add python3"
    else echo "install Python ${MIN_PY_MAJOR}.${MIN_PY_MINOR}+ with the venv module"
    fi
}

PYTHON="$(command -v python3 || true)"
[ -n "$PYTHON" ] || error "Python 3 not found. Install it: $(python_hint)"
"$PYTHON" -c "import sys; sys.exit(sys.version_info < ($MIN_PY_MAJOR, $MIN_PY_MINOR))" \
    || error "Python ${MIN_PY_MAJOR}.${MIN_PY_MINOR}+ required (found $("$PYTHON" -V 2>&1)). Install it: $(python_hint)"
"$PYTHON" -c "import venv, ensurepip" &>/dev/null \
    || error "Python venv support is missing. Install it: $(python_hint)"
info "Using $("$PYTHON" -V 2>&1)"

if ! command -v docker &>/dev/null; then
    warn "Docker CLI not found. DockRadar needs a Docker daemon to monitor — install Docker Engine: https://docs.docker.com/engine/install/"
elif ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
    warn "Docker Compose not found — compose-based updates will be unavailable (install the docker-compose-plugin package)."
fi

# ── Fetch the release ─────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "$TARBALL" ]; then
    [ -f "$TARBALL" ] || error "Tarball not found: $TARBALL"
    if [ -f "$TARBALL.sha256" ]; then
        info "Verifying checksum..."
        (cd "$(dirname "$TARBALL")" && sha256sum -c "$(basename "$TARBALL").sha256" >/dev/null) \
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
    (cd "$TMP" && sha256sum -c "$ASSET.sha256" >/dev/null) \
        || error "Checksum verification failed — refusing to install."
    success "Checksum verified."
    ARCHIVE="$TMP/$ASSET"
fi

mkdir -p "$TMP/extract"
tar -xzf "$ARCHIVE" -C "$TMP/extract" --strip-components=1 --no-same-owner
[ -f "$TMP/extract/backend/app/main.py" ] || error "Archive does not look like a DockRadar release."
[ -n "$VERSION" ] || VERSION="$(cat "$TMP/extract/VERSION" 2>/dev/null || echo local)"

# ── Service user ──────────────────────────────────────────────
if ! id -u "$SVC_USER" &>/dev/null; then
    info "Creating system user '$SVC_USER'..."
    useradd --system --home-dir "$DATA_DIR" --no-create-home \
        --shell "$(command -v nologin || echo /bin/false)" "$SVC_USER"
fi
if getent group docker &>/dev/null; then
    usermod -aG docker "$SVC_USER"
else
    warn "No 'docker' group found — $SVC_USER may not be able to reach the Docker socket."
fi

# ── Install application ───────────────────────────────────────
APP_DIR="$PREFIX/app-$VERSION"
PREVIOUS="$(readlink "$PREFIX/current" 2>/dev/null || true)"
mkdir -p "$PREFIX"
rm -rf "$APP_DIR"
mv "$TMP/extract" "$APP_DIR"
chown -R root:root "$APP_DIR"
chmod 755 "$APP_DIR"

info "Setting up Python environment..."
if [ -x "$PREFIX/venv/bin/python" ] && ! "$PREFIX/venv/bin/python" -c "import sys" &>/dev/null; then
    rm -rf "$PREFIX/venv"   # stale venv (system Python was upgraded)
fi
[ -d "$PREFIX/venv" ] || "$PYTHON" -m venv "$PREFIX/venv"
"$PREFIX/venv/bin/pip" install --quiet --disable-pip-version-check --upgrade pip
"$PREFIX/venv/bin/pip" install --quiet --disable-pip-version-check -r "$APP_DIR/backend/requirements.txt"

ln -sfn "app-$VERSION" "$PREFIX/current"

# Keep only the active and previous versions for rollback.
for dir in "$PREFIX"/app-*; do
    name="$(basename "$dir")"
    [ "$name" = "app-$VERSION" ] || [ "$name" = "$PREVIOUS" ] || rm -rf "$dir"
done
success "Installed DockRadar v$VERSION to $APP_DIR"

# ── Configuration ─────────────────────────────────────────────
# Set KEY=VALUE in the env file: replaces an existing (or commented-out)
# line, otherwise appends. Values go through ENVIRON, so special characters
# need no escaping; values containing spaces/quotes/# are double-quoted for
# systemd's EnvironmentFile parser.
set_env() {
    local key="$1" val="$2"
    case "$val" in *$'\n'*) error "$key must be a single line." ;; esac
    if [[ "$val" =~ [[:space:]\"\'\\#\$\;] ]]; then
        val="${val//\\/\\\\}"
        val="${val//\"/\\\"}"
        val="\"$val\""
    fi
    KEY="$key" VAL="$val" awk '
        BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VAL"]; done = 0 }
        !done && $0 ~ "^[#[:space:]]*" k "=" { print k "=" v; done = 1; next }
        { print }
        END { if (!done) print k "=" v }
    ' "$ENV_FILE" > "$ENV_FILE.tmp"
    cat "$ENV_FILE.tmp" > "$ENV_FILE"
    rm -f "$ENV_FILE.tmp"
}

get_env() {
    awk -F= -v k="$1" '$1 == k { sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit }' "$ENV_FILE"
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
    local addr
    addr="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "$addr" ] || addr="$(ip route get 1 2>/dev/null | awk '{for (i=1;i<NF;i++) if ($i=="src") {print $(i+1); exit}}')"
    printf '%s' "$addr"
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
    local host port user pass from to url ip
    host="$(ask "SMTP host" "smtp.gmail.com")"
    port="$(ask "SMTP port (587 = STARTTLS, 465 = SSL)" "587")"
    user="$(ask "SMTP username (blank for no auth)" "")"
    pass=""
    [ -z "$user" ] || pass="$(ask_secret "SMTP password / app password (hidden)")"
    from="$(ask "From address" "${user:-dockradar@example.com}")"
    to="$(ask "Send notifications to" "")"
    ip="$(host_ip)"
    url="$(ask "DockRadar URL for email links" "http://${ip:-localhost}:$(get_env PORT || true)")"
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
        if [ -n "${!var+x}" ]; then
            set_env "$var" "${!var}"
            any=true
        fi
    done
    [ "$any" = false ] || success "Email settings applied from environment variables."
}

mkdir -p "$CONF_DIR"
FIRST_INSTALL=false
if [ ! -f "$ENV_FILE" ]; then
    FIRST_INSTALL=true
    cp "$APP_DIR/.env.example" "$ENV_FILE"
    # Neutralise the example's placeholder email values; the service supplies
    # absolute data/log paths, so drop the relative LOG_FILE default.
    for var in SMTP_USER SMTP_PASSWORD EMAIL_TO APP_URL; do set_env "$var" ""; done
    set_env LOG_FILE "$LOG_DIR/dockradar.log"
    info "Created $ENV_FILE"
fi
chown root:"$SVC_USER" "$CONF_DIR" "$ENV_FILE"
chmod 750 "$CONF_DIR"
chmod 640 "$ENV_FILE"

configure_email_from_env
if [ "$FIRST_INSTALL" = true ] && [ "$INTERACTIVE" = true ]; then
    if have_tty; then
        configure_email_interactive
    else
        warn "No terminal available — skipping email prompts. Edit $ENV_FILE to configure email."
    fi
fi

# ── systemd service ───────────────────────────────────────────
install -m 644 "$APP_DIR/packaging/dockradar.service" "$UNIT_PATH"
systemctl daemon-reload

if systemctl is-active --quiet "$SVC_NAME"; then
    info "Restarting $SVC_NAME..."
    systemctl restart "$SVC_NAME"
else
    info "Enabling and starting $SVC_NAME..."
    systemctl enable --now "$SVC_NAME" >/dev/null
fi

PORT="$(get_env PORT || true)"
PORT="${PORT:-8086}"
healthy=false
for _ in $(seq 1 20); do
    if command -v curl &>/dev/null; then
        curl -fsS "http://127.0.0.1:$PORT/api/health" &>/dev/null && { healthy=true; break; }
    elif systemctl is-active --quiet "$SVC_NAME"; then
        healthy=true; break
    fi
    sleep 1
done

echo ""
if [ "$healthy" = true ]; then
    success "DockRadar v$VERSION is running."
else
    warn "DockRadar did not answer on port $PORT yet. Check: journalctl -u $SVC_NAME -n 50"
fi
IP="$(host_ip || true)"
echo -e "  ${CYAN}UI      ${NC} → http://${IP:-localhost}:$PORT"
echo -e "  ${CYAN}Config  ${NC} → $ENV_FILE   (then: sudo systemctl restart $SVC_NAME)"
echo -e "  ${CYAN}Logs    ${NC} → journalctl -u $SVC_NAME -f"
echo -e "  ${CYAN}Email   ${NC} → change SMTP_* / EMAIL_TO in the config, restart, then use \"Send test\" in the UI"
echo -e "  ${CYAN}Upgrade ${NC} → re-run this installer"
echo -e "  ${CYAN}Remove  ${NC} → curl -fsSL https://github.com/$REPO/releases/latest/download/install.sh | sudo bash -s -- --uninstall [--purge]"
echo -e "            (or offline: sudo bash $PREFIX/current/install.sh --uninstall)"
if [ -z "$(get_env API_KEY || true)" ]; then
    echo ""
    warn "DockRadar controls Docker on this host. If port $PORT is reachable from other machines, set API_KEY in $ENV_FILE."
fi
