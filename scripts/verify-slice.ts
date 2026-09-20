import { animationLayers } from "../apps/web/src/render/animationLayers";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AnimationMixer, Box3, Vector3, Mesh, SkinnedMesh } from "three";
const reports: any[] = [];
for (const name of ["soldier", "kitchen", "tent", "terrain"]) {
  const b = await readFile(`apps/web/public/assets/models/slice_${name}.glb`);
  const gltf = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  let triangles = 0,
    skins = 0;
  const materials = new Set<string>();
  gltf.scene.traverse((o) => {
    if (o instanceof Mesh) {
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m.name);
    }
    if (o instanceof SkinnedMesh) skins++;
  });
  const bounds = new Box3().setFromObject(gltf.scene);
  const clips = gltf.animations.map((a) => a.name).sort();
  if (name === "soldier") {
    assert.deepEqual(clips, ["death", "hit", "idle", "reload", "run", "shoot"]);
    assert.ok(skins > 0);
    assert.ok(bounds.max.y > 1.7 && bounds.max.y < 2);
    assert.ok(bounds.min.y > -0.1);
    for (const a of gltf.animations) {
      const mixer = new AnimationMixer(gltf.scene);
      const bones = ["root", "body", "arm_l", "arm_r", "leg_l", "leg_r"].map(
        (n) => gltf.scene.getObjectByName(n)!,
      );
      assert.ok(bones.every(Boolean));
      const before = bones.map((b) => ({
        q: b.quaternion.clone(),
        p: b.position.clone(),
      }));
      mixer.clipAction(a).play();
      mixer.update(a.duration * 0.27);
      assert.ok(
        bones.some(
          (b, i) =>
            b.quaternion.angleTo(before[i].q) > 0.001 ||
            b.position.distanceTo(before[i].p) > 0.001,
        ),
        `clip ${a.name} must move bones`,
      );
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
    }
    const layers = animationLayers(gltf.animations);
    const lower = layers.find((a) => a.name === "lower_run")!;
    const upper = layers.find((a) => a.name === "upper_shoot")!;
    assert.ok(lower.tracks.length > 0 && upper.tracks.length > 0);
    assert.ok(!upper.tracks.some((t) => t.name.startsWith("leg_")));
    const blend = new AnimationMixer(gltf.scene);
    const leg = gltf.scene.getObjectByName("leg_l")!,
      arm = gltf.scene.getObjectByName("arm_r")!;
    const legBefore = leg.quaternion.clone(),
      armBefore = arm.quaternion.clone();
    blend.clipAction(lower).play();
    blend.clipAction(upper).play();
    blend.update(0.1);
    assert.ok(
      leg.quaternion.angleTo(legBefore) > 0.01 &&
        arm.quaternion.angleTo(armBefore) > 0.01,
      "running legs and shooting arm must animate concurrently",
    );
    blend.stopAllAction();
    blend.uncacheRoot(gltf.scene);
    for (const n of [
      "SOCKET_hand_weapon",
      "SOCKET_hand_coffee",
      "SOCKET_muzzle",
    ])
      assert.ok(gltf.scene.getObjectByName(n));
  } else if (name !== "terrain") {
    const marker = gltf.scene.getObjectByName(`MARKER_${name}_interact`);
    assert.ok(marker);
    gltf.scene.updateMatrixWorld(true);
    assert.ok(marker.getWorldPosition(new Vector3()).length() < 1e-6);
  }
  reports.push({
    name,
    source: `assets/blender/slice/${name}.blend`,
    runtime: `apps/web/public/assets/models/slice_${name}.glb`,
    provenance:
      "Original project-authored procedural geometry; no third-party assets or insignia",
    bytes: b.length,
    triangles,
    skins,
    materials: [...materials],
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    clips,
  });
}
await writeFile(
  "assets/slice-manifest.json",
  JSON.stringify(
    {
      generator: "assets/scripts/generate_slice.py",
      blender: "5.2.1 LTS",
      reports,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(reports, null, 2));
