# Security Policy

## Supported Versions

| Version        | Supported |
|----------------|-----------|
| 13.x (latest)  | Yes       |
| < 13.x         | No        |

Only the latest minor release on the current major line receives security
fixes. Older majors are not patched — upgrade to the latest `13.x` release.

## Reporting a Vulnerability

Do not report security vulnerabilities in public issues.

Preferred path:

- Use GitHub private vulnerability reporting (Security Advisories) for this repository.

Fallback path:

- Open a private maintainer contact request through repository Discussions and label it `security-contact-request`.

Include:

- Impact summary
- Reproduction steps or proof of concept
- Affected versions
- Suggested mitigation, if available

Target response times:

- Initial acknowledgement: within 72 hours
- Initial triage status: within 7 days

## Operational Security Notes

DockRadar can control Docker containers on the host. Treat it as a privileged service.

1. Docker socket / daemon access

- Mounting `/var/run/docker.sock` or exposing Docker TCP gives high privilege.
- Prefer least-exposed access patterns and isolated networks.

2. Docker TCP without TLS

- `tcp://...:2375` is unauthenticated and unencrypted.
- Use only in trusted local development scenarios.

3. Remote Docker over SSH

- `DOCKER_HOST=ssh://user@host` is preferred over raw TCP.
- Enforce SSH key hygiene and host key verification.

4. API exposure

- DockRadar has no user accounts or RBAC. An optional shared API key is available: set `API_KEY` in the environment and every `/api` route except `/api/health` will require the `X-Api-Key` header.
- The API key is a single shared secret sent per request — it is not a substitute for TLS or real authentication on untrusted networks.
- Do not expose the API directly to the public internet.
- For internet-facing deployments, use a reverse proxy with authentication and TLS in addition to `API_KEY`.
- Note: uploading a compose file and triggering a compose update effectively runs attacker-chosen container definitions — anyone with API access can control the Docker host.
- The UI holds the API key in the browser's `localStorage` (`dockradar_api_key`). It is readable by any script running on the page and persists on shared machines — clear it (`localStorage.removeItem('dockradar_api_key')`) when using a browser you do not control.
- Browser access is restricted by CORS to `localhost`/`127.0.0.1` origins by default. When serving DockRadar from another hostname (e.g. behind a reverse proxy), update the allowed origins in `backend/app/main.py` to match — do not widen them to `*`.

5. Secrets handling

- Never commit `.env`. It holds live runtime secrets — Docker Compose loads it
  into the container via `env_file`, and it is excluded from the image by
  `.dockerignore` and from git by `.gitignore`.
- Restrict `.env` file permissions on the host (e.g. `chmod 600 .env`), since it
  contains the SMTP password and any `API_KEY`.
- Rotate SMTP/API credentials if exposure is suspected. For Gmail, revoke the
  App Password from your Google account.

6. Data handling

- The container-details API returns only environment-variable **names**, never their values, so secrets baked into a container's environment are not exposed through the UI or API.
- Uploaded compose files are stored **unencrypted** on disk in `backend/compose_files/` (the persisted volume) and may contain secrets or credentials. They are excluded from git (`.gitignore`) and the image (`.dockerignore`); restrict permissions on the host volume accordingly.
- "Update via compose" **reads and writes the real compose files** of managed stacks (rewriting a pinned `image:` tag, keeping a `.bak`). Grant DockRadar write access only to the stack directories you intend it to manage — on a container install this is scoped by which host paths you bind-mount read-write. Anyone with API access can trigger these edits and container recreations.

7. Known limitations

- The `X-Api-Key` header is compared in constant time, but it remains a single shared secret with no per-user identity — treat `API_KEY` as a deployment gate behind TLS, not a hardened auth boundary.
- There is no rate limiting, account lockout, or audit log. Put DockRadar behind a proxy that provides these for any exposed deployment.

## Disclosure and Credit

After remediation, maintainers may publish:

- A changelog/security note
- CVE or advisory metadata (if applicable)
- Optional reporter credit, if requested
