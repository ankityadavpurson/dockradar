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
                     container_name, image_name, current_tag, latest_tag
        Returns:
            True if email was sent successfully.
        """
        if not config.email_configured():
            logger.warning("Email not configured. Skipping notification.")
            return False

        if not updates:
            logger.info("No updates to notify about.")
            return False

        try:
            subject = f"[DockRadar] {len(updates)} image update(s) available"
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
        rows = ""
        for u in updates:
            esc = {k: html.escape(str(v)) for k, v in u.items()}
            rows += f"""
            <tr>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;font-family:monospace">{esc['container_name']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;font-family:monospace">{esc['image_name']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;color:#ff6b6b;font-family:monospace">{esc['current_tag']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;color:#51cf66;font-family:monospace">{esc['latest_tag']}</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0f0f1a;color:#e0e0ff;font-family:sans-serif;margin:0;padding:20px">
  <div style="max-width:700px;margin:0 auto">
    <h1 style="color:#00d4ff;letter-spacing:2px;margin-bottom:4px">🐳 DockRadar</h1>
    <p style="color:#888;margin-top:0">Docker image monitoring and update dashboard</p>
    <hr style="border-color:#2a2a3e">
    <h2 style="color:#ffd43b">⚠ {len(updates)} Update(s) Available</h2>
    <p>The following container images have newer versions available:</p>
    <table style="width:100%;border-collapse:collapse;background:#1a1a2e;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#252545">
          <th style="padding:12px;text-align:left;color:#00d4ff">Container</th>
          <th style="padding:12px;text-align:left;color:#00d4ff">Image</th>
          <th style="padding:12px;text-align:left;color:#00d4ff">Current</th>
          <th style="padding:12px;text-align:left;color:#00d4ff">Latest</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
    <p style="margin-top:24px;color:#888;font-size:12px">
      Sent by DockRadar &mdash; Your Docker monitoring companion.
    </p>
  </div>
</body>
</html>"""

    def _build_text(self, updates: list[dict]) -> str:
        lines = ["DockRadar — Update Notification", "=" * 40, ""]
        lines.append(f"{len(updates)} image update(s) available:\n")
        for u in updates:
            lines.append(f"  Container : {u['container_name']}")
            lines.append(f"  Image     : {u['image_name']}")
            lines.append(f"  Current   : {u['current_tag']}")
            lines.append(f"  Latest    : {u['latest_tag']}")
            lines.append("")
        return "\n".join(lines)
