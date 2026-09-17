# Changelog

All notable changes to DockRadar will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
DockRadar uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [13.16.2] — 2026-09-17

### Changed
- move actions to node24 majors and stop large asset uploads failing releases

## [13.16.1] — 2026-09-17

### Fixed
- preserve sequence indentation in compose YAML processing and enhance UI hover effects

## [13.16.0] — 2026-09-17

### Added
- make compose updates work on container installs and fail clearly when they can't

## [13.15.0] — 2026-09-17

### Added
- Separate `uninstall.sh` for native installs, published with each release and included in the install folder (`/opt/dockradar/current/uninstall.sh`). `--purge` now asks before deleting config and compose files (`--yes` skips the question). `install.sh --uninstall [--purge]` still works and hands off to it.
- The native installer and uninstaller show numbered steps (`[1/6]` …). The installer also shows a download progress bar, the Python package being installed, and a startup wait counter when run in a terminal. If `pip install` fails, its output is now printed.

### Fixed
- `install.sh` no longer exits silently after "Looking up the latest release…". The GitHub API lookup failed with a curl write error under `set -o pipefail`. API failures now show an error suggesting `--version X.Y.Z`.


## [13.14.0] — 2026-09-17

### Added
- rework compose updates to run against the real project and upgrade pinned tags

## [13.13.0] — 2026-09-16

### Added
- add Docker Hub description update step and create DOCKERHUB.md

## [13.12.0] — 2026-09-16

### Added
- add Docker Hub login and update README with image pull instructions

## [13.11.0] — 2026-09-16

### Added
- enhance RowMenu with improved positioning and accessibility features
- add fullscreen toggle and close functionality to ProgressLog component

### Changed
- update terminology in RowMenu, Toast, and CSS files for consistency
- update Toolbar component styles and functionality

## [13.10.0] — 2026-09-16

### Added
- add updatingNames state to manage containers with updates in flight

## [13.9.0] — 2026-09-16

### Changed
- Changelog is now actively maintained: every `13.x` release has been backfilled and [Keep a Changelog](https://keepachangelog.com/) compare links added.
- Release notes are generated automatically from conventional commits when the `[Unreleased]` section is empty, so each GitHub Release leads with a grouped summary (manual notes, when present, are used as-is).


## [13.8.0] — 2026-09-16

### Added
- Application version is exposed via `/api/health` and shown in the UI footer; the version is sourced from a dedicated `backend/app/version.py` module, kept in sync by the release workflow.

### Changed
- `X-Api-Key` is now compared in constant time, removing a timing side-channel.
- `SECURITY.md` reworked — accurate supported-version table, clearer vulnerability reporting, and new notes on data handling and known limitations.

### Fixed
- Email-notification dedup state now persists to disk, so restarting the backend no longer re-sends notifications for updates that were already announced.
- Added `httpx` to `requirements-dev.txt` so Starlette's `TestClient` tests run in CI.

## [13.7.0] — 2026-09-14

### Added
- Native install for Linux (systemd service) and macOS (per-user LaunchAgent) via a single `install.sh`, with WSL guidance.

### Fixed
- HOME-directory check on macOS during install.

## [13.6.0] — 2026-09-14

### Changed
- Notification email HTML structure and styling improved for readability; the test email now uses realistic container sample data.

## [13.5.0] — 2026-09-13

### Added
- Light / dark / system **theme toggle** in the header.
- `APP_URL` configuration adds an "Open DockRadar" link to notification emails.

### Changed
- README rewritten with a clearer project description and feature list.
- Notification emails sent as styled multipart (HTML + text) messages with improved layout.

### Fixed
- Docker-connection error handling: the health check runs before the error banner is shown, and next-scan info is displayed conditionally (no more banner flash on load).

## [13.4.0] — 2026-09-12

### Changed
- Documentation updated for Docker Compose usage and environment-variable handling.

## [13.3.0] — 2026-07-26

### Added
- Email configuration dialog with a "Send test email" action and optional SMTP settings.

### Changed
- Introduced a shared `Modal` component for consistent dialogs (EmailConfigDialog, ConfirmDialog, ComposeUpdateDialog).
- Improved header layout/responsiveness, CSS-variable theming groundwork, and button accessibility.

## [13.2.1] — 2026-07-19

### Fixed
- Clarified CI trigger conditions for pull requests vs the main branch.

## [13.2.0] — 2026-07-19

### Added
- CI workflow running backend tests and the frontend build.

## [13.1.0] — 2026-07-19

### Changed
- Release workflow now auto-calculates the version and handles manual dispatch inputs.

## [13.0.0] — 2026-07-19

### Added
- Docker image exported as a release asset so it can be downloaded and `docker load`-ed offline.

## [12.0.0] — 2026-07-19

### Added
- **Email notifications are now wired in**: scans that find new updates send a notification (deduplicated — the same update is announced only once). HTML content is escaped.
- Optional **API-key protection** via `API_KEY` — all `/api` routes except `/api/health` require the `X-Api-Key` header; the UI reads the key from `localStorage('dockradar_api_key')`.
- **`HIDDEN_REPOSITORY`** environment variable (comma-separated, case-insensitive container or repository names) to hide containers from listing, scanning, and bulk updates.
- Backend unit test suite (`backend/tests`, run with `pytest`) covering registry helpers, image-reference parsing, compose storage/associations, and hidden-container filtering; `requirements-dev.txt` added.
- Upload hardening for compose files: 1 MiB size cap, UTF-8 validation, missing-filename guard.
- **Native install for Linux and macOS** (no container): a single `install.sh` detects the OS and installs DockRadar from a prebuilt release tarball (`dockradar-X.Y.Z.tar.gz`) — as a systemd service on Linux, or a per-user LaunchAgent on macOS (config in `~/Library/Application Support/DockRadar`, localhost-only by default, auto-detects the Docker Desktop / OrbStack / Colima socket). Includes interactive email setup on first install, upgrade-in-place, and `--uninstall` / `--purge`. Releases now attach the tarball, its `.sha256`, and `install.sh`.
- **`DOCKRADAR_ENV_FILE`** environment variable to load configuration from an explicit file.
- **`COMPOSE_DIR`** environment variable to relocate compose-file storage (default unchanged: `backend/compose_files`).

### Changed
- Registry checks during a scan run in parallel (up to 8 workers), cutting scan time significantly.
- Scheduled scans skip email-less duplicate announcements; compose store path is now anchored to `backend/` regardless of working directory.
- "Update Selected" badge and confirmation now count the full selection (updates recreate even up-to-date containers).
- Update confirmation dialogs spell out which configuration is and isn't preserved.
- Compose file picker shows filenames instead of service lists.
- Accessibility: dialogs have proper dialog semantics with Escape-to-close and initial focus; table sort headers are keyboard-accessible buttons with `aria-sort`; checkboxes and status indicators are labeled; the progress log is a live region.
- The UI no longer loads fonts from Google Fonts (works fully offline).
- Removed unused `DOCKER_SOCKET` config and `PUID`/`PGID` from `.env.example`.
- **Documentation refresh** for public-release readiness: `README.md` updated to match current startup scripts, module entrypoint, and runtime modes; `CONTRIBUTING.md` updated to reflect actual folder structure and workflow; `SECURITY.md` disclosure guidance and deployment warnings reworked; `SUPPORT.md` added with support channels and response model; GitHub issue templates (bug report, feature request) and a pull-request template added.

### Fixed
- `docker-compose.yml` now loads `.env` via `env_file`, so SMTP/email, `API_KEY`, and all other settings actually reach the container (previously only `HOST`/`PORT`/`DOCKER_HOST`/`HIDDEN_REPOSITORY` were passed, making email impossible to configure in a Compose deployment). Container-critical values stay pinned in the compose file.
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

---

[Unreleased]: https://github.com/ankityadavpurson/dockradar/compare/v13.16.2...HEAD
[13.16.2]: https://github.com/ankityadavpurson/dockradar/compare/v13.16.1...v13.16.2
[13.16.1]: https://github.com/ankityadavpurson/dockradar/compare/v13.16.0...v13.16.1
[13.16.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.15.0...v13.16.0
[13.15.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.14.1...v13.15.0
[13.14.1]: https://github.com/ankityadavpurson/dockradar/compare/v13.14.0...v13.14.1
[13.14.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.13.0...v13.14.0
[13.13.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.12.0...v13.13.0
[13.12.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.11.0...v13.12.0
[13.11.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.10.0...v13.11.0
[13.10.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.9.0...v13.10.0
[13.9.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.8.0...v13.9.0
[13.8.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.7.0...v13.8.0
[13.7.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.6.0...v13.7.0
[13.6.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.5.0...v13.6.0
[13.5.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.4.0...v13.5.0
[13.4.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.3.0...v13.4.0
[13.3.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.2.1...v13.3.0
[13.2.1]: https://github.com/ankityadavpurson/dockradar/compare/v13.2.0...v13.2.1
[13.2.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.1.0...v13.2.0
[13.1.0]: https://github.com/ankityadavpurson/dockradar/compare/v13.0.0...v13.1.0
[13.0.0]: https://github.com/ankityadavpurson/dockradar/compare/v12.0.0...v13.0.0
[12.0.0]: https://github.com/ankityadavpurson/dockradar/releases/tag/v12.0.0
