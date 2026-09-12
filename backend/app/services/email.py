"""
DockRadar - Email Service
Sends HTML email notifications via SMTP when image updates are detected.
"""

import html
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import config

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending update notification emails."""

    def _open_smtp(self) -> smtplib.SMTP:
        """
        Open an SMTP connection according to config:
        - port 465 (or SMTP_USE_SSL): implicit TLS via SMTP_SSL
        - otherwise: plain SMTP, upgraded with STARTTLS when the server
          offers it and SMTP_STARTTLS is enabled
        Authentication is performed only when both user and password are set,
        so unauthenticated relays work too. Caller is responsible for closing.
        """
        if config.SMTP_USE_SSL:
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                config.SMTP_HOST, config.SMTP_PORT, timeout=30,
                context=ssl.create_default_context(),
            )
            server.ehlo()
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30)
            server.ehlo()
            if config.SMTP_STARTTLS and server.has_extn("starttls"):
                server.starttls(context=ssl.create_default_context())
                server.ehlo()

        if config.SMTP_USER and config.SMTP_PASSWORD:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        return server

    @staticmethod
    def _friendly_error(exc: Exception) -> str:
        """Turn an SMTP/connection exception into an actionable message."""
        if isinstance(exc, smtplib.SMTPAuthenticationError):
            return ("Authentication failed — check SMTP_USER / SMTP_PASSWORD "
                    "(for Gmail, use an App Password, not your account password).")
        if isinstance(exc, smtplib.SMTPConnectError) or isinstance(exc, (OSError, ssl.SSLError)):
            return f"Could not connect to {config.SMTP_HOST}:{config.SMTP_PORT} — {exc}"
        if isinstance(exc, smtplib.SMTPException):
            return f"SMTP error: {exc}"
        return f"Unexpected error: {exc}"

    def send_test(self) -> tuple[bool, str]:
        """
        Send a minimal test email to EMAIL_TO. Returns (success, message)
        where message is safe to show the user (the real SMTP error on failure).
        """
        if not config.email_configured():
            return False, "Email is not configured — set SMTP_HOST and EMAIL_TO."
        try:
            msg = MIMEText(
                "This is a test email from DockRadar.\n\n"
                "If you received this, update notifications are working.",
                "plain",
            )
            msg["Subject"] = "[DockRadar] Test email"
            msg["From"] = config.EMAIL_FROM
            msg["To"] = config.EMAIL_TO
            with self._open_smtp() as server:
                server.sendmail(config.EMAIL_FROM, config.EMAIL_TO, msg.as_string())
            logger.info("Sent test email to %s", config.EMAIL_TO)
            return True, f"Test email sent to {config.EMAIL_TO}."
        except Exception as exc:
            message = self._friendly_error(exc)
            logger.error("Test email failed: %s", message)
            return False, message

    def send_update_notification(self, updates: list[dict]) -> bool:
        """
        Send an email listing all available updates.

        Args:
            updates: List of dicts with keys:
                     container_name, image, tag, digest
        Returns:
            True if email was sent successfully.
        """
        if not config.email_configured():
            logger.warning("Email not configured. Skipping notification.")
            return False

        if not updates:
            logger.info("No updates to notify about.")
            return False

        title = f"{len(updates)} image update{'s' if len(updates) != 1 else ''} available"

        try:
            subject = f"[DockRadar] {title}"
            html_body = self._build_html(updates)
            text_body = self._build_text(updates)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = config.EMAIL_FROM
            msg["To"] = config.EMAIL_TO

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with self._open_smtp() as server:
                server.sendmail(config.EMAIL_FROM, config.EMAIL_TO, msg.as_string())

            logger.info("Sent update notification email to %s (%d updates)", config.EMAIL_TO, len(updates))
            return True

        except Exception as exc:
            logger.error("Failed to send notification email: %s", self._friendly_error(exc))
            return False

    def _build_html(self, updates: list[dict]) -> str:
        cell = "padding:9px 10px;border-bottom:1px solid #f0f0f0;font-family:'Courier New',monospace;"
        rows = ""
        for u in updates:
            esc = {k: html.escape(str(v)) for k, v in u.items()}
            rows += f"""
            <tr>
                <td style="{cell}">{esc['container_name']}</td>
                <td style="{cell}color:#374151;">{esc['image']}</td>
                <td style="{cell}">{esc['tag']}</td>
                <td style="{cell}color:#6b7280;">{esc['digest']}</td>
            </tr>"""

        title = f"{len(updates)} image update{'s' if len(updates) != 1 else ''} available"

        button = ""
        if config.APP_URL:
            url = html.escape(config.APP_URL)
            button = f"""
    <div style="margin:22px 0 4px">
      <a href="{url}" style="display:inline-block;padding:9px 18px;border:1px solid #d1d5db;border-radius:6px;color:#1a1a1a;text-decoration:none;font-size:14px;font-weight:600">Open DockRadar</a>
    </div>"""

        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5">
  <div style="max-width:680px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;padding:28px">
      <h1 style="margin:0 0 2px;font-size:20px;font-weight:700;color:#1a1a1a">DockRadar</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280">Docker image monitoring and update dashboard</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 20px">
      <h2 style="margin:0 0 6px;font-size:16px;font-weight:600;color:#1a1a1a">{title}</h2>
      <p style="margin:0 0 18px;font-size:14px;color:#374151">The following container images have newer versions available:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr>
            <th style="text-align:left;padding:9px 10px;border-bottom:2px solid #e5e5e5;color:#374151;font-weight:600">Container</th>
            <th style="text-align:left;padding:9px 10px;border-bottom:2px solid #e5e5e5;color:#374151;font-weight:600">Image</th>
            <th style="text-align:left;padding:9px 10px;border-bottom:2px solid #e5e5e5;color:#374151;font-weight:600">Tag</th>
            <th style="text-align:left;padding:9px 10px;border-bottom:2px solid #e5e5e5;color:#374151;font-weight:600">Digest</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>{button}
      <p style="margin:22px 0 0;font-size:12px;color:#9ca3af">Sent by DockRadar</p>
    </div>
  </div>
</body>
</html>"""

    def _build_text(self, updates: list[dict]) -> str:
        lines = ["DockRadar — Update Notification", "=" * 40, ""]
        lines.append(f"{len(updates)} image update(s) available:\n")
        for u in updates:
            lines.append(f"  Container : {u['container_name']}")
            lines.append(f"  Image     : {u['image']}")
            lines.append(f"  Tag       : {u['tag']}")
            lines.append(f"  Digest    : {u['digest']}")
            lines.append("")
        if config.APP_URL:
            lines.append(f"Open DockRadar: {config.APP_URL}")
            lines.append("")
        return "\n".join(lines)
