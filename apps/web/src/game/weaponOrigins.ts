import mounts from "../../../../packages/shared/weapon-mounts.json";
import type { Vec } from "../../../../packages/shared/contracts";

export function weaponOrigin(
  pos: Vec,
  angle: number,
  kind: keyof typeof mounts,
) {
  const m = mounts[kind];
  return {
    x: pos.x + m.x * Math.cos(angle) + m.z * Math.sin(angle),
    z: pos.z - m.x * Math.sin(angle) + m.z * Math.cos(angle),
    y: m.y,
  };
}
