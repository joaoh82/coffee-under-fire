import type { Vec } from "../../../../packages/shared/contracts";
// Fixed gameplay scale: the bounded 44 x 36 map is larger than every viewport.
export function cameraFrame(width: number, height: number, player: Vec) {
  const zoom = Math.max(width / 28, height / 20, 1);
  const halfX = width / zoom / 2;
  const halfZ = height / zoom / 2 / (42 / Math.hypot(42, 29));
  return {
    zoom,
    x: Math.max(-22 + halfX, Math.min(22 - halfX, player.x)),
    z: Math.max(-18 + halfZ, Math.min(18 - halfZ, player.z)),
  };
}
