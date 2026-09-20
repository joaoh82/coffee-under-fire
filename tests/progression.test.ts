import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { replay } from "../apps/web/src/game/driver";
import { distance, path } from "../apps/web/src/game/arena";
import { envelope } from "../packages/shared/contracts";
function world() {
  const s = new Simulation();
  s.start("mock", "xp_fixture");
  return s;
}
test("enemy death emits exactly one drop and bounded death feedback", () => {
  const s = world(),
    n = s.addNPC("rifleman", { x: -17, z: 7 });
  s.damage(n, 30);
  s.damage(n, 30);
  assert.equal(s.kills, 1);
  assert.equal(s.gems.length, 1);
  assert.equal(s.deathBursts.length, 1);
  assert.equal(s.gems[0].value, 10);
  s.step(idleInput());
  assert.equal(s.xp, 0);
  s.player.pos = { ...s.gems[0].pos };
  s.step(idleInput());
  assert.equal(s.xp, 10);
  assert.equal(s.gems.length, 0);
  s.step(idleInput());
  assert.equal(s.xp, 10);
});
test("level-up freezes simulation, validates one choice, and resets on a new run", () => {
  const s = world();
  s.xp = 30;
  s.collectGems();
  assert.equal(s.status, "upgrading");
  const tick = s.tick;
  s.step({ ...idleInput(), x: 1, fire: true });
  assert.equal(s.tick, tick);
  assert.equal(s.chooseUpgrade("invalid" as never), false);
  assert.equal(s.chooseUpgrade("boots"), true);
  assert.equal(s.level, 2);
  assert.equal(s.xp, 0);
  assert.equal(s.ranks.boots, 1);
  assert.equal(s.chooseUpgrade("damage"), false);
  const x = s.player.pos.x;
  s.step({ ...idleInput(), x: 1 });
  assert.ok(Math.abs(s.player.pos.x - x - 5.5 / 60) < 1e-8);
  assert.equal(world().ranks.boots, 0);
});
test("gem and death effect storage stay bounded and expired gems disappear", () => {
  const s = world();
  for (let i = 0; i < 150; i++)
    s.damage(s.addNPC("rifleman", { x: 0, z: 12 }), 30);
  assert.equal(s.gems.length, 128);
  assert.equal(s.deathBursts.length, 32);
  assert.equal(
    s.gems.reduce((sum, g) => sum + g.value, 0),
    1500,
  );
  s.tick = 90 * 60 + 1;
  s.step(idleInput());
  assert.equal(s.gems.length, 0);
  assert.equal(s.deathBursts.length, 0);
});
test("actual combat, XP pickup and human upgrade choices replay deterministically", () => {
  const s = world();
  let route: { x: number; z: number }[] = [];
  let goalId = "";
  for (let i = 0; i < 7200 && s.level < 2; i++) {
    for (const n of s.npcs)
      if (!n.action) {
        const r = s.request(n);
        s.apply(r, {
          ...envelope(r),
          selected: n.role === "general" ? "map" : "hold",
          source: "mock",
          confidence: 0,
          latencyMs: 0,
          model: "passive-combat-fixture",
          usage: null,
        });
      }
    const input = idleInput();
    const enemy = s.npcs.find((n) => n.role === "rifleman");
    if (enemy) {
      input.aim = { ...enemy.pos };
      input.fire = true;
    }
    input.reload = s.player.ammo === 0;
    const gem = s.gems[0];
    const goal = gem ?? enemy;
    const nextId = gem ? `gem_${gem.id}` : (enemy?.id ?? "");
    if (goal && nextId !== goalId) {
      route = path(s.player.pos, goal.pos);
      goalId = nextId;
    }
    while (route.length && distance(s.player.pos, route[0]) < 0.15)
      route.shift();
    const next = route[0];
    if (next) {
      const d = distance(s.player.pos, next);
      if (d > 0.01) {
        input.x = (next.x - s.player.pos.x) / d;
        input.z = (next.z - s.player.pos.z) / d;
      }
    }
    s.step(input);
    if (s.status === "upgrading") s.chooseUpgrade("damage");
  }
  assert.equal(s.level, 2, "fixture must actually reach a level-up");
  const clone = replay(s.recording);
  assert.equal(clone.level, s.level);
  assert.deepEqual(clone.ranks, s.ranks);
  assert.equal(clone.xp, s.xp);
  assert.equal(clone.score, s.score);
  assert.deepEqual(clone.player, s.player);
  assert.deepEqual(clone.gems, s.gems);
});
