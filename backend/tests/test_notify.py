"""Tests for persisted email-notification dedup state (survives restart)."""

from types import SimpleNamespace

import pytest

import app.api.routes as routes


def _container(name, latest_tag):
    """Minimal stand-in for ContainerInfo — only the fields _maybe_notify reads."""
    return SimpleNamespace(
        name=name,
        latest_tag=latest_tag,
        repository=f"library/{name}",
        tag="1.0",
        local_digest="sha256:" + "a" * 64,
    )


@pytest.fixture
def notif_file(tmp_path, monkeypatch):
    """Point persistence at a temp file and reset the in-memory set."""
    f = tmp_path / "notified_updates.json"
    monkeypatch.setattr(routes, "_NOTIFIED_FILE", f)
    monkeypatch.setattr(routes, "_notified_updates", set())
    return f


class TestLoadSave:
    def test_missing_file_returns_empty(self, notif_file):
        assert routes._load_notified() == set()

    def test_round_trip(self, notif_file):
        routes._save_notified({"a:1", "b:2"})
        assert notif_file.exists()
        assert routes._load_notified() == {"a:1", "b:2"}

    def test_corrupt_file_degrades_to_empty(self, notif_file):
        notif_file.write_text("{ not json", encoding="utf-8")
        assert routes._load_notified() == set()


class TestMaybeNotify:
    def test_sends_and_persists_new_update(self, notif_file, monkeypatch):
        monkeypatch.setattr(routes.config, "email_configured", lambda: True)
        sent = {}
        monkeypatch.setattr(
            routes.email_svc, "send_update_notification",
            lambda payload: sent.setdefault("payload", payload) or True,
        )
        routes._maybe_notify([_container("nginx", "1.27")])
        assert sent["payload"][0]["container_name"] == "nginx"
        # Persisted so a restart can read it back.
        assert routes._load_notified() == {"nginx:1.27"}

    def test_no_duplicate_after_restart(self, notif_file, monkeypatch):
        monkeypatch.setattr(routes.config, "email_configured", lambda: True)
        calls = []
        monkeypatch.setattr(
            routes.email_svc, "send_update_notification",
            lambda payload: calls.append(payload) or True,
        )
        # First run announces the update and persists it.
        routes._maybe_notify([_container("nginx", "1.27")])
        assert len(calls) == 1

        # Simulate a restart: fresh in-memory set loaded from disk.
        monkeypatch.setattr(routes, "_notified_updates", routes._load_notified())

        # Same outdated set — must NOT email again.
        routes._maybe_notify([_container("nginx", "1.27")])
        assert len(calls) == 1

    def test_prune_persists_when_set_changes(self, notif_file, monkeypatch):
        # Seed one announced update, then scan finds nothing outdated.
        routes._save_notified({"nginx:1.27"})
        monkeypatch.setattr(routes, "_notified_updates", routes._load_notified())
        monkeypatch.setattr(routes.config, "email_configured", lambda: True)

        routes._maybe_notify([])  # nothing outdated → prune to empty
        assert routes._load_notified() == set()
