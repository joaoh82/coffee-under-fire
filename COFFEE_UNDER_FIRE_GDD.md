# Coffee Under Fire
## Game design document and Codex development handoff

Version 0.2 · 19 September 2026 · Working title, not availability-checked

## 1. Brief and decision status

An Allied soldier must survive Nazi infantry waves while carrying coffee across a miniature WWII battlefield to a general's tent. The presentation is cozy, colorful, low-polygon 3D; the play is a readable, energetic top-down arena shooter. Every autonomous character's tactical decisions are driven by **Jev from TypeSafe AI**.

Confirmed requirements: web platform, React and Three.js, Blender-authored models and arena, WWII Allied-versus-Nazi setting, wave survival plus coffee delivery, Jev-driven NPC decisions, and later implementation through Codex on a machine with Blender and a Blender MCP available.

Proposed defaults, not yet approved: single-player; desktop keyboard/mouse first; direct player movement and aiming; 8-minute missions; repeated deliveries; fictional Allied outpost; stylized non-graphic combat. The player is human-controlled. “Every soldier decision” is interpreted as every autonomous soldier's tactical decision, not overriding player inputs. Confirm this boundary before expanding AI scope.

This is a build specification and design proposal. No game, Blender asset, API integration, or performance claim has been tested in this session. All balance values and engineering budgets below are initial hypotheses.

## 2. Experience pillars

1. **The coffee matters.** Combat creates space to complete deliveries; killing enemies alone cannot win.
2. **A battlefield you can read.** Clear silhouettes, slow enough enemy shots, warm lighting, and visible attack preparation.
3. **Small soldiers with individual intentions.** Jev chooses to attack, reposition, reload, search, or retreat using each soldier's limited knowledge.
4. **A charmingly absurd assignment.** Humor comes from military bureaucracy and protecting a tiny cup amid chaos. The enemy remains clearly antagonistic; historical atrocities are not the joke.
5. **Fast hands, asynchronous brains.** Player controls never wait for inference. Model-driven NPC intentions execute smoothly between decisions.

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
- Pause stops combat, coffee decay, waves, and decision scheduling. Hidden tabs auto-pause; resume invalidates old inference results.

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

| Character | Visual identity | Jev decision domain |
| --- | --- | --- |
| Rifleman | Grey-green uniform, compact rounded helmet | Fire, advance, choose cover, search, reload, retreat |
| Flanker | Lighter equipment, distinct backpack silhouette | Same actions; role instructions favor reachable side routes |
| Heavy, later | Broad body, oversized equipment | Hold lanes, reposition slowly, choose firing opportunities |
| General | Large moustache, tidy uniform, coffee desk | Inspect map, watch entrance, select authored reaction, sip |

First playable uses riflemen and the general; add flankers after the AI feasibility gate. The general is invulnerable and does not introduce escort or base-health mechanics. Any later allied combatants must use the same Jev decision interface.

Personality is a small authored profile: cautious/bold, disciplined/impatient, role objective. It influences model input rather than adding hidden tactical behavior trees. Wave timing and enemy composition are explicit game rules, not autonomous NPC decisions.

## 5. Jev integration and decision ownership

### Verified provider facts

Jev evaluates supplied state with typed questions. TypeSafe documents Choice, Score, and Noul primitives; multiple questions share a state and are evaluated independently. Do not assume one answer conditions another in the same request. [TypeSafe introduction](https://docs.typesafe.ai/introduction)

Choice returns a selected option, a probability distribution, and confidence. The question ID is not shown to the model: an NPC identifier must appear in instructions/state, not only as the result key. [Choice documentation](https://docs.typesafe.ai/primitives/choice)

The documented HTTP entry point is POST `https://api.typesafe.ai/v1/systemone`, using bearer authentication and a body with `state`, `model`, and `questions`. The quickstart uses `jev-latest`. Recheck current documentation and account access when implementing; keep the model name configurable and record returned model metadata. [Quickstart](https://docs.typesafe.ai/introduction/quickstart)

TypeSafe's launch post advertises 70–500 ms response time and $0.042 per million input tokens, with free output, and describes early access. These are vendor claims and launch pricing, not measured guarantees for this game. Its Doom demo uses structured state rather than images. [Launch announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

### Ownership contract

| Jev chooses | Deterministic game code executes |
| --- | --- |
| Whether to attack and which perceived target | Projectile spawning within the chosen attack's duration and fire cadence |
| Which position/cover point to move toward | A* pathfinding, steering, collision, speed and arrival |
| Whether to reload, retreat, hold, or search | Reload timer, animation, action completion |
| Which authored general reaction to perform | Animation/audio playback |

Physics, perception, action legality, and animations are mechanics. They must not quietly choose a new tactical goal. For example, a blocked path cancels an action and requests a new choice; it does not autonomously decide to flank. When a firing target disappears, stop firing and request another decision; never auto-select a new target.

Use **one Choice over complete legal action candidates per NPC**, such as `fire_player_01`, `move_cover_c4`, `move_flank_f2`, `reload`, and `hold`. Each option describes its target, duration, and consequences. This avoids independently choosing an incompatible action and target. Candidate generation enumerates feasible actions and nearby reachable positions; it must not hardcode the winning tactic. Aim error and turn speed are mechanical tuning values, not separate model judgments.

### Perception and memory

Each NPC gets its own position, health, magazine state, current action, role, recent damage, visible targets, audible events, last-seen positions with age, and reachable candidate locations with cover/route descriptors. Coordinates use a consistent named frame and include relative distances/directions.

Enemies do not receive the player's hidden current position or coffee condition through global state. Sharing information requires an explicit perception/message system; omit squad telepathy in MVP. Provide only that NPC's observation in the initial request. Multi-NPC batching is a later optimization requiring isolation checks: shared state can accidentally expose another NPC's knowledge.

The API is not asked to understand screenshots, generate geometry, write dialogue, invent coordinates, or return executable code. General reactions select from authored lines/animations.

### Runtime pipeline

1. Simulation emits a decision-needed event on spawn, completed action, new sighting, damage, or invalidated goal.
2. Scheduler coalesces repeated events and constructs a fresh observation plus a bounded candidate list (start at 6–12).
3. Browser sends a versioned structured snapshot to the backend; backend owns prompt templates and calls Jev.
4. Validate transport/schema, session ID, NPC generation ID, request sequence, candidate IDs, and freshness.
5. Recheck the chosen action's preconditions against the current simulation.
6. Execute that action until completion, cancellation, or its authored expiry; then query again.

Start at about one decision per second per engaged soldier, with adaptive/event-driven scheduling; noncombat general decisions every 3–5 seconds. One request in flight per NPC, session concurrency initially capped at four. Idle characters can use longer model-selected hold actions. Queue entries expire instead of accumulating. Measure whether these provisional budgets sustain 12 soldiers before increasing the cap.

Initial action durations: fire burst up to 0.8 seconds, movement up to 2 seconds, hold up to 1 second; reload lasts the weapon's fixed reload time. A result older than 1 second of active simulation is discarded initially. Pending actions continue only while valid and within their original expiry. Death, pause, restart, and a changed NPC generation invalidate associated results.

**Strict Jev mode is the production default:** no valid decision means that NPC holds without firing; if decision starvation persists beyond 1.5 seconds, pause the entire simulation and show “Reconnecting to command.” Resume after fresh actions are available. Allow retry or quit. Do not silently switch to conventional AI. An explicitly labeled mock mode is permitted for development, recorded replay, and offline mechanics testing, and cannot count as Jev integration acceptance.

Use the returned Choice directly at first. Low confidence is telemetry, not a probability that the action will succeed. Do not multiply attack damage by confidence. Later, compare controlled sampling for personality variation against the straightforward choice baseline.

### Debugging and measurable acceptance

Debug overlay: NPC ID, observation age, candidate list, selected action, confidence, action expiry, inference latency, and decision source (Jev/mock/replay). Render target and path overlays. Log request sequence, decision application tick, selected candidate, rejection reason, provider usage, and model/config version. Avoid logging credentials.

Record player inputs, simulation seed, and applied AI decisions for replay. A fixed seed alone cannot reproduce live model responses. Aim for repeatability within the same build; do not promise cross-browser bit-identical physics.

AI scenario suite: exposed player; player behind cover; empty magazine; low health; lost target; destroyed/occupied cover; simultaneous target death; restart with delayed responses; 429/timeout; long inference stall. Legality is mechanically enforceable; tactical quality requires repeated evaluation and playtesting. Model output types do not guarantee sensible tactics.

### Cost and capacity model

Estimated input tokens = active NPCs × decisions per second × run seconds × average billed input tokens per request. Include instructions, option descriptions, and observations in the token measurement.

Example assumption: 12 NPCs × 1 Hz × 480 s × 1,000 tokens = 5.76 million input tokens, about $0.242 at the quoted launch price, before general decisions, retries, and hosting. This is a budgeting example, not a forecast. At 100 concurrent games the same assumptions imply roughly 1,200 requests/second; account limits and inference concurrency may matter more than token price.

Prototype budget target: less than $0.50 model cost per 8-minute run, configurable and verified using actual usage. Backend enforces per-session request/token budgets and global concurrency; alerts before exhaustion. At the hard cap, strict mode pauses with a clear explanation. No runaway retries. Retry rate-limit responses with bounded backoff and respect provider guidance.

## 6. Technical architecture

Proposed stack: TypeScript, React, Three.js via React Three Fiber, Vite for the client, and a small TypeScript backend for Jev requests. No Java runtime is required by this design. Choose exact compatible package versions when implementation starts and lock them.

Keep the game simulation independent of React and rendering. A 60 Hz fixed simulation step with capped catch-up updates owns entities, projectiles, coffee, waves, navigation, and action execution. Rendering interpolates state. React owns menus and HUD; avoid per-frame React state writes for transforms. Keep active gameplay state in plain objects/typed structures behind a narrow interface.

Use a flat XZ gameplay plane, circular character colliders, static box/capsule obstacle colliders, and a grid-based A* navigation system initially. A general rigid-body engine is unnecessary unless a later mechanic needs it. Character locomotion must not depend on animation root motion.

Browser → session-limited backend → TypeSafe. Provider credentials stay server-side. Validate finite coordinates, enum values, observation sizes, candidate count, request rate, and session ownership. The backend constructs trusted question templates; it is not an unrestricted prompt proxy. A public demo needs server-enforced abuse budgets even if gameplay authority remains in the browser.

Client authority is acceptable for the solo prototype. Do not promise secure leaderboards. Multiplayer would require a separate networking and authority design.

Suggested repository layout:

```text
apps/web/src/{game,render,ui,input,audio}
apps/server/src/{routes,jev,sessions,budgets}
packages/shared/{contracts,config}
assets/blender/{characters,props,arena}
assets/scripts/
apps/web/public/assets/{models,audio}
tests/{simulation,ai,scenarios}
docs/{design,decisions,benchmarks}
```

Initial targets, to measure on a named reference laptop: 60 fps at 1080p with 12 enemies; adjustable resolution scale and shadows; initial compressed download below 15 MB; no inference on the render thread. Track CPU/GPU frame time, draw calls, memory growth, p50/p95 decision latency, stale decisions, and pauses. These are gates, not guaranteed capabilities.

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

Soft percussion and playful military-band instrumentation can support the tone. Prioritize cup pickup clink, spill splash, successful-delivery chime, enemy attack cue, and satisfying muted weapon impacts. Use authored general quips; Jev selects which permitted reaction fits the situation.

Provide remappable inputs, independent sound sliders, reduced screen shake, reduced flashes, subtitles for quips, and faction indicators that do not depend on color. Browser audio starts after user interaction. Touch controls and controller support are later scope.

## 9. Development sequence and acceptance gates

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

Complete the outpost, general, riflemen/flankers, UI/audio, eight wave configurations, delivery feedback, and Jev observation profiles. Add debug tools and applied-decision replay.

Exit: repeated live runs demonstrate attack/reposition/reload/search choices; every autonomous tactical action has traceable Jev provenance; five deliveries are achievable without an easy camping exploit. Gather observations from at least three external playtesters before expanding scope.

### Phase 4 — Harden the web demo

Profile the named target laptop and current desktop Chrome/Firefox/Safari. Test inference failure, rate limits, missing assets, restart, hidden tabs, resizing, and long sessions. Add backend abuse controls, loading progress, settings, and clear unsupported-device handling.

Exit: agreed frame/download/cost targets met or deviations documented; no secret in client build; no runaway requests; no unbounded memory growth; complete win/lose/retry flow verified. Deployment is a later implementation deliverable, not performed by this document.

### Later scope

Additional arenas, daily seeded scenarios, run modifiers, new coffee containers, allied helpers, heavy enemies, persistent unlocks, controller/touch support. Co-op requires its own authority/networking milestone. No procedural map generation, dialogue generation, destructible buildings, vehicles, or monetization in the first slice.

## 10. Verification priorities and risks

| Risk | Evidence required / response |
| --- | --- |
| Jev feels slow or indecisive | Measure decision age, expired actions, and pause time; adjust action horizons and concurrency |
| Jev is only cosmetic | Trace each tactical action to a returned choice; verify no hidden target-selection behavior |
| NPCs appear omniscient | Inspect per-NPC observations in occlusion scenarios |
| All soldiers behave identically | Compare role profiles and position options across recorded scenarios |
| Coffee is an annoying chore | Playtest carry penalty, route length, spill severity, and reward before adding content |
| Cozy art obscures combat | Evaluate at actual zoom with effects active and reduced color discrimination |
| Independent model requests collide over cover | Revalidate reservations; rejected action requests a fresh choice rather than retargeting |
| Model availability blocks development | Keep mock/replay mechanics workflow; explicitly distinguish it from the live acceptance gate |
| Blender exports look wrong | Prove one character and asymmetric marker scene before bulk generation |
| Public usage costs grow unexpectedly | Enforce backend per-session and global caps; measure all billable input |

Automated tests should cover outcome rules, coffee boundaries, action preconditions, stale/session-mismatched responses, collision tunneling, and replay application order. Use live integration tests selectively with budgets. Human playtesting judges feel and tactical plausibility; unit tests cannot certify fun.

## 11. Paste-ready Codex kickoff

```text
Use COFFEE_UNDER_FIRE_GDD.md as the project design and development handoff.

We are building a cozy cartoon low-poly WWII top-down web arena shooter.
The player is an Allied soldier who survives waves of Nazi infantry and
delivers coffee to a general's tent. Coffee handling is a light secondary
challenge: visible sloshing, small spills on hits/dodges, no balancing minigame
or volume loss from normal movement. React + Three.js is required. Blender
is installed here, with an MCP intended for asset and map authoring.

The defining requirement is Jev by TypeSafe AI for every autonomous NPC's
tactical choice. This is not Java and not a generic chat-model substitute.
Read current TypeSafe documentation before implementing the adapter.
Jev selects complete legal action candidates; deterministic code executes
physics, paths, aiming mechanics, animation and combat rules. Do not hide
conventional tactical AI behind the Jev integration. Use strict mode on
service failure and label development mocks clearly.

First inspect the repository, applicable AGENTS.md instructions, installed
tools, Blender version, MCP capabilities, and available configuration.
Preserve existing work. Record the document's proposed defaults as assumptions.
Do not ask again about requirements explicitly confirmed in the conversation.

Begin with Phase 0: a narrow Jev feasibility spike and measured decision
pipeline. Keep credentials server-side. Implement fixtures if credentials
are absent, but report the live-validation gap. Do not fabricate API results,
performance measurements, asset verification, or provider capabilities.

Then build Phase 1, the complete greybox mission loop, before mass-producing
art. Prove one Blender-to-GLB animated character and marker export before
creating the entire asset set. Save editable .blend files, generation scripts,
runtime exports, and reproducible commands in the repository.

Keep simulation separate from React rendering. Use versioned observation and
decision contracts, limited NPC perception, cancellation and expiry, logged
decision provenance, bounded backend budgets, and recorded-decision replay.

Work incrementally with the acceptance gates in the document. At the end of
each phase report what works, evidence from tests/playthroughs, measured
latency/cost where available, remaining issues, and the next concrete step.
Do not implement multiplayer, a campaign, or permanent progression yet.
```

## 12. Confirmed creative decisions — 2026-09-19

These user-confirmed decisions supersede conflicting proposed defaults above.

1. Keep human-directed mouse aiming. Auto-fire and auto-reload are optional toggles. The player's direct inputs and these mechanical conveniences stay outside autonomous NPC tactical selection; every autonomous NPC tactic remains Jev-selected.
2. Offer both an eight-minute mission and endless survival. The finite mission retains its five-delivery survival goal. Endless balancing is provisional; existing backend usage limits are not waived.
3. Coffee spilling remains a light penalty with expressive sloshing and splashes. Normal movement does not lose coffee volume, and balancing must not become a skill minigame.
4. Use creative, fictional, stylized WWII-inspired uniforms and settings rather than historical accuracy. No swastikas or Nazi symbols anywhere in game art, uniforms, flags, UI, or promotional assets.
5. Jev account access and a server-side API key are already available. Do not ask for access again. No dollar budget or increased concurrent-player allowance has been confirmed; retain bounded backend request/token/concurrency limits.
6. Chromium is the primary browser target, without a named minimum laptop. Aim for broad laptop support and mobile-browser compatibility with touch controls. Other browsers and physical mobile devices still need testing; compatibility and performance are not assumed proven.

Still to establish through testing: pursuit/difficulty tuning, sustained live Jev reliability, pricing-based cost estimates, physical mobile usability/performance, and acceptance of the first integrated art sample. Multiplayer, campaigns and permanent progression remain outside current scope.

### Camera and art clarification — 2026-09-19

User-supplied Last Invader screenshots establish the visual target: chunky faceted low-poly forms, muted terrain, strong readable shadows and bright combat feedback. See docs/art/direction.md and the stored reference images. Use original assets and no prohibited faction symbols.

The arena is finite but larger than the screen. An angled top-down camera follows the player and clamps at the world edges, replacing the whole-map camera assumption. Coffee pickup/carry/delivery must be visually unmistakable; existing light handling rules remain confirmed.

### Run progression and feedback clarification — 2026-09-19

Add enemy-dropped XP pickups, an in-run level-up choice, and visible score. Human-selected upgrades apply only to the current run; permanent progression remains out of scope. First pass offers movement, damage and firing-rate improvements; additional weapons can follow later. Freeze gameplay during the choice and include the human selection in deterministic replay.

Introduce feedback sound during greyboxing, before final art: shots, hits, deaths, pickups, coffee and level-up. Replace synthesized placeholders and tune the mix during the art pass. Deaths should have an expressive brief cartoon red burst and debris instead of simply disappearing.

### Battlefield variety and pressure clarification — 2026-09-19

User approved a battered woodland treatment, varied infantry silhouettes/gear, and a tank prototype around wave 4–5. Raise difficulty through earlier/larger infantry groups, keeping basic infantry at 30 HP. Establish one battlefield before separately validating two or three scenery layouts (woodland, autumn ravine, ruined village). Every autonomous tank tactic is also Jev-selected. The first tank balance values in `docs/decisions/playtest-08.md` are implementation assumptions for playtesting, not user-confirmed balance targets.
