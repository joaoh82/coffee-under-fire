# Battered woodland, infantry variation and light tank — 2026-09-19

## Delivered

- Woodland outpost: muted earth, irregular ground facets, shallow shell scars, churned tracks, tread marks, flat splinters, torn sandbag seams, damaged crate surfaces, snapped trees, fallen timber and broken boundary fencing. The 44 × 36 map, six gameplay colliders and coffee routes remain shared with Blender through `map-layout.json`. Scars/ruts are cosmetic ground treatment, not impassable pits. Tall new dressing sits outside movement bounds.
- Three original rifleman appearances: helmet/bedroll, soft cap/goggles/light satchel, and patched helmet/shoulder blanket/extra pouches. Runtime selection hashes the actor ID without consuming simulation randomness. They all remain the same Jev rifleman role with 30 HP and unchanged weapon damage.
- Original light-tank prototype: 90 HP, radius 1.2 m, speed 1.4 m/s, one active tank maximum. Starting with wave 4, the wave director attempts one tank arrival per wave when a slot is available; it replaces an infantry slot inside the total cap of 14. Its spawn warning lasts two seconds. Player proximity can cancel the arrival; no backlog bypasses the population cap.
- Tank decisions use Jev's same complete-candidate Choice pipeline. Legal choices are hold, reachable move destinations, reload and a cannon shot at a copied visible target position. No hidden player position is supplied. Shot selection locks aim, warns for 1.2 simulation seconds, and emits one visible straight shell at 9 m/s with 16 damage. The action lasts 1.8 seconds, uses ammunition and never homes or chooses a follow-up tactic. Cover blocks it. Nonlethal hits flash the tank but do not cancel its selected action; defeat/pause invalidate it. There is no area damage or infantry health increase.
- `coffee.v2` contracts / `tactics.v4` prompts identify the new role and cannon candidate. The server validates that cannon aim matches the visible observation. Candidate generation excludes occupied and reserved destinations. Actor-radius-aware navigation and collision keep the wide hull out of narrow cover gaps.
- Recordings include `combatProfile: armor.v1`; missing metadata selects `infantry.v1`, preserving older recordings. Recorded decision execution remains separate from rendering.
- Tank model hull/turret transforms, health/hit flash, muzzle flash and a fixed aim-line/reticle are implemented in the renderer. Editable Blender source and generator are included. This tank uses runtime transforms rather than skeletal animation clips.
- Labelled `Preview tank cannon` fixture in `/asset-preview` uses scripted mock choices and makes no Jev requests. `Preview 12 enemies` shows the three infantry appearances.

## Recovery issue found by the live test

The initial live attempt (`live-mission-battlefield-pass.json`) stopped after 105.92 simulation seconds with five unsuccessful recovery attempts. It sent 392 requests, applied 351 choices, rejected 13, reported zero provider errors, and never reached tank waves. Median sampled returned-response latency was 269.22 ms / p95 463.40 ms; reported usage 370,660 input / 32,180 output tokens. Dollar cost is unknown. The original report is retained unchanged; its row collector missed the final recovery batch, so those latency samples do not represent every response in its totals.

Repeated rejected `advance_contact` choices revealed a game-side reservation conflict: concurrent NPCs could request the same destination, while recovery reset all accepted actions and repeated the conflict. Recovery now retains accepted actions with simulation time frozen and re-queries only unresolved NPCs, up to four bounded passes. Already reserved destinations are removed as illegal. Provider errors are not automatically retried by those contention passes. No replacement local tactic is assigned. A regression reproduces two conflicting model choices and verifies three requests resolve them while retaining the first accepted action.

The live harness accepts an explicit request budget (default remains 700, maximum 6000); outbound requests are hard-bounded, including recovery. It collects final terminal trace rows, tracks peak infantry/tanks, and counts observed tank shots. Use a new report label to preserve previous evidence:

```sh
npm run measure:mission -- unique-report-label 3000
```

## Verification so far

- 65 automated tests pass; production build passes. Tank tests cover observation isolation, role/aim validation, fixed warning/shot timing, one-shot execution, dodge escape, damage, interruption, radius clearance, wave/cap limits and old replay compatibility.
- Historical full live recording reproduces victory at 480 seconds, 25 deliveries, 72 kills, 100 HP. The earlier pressure recording reproduces 171.62 seconds, nine deliveries, 78 kills, 100 HP.
- Actual exported GLB checks: map 15,566 triangles / 19 material primitives / 1,273,192 bytes, all 16 markers match. Rifleman variants 1,100 / 1,124 / 1,276 triangles with six verified animated clips each. Tank 1,672 triangles / 10 primitives / 130,784 bytes; hull fits its collision radius and forward muzzle socket verifies. `.blend` sources exist for each model.
- Browser inspected the full map, mixed infantry animation fixture and tank's warning line/reticle. Brief fixture samples displayed 60 FPS. This is not a sustained full-combat or mobile performance measurement. Audio listening remains unverified; the existing development hot-reload AudioContext double-close error was fixed with idempotent cleanup.

Full live rerun results are recorded below when available. Remaining art work: denser composition/polish, richer tank motion/impact/audio and the separate autumn-ravine/ruined-village layouts. Those alternate environments are not delivered by this increment. Difficulty feel still requires human playtesting; a scripted player with automatic target selection is not a measure of typical player skill.

Provider contract rechecked against current [TypeSafe Choice documentation](https://docs.typesafe.ai/primitives/choice) and [quickstart](https://docs.typesafe.ai/introduction/quickstart). The adapter still uses one Choice over complete candidates, via the documented System One endpoint; it does not use an alternate chat model or infer provider quotas/prices. Request/token/concurrency safeguards remain application-owned.

## Extended live run and scheduler follow-up

`live-mission-battlefield-recovery-pass.json` reached 463.05 simulation seconds (7:43) / 488.02 wall seconds, then stopped at the application test cap of exactly 3,000 outbound requests. Peak 14 infantry / 14 total enemies and one active tank; six actual tank shots, 28 deliveries, 356 kills, 100 HP. 2,676 applied choices; 51 rejections (47 illegal, two stale, two missing/dead); four provider timeout/network errors. All nine strict pauses recovered, totaling 23.75 seconds including harness retry waits. No failed recovery retries. Median returned-response latency 271.65 ms / p95 386.35 ms over 2,730 Jev responses. Reported usage 2,837,771 input / 242,794 output tokens; dollar cost unknown. The run did not finish eight minutes and is not presented as a completed mission.

The 47 legality rejections also exposed an avoidable scheduler delay: a rejected choice retained the normal one-second request cooldown even when the NPC had no action. Illegal/stale rejections now make only that NPC immediately eligible for a fresh model request when capacity is available. There is no automatic tactical substitute or bypass of backend budgets/concurrency; a targeted regression verifies this. The final full-length attempt uses a hard 4,000-request cap and a separate artifact label.


Replay audit found an existing ordering edge case exposed by repeated recoveries at a frozen tick. Replaying all invalidation epochs before that tick's choices skipped choices from earlier epochs; terminal checkpoint choices were also left unapplied. Replay now interleaves epochs with choices in epoch order and applies terminal checkpoint events. Rejected recorded choices fail verification explicitly. A regression covers multiple recoveries at one tick and the terminal checkpoint. All four previous live recordings now reproduce every applied choice as well as their outcomes (534, 618, 351 and 2,676 choices respectively). This replay-only fix does not alter the ongoing live simulation.

Reproduce report/replay verification without API calls:

```sh
npm run measure:replay:verify -- battlefield-recovery-pass
```

## Completed eight-minute live gate

Final report: `docs/benchmarks/live-mission-battlefield-final-pass.json`; decisions/input recording: `live-mission-battlefield-final-pass-replay.json`; offline verification: `live-mission-battlefield-final-pass-verification.json`.

- Won at exactly 480 simulation seconds / 485.40 wall seconds with a scripted player, 29 deliveries, 371 kills, 100 HP. No invulnerability or combat-rule override.
- 3,082 outbound requests against the 4,000 cap; 2,770 applied Jev choices, 50 rejected choices, zero provider errors. Two strict pauses recovered, totaling 4.81 seconds including the harness retry waits; zero failed recovery attempts. This is one successful live run, not a guarantee of interruption-free play or a controlled comparison against the earlier runs.
- Observed maximum 14 infantry / 14 total enemies and one active tank. One observed tank shot in this run; the previous 7:43 run recorded six. Tanks are not guaranteed to fire before the scripted player defeats them; this remains a balance/feel question for human playtesting.
- Median returned Jev response latency 273.06 ms, p95 360.26 ms. Reported input usage 2,926,162 tokens / output 249,752 tokens. Dollar cost remains unknown.
- Offline replay reproduces all 2,770 applied choices and the exact reported time, kills, deliveries and health, with victory. No API calls were used by replay verification.

Across the three named live harness attempts in this increment, 6,474 decision requests were sent, with 6,134,593 reported input / 524,726 output tokens. These figures exclude the brief separate browser smoke test and cannot account for any provider billing on cancelled responses without returned usage. No provider quota or account pricing is inferred from our application caps.

Next concrete step: human playtest the earlier infantry pressure and tank warnings, then tune cannon/impact/audio presentation and investigate the remaining short strict pauses before adding alternate layouts. Sustained rendered-combat FPS, physical mobile testing, tank polish and separate scenery variants remain unpassed/not delivered.
