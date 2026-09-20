import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../apps/web/src/game/simulation";
import {
  syncNpcVisuals,
  CORPSE_TICKS,
  MAX_CORPSES,
} from "../apps/web/src/render/npcVisuals";

test("NPC visuals keep stable actor identity as another enemy dies", () => {
  const sim = new Simulation();
  sim.addNPC("rifleman", { x: 0, z: 0 });
  sim.addNPC("rifleman", { x: 2, z: 0 });
  const first = syncNpcVisuals([], sim.npcs, 0);
  assert.equal(syncNpcVisuals(first, sim.npcs, 1), first);
  const dead = sim.npcs[1],
    survivor = first[2];
  sim.damage(dead, 30);
  sim.npcs = sim.npcs.filter((n) => n.hp > 0);
  const next = syncNpcVisuals(first, sim.npcs, 2);
  assert.ok(next.includes(survivor), "survivor keeps its own animation state");
  assert.equal(next.at(-1)?.actor, dead);
  assert.equal(next.at(-1)?.deadAt, 2);
  assert.ok(!sim.npcs.includes(dead), "corpse is visual only");
  assert.equal(
    syncNpcVisuals(next, sim.npcs, 2),
    next,
    "paused simulation freezes corpse lifetime",
  );
  assert.equal(
    syncNpcVisuals(next, sim.npcs, 2 + CORPSE_TICKS).length,
    sim.npcs.length,
  );
});

test("corpse visuals are bounded and living replacement actors never inherit old references", () => {
  const sim = new Simulation();
  for (let i = 0; i < 30; i++) sim.addNPC("rifleman", { x: 0, z: 0 });
  const first = syncNpcVisuals([], sim.npcs, 0);
  for (const n of sim.npcs.slice(1)) sim.damage(n, 30);
  sim.npcs = sim.npcs.filter((n) => n.hp > 0);
  const next = syncNpcVisuals(first, sim.npcs, 1);
  assert.equal(next.length, 1 + MAX_CORPSES);
  sim.addNPC("rifleman", { x: 0, z: 0 });
  const withNew = syncNpcVisuals(next, sim.npcs, 2);
  const newest = sim.npcs[1];
  sim.damage(newest, 30);
  sim.npcs = sim.npcs.filter((n) => n.hp > 0);
  const capped = syncNpcVisuals(withNew, sim.npcs, 3);
  assert.equal(capped.length, 1 + MAX_CORPSES);
  assert.equal(
    capped.at(-1)?.actor,
    newest,
    "new deaths displace oldest corpses",
  );
  const restarted = new Simulation();
  const reset = syncNpcVisuals([], restarted.npcs, 0);
  assert.equal(reset.length, 1);
  assert.equal(reset[0].actor, restarted.npcs[0]);
  assert.notEqual(reset[0].actor, first[0].actor);
});
