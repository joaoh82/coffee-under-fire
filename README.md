# Coffee Under Fire

A React + Three.js greybox of the GDD's coffee-delivery arena shooter. Every live NPC action comes from a Jev Choice; deterministic TypeScript executes the action. Read COFFEE_UNDER_FIRE_GDD.md for the design.

## Run locally

Requires Node 24+. Install with `npm ci`. Copy `.env.example` to `.env` only if a local environment file does not already exist, and supply TYPESAFE_API_KEY. Never prefix it with VITE_.

```
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:5173. Server binds loopback port 8787; 3000 is reserved. WASD move, mouse aim/shoot, R reload, E hold to collect/deliver, Space dodge, Escape pause. The first patrol is telegraphed at five seconds and arrives at six. Five deliveries alone do not end the finite mission: survive eight minutes. Endless mode is also available.

Strict mode is the default. Missing/failed Jev decisions cause idle holds, then a global reconnect pause. The client makes up to two automatic recovery attempts per interruption (at most four per minute), respecting backoff and keeping gameplay frozen; persistent failures offer manual retry or quit. Every attempt requests fresh observations. Development fixtures require DECISION_MODE=mock in the server environment and show a persistent mock banner. They do not validate Jev.

## Feasibility probe

```
npm run spike                 # offline fixtures, labelled
npm run spike -- --live       # max 36 billable requests, no automatic retries
```

Reports under docs/benchmarks separate fixtures from live data. Pricing is unknown unless JEV_INPUT_USD_PER_MILLION and JEV_OUTPUT_USD_PER_MILLION are configured with account-confirmed rates. A burst probe is not sustained capacity acceptance.

## Architecture

- packages/shared: versioned validation contracts
- apps/server: trusted questions, Jev adapter, capability sessions and budgets
- apps/web/src/game: fixed-step simulation, perception, candidate enumeration, collision/navigation, scheduling and recorded-decision replay
- apps/web/src/render: Three.js scene; transforms updated directly
- tests: mechanics, legality and failure fixtures

The decision inspector exports seed, player inputs and applied decisions. `replay(recording)` replays them headlessly within this build; records are not promised compatible across builds. Shared map layout lives in `packages/shared/map-layout.json`; Blender scenery and verified markers use those same coordinates.

This is a development prototype configured for temporary LAN/tunnel playtesting, not a production deployment. See the phase reports for measured evidence and unpassed acceptance gates.

## Share a playtest

`npm run dev` listens on all interfaces at port 5173 and accepts any hostname, as requested for temporary tunnel sharing. On the same network, open `http://192.168.1.89:5173` (the machine's current LAN address; it may change). Point Rustunnel at `http://127.0.0.1:5173` and share its generated URL.

The frontend proxies `/api` to the loopback-only backend on 8787, preserving the incoming Host. Browser API requests accept matching LAN/tunnel origins, including HTTPS tunnels; unrelated origins remain rejected. Keep the original tunnel Host header. Only port 5173 needs to be tunneled. The Jev key stays server-side, and existing session/request budgets still apply to testers. Vite's unrestricted-host setting is intentional for this temporary development setup.

Verified locally: LAN page and arbitrary-host page/API requests succeed, test session creation/cleanup succeeds, unrelated origins and direct `.env` requests are denied. 49 tests and production build pass. The actual Rustunnel URL has not been tested here.

## Blender technical sample

```
npm run assets:generate
npm run assets:verify
```

The generator uses the locally discovered Steam Blender executable. Set `BLENDER_BIN` to override its path. It runs in a separate background Blender process and creates named sample scenes. Editable sources are under `assets/blender`; runtime exports are under `apps/web/public/assets/models`. Visit http://127.0.0.1:5173/asset-preview for the idle/run crossfade. `assets/manifest.json` records measured geometry, bounds and clips. The sample is deliberately blocky; it is not the final character set.

[Phase checkpoint](docs/benchmarks/phase-report.md) distinguishes verified work from unpassed live, playtest and asset gates.

## Playable art exports

The current mission uses the Blender player, three rifleman appearances, general, later-wave light tank, landmarks and battered outpost map. The commands above retain the original technical sample. To rebuild the playable assets:

```sh
npm run assets:slice
npm run assets:npcs
npm run assets:map
npm run assets:tank
npm run assets:slice:verify
npm run assets:npcs:verify
npm run assets:map:verify
npm run assets:tank:verify
```

`/asset-preview` includes character/clip selectors, map inspection and a labelled 13-character animation fixture with an FPS readout. No Jev calls occur in that preview. See [NPC pass evidence](docs/art/npc-pass-01.md) for sources, measured asset budgets and validation limits.

## Battlefield playtest

Infantry arrive in larger groups early (30 HP unchanged). From wave 4 the director can replace one spawn with a light tank, within the shared 14-enemy cap and one-tank maximum. Dodge away from its fixed orange aiming line; cover blocks the shell. `/asset-preview` → **Preview tank effects** includes a labelled offline loop for moving treads, cannon recoil and destruction, with **Enable tank sound** and **Destroy preview tank** controls. It makes no Jev calls. See [scheduling and tank polish](docs/decisions/playtest-09.md) for verification and live measurements.

`npm run measure:mission -- unique-report-label 3000` runs a bounded synthetic-player mission against the local live Jev server and writes telemetry plus recorded decisions. It spends real API requests, hard-limits outbound decisions to the supplied budget, and never substitutes tactical AI. Use a unique label to preserve prior runs. See [battlefield evidence](docs/decisions/playtest-08.md) for results and limitations.

Latest live gate: the full eight-minute synthetic-player run completed with 14 enemies observed, 3,082 Jev requests, and two recovered pauses. All 2,770 applied choices replayed successfully. This is separate from human balance and sustained rendered-FPS testing. Verify locally with `npm run measure:replay:verify -- battlefield-final-pass` (no API calls).

The illustrated briefing and HUD use the project logo in `apps/web/public/assets/brand/coffee-under-fire-logo-v1.png`. See [briefing art and recovery evidence](docs/decisions/playtest-10.md) and [logo prompt/provenance](docs/art/briefing-logo-01.md).

Background music is an original synthesized instrumental with a separate **Music** toggle on the briefing and HUD. Rebuild the loop with `npm run assets:music`; see [composition and playback notes](docs/art/music-01.md). The briefing's **NPCs powered by Jev** callout opens the live decision dashboard.

Choose **Easy**, **Normal** or **Hard** in the briefing for either game mode. Easy is preselected and reduces enemy numbers and incoming damage; Normal retains the previous balance; Hard sends larger groups sooner. Tanks can arrive from **wave 4 (about three minutes)**, independently of XP level. Difficulty is recorded with decision replays; see [preset details](docs/decisions/playtest-11.md).

## Battlefields and tank balance

Choose **Little Outpost** or **Ruined Village** in the briefing. Both maps use their own shared layout for rendered cover, collision, perception and navigation. Replay records the selected map and armor profile; older records default to woodland and retain historical tank behavior. New tanks have 150/200/240 health on Easy/Normal/Hard, with spaced multi-tank groups in later waves. See `docs/decisions/playtest-12.md` for quotas and validation limits.

Generate and verify the editable village and runtime export:

```
npm run assets:village
npm run assets:village:verify
```

`/asset-preview` has a Ruined Village inspection button and makes no Jev calls. `node --import tsx scripts/probe-village-tanks.ts` is an explicitly live, three-request tank integration probe against the running strict backend.

## Private Render deployment

`render.yaml` prepares a single production Node service serving the built game and API behind per-invite passwords. See [setup and access management](docs/deployment/render.md). Production requires invite secrets and a strict Jev key; local `npm run dev` remains unchanged. No new per-player request quota was added; existing backend safety budgets remain.

Optional support: set `VITE_SUPPORT_URL` to your actual Ko-fi or Buy Me a Coffee page and rebuild. Blank hides the callout. Donations are entirely optional and only appear on the briefing and mission report.
