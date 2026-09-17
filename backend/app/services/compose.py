"""
DockRadar - Compose Service
Handles parsing of docker-compose YAML files and running compose-based
image updates (pull + up -d) for individual services.
"""

import json
import logging
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

import yaml

from app.core.config import config

logger = logging.getLogger(__name__)

# Directory where uploaded compose files are stored. Defaults to backend/
# compose_files; native installs point COMPOSE_DIR at /var/lib/dockradar.
COMPOSE_STORE_DIR = config.COMPOSE_DIR
ASSOCIATIONS_FILE = COMPOSE_STORE_DIR / "associations.json"
METADATA_FILE     = COMPOSE_STORE_DIR / "metadata.json"   # file_id → original filename


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
            "file_id":   self.file_id,
            "filename":  self.filename,
            "services":  service_names,
            "label":     self.filename,   # display label — same as filename, FE can add suffix
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
        COMPOSE_STORE_DIR.mkdir(parents=True, exist_ok=True)
        self._files:  dict[str, ComposeFile] = {}       # file_id → ComposeFile
        # container_name → (file_id, service_name)
        self._associations: dict[str, tuple[str, str]] = {}
        self._load_existing()
        self._load_associations()

    # ── File management ───────────────────────────────────────────────────────

    def _load_existing(self):
        """Load any compose files that were previously saved to disk.

        The metadata sidecar (metadata.json) stores the original upload filename
        for each file_id so that duplicate filenames (e.g. two docker-compose.yml
        from different projects) are preserved correctly.
        """
        # Load the metadata sidecar first so we can restore original filenames
        meta: dict[str, str] = {}
        if METADATA_FILE.exists():
            try:
                meta = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Could not load metadata: %s", exc)

        yml_files  = list(sorted(COMPOSE_STORE_DIR.glob("*.yml")))
        yaml_files = list(sorted(COMPOSE_STORE_DIR.glob("*.yaml")))
        for p in yml_files + yaml_files:
            if p.name in ("associations.json", "metadata.json"):
                continue
            file_id = p.stem   # e.g. "1710000000_docker-compose"
            original_name = meta.get(file_id, p.name)
            try:
                file_content = p.read_text(encoding="utf-8")
                cf = ComposeFile(file_id=file_id, filename=original_name, path=p, content=file_content)
                self._files[file_id] = cf
                logger.info("Loaded compose file: %s as '%s' (%d services)", p.name, original_name, len(cf.services))
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

        Each upload gets a file_id based on compose service names + a timestamp,
        e.g. "web_db_1776793871", so stored files are easier to identify.
        The original upload filename is still preserved in metadata.json.

        Returns the ComposeFile object.
        """
        # Validate YAML before saving
        try:
            parsed = yaml.safe_load(content)
            if not isinstance(parsed, dict) or "services" not in parsed:
                raise ValueError("File does not contain a 'services' key — is this a valid compose file?")
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid YAML: {exc}") from exc

        # file_id format: <service_a>_<service_b>_<timestamp>
        # (service names sanitized for filesystem safety)
        services = parsed.get("services", {})
        service_tokens = [
            str(name).strip().replace(" ", "_").replace("/", "_")
            for name in services.keys()
            if str(name).strip()
        ]
        service_prefix = "_".join(service_tokens) if service_tokens else "compose"
        base_file_id = f"{service_prefix}_{int(time.time())}"
        file_id = base_file_id
        dest_path = COMPOSE_STORE_DIR / f"{file_id}.yml"
        suffix = 1
        while dest_path.exists() or file_id in self._files:
            file_id = f"{base_file_id}_{suffix}"
            dest_path = COMPOSE_STORE_DIR / f"{file_id}.yml"
            suffix += 1

        dest_path.write_text(content, encoding="utf-8")

        # Persist the original filename to the metadata sidecar
        self._save_metadata(file_id, filename)

        cf = ComposeFile(file_id=file_id, filename=filename, path=dest_path, content=content)
        self._files[file_id] = cf
        logger.info("Saved compose file: %s → %s (%d services)", filename, dest_path.name, len(cf.services))
        return cf

    def _save_metadata(self, file_id: str, filename: str):
        """Append a file_id → original filename entry to the metadata sidecar."""
        try:
            meta: dict = {}
            if METADATA_FILE.exists():
                meta = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
            meta[file_id] = filename
            METADATA_FILE.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not save metadata: %s", exc)

    def _delete_metadata(self, file_id: str):
        """Remove a file_id entry from the metadata sidecar."""
        try:
            if not METADATA_FILE.exists():
                return
            meta = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
            meta.pop(file_id, None)
            METADATA_FILE.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not update metadata: %s", exc)


    def get_file_content(self, file_id: str) -> Optional[str]:
        """Return the raw YAML content of a stored compose file."""
        cf = self._files.get(file_id)
        return cf.content if cf else None

    def update_file(self, file_id: str, new_content: str) -> ComposeFile:
        """
        Overwrite an existing compose file with new YAML content.
        Validates the YAML before writing. Re-parses the in-memory object.
        Raises ValueError on invalid YAML or unknown file_id.
        """
        cf = self._files.get(file_id)
        if cf is None:
            raise ValueError(f"Compose file '{file_id}' not found.")

        # Validate
        try:
            parsed = yaml.safe_load(new_content)
            if not isinstance(parsed, dict) or "services" not in parsed:
                raise ValueError("File does not contain a 'services' key — is this a valid compose file?")
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid YAML: {exc}") from exc

        # Write to disk
        cf.path.write_text(new_content, encoding="utf-8")

        # Replace in-memory object so services list is fresh
        updated = ComposeFile(
            file_id=cf.file_id,
            filename=cf.filename,
            path=cf.path,
            content=new_content,
        )
        self._files[file_id] = updated
        logger.info("Updated compose file: %s (%d services)", cf.filename, len(updated.services))
        return updated

    def delete_file(self, file_id: str) -> bool:
        """Delete a stored compose file and remove all its associations."""
        cf = self._files.pop(file_id, None)
        if cf is None:
            return False
        try:
            cf.path.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("Could not delete compose file %s: %s", cf.path, exc)

        self._delete_metadata(file_id)

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

    def resolve_target(self, container_name: str, labels: Optional[dict] = None) -> Optional[dict]:
        """Decide how to run compose for a container.

        Prefers the container's **own** compose project (from Docker Compose
        labels) when its config file(s) are readable by this process — that runs
        against the real file and project name, avoiding the drift and
        network/volume-namespacing problems of an uploaded copy. Falls back to a
        stored (uploaded + associated) file otherwise.

        Returns ``{mode, service, flags, label}`` or None when neither is usable.
        ``flags`` is the compose flag list (``-p/--project-directory/-f`` …).
        """
        # 1) Label mode — real file, real project, no upload needed.
        if labels and all(Path(f).is_file() for f in labels["config_files"]):
            flags = ["-p", labels["project"]]
            if labels.get("working_dir"):
                flags += ["--project-directory", labels["working_dir"]]
            for f in labels["config_files"]:
                flags += ["-f", f]
            return {
                "mode": "labels",
                "service": labels["service"],
                "flags": flags,
                "files": list(labels["config_files"]),
                "label": f"{Path(labels['config_files'][0]).name} (project {labels['project']})",
            }
        # 2) Stored-copy mode — uploaded file + association.
        assoc = self._associations.get(container_name)
        if assoc is not None:
            file_id, service_name = assoc
            cf = self._files.get(file_id)
            if cf is not None:
                return {
                    "mode": "stored",
                    "service": service_name,
                    "flags": ["-f", str(cf.path.resolve())],
                    "files": [str(cf.path.resolve())],
                    "label": cf.filename,
                    "file_id": file_id,
                }
        return None

    def update_via_compose(
        self,
        container_name: str,
        progress_cb=None,
        labels: Optional[dict] = None,
        target_image: Optional[str] = None,
    ) -> tuple[bool, str]:
        """
        Run `docker compose pull <service>` then `docker compose up -d <service>`
        for the container's compose service — using its own project labels when
        available, else a stored/associated file.

        In **label mode**, when ``target_image`` is given and the compose file
        still points the service at a different image, the file's ``image:`` line
        is rewritten to ``target_image`` first (a ``.bak`` backup is kept), so a
        pinned-tag service actually moves to the new tag. Stored mode is left to
        the dialog's explicit file edit.

        Returns (success: bool, message: str).
        """
        def report(msg: str):
            logger.info("[compose] [%s] %s", container_name, msg)
            if progress_cb:
                progress_cb(msg)

        target = self.resolve_target(container_name, labels)
        if target is None:
            return False, (
                f"No compose project found for '{container_name}'. Its compose "
                "file could not be located from container labels, and no compose "
                "file is associated. Upload + associate one, or ensure the "
                "compose file is readable by DockRadar."
            )

        compose_bin = self._compose_bin()
        if compose_bin is None:
            return False, (
                "Neither 'docker compose' (plugin) nor 'docker-compose' (standalone) "
                "was found. If DockRadar runs in a container, the image must include "
                "the Docker CLI + compose plugin; on a native install, install "
                "Docker Compose on the host."
            )

        report(f"Update mode: {target['mode']} — {target['label']}")
        report(f"Service: {target['service']}")

        # ── P4: move a pinned tag by editing the real file (label mode only) ──
        if target_image and target["mode"] == "labels":
            try:
                self._apply_image_edit(target["files"], target["service"], target_image, report)
            except Exception as exc:
                return False, f"Could not update the compose file's image tag: {exc}"

        ok = self._pull_and_recreate(
            compose_bin, target["flags"], target["service"], container_name, report
        )
        if not ok[0]:
            return ok

        # ── P5: report the image the container is now actually running ──
        new_image, new_digest = self._docker_current_image(container_name)
        if new_image:
            short = new_digest.replace("sha256:", "")[:12] if new_digest else ""
            report(f"Now running: {new_image}" + (f" @ {short}" if short else ""))
        return True, f"Updated via compose ({target['mode']}): {target['label']} / {target['service']}"

    def _pull_and_recreate(self, compose_bin, flags, service_name, container_name, report) -> tuple[bool, str]:
        """Shared pull + safe-recreate used by both label and stored-copy modes."""
        # ── Step 1: pull ──────────────────────────────────────────────────────
        report(f"Pulling latest image for service '{service_name}'...")
        pull_ok, pull_out = self._run_compose(
            compose_bin, flags, ["pull", service_name], line_cb=report
        )
        if not pull_ok:
            # Pull doesn't touch the running container, so nothing to recover.
            return False, f"compose pull failed:\n{pull_out}"

        # ── Step 2: recreate ──────────────────────────────────────────────────
        # Prefer an in-place `up -d`: compose stops/recreates the container it
        # manages, so the old one keeps running if this fails for a config
        # reason. Only when compose refuses because the name is already taken by
        # a container it did NOT create do we stop+remove and retry — that
        # name-conflict is the sole reason the manual removal ever existed (it
        # cannot happen in label mode, where the project owns the container).
        up_args = ["up", "-d", "--no-deps", service_name]
        report(f"Recreating service '{service_name}'...")
        up_ok, up_out = self._run_compose(compose_bin, flags, up_args, line_cb=report)

        if not up_ok and self._is_name_conflict(up_out):
            report("Container was created outside this compose project — replacing it...")
            self._docker_stop_rm(container_name)
            up_ok, up_out = self._run_compose(compose_bin, flags, up_args, line_cb=report)

        if not up_ok:
            # The service may now be down. Try to bring the previous container
            # back (it survives a failed in-place up, or a stopped state).
            report("✗ compose up failed — attempting to restore the previous container...")
            if self._docker_start(container_name):
                report(f"Restored '{container_name}' on its previous image.")
                return False, (
                    "compose up failed; the previous container was restarted "
                    f"(still on the old image).\n{up_out}"
                )
            return False, (
                "compose up failed and the service is DOWN — manual intervention "
                f"needed.\n{up_out}"
            )

        report(f"✓ Service '{service_name}' updated via compose.")
        return True, "recreated"

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _is_name_conflict(output: str) -> bool:
        """True if `up` failed only because the container name is already taken
        by a container compose did not create (the case the stop+remove fallback
        exists for)."""
        low = (output or "").lower()
        return (
            "is already in use by container" in low
            or ("conflict" in low and "container name" in low)
            or "already in use" in low
        )

    @staticmethod
    def _docker_stop_rm(container_name: str) -> None:
        """Stop and remove a container directly via the Docker CLI. Best-effort:
        the container may not exist (first-time deploy)."""
        try:
            subprocess.run(["docker", "stop", container_name], capture_output=True, timeout=30)
            subprocess.run(["docker", "rm", container_name], capture_output=True, timeout=15)
        except Exception as exc:
            logger.debug("docker stop/rm for %s: %s", container_name, exc)

    @staticmethod
    def _docker_start(container_name: str) -> bool:
        """Attempt to (re)start an existing container. Returns True on success —
        used to restore the previous container after a failed update."""
        try:
            result = subprocess.run(
                ["docker", "start", container_name], capture_output=True, timeout=30
            )
            return result.returncode == 0
        except Exception as exc:
            logger.debug("docker start for %s: %s", container_name, exc)
            return False

    @staticmethod
    def _docker_current_image(container_name: str) -> tuple[Optional[str], Optional[str]]:
        """Return (image_ref, digest) the container is currently running, via
        `docker inspect`. ``digest`` is the image's registry RepoDigest when
        available, else the local image id. Best-effort (post-update check)."""
        def _inspect(ref, fmt):
            try:
                r = subprocess.run(
                    ["docker", "inspect", ref, "--format", fmt],
                    capture_output=True, text=True, timeout=15,
                )
                return r.stdout.strip() if r.returncode == 0 else ""
            except Exception as exc:
                logger.debug("docker inspect %s: %s", ref, exc)
                return ""

        out = _inspect(container_name, "{{.Config.Image}}|{{.Image}}")
        if not out:
            return None, None
        image_ref, _, image_id = out.partition("|")
        # Prefer the registry digest (from the image), else fall back to image id.
        repo_digests = _inspect(image_id or image_ref, "{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}")
        digest = repo_digests.split("@")[-1] if "@" in repo_digests else (image_id or None)
        return (image_ref or None), (digest or None)

    @staticmethod
    def _set_service_image(content: str, service: str, image: str) -> tuple[str, bool]:
        """Set ``services.<service>.image`` to ``image`` in compose YAML text,
        preserving comments/formatting/quoting (ruamel round-trip). Returns
        (new_content, changed). Only the one image key is touched."""
        from ruamel.yaml import YAML
        import io as _io

        yaml_rt = YAML()
        yaml_rt.preserve_quotes = True
        try:
            data = yaml_rt.load(content)
        except Exception:
            return content, False
        services = (data or {}).get("services") if hasattr(data, "get") else None
        if not services or service not in services:
            return content, False
        svc = services[service]
        if not hasattr(svc, "get") or "image" not in svc:
            return content, False
        if str(svc["image"]) == image:
            return content, False
        svc["image"] = image
        buf = _io.StringIO()
        yaml_rt.dump(data, buf)
        return buf.getvalue(), True

    def _apply_image_edit(self, files: list[str], service: str, image: str, report) -> bool:
        """Rewrite the ``image:`` line for ``service`` to ``image`` in whichever
        of ``files`` defines it, keeping a ``.bak`` backup. Returns True if a file
        was changed. Raises on write failure."""
        for f in files:
            path = Path(f)
            try:
                content = path.read_text(encoding="utf-8")
            except Exception:
                continue
            new_content, changed = self._set_service_image(content, service, image)
            if not changed:
                continue
            backup = path.with_suffix(path.suffix + ".bak")
            backup.write_text(content, encoding="utf-8")
            path.write_text(new_content, encoding="utf-8")
            report(f"Updated image for '{service}' → {image} in {path.name} (backup: {backup.name})")
            return True
        return False

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

    # Cache the (relatively expensive) compose-binary probe for the process
    # lifetime — a restart re-checks, which is enough to pick up an install.
    _compose_bin_cache: "list[str] | bool" = False  # False = not yet probed

    @classmethod
    def _compose_bin(cls) -> Optional[list[str]]:
        if cls._compose_bin_cache is False:
            cls._compose_bin_cache = cls._find_compose_binary()
        return cls._compose_bin_cache

    @classmethod
    def compose_cli_available(cls) -> bool:
        """True if a `docker compose` (or `docker-compose`) CLI is callable —
        e.g. false inside a container image that doesn't ship it."""
        return cls._compose_bin() is not None

    @staticmethod
    def _run_compose(
        compose_bin: list[str],
        compose_flags: list[str],
        args: list[str],
        line_cb=None,
        timeout: Optional[int] = None,
    ) -> tuple[bool, str]:
        """Run a compose command, streaming its output.

        ``compose_flags`` is the file/project flag list (e.g. ``["-f", path]`` or
        ``["-p", project, "--project-directory", dir, "-f", file]``). Output is
        read on a background thread and each non-blank line is forwarded to
        ``line_cb`` as it arrives (so the UI's progress log fills live instead of
        in one lump). ``timeout`` defaults to ``COMPOSE_TIMEOUT``. Returns
        (success, combined output).
        """
        if timeout is None:
            timeout = config.COMPOSE_TIMEOUT
        cmd = compose_bin + compose_flags + args
        logger.debug("Running: %s", " ".join(cmd))
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except Exception as exc:
            return False, str(exc)

        lines: list[str] = []

        def _reader():
            # proc.stdout is line-buffered text; iterate until EOF (process exit).
            for raw in proc.stdout:
                line = raw.rstrip("\n")
                lines.append(line)
                if line_cb and line.strip():
                    try:
                        line_cb(line)
                    except Exception:  # a bad callback must not kill the reader
                        pass

        reader = threading.Thread(target=_reader, daemon=True)
        reader.start()
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            reader.join(timeout=2)
            msg = f"Command timed out after {timeout}s."
            lines.append(msg)
            return False, "\n".join(lines).strip() or msg

        reader.join(timeout=5)
        output = "\n".join(lines).strip()
        return proc.returncode == 0, output or "(no output)"
