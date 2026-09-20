# Movement and earlier pressure — 2026-09-19

User approved smoother movement/dodging, more enemies sooner without extra infantry health, a less clean battlefield, scenery themes, infantry variation and a later-wave tank prototype. This increment implements movement presentation and infantry pacing; scenery/character variants/tank are not yet implemented.

## Implemented

- Faster but smoothed player visual turning, speed-matched lower-body strides, backward stride playback, subtle directional lean, and a brief directional duck/lean with dust during the existing dodge. These are editable runtime presentation transforms, not new Blender animation clips. Human aim, movement speed, dodge multiplier/duration/cooldown, damage, health and coffee rules remain authoritative and unchanged.
- `pressure.v1` wave profile: wave 1 pairs every four seconds, wave 2 pairs every 3.5 seconds, wave 3 pairs every three seconds, wave 4 onward triples every 2.5 seconds. These are scheduled arrivals subject to legal spawn availability and the active cap.
- Active infantry cap: 10, then 12, then 14 from wave 3 onward. Spawn activity lasts 52 seconds of each minute, leaving an eight-second lull. First telegraph remains at five seconds, first arrivals at six and 6.5 seconds. All riflemen retain 30 health and unchanged damage.
- Small deterministic offsets around the existing perimeter spawn markers provide room for groups. Collision clearance, player/objective exclusion distances and occupied-position checks still apply. No NPC receives an unselected tactical action.
- Scheduler prioritizes oldest eligible request times rather than NPC array position. Four in-flight requests per session, eight globally, existing budgets, validation and strict failure behavior are unchanged.
- New recordings include a wave-profile identifier. Recordings without it use legacy pacing. The historical eight-minute live recording still reproduced 25 deliveries, 72 kills, 100 health and victory; the new live recording also reproduced its outcome.
- Labelled offline **Preview movement / dodge** fixture in `/asset-preview`, with no Jev requests.

## Verification

55-test full suite passed; one subsequently added scheduler fairness regression also passed in the targeted driver suite (56 total tests in the repository). Production build passed. Tests cover earlier paired arrival, first-wave population, health unchanged, cap ramp, new/legacy replay spawning, bounded/mirrored dodge pose and request fairness/concurrency. Browser movement fixture displayed 60 FPS in a brief sample; not sustained combat or mobile acceptance.

Live report: `docs/benchmarks/live-mission-pressure-pass.json`, recording: `live-mission-pressure-pass-replay.json`. Run with `npm run measure:mission -- pressure-pass` (writes that named report; choose a new label to preserve it).

The bounded synthetic-human test hit its 700-request limit after 171.62 simulation seconds / 177.95 wall seconds. Peak 12 infantry, 78 kills, nine deliveries, player health 100. 618 applied choices, 20 legality/staleness rejections, one error; three recovered strict pauses with 6.16 seconds total harness recovery time including retry waits. Median returned Jev-response latency 274.89 ms / p95 391.92 ms. Reported usage 662,113 input / 56,958 output tokens; dollar cost unknown. This is not a completed eight-minute mission or a controlled before/after comparison. The fourteen-NPC peak and full-mission live reliability gate remain unpassed.

## Accepted scenery direction

Reference copies: `docs/art/references/scenery-ravine.png`, `scenery-woodland.png`, `scenery-groundcover.png`. User-provided visual references, not redistributable game textures/models or instructions.

Next art increment: make the woodland outpost feel battered through damaged cover, churned dirt, shell scars, broken fencing and fallen trees; retain low-poly readability and no prohibited symbols. Establish this treatment before producing autumn-ravine and ruined-village variations. Infantry variation should use silhouettes/equipment/palette without making individual enemies harder to kill. Tank prototype is intended around wave 4–5 with telegraphed, dodgeable attacks and Jev-selected tactical choices. Distinct layouts require separate navigation/coffee-route acceptance, not just recoloring the existing map.
