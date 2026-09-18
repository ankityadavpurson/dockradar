"""Tests for scan-result persistence + restore across restarts (routes.py)."""

import pytest

import app.api.routes as routes
from app.services.docker import ContainerInfo


def _c(cid, name, tag="latest", latest_tag=None, status="unknown", error_message=None):
    return ContainerInfo(
        id=cid, short_id=cid[:10], name=name, image_name=f"{name}:{tag}",
        repository=name, tag=tag, status="running",
        latest_tag=latest_tag, update_status=status, error_message=error_message,
    )


@pytest.fixture
def scan_env(tmp_path, monkeypatch):
    monkeypatch.setattr(routes, "_SCAN_FILE", tmp_path / "scan_results.json")
    monkeypatch.setattr(routes.api_state, "containers", [])
    monkeypatch.setattr(routes.api_state, "last_scan", None)
    return tmp_path


def test_save_load_roundtrip(scan_env):
    routes.api_state.containers = [_c("id1", "web", latest_tag="1.2", status="update_available")]
    routes.api_state.last_scan = "2026-01-01T00:00:00+00:00"
    routes._save_scan_results()

    data = routes._load_scan_results()
    assert data["last_scan"] == "2026-01-01T00:00:00+00:00"
    assert data["results"]["id1"]["update_status"] == "update_available"
    assert data["results"]["id1"]["latest_tag"] == "1.2"


def test_error_message_roundtrips(scan_env, monkeypatch):
    routes.api_state.containers = [
        _c("id1", "ghost", status="error", error_message="Repository not found on Docker Hub")
    ]
    routes.api_state.last_scan = "T"
    routes._save_scan_results()

    live = [_c("id1", "ghost")]
    monkeypatch.setattr(routes.docker_svc, "get_all_containers", lambda: live)
    routes.api_state.containers = []
    routes._restore_scan_state()

    c = routes.api_state.containers[0]
    assert c.update_status == "error"
    assert c.error_message == "Repository not found on Docker Hub"


def test_missing_file_returns_empty(scan_env):
    assert routes._load_scan_results() == {}


def test_restore_merges_by_id(scan_env, monkeypatch):
    # Persist a result for id1.
    routes.api_state.containers = [_c("id1", "web", latest_tag="1.2", status="update_available")]
    routes.api_state.last_scan = "T"
    routes._save_scan_results()

    # Simulate restart: fresh discovery returns id1 (same) + a new id2.
    live = [_c("id1", "web"), _c("id2", "db")]
    monkeypatch.setattr(routes.docker_svc, "get_all_containers", lambda: live)
    routes.api_state.containers = []

    routes._restore_scan_state()
    by_id = {c.id: c for c in routes.api_state.containers}
    assert by_id["id1"].update_status == "update_available"   # restored
    assert by_id["id1"].latest_tag == "1.2"
    assert by_id["id2"].update_status == "unknown"            # new container → not restored
    assert routes.api_state.last_scan == "T"


def test_restore_with_no_saved_file_is_all_unknown(scan_env, monkeypatch):
    live = [_c("id1", "web"), _c("id2", "db")]
    monkeypatch.setattr(routes.docker_svc, "get_all_containers", lambda: live)
    routes._restore_scan_state()
    assert all(c.update_status == "unknown" for c in routes.api_state.containers)
    assert routes.api_state.last_scan is None
