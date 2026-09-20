# Art sample and live pipeline gate — 2026-09-19

## What works

One original animated Blender soldier and a kitchen/tent/terrain sample are playable. Six exported animations, upper/lower-body blending, coordinate/marker checks, and original procedural sound refinement are implemented. See ../art/slice-01.md for reproduction and limitations.

## Full live mission measurement

Command: npm run measure:mission (local strict server required). Script hard caps: 700 decisions and 10 minutes wall time. Scripted human controls use normal damage, coffee, collision and outcome rules; all NPC tactics are live Jev. This is a synthetic controls test, not a human playtest or a balance claim.

- Completed 480 simulation seconds in 483.87 wall seconds; won with 25 deliveries, 72 kills, 100 health and level 5.
- 586 decision requests; 534 applied, 5 rejected after legality revalidation, 1 error. Other requests were cancelled or outstanding when interrupted; cancellations are not provider failures.
- Two starvation pauses; 3.67 seconds total measured recovery interval, including the harness's 1.2-second retry wait per pause. Both retries recovered; no conventional tactical fallback.
- Across ALL 534 applied decisions: median 270.74 ms, p95 606.91 ms. This population excludes rejected, cancelled and failed calls.
- Reported response usage: 489,421 input tokens and 42,643 output tokens. Dollar cost unknown; calls without returned usage may still be billable. Existing backend request/token/concurrency ceilings were retained.
- Replaying the complete recording reproduced the terminal status, time, deliveries, kills, health and level without service calls.

Raw report: live-mission-art-pass.json. Recording: live-mission-art-pass-replay.json. The original incremental trace collector omitted some out-of-order completions; rows are partial and explicitly marked. Driver counters are independent of that collector. Latency figures were recalculated from every applied decision in the complete replay, and the collector was fixed for future runs. No missing responses were fabricated.

## Gate conclusion

The art round trip and one complete live-run/replay are demonstrated. Strict service interruptions were short and recoverable in this sample; they were not eliminated, and no controlled before/after comparison was performed. Forty-one tests, asset verification, and production build pass. Human playthroughs, 12-enemy sustained-load coverage, physical-mobile performance, sound listening/mix, crowd draw-call optimization, full map collision authoring and dollar budgeting remain open. No public deployment.

Next step: user plays this sample and accepts/revises the visual scale, mug readability, animation and sound; then optimize the rig/materials and extend the approved treatment to an enemy variant and a small cover set.
