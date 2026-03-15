# Contributing to DockRadar

Thank you for your interest in contributing! This document explains how to get set up, what to work on, and how to submit changes.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/dockradar.git
   cd dockradar
   ```
3. Add the upstream remote so you can pull future changes:
   ```bash
   git remote add upstream https://github.com/OWNER/dockradar.git
   ```

---

## Development Setup

### Backend

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate      # Linux / macOS
venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set DOCKER_HOST if needed

# Start the API server
python server.py
# → http://localhost:8080
# → http://localhost:8080/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies all `/api` calls to `http://localhost:8080` automatically.

---

## Project Structure

| File / Folder | Purpose |
|---|---|
| `server.py` | FastAPI entry point, CORS, static file serving |
| `api.py` | All REST endpoint definitions |
| `docker_service.py` | Docker SDK interactions, image digest capture |
| `registry_service.py` | Tag + digest comparison against Docker Hub / registries |
| `update_service.py` | Container stop → pull → recreate lifecycle |
| `scheduler_service.py` | APScheduler background scan scheduling |
| `email_service.py` | SMTP notification emails |
| `config.py` | Environment variable loading via python-dotenv |
| `frontend/src/` | React + Vite + Tailwind UI |

---

## Making Changes

- **Create a branch** for your work — never commit directly to `main`:
  ```bash
  git checkout -b feat/my-feature
  # or
  git checkout -b fix/bug-description
  ```

- **Keep commits focused** — one logical change per commit with a clear message:
  ```
  feat: add digest comparison for private registries
  fix: handle missing RepoDigests on local images
  docs: update DOCKER_HOST examples in README
  ```

- **Open an issue first** for significant changes so we can discuss the approach before you invest time in implementation.

---

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feat/my-feature
   ```
2. Open a Pull Request against the `main` branch of the upstream repo.
3. Fill in the PR template — describe what changed, why, and how to test it.
4. A maintainer will review and may request changes before merging.

---

## Coding Standards

### Python
- Follow [PEP 8](https://peps.python.org/pep-0008/) style
- Type hints on all function signatures
- Docstrings on all public classes and methods
- Log meaningful messages at appropriate levels (`INFO` for normal flow, `WARNING` for recoverable issues, `ERROR` for failures)

### JavaScript / React
- Functional components only — no class components
- One component per file
- Use `const` / `let`, no `var`
- Keep components small and focused — extract sub-components when a file exceeds ~150 lines

### General
- Don't commit `.env`, secrets, or personal config
- Don't hardcode IPs, paths, or credentials
- Keep PRs reasonably scoped — large all-in-one PRs are harder to review

---

## Reporting Bugs

Please use the **Bug Report** issue template and include:
- Your OS and Python version
- Docker version and connection method (`socket`, `tcp`, `ssh`)
- Steps to reproduce
- What you expected vs what happened
- Relevant log output from `server.py`

---

## Requesting Features

Please use the **Feature Request** issue template. Describe the problem you're trying to solve, not just the solution — there may be a better approach we can discuss together.
