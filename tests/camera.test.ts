import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraFrame } from "../apps/web/src/render/camera";
test("following viewport stays inside the bounded map at desktop and mobile aspect ratios", () => {
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [844, 390],
  ]) {
    for (const x of [-21, 0, 21])
      for (const z of [-17, 0, 17]) {
        const f = cameraFrame(width, height, { x, z });
        const halfX = width / f.zoom / 2;
        const halfZ = height / f.zoom / 2 / (42 / Math.hypot(42, 29));
        assert.ok(f.x - halfX >= -22 - 1e-8 && f.x + halfX <= 22 + 1e-8);
        assert.ok(f.z - halfZ >= -18 - 1e-8 && f.z + halfZ <= 18 + 1e-8);
        assert.ok(halfX * 2 < 44 && halfZ * 2 < 36);
      }
  }
});
test("camera follows player positions inside the edge limits", () => {
  assert.equal(cameraFrame(1280, 720, { x: 2, z: 1 }).x, 2);
  assert.equal(cameraFrame(1280, 720, { x: 2, z: 1 }).z, 1);
});
