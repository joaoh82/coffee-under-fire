import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput, DT } from "../apps/web/src/game/simulation";
import {
  ENEMY_TYPES,
  infantryArchetype,
  type EnemyArchetype,
} from "../apps/web/src/game/enemyRoster";
import { DIFFICULTIES, type Difficulty } from "../apps/web/src/game/difficulty";
import { envelope, requestSchema } from "../packages/shared/contracts";
import { replay } from "../apps/web/src/game/driver";

function fixture(type: EnemyArchetype) {
  const s = new Simulation();
  s.start("mock", "specialist-fixture");
  s.npcs = [];
  s.player.pos = { x: 0, z: 5 };
  const n = s.addNPC("rifleman", { x: 0, z: 0 }, type);
  return { s, n };
}
function fire(s: Simulation, n: ReturnType<Simulation["addNPC"]>) {
  const r = s.request(n);
  requestSchema.parse(r);
  const candidate = r.candidates.find((c) => c.kind === "fire");
  assert.ok(candidate);
  assert.ok(
    s.apply(r, {
      ...envelope(r),
      selected: candidate.id,
      source: "mock",
      confidence: 0,
      latencyMs: 0,
      model: "specialist-test",
      usage: null,
    }),
  );
}
test("specialists enter at waves 3, 5 and 7 on every difficulty without extra RNG or tank schedule changes", () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    for (const [wave, type] of [
      [2, "scout"],
      [4, "gunner"],
      [6, "marksman"],
    ] as const) {
      const s = new Simulation();
      const legacy = new Simulation();
      legacy.rosterProfile = "legacy";
      for (const sim of [s, legacy]) {
        sim.start("mock", "spawn-fixture", "endless", difficulty);
        sim.tick = wave * 3600;
        for (let i = 0; i < 720; i++) sim.step(idleInput());
      }
      assert.ok(
        s.npcs.some((n) => n.archetype === type),
        `${difficulty} wave ${wave + 1}`,
      );
      assert.ok(s.npcs.every((n) => n.role !== "rifleman" || n.hp === 30));
      assert.equal(s.rng, legacy.rng);
      assert.deepEqual(
        s.npcs.map((n) => [n.id, n.pos, n.role]),
        legacy.npcs.map((n) => [n.id, n.pos, n.role]),
      );
      assert.ok(
        s.npcs
          .filter((n) => n.role === "rifleman")
          .every((n) => ENEMY_TYPES[n.archetype].unlockWave <= wave + 1),
      );
    }
  }
  for (let wave = 0; wave < 8; wave++)
    for (let i = 0; i < 10; i++) {
      assert.equal(infantryArchetype(wave, i, "legacy"), "rifleman");
      assert.ok(
        ENEMY_TYPES[infantryArchetype(wave, i, "specialists.v1")].unlockWave <=
          wave + 1,
      );
    }
});
test("specialist fire has real windup, cadence and projectile speed; no automatic attacks", () => {
  for (const type of Object.keys(ENEMY_TYPES) as EnemyArchetype[]) {
    const { s, n } = fixture(type);
    const spec = ENEMY_TYPES[type];
    fire(s, n);
    for (let i = 0; i < spec.windupTicks - 1; i++) s.step(idleInput());
    assert.equal(n.ammo, 12);
    s.step(idleInput());
    assert.equal(n.ammo, 11);
    assert.equal(
      Math.round(Math.hypot(s.bullets[0].velocity.x, s.bullets[0].velocity.z)),
      spec.bulletSpeed,
    );
    while (s.tick < 48) s.step(idleInput());
    assert.equal(
      12 - n.ammo,
      type === "gunner" ? 3 : type === "marksman" ? 1 : 2,
    );
    assert.equal(n.action, null);
    const ammo = n.ammo;
    for (let i = 0; i < 20; i++) s.step(idleInput());
    assert.equal(n.ammo, ammo);
  }
});
test("shorter gun range never hides visible contacts and expired range cancels an attack", () => {
  const { s, n } = fixture("scout");
  s.player.pos.z = 9;
  let r = s.request(n);
  assert.equal(r.observation.visible.length, 1);
  assert.ok(!r.candidates.some((c) => c.kind === "fire"));
  assert.equal(r.observation.archetype, "scout");
  assert.deepEqual(r.observation.combat, {
    movementSpeed: 3.8,
    fireRange: 7,
    fireCadenceTicks: 24,
    fireWindupTicks: 18,
  });
  assert.equal(envelope(r).config, "tactics.v5");
  s.player.pos.z = 5;
  fire(s, n);
  s.player.pos.z = 9;
  s.step(idleInput());
  assert.equal(n.action, null);
  assert.equal(n.ammo, 12);
  assert.ok(
    !s.legal(n, { id: "fire", kind: "fire", target: "player", duration: 0.8 }),
  );
  s.rosterProfile = "legacy";
  r = s.request(n);
  assert.equal(r.observation.archetype, undefined);
  assert.equal(r.observation.combat, undefined);
  assert.equal(envelope(r).config, "tactics.v4");
});
test("movement speeds differ only during an explicitly selected action; strict mode never invents one", () => {
  for (const type of Object.keys(ENEMY_TYPES) as EnemyArchetype[]) {
    const { s, n } = fixture(type);
    n.action = {
      id: "move",
      kind: "move",
      destination: { x: 0, z: 4 },
      duration: 2,
    };
    n.route = [{ x: 0, z: 4 }];
    n.actionUntil = 120;
    s.step(idleInput());
    assert.ok(Math.abs(n.pos.z - ENEMY_TYPES[type].speed * DT) < 1e-8);
    n.action = null;
    const pos = { ...n.pos };
    s.mode = "strict";
    for (let i = 0; i < 100; i++) s.step(idleInput());
    assert.deepEqual(n.pos, pos);
    assert.equal(n.ammo, 12);
    assert.equal(s.status, "reconnecting");
  }
});
test("marksmen have bounded extended perception and a longer fire range", () => {
  const { s, n } = fixture("marksman");
  n.pos = { x: 0, z: -3 };
  s.player.pos = { x: 0, z: 13 };
  assert.ok(s.visible(n));
  assert.ok(s.candidates(n).some((c) => c.kind === "fire"));
  n.archetype = "rifleman";
  assert.ok(!s.visible(n));
  n.archetype = "marksman";
  s.player.pos.z = 16;
  assert.ok(!s.visible(n));
});
test("new roster and missing-profile legacy recordings replay identical spawn state", () => {
  for (const profile of ["legacy", "specialists.v1"] as const) {
    const s = new Simulation();
    s.rosterProfile = profile;
    s.start("mock", "roster-replay", "endless");
    for (let i = 0; i < 124 * 60; i++) s.step(idleInput());
    if (profile === "legacy") delete s.recording.rosterProfile;
    const copy = replay(s.recording);
    assert.equal(copy.rosterProfile, profile);
    assert.equal(copy.rng, s.rng);
    assert.deepEqual(copy.npcs, s.npcs);
    assert.deepEqual(copy.telegraphs, s.telegraphs);
  }
});

test("recorded specialist movement and firing replay identical combat state", () => {
  // Explicit development fixture policy, not a Jev playtest. All state changes
  // come from recorded player inputs, normal spawning and accepted decisions.
  const s = new Simulation();
  s.start("mock", "specialist-combat-replay", "endless", "easy.v1");
  const moved = new Set<EnemyArchetype>();
  const fired = new Set<EnemyArchetype>();
  const squaredDistance = (
    a: { x: number; z: number },
    b: { x: number; z: number },
  ) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  for (let i = 0; i < 400 * 60 && s.status === "running"; i++) {
    for (const n of s.npcs) {
      if (n.action) continue;
      const r = s.request(n);
      const specialist = n.role === "rifleman" && n.archetype !== "rifleman";
      const shot =
        specialist && moved.has(n.archetype) && !fired.has(n.archetype)
          ? r.candidates.find((c) => c.kind === "fire")
          : undefined;
      const move = r.candidates
        .filter((c) => c.kind === "move")
        .sort((a, b) => {
          if (a.kind !== "move" || b.kind !== "move") return 0;
          return (
            squaredDistance(a.destination, s.player.pos) -
            squaredDistance(b.destination, s.player.pos)
          );
        })[0];
      const chosen = shot ?? move ?? r.candidates[0];
      requestSchema.parse(r);
      assert.ok(
        s.apply(r, {
          ...envelope(r),
          selected: chosen.id,
          source: "mock",
          confidence: 0,
          latencyMs: 0,
          model: "specialist-replay-fixture",
          usage: null,
        }),
      );
    }
    const target = s.npcs
      .filter((n) => n.role !== "general" && s.sight(s.player.pos, n.pos))
      .sort(
        (a, b) =>
          squaredDistance(a.pos, s.player.pos) -
          squaredDistance(b.pos, s.player.pos),
      )[0];
    // Let each new specialist complete its first fire action before shooting it.
    const protect =
      target?.role === "rifleman" &&
      target.archetype !== "rifleman" &&
      !fired.has(target.archetype);
    const input = idleInput();
    input.aim = target?.pos ?? { x: 0, z: 0 };
    input.fire = !protect;
    input.reload = s.player.ammo === 0;
    const before = s.npcs.map((n) => ({ n, pos: { ...n.pos }, ammo: n.ammo }));
    s.step(input);
    for (const { n, pos, ammo } of before) {
      if (n.role !== "rifleman" || n.archetype === "rifleman") continue;
      if (squaredDistance(n.pos, pos) > 0) moved.add(n.archetype);
      if (n.ammo < ammo) fired.add(n.archetype);
    }
    if ((s.status as Simulation["status"]) === "upgrading")
      s.chooseUpgrade("heal");
    if (fired.size === 3 && s.npcs.every((n) => n.action?.kind !== "fire"))
      break;
  }
  assert.deepEqual([...moved].sort(), ["gunner", "marksman", "scout"]);
  assert.deepEqual([...fired].sort(), ["gunner", "marksman", "scout"]);
  const copy = replay(s.recording);
  assert.deepEqual(copy.player, s.player);
  assert.deepEqual(copy.bullets, s.bullets);
  assert.equal(copy.rng, s.rng);
  assert.equal(copy.score, s.score);
  assert.deepEqual(
    copy.npcs,
    s.npcs.map((n) => ({
      ...n,
      decision: n.decision ? { ...n.decision, source: "replay" } : null,
    })),
  );
});
