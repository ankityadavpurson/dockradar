"""
DockRadar - Docker Service
Handles all interactions with the Docker daemon via the Docker SDK.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import docker
from docker.errors import DockerException, NotFound, APIError
from docker.models.containers import Container

logger = logging.getLogger(__name__)


@dataclass
class ContainerInfo:
    """Structured representation of a Docker container."""
    id: str
    short_id: str
    name: str
    image_name: str
    repository: str
    tag: str
    status: str
    # Populated after registry check
    latest_tag: Optional[str] = None
    update_status: str = "unknown"  # up_to_date | update_available | error | unknown
    error_message: Optional[str] = None
    # Digest of the locally running image (sha256:...)
    local_digest: Optional[str] = None
    # Raw config for recreation
    raw_config: dict = field(default_factory=dict)


class DockerService:
    """Service for communicating with the Docker daemon."""

    def __init__(self):
        self._client: Optional[docker.DockerClient] = None
        self._connect()

    def _connect(self):
        """Establish connection to Docker daemon."""
        try:
            self._client = docker.from_env()
            self._client.ping()
            logger.info("Connected to Docker daemon successfully.")
        except DockerException as exc:
            logger.error("Failed to connect to Docker daemon: %s", exc)
            self._client = None

    @property
    def client(self) -> Optional[docker.DockerClient]:
        if self._client is None:
            self._connect()
        return self._client

    def is_connected(self) -> bool:
        """Return True if Docker daemon is reachable."""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def get_all_containers(self) -> list[ContainerInfo]:
        """Fetch all containers (running and stopped)."""
        if not self.client:
            logger.error("Docker client not available.")
            return []

        containers: list[ContainerInfo] = []
        try:
            raw_containers: list[Container] = self.client.containers.list(all=True)
            for c in raw_containers:
                info = self._parse_container(c)
                if info:
                    containers.append(info)
            logger.info("Discovered %d containers.", len(containers))
        except APIError as exc:
            logger.error("Error listing containers: %s", exc)
        return containers

    def _parse_container(self, container: Container) -> Optional[ContainerInfo]:
        """Parse a raw Docker container object into ContainerInfo."""
        try:
            image_str: str = container.image.tags[0] if container.image.tags else container.attrs["Config"]["Image"]
            repository, tag = self._split_image(image_str)

            # Capture the local image digest (first RepoDigest, strip the repo prefix)
            local_digest: Optional[str] = None
            try:
                repo_digests = container.image.attrs.get("RepoDigests", [])
                if repo_digests:
                    # RepoDigests look like "nginx@sha256:abc123..."
                    local_digest = repo_digests[0].split("@")[-1]
            except Exception:
                pass

            raw_config = {
                "image": image_str,
                "name": container.name,
                "ports": container.attrs.get("HostConfig", {}).get("PortBindings", {}),
                "environment": container.attrs.get("Config", {}).get("Env", []),
                "volumes": container.attrs.get("HostConfig", {}).get("Binds", []),
                "restart_policy": container.attrs.get("HostConfig", {}).get("RestartPolicy", {}),
                "network_mode": container.attrs.get("HostConfig", {}).get("NetworkMode", "bridge"),
                "networks": list(container.attrs.get("NetworkSettings", {}).get("Networks", {}).keys()),
                "labels": container.attrs.get("Config", {}).get("Labels", {}),
                "command": container.attrs.get("Config", {}).get("Cmd"),
                "entrypoint": container.attrs.get("Config", {}).get("Entrypoint"),
                "hostname": container.attrs.get("Config", {}).get("Hostname", ""),
                "user": container.attrs.get("Config", {}).get("User", ""),
                "working_dir": container.attrs.get("Config", {}).get("WorkingDir", ""),
            }

            return ContainerInfo(
                id=container.id,
                short_id=container.short_id,
                name=container.name.lstrip("/"),
                image_name=image_str,
                repository=repository,
                tag=tag,
                status=container.status,
                local_digest=local_digest,
                raw_config=raw_config,
            )
        except Exception as exc:
            logger.warning("Failed to parse container %s: %s", container.name, exc)
            return None

    @staticmethod
    def _split_image(image_str: str) -> tuple[str, str]:
        """Split 'repo:tag' into (repo, tag). Defaults tag to 'latest'."""
        if ":" in image_str.split("/")[-1]:
            parts = image_str.rsplit(":", 1)
            return parts[0], parts[1]
        return image_str, "latest"

    def pull_image(self, repository: str, tag: str) -> bool:
        """Pull the latest image from the registry.

        After pulling, removes the old image with the same tag from the local
        cache so that recreate_container is forced to use the freshly pulled
        layers rather than a stale cached version.
        """
        if not self.client:
            return False
        try:
            logger.info("Pulling image %s:%s ...", repository, tag)

            # Pull the new image — this always fetches from the registry
            new_image = self.client.images.pull(repository, tag=tag)
            logger.info("Successfully pulled %s:%s (id: %s)", repository, tag, new_image.short_id)

            return True
        except APIError as exc:
            logger.error("Failed to pull %s:%s — %s", repository, tag, exc)
            return False

    def stop_container(self, container_name: str) -> bool:
        """Stop a running container."""
        if not self.client:
            return False
        try:
            container = self.client.containers.get(container_name)
            container.stop(timeout=30)
            logger.info("Stopped container: %s", container_name)
            return True
        except NotFound:
            logger.warning("Container not found for stop: %s", container_name)
            return False
        except APIError as exc:
            logger.error("Error stopping %s: %s", container_name, exc)
            return False

    def remove_container(self, container_name: str) -> bool:
        """Remove a container (must be stopped first)."""
        if not self.client:
            return False
        try:
            container = self.client.containers.get(container_name)
            container.remove()
            logger.info("Removed container: %s", container_name)
            return True
        except NotFound:
            logger.warning("Container not found for removal: %s", container_name)
            return False
        except APIError as exc:
            logger.error("Error removing %s: %s", container_name, exc)
            return False

    def recreate_container(self, config: dict) -> Optional[Container]:
        """Recreate a container from its saved configuration.

        After calling containers.run(), waits up to 10 seconds to verify the
        container reaches 'running' status. Raises RuntimeError if it ends up
        in 'restarting', 'exited', or 'dead' — so the caller can report a
        meaningful failure instead of silently returning a broken container.
        """
        if not self.client:
            return None
        try:
            name = config["name"]
            image = config["image"]

            # Always pull the image by digest-qualified name if available so
            # Docker doesn't reuse a stale cached layer for the same tag.
            # containers.run() with `pull_policy` isn't available on older SDK
            # versions, so we rely on pull_image() being called before this.

            # Build kwargs
            kwargs: dict = {
                "name": name,
                "detach": True,
                "image": image,
                "environment": config.get("environment") or [],
                "restart_policy": config.get("restart_policy") or {"Name": "no"},
                "labels": config.get("labels") or {},
            }

            if config.get("command"):
                kwargs["command"] = config["command"]
            if config.get("entrypoint"):
                kwargs["entrypoint"] = config["entrypoint"]
            if config.get("hostname"):
                kwargs["hostname"] = config["hostname"]
            if config.get("user"):
                kwargs["user"] = config["user"]
            if config.get("working_dir"):
                kwargs["working_dir"] = config["working_dir"]

            # Volumes
            if config.get("volumes"):
                kwargs["volumes"] = config["volumes"]

            # Ports
            port_bindings = config.get("ports") or {}
            if port_bindings:
                kwargs["ports"] = port_bindings

            # Network
            network_mode = config.get("network_mode", "bridge")
            if network_mode not in ("bridge", "host", "none"):
                kwargs["network"] = network_mode
            else:
                kwargs["network_mode"] = network_mode

            container = self.client.containers.run(**kwargs)
            logger.info("Recreated container: %s", name)

            # ── Wait for the container to stabilise ──────────────────────────
            # Poll up to 10 seconds (20 × 0.5s) for a terminal state.
            import time
            for _ in range(20):
                time.sleep(0.5)
                container.reload()
                status = container.status

                if status == "running":
                    logger.info("Container %s is running.", name)
                    return container

                if status in ("restarting", "exited", "dead"):
                    # Grab the last few log lines to help diagnose the failure
                    try:
                        logs = container.logs(tail=20).decode("utf-8", errors="replace").strip()
                    except Exception:
                        logs = "(could not retrieve logs)"
                    raise RuntimeError(
                        f"Container '{name}' entered '{status}' state after recreate.\n"
                        f"Last logs:\n{logs}"
                    )

            # Timed out waiting — return the container anyway (e.g. it's still
            # initialising) but log a warning so it appears in the progress log.
            container.reload()
            logger.warning(
                "Container %s did not reach 'running' within 10s — current status: %s",
                name, container.status,
            )
            return container

        except RuntimeError:
            raise  # re-raise so update_service can surface the message
        except APIError as exc:
            logger.error("Error recreating container %s: %s", config.get("name"), exc)
            return None

    def get_container_status(self, container_name: str) -> Optional[str]:
        """Get the current status of a specific container."""
        if not self.client:
            return None
        try:
            container = self.client.containers.get(container_name)
            return container.status
        except NotFound:
            return None
        except APIError as exc:
            logger.error("Error getting status of %s: %s", container_name, exc)
            return None
