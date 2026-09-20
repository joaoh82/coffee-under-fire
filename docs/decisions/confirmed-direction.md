# Confirmed direction — 2026-09-19

User answered the GDD creative questions. GDD section 12 and assumptions.md now record those answers. Human mouse aiming remains; auto-fire and auto-reload are optional mechanical conveniences. Both finite missions and endless survival are desired. Coffee remains forgiving. Creative fictional WWII-inspired art is preferred and swastikas/Nazi symbols are prohibited. Jev access is already confirmed. Chromium is the primary browser target; mobile compatibility is desired, without a named minimum laptop.

Implemented this pass:
- Auto-fire checkbox, initially off, uses the player's current aim; no auto-targeting. Auto-reload remains independently switchable. Settings survive mission restarts within the page. Actual fire/reload inputs are recorded for replay.
- Briefing selects eight-minute mission or endless survival. Endless counts elapsed time, continues capped waves beyond eight minutes, and keeps coffee healing/score. No automatic Jev budget increase/session renewal. Existing service limits can halt the prototype run.
- Replay metadata records mission mode; older records default to the finite mission. Capture is bounded to the first 30 minutes, with a truncation flag; gameplay does not end merely because capture is full.
- Initial pointer-based touch controls: move stick, aim/fire stick, coffee hold, dodge and reload; pointer cancellation releases inputs. Coarse-pointer devices show controls automatically; ?touch=1 exposes the layout for development inspection. Added compact viewport CSS.

Validation: 35 automated tests pass, including auto-fire direction/input recording, endless continuation after eight minutes, endless replay, and recording bounds. Production build passes with the existing bundle-size warning. Browser UI inspection verified mode selection, elapsed-time label and touch-control layout. This is not physical-phone or multi-touch gameplay validation. No new provider capability or sustained performance claim is made.

Remaining: real mobile device testing, compact-screen playability, deployment/network access for phone testing, sustained Jev reliability and cost-based budgeting. Backend stays local-only; this change does not expose it to a LAN or public network.
