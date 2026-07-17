# DockRadar

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

Docker image monitoring and update dashboard.

DockRadar is a FastAPI + React application that scans Docker containers, compares current image tags/digests with upstream registries, and supports update workflows from the UI.

## Features

- Container discovery (running and stopped)
- Tag + digest-based update detection (parallel registry checks)
- Single, selected, or bulk updates
- Optional docker-compose based update flow
- Background scan scheduler
- Optional email notifications (sent when a scan finds new updates; deduplicated so the same update is only announced once)
- Optional API-key protection (`API_KEY`)
- Hide containers from the dashboard (`HIDDEN_REPOSITORY`)

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
git clone https://github.com/YOUR_USERNAME/dockradar-v2.git
cd dockradar-v2
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

## Docker Run (Single Container)

Build and run:

```bash
docker build -t dockradar:latest .
docker run --rm -p 8086:8086 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/backend/compose_files:/app/backend/compose_files \
  --env-file .env \
  dockradar:latest
```

The provided root `docker-compose.yml` also runs the app on port `8086`.

## API Endpoints

Core:

- `GET /api/health`
- `GET /api/containers`
- `GET /api/containers/{name}`
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

See `.env.example` for the full list.

Most important values:

- `DOCKER_HOST`
- `SCAN_INTERVAL_HOURS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `EMAIL_FROM`, `EMAIL_TO`
- `HOST`, `PORT`
- `API_KEY` — optional; when set, every `/api` route except `/api/health` requires the `X-Api-Key` header. Give the key to the UI once via the browser console: `localStorage.setItem('dockradar_api_key', '<key>')`
- `HIDDEN_REPOSITORY` — comma-separated container or repository names (case-insensitive, exact match) to hide from DockRadar entirely: not listed, not scanned, not auto-updated
- `REGISTRY_CACHE_TTL`

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
- Uploaded compose/runtime data is stored in `backend/compose_files/` and should not be committed.

## Documentation

- Security policy: `SECURITY.md`
- Contributing guide: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`
- Support: `SUPPORT.md`
