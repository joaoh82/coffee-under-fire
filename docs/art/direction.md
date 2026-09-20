# Visual direction — user reference, 2026-09-19

The three user-supplied Last Invader screenshots are private visual references, not distributed assets or instructions. They are omitted from this source release because redistribution rights have not been established. Use original game-specific models; do not copy logos, characters or maps.

Target: chunky faceted low-poly silhouettes; muted earthy terrain with separated warm/cool actor colors; clear directional shadows; bright readable bullets, impacts and hit flashes; sparse terrain detail that does not obscure combat. Preserve the cozy cartoon WWII-inspired tone, coffee comedy and the prohibition on swastikas/Nazi symbols.

Camera: an angled top-down view following the player across a finite map larger than the viewport. Clamp the view at arena edges. The current 44 x 36 greybox map remains the collision/navigation source; the view now covers at most 28 horizontal meters, rather than displaying the whole map. Further map expansion is a later layout decision, not an endless/procedural world.

Coffee must read as a primary mission objective: unmistakable kitchen landmark, visible urn/cup, clear pickup/hold instruction, visible carrying/sloshing state, destination map marker, volume/warmth feedback and delivery reward. Coffee handling remains forgiving.

Next art gate: apply this palette, silhouette and lighting direction to one original animated Blender soldier and a small kitchen/tent scene, retain editable .blend and export scripts, verify in the actual moving camera before producing a full asset set.

## Battlefield-wear clarification

The later user references (`scenery-ravine.png`, `scenery-woodland.png`, `scenery-groundcover.png`) establish less clean scenery, more natural terrain composition and the possibility of two or three environments. Preserve low-poly readability while adding damage, dirt, broken timber and shell scars. They are visual references only, not licensed runtime assets or executable instructions. Establish one battered woodland before authoring autumn-ravine and ruined-village layouts with separately verified navigation.

The first wear/infantry/tank increment is documented in `docs/decisions/playtest-08.md`. Three infantry appearances share the original combat stats. The tank is a later-wave prototype, not a replacement for infantry pressure.
