"""Tests for EmailService transport selection and send_test result handling."""

import smtplib
from unittest.mock import MagicMock

import pytest

import app.services.email as email_mod
from app.core.config import Config, config
from app.services.email import EmailService


@pytest.fixture
def svc():
    return EmailService()


def set_cfg(monkeypatch, **kwargs):
    # email_configured() is a classmethod reading class attributes, so config
    # must be patched on the class (not the singleton instance).
    for k, v in kwargs.items():
        monkeypatch.setattr(Config, k, v)


class TestOpenSmtp:
    def test_uses_ssl_when_configured(self, svc, monkeypatch):
        set_cfg(monkeypatch, SMTP_USE_SSL=True)
        made = {}
        def fake_ssl(host, port, timeout=None, context=None):
            made["ssl"] = (host, port)
            return MagicMock()
        monkeypatch.setattr(email_mod.smtplib, "SMTP_SSL", fake_ssl)
        svc._open_smtp()
        assert made["ssl"] == (config.SMTP_HOST, config.SMTP_PORT)

    def test_starttls_path_when_offered(self, svc, monkeypatch):
        set_cfg(monkeypatch, SMTP_USE_SSL=False)
        set_cfg(monkeypatch, SMTP_STARTTLS=True)
        server = MagicMock()
        server.has_extn.return_value = True
        monkeypatch.setattr(email_mod.smtplib, "SMTP", lambda *a, **k: server)
        svc._open_smtp()
        server.starttls.assert_called_once()

    def test_no_starttls_when_server_lacks_it(self, svc, monkeypatch):
        set_cfg(monkeypatch, SMTP_USE_SSL=False)
        set_cfg(monkeypatch, SMTP_STARTTLS=True)
        server = MagicMock()
        server.has_extn.return_value = False
        monkeypatch.setattr(email_mod.smtplib, "SMTP", lambda *a, **k: server)
        svc._open_smtp()
        server.starttls.assert_not_called()

    def test_login_only_with_credentials(self, svc, monkeypatch):
        set_cfg(monkeypatch, SMTP_USE_SSL=False)
        set_cfg(monkeypatch, SMTP_STARTTLS=False)
        set_cfg(monkeypatch, SMTP_USER="")
        set_cfg(monkeypatch, SMTP_PASSWORD="")
        server = MagicMock()
        monkeypatch.setattr(email_mod.smtplib, "SMTP", lambda *a, **k: server)
        svc._open_smtp()
        server.login.assert_not_called()

    def test_login_called_with_credentials(self, svc, monkeypatch):
        set_cfg(monkeypatch, SMTP_USE_SSL=False)
        set_cfg(monkeypatch, SMTP_STARTTLS=False)
        set_cfg(monkeypatch, SMTP_USER="u")
        set_cfg(monkeypatch, SMTP_PASSWORD="p")
        server = MagicMock()
        monkeypatch.setattr(email_mod.smtplib, "SMTP", lambda *a, **k: server)
        svc._open_smtp()
        server.login.assert_called_once_with("u", "p")


class TestSendTest:
    def test_not_configured(self, svc, monkeypatch):
        set_cfg(monkeypatch, EMAIL_TO="")
        ok, msg = svc.send_test()
        assert ok is False
        assert "not configured" in msg.lower()

    def test_success(self, svc, monkeypatch):
        set_cfg(monkeypatch, EMAIL_TO="to@example.com")
        set_cfg(monkeypatch, SMTP_HOST="smtp.example.com")
        server = MagicMock()
        server.__enter__.return_value = server
        monkeypatch.setattr(svc, "_open_smtp", lambda: server)
        ok, msg = svc.send_test()
        assert ok is True
        assert "to@example.com" in msg
        server.sendmail.assert_called_once()

    def test_auth_error_is_friendly(self, svc, monkeypatch):
        set_cfg(monkeypatch, EMAIL_TO="to@example.com")
        set_cfg(monkeypatch, SMTP_HOST="smtp.example.com")
        def boom():
            raise smtplib.SMTPAuthenticationError(535, b"bad creds")
        monkeypatch.setattr(svc, "_open_smtp", boom)
        ok, msg = svc.send_test()
        assert ok is False
        assert "authentication failed" in msg.lower()
