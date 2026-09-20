# NPC character pass — 2026-09-19

Original project-authored variants of the proven soldier rig. Fictional slate infantry with terracotta scarves, and an olive officer with a peaked cap, moustache and brass shoulder tabs. No faction symbols or imported third-party models.

## Delivered

- Rifleman: 1,100 triangles, seven mesh primitives, 167,012-byte GLB; idle/run/shoot/reload/hit/death.
- General: 1,272 triangles, ten mesh primitives (including switchable map/mug), 201,680-byte GLB; the same six base clips plus map/watch/sip/pleased.
- Editable individual parts in `assets/blender/npcs/{rifleman,general}.blend`. Export-time batching preserves skin weights while reducing the rifleman from the source player's 26 mesh parts to seven.
- Runtime uses independent cloned skeletons/mixers/materials, layered legs and upper-body actions, red hit feedback, role-correct health bars and click-to-inspect. Skeleton GPU resources are disposed on unmount; cached source geometry stays shared.
- General reactions directly illustrate the currently executing Jev reaction candidate. No new tactical policy, provider adapter, physics, perception or combat changes.
- Dead actors remain in a separate rendering list for one simulation second, capped at twelve, with oldest corpses evicted first. They are already absent from live combat/Jev requests. Pause freezes the corpse lifetime and animation. NPC identity remains stable when another enemy disappears.
- `/asset-preview`: Player / Enemy rifleman / General selectors, individual clips and a labelled 12-enemy-plus-general animation fixture. This fixture makes no Jev requests or tactical choices.

## Reproduce

```sh
# If rebuilding the base editable soldier first:
npm run assets:slice
npm run assets:npcs
npm run assets:npcs:verify
npm test
npm run build
npm run dev
```

The generator opens the project's soldier `.blend` in a separate background Blender process; the user's interactive scene is untouched. Set `BLENDER_BIN` to override the Steam Blender path. Generated on Blender 5.2.1 LTS. Runtime exports are `apps/web/public/assets/models/npc_{rifleman,general}.glb`; measured provenance is in `assets/npc-manifest.json`.

## Evidence and limits

The verifier loads actual GLBs, checks clip rosters, bone motion, independent clones, deformed geometry bounds, grounded final death poses, attachment sockets, simultaneous running/shooting layers and mesh/triangle budgets. Browser inspection caught the inherited below-ground death pose; NPC exports now replace it with a grounded fall and have a regression assertion. The existing player export is unchanged.

44 automated tests pass, including retained-corpse lifetime/cap, pause behavior and surviving NPC identity; TypeScript and production build pass. The existing large JS bundle warning remains. The player/landmark export verifier also passes after the renderer reuse.

Browser visuals inspected: both models, the general's sip gesture, enemy final fall and the 13-character animation fixture. A brief fixture sample displayed 60 FPS, not a sustained mobile or full-combat performance acceptance result.

A short stationary live smoke test ended with player death about fifteen simulation seconds in: 15 applied decisions, one legality rejection, zero service errors, zero requests left in flight. Dashboard reported median 286 ms / p95 712 ms across 16 responses and 13,935 reported input tokens. Dollar cost is unknown. This was an integration smoke test, not a complete playthrough or a new sustained provider benchmark. It did not visually exercise every reaction during live combat; all exported clips were checked offline.

Next: human playtest character readability, movement/action transitions and death feedback in the scrolling map. Full-crowd combat performance, physical mobile testing, final animation polish and final audio mix still require acceptance.
