# Public guest play and daily Jev budget

Prepared 2026-09-20. Public play is off by default. Anonymous browser IDs are not verified people or accounts. There is no email collection, password/signup requirement, machine fingerprint, or multiplayer. Invited players and the owner console remain available.

## Enable on Render

1. Merge the feature and sync the existing Blueprint, retaining its persistent disk and one service instance. The Blueprint adds `PUBLIC_IP_SOURCE=render` and a generated, stable `PUBLIC_IP_SALT` (32+ characters). Keep this salt secret and stable; rotating it changes network identifiers and effectively resets network allowances.
2. Set the managed Cloudflare Turnstile widget's allowed hostname to `coffee.yardsort.sh`. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Render Environment. The user reported these keys configured on 2026-09-20; live verification is still required. Neither key is read from chat. The secret never enters the client bundle.
3. Deploy, then visit `/admin`. Under **Public play and daily spending**, confirm setup is configured, choose **Public guests + invites**, and save. Saving invite-only mode ends active guest games; invited games remain subject to the daily spending limit.
4. Test a real Turnstile browser admission in an incognito window, start a game, attempt a second tab with the same cookie, and verify another browser on the same network shares limits. Verify guest access to `/admin` is denied. Check network attribution with a spoofed `X-Forwarded-For` header. No general-purpose proxy header fallback exists.
5. Test a small daily limit, the exhausted screen, and a service restart before sharing widely. Restore the intended $2 limit. Invites/settings, unknown reservations and daily usage survive restarts. An active mission does not survive a server restart.

## Defaults and enforcement

| Setting | Default |
|---|---:|
| Daily total, including invited players | $2 |
| Daily per guest browser | $0.25 |
| Daily per guest network | $0.50 |
| Concurrent games per guest | 1 |
| Concurrent guest games per network | 2 |
| New guest identities per network per UTC day | 4 |
| Global game capacity | Existing 8-game ceiling (not measured public capacity) |
| Guest identity records | Bounded at 10,000 total; no automatic pruning yet |

Dollar limits and network concurrency are editable in admin. Zero dollars pauses new Jev spending. Limits reserve a 5% safety margin: a configured $2 daily total admits reservations up to $1.90. All daily counters reset at midnight UTC; changing settings or creating new sessions does not reset counters. The monthly token ceiling and existing per-run/request limits also remain enforced. Reaching the guest-record ceiling fails closed; this bounded pilot is not sized for unlimited viral traffic. Admin player statistics show at most 200 rows.

A 10-second browser heartbeat maintains a 90-second game lease. Browser cookies are opaque, HttpOnly and SameSite=Strict (Secure in production), valid for seven days. A guest changing networks must restart the run. IPv4-mapped IPv6 is canonicalized to IPv4; IPv6 addresses share a /64 network allowance to reduce trivial address rotation. Shared Wi-Fi, carrier NAT and VPN exits share allowances. Clearing cookies does not clear the network budget, but changing both browser and network can evade individual quotas. The global budget remains shared.

Only guest sessions use network quotas; known invited players keep owner-managed concurrency. All players consume the same daily total, with no owner gameplay bypass. New guest admission also requires a server-verified, single-use Turnstile token with the configured hostname and `guest-play` action. Unavailable verification/configuration fails closed. In-memory admission rate limits bound siteverify calls (60/min globally, 8/min per network, 4 in flight); they reset on restart. Durable guest-creation quotas remain.

## Spending accuracy

Before calling Jev, SQLite transactionally reserves the pessimistic request-byte allowance at the configured input price. The reservation participates in global, guest and network daily checks, including other in-flight calls. Money is stored as integer nanodollars, rounding input price upward; `JEV_INPUT_USD_PER_MILLION` defaults to $0.042. Reservations retain the price and UTC day of admission, so later price changes or midnight settlement do not move historical charges. Successful reported usage settles once; unknown/failed/cancelled usage retains its reservation across crashes.

This is an application spending guard, **not a provider-enforced invoice guarantee**. Token estimates are not a provider-certified upper bound, current prices may change, unknown calls may be billed differently, and calls made using the same key outside this service are invisible. Hosting/donation fees are excluded. Use a provider account spending limit as an additional control if TypeSafe offers one; availability has not been verified. Donations do not automatically increase budgets or unlock access.

Old monthly usage lacks precise dates. On first migration, legacy current-month records are conservatively counted against migration day; prior-month records remain outside today's bucket. Existing current-month usage may therefore pause play on migration day. Review this in the admin rather than silently discarding charges. No counters are wiped.

## Player experience and privacy

Anonymous visitors see a short **Play as guest** page, with optional invitation login. No registration is required. The page explains the cookie, gameplay/usage records, keyed network identifier and Cloudflare browser check. Raw IPs are not persisted by the game database; a stable server-keyed HMAC represents the canonical network. Infrastructure providers can still process/log IPs. This is pseudonymous operational data, not a claim of complete anonymity.

When a daily allowance runs out, the game pauses, stops retries and presents a countdown to midnight UTC, current score, replay export, a return button, and the existing optional Ko-fi callout. New visitors see the exhausted message before a challenge. No fallback tactical AI runs. Existing guest/statistics records currently have no retention/deletion UI; keep the bounded pilot scoped appropriately.

## Sources and validation

- [Render public-edge IP guidance](https://render.com/articles/host-pocketbase-on-render): use the overwritten `CF-Connecting-IP` header; do not trust the leftmost XFF value. Render mode requires `RENDER=true`, fails on missing/malformed IP, and must not be used on a directly exposed standalone server. Private-network callers must be trusted operators.
- [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): mandatory verification, single-use tokens, hostname/action validation.
- [Gameplay cost estimate](../gameplay-cost-estimate.md): $2 funds approximately 8–10 ten-minute sessions at the current planning estimate, before the safety margin.

Offline tests use labelled fixture keys and injected verification responses, not live Turnstile or fabricated Jev outcomes. Hosted acceptance is still required after deployment.

Local evidence: production build passed and all 106 offline tests passed on 2026-09-20. Browser fixtures verified the exhausted public landing page and saving owner budget controls. A follow-up read-only review found no remaining blockers. No live Jev calls or live Turnstile success are claimed by these checks.
