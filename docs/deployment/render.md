# Private Render playtest

Updated 2026-09-20. The original invite-gated game is deployed at https://coffee-under-fire.onrender.com/. Managed admin migration is prepared separately and has not yet been deployed. Private repository: https://github.com/joaoh82/coffee-under-fire. Connect this repository and select its main branch in Render. The blueprint describes a paid Node web service; review Render's displayed price before creating it. Blender is not needed on the host.

## Managed administration (new deployment)

Use [the owner-console migration guide](admin.md) for the current configuration: persistent SQLite storage, an owner-only `/admin` console, hashed invite passwords, concurrency limits and durable monthly accounting. The environment-based invite instructions below describe the legacy deployment and initial import only.

## Accounts to create

1. In your Render account, connect the private GitHub repository `joaoh82/coffee-under-fire`.
2. Optionally create a Ko-fi page at https://ko-fi.com. One-time tips on Ko-fi Free have no Ko-fi service fee after opting out of Contributor status; payment processor fees still apply. New accounts start with Contributor status, which adds a 5% fee. Alternative: Buy Me a Coffee, with a 5% platform fee plus processing. Check the providers' current terms.
3. Rotate the Jev API key previously shared in chat. Put the replacement in Render's secret environment settings, never in source, a VITE_ variable, a build argument, or chat.

Sources: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee and https://buymeacoffee.com/faq

## Deploy the prepared blueprint

Use Render's New → Blueprint flow and select the repository/branch containing `render.yaml`.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Node 24, NODE_ENV=production, DECISION_MODE=strict
- One instance. Session state and existing usage budgets are in memory. Do not enable horizontal autoscaling yet.
- Health check: `/healthz`; this is the only unauthenticated diagnostic and returns only `{ "ok": true }`.
- The production server serves `dist/web` and `/api` on Render's `PORT`, bound to all interfaces. No Vite dev server or public backend port is needed.

Required secrets:

| Variable | Value |
| --- | --- |
| TYPESAFE_API_KEY | Newly rotated Jev key |
| PLAYTEST_INVITES | JSON object mapping invite names to unique random passwords |
| PLAYTEST_COOKIE_SECRET | Blueprint-generated random signing secret |

Example SHAPE only (replace the password):

```json
{"alice":"replace-with-a-unique-random-password"}
```

Invite names accept letters, digits, underscores and hyphens, up to 40 characters. Passwords must have 16–256 characters. Use password-manager-generated random passwords, not memorable phrases. Configure 1–100 invites. Share credentials directly with each tester. There is no email delivery or public signup.

The gate uses Render's `RENDER_EXTERNAL_URL`. If attaching a custom domain, set `PUBLIC_ORIGIN` to its exact HTTPS origin (no trailing slash) and direct testers to that domain. An origin mismatch rejects login rather than silently weakening protection.

Production refuses to start without configured invites, a sufficiently long cookie secret, an HTTPS origin, and a Jev key. It also refuses mock mode. No production bypass switch is included; broader public access is a separate intentional change.

## Manage access

Add or remove entries in PLAYTEST_INVITES in Render's Environment settings and deploy the change. Changing an invite's password or deleting its entry invalidates that invite's old signed cookies once the new process is running. Changing PLAYTEST_COOKIE_SECRET signs everyone out. Cookies expire after seven days and are Secure, HttpOnly and SameSite=Strict. Sign out is available at the bottom of the briefing.

Keep the invite JSON private. Passwords are stored in server environment secrets, never returned in API responses or bundled into the client. The game, static assets and all Jev endpoints require a valid invite cookie. Gate checks apply even when someone already possesses a game session token.

Passwords can be shared; this is controlled invitation access, not verified identities, device binding or a hard cap on unique humans. There is no new per-player request allowance or login rate limiter. Existing backend concurrency/session/usage safety budgets remain unchanged and can still pause/reject work; they reset on process restart and are not a durable spending cap. Eight sessions is a configured ceiling, not measured concurrent capacity. A deploy/restart interrupts active missions because game API sessions are not persisted.

## Optional coffee support

The game defaults to `https://ko-fi.com/thepolyglotprogrammer`, also configured in the Render blueprint. Set `VITE_SUPPORT_URL` to override it and rebuild/redeploy. It is intentionally public. Blank or unsupported URLs hide the entire callout.

The link appears at the bottom of the briefing and mission report, never as a gameplay popup. It opens the provider in a separate tab with no embedded payment widget or third-party script. No rewards, upgrades or access are tied to payment. No claim about Jev being cheaper than other models is made without a verified comparison.

Copy: “The general gets the coffee. The developer gets the API bill.” Followed by a short explanation that the game is free, Jev NPC calls cost money, and support is entirely optional.

## Verification before sharing

Run `npm run build` followed by `npm test`. The production HTTP test uses a nonfunctional fixture key and makes no provider calls. It checks unauthenticated denial, real form login, cookie flags, compiled game/JS serving, API session creation, strict production origin checking, and blocked secret paths. Gate tests also cover expiry, forgery, revocation, logout and symlink escapes.

After actual hosting: check HTTPS login/logout, wrong-password handling, direct unauthenticated API denial, asset/audio loading, one complete live mission, a revoked invite, and a small concurrent playtest. Measure real Jev latency and usage there before inviting broadly. The managed-admin hosted acceptance and persistence checks remain outstanding.

References: https://render.com/docs/blueprint-spec and https://render.com/docs/environment-variables
