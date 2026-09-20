# Decision scheduling and tank presentation — 2026-09-19

## Scope

User approved reducing the remaining Jev pauses and polishing tank motion/effects/audio. Difficulty tuning and a second scenery are deferred. Tactical candidates, backend budgets, the strict 90-tick starvation threshold, damage, HP and wave pressure are unchanged.

## Changes

- The two previous completed-run pauses followed cancelled movement actions. A blocked/completed move or early-ended fire action now becomes immediately eligible for a fresh Jev request instead of retaining its normal request cooldown. Idle actors are scheduled before actors that can continue executing their current choice; the oldest idle wait gets priority. Ready queued choices are consumed before each simulation tick's starvation check. No tactical fallback or continuation beyond an expired choice is added.
- A bounded starvation snapshot records which NPCs were waiting, their wait duration, request eligibility and last choice. The live harness retains at most 30 snapshots for diagnosis.
- The editable Blender tank now exports twelve separate tread links and a cannon group. Runtime belts follow actual rendered travel and hull turns; the cannon recoils after a real shot and returns over 24 simulation ticks. Hull kick and a tilted defeated turret add visual weight. Physics and aim remain separate.
- Tank death emits a separate, world-positioned fire/smoke cloud, metal fragments and an expanding ground ring. At most eight bursts survive for 96 simulation ticks. Pause freezes them; repeated damage to a defeated actor cannot duplicate the burst. Infantry effects stay separate.
- Synthesized cannon and tank-destruction cues use longer low-frequency sweeps and filtered noise, with existing gesture unlock, mute, distance/pan, limiter and 16-voice budget. Heavy events are prioritized within each frame's eight-event playback cap. These remain original placeholder synth sounds; no final audio listening/mix acceptance is claimed.
- `/asset-preview` → **Preview tank effects** runs a clearly labelled twelve-second offline mock loop for movement, cannon and destruction. **Enable tank sound** and **Destroy preview tank** allow manual checking without Jev calls.

## Verification

- 68 automated tests pass, including immediate scheduling after blocked movement, waiting-before-prefetch fairness, applying a queued choice before starvation, one tank-death event, copied effect origins, bounded bursts, pause and expiry. Production build passes; the existing large-bundle warning remains.
- Actual GLB validation: 145,800 bytes, 1,760 triangles, 23 mesh primitives. Hull bounds fit the unchanged 1.2 m radius; named hull/turret/cannon/twelve tread nodes and forward muzzle socket verify. Thirty-three sampled tread phases stay above ground and inside that radius; the actual exported muzzle retreats 0.2 m with recoil and returns at tick 24. Reproduce from the editable source with `npm run assets:tank`, then `npm run assets:tank:verify`.
- Browser inspected the tank fixture, aiming warning, destruction smoke/fragments/ring and sound toggle. A brief preview displayed 60 FPS; this is not sustained gameplay/mobile performance evidence. Audio output was enabled, but listening quality remains unverified.
- Historical full-mission recording still reproduces all 2,770 applied choices and its result after the scheduling changes.

## Live measurement

Report: `docs/benchmarks/live-mission-responsiveness-tank-pass.json`; recording and verification use the same prefix with `-replay.json` and `-verification.json`.

- Completed 480 simulation seconds / 495.13 wall seconds with victory, 30 deliveries, 375 kills and 100 HP. Scripted human controls, real Jev NPC choices, unchanged combat rules; this is not a human balance playtest.
- 3,171 outbound requests within the hard 4,000 cap. 2,814 applied choices, 66 rejections (62 illegal, four stale), four provider timeout/network errors. Peak 14 enemies / one active tank; three observed cannon shots.
- Six recovered strict pauses, totaling 14.45 seconds including harness retry waits; zero failed recovery attempts. The previous complete run had two pauses / 4.81 seconds and no provider errors. **This run does not demonstrate an overall pause reduction.** Different service conditions and nondeterministic decisions prevent treating the two runs as a controlled comparison. The first two new pauses preceded the logged provider errors, so provider faults alone do not explain all remaining starvation.
- Returned-response latency median 265.16 ms / p95 375.94 ms. Reported usage: 2,989,870 input tokens / 255,428 output tokens. Monetary cost unknown; cancelled calls without usage cannot be fully accounted for here. Application request caps are not asserted to be provider account quotas.
- Offline replay reproduces all 2,814 applied choices and the exact reported outcome, time, health, deliveries and kills without API calls.

The scheduling corrections are regression-tested and retained, but the uninterrupted-service gate remains open. More inference runs were not launched simply to obtain a better result. Future diagnosis should capture pending-request timing alongside the new starvation snapshots and distinguish latency tails, destination contention and service backoff.

## Next gate

Human playtest the tank's warning, recoil and effects, then consider difficulty tuning based on feedback before building the second scenery. Keep the remaining service, audio listening and physical-mobile limitations explicit.
