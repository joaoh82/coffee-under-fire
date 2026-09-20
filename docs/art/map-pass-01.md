# Outpost map art pass — 2026-09-19

Replaced the remaining flat ground, rectangular paths and six greybox cover blocks with an original Blender-authored map: subtle faceted terrain, worn-edged paths, pale objective clearings, stacked sandbags, braced wooden supply crates, rock cover, small stones and short grass. Rock berms and sparse trees outside the playable bounds define the perimeter. Kept combat lanes open; low interior vegetation is decorative, not new cover.

Gameplay layout is unchanged. Its exact former values now live in packages/shared/map-layout.json, consumed by both arena.ts and the Blender generator. Exported 16 collider/objective/spawn markers match this layout in Three.js, including coordinate conversion and collider width/depth metadata. These existing collider footprints remain authoritative; scenery does not add hidden tactical information or new NPC choices.

Source: assets/blender/map/outpost.blend, with individually editable pieces. Generator: assets/scripts/generate_map.py. Runtime meshes are merged by material before GLB export; this batching does not modify the saved editable source. Export: apps/web/public/assets/models/outpost_map.glb. Manifest: assets/map-manifest.json. Marker export: apps/web/public/assets/models/outpost-markers.json.

Reproduce:

```sh
npm run assets:map
npm run assets:map:verify
npm test
npm run build
```

Final map export: 1,016,964 bytes, 12,164 triangles, 15 mesh/material draw calls (excluding shadow passes, actors, landmarks and effects). All 16 markers verified. All 41 tests pass, including existing two-approach navigation, spawn exclusion and complete mission replay. Production build passes with the existing bundle-size warning. A brief browser check of the first iteration showed 60 FPS; this is not a sustained or physical-mobile performance claim, and the final iteration adds sandbag/grass geometry.

Use /asset-preview → Inspect full map for an overview without Jev calls, or play the main mission for camera-scale judgment. Next: user feedback on map readability/density, enemy art to match the player, and sustained rendering/physical-device profiling. General/enemies are still greybox; this map pass is not a claim that every asset is final.
