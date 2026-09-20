import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { MAPS, type MapId } from "../apps/web/src/game/maps";
import { DIFFICULTIES, type Difficulty } from "../apps/web/src/game/difficulty";
import { armorSettings } from "../apps/web/src/game/armor";
import { replay, Driver } from "../apps/web/src/game/driver";
import { requestSchema } from "../packages/shared/contracts";

test("map instances have independent collision, perception, and paths to every objective", () => {
  const woods = new Simulation(),
    village = new Simulation(7341, "village.v1");
  assert.equal(woods.clear({ x: 0, z: 0 }), true);
  assert.equal(village.clear({ x: 0, z: 0 }), false);
  assert.equal(woods.sight({ x: 0, z: -3 }, { x: 0, z: 3 }), true);
  assert.equal(village.sight({ x: 0, z: -3 }, { x: 0, z: 3 }), false);
  for (const id of Object.keys(MAPS) as MapId[]) {
    const s = new Simulation(7341, id);
    for (const radius of [0.45, 1.2]) {
      for (const start of [s.arena.kitchen, ...s.arena.spawns])
        for (const goal of s.arena.tents) {
          const route = s.path(start, goal, radius);
          assert.ok(
            route.length,
            `${id}: ${JSON.stringify(start)} to ${JSON.stringify(goal)}`,
          );
          for (const p of route) assert.ok(s.clear(p, radius));
        }
    }
    const n = s.addNPC("tank", { x: 0, z: -5 });
    requestSchema.parse(s.request(n));
    for (const c of s.request(n).candidates)
      if (c.kind === "move") {
        assert.ok(s.clear(c.destination, 1.2));
        if (id === "village.v1") assert.equal(c.route, undefined);
      }
  }
  assert.throws(() => new Simulation(1, "unknown" as MapId), /Unsupported map/);
});

test("village and new armor survive recorded-decision replay; old maps default to woodland", () => {
  const s = new Simulation(7341, "village.v1");
  s.start("mock", "offline-map-fixture", "endless", "easy.v1");
  for (let i = 0; i < 1200; i++) s.step(idleInput());
  const again = replay(s.recording);
  assert.equal(again.mapId, "village.v1");
  assert.equal(again.combatProfile, "armor.v2");
  assert.deepEqual(again.npcs, s.npcs);
  const old = new Simulation();
  old.start("mock", "legacy");
  old.step(idleInput());
  delete old.recording.mapId;
  assert.equal(replay(old.recording).mapId, "woodland.v1");
});

test("armor v2 increases durability and schedules spaced groups within wave and active caps", () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    const s = new Simulation(7341, "village.v1");
    s.start("mock", "spawn-fixture", "endless", difficulty);
    // Isolated scheduling fixture: no autonomous decisions or provider calls.
    const born: number[] = [];
    let known = new Set<string>();
    for (let tick = 180 * 60; tick < 224 * 60; tick++) {
      s.tick = tick;
      s.npcs = s.npcs.filter((n) => n.role !== "rifleman");
      s.waves();
      for (const n of s.npcs.filter((n) => n.role === "tank"))
        if (!known.has(n.id)) {
          known.add(n.id);
          born.push(tick);
        }
    }
    assert.equal(born.length, difficulty === "easy.v1" ? 1 : 2);
    if (born.length > 1)
      assert.ok(born[1] - born[0] >= armorSettings(3, difficulty).spacingTicks);
    for (const n of s.npcs.filter((n) => n.role === "tank")) {
      assert.equal(n.hp, armorSettings(3, difficulty).hp);
      assert.equal(n.maxHp, n.hp);
      s.damage(n, 90);
      assert.ok(n.hp > 0);
    }
    s.npcs = s.npcs.filter((n) => n.role === "general");
    s.telegraphs = [];
    known = new Set();
    for (let tick = 300 * 60; tick < 344 * 60; tick++) {
      s.tick = tick;
      s.npcs = s.npcs.filter((n) => n.role !== "rifleman");
      s.waves();
      assert.ok(
        s.npcs.filter((n) => n.role === "tank").length +
          s.telegraphs.filter((t) => t.role === "tank").length <=
          armorSettings(5, difficulty).activeCap,
      );
      for (const n of s.npcs.filter((n) => n.role === "tank")) known.add(n.id);
    }
    assert.equal(known.size, difficulty === "easy.v1" ? 2 : 3);
  }
});
test("driver starts the selected map and records it", async () => {
  const d = new Driver(
    async () =>
      new Response(JSON.stringify({ mode: "strict", session: "fixture" })),
  );
  await d.start("strict", "mission", "easy.v1", "village.v1");
  assert.equal(d.sim.mapId, "village.v1");
  assert.equal(d.sim.recording.mapId, "village.v1");
});
