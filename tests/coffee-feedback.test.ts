import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";

function world() {
  const s = new Simulation();
  s.start("mock", "coffee-feedback-fixture");
  return s;
}
test("spill feedback uses the actual loss, stays at the spill, and respects the cooldown", () => {
  const s = world();
  s.cup = { volume: 3, warmth: 100 };
  const origin = { ...s.player.pos };
  s.spill();
  s.spill();
  assert.equal(s.cup.volume, 0);
  assert.equal(s.coffeeFeedback.length, 1);
  assert.equal(s.coffeeFeedback[0].amount, 3);
  s.player.pos.x += 2;
  assert.deepEqual(s.coffeeFeedback[0].pos, origin);
  assert.equal(s.events.filter((e) => e.kind === "spill").length, 1);
});
test("fill and delivery feedback report real rewards without duplicating delivery", () => {
  const s = world();
  for (let i = 0; i < 36; i++) s.step({ ...idleInput(), interact: true });
  assert.equal(s.coffeeFeedback.at(-1)?.kind, "fill");
  s.player.hp = 95;
  s.player.pos = { ...s.tent };
  const before = s.score;
  for (let i = 0; i < 36; i++) s.step({ ...idleInput(), interact: true });
  const result = s.coffeeFeedback.at(-1)!;
  assert.equal(result.kind, "delivery");
  assert.equal(result.amount, 5);
  assert.equal(result.score, s.score - before);
  assert.equal(s.deliveries, 1);
  assert.equal(s.cup, null);
  for (let i = 0; i < 40; i++) s.step({ ...idleInput(), interact: true });
  assert.equal(s.coffeeFeedback.filter((f) => f.kind === "delivery").length, 1);
});
test("coffee feedback is bounded, paused with the simulation, and expires", () => {
  const s = world();
  for (let i = 0; i < 20; i++) s.recordCoffee("fill");
  assert.equal(s.coffeeFeedback.length, 8);
  s.pause();
  for (let i = 0; i < 200; i++) s.step(idleInput());
  assert.equal(s.coffeeFeedback.length, 8);
  s.resume();
  for (let i = 0; i < 120; i++) s.step(idleInput());
  assert.equal(s.coffeeFeedback.length, 0);
});
