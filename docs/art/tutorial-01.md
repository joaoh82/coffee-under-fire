# Optional visual field guide

Begin coffee run (or Begin endless survival) now asks whether to show a five-step illustrated guide. No, skip and play immediately invokes the existing mission-start path. Yes opens lessons for movement/dodge, aiming/fire/reload, coffee pickup, map/delivery, and survival/upgrades. Each lesson has Back, Next and Skip. The last lesson starts the mission.

Desktop instructions match WASD, mouse/left click, Space, R and hold E. Coarse-pointer devices and the existing touch preview mode receive stick, Dodge, Reload and Coffee-button instructions. The objective changes for finite versus endless missions. This is an illustrated guide, not an interactive practice arena.

The native modal dialog traps focus. Each lesson focuses its heading. Escape or the close button returns to briefing. The game stays ready until Play, so the guide creates no game session or Jev requests and does not advance the timer. Ready-state keyboard input is ignored and input is cleared before starting. Failed starts return to the existing briefing error state. No persistent skip preference is stored; each new run offers the choice.

Validation: production build and 133 regression tests pass; independent code review found no blockers. Browser checks covered invitation, all five desktop lessons, skip/start, final start, failed-start recovery, and the mobile movement guide at 390px with focus inside the dialog. A local fixture returned service failure for both start requests; no live Jev calls were used. The browser reported WebGL unavailable, so these checks validate the UI flow rather than a live gameplay session. Existing simulation mechanics are unchanged.
