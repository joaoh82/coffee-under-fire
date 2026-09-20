# Phase checkpoint — 19 September 2026

This is an implementation checkpoint, not acceptance of every GDD gate. The GDD is unchanged. Work is on `feat/jev-feasibility`.

## Phase 0: live adapter works; capacity/cost gate remains open

The current TypeSafe documentation was read before implementing its HTTP Choice interface. The supplied account key successfully reached Jev. Recorded returned model: `jev-1.13.0`.

| Probe | Provider attempts | Valid results | Provider failures | Locally blocked | Successful-call median / p95 |
|---|---:|---:|---:|---:|---:|
| Initial burst | 8 | 7 | 1 timeout/network deadline | 28 cooldown rejections | 722 / 924 ms |
| Paced follow-up | 24 | 24 | 0 | 0 | 285 / 641 ms |

Raw records: `phase0-live-initial.json`, `phase0-live-paced.json`. The first report's `requests=36` means submissions, not 36 provider calls; 28 were rejected locally. Successful recorded responses report 25,651 input tokens and 3,134 output tokens in total. Usage for the timed-out request is unknown. These totals exclude the separate browser smoke test. Client-side deadline was 1.2 seconds. Measurements were taken on this macOS host; physical network region was not independently verified.

The exposed-target samples chose fire; empty-magazine samples chose reload. The later low-health/lost-target samples inadvertently retained empty magazines and also chose reload. That is a confounded scenario, not evidence about retreat/search quality. The probe generator now resets ammunition for future low-health samples. The saved observations preserve exactly what was tested.

The paced sample projects approximately 4.84 million input tokens for 12 × 1 Hz × 480 seconds plus 120 general decisions. This extrapolation excludes retries and only represents the sampled payloads. Dollar cost is **unknown** pending account-confirmed input/output pricing. No vendor launch price is presented as actual spend.

The recorded live probes used `tactics.v1`. The subsequently refined search objective is labelled `tactics.v2`; movement candidates now optionally describe route and occlusion from last-seen information. It has fixture/build coverage but has not been included in a new quantitative live benchmark.

Go/no-go: **go for further constrained greybox testing; no-go for claiming sustained 12-NPC acceptance or scaling art production**. A short burst and paced snapshot suite do not establish sustained throughput. The cold burst included a deadline miss. Next capacity experiment should ramp 1 → 4 → 8 → 12 actors, measure queue/decision age and strict pause time, and compare lower cadence or fewer engaged NPCs if the target fails. Tactical decisions must remain Jev-owned under every configuration.

## Phase 1: implemented greybox loop; live playability gate remains open

Implemented: fixed-step standalone simulation; WASD/mouse controls; camera; swept projectiles and static cover; HP/ammo/reload/dodge; shared coffee spill cooldown, warmth, pickup/replacement and delivery; finite wave scheduling and spawn telegraphs; five-delivery-plus-survival outcome; pause/restart and hidden-tab pause; Jev scheduling, strict outage screen, inspector and recorded-decision replay.

Validation:
- `npm test`: **26 tests pass**.
- The headless eight-minute test wins with five-plus deliveries using actual movement/interactions and passive, explicitly labelled NPC fixtures. Replay reproduces player state, NPC state, score and delivery count. It does not demonstrate combat balance or a live Jev mission.
- Tests cover ordinary movement retaining volume, shared hit/dodge spill cooldown, duplicate delivery rejection, rejected cups, survival-only failure, deadline victory, frozen pause, objective approaches, spawn cap, swept cover intersection, observation isolation, response legality/identity/expiry, duplicate decision rejection, target death, occupied destinations, ownership/budget/concurrency, cancellation and recovery.
- In-app browser visually rendered the battlefield. A live smoke test progressed into wave 2 and showed `source: jev`, model, confidence and usage for general decisions. Pause was exercised. It was not a complete eight-minute combat playthrough.
- Production build and typecheck pass. Main JavaScript chunk: about 1.25 MB raw / 345 KB gzip. Vite reports a large-chunk warning. This is bundle size, not measured total page-transfer or frame performance.
- Local `.env` is Git-ignored, mode 0600, and the supplied key was checked absent from the built client. No key is written to decision logs.

Known limits: no human feel/balance verdict; no sustained live 12-enemy run; no minimum-laptop or cross-browser FPS profile; rendering does not yet interpolate fixed-step snapshots; navigation stalls re-query Jev but route quality still needs playtesting. The inspector has textual provenance; path/target overlays and full audio/accessibility settings are later work. The server is loopback-only, with bounded process-local budgets, not a production abuse-control deployment. No deployment, multiplayer, campaign or progression was added.

## Blender sample: technical round trip verified; full Phase 2 not accepted

Blender MCP remains disconnected. Blender 5.2.1 LTS runs through the installed Steam executable. The sandboxed background process crashed in Metal initialization before Python execution; the standalone export succeeded outside the sandbox.

Saved original generation script, editable `soldier_sample.blend` and `marker_sample.blend`, GLB exports and marker JSON. `npm run assets:generate` regenerates them; `npm run assets:verify` loads the GLBs through Three.js.

Verified: 96-triangle block character, eight skinned mesh parts, four materials, 1.67 m height with feet near zero, idle/run clips, animated socket attachment, animation crossfade, and four asymmetric marker world transforms matching JSON's Blender-to-game conversion. Browser preview initially exposed white exported materials; explicit shader colors fixed this and the browser showed the corrected palette. This is a pipeline test object, not finished art. Upper/lower-body action blending, full clip roster, faction comparison and gameplay-scale readability still require acceptance. No entire asset set was produced.

## Next concrete step

Obtain account pricing/rate limits, run the ramped sustained `tactics.v2` test, then play a complete greybox mission with live Jev and tune cadence/NPC load against the measured pauses. Keep the technical sample small until those gates pass. No matching Marvin project was available at inspection, so these gaps are reported here rather than assigned to an invented project.

## First playtest feedback pass

See [playtest-01](../decisions/playtest-01.md). Earlier benchmark numbers remain historical tactics.v1 measurements; the new tactics.v3 assault behavior is not covered by those measurements. Thirty automated tests and the production build pass. The dashboard now exposes actual live decisions and failure status. Sustained live reliability remains an acceptance gap.

## Confirmed creative direction

GDD section 12 is now resolved from the user's answers. See [confirmed-direction](../decisions/confirmed-direction.md) for auto-fire, endless mode, initial touch controls, and acceptance gaps. Thirty-five tests and the production build pass. Mobile physical-device compatibility remains unverified; existing Jev budgets still constrain prototype sessions.

## Greybox audio and run progression

See [playtest-04](../decisions/playtest-04.md): synthesized audio cues, bounded XP drops, run-only upgrades, death effects and replay.v2. Forty-one tests and production build pass. Audio listening/mix, progression balance and physical-mobile playtesting remain open. No new provider latency/cost benchmark.

## Playable art sample and full live mission

See [art-pass-report](art-pass-report.md): an original six-clip Blender soldier and kitchen/tent/terrain sample are integrated; one capped eight-minute live Jev mission completed and its recording reproduced the outcome. Applied-decision latency median 270.74ms / p95 606.91ms across 534 decisions, with two recoverable pauses totaling 3.67s. Costs remain unknown. This is synthetic controls evidence, not human balance/feel acceptance or proof of interruption-free service.

## Outpost map art pass

See [map-pass-01](../art/map-pass-01.md). Original editable Blender map replaces the greybox environment while preserving the shared gameplay layout. Final scenery export is about 1.02MB, 12,164 triangles and 15 material batches; 16 markers verified. Forty-one tests and build pass. Brief local FPS inspection is not a sustained performance benchmark.

## Animated NPC art pass

See [npc-pass-01](../art/npc-pass-01.md). Original animated rifleman/general exports replace the remaining NPC greyboxes after loading. General clips follow Jev's existing map/watch/sip/pleased actions. Defeated enemies play a bounded visual-only fall before removal. Editable Blender sources, generation commands, measured manifest and offline crowd preview are included. Forty-four tests, real-GLB validation and production build pass. Brief crowd preview displayed 60 FPS; the short live smoke test had no service errors (16 responses, median 286 ms / p95 712 ms). Sustained crowd combat/mobile performance, final animation polish and costs remain unverified.

## Combat feedback polish

See [playtest-05](../decisions/playtest-05.md): animated-socket muzzle flashes, brighter short trails, exact-contact impact bursts and briefly retained terminal traces; frame-loop audio with stronger player shots and nearby positional enemy fire. Forty-seven tests and build pass. Silent offline firing-range preview is included. Audio listening acceptance, crowded combat/mobile performance and a full polished mission playtest remain open; no new provider benchmark.

## Coffee presentation polish

See [playtest-06](../decisions/playtest-06.md): larger open mug attached to the existing Blender socket, fullness/slosh/steam, position-stable spill splashes, fill/delivery bursts, actual-reward HUD messages and synthesized spill/delivery cues. Coffee mechanics remain unchanged. Fifty-two tests and production build pass; idle/run mug preview inspected. Full live delivery playthrough, audio listening and mobile readability remain unverified; no new Jev benchmark.

## Movement and infantry pressure

See [playtest-07](../decisions/playtest-07.md): smoother visual movement and directional dodge/dust, earlier paired groups, wave caps 10/12/14 and a versioned replay-compatible spawn profile. Full suite of 55 tests plus added fairness regression passed; build passed. Live test reached its 700-request cap at 171.62 simulation seconds, peak 12 infantry, with three recoverable pauses; median 274.89 ms / p95 391.92 ms. Cost unknown. Full eight-minute reliability and fourteen-infantry live load remain unpassed. Battlefield-wear art, additional scenery, infantry variants and tank remain next increments, not delivered in this pass.

## Battered woodland, varied infantry and tank prototype — 2026-09-19

See [playtest-08](../decisions/playtest-08.md). Delivered battlefield-wear scenery on the verified shared layout, three infantry appearances (30 HP unchanged), and a Jev-controlled light tank from wave 4 subject to spawn capacity. Original editable Blender sources, generators, GLBs and marker/geometry checks are retained. Map: 15,566 triangles / 19 material primitives; tank: 1,672 triangles / 10 primitives. Browser previews show mixed infantry and the tank's fixed aim warning; brief 60 FPS fixture samples do not establish sustained combat/mobile performance.

65 tests and the production build pass. Live testing exposed and fixed recovery destination contention, cooldown delay after rejected choices, and replay ordering across repeated recovery epochs at a frozen tick. Strict behavior and backend budgets remain intact; no tactical fallback was introduced.

The final live synthetic-player run completed all eight minutes: victory, 29 deliveries, 371 kills, 100 HP, maximum 14 enemies and one active tank. 3,082 requests / 2,770 applied choices; median latency 273.06 ms, p95 360.26 ms, zero provider errors, two recovered pauses totaling 4.81 seconds including retry waits. Reported usage 2,926,162 input / 249,752 output tokens; monetary cost unknown. Full replay reproduces all applied choices and the outcome. Reports retain the earlier unsuccessful runs separately; this is not a controlled performance comparison or a claim of zero pauses.

Next: human balance/readability feedback, reduce the remaining strict pauses, and polish tank effects/audio before authoring autumn-ravine/ruined-village layouts. Those alternate maps and sustained browser/mobile performance gates remain outstanding.


## Decision scheduling and tank polish — 2026-09-19

See [playtest-09](../decisions/playtest-09.md). Idle NPCs now lead prefetches, early-cancelled actions request fresh Jev choices promptly, and queued results are applied before the starvation check. Strict mode and all backend budgets remain intact. The tank has distance-driven treads, cannon recoil, hull kick, separate bounded fire/smoke/metal destruction and heavier synthesized cues. Its editable Blender source, generator and verified GLB are retained (1,760 triangles / 23 primitives / 145,800 bytes); animated belt clearance and muzzle recoil were checked on the actual export. The offline preview includes sound and destruction controls.

68 tests, production build, export verification and historical replay pass. The new full eight-minute live run also replays all 2,814 choices exactly: victory, 30 deliveries, 375 kills, 100 HP; 3,171 requests, median 265.16 ms / p95 375.94 ms, four provider timeout/network errors. Six recovered pauses totaled 14.45 seconds including retry waits. This is worse than the previous run's two pauses and does not establish a reliability improvement. Reported usage: 2,989,870 input / 255,428 output tokens; monetary cost unknown. Uninterrupted service remains an open gate; no conventional tactical fallback was introduced.

Browser tank effects and controls were inspected; audio listening, sustained combat FPS and physical-mobile validation remain open. Next: human tank feedback, deeper pending-request timing for the remaining pauses, then user-led difficulty tuning and the second scenery. Neither difficulty nor scenery scope was expanded in this increment.


## Illustrated briefing and automatic reconnect — 2026-09-19

See [playtest-10](../decisions/playtest-10.md). Added a generated coffee-mug/helmet logo, illustrated mission/endless radio cards, shorter briefing instructions and the logo in the HUD. Strict starvation now attempts bounded automatic recovery under a small explicit paused notice; persistent failures retain the retry/quit dialog. Provider backoff is preserved across concurrent failures and respected before new recovery batches. Window blur on the initial briefing no longer invalidates an offline session.

74 tests and the production build pass. Historical replay still reproduces 2,814 choices. Browser mode selection and desktop composition were inspected. Recovery checks are synthetic contract fixtures; no new live API latency/cost/reliability benchmark was run, and elimination of interruptions is not claimed. Physical-mobile validation and a live recovery playtest remain open.

## Illustrated mission report — 2026-09-19

See [mission report](../art/mission-report-01.md). The result screen now matches the briefing, with victory/defeat cup artwork, larger score, four illustrated stats and distinct restart/export actions. Production data and scoring/export behavior are preserved. Build passes; desktop victory/defeat and endless labels were inspected in a development-only fixture. No new live API benchmark or full mission playthrough was performed for this presentation change.

## Background music and Jev introduction — 2026-09-19

See [music and Jev callout](../art/music-01.md). Added an original reproducible 40-second instrumental WAV with independent music/effects toggles and gesture-gated, pause-aware looping. The initial briefing prominently explains Jev's NPC tactical role and opens the decision dashboard. 79 tests and production build pass; callout/dashboard inspected in browser. Waveform validation is recorded; listening/mix and physical-mobile playback remain open. No provider integration changes or new live latency/cost measurements.

## Martial music and working weapon toggles — 2026-09-19

See [field march and controls](../art/music-02.md). New original 112 BPM marching loop with snare, bass drum, ostinato and brass-like calls; higher playback level. Fixed ignored checkbox clicks caused by the footer's pointer-event rules by replacing auto-fire/reload with explicit on/off buttons. Browser clicks changed both states and auto-fire consumed ammo without held mouse input. 79 tests and build pass. Music listening/mix feedback remains needed; no new Jev performance benchmark.

## Difficulty presets — 2026-09-19

See [difficulty evidence](../decisions/playtest-11.md). Added Easy/Normal/Hard choices, defaulting the briefing to Easy, with active labels in the HUD/report. Easy reduces population and incoming damage; Normal preserves current behavior; Hard increases pressure inside the existing 14-enemy cap. Versioned difficulty is recorded and replayed, with Normal fallback for old recordings. 84 tests and build pass; historical 2,814-choice replay matches. Browser selection inspected; human balance and full live Easy/Hard playtests remain open. No new provider benchmark.

## Ruined village and tank groups — 2026-09-19

See [playtest-12](../decisions/playtest-12.md). Added a selectable Blender-authored ruined village with independent simulation geometry, matching markers and recorded map selection. New versioned tank balance increases durability and permits spaced later-wave groups with gentler Easy limits. 88 tests and build pass; the historical 2,814-choice replay still matches. The final village export has 10,652 triangles and 11 material batches. Brief live browser startup and three real Jev tank decisions validated integration (251–693 ms provider latency, 3,111 input/303 output tokens, unknown cost). Full live village balance and mobile acceptance remain open; no reliability or sustained-performance improvement is claimed.

## Private deployment preparation and optional support — 2026-09-19

Added a Render blueprint and production server that serves the built game and API behind per-invite passwords. Signed seven-day cookies are Secure/HttpOnly/SameSite=Strict; password changes/removal revoke the corresponding cookie after configuration deploy. Production fails closed on missing credentials, HTTPS origin or Jev key and rejects mock mode. Local development remains unchanged. No new per-player request quota was introduced; existing in-memory backend safety budgets remain.

A quiet optional coffee-support link is ready for briefing and results. It is hidden until an actual Ko-fi/Buy Me a Coffee URL is configured. No payment widget, gameplay perks or unsupported provider price comparison is included.

93 tests pass, including real local HTTP gate and production startup/static-serving checks with a nonfunctional fixture key (no Jev calls). Production build passes with the existing large-bundle warning. Entrance screen visually inspected in a local browser fixture. Render/cloud HTTPS, hosted full mission, concurrency and real donation destination remain unvalidated: no Render account, Git remote or support URL has been connected. See [deployment guide](../deployment/render.md) for setup, access management and explicit limits.
