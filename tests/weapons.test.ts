import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";

function world() {
  const s = new Simulation();
  s.start("mock", "weapon-fixture");
  s.arena = { ...s.arena, obstacles: [] };
  s.npcs = [];
  s.player.pos = { x: 0, z: 0 };
  return s;
}
test("magazine upgrade adds six rounds, caps at thirty and reloads to upgraded capacity", () => {
  const s = world();
  for (let i = 0; i < 3; i++) {
    s.status = "upgrading";
    s.xp = s.xpNeeded;
    assert.equal(s.chooseUpgrade("magazine"), true);
  }
  assert.equal(s.magazineSize, 30);
  assert.equal(s.player.ammo, 30);
  assert.ok(!s.upgradeChoices.includes("magazine"));
  s.player.ammo = 12;
  s.step({ ...idleInput(), reload: true });
  assert.ok(s.player.reloadUntil > 0);
  for (let i = 0; i < 73; i++) s.step(idleInput());
  assert.equal(s.player.ammo, 30);
  assert.equal(new Simulation().magazineSize, 12);
});
test("both auxiliary weapons follow fire and aim, respect cooldowns and stop for reload or pause", () => {
  const s = world();
  s.ranks.rockets = s.ranks.grenades = 1;
  s.player.angle = Math.PI / 2;
  s.shoot(s.player, 26);
  assert.deepEqual(
    s.bullets.map((b) => b.kind),
    [undefined, "rocket", "grenade"],
  );
  for (const b of s.bullets) {
    assert.ok(b.velocity.x > 0);
    assert.ok(Math.abs(b.velocity.z) < 1e-8);
  }
  assert.equal(s.player.ammo, 11);
  s.tick = 9;
  s.shoot(s.player, 26);
  assert.equal(s.bullets.length, 4);
  s.tick = 180;
  s.player.reloadUntil = 200;
  s.shoot(s.player, 26);
  assert.equal(s.bullets.length, 4);
  s.status = "paused";
  s.step({ ...idleInput(), fire: true });
  assert.equal(s.tick, 180);
  s.player.reloadUntil = 0;
  s.shoot(s.player, 26);
  assert.equal(s.bullets.filter((b) => b.kind === "rocket").length, 2);
  assert.equal(s.bullets.filter((b) => b.kind === "grenade").length, 1);
  assert.equal(new Simulation().ranks.rockets, 0);
});
test("rocket direct impact deals splash once, spares the player and general and honors cover", () => {
  const s = world();
  const target = s.addNPC("tank", { x: 0, z: 1 });
  target.hp = 100;
  const nearby = s.addNPC("rifleman", { x: 1, z: 1 });
  nearby.hp = 100;
  const general = s.addNPC("general", { x: -1, z: 1 });
  const generalHp = general.hp;
  s.bullets.push({
    id: 1,
    kind: "rocket",
    pos: { x: 0, z: -0.3 },
    velocity: { x: 0, z: 18 },
    owner: "player",
    life: 90,
  });
  s.step(idleInput());
  assert.equal(target.hp, 70);
  assert.equal(nearby.hp, 70);
  assert.equal(general.hp, generalHp);
  assert.equal(s.player.hp, 100);
  assert.equal(s.bullets.length, 0);
  s.step(idleInput());
  assert.equal(target.hp, 70);
  s.sight = () => false;
  s.explode(
    {
      id: 2,
      kind: "grenade",
      pos: target.pos,
      velocity: { x: 0, z: 0 },
      owner: "player",
      life: 0,
    },
    target.pos,
    target,
  );
  assert.equal(target.hp, 46);
  assert.equal(nearby.hp, 70);
});
test("grenades expire after a one-second flight and paused simulation cannot advance their fuse", () => {
  const s = world();
  s.bullets.push({
    id: 1,
    kind: "grenade",
    pos: { x: 0, z: 0 },
    velocity: { x: 0, z: 8 },
    owner: "player",
    life: 60,
    age: 0,
  });
  s.status = "paused";
  s.step(idleInput());
  assert.equal(s.bullets[0].life, 60);
  s.status = "running";
  for (let i = 0; i < 60; i++) s.step(idleInput());
  assert.equal(s.bullets.length, 0);
  assert.equal(s.tankBursts.length, 1);
  assert.ok(Math.abs(s.tankBursts[0].pos.z - 8) < 1e-8);
});
