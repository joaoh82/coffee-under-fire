import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Mesh, Vector3 } from "three";
import {
  treadPose,
  TREAD_LOOP,
  cannonRecoil,
} from "../apps/web/src/render/tankMotion";
const source = "assets/blender/npcs/tank.blend",
  runtime = "apps/web/public/assets/models/npc_tank.glb";
assert.ok((await stat(source)).size > 0);
const bytes = await readFile(runtime);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
gltf.scene.updateMatrixWorld(true);
for (const name of [
  "HULL",
  "TURRET",
  "CANNON",
  "SOCKET_muzzle",
  ...["L", "R"].flatMap((side) =>
    Array.from({ length: 6 }, (_, i) => `TREAD_${side}_${i}`),
  ),
])
  assert.ok(gltf.scene.getObjectByName(name), name);
const hull = gltf.scene.getObjectByName("HULL")!;
const b = new Box3().setFromObject(hull, true);
assert.ok(
  Math.hypot(
    Math.max(Math.abs(b.min.x), b.max.x),
    Math.max(Math.abs(b.min.z), b.max.z),
  ) <= 1.2,
  "Hull fits gameplay radius",
);
const muzzle = gltf.scene
  .getObjectByName("SOCKET_muzzle")!
  .getWorldPosition(new Vector3());
assert.ok(Math.abs(muzzle.x) < 0.01 && muzzle.z > 1.5 && muzzle.y > 1);
// Check the animated belt at sampled phases, not just the exported rest pose.
const animatedBounds = new Box3();
for (let sample = 0; sample <= 32; sample++) {
  for (const side of ["L", "R"])
    for (let i = 0; i < 6; i++) {
      const link = gltf.scene.getObjectByName(`TREAD_${side}_${i}`)!;
      assert.equal(link.parent, hull);
      const pose = treadPose((i / 6 + sample / 32) * TREAD_LOOP);
      link.position.y = pose.y;
      link.position.z = pose.z;
      link.rotation.x = pose.angle;
    }
  gltf.scene.updateMatrixWorld(true);
  animatedBounds.setFromObject(hull, true);
  assert.ok(
    Math.hypot(
      Math.max(Math.abs(animatedBounds.min.x), animatedBounds.max.x),
      Math.max(Math.abs(animatedBounds.min.z), animatedBounds.max.z),
    ) <= 1.2,
    "Animated treads stay inside hull collision radius",
  );
  assert.ok(animatedBounds.min.y >= 0, "Treads stay above ground");
}
const cannon = gltf.scene.getObjectByName("CANNON")!;
const socket = gltf.scene.getObjectByName("SOCKET_muzzle")!;
assert.equal(socket.parent, cannon);
assert.equal(cannon.parent?.name, "TURRET");
cannon.position.z = -cannonRecoil(0);
gltf.scene.updateMatrixWorld(true);
assert.ok(
  Math.abs(socket.getWorldPosition(new Vector3()).z - (muzzle.z - 0.2)) < 1e-6,
);
cannon.position.z = -cannonRecoil(24);
assert.equal(cannon.position.z, -0);
let triangles = 0,
  meshes = 0;
gltf.scene.traverse((o) => {
  if (o instanceof Mesh) {
    meshes++;
    triangles +=
      (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  }
});
assert.ok(meshes <= 24 && triangles < 2500);
const report = {
  source,
  runtime,
  bytes: bytes.length,
  triangles,
  meshes,
  hullBounds: { min: b.min.toArray(), max: b.max.toArray() },
  muzzle: muzzle.toArray(),
  animation:
    "Runtime hull/turret transforms, distance-driven tread links and cannon recoil; no baked skeletal clips",
  provenance: "Original project-authored geometry; no faction insignia",
};
await writeFile(
  "assets/tank-manifest.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
