"""
DockRadar - Configuration Module
Loads and validates environment variables for the application.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration loaded from environment variables."""

    # Scheduler
    SCAN_INTERVAL_HOURS: int = int(os.getenv("SCAN_INTERVAL_HOURS", "6"))

    # SMTP / Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "dockradar@example.com")
    EMAIL_TO: str = os.getenv("EMAIL_TO", "")

    # Application
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))
    LOG_FILE: str = os.getenv("LOG_FILE", "dockradar.log")

    # Docker
    DOCKER_SOCKET: str = os.getenv("DOCKER_SOCKET", "unix://var/run/docker.sock")

    # Registry cache TTL in seconds
    REGISTRY_CACHE_TTL: int = int(os.getenv("REGISTRY_CACHE_TTL", "300"))

    @classmethod
    def email_configured(cls) -> bool:
        """Check if email settings are fully configured."""
        return bool(cls.SMTP_USER and cls.SMTP_PASSWORD and cls.EMAIL_TO)


config = Config()
