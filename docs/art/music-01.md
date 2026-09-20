# Coffee Patrol instrumental and Jev callout — 2026-09-19

Added an original code-composed 40-second, sixteen-bar instrumental loop at 96 BPM, using synthesized plucked notes, flute-like lead, bass and quiet brushed-noise percussion. No external samples, third-party melodies or music-generation service were used.

- Runtime: `apps/web/public/assets/audio/coffee-patrol-v1.wav` (mono PCM16, 22,050 Hz, 1,764,044 bytes).
- Editable composition/generator: `assets/scripts/generate_music.py`. Reproduce with `npm run assets:music` (Python standard library only).
- Measured waveform: peak 0.649994, RMS 0.132561, loop boundary sample step 0.0000916. These are signal measurements, not a claim of listening/mix acceptance. Manifest: `assets/music-manifest.json`.
- Music has a separate toggle from effects, available on the briefing and in-game HUD. It begins on the user's start gesture, loops through active gameplay/upgrade selection, pauses on explicit pause, reconnect, tab blur, results or return to briefing, and resumes at its current position. Playback volume is 0.18. There is one lazily created audio element, no unbounded scheduling, and disposal releases its source.
- Tests cover no pre-gesture autoplay, a single loop, mute, pause/resume, pending play cancellation, disposal, failure without repeated retries, and expected AbortError interruptions. Listening quality on speakers/headphones and physical-mobile playback remain unverified.

The briefing now prominently states “NPCs powered by Jev,” names TypeSafe AI, calls the game an AI proof of concept, and explains the split between NPC tactical choices and deterministic movement/aim/combat. A button opens the existing real decision dashboard. It does not invent live responses or imply the service is connected before starting a session. The 'Jev' text treatment is typography, not an official provider logo.

79 tests and production build pass; browser inspected the callout and dashboard entry. No new live Jev benchmark was needed or run; existing inference behavior is unchanged.
