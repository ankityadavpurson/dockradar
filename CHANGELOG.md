# Changelog

All notable changes to DockRadar will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
DockRadar uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [13.2.1] — 2026-07-19

## [13.2.0] — 2026-07-19

## [13.1.0] — 2026-07-19

## [13.0.0] — 2026-07-19

## [12.0.0] — 2026-07-19

### Added
- **Email notifications are now wired in**: scans that find new updates send a notification (deduplicated — the same update is announced only once). HTML content is escaped.
- Optional **API-key protection** via `API_KEY` — all `/api` routes except `/api/health` require the `X-Api-Key` header; the UI reads the key from `localStorage('dockradar_api_key')`.
- **`HIDDEN_REPOSITORY`** environment variable (comma-separated, case-insensitive container or repository names) to hide containers from listing, scanning, and bulk updates.
- Backend unit test suite (`backend/tests`, run with `pytest`) covering registry helpers, image-reference parsing, compose storage/associations, and hidden-container filtering; `requirements-dev.txt` added.
- Upload hardening for compose files: 1 MiB size cap, UTF-8 validation, missing-filename guard.

### Fixed
- "Update Selected" sent container IDs where the API expects names, so it always failed with 404.
- A crash during a scan or update could leave the busy flag stuck, blocking all further scans/updates until restart — workers now always release state.
- Scan/update state transitions are now atomic (thread lock); the scheduler skips its run instead of racing a user-triggered scan/update, and single-container updates now mark the app busy.
- Registry cache is invalidated for updated containers, so post-update rescans no longer report stale "update available".
- False "update available" for version-pinned tags on generic v2 registries (ghcr.io, lscr.io, …) — digests are now compared before flagging.
- Digest-pinned image references (`repo@sha256:…`) parsed incorrectly; they are now recognized and skipped during scans.
- `next_scan` is emitted as ISO-8601 (fixes "Invalid Date" in Safari).
- Toast notifications no longer disappear early when shown in quick succession.
- Default port unified to **8086** across `.env.example`, backend config, Vite dev proxy, and docs.
- Invalid numeric environment values fall back to defaults instead of crashing on startup.

### Changed
- Registry checks during a scan run in parallel (up to 8 workers), cutting scan time significantly.
- Scheduled scans skip email-less duplicate announcements; compose store path is now anchored to `backend/` regardless of working directory.
- "Update Selected" badge and confirmation now count the full selection (updates recreate even up-to-date containers).
- Update confirmation dialogs spell out which configuration is and isn't preserved.
- Compose file picker shows filenames instead of service lists.
- Accessibility: dialogs have proper dialog semantics with Escape-to-close and initial focus; table sort headers are keyboard-accessible buttons with `aria-sort`; checkboxes and status indicators are labeled; the progress log is a live region.
- The UI no longer loads fonts from Google Fonts (works fully offline).
- Removed unused `DOCKER_SOCKET` config and `PUID`/`PGID` from `.env.example`.

### Previously documented (docs refresh)
- Refreshed repository documentation for public release readiness.
- Updated `README.md` to match current startup scripts, module entrypoint, and runtime modes.
- Updated `CONTRIBUTING.md` to reflect actual folder structure and workflow.
- Reworked `SECURITY.md` disclosure guidance and deployment warnings.
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
