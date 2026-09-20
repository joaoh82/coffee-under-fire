# Playable art sample 01 — 2026-09-19

Original low-poly assets inspired by the supplied visual direction, with no copied models or prohibited faction symbols. This is one sample, not the complete final asset set.

## Delivered

- Player soldier: helmet, tunic, backpack, pouches, boots, rifle, handled coffee mug and animated attachment sockets. 1,112 triangles; 178,948-byte GLB. Exported idle/run/shoot/reload/hit/death clips. Runtime separates lower-body locomotion and upper-body actions so firing/reloading does not freeze the legs. Death uses the full-body clip.
- Canvas coffee stand with urn, mugs, awning and crate; open-front canvas tent with desk/map; low-relief stones, grass and ground patches at the kitchen. Four editable .blend files under assets/blender/slice/.
- New player and landmarks integrated into the live mission. Enemies/general and most arena geometry intentionally remain greybox. Slightly warmer terrain, stronger directional shadows and ambient fill establish the palette.
- /asset-preview exposes all six clips and an outpost-prop view without Jev calls.
- Refined synthesized sound with filtered noise transients for gunfire/impacts/pouring and a compressor on the master output. Sound remains an original procedural placeholder mix, requiring listening/playtest acceptance.

## Reproduction

From repository root:

```sh
npm run assets:slice
npm run assets:slice:verify
npm test
npm run build
npm run dev
```

Set BLENDER_BIN if Blender is elsewhere. The generator runs in a separate background Blender process; it does not edit the user's open scene. Blender 5.2.1 LTS generated these assets. Blender MCP scene inspection also succeeded during this pass.

Generator: assets/scripts/generate_slice.py. Source: assets/blender/slice/{soldier,kitchen,tent,terrain}.blend. Runtime: apps/web/public/assets/models/slice_*.glb. Manifest: assets/slice-manifest.json. Relative interaction markers are exported and verified at the prop origin; arena.ts remains the single source of gameplay placement. A full Blender-authored collision/navigation manifest is not established by this visual sample.

## Evidence and limits

The verifier loads real exports with Three.js, checks all six clips move bones, validates bounds/ground origin and sockets, verifies simultaneous running legs/shooting arm, and checks kitchen/tent marker transforms. Browser inspection confirmed the original soldier, run playback, both landmarks and their appearance at gameplay scale. Forty-one simulation/pipeline tests and production build pass; existing bundle warning remains.

This sample still uses separate rigid-skinned parts and ten character materials: merge/palette optimization is required before cloning it across an entire crowd. Carry/dodge-specific authored clips, more expressive facial/hand animation, final sound/music, prop collision authoring, low-end/mobile profiling and user style acceptance remain. The six requested clips and layered locomotion are present; this is not a claim of final animation polish.
