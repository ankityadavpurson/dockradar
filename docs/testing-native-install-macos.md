# Testing the Native macOS Install

Use this guide to test the native (LaunchAgent) install, upgrade, and uninstall
of DockRadar on macOS **before a release exists on GitHub**. Instead of
downloading a release, you build the tarball from your clone and point the
installer at it with `--tarball`.

Run every command in **Terminal** as **your normal user — never with `sudo`**,
in the **same terminal session** (step 1 sets shell variables that later steps
use).

---

## 0. Prerequisites

Check Python 3.10 or newer is installed:

```bash
python3 --version
```

> If it is older than 3.10 (Apple's built-in is 3.9) or missing:
> `brew install python@3.12`. The installer automatically prefers Homebrew's
> `python3.12`/`python3.13` over the system one.

Check Docker is installed **and running** (Docker Desktop, OrbStack or Colima):

```bash
docker info --format '{{.ServerVersion}}' && docker compose version
```

Check Node.js 18+ and Yarn 1.x (needed once, to build the frontend):

```bash
node --version && yarn --version
```

> If missing: `brew install node`, then `npm install -g yarn`.

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

From the **repository root**, set the variables used by every later step:

```bash
export VERSION="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' backend/app/main.py | tr -d '\r')" BUILD=~/dr-build DR_HOME="$HOME/Library/Application Support/DockRadar" && export STAGE="$BUILD/dockradar-$VERSION" TARBALL="$BUILD/dockradar-$VERSION.tar.gz" && echo "Building DockRadar $VERSION → $TARBALL"
```

What each variable holds:

| Variable | What it is | Example value |
| --- | --- | --- |
| `$VERSION` | The app version, read from `__version__` in `backend/app/main.py`. Used in the folder and tarball names, and shown by the installer (`DockRadar v<version> is running`). | `2.0.0` |
| `$BUILD` | Scratch folder in your home where the package is assembled. Safe to delete after testing (step 8). | `/Users/you/dr-build` |
| `$STAGE` | The unpacked package folder inside `$BUILD` — the same layout as the release tarball (`backend/`, `frontend/dist/`, `packaging/`, `install.sh`, `VERSION`). Steps 2–8 run the installer from here: `$STAGE/install.sh`. | `/Users/you/dr-build/dockradar-2.0.0` |
| `$TARBALL` | The packaged release file built from `$STAGE` — the same file CI attaches to a GitHub Release (one file for both Linux and macOS). Passed to the installer with `--tarball`; a matching `$TARBALL.sha256` checksum sits next to it and is verified during install. | `/Users/you/dr-build/dockradar-2.0.0.tar.gz` |
| `$DR_HOME` | Where the installer puts DockRadar for your user: app, venv, config and compose files. Used in the checks below. Quoted everywhere because the path contains a space. | `/Users/you/Library/Application Support/DockRadar` |

Check them at any time:

```bash
echo "VERSION=$VERSION  BUILD=$BUILD  STAGE=$STAGE  TARBALL=$TARBALL  DR_HOME=$DR_HOME"
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

Copy the built frontend, packaging, and installers:

```bash
cp -R frontend/dist "$STAGE/frontend/" && cp -R packaging .env.example LICENSE README.md scripts/install.sh "$STAGE/" && echo "$VERSION" > "$STAGE/VERSION"
```

Strip Windows line endings (only matters for clones made on Windows — note
macOS `sed -i` needs the empty `''`):

```bash
sed -i '' 's/\r$//' "$STAGE/install.sh" "$STAGE/.env.example"
```

Create the tarball and its checksum (macOS uses `shasum -a 256`):

```bash
tar -C "$BUILD" -czf "$TARBALL" "dockradar-$VERSION" && (cd "$BUILD" && shasum -a 256 "$(basename "$TARBALL")" > "$(basename "$TARBALL").sha256") && ls -lh "$BUILD"
```

These commands mirror the "Build native install tarball" step in
`.github/workflows/release.yml`.

---

## 2. Install (piped, like `curl | bash`)

Feeding the script through stdin (`bash -s -- … < install.sh`) behaves
the same as `curl … | bash`, so this also tests the interactive email prompts
in that mode. **No `sudo`.**

```bash
bash -s -- --tarball "$TARBALL" < "$STAGE/install.sh"
```

When prompted:

| Prompt | What to enter |
| --- | --- |
| Configure email notifications now? | `y` |
| SMTP host / port | `smtp.gmail.com` / `587` (press Enter for defaults) |
| SMTP username | your Gmail address |
| SMTP password | a Gmail [App Password](https://myaccount.google.com/apppasswords) (input is hidden) |
| From address / Send notifications to | your addresses |
| DockRadar URL for email links | `http://localhost:8086` (press Enter) |

**Expected:** ends with `DockRadar v<version> is running.` macOS may also show a
**"Background Items Added"** notification — that is the LaunchAgent, and is
expected.

---

## 3. Verify the install

The LaunchAgent is loaded and running (look for `state = running`):

```bash
launchctl print gui/$(id -u)/com.dockradar | grep -E 'state|pid'
```

Health endpoint (should return JSON with `"email_configured":true`):

```bash
curl -s http://localhost:8086/api/health
```

Your email answers were saved:

```bash
grep -E '^(SMTP_|EMAIL_|APP_URL|HOST|COMPOSE_DIR|LOG_FILE|DOCKER_HOST)' "$DR_HOME/dockradar.env"
```

Config file is private to you (should be `-rw-------`):

```bash
stat -f '%Sp' "$DR_HOME/dockradar.env"
```

Only listening on localhost by default (should show `127.0.0.1:8086`):

```bash
lsof -nP -iTCP:8086 -sTCP:LISTEN
```

Live logs (Ctrl+C to stop):

```bash
tail -f ~/Library/Logs/DockRadar/dockradar.log
```

In the **browser**:

1. Open <http://localhost:8086> — your containers should be listed.
2. Click the ⓘ next to **Email** → **Send test email** — the email should arrive.
3. Upload a compose file.

The compose file should be stored in your DockRadar folder, not in the app
folder:

```bash
ls "$DR_HOME/compose_files"
```

---

## 4. Change settings later

Edit the config (e.g. change `EMAIL_TO`):

```bash
open -e "$DR_HOME/dockradar.env"
```

Restart DockRadar to apply the change:

```bash
launchctl kickstart -k gui/$(id -u)/com.dockradar
```

Then click **Send test email** in the UI again.

> **Reach it from other devices:** set `HOST=0.0.0.0` and an `API_KEY`, restart,
> and allow Python through the macOS firewall if asked.

---

## 5. Starts at login (optional)

Log out and back in (or restart the Mac), then check it came back on its own:

```bash
curl -s http://localhost:8086/api/health
```

---

## 6. Upgrade (re-run the installer)

```bash
bash -s -- --tarball "$TARBALL" < "$STAGE/install.sh"
```

**Expected:**

- No email prompts (the config already exists).
- Ends with `DockRadar v<version> is running.`
- Your settings in `$DR_HOME/dockradar.env` are unchanged.
- The uploaded compose file is still in `$DR_HOME/compose_files`.

---

## 7. Uninstall (keeps config, data, logs)

```bash
bash -s -- --uninstall < "$STAGE/install.sh"
```

The LaunchAgent and application are gone (should print
`Could not find service` and `No such file or directory`):

```bash
launchctl print gui/$(id -u)/com.dockradar; ls ~/Library/LaunchAgents/com.dockradar.plist "$DR_HOME/venv"
```

The config and data are kept:

```bash
ls "$DR_HOME"
```

> **Optional — offline uninstall:** reinstall with step 2, then run
> `bash "$DR_HOME/current/install.sh" --uninstall`.

---

## 8. Purge (full cleanup)

```bash
bash -s -- --uninstall --purge < "$STAGE/install.sh"
```

Nothing should be left (both paths missing):

```bash
ls "$DR_HOME" ~/Library/Logs/DockRadar
```

Remove the build folder:

```bash
rm -rf "$BUILD"
```

---

## Optional: unattended install

Tests the non-interactive path with email settings from environment variables:

```bash
SMTP_HOST=smtp.gmail.com SMTP_USER=you@gmail.com SMTP_PASSWORD='your app password' EMAIL_TO=you@example.com bash -s -- --tarball "$TARBALL" --non-interactive < "$STAGE/install.sh"
```

Clean up afterwards with step 8.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `No such file or directory` for `$STAGE` / `$TARBALL` | New terminal session — `cd` to the repo root and re-run the variables command in step 1. |
| `Run as your normal user, without sudo` | Drop `sudo` — the installer is per-user on macOS. |
| `Python 3.10+ not found` | `brew install python@3.12`, then re-run. |
| `Docker is installed but not running` | Start Docker Desktop (or `orbstack` / `colima start`); DockRadar connects once it is up. |
| `DockRadar did not answer on port 8086 yet` | `tail -n 50 ~/Library/Logs/DockRadar/dockradar.err.log` — often port 8086 is already in use (`lsof -nP -iTCP:8086`). |
| Containers list is empty / Docker errors | `grep DOCKER_HOST "$DR_HOME/dockradar.env"` should match `docker context inspect --format '{{.Endpoints.docker.Host}}'`; fix it and restart (step 4). |
| Agent stopped / disabled | System Settings → General → Login Items & Extensions → make sure **python** / DockRadar is allowed in the background, then `launchctl kickstart -k gui/$(id -u)/com.dockradar`. |
| Test email fails | Gmail needs an App Password and 2-Step Verification; re-check `SMTP_*` values. |
| `sed: 1: … invalid command code` | You used Linux `sed -i` syntax — on macOS it is `sed -i ''`. |

---

## Once a real release exists

No clone or build is needed — use the GitHub commands (no `sudo`):

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | bash
```

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | bash -s -- --uninstall
```
