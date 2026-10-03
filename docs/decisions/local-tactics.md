# Local tactics replace Jev — 2026-10-03

The Jev integration made the game unplayable in practice: frequent "Reconnecting to Jev" freezes. NPC decisions now come from a local utility scorer in the browser. The concept is preserved in history at the local tag `jev-concept` (commit `0d92425`, not pushed).

## Why

- **Freezes were built into strict mode.** About 6.6 requests/second went to a remote API during play, each with a 1,200 ms hard timeout and a 1-second freshness limit. Any NPC without a valid action for 1.5 seconds froze the whole game for recovery, and there was deliberately no local fallback. The best recorded scripted runs still paused 2–9 times per mission (playtest-08/09).
- **Running cost.** Each 10-minute session cost an estimated $0.16–0.25 in inference. This required invite gating, per-session and monthly token budgets, and daily dollar caps for the whole server, each guest and each network.
- **Jev chose from a menu the game already built.** Perception, candidate enumeration, legality, pathfinding and combat were already local. Replacing the chooser was a small change.

## What changed

- New `apps/web/src/game/tactics.ts`: deterministic per-archetype utility scoring over the existing legal candidates, with fire discipline per difficulty (easy 0.35, normal 0.4, hard 0.55). See [How enemy tactics work](../npc-tactics.md).
- Removed: the server Jev adapter and decision pipeline (`/api/decision`, `/api/invalidate`), strict mode, the starvation freeze, the reconnect UI, and the automatic recovery logic in the driver.
- Removed: token and dollar budgets. That covers the monthly input-token limit, the daily total/guest/network caps, and the admin cost columns and charts. The admin console no longer reads usage reservations.
- Removed: the Jev-only scripts `spike`, `live-mission`, `probe-village-tanks` and `verify-mission`, plus their npm entries. `TYPESAFE_API_KEY`, `JEV_MODEL`, `DECISION_MODE`, `JEV_INPUT_USD_PER_MILLION` and `MONTHLY_INPUT_TOKEN_LIMIT` are no longer read.
- Leaderboard submissions no longer require a recorded Jev usage row; ownership, network binding, category and timing checks remain.
- The development "mock" mode is now `scripted`, a harness for tests and previews that apply decisions themselves. Decision sources are `local`, `scripted` and `replay`.

## What was kept

Invite and guest accounts, Turnstile admission, guest creation limits, session leases and heartbeats, per-invite and per-network concurrency, public/invite-only access mode, the leaderboard and moderation, the owner console and activity analytics, and recorded-decision replay.

## Data compatibility

- The production SQLite `usage` table is left in place but no longer written or read. Nothing is dropped.
- Existing `public_settings` rows that still contain `dailyCents`, `guestCents` or `ipCents` are tolerated; only `publicEnabled` and `ipConcurrent` are read and saved.
- Replays recorded before this change still apply, because replay overrides each recorded decision's source. Cross-build compatibility was never promised.

## Evidence

- Automated tests cover candidate legality, determinism, rifleman firing and reloading, searching without contact, marksman retreat, a three-minute local run with no NPC idle for more than 3 ticks, and exact replay.
- A headless copy of the old scripted benchmark player, run against local tactics for 8-minute missions on three seeds per map:
  - **Easy:** won every run at full health.
  - **Normal and hard:** mixed, with losses mostly around waves 3–4.
  - These bot results are noisy. Before tuning, enemies took about 85% of available shots and were much deadlier; fire discipline was added for that reason.
- A driver smoke test against a keyless development server started a session in local mode, applied every decision, and made no decision API calls.
- A headless Chromium run of the development build started a mission, paused and resumed it, and opened the tactics dashboard. It applied 7–22 local decisions with none rejected, made no `/api/decision` calls and logged no game errors. The page needed focus emulation for `requestAnimationFrame` to run.

## Open

Human playtesting must confirm difficulty; adjust `fireDiscipline` in `difficulty.ts` first. Dated records under `docs/decisions/` and `docs/benchmarks/` from before this change describe the Jev era and remain as history.
