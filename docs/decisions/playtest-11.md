# Selectable difficulty — 2026-09-19

The user found the current pressure too difficult to reach the tanks. Added native radio cards for Easy, Normal and Hard on the initial briefing, available for both finite and endless modes. Easy is preselected on a fresh page; selection survives subsequent runs in the same mounted app. The active difficulty is shown in the HUD and mission report.

Presets are versioned (`easy.v1`, `normal.v1`, `hard.v1`) and stored in recordings. Missing difficulty means Normal for historical replays; unknown preset IDs fail explicitly. Existing wave/combat profile compatibility is retained.

| Setting | Concurrent enemy cap | Spawn pressure | Incoming rifle / shell damage |
|---|---|---|---|
| Easy | 4 initially; +1 per wave to 8 | Singles every 6s initially, shortening to 4.5s; 44s active window | 5 / 10 |
| Normal | Existing 10 / 12 / 14 | Existing pairs then triples, 4s down to 2.5s; 52s active window | 8 / 16 |
| Hard | 14 | Triples, 3s down to 2s; 55s active window | 8 / 16 |

Enemy HP, movement, weapons, coffee rules, player damage and upgrades are unchanged. Hard remains within the existing fourteen-enemy ceiling. Jev still chooses every autonomous NPC tactic; difficulty controls deterministic wave population and combat damage, not a substitute tactical policy. Backend request/token/concurrency budgets remain unchanged; harder pressure may consume them faster.

Tanks remain eligible from wave 4, around three simulation minutes, when there is a legal free spawn slot. XP level is independent of wave number. The briefing explicitly explains this; no XP-level requirement or guaranteed tank spawn was added.

## Evidence

- 84 tests pass. New tests cover relative pressure and the cap, unchanged Normal settings, real bullet/shell damage, enemy HP, difficulty recording/replay, missing/invalid preset handling, driver forwarding and tank eligibility at XP level 1 on all three presets. Tank checks are offline spawn fixtures with a free slot, not live Jev playthroughs.
- Production build passes (existing bundle warning remains).
- Historical eight-minute live recording reproduces all 2,814 applied choices and its exact result using Normal fallback.
- Browser selection changed Easy to Hard and back, with checked-state and HUD label updates. Briefing supports scrolling on short screens and compact desktop mode cards.
- No new full live playtest or latency/cost benchmark. Easy's human difficulty and physical-mobile layout still need playtest feedback. Next: try Easy through wave 4, tune based on that experience, then author the second scenery.
