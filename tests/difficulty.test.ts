import { armorSettings } from "../apps/web/src/game/armor";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation, idleInput } from "../apps/web/src/game/simulation";
import { waveSettings } from "../apps/web/src/game/waveProfile";
import { replay, Driver } from "../apps/web/src/game/driver";
import { type Difficulty } from "../apps/web/src/game/difficulty";
const levels: Difficulty[] = ["easy.v1", "normal.v1", "hard.v1"];

test("difficulty changes pressure within the existing fourteen-enemy ceiling", () => {
  for (const wave of [0, 1, 2, 3, 7, 50]) {
    const [easy, normal, hard] = levels.map((d) =>
      waveSettings(wave, "pressure.v1", d),
    );
    assert.ok(
      easy.cap < normal.cap && normal.cap <= hard.cap && hard.cap <= 14,
    );
    assert.ok(
      easy.interval > normal.interval && normal.interval > hard.interval,
    );
    assert.ok(easy.batch < normal.batch && normal.batch <= hard.batch);
  }
  assert.deepEqual(waveSettings(0), {
    cap: 10,
    interval: 4,
    batch: 2,
    activeSeconds: 52,
    telegraphGap: 30,
  });
  assert.deepEqual(waveSettings(3), {
    cap: 14,
    interval: 2.5,
    batch: 3,
    activeSeconds: 52,
    telegraphGap: 30,
  });
});
test("easy reduces actual bullet and shell damage; tank health follows the armor profile", () => {
  for (const difficulty of levels)
    for (const shell of [false, true]) {
      const s = new Simulation();
      s.start("mock", "damage-fixture", "mission", difficulty);
      s.npcs = [];
      s.player.pos = { x: 0, z: 5 };
      s.player.previous = { ...s.player.pos };
      const n = s.addNPC(shell ? "tank" : "rifleman", { x: 0, z: -3 });
      assert.equal(n.hp, shell ? armorSettings(0, difficulty).hp : 30);
      n.angle = 0;
      s.shoot(n, shell ? 9 : 11);
      s.bullets[0].shell = shell;
      for (let i = 0; i < 60; i++) s.step(idleInput());
      assert.equal(
        s.player.hp,
        100 - (difficulty === "easy.v1" ? (shell ? 10 : 5) : shell ? 16 : 8),
      );
    }
});
test("each difficulty is recorded and replayed; recordings without a preset retain normal", () => {
  for (const difficulty of levels) {
    const s = new Simulation();
    s.start("mock", "replay-fixture", "endless", difficulty);
    for (let i = 0; i < 1800; i++) s.step(idleInput());
    const again = replay(s.recording);
    assert.equal(again.difficulty, difficulty);
    assert.equal(again.tick, s.tick);
    assert.deepEqual(
      again.npcs.map((n) => [n.id, n.role, n.pos]),
      s.npcs.map((n) => [n.id, n.role, n.pos]),
    );
    assert.equal(again.recording.difficulty, difficulty);
  }
  const old = new Simulation();
  old.start("mock", "old-fixture");
  for (let i = 0; i < 600; i++) old.step(idleInput());
  delete old.recording.difficulty;
  assert.equal(replay(old.recording).difficulty, "normal.v1");
  assert.throws(
    () => replay({ ...old.recording, difficulty: "unknown" as Difficulty }),
    /Unsupported difficulty/,
  );
});
test("tank eligibility starts at wave four on every difficulty, independently of XP level", () => {
  for (const difficulty of levels) {
    const s = new Simulation();
    s.start("mock", "tank-wave-fixture", "mission", difficulty);
    for (let i = 0; i < 183 * 60; i++) {
      // Offline spawn fixture keeps a free slot; no autonomous tactics are simulated.
      s.npcs = s.npcs.filter((n) => n.role !== "rifleman");
      s.step(idleInput());
      if (s.time < 180)
        assert.equal(s.npcs.filter((n) => n.role === "tank").length, 0);
    }
    assert.equal(s.level, 1);
    assert.equal(s.wave, 3);
    assert.equal(s.npcs.filter((n) => n.role === "tank").length, 1);
  }
});
test("driver passes the chosen difficulty into the session's simulation", async () => {
  const driver = new Driver(
    async () =>
      new Response(JSON.stringify({ mode: "strict", session: "fixture" }), {
        status: 200,
      }),
  );
  await driver.start("strict", "mission", "easy.v1");
  assert.equal(driver.sim.difficulty, "easy.v1");
  assert.equal(driver.sim.recording.difficulty, "easy.v1");
});
