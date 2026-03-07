# 🐳 DockRadar v2

**Docker image monitoring and update dashboard.**

A production-quality full-stack application with a **FastAPI** backend and a **React + Vite + Tailwind CSS** frontend. Monitors your Docker containers for outdated images and lets you update them from a clean browser UI.

---

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Python · FastAPI · Uvicorn        |
| Frontend | React 18 · Vite · Tailwind CSS 3  |
| Docker   | Docker SDK for Python             |
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
├── docker_service.py       ← Docker SDK wrapper
├── registry_service.py     ← Docker Hub API + cache
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

| Variable              | Default           | Description                         |
|-----------------------|-------------------|-------------------------------------|
| `SCAN_INTERVAL_HOURS` | `6`               | Hours between automatic scans       |
| `SMTP_HOST`           | `smtp.gmail.com`  | SMTP server                         |
| `SMTP_PORT`           | `587`             | SMTP port                           |
| `SMTP_USER`           | —                 | SMTP username                       |
| `SMTP_PASSWORD`       | —                 | SMTP password                       |
| `EMAIL_FROM`          | —                 | Sender address                      |
| `EMAIL_TO`            | —                 | Recipient address                   |
| `HOST`                | `0.0.0.0`         | API bind address                    |
| `PORT`                | `8080`            | API port                            |
| `REGISTRY_CACHE_TTL`  | `300`             | Registry cache TTL (seconds)        |

---

## WSL / Docker Desktop

If using WSL, run the backend **inside WSL** where `/var/run/docker.sock` is accessible:

```bash
# Inside WSL terminal
cd /mnt/c/Dev/DockRadar
source venv/bin/activate
python server.py
```

The React dev server on Windows can still reach `http://localhost:8080`.
