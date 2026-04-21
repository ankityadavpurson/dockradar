# Contributing to DockRadar

Thanks for your interest in improving DockRadar.

## Getting Started

1. Fork this repository.
2. Clone your fork:

```bash
git clone https://github.com/your-username/dockradar-v2.git
cd dockradar-v2
```

3. Add upstream:

```bash
git remote add upstream https://github.com/OWNER/dockradar-v2.git
```

## Local Development

### Option A: Start scripts (recommended)

Use one of:

- `scripts/start.sh`
- `scripts/start.ps1`
- `scripts/start.bat`

These scripts bootstrap dependencies, create `.env` from `.env.example` when missing, and run backend + frontend dev servers.

### Option B: Manual

Backend:

```bash
python -m venv venv
source venv/bin/activate
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

## Code Layout

- `backend/app/main.py`: FastAPI app bootstrap and SPA serving.
- `backend/app/api/routes.py`: REST endpoints.
- `backend/app/services/`: Docker, registry, update, compose, scheduler, and email services.
- `backend/app/core/`: Environment config and logging setup.
- `frontend/src/`: React UI components, hooks, and API client.

## Branch and Commit Rules

- Do not commit directly to `main`.
- Keep commits scoped and descriptive.

Example commit messages:

- `feat: add compose file validation guard`
- `fix: handle docker registry timeout gracefully`
- `docs: align setup instructions with current scripts`

## Pull Requests

Before opening a PR:

1. Rebase onto the latest `main`.
2. Ensure your change is tested manually.
3. Update docs when behavior/config changed.

When opening a PR:

1. Use the PR template.
2. Describe what changed and why.
3. Include validation steps and screenshots for UI changes.

## Coding Standards

Python:

- Follow PEP 8.
- Use type hints and docstrings on public functions/classes.
- Avoid broad exception swallowing unless intentionally handled.

Frontend:

- Functional React components only.
- Keep components focused.
- Avoid introducing global mutable state outside hooks unless needed.

General:

- Never commit secrets or `.env` files.
- Do not commit runtime data from `backend/compose_files/`.
- Keep PRs small enough to review safely.

## Reporting Bugs and Features

- Use GitHub issue templates:
   - Bug report
   - Feature request
- For security issues, do not open public issues. Use the process in `SECURITY.md`.
