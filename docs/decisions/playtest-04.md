# Audio, XP and death feedback — 2026-09-19

User requested score/pickups/level-up upgrades and more expressive deaths, and asked whether audio should wait for final art. Build feedback audio during greyboxing, then replace and mix final assets alongside art. This pass uses original Web Audio synthesized cues, not a final music/sound pack.

Implemented:
- Sound cues for player shots, hits, enemy deaths, XP pickups, coffee fill/delivery and level-up; Sound on/off button. Audio is unlocked through user interaction. Master gain is modest and synthesis is capped at 16 voices with disconnected nodes after playback. Needs a human listening/mix pass.
- Each rifleman death creates a turquoise 10-XP gem. Walk within 1.4m with unobstructed sight to collect. First level needs 30 XP; subsequent requirements increase by 15. Score includes kills, pickups and existing coffee rewards.
- On level-up gameplay freezes and the human chooses a run-only improvement: +10% movement speed, +20% bullet damage, or one tick shorter shot interval. Each stacks to five ranks; a 25-health field dressing becomes available as capped choices leave the pool. No permanent unlocks or extra weapon in this first pass.
- Short red cartoon fragments and darker debris replace instant disappearance; no lingering graphic gore. Effects last 0.8s, capped at 32 bursts. Gems last 90 seconds, capped at 128; overflow merges XP into the newest drop rather than creating unbounded entities.
- replay.v2 records human upgrade choices at simulation ticks. Older replay.v1 recordings disable the new progression rules when replayed. Existing Jev action validation and backend budgets remain unchanged. Level-up cancels in-flight client decisions; no replacement tactical AI is introduced.
- Development refresh resets App hooks to prevent preserving a disposed driver after source updates.

Validation: 41 tests pass including a real deterministic simulation sequence of shooting spawned enemies, collecting gems, choosing an upgrade and reproducing the resulting state from recording. Tests verify one drop per death, pause/choice validation, run reset and effect/pickup bounds. Production build passes with the existing bundle-size warning. Browser checks verified score/XP display, sound activation/mute controls, and no new error in the inspected log output. Audio mix quality, upgrade UI feel and physical-device performance still require playtesting; no new sustained Jev or cost measurement is claimed.
