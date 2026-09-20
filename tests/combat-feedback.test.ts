import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";

const world = () => {
  const sim = new Simulation();
  sim.start("mock", "combat-feedback-fixture");
  return sim;
};

test("close-range hits retain an exact impact after the projectile is removed", () => {
  const sim = world();
  const enemy = sim.addNPC("rifleman", { x: 0, z: 5 });
  sim.bullets.push({
    id: 99,
    owner: "player",
    life: 150,
    pos: { x: 0, z: 4.4 },
    velocity: { x: 0, z: 24 },
  });
  sim.step(idleInput());
  assert.equal(enemy.hp, 20);
  assert.equal(sim.bullets.length, 0);
  assert.equal(sim.impacts.length, 1);
  assert.equal(sim.impacts[0].target, "actor");
  assert.ok(Math.abs(sim.impacts[0].pos.z - 4.55) < 1e-8);
  assert.deepEqual(sim.impacts[0].from, { x: 0, z: 4.4 });
  const snapshot = structuredClone(sim.impacts);
  sim.pause();
  sim.step(idleInput());
  assert.deepEqual(sim.impacts, snapshot);
  sim.resume();
  for (let i = 0; i < 18; i++) sim.step(idleInput());
  assert.equal(sim.impacts.length, 0);
});

test("cover impacts stop at the collider, stay bounded, and do not damage actors behind it", () => {
  const sim = world();
  const enemy = sim.addNPC("rifleman", { x: -6, z: 2 });
  for (let i = 0; i < 80; i++)
    sim.bullets.push({
      id: i,
      owner: "player",
      life: 150,
      pos: { x: -6, z: -1.5 },
      velocity: { x: 0, z: 300 },
    });
  sim.step(idleInput());
  assert.equal(enemy.hp, 30);
  assert.equal(sim.bullets.length, 0);
  assert.equal(sim.impacts.length, 64);
  assert.ok(
    sim.impacts.every(
      (i) => i.target === "cover" && Math.abs(i.pos.z + 0.72) < 1e-8,
    ),
  );
  assert.equal(sim.events.length, 64);
});

test("enemy gunshot audio carries copied position metadata without supplying tactical perception", () => {
  const sim = world();
  const enemy = sim.addNPC("rifleman", { x: 0, z: 5 });
  sim.shoot(enemy, 18);
  const shot = sim.events.at(-1)!;
  assert.equal(shot.kind, "shot");
  assert.equal(shot.enemy, true);
  assert.deepEqual(shot.pos, { x: 0, z: 5 });
  enemy.pos.x = 4;
  assert.equal(shot.pos?.x, 0);
  assert.equal(enemy.lastHeard, null);
});
