# Security Policy

## Supported Versions

Better-PaaS follows a rolling-release support model. Security updates are applied to the latest released version only. Older releases are not maintained with back-ported fixes.

| Version   | Supported          |
| --------- | ------------------ |
| v1.8.x    | :white_check_mark: |
| < v1.8.0  | :x:                |

If you are running an older version, please upgrade to the [latest release](https://github.com/sumon-ohid/better-paas/releases/latest) before reporting a vulnerability that may already be fixed.

## Reporting a Vulnerability

We appreciate responsible disclosure of security issues.

Please report vulnerabilities privately via [GitHub Security Advisories](https://github.com/sumon-ohid/better-paas/security/advisories/new). This keeps the details confidential while we investigate and prepare a fix.

When reporting, include as much detail as possible:

- A clear description of the issue and the impact.
- Steps to reproduce or a proof-of-concept.
- The affected version(s) or component(s).
- Any suggested mitigation or fix.

## Response Process

1. **Acknowledgment**: We aim to acknowledge reports within 3 business days.
2. **Investigation**: We will assess the report, ask follow-up questions if needed, and confirm whether it is accepted or declined.
3. **Fix & Release**: If accepted, we will work on a fix and release it as soon as practical.
4. **Disclosure**: Once a fix is available, we will publish a security advisory and credit the reporter unless they prefer to remain anonymous.

Please do not publicly disclose a vulnerability before a fix is released.

## Security Hardening Notes

Better-PaaS includes several built-in security measures. For more details, see the [Security Hardening section of the README](https://github.com/sumon-ohid/better-paas?tab=readme-ov-file#-security-hardening). Highlights include:

- **Admin authentication** is handled via a single auto-generated bearer token.
- **At-rest encryption** of git tokens and GitHub tokens using AES-256-GCM.
- **Brute-force protection** with escalating IP-based lockout on failed logins.
- **CORS / WebSocket origin checks** and optional `DASHBOARD_ORIGIN` allow-listing.
- **Sensitive data isolation**: SQLite database, keys, and logs live in `backend/data/` with restricted permissions and are excluded from git.
- **Redacted secrets**: Sensitive environment variables can be marked so they are omitted from API responses.
