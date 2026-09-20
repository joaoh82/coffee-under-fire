# How Jev controls NPCs

Verified against the project implementation on 2026-09-20.

## Short explanation for a demo

> Each NPC receives a limited snapshot of what it can see, hear and remember. The game builds a menu of complete legal actions, and TypeSafe AI’s Jev model chooses one. The game then executes that choice with deterministic movement, aiming and combat rules. We record the observation, options and returned decision so the audience can inspect what Jev actually chose.

Jev is the TypeSafe AI decision model, not Java and not a generic chat-model substitute. The integration uses a typed `choice` question. Enemy riflemen, tanks and the general use it; human player controls do not.

## Decision pipeline

1. **Observe:** the browser simulation builds an individual NPC observation from permitted perception.
2. **Enumerate:** deterministic code generates complete legal action candidates with destinations, targets and durations. It does not rank and select a winning tactic.
3. **Request:** the browser posts the versioned request to our backend at `/api/decision` using its game session token.
4. **Evaluate:** the backend validates the request and its budget, then calls `https://api.typesafe.ai/v1/systemone`. `JEV_MODEL` defaults to `jev-latest`; `TYPESAFE_API_KEY` stays on the server.
5. **Validate:** the adapter checks the response schema, candidate membership, confidence and probability distribution. The simulation rechecks identity, freshness and current legality before execution.
6. **Execute and record:** deterministic code executes the selected action. Decision provenance and reported token usage are recorded; replay can reproduce accepted decisions without calling Jev.

The payload sends the observation as `state`, and a `tactic` choice question containing role-specific instructions and the serialized candidates as criteria. Currently each request covers **one NPC**, not a global world decision or a batch of all enemies.

## How often are the world and NPC actions evaluated?

These are two separate clocks:

| Work | Implemented timing |
| --- | --- |
| Local simulation | Fixed 60 ticks per second while running |
| Rendering | Browser frames, separate from the fixed simulation |
| Jev scheduling | Checked during running driver updates, subject to eligibility and capacity |
| Prefetch | An NPC becomes eligible when its current action has at most 30 ticks (0.5 seconds) remaining |
| Normal request spacing | Scheduling sets that NPC’s next eligible request to 60 ticks (1 second) later |
| Early re-evaluation | Invalid/stale decisions and interrupted or completed movement/fire actions can make the NPC eligible sooner |
| Concurrent requests | Up to 4 per game session; up to 8 globally per server process |

**Jev is not called 60 times a second per enemy, and there is no single fixed interval for all NPC decisions.** Timing depends on the chosen action, interruptions, network latency and available slots. Normal uninterrupted actions last:

- Rifle burst: **0.8 seconds**.
- Move to a fixed destination: **up to 2 seconds**, possibly ending sooner when reached or blocked.
- Reload: **1.2 seconds**.
- Hold: **1 second**.
- Tank cannon action: **1.8 seconds**, with a **1.2-second warning** before firing when aligned.
- General reaction: **4 seconds**.

A prefetched decision is queued until the current action ends and is then revalidated. NPCs without actions take priority over prefetches. The one-second eligibility rule means short actions can have a gap; continuous decision availability is not guaranteed.

In the recorded responsiveness/tank test, the driver sent **3,171 requests in 480 active simulation seconds**: approximately **6.6 requests/second across all NPCs**, not per NPC. It took 495.13 wall-clock seconds, or about 6.4 requests/second including pauses. This was a scripted test with an earlier combat profile, not a current-production throughput guarantee.

## What Jev can perceive

The observation contains NPC identity, role, position, health, ammo, current action, recent damage and permitted player contact information:

- **Vision:** player within 14 meters, with unobstructed line of sight.
- **Memory:** last-seen position retained for up to 10 seconds.
- **Hearing:** footsteps within 16 meters and gunfire within 22 meters; approximate locations quantized to a 3-meter grid, retained for up to 3 seconds.
- **Recent damage:** a flag covering the previous second.

Jev is not sent an omniscient snapshot of the entire world. The general has a limited authored reaction menu (`map`, `watch`, `sip`, `pleased`); its current observation does not include a rich coffee-delivery event context.

## What the game decides locally

Local code owns physics, collision detection, pathfinding to the selected destination, projectile movement, animation, health, damage, ammo, waves and player controls.

Candidate generation is authored game design: it supplies an optional path step toward a perceived or remembered contact plus feasible surrounding destinations, and legal fire/reload/hold options. This constrains what Jev can choose. It does **not** mean Jev invents paths or controls every motor operation.

The tactical choice remains Jev’s. Movement executes a fixed destination and does not autonomously switch to chasing a hidden player. Rifle aiming can mechanically track the selected visible target during an authorized burst; loss of visibility or ammunition ends that action. A tank commits to the aim point in its selected candidate and does not track the player after selection.

## Freshness, cancellation and failure

The contract is `coffee.v2`, with the current tactic configuration labelled `tactics.v4`. Requests and responses carry session, epoch, NPC generation, sequence and simulation tick identifiers.

- Reject stale, duplicate, wrong-session, dead-NPC or currently illegal decisions.
- A decision older than 60 simulation ticks (1 second) is rejected on application.
- Pause/restart/recovery invalidates old epochs and cancels pending requests; dead actors’ pending work is cancelled.
- Provider timeout is **1,200 ms in wall-clock time**. Freshness is measured in simulation time, which stops during pauses.
- A 429 response uses the provider’s retry delay; failures impose a minimum one-second cooldown.
- An actor can finish its already authorized action. Without a new valid action it waits; after 90 ticks (1.5 seconds) of starvation, strict mode freezes gameplay for recovery.
- Automatic recovery is bounded to two attempts per interruption and four automatic recovery starts per rolling minute. Manual retry remains available.

There is **no conventional tactical fallback hidden behind the Jev integration**. Offline development uses a separately labelled round-robin mock with `source: mock`; production rejects mock configuration. Replay uses `source: replay`.

## Budgets and observability

Current backend guards per process:

- 8 active sessions, with a 30-minute session lifetime.
- 4 concurrent calls per session and 8 overall.
- 6,500 requests and a 10-million-input-token accounting allowance per session.
- 20,000 requests across the server process lifetime.
- 16,000-byte request-body limit.

These are application limits, not TypeSafe’s account quotas. Unknown or failed usage retains a conservative byte-based reservation; successful reported input usage settles the reservation. The accounting is not an exact billing ledger. Per-game counters remain in memory. With the managed-admin configuration, SQLite also reserves a server-wide monthly input-token allowance that survives restarts and attributes usage to invites. This configuration supports one server process, not cross-instance enforcement. See [managed administration](deployment/admin.md).

The driver tracks pending, queued, applied, rejected, error and cancelled requests, along with observations, candidates, selections, confidence, model version, latency and returned token usage. Its recent trace buffer holds 200 rows; backend logs hold 5,000 rows. The replay recording preserves accepted decisions, player inputs and relevant run configuration for the first 30 minutes. Replay reproduces a recorded run; it does not demonstrate a new live model decision.

See [Gameplay cost estimate](gameplay-cost-estimate.md) for the estimated cost per player.

## Implementation references

Repository: [joaoh82/coffee-under-fire](https://github.com/joaoh82/coffee-under-fire) (private).

- `apps/web/src/game/simulation.ts` — perception, candidates, legality, fixed-step execution and recordings.
- `apps/web/src/game/driver.ts` — scheduling, prefetch, cancellation, recovery, traces and replay.
- `apps/server/src/jev.ts` — TypeSafe request adapter and strict response validation.
- `apps/server/src/pipeline.ts` — sessions, budgets, concurrency, cooldown and logs.
- `packages/shared/contracts.ts` — versioned observation, candidate and decision contracts.
- `docs/benchmarks/live-mission-responsiveness-tank-pass.json` — historical live scripted test cited above.

This note documents inspected code and existing measurements; no new live Jev calls were made to write it.
