# DockRadar

**Know when your containers are out of date — and update them in one click.**

DockRadar is a self-hosted dashboard that watches the Docker images running on your host. It periodically checks each container's image against its upstream registry, shows which ones have a newer tag or digest available, and lets you apply updates — one container, a selected few, or all at once. Compose-managed containers are updated by editing and re-running their compose file; the rest are recreated from their captured configuration. Optional email alerts tell you when something needs attention.

It runs as a single container next to your Docker socket.

Source code: [github.com/ankityadavpurson/dockradar](https://github.com/ankityadavpurson/dockradar)

## Features

- Discovers running and stopped containers
- Tag + digest-based update detection (parallel registry checks)
- Single, selected, or bulk updates
- Optional docker-compose based update flow
- Per-container details (ports, mounts, env keys, networks, labels)
- Background scan scheduler
- Optional, deduplicated email notifications
- Optional API-key protection
- Hide containers from the dashboard
- Dark / light / system theme

## Tags

| Tag | Description |
| --- | --- |
| `latest` | Latest build from the `main` branch |
| `X.Y.Z` | Versioned releases (see [Releases](https://github.com/ankityadavpurson/dockradar/releases)) |
| `sha-<commit>` | Build of a specific commit |

Platform: `linux/amd64`. The same image is also published to `ghcr.io/ankityadavpurson/dockradar`.

## Quick start

### docker run

```bash
docker run -d --name dockradar \
  -p 8086:8086 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dockradar-compose:/app/backend/compose_files \
  --env-file .env \
  --restart unless-stopped \
  ankityadavpurson/dockradar:latest
```

`--env-file` is optional — without it DockRadar starts on sensible defaults. Then open `http://<your-host>:8086`.

### Docker Compose

```yaml
services:
  dockradar:
    image: ankityadavpurson/dockradar:latest
    container_name: dockradar
    volumes:
      - ./compose_files:/app/backend/compose_files
      - /var/run/docker.sock:/var/run/docker.sock
    env_file:
      - path: .env
        required: false   # requires Docker Compose v2.24+
    environment:
      HOST: 0.0.0.0
      PORT: 8086
      DOCKER_HOST: unix:///var/run/docker.sock
    ports:
      - "8086:8086"
    restart: unless-stopped
```

```bash
docker compose up -d
```

## Volumes and ports

| Path / Port | Purpose |
| --- | --- |
| `/var/run/docker.sock` | **Required.** Gives DockRadar access to the Docker daemon. |
| `/app/backend/compose_files` | Compose files uploaded through the UI. Mount it so they survive container recreation. |
| `8086` | Web UI and API. Interactive API docs at `/docs`, health check at `/api/health`. |

## Environment variables

All variables are optional. The full annotated list is in [`.env.example`](https://github.com/ankityadavpurson/dockradar/blob/main/.env.example).

| Variable | Default | Description |
| --- | --- | --- |
| `SCAN_INTERVAL_HOURS` | `6` | How often automatic scans run |
| `EMAIL_TO` | *(empty)* | Notification recipient. Leave empty to disable email |
| `EMAIL_FROM` | `dockradar@example.com` | Sender address |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port (`465` switches to implicit SSL automatically) |
| `SMTP_USER` / `SMTP_PASSWORD` | *(empty)* | SMTP credentials. Omit for unauthenticated relays |
| `SMTP_USE_SSL` | `true` on port 465 | Force implicit SSL on or off |
| `SMTP_STARTTLS` | `true` | Use STARTTLS when the server offers it |
| `APP_URL` | *(empty)* | Public UI URL. Adds an "Open DockRadar" link to emails |
| `API_KEY` | *(empty)* | When set, every `/api` route except `/api/health` requires the `X-Api-Key` header |
| `HIDDEN_REPOSITORY` | *(empty)* | Comma-separated container or repository names to hide (not listed, scanned, or updated) |
| `REGISTRY_CACHE_TTL` | `300` | Registry response cache, in seconds |
| `LOG_FILE` | `dockradar.log` | Log file name |
| `DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker daemon address (`unix://`, `tcp://`, or `ssh://`) |

**Email with Gmail:** use an [App Password](https://myaccount.google.com/apppasswords) (requires 2-Step Verification), not your account password. After starting the container, click the ⓘ icon next to **Email** in the UI → **Send test email** to verify.

**API key in the UI:** store the key once from the browser console:

```js
localStorage.setItem('dockradar_api_key', '<your key>')
```

## Update limitations

Containers not linked to a compose file are recreated from a captured subset of their configuration: ports, bind mounts, environment variables, restart policy, network mode, labels, command/entrypoint, hostname, user and working directory.

**Not preserved:** `--mount` named volumes, membership in multiple networks, network aliases, and advanced options (capabilities, devices, resource limits, healthchecks, …). For those containers, associate a compose file in the UI and use the compose update flow instead.

## Security

Mounting the Docker socket gives DockRadar full control of the Docker host — treat it as a privileged service. It has no user accounts.

- Set `API_KEY` to protect the API.
- Do not expose DockRadar directly to the internet. Put it behind a reverse proxy with authentication and TLS.

See [SECURITY.md](https://github.com/ankityadavpurson/dockradar/blob/main/SECURITY.md) for details.

## Links

- [Source code](https://github.com/ankityadavpurson/dockradar)
- [Releases](https://github.com/ankityadavpurson/dockradar/releases)
- [Changelog](https://github.com/ankityadavpurson/dockradar/blob/main/CHANGELOG.md)
- [Issues](https://github.com/ankityadavpurson/dockradar/issues)
- License: [MIT](https://github.com/ankityadavpurson/dockradar/blob/main/LICENSE)
