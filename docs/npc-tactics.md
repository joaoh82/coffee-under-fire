# How enemy tactics work

Verified against the project implementation on 2026-10-03.

## Short explanation

> Each NPC receives a limited snapshot of what it can see, hear and remember. The game builds a menu of complete legal actions, and a local utility scorer picks one. The game then executes that choice with deterministic movement, aiming and combat rules. Every choice is recorded with its observation and options, so the dashboard can show what each soldier knew and why it acted.

Tactics run in the browser, inside the fixed-step simulation. There is no network call per decision, no per-player inference cost, and nothing to reconnect to. Infantry specialists, tanks and the general all use the same pipeline; the human player's controls do not.

## Decision pipeline

1. **Observe:** `Simulation.request` builds an individual NPC observation from permitted perception.
2. **Enumerate:** `Simulation.candidates` generates complete legal action candidates with destinations, targets and durations (hold, fire/cannon, reload, `advance_contact` toward a known contact, and up to eight surrounding reposition moves).
3. **Score:** `chooseLocally` in `apps/web/src/game/tactics.ts` scores every candidate, adds a small random term, and selects the highest.
4. **Apply:** `Simulation.apply` rechecks identity, freshness and current legality, then deterministic code executes the action and records it.

Decisions happen **synchronously at the start of each simulation tick** (`Simulation.decideLocally`) for every living NPC without an action. An NPC whose action ends mid-tick has a new one by the next tick (1/60 s). There is no prefetching, request spacing or concurrency limit.

## What an NPC perceives

Unchanged from the observation contract (`coffee.v2`):

- **Vision:** player within 14 meters (18 for marksmen), with unobstructed line of sight.
- **Memory:** last-seen position retained for up to 10 seconds.
- **Hearing:** footsteps within 16 meters and gunfire within 22 meters; approximate locations quantized to a 3-meter grid, retained for up to 3 seconds.
- **Recent damage:** a flag covering the previous second.

NPCs do not receive an omniscient snapshot. The scorer only reads the observation and the candidate menu; it never reads the hidden player position or another NPC's knowledge.

## How options are scored

Each enemy type has a profile: preferred engagement distance, minimum comfortable distance, and appetite for advancing or investigating.

| Type | Preferred range | Minimum range | Character |
| --- | ---: | ---: | --- |
| Rifleman | 6 m | 3 m | Closes in, fires bursts, occasionally sidesteps |
| Scout | 4 m | 2 m | Aggressive closer; strafes between bursts |
| Gunner | 9 m | 5 m | Holds mid-range; repositions between bursts |
| Marksman | 13 m | 8 m | Keeps distance; backs off when the player closes in |
| Tank | 10 m | 5 m | Seeks a clear firing lane onto the last sighting |

- **Reload** dominates with an empty magazine and is favored when no contact is visible and ammunition is low.
- **Attack** scores highly when available, but **fire discipline** sets how often an available shot is actually taken; otherwise the NPC maneuvers. Easy 0.35, Normal 0.4, Hard 0.55 (`difficulty.ts`). The retired Jev integration took roughly 45% of available shots, and the current values are tuned near that baseline.
- **Movement** with a visible player prefers destinations near the preferred range; after firing, scouts and gunners favor repositioning. Wounded NPCs (below 35% health) prefer destinations hidden from the last sighting.
- **Investigation:** without sight but with a memory or sound, `advance_contact` and moves that close on the contact score highly.
- **Search:** with no contact at all, NPCs sweep toward a per-NPC waypoint that changes every 10 seconds, so squads spread through the arena instead of idling at spawn.
- **Blocked moves:** if the previous action ended within 3 ticks of starting, the same choice is penalized; a wedged mover prefers a brief hold rather than re-planning every tick.
- **The general** picks authored reactions (`map`, `watch`, `sip`, `pleased`), watching when the player is visible and avoiding repeats.

A uniform random term (up to 1.5 points) breaks ties so enemies are not perfectly predictable.

## Determinism and replay

The random term comes from a hash of session, NPC, epoch, sequence and tick, not from the simulation RNG. The same request always produces the same choice, and enemy spawns are unaffected by tactics. Recordings store each applied choice; `replay(recording)` applies those choices at the same tick without re-running the scorer. Records are replayable within the same build.

## Tactics dashboard

**Tactics dashboard** in the HUD shows the selected NPC's latest observation, every legal option with its share of a softmax over the scores, the chosen action, and recent decisions. Shares are explanatory; random tie-breaking means the top share is not always chosen. Replays can be exported from the dashboard and the mission report.

## Implementation references

- `apps/web/src/game/tactics.ts`: profiles, scoring, fire discipline, deterministic randomness.
- `apps/web/src/game/simulation.ts`: perception, candidates, legality, `decideLocally`, fixed-step execution and recordings.
- `apps/web/src/game/driver.ts`: browser loop, session lease, dashboard traces and replay.
- `packages/shared/contracts.ts`: versioned observation, candidate and decision contracts.
- `tests/tactics.test.ts`: legality, determinism, per-type behavior, no idle starvation and exact replay.

The previous networked Jev integration is retired; see [the decision record](decisions/local-tactics.md).
