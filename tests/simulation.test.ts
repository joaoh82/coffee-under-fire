import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { arena, path, clear, segmentBox } from "../apps/web/src/game/arena";
const world = () => {
  const s = new Simulation();
  s.start("mock", "fixture");
  return s;
};
test("ordinary movement costs no coffee volume; warmth decays by simulation time", () => {
  const s = world();
  s.cup = { volume: 100, warmth: 100 };
  for (let i = 0; i < 120; i++) s.step({ ...idleInput(), x: 1 });
  assert.equal(s.cup.volume, 100);
  assert.ok(Math.abs(s.cup.warmth - 99) < 1e-8);
});
test("simultaneous hit and dodge share spill cooldown", () => {
  const s = world();
  s.cup = { volume: 100, warmth: 100 };
  s.damage(s.player, 8);
  s.step({ ...idleInput(), dodge: true });
  assert.equal(s.cup.volume, 95);
});
test("pickup and delivery cannot duplicate a cup credit", () => {
  const s = world();
  for (let i = 0; i < 36; i++) s.step({ ...idleInput(), interact: true });
  assert.ok(s.cup);
  s.player.pos = { ...s.tent };
  for (let i = 0; i < 150; i++) s.step({ ...idleInput(), interact: true });
  assert.equal(s.deliveries, 1);
  assert.equal(s.cup, null);
});
test("failed coffee cannot earn delivery credit", () => {
  const s = world();
  s.cup = { volume: 24, warmth: 100 };
  s.player.pos = { ...s.tent };
  for (let i = 0; i < 36; i++) s.step({ ...idleInput(), interact: true });
  assert.equal(s.deliveries, 0);
});
test("survival alone fails; five deliveries plus survival wins at deadline", () => {
  for (const deliveries of [0, 5]) {
    const s = world();
    s.deliveries = deliveries;
    s.tick = 480 * 60 - 1;
    s.step(idleInput());
    assert.equal(s.status, deliveries === 5 ? "won" : "lost");
  }
});
test("pause freezes coffee, input and scheduling", () => {
  const s = world();
  s.cup = { volume: 100, warmth: 100 };
  s.pause();
  s.step({ ...idleInput(), dodge: true });
  assert.equal(s.tick, 0);
  assert.equal(s.cup.warmth, 100);
  assert.equal(s.cup.volume, 100);
});
test("swept projectiles cannot tunnel through thin wall", () => {
  assert.ok(
    segmentBox(
      { x: 0, z: -10 },
      { x: 0, z: 10 },
      { id: "thin", x: 0, z: 0, w: 2, d: 0.1 },
    ) !== null,
  );
});
test("all objectives have two separated reachable approaches with collider clearance", () => {
  for (const tent of arena.tents) {
    for (const dx of [-1, 1]) {
      const route = path(arena.kitchen, { x: tent.x + dx, z: tent.z });
      assert.ok(route.length > 0);
      assert.ok(route.every((p) => clear(p)));
    }
  }
});
test("finite wave spawn cap and exclusion zones", () => {
  const s = world();
  for (let i = 0; i < 480 * 60; i++) s.step(idleInput());
  assert.ok(s.npcs.filter((n) => n.role === "rifleman").length <= 14);
  for (const n of s.npcs.filter((n) => n.role === "rifleman"))
    assert.ok(clear(n.pos));
  assert.equal(s.status, "lost");
});
test("first patrol is telegraphed at five seconds and arrives at six", () => {
  const s = world();
  for (let i = 0; i < 299; i++) s.step(idleInput());
  assert.equal(s.telegraphs.length, 0);
  s.step(idleInput());
  assert.equal(s.telegraphs.length, 1);
  for (let i = 0; i < 60; i++) s.step(idleInput());
  assert.equal(s.npcs.filter((n) => n.role === "rifleman").length, 1);
});
test("sound observations expire and do not track an unseen player", () => {
  const s = world();
  const n = s.addNPC("rifleman", { x: -17, z: -3 });
  s.hear("gunfire");
  const heard = structuredClone(n.lastHeard);
  s.player.pos = { x: 20, z: 15 };
  const request = s.request(n);
  assert.deepEqual(request.observation.audible?.position, heard?.position);
  assert.equal(request.observation.visible.length, 0);
  assert.ok(request.candidates.some((c) => c.id === "advance_contact"));
  assert.equal(n.action, null);
  s.tick += 181;
  assert.equal(s.request(n).observation.audible, null);
  assert.ok(!s.candidates(n).some((c) => c.id === "advance_contact"));
});
test("endless replay capture stays bounded after thirty minutes", () => {
  const s = world();
  s.missionMode = "endless";
  s.tick = 30 * 60 * 60;
  s.step(idleInput());
  assert.equal(s.status, "running");
  assert.equal(s.recording.truncated, true);
  assert.equal(s.recording.inputs.length, 0);
});
