# DockRadar

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

Know when your containers are out of date — and update them in one click.

DockRadar is a self-hosted dashboard that keeps an eye on the Docker images running on your host. It periodically checks each container's image against its upstream registry, tells you which ones have a newer tag or digest available, and lets you apply updates — one container, a selected few, or all at once — without dropping to the command line. For containers managed by Compose, it edits and re-runs the compose file for you; for the rest, it recreates the container from its captured configuration. Optional email alerts mean you don't even have to open the dashboard to find out something needs attention.

Built with a FastAPI backend and a React frontend, it runs as a single container next to your Docker socket.

## Features

- Container discovery (running and stopped)
- Tag + digest-based update detection (parallel registry checks)
- Single, selected, or bulk updates
- Optional docker-compose based update flow
- Per-container detail view (ports, mounts, env keys, networks, labels, update coverage)
- Background scan scheduler
- Optional email notifications (sent when a scan finds new updates; deduplicated so the same update is only announced once)
- Optional API-key protection (`API_KEY`)
- Hide containers from the dashboard (`HIDDEN_REPOSITORY`)
- Dark / light / system theme toggle

## Project Layout

```text
dockradar/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes.py
│   │   ├── core/{config.py,logging.py}
│   │   └── services/{docker.py,registry.py,update.py,compose.py,scheduler.py,email.py}
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── scripts/{start.sh,start.ps1,start.bat}
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Requirements

- Python 3.11+
- Node.js 18+
- Yarn 1.x (the start scripts use Yarn)
- Docker daemon access (local socket, SSH, or TCP)

## Quick Start

1. Clone:

```bash
git clone https://github.com/{YOUR_USERNAME}/dockradar.git
cd dockradar
```

2. Run one of the platform start scripts:

- Linux/macOS/WSL:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

- Windows PowerShell:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\start.ps1
```

- Windows CMD:

```cmd
scripts\start.bat
```

Notes:

- On first run, the script creates `.env` from `.env.example` and exits.
- Review `.env`, then re-run the script.
- Scripts start backend and frontend dev servers.

Default development URLs:

- API: `http://localhost:8086`
- Docs: `http://localhost:8086/docs`
- Frontend: `http://localhost:5173`

## Manual Setup

Backend:

```bash
python -m venv venv
# Linux/macOS/WSL
source venv/bin/activate
# Windows PowerShell
# venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
cp .env.example .env
cd backend
python -m app.main
```

Frontend:

```bash
cd frontend
yarn install
yarn dev
```

## Install on Linux (native, without Docker)

Run DockRadar directly on a Linux host as a systemd service. One `install.sh`
serves Linux and macOS — it detects the OS (see the macOS section below). Nothing is
built on the host — the installer downloads a release tarball with the
frontend prebuilt.

Requirements: systemd, Python 3.10+ with `venv` (Debian/Ubuntu:
`sudo apt install python3-venv`), and Docker Engine with the compose plugin.

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash
```

On first install the script offers to set up email notifications (SMTP host,
port, user, app password, recipient) and then starts the service on port
`8086`. Running natively also enables compose-based updates, since the host's
`docker compose` is available.

| What | Where |
| --- | --- |
| Configuration (SMTP, `API_KEY`, `PORT`, …) | `/etc/dockradar/dockradar.env` |
| Compose files (data) | `/var/lib/dockradar/compose_files` |
| Logs | `journalctl -u dockradar -f` or `/var/log/dockradar/` |
| Application | `/opt/dockradar/current` |

- **Change settings** (e.g. email): edit `/etc/dockradar/dockradar.env`, run
  `sudo systemctl restart dockradar`, then use **Send test email** in the UI.
- **Upgrade**: re-run the install command (config and data are kept). Pin a
  version with `… | sudo bash -s -- --version 2.1.0`.
- **Unattended install** (values after `sudo`, which strips your environment):

  ```bash
  curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo SMTP_HOST=smtp.gmail.com EMAIL_TO=you@example.com bash -s -- --non-interactive
  ```

- **Uninstall** (keeps config, data and logs):

  ```bash
  curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash -s -- --uninstall
  ```

  Use `--uninstall --purge` to also delete `/etc/dockradar`, `/var/lib/dockradar`,
  `/var/log/dockradar` and the `dockradar` user. Offline, the installer is also on
  disk: `sudo bash /opt/dockradar/current/install.sh --uninstall`.

> The `dockradar` service user is added to the `docker` group, which is
> root-equivalent on the host. Set `API_KEY` if port 8086 is reachable from
> other machines.

## Install on macOS (native, without Docker)

Run DockRadar as a per-user LaunchAgent that starts at login. It is the same
`install.sh` and release tarball as Linux — the installer detects macOS, and
nothing is built on your Mac.

Requirements: Python 3.10+ (`brew install python@3.12`) and Docker Desktop,
OrbStack or Colima. Run the installer as **your normal user — not with sudo**
(Docker Desktop's socket belongs to your user).

```bash
curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | bash
```

As on Linux, the first install offers to set up email notifications. By default
DockRadar listens on `127.0.0.1:8086` (this Mac only) — set `HOST=0.0.0.0` and
`API_KEY` in the config to reach it from other devices.

| What | Where |
| --- | --- |
| Configuration (SMTP, `API_KEY`, `HOST`, …) | `~/Library/Application Support/DockRadar/dockradar.env` |
| Compose files (data) | `~/Library/Application Support/DockRadar/compose_files` |
| Logs | `~/Library/Logs/DockRadar/` |
| LaunchAgent | `~/Library/LaunchAgents/com.dockradar.plist` |

- **Change settings**: edit the config file, run
  `launchctl kickstart -k gui/$(id -u)/com.dockradar`, then use **Send test email** in the UI.
- **Upgrade**: re-run the install command (config and data are kept).
- **Uninstall**:

  ```bash
  curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | bash -s -- --uninstall
  ```

  Add `--purge` to also delete the config, compose files and logs.

## Docker

### Docker Compose (recommended)

```bash
cp .env.example .env    # then edit .env (SMTP/email, API_KEY, …)
docker compose up -d --build
```

`docker-compose.yml` reads your `.env` automatically (via `env_file`), so every
setting — including SMTP/email and `API_KEY` — applies inside the container.
`.env` is optional; without it the app starts on sensible defaults. Regardless
of what `.env` contains, the container always listens on port `8086` and reaches
Docker through the mounted socket (`HOST`, `PORT`, and `DOCKER_HOST` are pinned
in the compose file). Requires Docker Compose v2.24+.

### Prebuilt image

Published images are available on Docker Hub and GHCR:

```bash
docker pull ankityadavpurson/dockradar:latest
# or
docker pull ghcr.io/ankityadavpurson/dockradar:latest
```

Use either name in place of `dockradar:latest` below to skip the local build.

### Docker Run (single container)

```bash
docker build -t dockradar:latest .
docker run --rm -p 8086:8086 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/backend/compose_files:/app/backend/compose_files \
  --env-file .env \
  dockradar:latest
```

## API Endpoints

Core:

- `GET /api/health`
- `POST /api/email/test`
- `GET /api/containers`
- `GET /api/containers/{name}`
- `GET /api/containers/{name}/details`
- `POST /api/scan`
- `GET /api/scan/status`
- `POST /api/containers/{name}/update`
- `POST /api/update/selected`
- `POST /api/update/all`
- `DELETE /api/containers/{name}`

Compose management:

- `POST /api/compose`
- `GET /api/compose`
- `DELETE /api/compose/{file_id}`
- `GET /api/compose/{file_id}/content`
- `PUT /api/compose/{file_id}`
- `GET /api/compose/{file_id}/download`
- `GET /api/compose/associations`
- `POST /api/compose/associate`
- `DELETE /api/compose/associate/{name}`
- `GET /api/containers/{name}/compose-diff`
- `POST /api/containers/{name}/compose-update`

## Environment Variables

See `.env.example` for the full list. Configuration is delivered via
environment variables, loaded automatically depending on how you run DockRadar:

- **Docker Compose** — reads `.env` in the project root (`env_file: .env`).
- **`docker run`** — pass `--env-file .env`.
- **Start scripts / manual run** — `.env` is loaded from the project root.

Most important values:

- `DOCKER_HOST`
- `SCAN_INTERVAL_HOURS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `EMAIL_FROM`, `EMAIL_TO`
- `APP_URL` — public URL of the UI; adds an "Open DockRadar" link to notification emails
- `HOST`, `PORT`
- `API_KEY` — optional; when set, every `/api` route except `/api/health` requires the `X-Api-Key` header. Give the key to the UI once via the browser console: `localStorage.setItem('dockradar_api_key', '<key>')`
- `HIDDEN_REPOSITORY` — comma-separated container or repository names (case-insensitive, exact match) to hide from DockRadar entirely: not listed, not scanned, not auto-updated
- `REGISTRY_CACHE_TTL`
- `COMPOSE_TIMEOUT` — max seconds a single `docker compose` pull/up may run (default 300)

### Email notifications (Gmail)

Gmail requires an [App Password](https://myaccount.google.com/apppasswords) —
not your account password — and 2-Step Verification must be enabled to create
one. Set:

```bash
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your_16_char_app_password
EMAIL_FROM=you@gmail.com
EMAIL_TO=where-to-notify@example.com
```

`SMTP_HOST`/`SMTP_PORT` default to `smtp.gmail.com:587` (STARTTLS); use port
`465` for implicit SSL. After setting these, restart DockRadar, then click the
ⓘ icon next to **Email** in the UI → **Send test email** to verify. Scans that
find new updates then send a notification (deduplicated so the same update is
announced only once).

## Update Limitations

The direct (non-compose) update flow recreates containers from a captured subset of their configuration. Preserved: ports, bind mounts, environment variables, restart policy, network mode, labels, command/entrypoint, hostname, user, working dir.

**Not preserved:** named volumes attached via the `Mounts` API (`--mount`), membership in multiple networks, network aliases, and advanced options (cap_add, devices, resource limits, healthchecks, …).

For containers that rely on those, associate them with a compose file and use the compose update flow instead — `docker compose` recreates the container from its full definition.

## Security Notice

DockRadar controls Docker on its host — treat it as a privileged service. It has no user accounts or RBAC. Do not expose the API directly to the public internet.

- Set `API_KEY` to require an `X-Api-Key` header on all API routes (except `/api/health`).
- For anything internet-facing, additionally put it behind a reverse proxy with authentication and TLS.
- Anyone who can reach the unauthenticated API (or upload compose files) can effectively control the Docker host.

Additional guidance is in `SECURITY.md`.

## Testing

Backend unit tests (registry/image parsing, compose storage, hidden-container filtering):

```bash
pip install -r backend/requirements-dev.txt
cd backend
pytest
```

## Development Notes

- Frontend uses relative `/api` requests and Vite proxy in development.
- Backend serves `frontend/dist` when a production build exists.
- Uploaded compose/runtime data is stored in `backend/compose_files/` (override with `COMPOSE_DIR`) and should not be committed.

## Documentation

- Testing the native Linux install (including WSL): [`docs/testing-native-install-linux.md`](docs/testing-native-install-linux.md)
- Testing the native macOS install: [`docs/testing-native-install-macos.md`](docs/testing-native-install-macos.md)
- Security policy: `SECURITY.md`
- Contributing guide: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`
- Support: `SUPPORT.md`
