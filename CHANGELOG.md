# Changelog

All notable changes to DockRadar will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
DockRadar uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Refreshed repository documentation for public release readiness.
- Updated `README.md` to match current startup scripts, module entrypoint, and runtime modes.
- Updated `CONTRIBUTING.md` to reflect actual folder structure and workflow.
- Reworked `SECURITY.md` disclosure guidance and deployment warnings.

### Added
- `SUPPORT.md` with support channels and expected response model.
- GitHub issue templates for bug reports and feature requests.
- Pull request template for standardized review context.

## [2.0.0] — 2025

### Added
- Full rewrite: replaced NiceGUI with a proper **FastAPI** backend + **React 18 / Vite / Tailwind CSS** frontend
- **Two-step update detection**: tag comparison first, then manifest digest comparison for same-tag rebuilds (catches silent `latest` updates)
- **Remote Docker support** via SSH (`ssh://user@host`) using Paramiko, and TCP (`tcp://host:port`)
- **Image digest capture**: local running image digest stored and shown in the UI alongside the tag
- **Version Check column** in the dashboard — shows which checks were performed and their results (tag changed / tag match + digest match / digest changed / no digest)
- REST API with full **Swagger UI** at `/docs` and ReDoc at `/redoc`
- Background scan polling — UI polls `/api/scan/status` every 1.5s only while a scan or update is running
- Confirm dialogs before all destructive or update actions
- Toast notifications for all scan, update, and error events
- Client-side sortable table columns
- Search and "Outdated only" filter in the toolbar
- Select All / None / individual row checkboxes for bulk updates

### Changed
- Entry point moved to `backend/app/main.py` (run with `python -m app.main` from `backend/`)
- `requirements.txt` updated: removed `nicegui`, added `uvicorn`, `paramiko`
- `.gitignore` expanded to cover `frontend/node_modules`, `frontend/dist`, and all `.env.*` variants

### Removed
- NiceGUI dependency and all UI code in `ui/`
- NiceGUI-specific `/docs` workaround in `app.py`

---

## [1.0.0] — 2024

### Added
- Initial release
- NiceGUI-based dashboard
- Docker container discovery via Docker SDK
- Docker Hub tag comparison
- APScheduler background scans
- SMTP email notifications
- Container stop / remove / recreate with preserved config
- `.env`-based configuration via python-dotenv
