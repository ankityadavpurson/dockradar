# Testing the Native Linux Install on WSL

Use this guide to test the native (systemd) install, upgrade, and uninstall of
DockRadar on WSL2 Ubuntu **before a release exists on GitHub**. Instead of
downloading a release, you build the tarball locally and point the installer at
it with `--tarball`.

Run every command in the **Ubuntu (WSL) terminal** unless a step says
PowerShell.

---

## 0. Prerequisites

Check that systemd is running (should print `systemd`):

```bash
ps -p 1 -o comm=
```

> If it prints `init`, enable systemd: add `[boot]` / `systemd=true` to
> `/etc/wsl.conf`, then run `wsl --shutdown` in PowerShell and reopen Ubuntu.

Check Python venv support (should print `venv ok`):

```bash
python3 -c "import venv, ensurepip" && echo "venv ok"
```

> If it fails: `sudo apt install -y python3-venv`

Check Docker and the compose plugin:

```bash
docker compose version
```

Port 8086 must be free. If the Docker version of DockRadar is running, stop it
(**PowerShell**, in `C:\Dev\dockradar-v2`):

```powershell
docker compose down
```

If the frontend changed since the last build, rebuild it (**PowerShell**, in
`C:\Dev\dockradar-v2\frontend`):

```powershell
yarn build
```

---

## 1. Build the release tarball

These commands mirror the "Build native Linux tarball" step in
`.github/workflows/release.yml`.

Create the staging folders:

```bash
cd /mnt/c/Dev/dockradar-v2 && rm -rf ~/dr-build && mkdir -p ~/dr-build/dockradar-2.0.0/backend ~/dr-build/dockradar-2.0.0/frontend
```

Copy the backend (without tests, compose files, caches, logs, `.env`):

```bash
tar -C backend --exclude=tests --exclude=compose_files --exclude=__pycache__ --exclude=.pytest_cache --exclude='*.log' --exclude=.env -cf - . | tar -C ~/dr-build/dockradar-2.0.0/backend -xf -
```

Copy the built frontend, packaging, and installer:

```bash
cp -r frontend/dist ~/dr-build/dockradar-2.0.0/frontend/ && cp -r packaging .env.example LICENSE README.md scripts/install.sh ~/dr-build/dockradar-2.0.0/ && echo 2.0.0 > ~/dr-build/dockradar-2.0.0/VERSION
```

Strip Windows line endings (in case the checkout has CRLF):

```bash
sed -i 's/\r$//' ~/dr-build/dockradar-2.0.0/install.sh ~/dr-build/dockradar-2.0.0/packaging/dockradar.service ~/dr-build/dockradar-2.0.0/.env.example
```

Create the tarball and its checksum:

```bash
cd ~/dr-build && tar -czf dockradar-2.0.0-linux.tar.gz dockradar-2.0.0 && sha256sum dockradar-2.0.0-linux.tar.gz > dockradar-2.0.0-linux.tar.gz.sha256
```

> Replace `2.0.0` everywhere if `__version__` in `backend/app/main.py` differs.

---

## 2. Install (piped, like `curl | sudo bash`)

Feeding the script through stdin (`bash -s -- … < install.sh`) behaves the same
as `curl … | sudo bash`, so this also tests the interactive email prompts in
that mode.

```bash
sudo bash -s -- --tarball ~/dr-build/dockradar-2.0.0-linux.tar.gz < ~/dr-build/dockradar-2.0.0/install.sh
```

When prompted:

| Prompt | What to enter |
| --- | --- |
| Configure email notifications now? | `y` |
| SMTP host / port | `smtp.gmail.com` / `587` (press Enter for defaults) |
| SMTP username | your Gmail address |
| SMTP password | a Gmail [App Password](https://myaccount.google.com/apppasswords) (input is hidden) |
| From address / Send notifications to | your addresses |
| DockRadar URL for email links | `http://localhost:8086` |

**Expected:** ends with `DockRadar v2.0.0 is running.`

---

## 3. Verify the install

Service status (should be `active (running)`):

```bash
systemctl status dockradar --no-pager
```

Health endpoint (should return JSON with `"email_configured":true`):

```bash
curl -s http://localhost:8086/api/health
```

Your email answers were saved:

```bash
sudo grep -E '^(SMTP_|EMAIL_|APP_URL)' /etc/dockradar/dockradar.env
```

Config file permissions (should be `root:dockradar 640`):

```bash
sudo stat -c '%U:%G %a' /etc/dockradar/dockradar.env
```

Live logs (Ctrl+C to stop):

```bash
journalctl -u dockradar -f
```

In the **Windows browser**:

1. Open <http://localhost:8086> — your containers should be listed.
2. Click the ⓘ next to **Email** → **Send test email** — the email should arrive.
3. Upload a compose file.

The compose file should be stored under `/var/lib`, not `/opt`:

```bash
sudo ls /var/lib/dockradar/compose_files
```

---

## 4. Change email settings later

Edit the config (e.g. change `EMAIL_TO`):

```bash
sudo nano /etc/dockradar/dockradar.env
```

Apply the change:

```bash
sudo systemctl restart dockradar
```

Then click **Send test email** in the UI again.

---

## 5. Upgrade (re-run the installer)

```bash
sudo bash -s -- --tarball ~/dr-build/dockradar-2.0.0-linux.tar.gz < ~/dr-build/dockradar-2.0.0/install.sh
```

**Expected:**

- No email prompts (the config already exists).
- The output says `Restarting dockradar...`.
- Your settings in `/etc/dockradar/dockradar.env` are unchanged.
- The uploaded compose file is still in `/var/lib/dockradar/compose_files`.

---

## 6. Uninstall (keeps config, data, logs)

```bash
sudo bash -s -- --uninstall < ~/dr-build/dockradar-2.0.0/install.sh
```

The service and application are gone (both should report "not found" /
"No such file or directory"):

```bash
systemctl status dockradar --no-pager; ls /opt/dockradar
```

The config and data are kept:

```bash
sudo ls /etc/dockradar /var/lib/dockradar
```

> **Optional — offline uninstall:** reinstall with step 2, then run
> `sudo bash /opt/dockradar/current/install.sh --uninstall`.

---

## 7. Purge (full cleanup)

```bash
sudo bash -s -- --uninstall --purge < ~/dr-build/dockradar-2.0.0/install.sh
```

Nothing should be left (all three paths missing, and `no such user`):

```bash
ls /etc/dockradar /var/lib/dockradar /var/log/dockradar; id dockradar
```

Remove the build folder:

```bash
rm -rf ~/dr-build
```

---

## Optional: unattended install

Tests the non-interactive path with email settings from environment variables
(values go after `sudo`, which strips your environment):

```bash
sudo SMTP_HOST=smtp.gmail.com SMTP_USER=you@gmail.com SMTP_PASSWORD='your app password' EMAIL_TO=you@example.com bash -s -- --tarball ~/dr-build/dockradar-2.0.0-linux.tar.gz --non-interactive < ~/dr-build/dockradar-2.0.0/install.sh
```

Clean up afterwards with step 7.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `systemd is required but does not appear to be running` | Enable systemd in `/etc/wsl.conf` (see step 0). |
| `Python venv support is missing` | `sudo apt install -y python3-venv` |
| `DockRadar did not answer on port 8086 yet` | `journalctl -u dockradar -n 50` — often port 8086 is already in use. |
| Containers list is empty / Docker errors | `id -nG dockradar` should include `docker`; `ls -l /var/run/docker.sock`. |
| Test email fails | Gmail needs an App Password and 2-Step Verification; re-check `SMTP_*` values. |
| `$'\r': command not found` | Re-run the `sed -i 's/\r$//'` command from step 1. |

---

## Once a real release exists

Replace the local commands with the GitHub ones:

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash
```

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash -s -- --uninstall
```
