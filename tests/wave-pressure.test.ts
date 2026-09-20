import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { replay } from "../apps/web/src/game/driver";
import { waveSettings } from "../apps/web/src/game/waveProfile";
import { motionPose } from "../apps/web/src/render/motionPose";

test("pressure profile brings a pair in early and fills the first-wave cap sooner without stronger infantry", () => {
  const s = new Simulation();
  s.start("mock", "pressure-fixture");
  for (let i = 0; i < 390; i++) s.step(idleInput());
  assert.equal(s.npcs.filter((n) => n.role === "rifleman").length, 2);
  for (let i = 390; i < 1800; i++) s.step(idleInput());
  assert.equal(s.npcs.filter((n) => n.role === "rifleman").length, 10);
  assert.ok(
    s.npcs.filter((n) => n.role === "rifleman").every((n) => n.hp === 30),
  );
  assert.equal(s.recording.waveProfile, "pressure.v1");
  const again = replay(s.recording);
  assert.deepEqual(
    again.npcs.map((n) => [n.id, n.pos]),
    s.npcs.map((n) => [n.id, n.pos]),
  );
});
test("pressure cap ramps to fourteen and old recordings without a profile retain legacy spawns", () => {
  assert.deepEqual(
    [0, 1, 2, 7].map((w) => waveSettings(w).cap),
    [10, 12, 14, 14],
  );
  assert.equal(waveSettings(3).batch, 3);
  const s = new Simulation();
  s.waveProfile = "legacy";
  s.start("mock", "legacy-fixture");
  for (let i = 0; i < 1800; i++) s.step(idleInput());
  assert.equal(s.npcs.filter((n) => n.role === "rifleman").length, 4);
  delete s.recording.waveProfile;
  const again = replay(s.recording);
  assert.equal(again.waveProfile, "legacy");
  assert.deepEqual(
    again.npcs.map((n) => [n.id, n.pos]),
    s.npcs.map((n) => [n.id, n.pos]),
  );
});
test("dodge pose stays bounded, mirrors movement direction, and returns to normal", () => {
  const right = motionPose(12.5, 1, 0, 6),
    left = motionPose(12.5, -1, 0, 6);
  assert.equal(right.roll, -left.roll);
  assert.ok(right.squash >= 0.85 && right.height >= 0);
  assert.ok(right.strideRate <= 2.2);
  assert.deepEqual(motionPose(0, 0, 0, -1), motionPose(0, 0, 0, 12));
});
