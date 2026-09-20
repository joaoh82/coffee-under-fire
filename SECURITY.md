# Security policy

This experimental project has no guaranteed security support or response-time SLA. Security fixes target the current main branch.

## Report a vulnerability

Do not post credentials, exploit instructions against the live service, or player data in public issues. Use GitHub's **Security → Report a vulnerability** when private reporting is enabled. If it is unavailable, contact the maintainer privately at **joaoh82@gmail.com** with a brief description; agree on a secure channel before sending sensitive details. Include the affected revision, impact and a minimal local reproduction using dummy credentials.

Do not test resource exhaustion or Jev-budget abuse against the hosted game. Reproduce on your own local fixture-mode instance.

## Operator responsibilities

- Keep API keys and admin credentials server-side; never use `VITE_` for secrets.
- Use HTTPS, strong unique credentials and persistent access/session storage with backups.
- Keep development loopback-only. An allowed tunnel hostname is not authentication.
- Treat client-submitted scores, timing and observations as untrusted. Recorded usage estimates are not provider billing reconciliation.
- Rotate exposed keys and credentials, even if they never entered Git history.
- Keep dependencies updated and review changes before deploying. Do not provide production secrets to pull-request CI.

See the [release checklist](docs/open-source-readiness.md) before changing repository visibility.
