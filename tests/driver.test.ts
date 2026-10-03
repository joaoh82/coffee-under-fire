import { test } from "node:test";
import assert from "node:assert/strict";
import { Driver, replay } from "../apps/web/src/game/driver";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const settle = () => new Promise((resolve) => setImmediate(resolve));
test("default transport does not bind browser fetch to Driver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown) {
    assert.ok(
      !(this instanceof Driver),
      "Browser fetch rejects a Driver receiver",
    );
    return json({ session: "browser_fixture" });
  };
  try {
    const driver = new Driver();
    await driver.start();
    assert.equal(driver.sim.status, "running");
    assert.equal(driver.sim.mode, "local");
    assert.equal(driver.sim.session, "browser_fixture");
  } finally {
    globalThis.fetch = original;
  }
});
test("local play makes no decision requests, never stalls, and feeds the dashboard", async () => {
  const urls: string[] = [];
  const driver = new Driver(async (url) => {
    urls.push(String(url));
    return json({ session: "local-fixture" }, 201);
  });
  await driver.start("endless");
  for (let i = 0; i < 20 * 60 && driver.sim.status === "running"; i++)
    driver.update(1 / 60);
  assert.deepEqual(urls, ["/api/session"]);
  assert.ok(driver.sim.tick > 0);
  assert.ok(driver.totals.applied > 0);
  assert.equal(driver.totals.rejected, 0);
  assert.ok(driver.traces.every((r) => r.decision.source === "local"));
});
test("pause freezes time and resume continues without any network call", async () => {
  let calls = 0;
  const driver = new Driver(async () => {
    calls++;
    return json({ session: "pause-fixture" }, 201);
  });
  await driver.start("endless");
  for (let i = 0; i < 120; i++) driver.update(1 / 60);
  driver.pause();
  const tick = driver.sim.tick;
  for (let i = 0; i < 120; i++) driver.update(1 / 60);
  assert.equal(driver.sim.tick, tick);
  driver.resume();
  for (let i = 0; i < 120; i++) driver.update(1 / 60);
  assert.ok(driver.sim.tick > tick);
  assert.equal(calls, 1);
  const again = replay(driver.sim.recording);
  assert.equal(again.tick, driver.sim.tick);
  assert.deepEqual(again.player, driver.sim.player);
});
test("auto-reload fills an empty magazine after the normal delay and records the input", () => {
  const driver = new Driver();
  driver.sim.start("scripted", "fixture");
  driver.sim.player.ammo = 0;
  driver.update(1 / 60);
  assert.ok(driver.sim.player.reloadUntil > driver.sim.tick);
  assert.equal(driver.sim.recording.inputs[0].input.reload, true);
  for (let i = 0; i < 73; i++) driver.update(1 / 60);
  assert.equal(driver.sim.player.ammo, 12);
});
test("disabling auto-reload preserves manual R and does not top up a partial magazine", () => {
  const driver = new Driver();
  driver.sim.start("scripted", "fixture");
  driver.sim.player.ammo = 4;
  driver.update(1 / 60);
  assert.equal(driver.sim.player.reloadUntil, 0);
  driver.autoReload = false;
  driver.sim.player.ammo = 0;
  driver.update(1 / 60);
  assert.equal(driver.sim.player.reloadUntil, 0);
  driver.input.reload = true;
  driver.update(1 / 60);
  assert.ok(driver.sim.player.reloadUntil > driver.sim.tick);
});
test("auto-fire uses the human aim and records shots without choosing a target", () => {
  const driver = new Driver();
  driver.sim.start("scripted", "fixture");
  driver.autoFire = true;
  driver.input.aim = { x: -10, z: 10 };
  driver.update(1 / 60);
  assert.equal(driver.sim.player.ammo, 11);
  assert.equal(driver.sim.recording.inputs[0].input.fire, true);
  assert.deepEqual(driver.sim.recording.inputs[0].input.aim, { x: -10, z: 10 });
  driver.autoFire = false;
  for (let i = 0; i < 30; i++) driver.update(1 / 60);
  assert.equal(driver.sim.player.ammo, 11);
});
test("losing focus on the briefing does not contact the server or change state", async () => {
  let calls = 0;
  const driver = new Driver(async () => {
    calls++;
    return json({ error: "invalid_session" }, 503);
  });
  driver.pause();
  await settle();
  assert.equal(calls, 0);
  assert.equal(driver.sim.status, "ready");
});
test("an access denial on session start blocks play with the server message", async () => {
  const driver = new Driver(async () =>
    json(
      { error: "ip_session_limit", message: "Close another game first." },
      429,
    ),
  );
  await assert.rejects(driver.start(), /Close another game first/);
  assert.equal(driver.accessBlock?.code, "ip_session_limit");
  assert.equal(driver.sim.status, "ready");
});
