# Illustrated briefing and logo — 2026-09-19

The user requested a more illustrated briefing, visual game-mode selection and a game logo. The shipped direction combines a battered enamel mug and helmet with large angular lettering. The briefing uses an olive frame (#43543b), field-paper background (#e9dfbd), pale card stock (#f4edce), selected olive tint (#d0d4a8) and coffee-rust action button (#a94e27). Existing Trebuchet body text keeps instructions compact; generated block lettering carries the game identity instead of the previous serif headline.

The two modes use native radio inputs, keyboard focus indicators and project-authored SVG map/stopwatch/infinity illustrations. Three short coffee/progression instructions lead to the start button; controls and service details live in an expandable field manual. The briefing scrolls on short screens. Mobile CSS is included; physical-device validation remains open.

Logo asset: `apps/web/public/assets/brand/coffee-under-fire-logo-v1.png` (1774 × 887, alpha PNG). Generated using the built-in image_gen tool, copied into the repository without overwriting the generated source. This is a raster logo, not an editable vector. The editable mode illustrations are in `apps/web/src/ui/Briefing.tsx`.

## Generation prompt

Create an original professional game logo for 'COFFEE UNDER FIRE', a cozy cartoon low-poly fictional WWII top-down shooter about delivering coffee under fire. Transparent background, wide landscape composition, isolated clean silhouette. Big highly readable chunky hand-lettered block lettering: COFFEE on the first line in warm ivory, UNDER FIRE on the second in muted ochre, dark forest-green thick outline and modest dimensional shadow. Emblem left of lettering: a battered enamel coffee mug in army green with ivory rim, dark coffee splashing a little, an olive soldier helmet tilted over the mug, three bold steam wisps and two small orange spark shapes. Strong angular low-poly cartoon planes, playful but battle-worn, restrained worn edges, not overly cute. Balanced integrated emblem and wordmark, professional game title screen quality, remains legible at 300px wide. Exact text only COFFEE UNDER FIRE, no other words, no insignia, no national flags, no Nazi symbols, no guns, no background scene, no extra border or rectangular backing. Actual alpha transparency outside the logo. Output as PNG.

## Validation

The generated image was visually inspected for readable title text and the requested mug/helmet concept. It renders with transparency in the briefing and HUD. Browser inspection confirmed mode selection updates the checked radio and start-button label. These screenshots are UI evidence, not performance or physical-mobile acceptance.
