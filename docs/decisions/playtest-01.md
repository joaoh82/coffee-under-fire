# First greybox feedback — 2026-09-19

User feedback: opening encounter took too long, movement felt rigid, enemies remained stationary, and a visible Jev decision dashboard is needed for demos. These changes override the original opening-delay assumption without altering the original GDD.

Implemented:
- First spawn warning at 5 seconds; actual enemy at 6 seconds. First spawn uses the nearest eligible perimeter location and retains exclusion distances.
- Visual interpolation, turning, walking legs, body movement, recoil, dodge lean and coffee slosh for greybox actors.
- tactics.v3 tells Jev to pressure visible opponents, investigate remembered or audible contacts, and search when contact is absent. A complete fixed-destination approach candidate is offered alongside other legal choices. No pursuit executes without a chosen Jev action.
- Hearing is range-limited, quantized to 3m and expires after 3 seconds. Sight remains range/occlusion-limited; sight memory expires after 10 seconds.
- Requests can start in the final 0.5 seconds of an action; results queue until completion, then undergo the same expiry/legal checks. Pause cancels queued work.
- Jev dashboard (?demo=1) shows actual provider/model/config, candidate probabilities, confidence, observations, execution status, recent decisions, errors, latency and reported token usage. Pin a decision for narration. No invented reasoning or dollar cost. Replay export remains available.

Evidence: 30 tests pass, including early spawn timing, sound expiry/no hidden tracking, queued decision completion/cancellation, and the existing full eight-minute passive-fixture mission replay. Production build passes with the existing large-bundle warning. Browser verified the panel and real tactics.v3 responses from jev-1.13.0. Initial brief live check saw a 702ms general decision, one provider timeout, and successful explicit recovery including a 663ms rifleman fire choice. These individual observations are not a sustained performance benchmark. Monetary cost is unknown.

Remaining: sustained live reliability and pursuit tuning, manual movement-feel acceptance, full live mission validation and final Blender character integration. A chosen fire/hold action can still stop a soldier; continuous pressure is a Jev instruction, not a guaranteed scripted pursuit. Refresh the page after development hot updates before playtesting.

Final fresh-page live smoke test: 16 provider responses, 15 applied choices, 1 correctly rejected duplicate reload after ammo was already full, 0 provider errors in that run; dashboard median 258ms, p95 621ms, 13,935 reported input tokens. One enemy selected repeated fire at the stationary player; a second selected reposition movement. The idle player died about 15 seconds into the mission. This proves active combat and live movement choices but also shows pursuit preference and opening difficulty still need tuning. The earlier timeout remains relevant. These are small browser samples, not sustained capacity or cost measurements.
