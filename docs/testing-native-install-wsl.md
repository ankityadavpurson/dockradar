# Testing the Native Linux Install on WSL

Use this guide to test the native (systemd) install, upgrade, and uninstall of
DockRadar on WSL2 Ubuntu **before a release exists on GitHub**. Instead of
downloading a release, you build the tarball from your clone and point the
installer at it with `--tarball`.

Run every command in the **Ubuntu (WSL) terminal**, in the **same terminal
session** — step 1 sets shell variables that later steps use.

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

Check Node.js 18+ and Yarn 1.x (needed once, to build the frontend):

```bash
node --version && yarn --version
```

> If Yarn is missing: `npm install -g yarn`

Port 8086 must be free. If the Docker version of DockRadar is running, stop it
from its project folder:

```bash
docker compose down
```

---

## 1. Get the code and build the release tarball

Clone the repository (skip if you already have a clone — just `cd` into it):

```bash
git clone https://github.com/ankityadavpurson/dockradar.git && cd dockradar
```

> Any existing clone works, including one on the Windows drive
> (e.g. `cd /mnt/c/path/to/dockradar`). Check out the branch you want to test.

From the **repository root**, set the variables used by every later step
(version is read from `backend/app/main.py`):

```bash
export VERSION="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' backend/app/main.py | tr -d '\r')" BUILD=~/dr-build && export STAGE="$BUILD/dockradar-$VERSION" TARBALL="$BUILD/dockradar-$VERSION-linux.tar.gz" && echo "Building DockRadar $VERSION → $TARBALL"
```

What each variable holds:

| Variable | What it is | Example value |
| --- | --- | --- |
| `$VERSION` | The app version, read from `__version__` in `backend/app/main.py`. Used in the folder and tarball names, and shown by the installer (`DockRadar v<version> is running`). | `2.0.0` |
| `$BUILD` | Scratch folder in your WSL home where the package is assembled. Safe to delete after testing (step 7). | `/home/you/dr-build` |
| `$STAGE` | The unpacked package folder inside `$BUILD` — the same layout as the release tarball (`backend/`, `frontend/dist/`, `packaging/`, `install.sh`, `VERSION`). Steps 2–7 run the installer from here: `$STAGE/install.sh`. | `/home/you/dr-build/dockradar-2.0.0` |
| `$TARBALL` | The packaged release file built from `$STAGE` — the same file CI attaches to a GitHub Release. Passed to the installer with `--tarball`; a matching `$TARBALL.sha256` checksum sits next to it and is verified during install. | `/home/you/dr-build/dockradar-2.0.0-linux.tar.gz` |

Check them at any time:

```bash
echo "VERSION=$VERSION  BUILD=$BUILD  STAGE=$STAGE  TARBALL=$TARBALL"
```

> These are ordinary shell variables, so they exist only in the current
> terminal session. Opened a new terminal later? `cd` back to the repository
> root and re-run the command above before continuing. If the `echo` shows
> empty values, that is the reason.

Build the frontend:

```bash
(cd frontend && yarn install --frozen-lockfile && yarn build)
```

Create the staging folders:

```bash
rm -rf "$BUILD" && mkdir -p "$STAGE/backend" "$STAGE/frontend"
```

Copy the backend (without tests, compose files, caches, logs, `.env`):

```bash
tar -C backend --exclude=tests --exclude=compose_files --exclude=__pycache__ --exclude=.pytest_cache --exclude='*.log' --exclude=.env -cf - . | tar -C "$STAGE/backend" -xf -
```

Copy the built frontend, packaging, and installer:

```bash
cp -r frontend/dist "$STAGE/frontend/" && cp -r packaging .env.example LICENSE README.md scripts/install.sh "$STAGE/" && echo "$VERSION" > "$STAGE/VERSION"
```

Strip Windows line endings (only matters for clones made on Windows):

```bash
sed -i 's/\r$//' "$STAGE/install.sh" "$STAGE/packaging/dockradar.service" "$STAGE/.env.example"
```

Create the tarball and its checksum:

```bash
tar -C "$BUILD" -czf "$TARBALL" "dockradar-$VERSION" && (cd "$BUILD" && sha256sum "$(basename "$TARBALL")" > "$(basename "$TARBALL").sha256") && ls -lh "$BUILD"
```

These commands mirror the "Build native Linux tarball" step in
`.github/workflows/release.yml`.

---

## 2. Install (piped, like `curl | sudo bash`)

Feeding the script through stdin (`bash -s -- … < install.sh`) behaves the same
as `curl … | sudo bash`, so this also tests the interactive email prompts in
that mode.

```bash
sudo bash -s -- --tarball "$TARBALL" < "$STAGE/install.sh"
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

**Expected:** ends with `DockRadar v<version> is running.`

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
sudo bash -s -- --tarball "$TARBALL" < "$STAGE/install.sh"
```

**Expected:**

- No email prompts (the config already exists).
- The output says `Restarting dockradar...`.
- Your settings in `/etc/dockradar/dockradar.env` are unchanged.
- The uploaded compose file is still in `/var/lib/dockradar/compose_files`.

---

## 6. Uninstall (keeps config, data, logs)

```bash
sudo bash -s -- --uninstall < "$STAGE/install.sh"
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
sudo bash -s -- --uninstall --purge < "$STAGE/install.sh"
```

Nothing should be left (all three paths missing, and `no such user`):

```bash
ls /etc/dockradar /var/lib/dockradar /var/log/dockradar; id dockradar
```

Remove the build folder:

```bash
rm -rf "$BUILD"
```

---

## Optional: unattended install

Tests the non-interactive path with email settings from environment variables
(values go after `sudo`, which strips your environment):

```bash
sudo SMTP_HOST=smtp.gmail.com SMTP_USER=you@gmail.com SMTP_PASSWORD='your app password' EMAIL_TO=you@example.com bash -s -- --tarball "$TARBALL" --non-interactive < "$STAGE/install.sh"
```

Clean up afterwards with step 7.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `No such file or directory` for `$STAGE` / `$TARBALL` | New terminal session — `cd` to the repo root and re-run the variables command in step 1. |
| `systemd is required but does not appear to be running` | Enable systemd in `/etc/wsl.conf` (see step 0). |
| `Python venv support is missing` | `sudo apt install -y python3-venv` |
| `DockRadar did not answer on port 8086 yet` | `journalctl -u dockradar -n 50` — often port 8086 is already in use. |
| Containers list is empty / Docker errors | `id -nG dockradar` should include `docker`; `ls -l /var/run/docker.sock`. |
| Test email fails | Gmail needs an App Password and 2-Step Verification; re-check `SMTP_*` values. |
| `$'\r': command not found` | Re-run the `sed -i 's/\r$//'` command from step 1. |

---

## Once a real release exists

No clone or build is needed — use the GitHub commands:

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash
```

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash -s -- --uninstall
```
