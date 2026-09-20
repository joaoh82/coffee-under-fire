import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  AnimationMixer,
  Box3,
  Vector3,
  SkinnedMesh,
  MeshStandardMaterial,
} from "three";
const root = "apps/web/public/assets/models/";
async function load(file: string) {
  const b = await readFile(root + file);
  return new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
}
const character = await load("soldier_sample.glb");
assert.deepEqual(character.animations.map((a) => a.name).sort(), [
  "idle",
  "run",
]);
let triangles = 0,
  skins = 0;
const materials = new Set<string>();
character.scene.traverse((o) => {
  if (o instanceof SkinnedMesh) {
    skins++;
    triangles +=
      (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m.name);
      if (m instanceof MeshStandardMaterial)
        assert.ok(
          m.color.r < 0.99,
          `Material ${m.name} lost its exported color`,
        );
    }
  }
});
assert.ok(skins > 0);
for (const name of [
  "SOCKET_hand_weapon",
  "SOCKET_hand_coffee",
  "SOCKET_muzzle",
])
  assert.ok(character.scene.getObjectByName(name));
character.scene.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(character.scene);
assert.ok(bounds.max.y > 1.5 && bounds.max.y < 1.8);
assert.ok(Math.abs(bounds.min.y) < 0.05);
const mixer = new AnimationMixer(character.scene);
const idle = mixer
  .clipAction(character.animations.find((a) => a.name === "idle")!)
  .play();
const run = mixer
  .clipAction(character.animations.find((a) => a.name === "run")!)
  .play();
const leg = character.scene.getObjectByName("leg_l")!;
const before = leg.quaternion.clone();
const socket = character.scene.getObjectByName("SOCKET_hand_coffee")!;
const socketBefore = socket.getWorldPosition(new Vector3());
run.setEffectiveWeight(1);
idle.setEffectiveWeight(0);
mixer.update(0.2);
assert.ok(before.angleTo(leg.quaternion) > 0.01);
character.scene.updateMatrixWorld(true);
assert.ok(
  socketBefore.distanceTo(socket.getWorldPosition(new Vector3())) > 0.01,
  "Coffee socket must follow arm animation",
);
idle.reset().setEffectiveWeight(1).play();
run.crossFadeTo(idle, 0.2, false);
mixer.update(0.3);
assert.ok(idle.getEffectiveWeight() > 0.9);
const marker = await load("marker_sample.glb");
marker.scene.updateMatrixWorld(true);
const manifest = JSON.parse(
  await readFile(root + "marker_sample.json", "utf8"),
);
for (const m of manifest.markers) {
  const node = marker.scene.getObjectByName(m.id);
  assert.ok(node);
  const actual = node.getWorldPosition(new Vector3());
  assert.ok(
    actual.distanceTo(new Vector3(m.position.x, m.position.y, m.position.z)) <
      1e-6,
  );
}
const report = {
  source: "Blender Python generator; original project-authored sample",
  blender: "5.2.1 LTS",
  character: {
    source: "assets/blender/characters/soldier_sample.blend",
    runtime: root + "soldier_sample.glb",
    triangles,
    materials: [...materials],
    skinnedMeshes: skins,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    animations: character.animations.map((a) => ({
      name: a.name,
      duration: a.duration,
    })),
    animationBlendVerified: true,
  },
  markers: {
    source: "assets/blender/arena/marker_sample.blend",
    count: manifest.markers.length,
    worldTransformsMatch: true,
  },
  limitations: [
    "Technical pipeline sample only, not final character art.",
    "Upper/lower-body action blending and full gameplay animation roster are not established.",
  ],
};
await writeFile("assets/manifest.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
