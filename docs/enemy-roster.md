# Progressive enemy roster

New runs use `specialists.v1`. Infantry keeps 30 health and the existing wave population caps. New types join the spawning mix; existing enemies remain. A full population can delay the next arrival until a slot opens.

| First wave | Enemy | Distinction |
| --- | --- | --- |
| 1 | Rifleman | Standard infantry with cosmetic uniform variants |
| 3 | Scout | Faster movement, seven-meter firing range, light equipment |
| 4 | Tank | Existing tank progression is unchanged |
| 5 | Gunner | Slower movement, faster bursts, ammunition vest and pack |
| 7 | Marksman | Eighteen-meter range, hood and scope, visible warning before firing |

Scouts move at 3.8 meters/second, gunners at 2.1, marksmen at 2.3. Marksmen wind up for 36 simulation ticks (0.6 seconds) before shooting and have a 60-tick firing interval. The warning uses the same muzzle origin as the projectile and clips against cover. Gunners have a 12-tick firing interval. These are deterministic execution limits, not autonomous tactical rules.

## Jev and replay

Jev still selects each complete legal movement, firing, reload or hold candidate. Observations carry the specialist archetype and combat limits; perception remains bounded (14 meters for scouts/gunners, 18 for marksmen). The server explains those limits in the Choice prompt. Failure does not enable fallback tactical AI. Existing backend request and spending budgets are unchanged.

Specialist observations use `tactics.v5` provenance. The recording stores the roster profile; recordings without it retain legacy infantry behavior and `tactics.v4`. The specialist schedule consumes no extra random draws.

The adapter continues to use the documented [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice) and [request format](https://docs.typesafe.ai/introduction/quickstart). This change does not introduce another provider or model substitute.

## Reproduce assets

Run from the repository root with Blender installed:

```sh
npm run assets:npcs -- rifleman_gunner rifleman_marksman
npm run assets:npcs:verify
# Set this path to your Blender executable:
"$BLENDER_BIN" --background --factory-startup --python assets/scripts/render_enemy_roster.py
```

Editable sources are in `assets/blender/npcs`; runtime GLBs are in `apps/web/public/assets/models`. The lineup script writes an asset preview to `artifacts/enemy-roster.png`, not a gameplay capture. Scouts reuse the existing authored scout model. Gunners and marksmen have all six clips: idle, run, shoot, reload, hit and death.

Verified with Blender 5.2.1 LTS: gunner 1,312 triangles; marksman 1,224 triangles. GLB checks cover skinning, clips, marker placement, bounds, animation blending and grounded death poses. A rendered lineup was inspected.

Offline regressions cover every difficulty's unlock schedule, unchanged tank scheduling and spawn RNG, perception/range limits, movement speed, fire timing, strict-mode inactivity without decisions, provider request shape, appearance mapping, and exact replay of specialist movement and combat. The replay fixture uses explicitly labeled mock decisions. No live Jev calls, latency/cost measurements or full interactive mission playthrough were performed for this change.
