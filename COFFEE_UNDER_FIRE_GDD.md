# Coffee Under Fire
## Game design document and Codex development handoff

Version 0.3 · 3 October 2026 · Working title, not availability-checked

Version 0.3 replaces the Jev (TypeSafe AI) decision provider with local per-NPC utility tactics. The decision contract, perception limits and ownership rules are unchanged. See section 12 and `docs/decisions/local-tactics.md`.

## 1. Brief and decision status

An Allied soldier must survive Nazi infantry waves while carrying coffee across a miniature WWII battlefield to a general's tent. The presentation is cozy, colorful, low-polygon 3D; the play is a readable, energetic top-down arena shooter. Every autonomous character's tactical decisions are made individually by **local utility tactics** that weigh complete legal actions from that character's limited knowledge. Versions up to 0.2 used Jev from TypeSafe AI for these choices.

Confirmed requirements: web platform, React and Three.js, Blender-authored models and arena, WWII Allied-versus-Nazi setting, wave survival plus coffee delivery, autonomous per-NPC tactical decisions (Jev-driven until 2026-10-03), and later implementation through Codex on a machine with Blender and a Blender MCP available.

Proposed defaults, not yet approved: single-player; desktop keyboard/mouse first; direct player movement and aiming; 8-minute missions; repeated deliveries; fictional Allied outpost; stylized non-graphic combat. The player is human-controlled. “Every soldier decision” is interpreted as every autonomous soldier's tactical decision, not overriding player inputs. Confirm this boundary before expanding AI scope.

This is a build specification and design proposal. No game, Blender asset, API integration, or performance claim has been tested in this session. All balance values and engineering budgets below are initial hypotheses.

## 2. Experience pillars

1. **The coffee matters.** Combat creates space to complete deliveries; killing enemies alone cannot win.
2. **A battlefield you can read.** Clear silhouettes, slow enough enemy shots, warm lighting, and visible attack preparation.
3. **Small soldiers with individual intentions.** Each soldier chooses to attack, reposition, reload, search, or retreat using each soldier's limited knowledge.
4. **A charmingly absurd assignment.** Humor comes from military bureaucracy and protecting a tiny cup amid chaos. The enemy remains clearly antagonistic; historical atrocities are not the joke.
5. **Fast hands, quick brains.** Player controls never wait for NPC decisions. NPC intentions execute smoothly between decisions, and the battlefield never pauses for them.

Pitch: “Hold the line. Don't spill the coffee.”

## 3. Core loop and complete mission rules

Start at the field kitchen → collect coffee → choose a route → fight through a wave → deliver at the general's tent → receive recovery and score → return for another cup as pressure rises.

The first arena has a fixed kitchen and a tent selected from three authored, reachable locations at mission start. The tent stays in that location for the entire run. Its marker is always visible; finding a hidden objective is not the initial challenge.

### Mission structure

- 8 minutes of simulation time, eight 60-second wave windows.
- Each wave schedules a finite set of enemies during its first 45 seconds. The last 15 seconds add no new spawns; surviving enemies remain.
- Concurrent enemy cap: 12 initially. Enemies blocked by the cap enter a bounded queue; discard unspawned entries at the wave boundary. Do not spawn a backlog all at once.
- Win at 8:00 if alive with at least five accepted coffee deliveries. At the deadline, stop combat and show results immediately.
- Lose immediately at zero health. At 8:00 with fewer than five deliveries, report “Outpost held; coffee orders missed” as a mission failure with partial score.
- Completing five deliveries early does not skip survival. Further deliveries remain useful for recovery and score.
- Pause stops combat, coffee decay, waves, and decision scheduling. Hidden tabs auto-pause; resume invalidates in-progress NPC actions.

### Initial controls

| Input | Action |
| --- | --- |
| WASD | Move relative to the screen |
| Mouse | Aim using a ground-plane cursor |
| Left mouse | Fire |
| R | Reload |
| E | Pick up / deliver coffee when in range |
| Space | Short dodge; spills coffee when carrying |
| Escape | Pause and settings |

Allow movement and shooting while carrying. The visual has the soldier holding a cup in one hand and a compact weapon in the other. Do not remove the game's core combat interaction during its core objective.

### Coffee rules

Confirmed direction: coffee handling is a light secondary challenge. Ordinary running, turning, aiming, and shooting do not drain volume. The cup visibly tilts and its surface wobbles during movement, giving a sense of precariousness without demanding balancing inputs. Actual small spills occur on hits and dodges. Avoid physics-driven random losses, mouse-balancing minigames, and penalties that encourage the player to stop enjoying combat.

| Variable | Initial rule |
| --- | --- |
| Capacity | One cup; starts at 100 volume and 100 warmth |
| Acquisition | Hold E for 0.6 seconds at kitchen; interrupted by leaving its radius |
| Carry speed | 95% of normal movement speed |
| Warmth | Loses 0.5 points per simulation second; generous delivery window |
| Taking damage | Spills 5 volume, at most once per second |
| Dodging | Spills 5 volume; does not also spill merely from acceleration |
| Accepted delivery | Volume at least 25 and warmth at least 20 |
| Delivery interaction | Hold E for 0.6 seconds in tent radius |
| Reward | +20 health, capped at 100; quality score based on remaining volume and warmth |
| Failed cup | At zero volume or warmth below 20, mark unusable; E at kitchen replaces it |
| Replacement | Any carried cup can be replaced at kitchen; no resource charge |

Coffee state is numerical, not a fluid simulation. Steam, surface wobble, and a few spill particles communicate it. Normal movement uses contained sloshing; actual volume loss uses a distinct outward splash and a small meter tick. Overlapping damage and dodge events share the one-second spill cooldown, preventing stacked losses. At 100 starting volume and a 25-point acceptance threshold, a cup tolerates 15 small spills and remains deliverable. Tune for most ordinary delivery attempts to succeed; failed cups should result from prolonged delays or repeated trouble, not routine movement. A rejected cup never consumes a delivery credit. The general's model-selected animation or reaction cannot veto a mechanically valid delivery.

Initial score: 1,000 per accepted delivery + 5 × (volume + warmth) per delivery + 10 per enemy defeated + 1 per second survived. No permanent upgrades in the first version.

### Combat

Player: 100 HP, approximately 5 units/second movement, one compact automatic weapon, 12-round magazine, 1.2-second reload, unlimited reserve ammunition. Start with three hits to defeat a basic enemy. Tune weapon cadence and enemy damage in the greybox before art production.

Use visible projectiles with swept collision checks so fast shots cannot tunnel through cover. Enemy attack actions have a visible 0.3-second preparation and limited turning speed. Cover blocks shots. No friendly fire or melee in the first slice. Dodge is a brief speed burst with a 2-second cooldown; no invulnerability initially.

Defeated soldiers make a brief cartoon tumble, then disappear in a dust puff. No gore, corpses accumulating, or ragdoll dependency. Disable gameplay collision immediately on defeat.

## 4. Arena and enemies

### The Little Outpost

Start with a roughly 44 × 36 unit arena, on a flat gameplay plane. Use a fixed angled orthographic camera looking down about 55 degrees. Ground height variation is cosmetic in the MVP.

The kitchen occupies the southwest; eligible general-tent sites occupy the east and north edges. A broken central stone wall creates three routes:

- Central lane: short, exposed, good visibility.
- Orchard lane: longer, interrupted sightlines, many flanking connections.
- Supply-yard lane: medium length, crates and sandbags, multiple exits.

Require at least two navigable approaches to every tent location. No single corridor should trap the objective. Spawn points are on the north/east/west perimeter, at least 10 units from the player and outside a 6-unit kitchen/tent exclusion radius. Telegraph spawns for one second. Reserve spawn space before materializing a soldier.

Test walking clearance using the actual collider radius. Tall props fade when they occlude the player; roofs on important interactables are cut away. Keep decorative debris out of collision unless it reads as a barrier.

### NPC roster

| Character | Visual identity | Tactical decision domain |
| --- | --- | --- |
| Rifleman | Grey-green uniform, compact rounded helmet | Fire, advance, choose cover, search, reload, retreat |
| Flanker | Lighter equipment, distinct backpack silhouette | Same actions; role instructions favor reachable side routes |
| Heavy, later | Broad body, oversized equipment | Hold lanes, reposition slowly, choose firing opportunities |
| General | Large moustache, tidy uniform, coffee desk | Inspect map, watch entrance, select authored reaction, sip |

First playable uses riflemen and the general; add flankers after the AI feasibility gate. The general is invulnerable and does not introduce escort or base-health mechanics. Any later allied combatants must use the same decision interface.

Personality is a small authored profile: cautious/bold, disciplined/impatient, role objective. It influences scoring weights in the shared decision layer rather than adding hidden per-character behavior trees. Wave timing and enemy composition are explicit game rules, not autonomous NPC decisions.

## 5. NPC tactics and decision ownership

### Ownership contract

| The NPC's tactics choose | Deterministic game code executes |
| --- | --- |
| Whether to attack and which perceived target | Projectile spawning within the chosen attack's duration and fire cadence |
| Which position/cover point to move toward | A* pathfinding, steering, collision, speed and arrival |
| Whether to reload, retreat, hold, or search | Reload timer, animation, action completion |
| Which authored general reaction to perform | Animation/audio playback |

Physics, perception, action legality, and animations are mechanics. They must not quietly choose a new tactical goal. For example, a blocked path cancels an action and the NPC makes a new choice; it does not autonomously decide to flank. When a firing target disappears, stop firing and choose again; never auto-select a new target.

Use **one choice over complete legal action candidates per NPC**, such as `fire_player`, `advance_contact`, `move_3`, `reload`, and `hold`. Each option describes its target, destination, duration and consequences. This avoids independently choosing an incompatible action and target. Candidate generation enumerates feasible actions and nearby reachable positions; it must not hardcode the winning tactic. Aim error and turn speed are mechanical tuning values, not separate tactical judgments.

### Tactics scorer

The tactics layer is a utility scorer over the candidate menu (`apps/web/src/game/tactics.ts`). Each enemy type has a profile: preferred and minimum engagement distance, and appetite for advancing or investigating. Riflemen and scouts close in, gunners hold mid-range, marksmen keep distance and retreat when approached, and tanks seek a clear lane onto the last sighting. Wounded NPCs prefer hidden destinations. With no contact, NPCs sweep toward rotating search waypoints instead of idling.

Difficulty sets **fire discipline**: the chance an available shot is taken instead of maneuvering (Easy 0.35, Normal 0.4, Hard 0.55). A small random term keeps choices from being perfectly predictable. It is derived from the session, NPC, sequence and tick, so the same situation always yields the same choice and replays stay exact. Tuning should change profiles and weights, never move tactics into execution code.

### Perception and memory

Each NPC gets its own position, health, magazine state, current action, role, recent damage, visible targets, audible events, last-seen positions with age, and reachable candidate locations with cover/route descriptors. Coordinates use a consistent named frame.

Enemies do not receive the player's hidden current position or coffee condition through global state. Sharing information requires an explicit perception/message system; omit squad telepathy in MVP. The scorer reads only that NPC's observation and candidates.

The tactics layer does not interpret screenshots, generate geometry, write dialogue, invent coordinates, or run generated code. General reactions select from authored lines/animations.

### Runtime pipeline

1. At the start of each fixed simulation tick, every living NPC without an action is due a decision.
2. The simulation constructs a fresh observation plus a bounded candidate list (up to 12).
3. The tactics layer scores the candidates and selects one, synchronously.
4. Validate session, epoch, NPC generation, sequence, candidate ID, and freshness.
5. Recheck the chosen action's preconditions against the current simulation.
6. Execute that action until completion, cancellation, or its authored expiry; then choose again.

Action durations: fire burst up to 0.8 seconds, movement up to 2 seconds, hold up to 1 second, general reactions 3–5 seconds; reload lasts the weapon's fixed reload time. Death, pause, restart, and a changed NPC generation invalidate in-progress actions. A choice whose action stalls immediately (for example a move blocked by a squadmate) is penalized on the next choice, so a wedged NPC pauses briefly instead of re-planning every tick.

### Debugging and measurable acceptance

Tactics dashboard: NPC ID, observation, candidate list with score shares, selected action, action expiry, and decision source (local/scripted/replay). Log decision application tick, selected candidate, rejection reason, and tactics/config version.

Record player inputs, simulation seed, and applied decisions for replay. Aim for repeatability within the same build; do not promise cross-browser bit-identical physics.

AI scenario suite: exposed player; player behind cover; empty magazine; low health; lost target; destroyed/occupied cover; simultaneous target death; blocked movement; no contact. Legality and determinism are mechanically enforceable; tactical quality and difficulty require repeated evaluation and playtesting.

## 6. Technical architecture

Proposed stack: TypeScript, React, Three.js via React Three Fiber, Vite for the client, and a small TypeScript backend for sessions, access and the leaderboard. No Java runtime is required by this design. Choose exact compatible package versions when implementation starts and lock them.

Keep the game simulation independent of React and rendering. A 60 Hz fixed simulation step with capped catch-up updates owns entities, projectiles, coffee, waves, navigation, and action execution. Rendering interpolates state. React owns menus and HUD; avoid per-frame React state writes for transforms. Keep active gameplay state in plain objects/typed structures behind a narrow interface.

Use a flat XZ gameplay plane, circular character colliders, static box/capsule obstacle colliders, and a grid-based A* navigation system initially. A general rigid-body engine is unnecessary unless a later mechanic needs it. Character locomotion must not depend on animation root motion.

NPC tactics run in the browser simulation; the backend never sees per-decision traffic. It owns game session leases, invite/guest access, and leaderboard submission. Secrets stay server-side. A public demo needs server-enforced abuse limits (admission, concurrency, session ownership) even though gameplay authority remains in the browser.

Client authority is acceptable for the solo prototype. Do not promise secure leaderboards. Multiplayer would require a separate networking and authority design.

Suggested repository layout:

```text
apps/web/src/{game,render,ui,input,audio}
apps/server/src/{routes,sessions,access,leaderboard}
packages/shared/{contracts,config}
assets/blender/{characters,props,arena}
assets/scripts/
apps/web/public/assets/{models,audio}
tests/{simulation,ai,scenarios}
docs/{design,decisions,benchmarks}
```

Initial targets, to measure on a named reference laptop: 60 fps at 1080p with 12 enemies; adjustable resolution scale and shadows; initial compressed download below 15 MB; tactics run in the fixed simulation step, not per rendered frame. Track CPU/GPU frame time, draw calls, memory growth, and tactics time per tick. These are gates, not guaranteed capabilities.

## 7. Art direction and Blender production brief

Style: a handcrafted toy battlefield. Broad readable shapes, oversized heads/hands/boots, compact bodies, softened corners, flat colors, gentle ambient shadows, subtle texture or none. Low polygon count alone is not the art direction: silhouette, palette, proportions, lighting, and camera must agree.

Palette seed: warm cream #F3E7CC, grass sage #91A878, Allied olive #647653, enemy slate #67717B, tent canvas #C8AE7D, coffee amber #A65F32. Use shape and UI markers as well as color to distinguish factions. A bright enamel cup and exaggerated steam make the carried objective readable at gameplay scale.

Fictional WWII-inspired uniforms and equipment establish the period. Enemy identification can rely on uniforms, silhouettes, and mission framing; explicit Nazi insignia is not required by this proposed visual design. Final historical specificity and insignia treatment remain creative decisions for the user.

### Asset list and provisional budgets

| Asset | Count / variants | Triangle budget per asset |
| --- | --- | --- |
| Soldier base rig | Player + enemy variants sharing proportions | 1,500–3,000 |
| General | 1 | 2,000–3,500 |
| Weapon | Player/enemy variants | 250–700 |
| Cup and saucer | Cup required; saucer decorative | 100–300 |
| General tent and kitchen station | 1 each | 800–2,500 |
| Sandbag/wall/crate/barrel modules | 6–10 modules | 100–600 |
| Trees, bushes, rocks | 6 variants | 100–700 |
| Ground and path modules | Small reusable set | Keep visible terrain below 10,000 total |

Treat budgets as starting constraints. Reuse materials; prefer small atlases or vertex colors. Begin with one sun light and ambient fill, plus inexpensive contact shadows. Do not rely on heavy post-processing to create the style.

Character actions: idle, run, aim/fire, reload, carry-idle, carry-run, dodge, hit, defeat. General: map-idle, watch, sip, pleased, impatient. Use in-place animations and sockets named `hand_weapon`, `hand_coffee`, and `muzzle`. Establish upper/lower-body blending or split rigs during the first character spike, before producing all variants.

### Codex + Blender MCP workflow

1. Inspect the installed Blender version and available MCP operations; do not assume tool names or capabilities.
2. Create a repeatable Blender Python generator for one style sample: soldier, mug, sandbag, grass tile, and a tent corner.
3. Save editable .blend source and generator scripts in the repository. Operate in named collections and avoid clearing unrelated scenes.
4. Review from the actual gameplay camera. Check cup readability, faction distinction, silhouette, scale, and shadows.
5. Export one animated character as GLB and import it into the game. Verify material fidelity, bone orientation, sockets, animation names, scale, and bounds.
6. Only after that round trip succeeds, generate the modular prop set and character variants.
7. Author arena visual placements and named markers in Blender; export GLB plus a versioned JSON manifest for spawn points, colliders, kitchen, tent candidates, and navigation obstacles.
8. Validate the export automatically and inspect the arena in the browser. Blender viewport appearance alone is not acceptance.

Use one Blender unit as one meter. Blender is Z-up; game world is Y-up. Let the GLB exporter handle mesh conversion, and explicitly apply the same transformation to JSON marker data. Verify with an asymmetric test scene rather than stacking manual rotations until it looks right. Feet origin at ground level, consistent forward direction, applied mesh scale, deliberate rig transforms.

Name objects with stable prefixes: `VIS_`, `COL_`, `SPAWN_`, `NAV_`, `SOCKET_`, `TENT_`, `KITCHEN_`. The manifest is the gameplay placement source; never manually maintain a second set of positions in code. Exporting twice should preserve stable IDs. Bake unsupported procedural appearance into simple exportable materials as needed.

Deliver both editable source and runtime exports. Document regeneration commands and maintain an asset manifest with IDs, file paths, licensing/provenance, triangle counts, bounds, material counts, and animation clips.

## 8. UX, sound, and accessibility

HUD: health, ammo, cup volume/warmth, deliveries out of five, mission timer, and tent direction. Use distinct shapes and labels for volume versus temperature. Show a route hint only during onboarding. The first 30 seconds teach moving, firing, pickup, and delivery in a safe introductory segment before wave pressure ramps.

Soft percussion and playful military-band instrumentation can support the tone. Prioritize cup pickup clink, spill splash, successful-delivery chime, enemy attack cue, and satisfying muted weapon impacts. Use authored general quips; the general's tactics select which permitted reaction fits the situation.

Provide remappable inputs, independent sound sliders, reduced screen shake, reduced flashes, subtitles for quips, and faction indicators that do not depend on color. Browser audio starts after user interaction. Touch controls and controller support are later scope.

## 9. Development sequence and acceptance gates

Phases 0–4 record the original plan. Phase 0 and the live-provider gates were completed with Jev, then superseded on 2026-10-03 by local tactics. Equivalent gates now apply to the local scorer: legal choices only, traceable decision provenance, exact replay, and playtested difficulty.

### Phase 0 — Prove the defining AI requirement

Build a minimal Jev adapter and a headless scene with one soldier and discrete action candidates. Use verified credentials when available; otherwise implement fixtures and state clearly that live validation is blocked. Test actual API response shapes, access, usage, latency, and concurrency from the intended region. Expand to 12 simulated NPCs before committing to production assets.

Exit: live decisions logged; illegal/stale responses rejected; strict outage behavior demonstrated; per-run cost projected from measured usage; clear go/no-go on intended NPC count. If performance fails, reduce decision frequency or concurrency/NPC count and discuss the tradeoff; do not replace Jev secretly.

### Phase 1 — Greybox the whole playable loop

Build movement, camera, shooting, cover, health, kitchen pickup, cup decay/spill, delivery, waves, win/loss, pause/restart. Integrate the Phase 0 decision layer. Mock mode may speed mechanics work but remains labeled.

Exit: one complete eight-minute mission is playable; coffee creates interesting route choices with forgiving handling; normal movement never loses volume and simultaneous spill triggers cannot stack; survival alone cannot win; delivery credit cannot be duplicated; no spawn overlaps or impassable objective sites.

### Phase 2 — Establish the asset pipeline

Create the style sample, first rig, GLB round trip, export script, and marker manifest. Replace a small greybox section before scaling production.

Exit: player and enemy distinguishable at game scale; coffee visible; animation blending works; Blender and browser placements agree; source scripts recreate exports.

### Phase 3 — Build the vertical slice

Complete the outpost, general, riflemen/flankers, UI/audio, eight wave configurations, delivery feedback, and NPC observation profiles. Add debug tools and applied-decision replay.

Exit: repeated live runs demonstrate attack/reposition/reload/search choices; every autonomous tactical action has traceable decision provenance; five deliveries are achievable without an easy camping exploit. Gather observations from at least three external playtesters before expanding scope.

### Phase 4 — Harden the web demo

Profile the named target laptop and current desktop Chrome/Firefox/Safari. Test missing assets, restart, hidden tabs, resizing, and long sessions. Add backend abuse controls, loading progress, settings, and clear unsupported-device handling.

Exit: agreed frame/download/cost targets met or deviations documented; no secret in client build; no runaway requests; no unbounded memory growth; complete win/lose/retry flow verified. Deployment is a later implementation deliverable, not performed by this document.

### Later scope

Additional arenas, daily seeded scenarios, run modifiers, new coffee containers, allied helpers, heavy enemies, persistent unlocks, controller/touch support. Co-op requires its own authority/networking milestone. No procedural map generation, dialogue generation, destructible buildings, vehicles, or monetization in the first slice.

## 10. Verification priorities and risks

| Risk | Evidence required / response |
| --- | --- |
| Enemies feel slow, indecisive or too deadly | Measure idle ticks, blocked moves and shots taken; tune action horizons, profiles and fire discipline |
| Tactics hide in mechanics | Trace each tactical action to a scored choice; verify no hidden target-selection behavior |
| NPCs appear omniscient | Inspect per-NPC observations in occlusion scenarios |
| All soldiers behave identically | Compare role profiles and position options across recorded scenarios |
| Coffee is an annoying chore | Playtest carry penalty, route length, spill severity, and reward before adding content |
| Cozy art obscures combat | Evaluate at actual zoom with effects active and reduced color discrimination |
| NPC choices collide over cover | Revalidate reservations; a rejected action leads to a fresh choice rather than retargeting |
| Blender exports look wrong | Prove one character and asymmetric marker scene before bulk generation |
| Public play is abused | Enforce guest admission limits, per-network concurrency and session ownership |

Automated tests should cover outcome rules, coffee boundaries, action preconditions, stale/session-mismatched responses, collision tunneling, and replay application order. Human playtesting judges feel and tactical plausibility; unit tests cannot certify fun.

## 11. Paste-ready Codex kickoff

```text
Use COFFEE_UNDER_FIRE_GDD.md as the project design and development handoff.

We are building a cozy cartoon low-poly WWII top-down web arena shooter.
The player is an Allied soldier who survives waves of Nazi infantry and
delivers coffee to a general's tent. Coffee handling is a light secondary
challenge: visible sloshing, small spills on hits/dodges, no balancing minigame
or volume loss from normal movement. React + Three.js is required. Blender
is installed here, with an MCP intended for asset and map authoring.

The defining requirement is an individual tactical choice for every
autonomous NPC, made by a local, deterministic utility scorer over complete
legal action candidates using only that NPC's perception. Deterministic code
executes physics, paths, aiming mechanics, animation and combat rules. Do not
hide tactical choices inside physics or execution code. Label scripted test
fixtures clearly.

First inspect the repository, applicable AGENTS.md instructions, installed
tools, Blender version, MCP capabilities, and available configuration.
Preserve existing work. Record the document's proposed defaults as assumptions.
Do not ask again about requirements explicitly confirmed in the conversation.

Begin with Phase 0: candidate enumeration, the tactics scorer and a measured
decision pipeline. Keep secrets server-side. Do not fabricate performance
measurements, asset verification, or playtest results.

Then build Phase 1, the complete greybox mission loop, before mass-producing
art. Prove one Blender-to-GLB animated character and marker export before
creating the entire asset set. Save editable .blend files, generation scripts,
runtime exports, and reproducible commands in the repository.

Keep simulation separate from React rendering. Use versioned observation and
decision contracts, limited NPC perception, cancellation and expiry, logged
decision provenance, bounded backend abuse limits, and recorded-decision replay.

Work incrementally with the acceptance gates in the document. At the end of
each phase report what works, evidence from tests/playthroughs, measured
performance where available, remaining issues, and the next concrete step.
Do not implement multiplayer, a campaign, or permanent progression yet.
```

## 12. Confirmed creative decisions — 2026-09-19

These user-confirmed decisions supersede conflicting proposed defaults above.

1. Keep human-directed mouse aiming. Auto-fire and auto-reload are optional toggles. The player's direct inputs and these mechanical conveniences stay outside autonomous NPC tactical selection; every autonomous NPC tactic remains selected by that NPC's own decision layer (Jev until 2026-10-03, local tactics since).
2. Offer both an eight-minute mission and endless survival. The finite mission retains its five-delivery survival goal. Endless balancing is provisional.
3. Coffee spilling remains a light penalty with expressive sloshing and splashes. Normal movement does not lose coffee volume, and balancing must not become a skill minigame.
4. Use creative, fictional, stylized WWII-inspired uniforms and settings rather than historical accuracy. No swastikas or Nazi symbols anywhere in game art, uniforms, flags, UI, or promotional assets.
5. *(Superseded 2026-10-03.)* Jev account access and a server-side API key were available. The game no longer uses Jev; no provider key or inference budget is required.
6. Chromium is the primary browser target, without a named minimum laptop. Aim for broad laptop support and mobile-browser compatibility with touch controls. Other browsers and physical mobile devices still need testing; compatibility and performance are not assumed proven.

Still to establish through testing: pursuit/difficulty tuning of local tactics, physical mobile usability/performance, and acceptance of the first integrated art sample. Multiplayer, campaigns and permanent progression remain outside current scope.

### Camera and art clarification — 2026-09-19

User-supplied Last Invader screenshots establish the visual target: chunky faceted low-poly forms, muted terrain, strong readable shadows and bright combat feedback. See docs/art/direction.md and the stored reference images. Use original assets and no prohibited faction symbols.

The arena is finite but larger than the screen. An angled top-down camera follows the player and clamps at the world edges, replacing the whole-map camera assumption. Coffee pickup/carry/delivery must be visually unmistakable; existing light handling rules remain confirmed.

### Run progression and feedback clarification — 2026-09-19

Add enemy-dropped XP pickups, an in-run level-up choice, and visible score. Human-selected upgrades apply only to the current run; permanent progression remains out of scope. First pass offers movement, damage and firing-rate improvements; additional weapons can follow later. Freeze gameplay during the choice and include the human selection in deterministic replay.

Introduce feedback sound during greyboxing, before final art: shots, hits, deaths, pickups, coffee and level-up. Replace synthesized placeholders and tune the mix during the art pass. Deaths should have an expressive brief cartoon red burst and debris instead of simply disappearing.

### Battlefield variety and pressure clarification — 2026-09-19

User approved a battered woodland treatment, varied infantry silhouettes/gear, and a tank prototype around wave 4–5. Raise difficulty through earlier/larger infantry groups, keeping basic infantry at 30 HP. Establish one battlefield before separately validating two or three scenery layouts (woodland, autumn ravine, ruined village). Every autonomous tank tactic is also selected by its own decision layer. The first tank balance values in `docs/decisions/playtest-08.md` are implementation assumptions for playtesting, not user-confirmed balance targets.

### Local tactics replace Jev — 2026-10-03

User approved removing Jev completely after persistent reconnect freezes made the game unplayable. Strict mode froze the whole battlefield whenever any NPC went 1.5 seconds without a fresh remote decision. Every autonomous NPC still makes its own choice over legal candidates from limited perception; a local deterministic utility scorer replaces the remote model. The server keeps sessions, access, leaderboard and admin; token and dollar budgets are removed. Difficulty tuning of local tactics requires human playtesting. Details: `docs/decisions/local-tactics.md` and `docs/npc-tactics.md`.
