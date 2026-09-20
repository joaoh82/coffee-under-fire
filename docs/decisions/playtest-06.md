# Coffee presentation pass — 2026-09-19

User approved clearer carried coffee, sloshing, spill feedback and delivery response, retaining the light secondary challenge.

- Player mug is now larger and open, with a visible liquid surface that follows actual fullness. Cosmetic sway/slosh reacts to movement and recent spills; warmth controls three small rising steam puffs. The Blender-authored coffee attachment socket drives placement after skeletal animation. The general's existing animated mug is unchanged.
- Original editable runtime geometry lives in `apps/web/src/render/CarriedCoffee.tsx`. The underlying `.blend`/GLB character and sockets remain unchanged; no new Blender export is claimed. Geometry is constructed reproducibly by the normal web build.
- Bounded coffee feedback snapshots preserve each spill's world position instead of following the moving player. Small brown droplets and a ground ring mark a spill; fill/delivery use cream/gold particles and rings. Effects last at most two simulation seconds, freeze with simulation time and are capped at eight events / 64 particles / eight rings.
- HUD announces fresh coffee, actual spilled amount, and successful delivery with actual score and health restored. Filling and handing-over progress have explicit labels. A refill cue is emitted for meaningfully depleted coffee, without repeating every 0.6 seconds while holding a full mug at the kitchen.
- Added synthesized spill sound and adjusted delivery chime. Listening/mix acceptance remains unverified.

Mechanical rules remain the same: no volume loss from normal movement, five-point hit/dodge spills (or remaining volume if lower), shared one-second spill cooldown, warmth decay, hold-to-interact duration, delivery validity and rewards. New presentation data does not enter Jev observations or choices.

## Evidence and next step

52 automated tests and production build pass; existing large-bundle warning remains. New tests verify exact spill amounts and fixed event positions, cooldown/no duplicate effects, actual capped healing/reward values, no duplicate delivery, bounded event storage, pause and expiry. Existing movement-volume and recorded-decision replay tests still pass.

Browser inspection of idle and run previews confirms the larger attached open mug, liquid and steam. Full live coffee-delivery playthrough, physical mobile readability and perceptual audio acceptance remain unverified in this pass. No provider calls or latency/cost benchmark were required for this pass.

Next concrete step: smooth movement/dodge transitions, then play the complete mission with the polished effects and check crowd performance and difficulty.
