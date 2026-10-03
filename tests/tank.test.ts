import { test } from "node:test";
import { chooseLocally } from "../apps/web/src/game/tactics";
import assert from "node:assert/strict";
import { Simulation, idleInput, DT } from "../apps/web/src/game/simulation";
import { clear, path, distance } from "../apps/web/src/game/arena";
import {
  envelope,
  requestSchema,
  type Candidate,
} from "../packages/shared/contracts";
import { replay } from "../apps/web/src/game/driver";
import { infantryAppearance } from "../apps/web/src/render/infantryAppearance";

function fixture() {
  const s = new Simulation();
  s.combatProfile = "armor.v1";
  s.start("scripted", "tank-fixture");
  s.npcs = [];
  s.player.pos = { x: 0, z: 5 };
  s.player.previous = { ...s.player.pos };
  const n = s.addNPC("tank", { x: 0, z: -3 });
  return { s, n };
}
function choose(
  s: Simulation,
  n: ReturnType<Simulation["addNPC"]>,
  kind: Candidate["kind"],
) {
  const r = s.request(n);
  const c = r.candidates.find((c) => c.kind === kind)!;
  assert.ok(c);
  requestSchema.parse(r);
  assert.ok(
    s.apply(r, {
      ...envelope(r),
      selected: c.id,
      source: "scripted",
      confidence: 0,
      model: "test-fixture",
    }),
  );
  return c;
}
test("tank cannon uses a validated fixed observation; no hidden target or rifle-fire option", () => {
  const { s, n } = fixture();
  const r = s.request(n);
  assert.ok(requestSchema.safeParse(r).success);
  assert.ok(!r.candidates.some((c) => c.kind === "fire"));
  const c = r.candidates.find((c) => c.kind === "cannon")!;
  assert.equal(c.kind, "cannon");
  if (c.kind !== "cannon") throw Error();
  assert.deepEqual(c.aimPoint, s.player.pos);
  // Tanks take a visible cannon shot often enough to pressure the player.
  const shots = Array.from({ length: 40 }, (_, i) =>
    chooseLocally({ ...r, sequence: r.sequence + i }),
  ).filter((d) => d.selected === c.id).length;
  assert.ok(shots > 10, `cannon chosen ${shots}/40`);
  c.aimPoint.x += 1;
  assert.ok(!requestSchema.safeParse(r).success);
  s.player.pos = { x: 20, z: 15 };
  n.lastSeen = null;
  n.lastHeard = null;
  const hidden = s.request(n);
  assert.equal(hidden.observation.visible.length, 0);
  assert.ok(!hidden.candidates.some((c) => c.kind === "cannon"));
});
test("cannon warns for 1.2 seconds, fires once, and does not track a dodging player", () => {
  const { s, n } = fixture();
  choose(s, n, "cannon");
  s.player.pos = { x: 4, z: 5 };
  for (let i = 0; i < 71; i++) s.step(idleInput());
  assert.equal(n.ammo, 12);
  assert.equal(s.bullets.length, 0);
  s.step(idleInput());
  assert.equal(n.ammo, 11);
  assert.equal(s.bullets.length, 1);
  assert.ok(s.bullets[0].shell);
  assert.ok(Math.abs(s.bullets[0].velocity.x) < 1e-9);
  for (let i = 0; i < 90; i++) s.step(idleInput());
  assert.equal(n.ammo, 11);
  assert.equal(s.player.hp, 100);
});
test("tank cannon damage and interruption rules are deterministic", () => {
  const { s, n } = fixture();
  choose(s, n, "cannon");
  s.damage(n, 10);
  assert.equal(n.hp, 80);
  assert.equal(n.action?.kind, "cannon");
  for (let i = 0; i < 130; i++) s.step(idleInput());
  assert.equal(s.player.hp, 84);
  const f = fixture();
  choose(f.s, f.n, "cannon");
  f.s.pause();
  f.s.resume();
  for (let i = 0; i < 100; i++) f.s.step(idleInput());
  assert.equal(f.s.bullets.length, 0);
  assert.equal(f.n.ammo, 12);
  choose(f.s, f.n, "cannon");
  f.s.damage(f.n, 90);
  assert.equal(f.n.action, null);
  assert.ok(f.s.gems.some((g) => g.value === 10));
});
test("wide hull paths and movement respect static cover and other actors", () => {
  const { s, n } = fixture();
  n.pos = { x: -5, z: 4 };
  for (const point of path(n.pos, { x: -5, z: -4 }, s.radius(n)))
    assert.ok(clear(point, 1.2));
  const infantry = s.addNPC("rifleman", { x: 0, z: 0 });
  n.pos = { x: 0, z: 3 };
  for (let i = 0; i < 120; i++) s.move(n, 0, -1.4 * DT);
  assert.ok(distance(n.pos, infantry.pos) >= 1.65);
  n.pos = { x: -6, z: 3 };
  for (let i = 0; i < 120; i++) s.move(n, 0, -1.4 * DT);
  assert.ok(clear(n.pos, 1.2));
});
test("tank starts at wave four, one active maximum, within total cap; old replay has no tank", () => {
  const s = new Simulation();
  s.combatProfile = "armor.v1";
  s.start("scripted", "wave-fixture");
  for (let i = 0; i < 182 * 60; i++) {
    // Remove stationary test infantry to ensure the wave has an available slot.
    s.npcs = s.npcs.filter((n) => n.role !== "rifleman");
    s.step(idleInput());
    if (s.time < 182)
      assert.equal(s.npcs.filter((n) => n.role === "tank").length, 0);
  }
  assert.equal(s.npcs.filter((n) => n.role === "tank").length, 1);
  for (let i = 0; i < 120 * 60; i++) s.step(idleInput());
  assert.equal(s.npcs.filter((n) => n.role === "tank").length, 1);
  assert.ok(s.npcs.filter((n) => n.role !== "general").length <= 14);
  const old = new Simulation();
  old.combatProfile = "infantry.v1";
  old.start("scripted", "old-fixture");
  for (let i = 0; i < 183 * 60; i++) old.step(idleInput());
  delete old.recording.combatProfile;
  const again = replay(old.recording);
  assert.equal(again.combatProfile, "infantry.v1");
  assert.deepEqual(
    again.npcs.map((n) => [n.id, n.role, n.hp]),
    old.npcs.map((n) => [n.id, n.role, n.hp]),
  );
});
test("infantry appearance is stable and varied without consuming simulation randomness", () => {
  const appearances = Array.from({ length: 12 }, (_, i) =>
    infantryAppearance(`enemy_${i}`),
  );
  assert.equal(new Set(appearances).size, 3);
  assert.equal(infantryAppearance("enemy_42"), infantryAppearance("enemy_42"));
});

test("blocked movement cancels its goal so the next tick picks a new action", () => {
  const { s, n } = fixture();
  n.pos = { x: 0, z: 3 };
  s.player.pos = { x: 15, z: 15 };
  s.addNPC("rifleman", { x: 0, z: 5 });
  n.action = {
    id: "blocked_move",
    kind: "move",
    duration: 2,
    destination: { x: 0, z: 8 },
  };
  n.route = [
    { x: 0, z: 4 },
    { x: 0, z: 8 },
  ];
  n.actionUntil = 120;
  for (let i = 0; i < 30 && n.action; i++) s.step(idleInput());
  assert.equal(n.action, null);
  assert.equal(n.route.length, 0);
  assert.ok(distance(n.pos, { x: 0, z: 5 }) >= 1.65);
});

test("tank destruction emits one bounded metal/smoke burst and expires on simulation time", () => {
  const { s, n } = fixture();
  choose(s, n, "cannon");
  for (let i = 0; i < 72; i++) s.step(idleInput());
  assert.equal(s.events.filter((e) => e.kind === "cannon").length, 1);
  s.damage(n, 90);
  s.damage(n, 90);
  assert.equal(s.events.filter((e) => e.kind === "tankDeath").length, 1);
  assert.equal(s.tankBursts.length, 1);
  assert.equal(s.deathBursts.length, 0);
  const origin = { ...s.tankBursts[0].pos };
  n.pos.x += 10;
  assert.deepEqual(s.tankBursts[0].pos, origin);
  for (let i = 0; i < 10; i++) s.damage(s.addNPC("tank", { x: 0, z: -3 }), 90);
  assert.equal(s.tankBursts.length, 8);
  s.pause();
  for (let i = 0; i < 100; i++) s.step(idleInput());
  assert.equal(s.tankBursts.length, 8);
  s.resume();
  for (let i = 0; i < 96; i++) s.step(idleInput());
  assert.equal(s.tankBursts.length, 0);
});
