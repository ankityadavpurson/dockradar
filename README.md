# DockRadar

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

Docker image monitoring and update dashboard.

DockRadar is a FastAPI + React application that scans Docker containers, compares current image tags/digests with upstream registries, and supports update workflows from the UI.

## Features

- Container discovery (running and stopped)
- Tag + digest-based update detection
- Single, selected, or bulk updates
- Optional docker-compose based update flow
- Background scan scheduler
- Optional email notifications

## Project Layout

```text
dockradar/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes.py
│   │   ├── core/{config.py,logging.py}
│   │   └── services/{docker.py,registry.py,update.py,compose.py,scheduler.py,email.py}
│   └── requirements.txt
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

- API: `http://localhost:8080`
- Docs: `http://localhost:8080/docs`
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
- `REGISTRY_CACHE_TTL`

## Security Notice

DockRadar currently has no built-in authentication/authorization for API endpoints. Do not expose the API directly to the public internet.

For internet-facing deployments, put it behind a reverse proxy with authentication and TLS.

Additional guidance is in `SECURITY.md`.

## Development Notes

- Frontend uses relative `/api` requests and Vite proxy in development.
- Backend serves `frontend/dist` when a production build exists.
- Uploaded compose/runtime data is stored in `backend/compose_files/` and should not be committed.

## Documentation

- Security policy: `SECURITY.md`
- Contributing guide: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`
- Support: `SUPPORT.md`
