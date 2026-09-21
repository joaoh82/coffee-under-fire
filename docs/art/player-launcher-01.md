# Shoulder launcher and projectile origins

2026-09-21. Original low-poly shoulder launcher authored procedurally in Blender 5.2.1 LTS. No third-party assets used.

## Reproduce

```sh
blender --background --factory-startup --python assets/scripts/generate_launcher.py
npm run build
npm test
```

Editable source: `assets/blender/launcher/shoulder_launcher.blend`. Runtime export: `apps/web/public/assets/models/shoulder_launcher.glb` (approximately 20 KB). The script reads `packages/shared/weapon-mounts.json`; the same coordinates are used by deterministic projectile spawning. Export includes `SOCKET_rocket_muzzle`.

The attachment appears on the player's shoulder only while the rocket upgrade is equipped and the player is alive. It follows the character's facing and posture group, with a short launch flash. Grenades have a hand-side origin and no extra weapon model.

Rifle rounds start at the authored muzzle's position and height; tank shells use the cannon mount, and rockets use the launcher mount. Player projectiles converge on the aimed point. Character facing snaps to firing direction for shots so rapid turns do not visibly shoot out of a still-turning soldier. Simulation uses canonical socket positions, independent of rendered frame rate and cosmetic skeletal recoil; animation remains presentation-only.

The collision solver separately checks center-to-muzzle and muzzle-to-next-position, preventing cover bypass from an offset spawn. New recordings use `muzzle.v1`; recordings without an origin profile preserve legacy `center.v1` trajectories. Projectile visuals are clipped to traveled distance so rocket bodies do not extend backwards through the launcher.

## Verification

- Blender export completed successfully; editable scene and GLB saved.
- Automated GLB socket checks confirm rifle and launcher coordinates match the shared mounts.
- Tests cover rotated origins, aim convergence, close lateral cover and old/new recorded replay behavior.
- Production build and 130 offline tests passed. The four socket/origin tests were rerun after correcting exported material colors.
- Browser firing-range inspection confirmed shoulder placement and projectile presentation. Initial white material export was corrected to node-based olive/brass materials and re-exported.
- Read-only code review reported no blockers. No live Jev calls were needed.
