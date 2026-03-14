"""
DockRadar - Compose Service
Handles parsing of docker-compose YAML files and running compose-based
image updates (pull + up -d) for individual services.
"""

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

# Directory where uploaded compose files are stored (relative to project root)
COMPOSE_STORE_DIR = Path("compose_files")
ASSOCIATIONS_FILE = COMPOSE_STORE_DIR / "associations.json"


class ComposeFile:
    """Represents a stored docker-compose file and its parsed services."""

    def __init__(self, file_id: str, filename: str, path: Path, content: str):
        self.file_id  = file_id
        self.filename = filename
        self.path     = path
        self.content  = content
        self._parsed: Optional[dict] = None

    @property
    def parsed(self) -> dict:
        if self._parsed is None:
            try:
                self._parsed = yaml.safe_load(self.content) or {}
            except yaml.YAMLError as exc:
                logger.warning("Failed to parse compose file %s: %s", self.filename, exc)
                self._parsed = {}
        return self._parsed

    @property
    def services(self) -> dict[str, dict]:
        """Return the services dict from the compose file."""
        return self.parsed.get("services", {})

    def service_image(self, service_name: str) -> Optional[str]:
        """Return the image string for a given service, or None."""
        svc = self.services.get(service_name, {})
        return svc.get("image")

    def to_dict(self) -> dict:
        service_names = list(self.services.keys())
        return {
            "file_id":  self.file_id,
            "filename": self.filename,
            "services": service_names,
        }


class ComposeService:
    """
    Manages uploaded docker-compose files and orchestrates compose-based updates.

    Compose files are persisted to disk under COMPOSE_STORE_DIR so they
    survive server restarts. Associations between container names and compose
    services are kept in memory (reset on restart) — intentionally lightweight,
    since the user can re-associate after a restart.
    """

    def __init__(self):
        COMPOSE_STORE_DIR.mkdir(exist_ok=True)
        self._files:  dict[str, ComposeFile] = {}       # file_id → ComposeFile
        # container_name → (file_id, service_name)
        self._associations: dict[str, tuple[str, str]] = {}
        self._load_existing()
        self._load_associations()

    # ── File management ───────────────────────────────────────────────────────

    def _load_existing(self):
        """Load any compose files that were previously saved to disk."""
        for p in list(sorted(COMPOSE_STORE_DIR.glob("*.yml"))) + list(sorted(COMPOSE_STORE_DIR.glob("*.yaml"))):
            file_id = p.stem
            try:
                content = p.read_text(encoding="utf-8")
                cf = ComposeFile(file_id=file_id, filename=p.name, path=p, content=content)
                self._files[file_id] = cf
                logger.info("Loaded compose file: %s (%d services)", p.name, len(cf.services))
            except Exception as exc:
                logger.warning("Could not load compose file %s: %s", p, exc)


    def _load_associations(self):
        """Load persisted associations from disk."""
        if not ASSOCIATIONS_FILE.exists():
            return
        try:
            data = json.loads(ASSOCIATIONS_FILE.read_text(encoding="utf-8"))
            for container_name, assoc in data.items():
                fid, svc = assoc["file_id"], assoc["service_name"]
                # Only restore if the file still exists
                if fid in self._files:
                    self._associations[container_name] = (fid, svc)
            logger.info("Loaded %d association(s) from disk.", len(self._associations))
        except Exception as exc:
            logger.warning("Could not load associations: %s", exc)

    def _save_associations(self):
        """Persist current associations to disk."""
        try:
            data = {
                name: {"file_id": fid, "service_name": svc}
                for name, (fid, svc) in self._associations.items()
            }
            ASSOCIATIONS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not save associations: %s", exc)

    def save_file(self, filename: str, content: str) -> ComposeFile:
        """
        Save a new compose file to disk and register it.
        If a file with the same name already exists it is overwritten.
        Returns the ComposeFile object.
        """
        # Validate YAML before saving
        try:
            parsed = yaml.safe_load(content)
            if not isinstance(parsed, dict) or "services" not in parsed:
                raise ValueError("File does not contain a 'services' key — is this a valid compose file?")
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid YAML: {exc}") from exc

        # Use a sanitised filename stem as the file_id
        safe_stem = Path(filename).stem.replace(" ", "_")
        file_id   = safe_stem
        dest_path = COMPOSE_STORE_DIR / f"{safe_stem}.yml"

        dest_path.write_text(content, encoding="utf-8")
        cf = ComposeFile(file_id=file_id, filename=filename, path=dest_path, content=content)
        self._files[file_id] = cf
        logger.info("Saved compose file: %s (%d services)", filename, len(cf.services))
        return cf

    def delete_file(self, file_id: str) -> bool:
        """Delete a stored compose file and remove all its associations."""
        cf = self._files.pop(file_id, None)
        if cf is None:
            return False
        try:
            cf.path.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("Could not delete compose file %s: %s", cf.path, exc)

        # Remove any associations pointing to this file
        self._associations = {
            k: v for k, v in self._associations.items() if v[0] != file_id
        }
        self._save_associations()
        logger.info("Deleted compose file: %s", cf.filename)
        return True

    def list_files(self) -> list[dict]:
        return [cf.to_dict() for cf in self._files.values()]

    def get_file(self, file_id: str) -> Optional[ComposeFile]:
        return self._files.get(file_id)

    # ── Associations ──────────────────────────────────────────────────────────

    def associate(self, container_name: str, file_id: str, service_name: str) -> bool:
        """
        Link a container to a service inside a compose file.
        Returns False if the file or service doesn't exist.
        """
        cf = self._files.get(file_id)
        if cf is None:
            return False
        if service_name not in cf.services:
            return False
        self._associations[container_name] = (file_id, service_name)
        self._save_associations()
        logger.info("Associated container '%s' → %s / %s", container_name, cf.filename, service_name)
        return True

    def disassociate(self, container_name: str):
        """Remove the compose association for a container."""
        self._associations.pop(container_name, None)
        self._save_associations()

    def get_association(self, container_name: str) -> Optional[tuple[str, str]]:
        """Return (file_id, service_name) for a container, or None."""
        return self._associations.get(container_name)

    def all_associations(self) -> dict[str, dict]:
        """Return all associations as {container_name: {file_id, service_name}}."""
        return {
            name: {"file_id": fid, "service_name": svc}
            for name, (fid, svc) in self._associations.items()
        }

    # ── Update via compose ────────────────────────────────────────────────────

    def update_via_compose(
        self,
        container_name: str,
        progress_cb=None,
    ) -> tuple[bool, str]:
        """
        Run `docker compose pull <service>` then `docker compose up -d <service>`
        for the compose service associated with container_name.

        Returns (success: bool, message: str).
        """
        def report(msg: str):
            logger.info("[compose] [%s] %s", container_name, msg)
            if progress_cb:
                progress_cb(msg)

        assoc = self._associations.get(container_name)
        if assoc is None:
            return False, f"No compose file associated with '{container_name}'."

        file_id, service_name = assoc
        cf = self._files.get(file_id)
        if cf is None:
            return False, f"Compose file '{file_id}' no longer exists."

        compose_bin = self._find_compose_binary()
        if compose_bin is None:
            return False, (
                "Neither 'docker compose' (plugin) nor 'docker-compose' (standalone) "
                "was found. Install Docker Compose to use this feature."
            )

        compose_path = str(cf.path.resolve())
        report(f"Using compose file: {cf.filename}")
        report(f"Service: {service_name}")

        # ── Step 1: pull ──────────────────────────────────────────────────────
        report(f"Pulling latest image for service '{service_name}'...")
        pull_ok, pull_out = self._run_compose(
            compose_bin, compose_path, ["pull", service_name]
        )
        report(pull_out)
        if not pull_ok:
            return False, f"compose pull failed:\n{pull_out}"

        # ── Step 2: up -d ─────────────────────────────────────────────────────
        report(f"Recreating service '{service_name}'...")
        up_ok, up_out = self._run_compose(
            compose_bin, compose_path, ["up", "-d", "--no-deps", service_name]
        )
        report(up_out)
        if not up_ok:
            return False, f"compose up failed:\n{up_out}"

        report(f"✓ Service '{service_name}' updated via compose.")
        return True, f"Updated via compose: {cf.filename} / {service_name}"

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _find_compose_binary() -> Optional[list[str]]:
        """
        Detect available compose binary.
        Returns a command prefix list, e.g. ['docker', 'compose'] or ['docker-compose'].
        """
        # Prefer the Docker Compose v2 plugin
        try:
            result = subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True, timeout=5,
            )
            if result.returncode == 0:
                return ["docker", "compose"]
        except Exception:
            pass

        # Fall back to standalone docker-compose v1
        if shutil.which("docker-compose"):
            return ["docker-compose"]

        return None

    @staticmethod
    def _run_compose(
        compose_bin: list[str],
        compose_file: str,
        args: list[str],
    ) -> tuple[bool, str]:
        """Run a compose command and return (success, combined output)."""
        cmd = compose_bin + ["-f", compose_file] + args
        logger.debug("Running: %s", " ".join(cmd))
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 min max for a pull
            )
            output = (result.stdout + result.stderr).strip()
            return result.returncode == 0, output or "(no output)"
        except subprocess.TimeoutExpired:
            return False, "Command timed out after 5 minutes."
        except Exception as exc:
            return False, str(exc)
