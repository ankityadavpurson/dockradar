"""
DockRadar - Configuration
Loads and validates environment variables for the application.
"""

import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# DOCKRADAR_ENV_FILE points at an explicit config file (used by the macOS
# LaunchAgent, which has no EnvironmentFile equivalent); otherwise .env is
# discovered as before. Existing environment variables always take precedence.
_ENV_FILE = os.getenv("DOCKRADAR_ENV_FILE", "").strip()
if _ENV_FILE:
    # Installer-managed file: values are literal (no ${VAR} expansion), so
    # passwords containing "${" are not mangled.
    load_dotenv(_ENV_FILE, interpolate=False)
else:
    load_dotenv()

logger = logging.getLogger(__name__)


def _int_env(name: str, default: int) -> int:
    """Read an int env var, falling back to the default on bad input."""
    raw = os.getenv(name, "")
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid value for %s: %r — using default %d.", name, raw, default)
        return default


def _bool_env(name: str, default: bool) -> bool:
    """Read a boolean env var (true/1/yes/on). Empty → default."""
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _path_env(name: str, default: Path) -> Path:
    """Read a filesystem path env var (~ expanded). Empty → default."""
    raw = os.getenv(name, "").strip()
    return Path(raw).expanduser() if raw else default


class Config:
    """Central configuration loaded from environment variables."""

    # Storage — where uploaded compose files live. Defaults to backend/
    # compose_files; native Linux installs set /var/lib/dockradar/compose_files.
    COMPOSE_DIR: Path = _path_env(
        "COMPOSE_DIR", Path(__file__).resolve().parents[2] / "compose_files"
    )

    # Scheduler
    SCAN_INTERVAL_HOURS: int = _int_env("SCAN_INTERVAL_HOURS", 6)

    # SMTP / Email
    SMTP_HOST: str     = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int     = _int_env("SMTP_PORT", 587)
    SMTP_USER: str     = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str    = os.getenv("EMAIL_FROM", "dockradar@example.com")
    EMAIL_TO: str      = os.getenv("EMAIL_TO", "")
    # Transport: implicit SSL (port 465) is auto-detected; STARTTLS is used
    # otherwise when the server offers it. Both can be forced via env.
    SMTP_USE_SSL: bool  = _bool_env("SMTP_USE_SSL", SMTP_PORT == 465)
    SMTP_STARTTLS: bool = _bool_env("SMTP_STARTTLS", True)

    # Application
    HOST: str     = os.getenv("HOST", "0.0.0.0")
    PORT: int     = _int_env("PORT", 8086)
    LOG_FILE: str = os.getenv("LOG_FILE", "dockradar.log")

    # Public URL of the DockRadar UI, used for the link in notification emails.
    # e.g. http://192.168.1.10:8086 — leave blank to omit the link.
    APP_URL: str = os.getenv("APP_URL", "").rstrip("/")

    # Comma-separated container or repository names to hide from DockRadar
    # entirely (not listed, not scanned, not auto-updated).
    # e.g. HIDDEN_REPOSITORY=dockradar-v2-app,portainer
    HIDDEN_REPOSITORY: str = os.getenv("HIDDEN_REPOSITORY", "")
    HIDDEN_NAMES: frozenset = frozenset(
        t.strip().lower() for t in HIDDEN_REPOSITORY.split(",") if t.strip()
    )

    # Optional API key — when set, all /api routes except /api/health
    # require the X-Api-Key header.
    API_KEY: str = os.getenv("API_KEY", "")

    # Registry cache TTL in seconds
    REGISTRY_CACHE_TTL: int = _int_env("REGISTRY_CACHE_TTL", 300)

    @classmethod
    def email_configured(cls) -> bool:
        """Email is usable when we have a host and a recipient. Auth
        (SMTP_USER/SMTP_PASSWORD) is optional — some relays don't require it."""
        return bool(cls.SMTP_HOST and cls.EMAIL_TO)


config = Config()
