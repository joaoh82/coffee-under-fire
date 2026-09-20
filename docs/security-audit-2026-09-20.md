# Public release security check, 2026-09-20

Audited release commit: `58350cc` (main after PR #15). The existing repository remains private. No history rewrite, credential rotation, deployment change or visibility change was performed. Unrelated local mobile UI edits were excluded.

## Current files and credentials

The six third-party reference screenshots are absent from the tracked release tree. The reference directory is now ignored to prevent accidental reintroduction. The historical copies still exist: publishing this same repository would expose them. Removing current files does not resolve historical redistribution permission.

Gitleaks 8.30.1, downloaded from its official release and checked against the release SHA-256 manifest, reported zero findings in:

- All locally fetched Git branches/history: 29 commits, approximately 44.24 MB scanned.
- An archive of the current tracked tree: approximately 50.45 MB scanned.
- A fresh production web build: approximately 7.98 MB scanned.

The checked-in `.gitleaks.toml` extends the standard rules with TypeSafe/Jev key and Render deployment-hook patterns. Reports used full redaction and were kept outside the repository. No real `.env` file or production database was loaded. Zero findings is not proof that every possible credential format is absent, nor does it establish whether credentials shared outside Git were rotated. Confirm rotation of the Jev key previously shared in conversation before public release.

To repeat with Gitleaks installed:

```sh
gitleaks git . --log-opts='--all' --config .gitleaks.toml --redact
npm ci --include=dev
npm run build
gitleaks dir dist/web --config .gitleaks.toml --redact
```

The build contained 31 files, no source maps or private database/key files, and no matches for the server secret variable names or Render deployment-hook URLs checked. Dependency installation reported zero known vulnerabilities. Build passed; 118/118 offline tests passed. Existing Vite import-extension and bundle-size warnings remain.

## GitHub main protection

Applied and verified through the GitHub API:

- Pull requests required, including for administrators.
- GitHub Actions `test` check required, bound to GitHub Actions app ID 15368.
- Branch must be up to date before merging.
- Review conversations must be resolved.
- Force pushes and branch deletion disabled.
- Zero required approving reviewers, so the solo owner can merge their own PR after checks pass.

These are GitHub settings, not effects of merging this document. The workflow already builds and runs offline tests with read-only permissions and no production secrets. Secret scanning is not added to CI by this change; the Gitleaks configuration supports manual repeat scans.

## Live website exposure checks

Ten bounded unauthenticated GET requests were made to `https://coffee.yardsort.sh`. No game sessions, login attempts, paid Jev calls or configuration mutations were made.

- `/` returned the public entry page (200).
- `/healthz` returned a small health response (200).
- `/admin`, `/api/profile` and `/api/status` returned 401.
- `/.env`, `/.git/config`, `/render.yaml` and `/private-data/access.sqlite` returned 401 without those files being served.
- An unlisted brand-asset path returned 401; this is not a validation of the social preview asset.

The checked responses included HSTS, Content Security Policy and `nosniff`. The server static-file handler also restricts access to the built web directory, rejects dotfile paths, and verifies real paths to prevent escaping that directory. Admin writes require an admin session and the configured Origin. These code checks complement, but do not replace, authenticated deployment testing.

The hostname and hosting provider are not credentials. Public source and browser assets reveal routes and implementation details, but do not grant Render account access or deployment rights. Jev keys, owner tokens, cookie secrets and deployment-hook keys must remain server-side. Anonymous gameplay intentionally consumes resources through server-enforced budgets; public availability can still attract abuse or denial of service. This was not a penetration test, an authenticated production audit, or a verification of all Render account settings.

## Remaining release decisions

- Historical screenshot permission/removal remains unresolved, although the owner has chosen to retain the existing repository and defer history cleanup.
- Verify rotation of credentials previously shared outside Git.
- Verify backup restoration and deployed spending controls across restarts before relying on them operationally.
- Repository visibility remains an explicit owner decision.
