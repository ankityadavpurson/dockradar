"""Tests for the optional X-Api-Key guard middleware."""

import pytest
from starlette.testclient import TestClient

from app.core.config import config
from app.main import app

GUARDED = "/api/scan/status"   # lightweight guarded route (no Docker calls)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "s3cret")
    # TestClient without a context manager does not run lifespan (scheduler).
    return TestClient(app)


def test_missing_key_rejected(client):
    assert client.get(GUARDED).status_code == 401


def test_wrong_key_rejected(client):
    assert client.get(GUARDED, headers={"X-Api-Key": "nope"}).status_code == 401


def test_correct_key_allowed(client):
    assert client.get(GUARDED, headers={"X-Api-Key": "s3cret"}).status_code != 401


def test_health_open_without_key(client):
    assert client.get("/api/health").status_code != 401


def test_no_key_configured_allows_all(monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "")
    c = TestClient(app)
    assert c.get(GUARDED).status_code != 401
