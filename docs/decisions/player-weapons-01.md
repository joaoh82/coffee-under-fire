# Player arsenal, 2026-09-21

The player keeps mouse/touch aiming and the existing manual or automatic fire control. No new combat buttons are introduced. NPC tactical choices remain exclusively Jev-selected; the changes only affect human-player equipment, deterministic projectile execution and presentation.

## Run upgrades

- Extended magazine: six extra rounds per rank, three ranks, maximum 30. Grants those six rounds immediately; future reloads fill the upgraded capacity.
- Rocket launcher: one extra rocket alongside the rifle every three simulation seconds while successfully firing. 30 damage, 2.4-unit blast radius, impact or 1.5-second expiry detonation.
- Grenade launcher: one extra grenade alongside the rifle every five simulation seconds while successfully firing. One-second flight up to eight units, 24 damage, three-unit blast radius. Contact with an enemy or cover detonates it early.
- Both auxiliary weapons can coexist and do not consume additional rifle ammunition. They do not fire while the rifle is empty or reloading. Pauses freeze flights, fuses and cooldowns. New runs clear all upgrades.

Upgrade selection now shows every available uncapped option, rather than hiding later options behind the first three. The existing scrollable responsive upgrade dialog remains in use. Damage upgrades apply to rifle bullets, as described; explosive damage is fixed for this initial balance pass.

Cover blocks splash damage, directly struck targets take only one explosion hit, and player explosives spare the player and general. Grenade height is a presentation arc; collision remains the deterministic ground-plane cover model. This is a readable arcade rule, not a ballistic simulation.

## Presentation and verification

Instanced rounded brass projectiles have pointed copper noses and retain bright, lighting-independent colours. Rockets are larger; grenades are green and visibly arc. The existing bounded explosion effect and cannon sound are reused. Geometry is disposed on unmount.

Use `/asset-preview`, then **Preview rocket / grenade upgrades**, for the labelled offline fixture. It uses scripted firing and stationary targets, with no provider calls. Browser inspection confirmed the loaded scene and rounded bullet silhouettes; the only console warning observed was the existing Three.js Clock deprecation.

Build and 126 offline tests pass. Coverage includes magazine capacity/reload/reset, auxiliary cooldowns and aim, pause behaviour, grenade expiry, direct/splash damage, protected actors, blocked splash and recorded replay of every new upgrade. The replay regressions continue firing after the recorded upgrade to exercise launches and reloads. No live Jev calls or full mission balance assessment were performed for this change.
