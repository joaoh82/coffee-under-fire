# Field march and weapon-toggle fix — 2026-09-19

User feedback: the first music loop felt too gentle, and auto-shoot did not respond to clicks.

## Music

Replaced the active track with an original 112 BPM, sixteen-bar minor-key march: marching bass drum, snare backbeats/rolls, low string-like ostinato and short harmonically richer brass-like calls. Runtime playback volume increased from 0.18 to 0.28. No external samples or borrowed tunes. The first WAV and its generator remain available as v1.

Active asset: `apps/web/public/assets/audio/coffee-patrol-v2.wav`. Rebuild with `npm run assets:music`; the generator also updates `assets/music-manifest.json`. Measured duration 34.285714 s, mono PCM16 / 22,050 Hz, 1,512,044 bytes; peak 0.779968, RMS 0.168727. These are waveform measurements; the musical feel and speaker/headphone mix need user listening feedback.

## Auto-fire cause and fix

The footer has `pointer-events: none`, with pointer events restored only for buttons. Both previous checkbox inputs inherited the disabled pointer interaction. Their simulation handlers were valid, but the UI could not receive clicks.

Replaced auto-fire and auto-reload with explicit on/off buttons in the lower-left vitals panel, matching the music/effects control pattern. Buttons have `aria-pressed`, a selected appearance and explicit pointer interaction. Auto-fire still shoots toward the human player's mouse/touch aim; it does not select targets. Existing preference preservation across restarts and firing/reloading rules remain unchanged.

## Evidence

- 79 tests and production build pass, including existing auto-fire/auto-reload mechanics and music lifecycle tests updated to the new level.
- Live browser UI smoke check: clicked Auto-fire: off → on, observed ammo fall from 12 to 9 without holding fire, clicked Auto-reload: on → off, then restored Auto-fire: off and Auto-reload: on. Returned to briefing after the check. A first stationary smoke attempt ended before inspection; the immediate-start check provided the toggle evidence. This is not a full mission or provider reliability benchmark.
- No new provider latency/cost measurements. Listening acceptance and physical-mobile validation remain open.
