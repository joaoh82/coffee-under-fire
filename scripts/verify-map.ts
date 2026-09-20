import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, Vector3, Box3 } from "three";
import { MAPS } from "../apps/web/src/game/maps";
const village = process.argv.includes("--village");
const name = village ? "village" : "outpost";
const arena = MAPS[village ? "village.v1" : "woodland.v1"].layout;
const root = "apps/web/public/assets/models/";
const manifest = JSON.parse(
  await readFile(root + `${name}-markers.json`, "utf8"),
);
assert.deepEqual(
  manifest.layout,
  arena,
  "Blender and simulation must share exactly the same layout",
);
const b = await readFile(root + `${name}_map.glb`);
const gltf = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  "",
);
gltf.scene.updateMatrixWorld(true);
for (const marker of manifest.markers) {
  const obj = gltf.scene.getObjectByName(marker.id);
  assert.ok(obj, marker.id);
  assert.ok(
    obj
      .getWorldPosition(new Vector3())
      .distanceTo(
        new Vector3(...(marker.position as [number, number, number])),
      ) < 1e-5,
    marker.id,
  );
  if (marker.width) {
    assert.equal(obj.userData.width, marker.width);
    assert.equal(obj.userData.depth, marker.depth);
  }
}
let triangles = 0,
  meshes = 0,
  drawCalls = 0;
const materials = new Set<string>();
gltf.scene.traverse((o) => {
  if (o instanceof Mesh) {
    meshes++;
    triangles +=
      (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    drawCalls += Math.max(1, o.geometry.groups.length);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materials.add(m.name);
  }
});
assert.ok(drawCalls <= 24, `Scenery draw calls: ${drawCalls}`);
assert.ok(triangles < 20000);
const bounds = new Box3().setFromObject(gltf.scene, true);
const report = {
  source: `assets/blender/map/${name}.blend`,
  generator: `assets/scripts/generate_${village ? "village" : "map"}.py`,
  layout: `packages/shared/${village ? "village" : "map"}-layout.json`,
  runtime: root + `${name}_map.glb`,
  provenance:
    "Original project-authored geometry, deterministic generation; no external assets",
  bytes: b.length,
  triangles,
  meshes,
  drawCalls,
  materials: [...materials],
  markersVerified: manifest.markers.length,
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
};
await writeFile(
  `assets/${village ? "village" : "map"}-manifest.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
