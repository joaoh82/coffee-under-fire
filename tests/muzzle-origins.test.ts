import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Vector3 } from "three";
import mounts from "../packages/shared/weapon-mounts.json";
import { weaponOrigin } from "../apps/web/src/game/weaponOrigins";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { replay } from "../apps/web/src/game/driver";

test("authored rifle and shoulder launcher sockets match deterministic muzzle mounts", async () => {
  for (const [file, socket, mount] of [
    ["slice_soldier.glb", "SOCKET_muzzle", mounts.rifle],
    ["shoulder_launcher.glb", "SOCKET_rocket_muzzle", mounts.rocket],
  ] as const) {
    const bytes = await readFile(`apps/web/public/assets/models/${file}`);
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    gltf.scene.updateMatrixWorld(true);
    const object = gltf.scene.getObjectByName(socket);
    assert.ok(object);
    const pos = object.getWorldPosition(new Vector3());
    assert.ok(
      pos.distanceTo(new Vector3(mount.x, mount.y, mount.z)) < 0.001,
      `${file}: ${pos.toArray()}`,
    );
  }
});
test("muzzles rotate with actors and player rounds converge on the aimed point", () => {
  const pos = { x: 3, z: 4 };
  const facingRight = weaponOrigin(pos, Math.PI / 2, "rifle");
  assert.ok(Math.abs(facingRight.x - 3.83) < 1e-8);
  assert.ok(Math.abs(facingRight.z - 3.6) < 1e-8);
  const s = new Simulation();
  s.player.pos = { x: 0, z: 0 };
  const aim = { x: 0, z: 8 };
  s.shoot(s.player, 26, aim);
  const b = s.bullets[0];
  assert.deepEqual(b.pos, { x: 0.4, z: 0.83 });
  assert.equal(b.height, 0.89);
  assert.ok(
    Math.abs(
      (aim.x - b.pos.x) * b.velocity.z - (aim.z - b.pos.z) * b.velocity.x,
    ) < 1e-8,
  );
});
test("initial shot sweeps center to muzzle separately, so lateral cover cannot be skipped", () => {
  const s = new Simulation();
  s.start("mock", "muzzle-cover-fixture");
  s.npcs = [];
  s.player.pos = { x: 0, z: 0 };
  s.arena = {
    ...s.arena,
    obstacles: [{ id: "edge", x: 0.51, z: 0.74, w: 0.1, d: 0.12 }],
  };
  s.step({ ...idleInput(), aim: { x: 0, z: 8 }, fire: true });
  assert.equal(s.bullets.length, 0);
  assert.equal(s.impacts.length, 1);
  assert.equal(s.impacts[0].target, "cover");
  assert.ok(s.impacts[0].pos.z < 0.83);
});
test("legacy recordings retain center origins while new recordings use muzzle origins", () => {
  for (const legacy of [true, false]) {
    const s = new Simulation();
    if (legacy) s.projectileOriginProfile = "center.v1";
    s.start("mock", "origin-replay");
    s.step({ ...idleInput(), aim: { x: 0, z: 0 }, fire: true });
    if (legacy) delete s.recording.projectileOriginProfile;
    const copy = replay(s.recording);
    assert.deepEqual(copy.bullets, s.bullets);
    assert.equal(
      copy.recording.projectileOriginProfile,
      legacy ? "center.v1" : "muzzle.v1",
    );
  }
});
