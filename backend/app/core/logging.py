"""
DockRadar - Logging Setup
Configures rotating file + console logging for the whole application.
"""

import logging
import sys
from logging.handlers import RotatingFileHandler

from app.core.config import config


def setup_logging() -> None:
    """Configure root logger with console and rotating file handlers."""
    fmt = logging.Formatter(
        fmt="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    try:
        fh = RotatingFileHandler(
            config.LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except (OSError, PermissionError) as exc:
        logging.warning("Could not create log file %s: %s", config.LOG_FILE, exc)

    for name in ("urllib3", "docker", "apscheduler", "watchfiles", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)
