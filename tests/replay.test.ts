import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { arena, distance, path } from "../apps/web/src/game/arena";
import { envelope, type DecisionRequest } from "../packages/shared/contracts";
import { replay } from "../apps/web/src/game/driver";
// Passive NPC fixture deliberately isolates mission mechanics. It is not a Jev or combat playtest.
function passive(r: DecisionRequest) {
  return {
    ...envelope(r),
    selected: r.observation.role === "general" ? "map" : "hold",
    source: "mock" as const,
    confidence: 0,
    latencyMs: 0,
    model: "passive-mission-fixture",
    usage: null,
  };
}
test("full eight-minute coffee mission and recorded decisions replay identically (passive mock)", () => {
  const s = new Simulation();
  s.start("mock", "mission_fixture");
  let route: { x: number; z: number }[] = [];
  let destination = "";
  for (let i = 0; i < 480 * 60; i++) {
    for (const n of s.npcs)
      if (!n.action) {
        const r = s.request(n);
        s.apply(r, passive(r));
      }
    const target = s.cup ? s.tent : arena.kitchen;
    const nextDestination = s.cup ? "tent" : "kitchen";
    if (destination !== nextDestination) {
      destination = nextDestination;
      route = path(s.player.pos, target);
    }
    const input = idleInput();
    input.aim = { x: 0, z: 0 };
    if (distance(s.player.pos, target) < 1.7) input.interact = true;
    else {
      while (route.length && distance(s.player.pos, route[0]) < 0.15)
        route.shift();
      const next = route[0];
      if (next) {
        const d = distance(s.player.pos, next);
        input.x = (next.x - s.player.pos.x) / d;
        input.z = (next.z - s.player.pos.z) / d;
      }
    }
    s.step(input);
  }
  assert.equal(s.status, "won");
  assert.ok(s.deliveries >= 5);
  const clone = replay(s.recording);
  assert.equal(clone.status, s.status);
  assert.equal(clone.deliveries, s.deliveries);
  assert.equal(clone.score, s.score);
  assert.deepEqual(clone.player, s.player);
  assert.deepEqual(
    clone.npcs,
    s.npcs.map((n) => ({
      ...n,
      decision: n.decision ? { ...n.decision, source: "replay" } : null,
    })),
  );
});
test("endless mode passes eight minutes and replays the selected mode", () => {
  const s = new Simulation();
  s.start("mock", "endless_fixture", "endless");
  for (let i = 0; i < 481 * 60; i++) s.step(idleInput());
  assert.equal(s.status, "running");
  assert.equal(s.wave, 8);
  const clone = replay(s.recording);
  assert.equal(clone.missionMode, "endless");
  assert.equal(clone.status, "running");
  assert.equal(clone.tick, s.tick);
  assert.deepEqual(clone.player, s.player);
});

test("replay interleaves recovery epochs at a frozen tick and includes terminal checkpoint choices", async () => {
  const s = new Simulation();
  s.start("mock", "checkpoint-fixture");
  const general = s.npcs[0];
  const choose = async () => {
    const r = s.request(general);
    const d = passive(r);
    assert.ok(s.apply(r, d));
  };
  await choose();
  s.pause();
  s.resume();
  await choose();
  s.step(idleInput());
  s.pause();
  s.resume();
  await choose();
  const again = replay(s.recording);
  assert.equal(again.tick, s.tick);
  assert.equal(again.epoch, s.epoch);
  assert.equal(again.recording.decisions.length, 3);
  assert.deepEqual(again.npcs[0].action, general.action);
  assert.equal(again.npcs[0].sequence, general.sequence);
});
