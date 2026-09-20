# Camera and coffee readability — 2026-09-19

User selected Last Invader screenshots as art references and clarified that the finite map should exceed the viewport with a player-following camera. Saved references and original-asset direction in docs/art/direction.md; added the confirmed override to the GDD.

Implemented a following orthographic camera with bounded world-edge framing. The existing 44 x 36 layout is larger than the new viewport; no collision, mission scale or Jev perception rules were changed. Recompute camera matrices before mouse raycasting. Added a compact map showing only player, obstacles, kitchen and tent (no hidden enemy information), with objective distance and destination guide.

Coffee was already functional through 0.6-second E interactions at kitchen and tent. Made it explicit with a named kitchen landmark, urn and steam geometry, larger handled carried mug, destination sign/map, fullness/warmth meters and revised briefing/context prompts. Delivery still restores 20 health. These are greybox readability improvements, not acceptance of the final art sample.

Validation: 37 automated tests pass, including camera viewport containment at desktop, portrait and landscape aspect ratios; existing coffee pickup/delivery and full mission replay tests still pass. Production build passes with existing bundle-size warning. Browser screenshot verified the tighter framing, visible kitchen/urn, map and pickup instruction. No new physical-mobile or sustained live-Jev benchmark is claimed.

Next: playtest camera scale and coffee navigation, then create the first original Blender style sample under the confirmed visual direction before expanding art production.
