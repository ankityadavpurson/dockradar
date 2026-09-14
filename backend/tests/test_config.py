"""Tests for config parsing (HIDDEN_REPOSITORY, COMPOSE_DIR) and container filtering."""

import os
import subprocess
import sys
from pathlib import Path

from app.core.config import _path_env, config
from app.services.docker import ContainerInfo, DockerService


def _parse_hidden(raw: str) -> frozenset:
    # Mirrors the parsing in Config.HIDDEN_NAMES
    return frozenset(t.strip().lower() for t in raw.split(",") if t.strip())


class TestHiddenNamesParsing:
    def test_trims_lowercases_and_drops_empties(self):
        assert _parse_hidden(" Dockradar-v2-app, portainer ,,") == {
            "dockradar-v2-app",
            "portainer",
        }

    def test_empty_string_hides_nothing(self):
        assert _parse_hidden("") == frozenset()

    def test_single_value(self):
        assert _parse_hidden("qbittorrent") == {"qbittorrent"}


def _make_info(name: str, repository: str) -> ContainerInfo:
    return ContainerInfo(
        id="abc123",
        short_id="abc123"[:10],
        name=name,
        image_name=f"{repository}:latest",
        repository=repository,
        tag="latest",
        status="running",
    )


class FakeContainerCollection:
    def __init__(self, infos):
        self._infos = infos

    def list(self, all=True):
        return self._infos


class FakeClient:
    def __init__(self, infos):
        self.containers = FakeContainerCollection(infos)


class TestGetAllContainersFiltering:
    def _service_with(self, monkeypatch, infos, hidden: frozenset):
        monkeypatch.setattr(DockerService, "_connect", lambda self: None)
        # The fake client returns ContainerInfo objects directly; pass them
        # through _parse_container unchanged.
        monkeypatch.setattr(DockerService, "_parse_container", lambda self, c: c)
        monkeypatch.setattr(config, "HIDDEN_NAMES", hidden)
        svc = DockerService()
        svc._client = FakeClient(infos)
        return svc

    def test_hides_by_container_name(self, monkeypatch):
        infos = [_make_info("portainer", "portainer/portainer-ce"),
                 _make_info("it-tools", "corentinth/it-tools")]
        svc = self._service_with(monkeypatch, infos, frozenset({"portainer"}))
        names = [c.name for c in svc.get_all_containers()]
        assert names == ["it-tools"]

    def test_hides_by_repository(self, monkeypatch):
        infos = [_make_info("portainer", "portainer/portainer-ce"),
                 _make_info("it-tools", "corentinth/it-tools")]
        svc = self._service_with(monkeypatch, infos, frozenset({"corentinth/it-tools"}))
        names = [c.name for c in svc.get_all_containers()]
        assert names == ["portainer"]

    def test_matching_is_case_insensitive(self, monkeypatch):
        infos = [_make_info("Portainer", "portainer/portainer-ce")]
        svc = self._service_with(monkeypatch, infos, frozenset({"portainer"}))
        assert svc.get_all_containers() == []

    def test_no_substring_matching(self, monkeypatch):
        infos = [_make_info("portainer", "portainer/portainer-ce")]
        svc = self._service_with(monkeypatch, infos, frozenset({"port"}))
        names = [c.name for c in svc.get_all_containers()]
        assert names == ["portainer"]

    def test_empty_hidden_set_hides_nothing(self, monkeypatch):
        infos = [_make_info("a", "x/a"), _make_info("b", "x/b")]
        svc = self._service_with(monkeypatch, infos, frozenset())
        assert len(svc.get_all_containers()) == 2


class TestComposeDir:
    def test_default_is_backend_compose_files(self):
        backend_dir = Path(__file__).resolve().parents[1]
        assert _path_env("DOCKRADAR_TEST_UNSET", backend_dir / "compose_files") == (
            backend_dir / "compose_files"
        )

    def test_env_override(self, monkeypatch, tmp_path):
        monkeypatch.setenv("COMPOSE_DIR", str(tmp_path / "store"))
        assert _path_env("COMPOSE_DIR", Path("/unused")) == tmp_path / "store"

    def test_blank_env_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("COMPOSE_DIR", "   ")
        assert _path_env("COMPOSE_DIR", Path("/fallback")) == Path("/fallback")

    def test_tilde_is_expanded(self, monkeypatch):
        monkeypatch.setenv("COMPOSE_DIR", "~/dockradar")
        assert _path_env("COMPOSE_DIR", Path("/unused")) == Path.home() / "dockradar"

    def test_dockradar_env_file_is_loaded(self, tmp_path):
        # Runs in a subprocess because config is evaluated at import time.
        # The password uses the single-quoted form install.sh writes.
        env_file = tmp_path / "dockradar.env"
        env_file.write_text(
            "EMAIL_TO=me@test.local\n"
            "SMTP_PASSWORD='p@ss w0rd\"#$x\\\\y&|/\\'${HOME}'\n",
            encoding="utf-8",
        )
        env = {k: v for k, v in os.environ.items() if k not in ("EMAIL_TO", "SMTP_PASSWORD")}
        env["DOCKRADAR_ENV_FILE"] = str(env_file)
        out = subprocess.run(
            [sys.executable, "-c",
             "from app.core.config import config; print(config.EMAIL_TO); print(config.SMTP_PASSWORD)"],
            cwd=Path(__file__).resolve().parents[1],
            env=env, capture_output=True, text=True, check=True,
        ).stdout.splitlines()
        # ${HOME} stays literal: the installer-managed file is not interpolated.
        assert out == ["me@test.local", "p@ss w0rd\"#$x\\y&|/'${HOME}"]

    def test_config_default_points_at_backend(self):
        # Unless overridden in the test environment, the default is unchanged
        # from the pre-COMPOSE_DIR location so Docker/dev setups keep working.
        backend_dir = Path(__file__).resolve().parents[1]
        if not os.getenv("COMPOSE_DIR"):
            assert config.COMPOSE_DIR == backend_dir / "compose_files"
