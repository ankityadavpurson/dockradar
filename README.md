# 🐳 DockRadar v2

[![CI](https://github.com/YOUR_USERNAME/dockradar/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/dockradar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

**Docker image monitoring and update dashboard.**

A production-quality full-stack application with a **FastAPI** backend and a **React + Vite + Tailwind CSS** frontend. Monitors your Docker containers for outdated images and lets you update them from a clean browser UI.

---

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Python · FastAPI · Uvicorn        |
| Frontend | React 18 · Vite · Tailwind CSS 3  |
| Docker   | Docker SDK for Python + Paramiko  |
| Scheduler| APScheduler                       |
| Email    | Python smtplib                    |

---

## Project Structure

```
dockradar/
│
├── server.py               ← FastAPI entry point
├── api.py                  ← All REST endpoints
├── config.py               ← Environment config
├── docker_service.py       ← Docker SDK wrapper + digest capture
├── registry_service.py     ← Docker Hub API, tag + digest comparison, cache
├── update_service.py       ← Container update lifecycle
├── email_service.py        ← SMTP notifications
├── scheduler_service.py    ← APScheduler background scans
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── api/
│   │   │   └── client.js         ← API fetch functions
│   │   ├── hooks/
│   │   │   └── useContainers.js  ← Data + state hook
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── Toolbar.jsx
│   │       ├── ContainerTable.jsx
│   │       ├── ProgressLog.jsx
│   │       ├── InfoBar.jsx
│   │       ├── ConfirmDialog.jsx
│   │       └── Toast.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env as needed

# Start the API server
python server.py
# API available at http://localhost:8080
# Docs at        http://localhost:8080/docs
```

### 2. Frontend (development)

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:5173
```

Vite proxies all `/api` requests to `http://localhost:8080` automatically.

### 3. Frontend (production build)

```bash
cd frontend
npm run build
# Built files go to frontend/dist/
# FastAPI will serve them at http://localhost:8080
```

---

## Update Detection

DockRadar uses a **two-step check** on every scan to accurately detect updates, including silent image rebuilds where the tag name never changes.

### Step 1 — Tag comparison

DockRadar fetches the tag list from Docker Hub and compares it to the tag your container is running. If a newer tag is found (e.g. `1.25` → `1.26`), it is immediately reported as an update and the digest check is skipped.

### Step 2 — Digest comparison (tags are identical)

If the tags match, DockRadar fetches the remote manifest digest via the Docker Registry v2 API and compares it to the digest of your locally running image. This catches cases where an image is silently rebuilt and re-pushed under the same tag — most common with `latest`.

```
Tag changed?  →  update_available  (done, skip digest)
Tags match?
  ├── digest differs?  →  update_available  (silent rebuild detected)
  ├── digest matches?  →  up_to_date  (fully confirmed)
  └── digest unavailable?  →  up_to_date  (fallback, trust tag match)
```

### What you see in the UI

The **Version Check** column in the dashboard shows two stacked badges indicating exactly which checks were performed and what they found:

| Badges | Meaning |
|--------|---------|
| 🟡 `tag changed` + `→ 1.26.0` | A newer tag was found; digest check skipped |
| ⬜ `tag match` + 🔵 `digest match` | Tags and digest both confirmed identical |
| ⬜ `tag match` + 🟡 `digest changed` | Same tag but image was silently rebuilt |
| ⬜ `tag match` + 🔘 `no digest` | Tags matched; no local digest available to verify |

### Tip — pin to a specific version tag

For maximum reliability, avoid `latest` in your containers and pin to an explicit version:

```yaml
# docker-compose.yml
image: nginx:1.25.4      # instead of nginx:latest
image: postgres:16.2     # instead of postgres:latest
```

DockRadar will then detect tag changes directly without needing a digest check at all.

---

## API Endpoints

| Method   | Endpoint                          | Description                        |
|----------|-----------------------------------|------------------------------------|
| GET      | `/api/health`                     | Health check                       |
| GET      | `/api/containers`                 | List all containers                |
| GET      | `/api/containers/{name}`          | Get single container               |
| POST     | `/api/scan`                       | Trigger background scan            |
| GET      | `/api/scan/status`                | Poll scan/update progress          |
| POST     | `/api/containers/{name}/update`   | Update single container            |
| POST     | `/api/update/selected`            | Update containers by name list     |
| POST     | `/api/update/all`                 | Update all outdated containers     |
| DELETE   | `/api/containers/{name}`          | Stop and remove container          |

Interactive docs: **`http://localhost:8080/docs`**

---

## Environment Variables

| Variable              | Default                  | Description                                      |
|-----------------------|--------------------------|--------------------------------------------------|
| `DOCKER_HOST`         | _(uses Docker socket)_   | Docker daemon address — see Docker Setup below   |
| `SCAN_INTERVAL_HOURS` | `6`                      | Hours between automatic scans                    |
| `SMTP_HOST`           | `smtp.gmail.com`         | SMTP server                                      |
| `SMTP_PORT`           | `587`                    | SMTP port                                        |
| `SMTP_USER`           | —                        | SMTP username                                    |
| `SMTP_PASSWORD`       | —                        | SMTP password                                    |
| `EMAIL_FROM`          | —                        | Sender address                                   |
| `EMAIL_TO`            | —                        | Recipient address                                |
| `HOST`                | `0.0.0.0`                | API bind address                                 |
| `PORT`                | `8080`                   | API port                                         |
| `REGISTRY_CACHE_TTL`  | `300`                    | Registry cache TTL (seconds)                     |

---

## Docker Setup

### Local — Linux / macOS

No extra configuration needed. The Docker SDK connects to `/var/run/docker.sock` automatically. Your `.env` does not need a `DOCKER_HOST` entry.

### Local — Windows (Docker Desktop via TCP)

Docker Desktop on Windows does not expose `/var/run/docker.sock` to Windows processes. Add this to your `.env` to connect over TCP instead:

```env
DOCKER_HOST=tcp://localhost:2375
```

Then enable the TCP socket in Docker Desktop:

1. Open **Docker Desktop** → **Settings** → **General**
2. Check **"Expose daemon on tcp://localhost:2375 without TLS"**
3. Click **Apply & Restart**

> ⚠️ The TCP socket has no authentication. Only use this on a trusted local machine, never in production.

### Local — Windows (Docker via WSL)

If Docker is running inside WSL, run the backend **inside WSL** where `/var/run/docker.sock` is natively available — no `DOCKER_HOST` needed:

```bash
# Inside your WSL terminal — adjust the path to wherever you cloned the repo
cd /mnt/c/path/to/dockradar
source venv/bin/activate
python server.py
```

The React dev server on Windows can still reach `http://localhost:8080` from a browser.

### Remote — Home Server or Any Machine via SSH

DockRadar can monitor Docker on any remote machine over SSH. This is the recommended approach for a home server — no extra server-side config beyond SSH and Docker access.

```env
DOCKER_HOST=ssh://user@192.168.1.100
```

Requirements on the remote machine:

- SSH server running and accessible
- Your user is in the `docker` group: `sudo usermod -aG docker $USER`
- The remote host has been added to your local `known_hosts`:

```bash
# Accept the host fingerprint (run once)
ssh user@192.168.1.100

# Or add it non-interactively
ssh-keyscan -H 192.168.1.100 >> ~/.ssh/known_hosts
```

> `paramiko` is required for SSH connections and is included in `requirements.txt`.

### Remote — Any Machine via TCP

For any remote Docker daemon exposed over TCP (unencrypted):

```env
DOCKER_HOST=tcp://192.168.1.100:2375
```

For TLS-secured TCP (recommended for untrusted networks):

```env
DOCKER_HOST=tcp://192.168.1.100:2376
DOCKER_TLS_VERIFY=1
DOCKER_CERT_PATH=/path/to/certs
```
