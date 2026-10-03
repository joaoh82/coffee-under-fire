# Public guest play

Prepared 2026-09-20; updated 2026-10-03 when the Jev integration and its spending limits were removed. Public play is off by default. Anonymous browser IDs are not verified people or accounts. There is no email collection, password/signup requirement, machine fingerprint, or multiplayer. Invited players and the owner console remain available.

## Enable on Render

1. Merge the feature and sync the existing Blueprint, retaining its persistent disk and one service instance. The Blueprint adds `PUBLIC_IP_SOURCE=render` and a generated, stable `PUBLIC_IP_SALT` (32+ characters). Keep this salt secret and stable; rotating it changes network identifiers and effectively resets per-network limits.
2. Set the managed Cloudflare Turnstile widget's allowed hostname to `coffee.yardsort.sh`. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Render Environment. The user reported these keys configured on 2026-09-20; live verification is still required. Neither key is read from chat. The secret never enters the client bundle.
3. Deploy, then visit `/admin`. Under **Public play**, confirm setup is configured, choose **Public guests + invites**, and save. Saving invite-only mode ends active guest games.
4. Test a real Turnstile browser admission in an incognito window, start a game, attempt a second tab with the same cookie, and verify another browser on the same network shares limits. Verify guest access to `/admin` is denied. Check network attribution with a spoofed `X-Forwarded-For` header. No general-purpose proxy header fallback exists.
5. Test the per-network game limit and a service restart before sharing widely. Invites and settings survive restarts. An active mission does not survive a server restart.

## Defaults and enforcement

| Setting | Default |
|---|---:|
| Concurrent games per guest | 1 |
| Concurrent guest games per network | 2 |
| New guest identities per network per UTC day | 4 |
| Guest identity records | Bounded at 10,000 total; no automatic pruning yet |

Network concurrency is editable in admin. The daily new-guest counter resets at midnight UTC. Gameplay makes no paid API calls, so there are no spending limits; the game server only manages sessions, access and the leaderboard. Reaching the guest-record ceiling fails closed; this pilot is not sized for unlimited viral traffic. Admin player statistics show at most 200 rows.

A 10-second browser heartbeat maintains a 90-second game lease. Browser cookies are opaque, HttpOnly and SameSite=Strict (Secure in production), valid for seven days. A guest changing networks must restart the run. IPv4-mapped IPv6 is canonicalized to IPv4; IPv6 addresses share a /64 network allowance to reduce trivial address rotation. Shared Wi-Fi, carrier NAT and VPN exits share limits. Clearing cookies does not clear network limits, but changing both browser and network can evade them.

Only guest sessions use network quotas; known invited players keep owner-managed concurrency. New guest admission also requires a server-verified, single-use Turnstile token with the configured hostname and `guest-play` action. Unavailable verification/configuration fails closed. In-memory admission rate limits bound siteverify calls (60/min globally, 8/min per network, 4 in flight); they reset on restart. Durable guest-creation quotas remain.

## Former spending controls

Until 2026-10-03, every NPC decision was a paid Jev request, and this page described daily dollar caps (total, per guest, per network) backed by SQLite usage reservations. Those caps, the usage reservations and the exhausted-budget screen were removed with the Jev integration; see [local tactics](../decisions/local-tactics.md). Existing databases keep the old `usage` table and any stored cents settings, unread.

## Player experience and privacy

Anonymous visitors see a short **Play as guest** page, with optional invitation login. No registration is required. The page explains the cookie, gameplay records, keyed network identifier and Cloudflare browser check. Raw IPs are not persisted by the game database; a stable server-keyed HMAC represents the canonical network. Infrastructure providers can still process/log IPs. This is pseudonymous operational data, not a claim of complete anonymity.

If a guest's game is refused or ends (closed public play, network limit, changed network or expired session), the game pauses and shows the reason, current score, replay export, a return button, and the existing optional Ko-fi callout. Existing guest/statistics records currently have no retention/deletion UI; keep the bounded pilot scoped appropriately.

## Sources and validation

- [Render public-edge IP guidance](https://render.com/articles/host-pocketbase-on-render): use the overwritten `CF-Connecting-IP` header; do not trust the leftmost XFF value. Render mode requires `RENDER=true`, fails on missing/malformed IP, and must not be used on a directly exposed standalone server. Private-network callers must be trusted operators.
- [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): mandatory verification, single-use tokens, hostname/action validation.

Offline tests use labelled fixture keys and injected verification responses, not live Turnstile. Hosted acceptance is still required after deployment.

Local evidence at release (2026-09-20): production build passed and all 106 offline tests passed; browser fixtures verified the public landing page and owner controls. No live Turnstile success is claimed by these checks.
