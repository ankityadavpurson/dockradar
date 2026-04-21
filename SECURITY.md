# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

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

- DockRadar currently has no built-in API auth/RBAC.
- Do not expose the API directly to the public internet.
- Use a reverse proxy with authentication and TLS.

5. Secrets handling

- Never commit `.env`.
- Rotate SMTP/API credentials if exposure is suspected.

## Disclosure and Credit

After remediation, maintainers may publish:

- A changelog/security note
- CVE or advisory metadata (if applicable)
- Optional reporter credit, if requested
