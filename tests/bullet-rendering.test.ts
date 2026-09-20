import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { updateBulletInstances } from "../apps/web/src/render/bulletInstances";
import { cameraFrame } from "../apps/web/src/render/camera";

test("bullet visibility follows current instances after empty frames and camera movement", () => {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
    256,
  );
  const temp = new THREE.Object3D();
  try {
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ]) {
      for (const pos of [
        { x: -18, z: -14 },
        { x: 18, z: 14 },
        { x: 0, z: 0 },
      ]) {
        const frame = cameraFrame(width, height, pos);
        const camera = new THREE.OrthographicCamera(
          -width / 2,
          width / 2,
          height / 2,
          -height / 2,
          0.1,
          100,
        );
        camera.zoom = frame.zoom;
        camera.position.set(frame.x, 42, frame.z + 29);
        camera.lookAt(frame.x, 0, frame.z);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const frustum = new THREE.Frustum().setFromProjectionMatrix(
          new THREE.Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
          ),
        );
        updateBulletInstances(mesh, [], temp);
        assert.equal(mesh.count, 0);
        updateBulletInstances(
          mesh,
          [
            {
              id: 1,
              pos,
              velocity: { x: 28, z: 0 },
              owner: "player",
              life: 100,
            },
          ],
          temp,
        );
        assert.equal(mesh.count, 1);
        assert.ok(
          frustum.intersectsObject(mesh),
          `visible bullet at ${JSON.stringify(pos)} in ${width}x${height}`,
        );
        assert.ok(
          mesh.boundingSphere!.containsPoint(
            new THREE.Vector3(pos.x, 0.75, pos.z),
          ),
        );
      }
    }
  } finally {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    mesh.dispose();
  }
});
