# Private Render playtest

Updated 2026-09-20. The original invite-gated game is deployed at https://coffee-under-fire.onrender.com/. Managed admin migration is prepared separately and has not yet been deployed. Private repository: https://github.com/joaoh82/coffee-under-fire. Connect this repository and select its main branch in Render. The blueprint describes a paid Node web service; review Render's displayed price before creating it. Blender is not needed on the host.

## Managed administration (new deployment)

Use [the owner-console migration guide](admin.md) for the current configuration: persistent SQLite storage, an owner-only `/admin` console, hashed invite passwords and concurrency limits. The environment-based invite instructions below describe the legacy deployment and initial import only.

## Accounts to create

1. In your Render account, connect the private GitHub repository `joaoh82/coffee-under-fire`.
2. Optionally create a Ko-fi page at https://ko-fi.com. One-time tips on Ko-fi Free have no Ko-fi service fee after opting out of Contributor status; payment processor fees still apply. New accounts start with Contributor status, which adds a 5% fee. Alternative: Buy Me a Coffee, with a 5% platform fee plus processing. Check the providers' current terms.
3. No AI provider key is needed. Enemy tactics run locally in the browser (since 2026-10-03). If an old `TYPESAFE_API_KEY` remains in Render's environment, delete it and revoke the key with the provider.

Sources: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee and https://buymeacoffee.com/faq

## Deploy the prepared blueprint

Use Render's New → Blueprint flow and select the repository/branch containing `render.yaml`.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Node 24, NODE_ENV=production
- One instance. Login throttling and admin tokens are in memory, and the SQLite database is single-process. Do not enable horizontal autoscaling yet.
- Health check: `/healthz`; this is the only unauthenticated diagnostic and returns only `{ "ok": true }`.
- The production server serves `dist/web` and `/api` on Render's `PORT`, bound to all interfaces. No Vite dev server or public backend port is needed.

Required secrets:

| Variable | Value |
| --- | --- |
| PLAYTEST_INVITES | JSON object mapping invite names to unique random passwords |
| PLAYTEST_COOKIE_SECRET | Blueprint-generated random signing secret |

Example SHAPE only (replace the password):

```json
{"alice":"replace-with-a-unique-random-password"}
```

Invite names accept letters, digits, underscores and hyphens, up to 40 characters. Passwords must have 16–256 characters. Use password-manager-generated random passwords, not memorable phrases. Configure 1–100 invites. Share credentials directly with each tester. There is no email delivery or public signup.

The gate uses Render's `RENDER_EXTERNAL_URL`. If attaching a custom domain, set `PUBLIC_ORIGIN` to its exact HTTPS origin (no trailing slash) and direct testers to that domain. An origin mismatch rejects login rather than silently weakening protection.

Production refuses to start without configured invites, a sufficiently long cookie secret, and an HTTPS origin. No production bypass switch is included; broader public access is a separate intentional change.

## Manage access

Add or remove entries in PLAYTEST_INVITES in Render's Environment settings and deploy the change. Changing an invite's password or deleting its entry invalidates that invite's old signed cookies once the new process is running. Changing PLAYTEST_COOKIE_SECRET signs everyone out. Cookies expire after seven days and are Secure, HttpOnly and SameSite=Strict. Sign out is available at the bottom of the briefing.

Keep the invite JSON private. Passwords are stored in server environment secrets, never returned in API responses or bundled into the client. The game, static assets and all game API endpoints require a valid invite cookie. Gate checks apply even when someone already possesses a game session token.

Passwords can be shared; this is controlled invitation access, not verified identities, device binding or a hard cap on unique humans. There is no login rate limiter in this legacy gate. Gameplay makes no paid API calls, so there is no per-player spending allowance. A deploy/restart interrupts active missions because game sessions are not persisted in this mode.

## Optional coffee support

The game defaults to `https://ko-fi.com/thepolyglotprogrammer`, also configured in the Render blueprint. Set `VITE_SUPPORT_URL` to override it and rebuild/redeploy. It is intentionally public. Blank or unsupported URLs hide the entire callout.

The link appears at the bottom of the briefing and mission report, never as a gameplay popup. It opens the provider in a separate tab with no embedded payment widget or third-party script. No rewards, upgrades or access are tied to payment.

Copy: “The general gets the coffee. The developer gets the server bill.” Followed by a short note that the game is free with no ads and support is entirely optional.

## Verification before sharing

Run `npm run build` followed by `npm test`. The production HTTP test checks unauthenticated denial, real form login, cookie flags, compiled game/JS serving, API session creation, strict production origin checking, and blocked secret paths. Gate tests also cover expiry, forgery, revocation, logout and symlink escapes.

After actual hosting: check HTTPS login/logout, wrong-password handling, direct unauthenticated API denial, asset/audio loading, one complete mission, a revoked invite, and a small concurrent playtest. The managed-admin hosted acceptance and persistence checks remain outstanding.

References: https://render.com/docs/blueprint-spec and https://render.com/docs/environment-variables
