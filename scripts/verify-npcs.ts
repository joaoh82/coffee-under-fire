import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AnimationMixer, Box3, Mesh, SkinnedMesh } from "three";
import { animationLayers } from "../apps/web/src/render/animationLayers";

const reports = [];
for (const role of [
  "rifleman",
  "rifleman_scout",
  "rifleman_veteran",
  "general",
]) {
  const runtime = `apps/web/public/assets/models/npc_${role}.glb`;
  const source = `assets/blender/npcs/${role}.blend`;
  assert.ok((await stat(source)).size > 0);
  const bytes = await readFile(runtime);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const expected = [
    "idle",
    "run",
    "shoot",
    "reload",
    "hit",
    "death",
    ...(role === "general" ? ["map", "watch", "sip", "pleased"] : []),
  ];
  assert.deepEqual(gltf.animations.map((a) => a.name).sort(), expected.sort());
  const bounds = new Box3().setFromObject(gltf.scene);
  assert.ok(bounds.min.y > -0.1 && bounds.max.y > 1.6 && bounds.max.y < 2);
  let meshes = 0,
    triangles = 0;
  const materials = new Set<string>();
  gltf.scene.traverse((o) => {
    if (o instanceof Mesh) {
      meshes++;
      assert.ok(o instanceof SkinnedMesh, `${o.name} must be rigged`);
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m.name);
    }
  });
  assert.ok(meshes <= 10, `${role} export exceeds ten mesh primitives`);
  assert.ok(triangles < 1800);
  for (const socket of [
    "SOCKET_hand_weapon",
    "SOCKET_hand_coffee",
    "SOCKET_muzzle",
  ])
    assert.ok(gltf.scene.getObjectByName(socket));
  for (const clip of gltf.animations) {
    const instance = clone(gltf.scene),
      untouched = clone(gltf.scene);
    const names = ["root", "body", "arm_l", "arm_r", "leg_l", "leg_r"];
    const before = names.map((name) => {
      const bone = instance.getObjectByName(name)!;
      assert.ok(bone);
      return { p: bone.position.clone(), q: bone.quaternion.clone() };
    });
    const mixer = new AnimationMixer(instance);
    mixer.clipAction(clip).play();
    mixer.update(clip.duration * 0.27);
    assert.ok(
      names.some((name, i) => {
        const bone = instance.getObjectByName(name)!;
        return (
          bone.position.distanceTo(before[i].p) > 0.001 ||
          bone.quaternion.angleTo(before[i].q) > 0.001
        );
      }),
      `${role}/${clip.name} must move bones`,
    );
    names.forEach((name, i) => {
      const bone = untouched.getObjectByName(name)!;
      assert.ok(
        bone.position.distanceTo(before[i].p) < 1e-6 &&
          bone.quaternion.angleTo(before[i].q) < 1e-6,
        "clones must animate independently",
      );
    });
    // Validate deformed geometry too, not just named animation tracks.
    instance.updateMatrixWorld(true);
    const posed = new Box3().setFromObject(instance, true);
    assert.ok(
      posed.min.toArray().concat(posed.max.toArray()).every(Number.isFinite),
    );
    assert.ok(
      posed.getSize(bounds.min.clone()).length() < 5,
      "skin stays attached to character",
    );
    if (clip.name === "death") {
      mixer.setTime(clip.duration * 0.95);
      instance.updateMatrixWorld(true);
      const fallen = new Box3().setFromObject(instance, true);
      assert.ok(
        fallen.min.y > -0.06,
        `${role} death must stay above ground: ${fallen.min.y}`,
      );
      assert.ok(fallen.max.y < 1.4, "death finishes in a low, fallen pose");
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(instance);
  }
  const layers = animationLayers(gltf.animations);
  const combined = clone(gltf.scene),
    blend = new AnimationMixer(combined);
  const leg = combined.getObjectByName("leg_l")!,
    arm = combined.getObjectByName("arm_r")!;
  const oldLeg = leg.quaternion.clone(),
    oldArm = arm.quaternion.clone();
  blend.clipAction(layers.find((a) => a.name === "lower_run")!).play();
  blend.clipAction(layers.find((a) => a.name === "upper_shoot")!).play();
  blend.update(0.1);
  assert.ok(
    leg.quaternion.angleTo(oldLeg) > 0.01 &&
      arm.quaternion.angleTo(oldArm) > 0.01,
  );
  blend.stopAllAction();
  blend.uncacheRoot(combined);
  reports.push({
    role,
    source,
    runtime,
    bytes: bytes.length,
    triangles,
    meshPrimitives: meshes,
    materials: [...materials],
    clips: expected,
    provenance:
      "Original project-authored geometry, derived from the project soldier rig; no third-party models or faction insignia",
  });
}
await writeFile(
  "assets/npc-manifest.json",
  JSON.stringify(
    {
      generator: "assets/scripts/generate_npcs.py",
      blender: "5.2.1 LTS",
      reports,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(reports, null, 2));
