"""
DockRadar - Settings editable from the UI

Values saved from the Settings page are stored as JSON in COMPOSE_DIR/settings.json
(the data folder, which is a mounted volume in Docker and a data directory in
native installs, so it survives upgrades and container re-creation).

Precedence for every editable setting:
    saved in the UI  >  environment / env file  >  built-in default

"Reset" on a setting deletes the saved value, so it follows the env file (or
the default) again. Settings that only take effect when the server starts
(HOST, PORT, LOG_FILE, COMPOSE_DIR, DOCKER_HOST) are reported read-only: they
belong to the env file / docker-compose.yml, where a wrong value can't lock
the UI out of the server.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

SETTINGS_FILENAME = "settings.json"


class SettingsValidationError(ValueError):
    """Raised with a {KEY: message} dict when submitted values are invalid."""

    def __init__(self, errors: dict[str, str]):
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))
        self.errors = errors


@dataclass(frozen=True)
class Setting:
    key: str
    label: str
    group: str                      # scanning | email | security | server
    kind: str                       # int | str | bool | secret | list | url | email
    default: Any = None
    help: str = ""
    editable: bool = True
    min: Optional[int] = None
    max: Optional[int] = None
    placeholder: str = ""


SETTINGS: tuple[Setting, ...] = (
    # ── Scanning ─────────────────────────────────────────────────────────────
    Setting("SCAN_INTERVAL_HOURS", "Scan interval (hours)", "scanning", "int", 6,
            "How often the automatic scan runs. Changing it restarts the countdown to the next scan.",
            min=1, max=720),
    Setting("REGISTRY_CACHE_TTL", "Registry cache (seconds)", "scanning", "int", 300,
            "How long registry lookups are reused before asking the registry again. 0 turns the cache off.",
            min=0, max=86400),
    Setting("COMPOSE_TIMEOUT", "Compose command timeout (seconds)", "scanning", "int", 300,
            "Maximum time a single `docker compose pull` / `up` may run before it is stopped. "
            "Raise it for very large images on slow connections.",
            min=10, max=7200),
    Setting("HIDDEN_REPOSITORY", "Hidden containers", "scanning", "list", "",
            "Container or repository names to hide, comma-separated (not case-sensitive). "
            "Hidden containers are not listed, scanned or auto-updated.",
            placeholder="my-critical-db, portainer"),

    # ── Email ────────────────────────────────────────────────────────────────
    Setting("EMAIL_TO", "Send notifications to", "email", "email", "",
            "Recipient address. Leave blank to turn email notifications off.",
            placeholder="admin@example.com"),
    Setting("EMAIL_FROM", "From address", "email", "email", "dockradar@example.com"),
    Setting("SMTP_HOST", "SMTP server", "email", "str", "smtp.gmail.com",
            placeholder="smtp.example.com"),
    Setting("SMTP_PORT", "SMTP port", "email", "int", 587,
            "587 uses STARTTLS, 465 uses SSL.", min=1, max=65535),
    Setting("SMTP_USER", "SMTP username", "email", "str", "",
            "Leave blank for relays that don't need a login."),
    Setting("SMTP_PASSWORD", "SMTP password", "email", "secret", "",
            "For Gmail, use an App Password."),
    Setting("SMTP_USE_SSL", "Use SSL (implicit TLS)", "email", "bool", None,
            "On by default when the port is 465."),
    Setting("SMTP_STARTTLS", "Use STARTTLS", "email", "bool", True,
            "Upgrade the connection with STARTTLS when the server offers it."),
    Setting("APP_URL", "DockRadar URL", "email", "url", "",
            "Public address of this UI. Adds an \"Open DockRadar\" link to notification emails.",
            placeholder="http://192.168.1.10:8086"),

    # ── Security ─────────────────────────────────────────────────────────────
    Setting("API_KEY", "API key", "security", "secret", "",
            "When set, every /api request except /api/health needs the X-Api-Key header. "
            "Saving a new key here also stores it in this browser."),

    # ── Server (read-only: applied at startup) ───────────────────────────────
    Setting("HOST", "Listen address", "server", "str", "0.0.0.0", editable=False),
    Setting("PORT", "Port", "server", "int", 8086, editable=False),
    Setting("LOG_FILE", "Log file", "server", "str", "dockradar.log", editable=False),
    Setting("COMPOSE_DIR", "Data folder", "server", "str", None,
            "Where compose files, scan results and these settings are stored.", editable=False),
    Setting("DOCKER_HOST", "Docker host", "server", "str", None,
            "Docker daemon address. Blank means the Docker default (the local socket).", editable=False),
)

BY_KEY: dict[str, Setting] = {s.key: s for s in SETTINGS}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+$")


def parse_hidden(raw: str) -> frozenset:
    """HIDDEN_REPOSITORY → set of lower-cased names."""
    return frozenset(t.strip().lower() for t in raw.split(",") if t.strip())


def _coerce(s: Setting, value: Any) -> Any:
    """Validate and normalise one submitted value. Raises ValueError(message)."""
    if s.kind == "int":
        if isinstance(value, bool):
            raise ValueError("Must be a whole number.")
        if isinstance(value, str):
            value = value.strip()
        try:
            number = int(value)
        except (TypeError, ValueError):
            raise ValueError("Must be a whole number.") from None
        if isinstance(value, float) and value != number:
            raise ValueError("Must be a whole number.")
        if s.min is not None and number < s.min:
            raise ValueError(f"Must be at least {s.min}.")
        if s.max is not None and number > s.max:
            raise ValueError(f"Must be at most {s.max}.")
        return number

    if s.kind == "bool":
        if not isinstance(value, bool):
            raise ValueError("Must be true or false.")
        return value

    if not isinstance(value, str):
        raise ValueError("Must be text.")

    if s.kind == "secret":
        # Kept verbatim (passwords may legitimately start or end with spaces),
        # but a newline would corrupt SMTP auth / the header compare.
        if "\n" in value or "\r" in value:
            raise ValueError("Must be a single line.")
        if s.key == "API_KEY" and value and (len(value) < 8 or re.search(r"\s", value)):
            raise ValueError("Use at least 8 characters, without spaces.")
        return value

    value = value.strip()
    if s.kind == "list":
        return ", ".join(t.strip() for t in value.split(",") if t.strip())
    if s.kind == "email":
        if value and not _EMAIL_RE.match(value):
            raise ValueError("Enter a single email address, like name@example.com.")
        if not value and s.key == "EMAIL_FROM":
            raise ValueError("A sender address is required.")
        return value
    if s.kind == "url":
        if value and not re.match(r"^https?://[^\s/]+", value):
            raise ValueError("Must start with http:// or https://.")
        return value.rstrip("/")
    # plain str
    if re.search(r"\s", value):
        raise ValueError("Must not contain spaces.")
    return value


class SettingsStore:
    """Owns settings.json and applies saved values onto the Config class."""

    def __init__(self, cfg: Any, path: Path):
        # Values are set on the Config *class*: email_configured() is a
        # classmethod and reads class attributes.
        self._cfg_cls = cfg if isinstance(cfg, type) else type(cfg)
        self._path = Path(path)
        self._lock = threading.Lock()
        self._overrides: dict[str, Any] = {}
        # What the env file / environment (or the built-in default) gives,
        # captured before any saved value is applied.
        self._base: dict[str, Any] = {
            s.key: getattr(self._cfg_cls, s.key) for s in SETTINGS if s.editable
        }
        self._from_env: set[str] = {
            s.key for s in SETTINGS if s.editable and self._env_present(s)
        }

    @property
    def path(self) -> Path:
        return self._path

    # ── Loading / applying ──────────────────────────────────────────────────

    @staticmethod
    def _env_present(s: Setting) -> bool:
        raw = os.environ.get(s.key)
        if raw is None:
            return False
        # Numbers and switches fall back to the default when blank; text
        # settings take a blank env value literally.
        return raw.strip() != "" if s.kind in ("int", "bool") else True

    def load(self) -> None:
        """Read settings.json (if any), drop invalid entries, and apply."""
        data: dict = {}
        try:
            if self._path.is_file():
                data = json.loads(self._path.read_text(encoding="utf-8")) or {}
                if not isinstance(data, dict):
                    raise ValueError("top level is not an object")
        except Exception as exc:
            logger.warning("Ignoring unreadable settings file %s: %s", self._path, exc)
            data = {}

        overrides: dict[str, Any] = {}
        for key, value in data.items():
            s = BY_KEY.get(key)
            if not s or not s.editable:
                logger.warning("Ignoring unknown or read-only setting %s in %s", key, self._path)
                continue
            try:
                overrides[key] = _coerce(s, value)
            except ValueError as exc:
                logger.warning("Ignoring invalid saved value for %s: %s", key, exc)
        with self._lock:
            self._overrides = overrides
            self._apply()
        if overrides:
            logger.info("Applied %d setting(s) saved from the UI (%s).",
                        len(overrides), ", ".join(sorted(overrides)))

    def _default(self, s: Setting) -> Any:
        if s.key == "SMTP_USE_SSL":
            return self._effective("SMTP_PORT") == 465
        if s.key == "COMPOSE_DIR":
            return str(Path(__file__).resolve().parents[2] / "compose_files")
        return s.default

    def _source(self, key: str) -> str:
        if key in self._overrides:
            return "saved"
        return "env" if key in self._from_env else "default"

    def _resolve(self, key: str, overrides: dict) -> Any:
        """Effective value of `key` under the given saved values."""
        if key in overrides:
            return overrides[key]
        return self._fallback(key, overrides)

    def _fallback(self, key: str, overrides: dict) -> Any:
        """What `key` is when nothing is saved for it: the env value, else the
        default (SMTP_USE_SSL's default follows the effective port)."""
        if key == "SMTP_USE_SSL" and key not in self._from_env:
            return self._resolve("SMTP_PORT", overrides) == 465
        return self._base[key]

    def _effective(self, key: str) -> Any:
        return self._resolve(key, self._overrides)

    def _apply(self) -> None:
        for s in SETTINGS:
            if s.editable:
                setattr(self._cfg_cls, s.key, self._effective(s.key))
        self._cfg_cls.HIDDEN_NAMES = parse_hidden(self._cfg_cls.HIDDEN_REPOSITORY)

    def _write(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".settings-", suffix=".json", dir=self._path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(self._overrides, fh, indent=2, sort_keys=True)
            try:
                os.chmod(tmp, 0o600)   # holds the SMTP password / API key
            except OSError:
                pass
            os.replace(tmp, self._path)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    # ── Public API ──────────────────────────────────────────────────────────

    def view(self) -> dict:
        """Every setting with its current value, default and source. Secrets
        are never returned - only whether they are set."""
        items = []
        with self._lock:
            for s in SETTINGS:
                item = {
                    "key": s.key, "label": s.label, "group": s.group, "kind": s.kind,
                    "help": s.help, "editable": s.editable, "placeholder": s.placeholder,
                    "min": s.min, "max": s.max,
                }
                if s.editable:
                    value = self._effective(s.key)
                    item["source"] = self._source(s.key)
                    # What "Reset" would give back: the env value or the default.
                    item["fallback_source"] = "env" if s.key in self._from_env else "default"
                    if s.kind == "secret":
                        item.update(value=None, default=None, fallback=None, is_set=bool(value),
                                    fallback_is_set=bool(self._fallback(s.key, self._overrides)))
                    else:
                        item.update(value=value, default=self._default(s),
                                    fallback=self._fallback(s.key, self._overrides))
                else:
                    if s.key == "DOCKER_HOST":
                        value = os.environ.get("DOCKER_HOST") or None
                    else:
                        value = getattr(self._cfg_cls, s.key)
                    if isinstance(value, Path):
                        value = str(value)
                    item.update(value=value, default=self._default(s),
                                source="env" if os.environ.get(s.key) else "default")
                items.append(item)
        return {
            "settings": items,
            "store_path": str(self._path),
            "env_file": os.getenv("DOCKRADAR_ENV_FILE") or None,
        }

    def update(self, values: Optional[dict] = None, reset: Optional[list] = None) -> dict[str, tuple]:
        """Validate, save and apply. Returns {KEY: (old, new)} for settings
        whose effective value changed. Raises SettingsValidationError."""
        values = values or {}
        reset = reset or []
        errors: dict[str, str] = {}
        clean: dict[str, Any] = {}

        for key, value in values.items():
            s = BY_KEY.get(key)
            if not s:
                errors[key] = "Unknown setting."
            elif not s.editable:
                errors[key] = "Set this in the env file or docker-compose.yml, then restart."
            else:
                try:
                    clean[key] = _coerce(s, value)
                except ValueError as exc:
                    errors[key] = str(exc)
        for key in reset:
            s = BY_KEY.get(key)
            if not s or not s.editable:
                errors[key] = "Unknown or read-only setting."
            elif key in values:
                errors[key] = "Can't change and reset a setting at the same time."
        if errors:
            raise SettingsValidationError(errors)

        with self._lock:
            before = {s.key: self._effective(s.key) for s in SETTINGS if s.editable}
            overrides = dict(self._overrides)
            for key in reset:
                overrides.pop(key, None)
            overrides.update(clean)
            # A value equal to what the env file / default gives is not pinned:
            # the setting keeps following the env file.
            for key in clean:
                if overrides[key] == self._fallback(key, overrides):
                    overrides.pop(key)

            previous = self._overrides
            self._overrides = overrides
            try:
                self._write()
            except Exception:
                self._overrides = previous
                raise
            self._apply()
            after = {s.key: self._effective(s.key) for s in SETTINGS if s.editable}

        changed = {k: (before[k], after[k]) for k in after if before[k] != after[k]}
        if changed:
            logger.info("Settings changed from the UI: %s", ", ".join(sorted(changed)))
        return changed


_store: Optional[SettingsStore] = None


def get_store() -> SettingsStore:
    """The process-wide store, created and loaded on first use."""
    global _store
    if _store is None:
        from app.core.config import config
        _store = SettingsStore(config, config.COMPOSE_DIR / SETTINGS_FILENAME)
        _store.load()
    return _store
