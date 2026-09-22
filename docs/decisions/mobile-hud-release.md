# Mobile HUD release, 2026-09-22

The live phone screenshot showed the desktop logo, settings, minimap, objective and footer surrounding the player. An earlier compact HUD existed only in the local uncommitted working copy and had not shipped. This change ports that work onto current main without modifying the original working copy.

During mobile gameplay, health, upgraded magazine capacity, time, wave, level and coffee destination occupy a compact top strip. Portrait uses two rows; landscape places them side by side. The objective opens the map through pause. Logo, desktop cards, FPS and redundant arrival notice are hidden. Pause contains the full map, coffee/XP/score detail, auto-fire/reload, music/effects and Jev dashboard. Critical connection and budget notices remain available.

Translucent 88px thumbsticks and 44px-minimum action buttons stay at the bottom. Portrait stacks the three actions between the sticks; landscape puts them in one row. Safe-area insets protect the controls, and the app uses dynamic viewport height. HUD is hidden while modal mission states are active. Desktop layout remains unchanged at normal desktop dimensions.

Verification uses the actual App HUD, pause and TouchControls components in a development-only presentation fixture. Network transport is stubbed locally, there is no World simulation loop, and start/restart stay local. The fixture is explicitly labeled and never invokes Jev. The screen grid covers 320x568, 390x640, 430x740, 568x320, 667x375 and 844x390. Both active and paused layouts were visually inspected. This is browser layout verification, not physical iPhone Safari or multi-touch gameplay validation.
