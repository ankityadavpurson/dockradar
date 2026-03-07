"""
DockRadar - Email Service
Sends HTML email notifications via SMTP when image updates are detected.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending update notification emails."""

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

            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
                server.sendmail(config.EMAIL_FROM, config.EMAIL_TO, msg.as_string())

            logger.info("Sent update notification email to %s (%d updates)", config.EMAIL_TO, len(updates))
            return True

        except smtplib.SMTPException as exc:
            logger.error("SMTP error sending notification: %s", exc)
            return False
        except Exception as exc:
            logger.error("Unexpected error sending email: %s", exc)
            return False

    def _build_html(self, updates: list[dict]) -> str:
        rows = ""
        for u in updates:
            rows += f"""
            <tr>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;font-family:monospace">{u['container_name']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;font-family:monospace">{u['image_name']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;color:#ff6b6b;font-family:monospace">{u['current_tag']}</td>
                <td style="padding:10px;border-bottom:1px solid #2a2a3e;color:#51cf66;font-family:monospace">{u['latest_tag']}</td>
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
