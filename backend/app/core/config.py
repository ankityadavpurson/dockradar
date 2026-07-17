"""
DockRadar - Configuration
Loads and validates environment variables for the application.
"""

import logging
import os
from dotenv import load_dotenv

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


class Config:
    """Central configuration loaded from environment variables."""

    # Scheduler
    SCAN_INTERVAL_HOURS: int = _int_env("SCAN_INTERVAL_HOURS", 6)

    # SMTP / Email
    SMTP_HOST: str     = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int     = _int_env("SMTP_PORT", 587)
    SMTP_USER: str     = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str    = os.getenv("EMAIL_FROM", "dockradar@example.com")
    EMAIL_TO: str      = os.getenv("EMAIL_TO", "")

    # Application
    HOST: str     = os.getenv("HOST", "0.0.0.0")
    PORT: int     = _int_env("PORT", 8086)
    LOG_FILE: str = os.getenv("LOG_FILE", "dockradar.log")

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
        """Check if email settings are fully configured."""
        return bool(cls.SMTP_USER and cls.SMTP_PASSWORD and cls.EMAIL_TO)


config = Config()
