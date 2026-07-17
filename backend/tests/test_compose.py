"""Tests for ComposeService file storage and associations (isolated tmp dir)."""

import pytest

import app.services.compose as compose_mod
from app.services.compose import ComposeService

VALID_COMPOSE = """\
services:
  web:
    image: nginx:1.25
  db:
    image: postgres:16
"""


@pytest.fixture
def svc(tmp_path, monkeypatch):
    monkeypatch.setattr(compose_mod, "COMPOSE_STORE_DIR", tmp_path)
    monkeypatch.setattr(compose_mod, "ASSOCIATIONS_FILE", tmp_path / "associations.json")
    monkeypatch.setattr(compose_mod, "METADATA_FILE", tmp_path / "metadata.json")
    return ComposeService()


class TestSaveFile:
    def test_save_and_get(self, svc):
        cf = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        assert cf.filename == "docker-compose.yml"
        assert set(cf.services) == {"web", "db"}
        assert svc.get_file_content(cf.file_id) == VALID_COMPOSE

    def test_rejects_invalid_yaml(self, svc):
        with pytest.raises(ValueError):
            svc.save_file("bad.yml", "services: [unclosed")

    def test_rejects_missing_services_key(self, svc):
        with pytest.raises(ValueError):
            svc.save_file("bad.yml", "version: '3'\n")

    def test_duplicate_filenames_get_distinct_ids(self, svc):
        a = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        b = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        assert a.file_id != b.file_id

    def test_persists_across_reload(self, svc):
        cf = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        reloaded = ComposeService()
        loaded = reloaded.get_file(cf.file_id)
        assert loaded is not None
        assert loaded.filename == "docker-compose.yml"


class TestAssociations:
    def test_associate_and_get(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        assert svc.associate("my-web", cf.file_id, "web") is True
        assert svc.get_association("my-web") == (cf.file_id, "web")

    def test_associate_unknown_service_fails(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        assert svc.associate("my-web", cf.file_id, "nope") is False

    def test_associate_unknown_file_fails(self, svc):
        assert svc.associate("my-web", "missing", "web") is False

    def test_disassociate(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        svc.disassociate("my-web")
        assert svc.get_association("my-web") is None

    def test_delete_file_removes_associations(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        assert svc.delete_file(cf.file_id) is True
        assert svc.get_association("my-web") is None
        assert svc.get_file(cf.file_id) is None

    def test_associations_persist_across_reload(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        reloaded = ComposeService()
        assert reloaded.get_association("my-web") == (cf.file_id, "web")


class TestUpdateFile:
    def test_update_content(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        new_content = VALID_COMPOSE.replace("nginx:1.25", "nginx:1.27")
        updated = svc.update_file(cf.file_id, new_content)
        assert updated.service_image("web") == "nginx:1.27"

    def test_update_unknown_id_raises(self, svc):
        with pytest.raises(ValueError):
            svc.update_file("missing", VALID_COMPOSE)
