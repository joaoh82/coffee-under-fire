# Second greybox feedback — 2026-09-19

Clarified the service-pause overlay: “Waiting for Jev” explains that NPC action selection is delayed, gameplay is frozen, and the user can retry the Jev connection. Strict mode behavior is unchanged. Renamed “Follow soldier” to “Inspect NPC” with explanatory text: selection only changes the dashboard's displayed decisions.

Added a player auto-reload checkbox below ammo, enabled by default and retained across mission restarts in the same page. Empty magazines trigger the existing 72-tick reload; partial magazines do not automatically top up. Manual R remains available. Synthesized reload inputs enter the existing recorded-input stream, preserving replay determinism. NPC reload decisions remain Jev-controlled.

Added camera-facing overhead health bars for the player and NPCs, plus a 0.2-second red emissive hit flash on actors whose health decreases. These are presentation effects, not changes to combat damage.

Validation: all 32 tests pass and production build succeeds (existing bundle-size warning remains). Browser checks verified checkbox interaction, dashboard labels, overhead bars, and a visible player hit flash during live combat. No new sustained Jev latency/cost benchmark was performed. Service latency/failure reliability remains an existing acceptance gap.
