# Owner console and managed invites

Implementation prepared 2026-09-20. `/admin` is an owner-only, server-rendered console independent of player access. A dedicated random `ADMIN_TOKEN` (32+ characters) signs the owner in for eight hours; only its hash is compared, and short-lived admin cookie tokens are held in server memory. Restarts sign the owner out. The token must never be prefixed `VITE_` or committed. No password recovery, public signup, email delivery or external analytics is included.

## Production migration

**Do not deploy the managed configuration without a persistent disk.** Ordinary Render files are ephemeral. The updated `render.yaml` proposes a 1 GB disk at `/var/data` (published storage price $0.25/month as checked 2026-09-20), `ACCESS_DB_PATH=/var/data/coffee/access.sqlite`, generated and a generated `ADMIN_TOKEN`. Single instance only; disk deploys interrupt games. See [Render disks](https://render.com/docs/disks) and [pricing](https://render.com/pricing).

1. Apply the prepared Blueprint configuration. Keep the existing `PLAYTEST_INVITES` for the first deployment so the migration can import them. For a new installation, enter `{}`.
2. Retrieve the generated `ADMIN_TOKEN` privately from Render Environment; store it in your password manager. Visit the HTTPS `/admin` URL and enter it. Never paste it into chat/issues.
3. Existing invites import transactionally **once**. A durable marker prevents disabled invites being resurrected on restart. After checking the imported users, remove the obsolete invite JSON secret. Further changes happen in `/admin`.
4. Create/edit an invite by name. **Generate password** fills a random password for review; **Save invite** applies it. New blank passwords are also generated on save. Existing blank passwords are unchanged. Each player row has **Reset password**, which immediately generates and applies a new password, displays it once and revokes old logins/games without changing the invite’s enabled status or concurrency limit. Disabling access, resetting a password, or reducing concurrency ends affected games. Default concurrency is one, maximum eight.
5. Test login, two simultaneous games on the same invite, a second invite, revocation, a closed-tab timeout, then restart and verify retained statistics.

Without `ACCESS_DB_PATH`, the old environment gate remains for a safe staged rollout. `/admin` requires the managed configuration. This compatibility mode does **not** have durable statistics or managed login throttling and should not be used as the public-release deployment.

## Sessions and statistics

A game token is bound to its invite. Another invite cannot use it to heartbeat, submit a score or close the game. Browser heartbeats every 10 seconds maintain a 90-second lease; games expire at 30 minutes. Ending a run releases its slot on the next heartbeat, while disposing the game sends a close request. Lost network tabs release their slots after timeout. Restarting the server closes active games but preserves invites, logins and counters.

Active play time counts bounded intervals between heartbeats reporting a visible, running game. Paused/hidden tabs are excluded; missed intervals can undercount. This is a client-reported estimate, not anti-cheat or proof of human activity. Login timestamps and cookie expiration are shown separately; an unexpired cookie does not mean someone is online.

The console shows login counts, last login, runs, active games and approximate play minutes. Gameplay makes no paid API calls, so there is no token or dollar accounting. Databases created before 2026-10-03 keep their old `usage` table; it is no longer read or written.

## Security and operations

- Invite passwords use salted asynchronous scrypt hashes. Database and WAL/SHM files are 0600, inside a private directory. Never serve or commit database backups.
- Login tokens are random and stored hashed with expiry and invite revision. Player logout invalidates that login cookie server-side. Invite reset/disable revokes all of that invite's logins and games.
- Admin and player cookies are separate, HttpOnly, SameSite=Strict, Secure in production. Owner access alone cannot call game APIs.
- All admin mutations are POST forms requiring the exact configured Origin. Dashboard values are HTML-escaped and no scripts run there.
- Login attempts are bounded globally (60/minute) and per submitted identity (8/10 minutes), with two simultaneous password derivations. Limits count successful attempts too. They reset on process restart. This avoids trusting spoofable forwarded-IP headers; a sustained attack can temporarily prevent legitimate login, so add edge protections before broad traffic.
- Store records currently retain historical login/run data; there is no deletion/retention UI yet. Inform invitees. No IP addresses or user agents are persisted.
- SQLite must remain single-process. Do not run multiple app instances or independent store processes on the same database: startup closes prior games. Back up using SQLite's online backup facility or stop the service before copying the database plus its WAL. Store backups securely and test restoration before relying on them. Render disk snapshots are not a substitute for an application-consistent database backup.

## Local verification

Use Node 24. A local owner-console test can run on port 8787 with `ACCESS_DB_PATH`, `ADMIN_TOKEN`, and `PUBLIC_ORIGIN=http://127.0.0.1:8787`. `NODE_ENV` must remain development for HTTP cookies. For serving the complete game from this server, build first; production itself requires an HTTPS origin. Unit and HTTP tests use temporary databases.

Run `npm run build` and `npm test`. The existing invitation prototype and the new managed path have separate production integration coverage.

## Optional public guests

The console includes access mode (invite-only or public guests + invites) and concurrent guest games per network. Defaults are invite-only and two concurrent guest games per network. See [public guest deployment](public-play.md) for Turnstile and trusted IP configuration.
