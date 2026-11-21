"""Tests for UI-editable settings (app.core.settings) and /api/settings."""

import json

import pytest
from starlette.testclient import TestClient

from app.core.settings import SettingsStore, SettingsValidationError


class FakeConfig:
    """Stands in for app.core.config.Config (values are class attributes)."""
    SCAN_INTERVAL_HOURS = 6
    REGISTRY_CACHE_TTL = 300
    COMPOSE_TIMEOUT = 300
    HIDDEN_REPOSITORY = ""
    HIDDEN_NAMES = frozenset()
    SMTP_HOST = "smtp.gmail.com"
    SMTP_PORT = 587
    SMTP_USER = ""
    SMTP_PASSWORD = ""
    EMAIL_FROM = "dockradar@example.com"
    EMAIL_TO = ""
    SMTP_USE_SSL = False
    SMTP_STARTTLS = True
    APP_URL = ""
    API_KEY = ""
    HOST = "0.0.0.0"
    PORT = 8086
    LOG_FILE = "dockradar.log"
    COMPOSE_DIR = "/data"


@pytest.fixture
def cfg(monkeypatch):
    for key in ("SCAN_INTERVAL_HOURS", "SMTP_PORT", "SMTP_USE_SSL", "EMAIL_TO",
                "SMTP_PASSWORD", "API_KEY", "HIDDEN_REPOSITORY", "SMTP_HOST"):
        monkeypatch.delenv(key, raising=False)
    # A fresh subclass per test, so class attributes set by the store don't leak.
    return type("Cfg", (FakeConfig,), {})


def make_store(cfg, tmp_path):
    store = SettingsStore(cfg, tmp_path / "settings.json")
    store.load()
    return store


def item(store, key):
    return next(i for i in store.view()["settings"] if i["key"] == key)


class TestDefaultsAndSources:
    def test_defaults_when_nothing_set(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        scan = item(store, "SCAN_INTERVAL_HOURS")
        assert scan["value"] == 6 and scan["default"] == 6 and scan["source"] == "default"

    def test_env_source(self, cfg, tmp_path, monkeypatch):
        monkeypatch.setenv("SCAN_INTERVAL_HOURS", "12")
        cfg.SCAN_INTERVAL_HOURS = 12        # what config.py parsed from the env
        store = make_store(cfg, tmp_path)
        scan = item(store, "SCAN_INTERVAL_HOURS")
        assert scan["value"] == 12 and scan["default"] == 6 and scan["source"] == "env"

    def test_read_only_server_settings(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        port = item(store, "PORT")
        assert port["editable"] is False and port["value"] == 8086
        with pytest.raises(SettingsValidationError) as exc:
            store.update({"PORT": 9000})
        assert "PORT" in exc.value.errors


class TestUpdate:
    def test_saved_value_wins_and_persists(self, cfg, tmp_path, monkeypatch):
        monkeypatch.setenv("SCAN_INTERVAL_HOURS", "12")
        cfg.SCAN_INTERVAL_HOURS = 12
        store = make_store(cfg, tmp_path)
        changed = store.update({"SCAN_INTERVAL_HOURS": 2})
        assert changed == {"SCAN_INTERVAL_HOURS": (12, 2)}
        assert cfg.SCAN_INTERVAL_HOURS == 2
        assert item(store, "SCAN_INTERVAL_HOURS")["source"] == "saved"
        assert json.loads((tmp_path / "settings.json").read_text()) == {"SCAN_INTERVAL_HOURS": 2}

        # A restart loads it again on top of the env value.
        cfg2 = type("Cfg2", (FakeConfig,), {"SCAN_INTERVAL_HOURS": 12})
        make_store(cfg2, tmp_path)
        assert cfg2.SCAN_INTERVAL_HOURS == 2

    def test_reset_follows_env_again(self, cfg, tmp_path, monkeypatch):
        monkeypatch.setenv("SCAN_INTERVAL_HOURS", "12")
        cfg.SCAN_INTERVAL_HOURS = 12
        store = make_store(cfg, tmp_path)
        store.update({"SCAN_INTERVAL_HOURS": 2})
        store.update(reset=["SCAN_INTERVAL_HOURS"])
        assert cfg.SCAN_INTERVAL_HOURS == 12
        assert item(store, "SCAN_INTERVAL_HOURS")["source"] == "env"

    def test_value_equal_to_fallback_is_not_pinned(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"SCAN_INTERVAL_HOURS": 6})
        assert item(store, "SCAN_INTERVAL_HOURS")["source"] == "default"
        assert json.loads((tmp_path / "settings.json").read_text()) == {}

    def test_string_numbers_accepted(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"SMTP_PORT": "2525"})
        assert cfg.SMTP_PORT == 2525

    @pytest.mark.parametrize("key,value", [
        ("SCAN_INTERVAL_HOURS", 0),
        ("SCAN_INTERVAL_HOURS", "abc"),
        ("SCAN_INTERVAL_HOURS", True),
        ("SMTP_PORT", 70000),
        ("EMAIL_TO", "not-an-email"),
        ("EMAIL_FROM", ""),
        ("APP_URL", "ftp://host"),
        ("SMTP_HOST", "smtp example.com"),
        ("SMTP_STARTTLS", "yes"),
        ("API_KEY", "short"),
        ("SMTP_PASSWORD", "line1\nline2"),
        ("NOT_A_SETTING", "x"),
    ])
    def test_invalid_values_rejected(self, cfg, tmp_path, key, value):
        store = make_store(cfg, tmp_path)
        with pytest.raises(SettingsValidationError) as exc:
            store.update({key: value})
        assert key in exc.value.errors
        assert not (tmp_path / "settings.json").exists()

    def test_invalid_batch_saves_nothing(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        with pytest.raises(SettingsValidationError):
            store.update({"SCAN_INTERVAL_HOURS": 3, "SMTP_PORT": 0})
        assert cfg.SCAN_INTERVAL_HOURS == 6

    def test_normalises_text(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"HIDDEN_REPOSITORY": " Portainer ,, my-db ",
                      "APP_URL": "http://10.0.0.5:8086/",
                      "EMAIL_TO": "  me@example.com "})
        assert cfg.HIDDEN_REPOSITORY == "Portainer, my-db"
        assert cfg.HIDDEN_NAMES == frozenset({"portainer", "my-db"})
        assert cfg.APP_URL == "http://10.0.0.5:8086"
        assert cfg.EMAIL_TO == "me@example.com"


class TestSecrets:
    def test_secret_never_returned(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"SMTP_PASSWORD": "hunter2!", "API_KEY": "abcdefgh12"})
        for key in ("SMTP_PASSWORD", "API_KEY"):
            it = item(store, key)
            assert it["value"] is None and it["is_set"] is True
        assert "hunter2" not in json.dumps(store.view())
        assert cfg.SMTP_PASSWORD == "hunter2!"

    def test_secret_can_be_cleared_over_env(self, cfg, tmp_path, monkeypatch):
        monkeypatch.setenv("SMTP_PASSWORD", "from-env")
        cfg.SMTP_PASSWORD = "from-env"
        store = make_store(cfg, tmp_path)
        store.update({"SMTP_PASSWORD": ""})
        assert cfg.SMTP_PASSWORD == ""
        it = item(store, "SMTP_PASSWORD")
        assert it["is_set"] is False and it["source"] == "saved" and it["fallback_is_set"] is True

    @pytest.mark.skipif(__import__("os").name == "nt", reason="POSIX permissions")
    def test_file_is_private(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"API_KEY": "abcdefgh12"})
        assert (tmp_path / "settings.json").stat().st_mode & 0o077 == 0


class TestSslDefault:
    def test_ssl_follows_port_until_set(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"SMTP_PORT": 465})
        assert cfg.SMTP_USE_SSL is True
        assert item(store, "SMTP_USE_SSL")["source"] == "default"
        store.update({"SMTP_USE_SSL": False})
        assert cfg.SMTP_USE_SSL is False
        assert item(store, "SMTP_USE_SSL")["source"] == "saved"

    def test_ssl_matching_port_default_not_pinned(self, cfg, tmp_path):
        store = make_store(cfg, tmp_path)
        store.update({"SMTP_PORT": 465, "SMTP_USE_SSL": True})
        assert item(store, "SMTP_USE_SSL")["source"] == "default"


class TestLoad:
    def test_bad_entries_in_file_are_ignored(self, cfg, tmp_path):
        (tmp_path / "settings.json").write_text(json.dumps({
            "SCAN_INTERVAL_HOURS": 3, "SMTP_PORT": -1, "PORT": 1, "BOGUS": 1,
        }))
        make_store(cfg, tmp_path)
        assert cfg.SCAN_INTERVAL_HOURS == 3
        assert cfg.SMTP_PORT == 587
        assert cfg.PORT == 8086

    def test_corrupt_file_ignored(self, cfg, tmp_path):
        (tmp_path / "settings.json").write_text("{not json")
        store = make_store(cfg, tmp_path)
        assert item(store, "SCAN_INTERVAL_HOURS")["value"] == 6


class TestApi:
    @pytest.fixture
    def client(self, cfg, tmp_path, monkeypatch):
        import app.core.settings as settings_mod
        from app.api import routes
        from app.main import app

        store = make_store(cfg, tmp_path)
        monkeypatch.setattr(settings_mod, "_store", store)
        monkeypatch.setattr(routes, "config", cfg)
        monkeypatch.setattr(routes.api_state, "containers", ["placeholder"])
        calls = {}
        monkeypatch.setattr(routes.scheduler_svc, "is_running", lambda: True)
        monkeypatch.setattr(routes.scheduler_svc, "update_interval",
                            lambda h: calls.setdefault("interval", h))
        monkeypatch.setattr(routes.registry_svc, "set_cache_ttl",
                            lambda t: calls.setdefault("ttl", t))
        c = TestClient(app)
        c.calls = calls
        return c

    def test_get(self, client):
        data = client.get("/api/settings").json()
        assert {"settings", "store_path", "env_file"} <= data.keys()
        assert any(s["key"] == "SCAN_INTERVAL_HOURS" for s in data["settings"])

    def test_put_applies_live(self, client):
        from app.api import routes
        res = client.put("/api/settings", json={"values": {
            "SCAN_INTERVAL_HOURS": 4, "REGISTRY_CACHE_TTL": 60, "HIDDEN_REPOSITORY": "x"}})
        assert res.status_code == 200
        assert set(res.json()["changed"]) == {"SCAN_INTERVAL_HOURS", "REGISTRY_CACHE_TTL", "HIDDEN_REPOSITORY"}
        assert client.calls == {"interval": 4, "ttl": 60}
        assert routes.api_state.containers == []   # rediscovered on next list

    def test_put_validation_error(self, client):
        res = client.put("/api/settings", json={"values": {"SMTP_PORT": 0}})
        assert res.status_code == 422
        assert "SMTP_PORT" in res.json()["detail"]["errors"]
