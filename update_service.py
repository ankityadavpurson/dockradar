"""
DockRadar - Update Service
Orchestrates the full lifecycle of updating a container image:
pull → stop → remove → recreate → start
"""

import logging
from typing import Callable, Optional

from docker_service import DockerService, ContainerInfo

logger = logging.getLogger(__name__)


class UpdateResult:
    """Result of a single container update operation."""

    def __init__(self, container_name: str):
        self.container_name = container_name
        self.success = False
        self.steps: list[tuple[str, bool]] = []  # (step_name, success)
        self.error: Optional[str] = None

    def add_step(self, name: str, ok: bool):
        self.steps.append((name, ok))

    def __repr__(self):
        return f"<UpdateResult container={self.container_name} success={self.success}>"


class UpdateService:
    """Service responsible for updating Docker containers in-place."""

    def __init__(self, docker_service: DockerService):
        self._docker = docker_service

    def update_container(
        self,
        container: ContainerInfo,
        progress_cb: Optional[Callable[[str], None]] = None,
    ) -> UpdateResult:
        """
        Update a single container to its latest image.

        Steps:
        1. Pull latest image
        2. Stop the container
        3. Remove the container
        4. Recreate with original config
        5. Verify it started

        Args:
            container: ContainerInfo with raw_config populated.
            progress_cb: Optional callback(message) for UI progress updates.

        Returns:
            UpdateResult
        """
        result = UpdateResult(container.name)

        def report(msg: str):
            logger.info("[%s] %s", container.name, msg)
            if progress_cb:
                progress_cb(msg)

        # Determine target image
        repository = container.repository
        tag = container.latest_tag or container.tag
        full_image = f"{repository}:{tag}"

        report(f"Pulling image {full_image} ...")
        pull_ok = self._docker.pull_image(repository, tag)
        result.add_step("Pull image", pull_ok)
        if not pull_ok:
            result.error = f"Failed to pull image {full_image}"
            report(f"✗ Pull failed: {result.error}")
            return result

        report("Stopping container ...")
        stop_ok = self._docker.stop_container(container.name)
        result.add_step("Stop container", stop_ok)
        if not stop_ok:
            logger.warning("Could not stop %s — attempting removal anyway.", container.name)

        report("Removing container ...")
        remove_ok = self._docker.remove_container(container.name)
        result.add_step("Remove container", remove_ok)
        if not remove_ok:
            result.error = "Failed to remove container"
            report(f"✗ Remove failed: {result.error}")
            return result

        # Update the image reference in the config
        raw_config = dict(container.raw_config)
        raw_config["image"] = full_image

        report("Recreating container ...")
        try:
            new_container = self._docker.recreate_container(raw_config)
            create_ok = new_container is not None
        except RuntimeError as exc:
            # Container was created but entered restarting/exited/dead state
            result.add_step("Recreate container", False)
            result.error = str(exc)
            report(f"✗ Container started but failed to stay running:\n{exc}")
            return result

        result.add_step("Recreate container", create_ok)
        if not create_ok:
            result.error = "Failed to recreate container"
            report(f"✗ Recreate failed: {result.error}")
            return result

        # Verify — recreate_container already polled for status, but do a
        # final check here to set result.success accurately.
        status = self._docker.get_container_status(container.name)
        started = status == "running"
        result.add_step("Verify running", started)

        if started:
            result.success = True
            report(f"✓ Container updated and running → {full_image}")
        else:
            result.error = f"Container recreated but status is '{status}'"
            report(f"⚠ Container recreated but status is '{status}' — check container logs")

        return result

    def update_multiple(
        self,
        containers: list[ContainerInfo],
        progress_cb: Optional[Callable[[str, str], None]] = None,
    ) -> list[UpdateResult]:
        """
        Update multiple containers sequentially.

        Args:
            containers: List of ContainerInfo objects with update_status == 'update_available'.
            progress_cb: Optional callback(container_name, message).

        Returns:
            List of UpdateResult objects.
        """
        results: list[UpdateResult] = []
        total = len(containers)

        for i, container in enumerate(containers, 1):
            logger.info("Updating container %d/%d: %s", i, total, container.name)
            if progress_cb:
                progress_cb(container.name, f"Starting update {i}/{total}: {container.name}")

            def cb(msg, name=container.name):
                if progress_cb:
                    progress_cb(name, msg)

            result = self.update_container(container, progress_cb=cb)
            results.append(result)

        return results
