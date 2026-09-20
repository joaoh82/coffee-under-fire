# Working assumptions — 2026-09-19

COFFEE_UNDER_FIRE_GDD.md is the design handoff. Section 12 now records the user-confirmed decisions of 2026-09-19; these supersede earlier proposed defaults.

- Single player; human-directed movement and aiming, optional auto-fire/auto-reload, desktop controls plus mobile touch compatibility as a target. All autonomous NPC tactical choices belong to Jev.
- Both eight-minute missions (at least five coffee deliveries plus survival) and endless survival. Creative WWII-inspired outpost and stylized non-graphic combat. Swastikas and Nazi symbols are prohibited throughout all assets.
- GDD initial movement, damage, cup, interaction and wave budgets apply. These are tuning hypotheses, not playtest findings.
- 60 Hz simulation; XZ gameplay plane; circular actors; grid A*; React + Three.js through Fiber. Local server 8787, web 5173. Port 3000 remains reserved.
- One Choice over complete legal actions per NPC. General reactions use the same service. No multi-NPC observation batching or tactical fallback.
- 12 enemy cap, one decision per second when eligible, four requests in flight per session, eight globally. Deadlines: one second of simulation age, 1.5 seconds of starvation before strict pause.
- Default backend is local-only. Session capability tokens, origin allowlist, bounded sessions/concurrency/body sizes/request and conservative token allowances protect the local prototype. Public hosting still requires deployment-level identity and durable abuse limits.
- Cost ceiling is not claimed in dollars until account pricing is supplied. Token/request ceilings apply even when prices are unknown.
- Greybox geometry is intentionally provisional. No asset mass production before the animated GLB and marker gate.
- Chromium is the primary target; no minimum laptop is specified. Mobile compatibility is desired but requires physical-device verification. Jev account/key access is confirmed; pricing and spending allowance remain unspecified.

Initial inspection: folder contained only the GDD, no Git, CLAUDE.md, project AGENTS.md, package manifest or environment configuration. Initialized feat/jev-feasibility without touching an integration branch. Node 24.13.0, npm 11.6.2. Blender executable at ~/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender reports 5.2.1 LTS. MCP tools include scene inspection, Python execution, viewport capture and asset import; connection test failed. Blender MCP add-on exists in the 5.2 scripts/addons directory. No matching Marvin project was returned, so none was invented. No project knowledge-base folder exists.
