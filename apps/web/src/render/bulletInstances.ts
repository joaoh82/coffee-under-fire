import { Color, type InstancedMesh, type Object3D } from "three";
import type { Simulation } from "../game/simulation";

const playerColor = new Color("#ffffff");
const rocketColor = new Color("#dce5e9");
const grenadeColor = new Color("#b3ca68");
const enemyColor = new Color("#e67f42");

export function updateBulletInstances(
  mesh: InstancedMesh,
  bullets: Simulation["bullets"],
  temp: Object3D,
) {
  mesh.count = Math.min(bullets.length, mesh.instanceMatrix.count);
  for (let i = 0; i < mesh.count; i++) {
    const b = bullets[i];
    const speed = Math.hypot(b.velocity.x, b.velocity.z);
    const travelled = b.origin
      ? Math.hypot(b.pos.x - b.origin.x, b.pos.z - b.origin.z)
      : 1;
    const length =
      b.kind === "rocket"
        ? Math.min(0.9, travelled)
        : b.kind === "grenade"
          ? Math.min(0.36, travelled)
          : Math.min(0.65, speed / 40, travelled);
    const back = speed > 0 ? length / (2 * speed) : 0;
    temp.position.set(
      b.pos.x - b.velocity.x * back,
      b.kind === "grenade"
        ? (b.height ?? 0.75) +
            2 * Math.sin(Math.min(1, (b.age ?? 0) / 60) * Math.PI)
        : (b.height ?? 0.75),
      b.pos.z - b.velocity.z * back,
    );
    temp.scale.set(
      b.kind === "grenade"
        ? 0.4
        : b.kind === "rocket"
          ? 0.3
          : b.shell
            ? 0.36
            : b.owner === "player"
              ? 0.2
              : 0.22,
      b.kind ? 0.3 : b.shell ? 0.3 : 0.18,
      Math.max(0.08, length),
    );
    temp.rotation.set(0, Math.atan2(b.velocity.x, b.velocity.z), 0);
    temp.updateMatrix();
    mesh.setMatrixAt(i, temp.matrix);
    mesh.setColorAt(
      i,
      b.kind === "rocket"
        ? rocketColor
        : b.kind === "grenade"
          ? grenadeColor
          : b.owner === "player"
            ? playerColor
            : enemyColor,
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Instance transforms/count change each frame. GPU uploads alone leave stale
  // culling bounds, hiding live bullets when the follow camera moves away.
  mesh.computeBoundingSphere();
}
