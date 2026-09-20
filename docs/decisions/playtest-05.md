# Combat feedback pass — 2026-09-19

User approved starting the game-feel polish plan with combat feedback.

## Changes

- Warm two-part muzzle flash positioned at each animated weapon socket, lasting four simulation ticks. General has no gun flash. Existing shot/recoil animation remains.
- Player/enemy bullets have short bright trails (up to 0.85 m), with player cream and enemy orange coloring. Trails stay behind the current projectile and are clamped to the travel distance from the launch point. Current instance bounds continue to refresh to avoid the earlier culling bug.
- Actual swept collision points produce red character-hit fragments or gold cover sparks. The last projectile segment remains visible for six ticks even if the bullet was created and removed between rendered frames. Collision effects expire after eighteen ticks, are capped at 64, and use two bounded instanced draw batches. Pauses freeze their simulation-time lifetime.
- Audio polling moves from the 100 ms HUD timer to the animation frame loop. Player gunshots have a sharper transient and longer low-frequency body. Nearby enemy shots now have quieter, distance-attenuated, stereo-positioned cues; remote sounds beyond 18 m are dropped. Cover hits receive a separate cue. The existing 16-voice cap, sound toggle and user-gesture audio unlock remain.
- `/asset-preview` has **Preview combat effects**, a clearly labelled silent offline firing-range fixture. Stationary targets, scripted player fire and real collision mechanics exercise trails, cover sparks and character hits/deaths without Jev calls. It is not live tactical validation.

No changes to legal action candidates, Jev adapter/policy, damage, ammo/cooldown rules, hitboxes or progression. Added impact metadata and audio positions are presentation data, not NPC observations.

## Evidence

47 automated tests pass and the production build passes (existing large-bundle warning remains). New regression cases cover short-range hit retention and exact contact position, bounded/expiring effects, pause behavior, cover blocking damage, and copied enemy-shot audio metadata without new tactical hearing.

Browser inspection of the firing-range fixture showed clear cream trails and gold sparks at the sandbag collision face. Brief displayed FPS was 60. A short stationary live smoke check rendered incoming enemy shots and player hit feedback, but is not a full mission or crowded-combat benchmark. No new provider latency/cost benchmark is claimed.

Audio synthesis and event timing were implemented, but perceptual listening/mix acceptance remains unverified. Sustained busy-fight performance and physical-mobile testing remain open. Next concrete polish step: clearer coffee carrying/slosh/spill/delivery feedback, followed by movement/dodge transitions and a full mission playtest.
