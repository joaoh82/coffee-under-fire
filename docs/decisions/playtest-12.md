# Ruined village and stronger tank groups — 2026-09-19

User approved adding a second battlefield and reported that a lone 90-health tank was too easy. New runs use `armor.v2`; historical `armor.v1` retains 90 health, one scheduled tank per wave and one active tank maximum. Infantry health and enemy shot damage are unchanged.

| Difficulty | Tank health | Wave 4–5 quota | Wave 6+ quota | Active tank cap | Minimum spacing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 150 | 1 | 2 | 2 | 18 seconds |
| Normal | 200 | 2 | 3 | 3 | 12 seconds |
| Hard | 240 | 2 | 3 | 3 | 9 seconds |

These are maximum scheduled arrivals, subject to free spawn positions, the existing total enemy cap and wave spawn window. Tanks begin at wave 4. No tactics were replaced with conventional AI; tanks still need a valid Jev choice to move or fire. Tank health bars use actual maximum health. The coffee.v2 observation accepts bounded health up to 240 and optional `maxHp`, an additive extension; armor.v1 observations retain their original fields.

## Battlefield

The briefing offers illustrated radio cards for Little Outpost and Ruined Village. The village has four ruined buildings, a dry fountain, a rubble barricade and wide streets. Its separate collision layout drives pathfinding, perception, bullets, cannon warnings, coffee markers and minimap. Solid rubble foundations indicate inaccessible ruined interiors; ground scars and paving are traversable decoration. No Nazi insignia or external assets.

Simulation instances own their map; selection is recorded as `mapId`. Missing map IDs replay on woodland. Ruined-village candidates omit woodland-specific route labels. Result screens identify the map. The layout retains the same arena dimensions and objective/spawn positions, but changes cover and routes.

Editable source: `assets/blender/map/village.blend`; generator: `assets/scripts/generate_village.py`; runtime: `apps/web/public/assets/models/village_map.glb`; markers: adjacent `village-markers.json`.

Reproduce with `npm run assets:village` and `npm run assets:village:verify` (Blender 5.2.1 LTS used). Final verified export: **836,476 bytes, 10,652 triangles, 11 material batches, 16 matching markers**. See `assets/village-manifest.json`.

## Evidence and limits

- 88 automated tests pass: separate-map collision/perception, infantry and tank paths from all base spawns/kitchen to every tent, legal village candidates, map selection/replay, tank health, spaced quotas and active caps, plus existing suite.
- Production build passes; existing large JavaScript bundle warning remains.
- Historical eight-minute recording reproduces all 2,814 choices, 375 kills, 30 deliveries and 100 health.
- Browser: village asset loaded, battlefield card selected, live Easy village started and ran to 7:48 on the clock, then paused and quit to briefing. This was a stationary startup smoke test, not balance acceptance. Preview showed 60 FPS at the inspected moment; no sustained FPS benchmark is claimed.
- Three synthetic-position **live** tank observations, one per difficulty, produced valid applied Jev `cannon_player` decisions. Provider latencies: 692.96 / 251.37 / 252.79 ms; total usage: 3,111 input and 303 output tokens; price not available. Source/model: Jev / `jev-1.13.0`. `docs/benchmarks/village-tank-probe.json` records results. Run `node --import tsx scripts/probe-village-tanks.ts` against the strict local backend to repeat (three potentially billable requests).
- No full live village mission or physical mobile test completed in this pass. Multiple-tank combat readability and real difficulty still need playtesting. No claim that Jev service interruptions are eliminated.

Next: play a full village mission through waves 4–6, check simultaneous cannon telegraphs and coffee routes, then tune spawn spacing/health from that evidence. The bounded measurement harness now accepts map and difficulty: `npm run measure:mission -- village-easy 3500 village.v1 easy.v1` (up to 3,500 requests; only run deliberately).
