# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | ✅ Yes    |
| 1.x     | ❌ No     |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in DockRadar, please report it privately so it can be addressed before public disclosure.

### How to report

Send an email to: **security@[your-domain].com**

Or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) if enabled on this repository.

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations if you have them

### What to expect

- **Acknowledgement** within 48 hours
- **Status update** within 7 days with an assessment and expected timeline
- **Credit** in the release notes if you wish, once the issue is resolved

---

## Security Considerations for Self-Hosted Deployments

DockRadar controls Docker containers on your host. Please keep the following in mind:

### Docker TCP socket (unencrypted)
Setting `DOCKER_HOST=tcp://localhost:2375` exposes the Docker daemon with **no authentication**. Anyone who can reach that port has full control over Docker. Only use this on a trusted local machine and never expose port `2375` to the internet or untrusted networks.

### Docker TCP socket (TLS)
For remote access over TCP, always use TLS (`port 2376` with `DOCKER_TLS_VERIFY=1`) to authenticate and encrypt the connection.

### SSH access
`DOCKER_HOST=ssh://user@host` is the safest remote option. Ensure your SSH keys are protected with a passphrase and that `~/.ssh/known_hosts` is populated before running DockRadar.

### Network exposure
DockRadar's API server (`server.py`) has no built-in authentication. Do not expose port `8080` directly to the internet. Use a reverse proxy (e.g. Nginx or Caddy) with authentication in front of it for any externally accessible deployment.

### Environment file
Never commit your `.env` file. It may contain SMTP credentials, Docker host addresses, or other sensitive values. The `.gitignore` in this repo already excludes it.
