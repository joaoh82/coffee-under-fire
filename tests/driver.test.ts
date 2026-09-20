import { test } from "node:test";
import assert from "node:assert/strict";
import { Driver } from "../apps/web/src/game/driver";
import { mockProvider } from "../apps/server/src/jev";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("crowd scheduling serves oldest eligible requests without changing NPC order or concurrency", async () => {
  const requested: string[] = [];
  const driver = new Driver(async (_url, init) => {
    const r = JSON.parse(String(init?.body));
    requested.push(r.observation.npc);
    return json(await mockProvider(r, new AbortController().signal));
  });
  driver.sim.start("mock", "fairness-fixture");
  for (let i = 0; i < 6; i++) driver.sim.addNPC("rifleman", { x: i, z: 4 });
  driver.sim.tick = 100;
  driver.sim.npcs.forEach((n, i) => {
    n.nextDecision = 90 - i;
  });
  const original = driver.sim.npcs.map((n) => n.id);
  driver.schedule();
  assert.deepEqual(requested, [...original].reverse().slice(0, 4));
  assert.equal(driver.pending.size, 4);
  assert.deepEqual(
    driver.sim.npcs.map((n) => n.id),
    original,
  );
  await new Promise((resolve) => setImmediate(resolve));
  driver.cancel();
});
test("default transport does not bind browser fetch to Driver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown) {
    assert.ok(
      !(this instanceof Driver),
      "Browser fetch rejects a Driver receiver",
    );
    return json({ session: "browser_fixture", mode: "strict" });
  };
  try {
    const driver = new Driver();
    await driver.start("strict");
    assert.equal(driver.sim.status, "running");
    assert.equal(driver.sim.session, "browser_fixture");
  } finally {
    globalThis.fetch = original;
  }
});
test("reconnect keeps time frozen until fresh decisions arrive", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const driver = new Driver((async (url, init) => {
    if (url === "/api/invalidate") return json({ ok: true });
    await gate;
    return json(
      await mockProvider(
        JSON.parse(String(init?.body)),
        new AbortController().signal,
      ),
    );
  }) as typeof fetch);
  driver.sim.start("mock", "fixture");
  driver.sim.pause();
  const pending = driver.resume();
  driver.update(1);
  assert.equal(driver.sim.tick, 0);
  release();
  await pending;
  assert.equal(driver.sim.status, "running");
  assert.ok(driver.sim.npcs.every((n) => n.action));
  driver.update(0.02);
  assert.ok(driver.sim.tick > 0);
});
test("failed reconnect remains paused and preserves no tactical fallback", async () => {
  const driver = new Driver((async (url) =>
    url === "/api/invalidate"
      ? json({ ok: true })
      : json(
          { error: "provider_http_429", retryMs: 2000 },
          503,
        )) as typeof fetch);
  driver.sim.start("strict", "fixture");
  driver.sim.pause();
  await driver.resume();
  driver.update(1);
  assert.equal(driver.sim.status, "reconnecting");
  assert.equal(driver.sim.tick, 0);
  assert.ok(driver.sim.npcs.every((n) => !n.action));
});
test("hidden-tab pause while reconnecting prevents late action application", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const driver = new Driver((async (url, init) => {
    if (url === "/api/invalidate") return json({ ok: true });
    await gate;
    return json(
      await mockProvider(
        JSON.parse(String(init?.body)),
        new AbortController().signal,
      ),
    );
  }) as typeof fetch);
  driver.sim.start("mock", "fixture");
  driver.sim.pause();
  const pending = driver.resume();
  await new Promise((resolve) => setImmediate(resolve));
  driver.pause();
  release();
  await pending;
  assert.equal(driver.sim.status, "paused");
  assert.ok(driver.sim.npcs.every((n) => !n.action));
});
test("prefetched decisions wait for action completion and cancel on pause", async () => {
  const driver = new Driver((async (_url, init) =>
    json(
      await mockProvider(
        JSON.parse(String(init?.body)),
        new AbortController().signal,
      ),
    )) as typeof fetch);
  driver.sim.start("mock", "fixture");
  const n = driver.sim.npcs[0];
  const initial = driver.sim.request(n);
  driver.sim.apply(
    initial,
    await mockProvider(initial, new AbortController().signal),
  );
  const current = n.action;
  await driver.decide(driver.sim.request(n), new AbortController());
  assert.equal(driver.traces.at(-1)?.status, "queued");
  assert.equal(n.action, current);
  n.action = null;
  driver.flush();
  assert.equal(driver.traces.at(-1)?.status, "applied");
  await driver.decide(driver.sim.request(n), new AbortController());
  driver.cancel();
  assert.equal(driver.queued.size, 0);
  assert.equal(driver.traces.at(-1)?.status, "cancelled");
});
test("auto-reload fills an empty magazine after the normal delay and records the input", () => {
  const driver = new Driver();
  driver.sim.start("mock", "fixture");
  driver.busy = true;
  driver.sim.player.ammo = 0;
  driver.update(1 / 60);
  assert.ok(driver.sim.player.reloadUntil > driver.sim.tick);
  assert.equal(driver.sim.recording.inputs[0].input.reload, true);
  for (let i = 0; i < 73; i++) driver.update(1 / 60);
  assert.equal(driver.sim.player.ammo, 12);
});
test("disabling auto-reload preserves manual R and does not top up a partial magazine", () => {
  const driver = new Driver();
  driver.sim.start("mock", "fixture");
  driver.busy = true;
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
  driver.sim.start("mock", "fixture");
  driver.busy = true;
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

test("recovery resolves destination contention using fresh model choices without resetting accepted actions", async () => {
  const calls = new Map<string, number>();
  const driver = new Driver(async (url, init) => {
    if (url === "/api/invalidate") return json({ ok: true });
    const r = JSON.parse(String(init?.body));
    calls.set(r.observation.npc, (calls.get(r.observation.npc) ?? 0) + 1);
    const result = await mockProvider(r, new AbortController().signal);
    result.selected =
      r.candidates.find(
        (c: any) =>
          c.kind === "move" && c.destination.x === 0 && c.destination.z === 8,
      )?.id ?? "hold";
    return json(result);
  });
  driver.sim.start("mock", "reservation-fixture");
  driver.sim.npcs = [];
  driver.sim.addNPC("rifleman", { x: 0, z: 4 });
  driver.sim.addNPC("rifleman", { x: 4, z: 8 });
  driver.sim.pause();
  await driver.resume();
  assert.equal(driver.sim.tick, 0);
  assert.equal(driver.sim.status, "running");
  assert.equal(driver.totals.rejected, 1);
  assert.equal(driver.totals.requested, 3);
  assert.deepEqual([...calls.values()].sort(), [1, 2]);
  assert.ok(
    driver.sim.npcs.every((n) => n.action && n.decision?.source === "mock"),
  );
  assert.equal(
    driver.sim.npcs.filter((n) => n.action?.kind === "move").length,
    1,
  );
});

test("rejected stale choice becomes immediately eligible for fresh inference without a fallback", async () => {
  const driver = new Driver();
  driver.sim.start("mock", "fresh-choice-fixture");
  const npc = driver.sim.addNPC("rifleman", { x: 0, z: 4 });
  const request = driver.sim.request(npc);
  const decision = await mockProvider(request, new AbortController().signal);
  driver.sim.tick = 61;
  npc.nextDecision = 120;
  driver.applyTrace({ id: 1, request, decision, status: "pending" });
  assert.equal(npc.action, null);
  assert.equal(npc.nextDecision, 61);
  assert.equal(driver.totals.rejected, 1);
  assert.equal(driver.totals.applied, 0);
});

test("waiting actors outrank prefetches and a queued choice is consumed before starvation", async () => {
  const requested: string[] = [];
  const driver = new Driver(async (_url, init) => {
    const r = JSON.parse(String(init?.body));
    requested.push(r.observation.npc);
    return json(await mockProvider(r, new AbortController().signal));
  });
  driver.sim.start("mock", "urgency-fixture");
  driver.sim.npcs = [];
  for (let i = 0; i < 4; i++) {
    const n = driver.sim.addNPC("rifleman", { x: i * 2, z: 4 });
    n.action = { id: "hold", kind: "hold", duration: 1 };
    n.actionUntil = 120;
    n.nextDecision = 0;
  }
  const waiting = driver.sim.addNPC("rifleman", { x: 10, z: 4 });
  waiting.nextDecision = 80;
  driver.sim.tick = 90;
  driver.schedule();
  assert.equal(requested[0], waiting.id);
  assert.equal(driver.pending.size, 4);
  await new Promise((resolve) => setImmediate(resolve));
  driver.cancel();
  const s = driver.sim;
  s.npcs = [waiting];
  s.mode = "strict";
  waiting.action = null;
  waiting.starvedAt = 0;
  const r = s.request(waiting);
  const d = await mockProvider(r, new AbortController().signal);
  d.source = "jev";
  d.selected = "hold";
  driver.queued.set(waiting.id, {
    id: 99,
    request: r,
    decision: d,
    status: "queued",
  });
  driver.update(1 / 60);
  assert.equal(s.status, "running");
  assert.equal(s.tick, 91);
  assert.equal(s.npcs[0].action?.kind, "hold");
});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function starve(driver: Driver) {
  driver.sim.tick += 90;
  for (const n of driver.sim.npcs) {
    n.action = null;
    n.starvedAt = driver.sim.tick - 90;
  }
  driver.update(1 / 60);
}
test("strict starvation automatically reconnects with frozen simulation and fresh model-shaped fixture decisions", async () => {
  let clock = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const driver = new Driver(
    async (url, init) => {
      if (url === "/api/invalidate") return json({ ok: true });
      await gate;
      const d = await mockProvider(
        JSON.parse(String(init?.body)),
        new AbortController().signal,
      );
      // Synthetic contract fixture; never a live-service measurement.
      return json({ ...d, source: "jev", model: "test-only-contract-fixture" });
    },
    () => clock,
  );
  driver.sim.start("strict", "automatic-recovery-fixture");
  starve(driver);
  assert.equal(driver.automaticRecoveryPending, true);
  await settle();
  clock = 400;
  driver.update(1 / 60);
  assert.equal(driver.recovering, true);
  driver.update(1);
  assert.equal(driver.sim.tick, 90);
  release();
  await settle();
  assert.equal(driver.sim.status, "running");
  assert.equal(driver.recovering, false);
  assert.equal(driver.autoRecoveryAttempts, 1);
  assert.ok(driver.sim.npcs.every((n) => n.action));
  assert.equal(driver.sim.tick, 90);
});
test("automatic retries respect provider backoff and stop after two failed attempts", async () => {
  let clock = 0,
    calls = 0;
  const driver = new Driver(
    async (url) => {
      if (url === "/api/invalidate") return json({ ok: true });
      calls++;
      return json({ error: "provider_http_429", retryMs: 3000 }, 503);
    },
    () => clock,
  );
  driver.sim.start("strict", "bounded-recovery-fixture");
  starve(driver);
  await settle();
  clock = 400;
  driver.update(0);
  await settle();
  assert.equal(calls, 1);
  assert.equal(driver.retryWaitSeconds, 3);
  clock = 2000;
  driver.update(1);
  await driver.retry();
  assert.equal(calls, 1);
  clock = 3500;
  driver.update(0);
  await settle();
  assert.equal(calls, 2);
  assert.equal(driver.automaticRecoveryPending, false);
  clock = 10000;
  for (let i = 0; i < 10; i++) driver.update(1);
  assert.equal(calls, 2);
  assert.equal(driver.sim.status, "reconnecting");
  assert.equal(driver.sim.tick, 90);
  assert.ok(driver.sim.npcs.every((n) => !n.action));
});
test("automatic recovery stops when the user pauses and late results cannot restart the game", async () => {
  let clock = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const driver = new Driver(
    async (url, init) => {
      if (url === "/api/invalidate") return json({ ok: true });
      await gate;
      return json({
        ...(await mockProvider(
          JSON.parse(String(init?.body)),
          new AbortController().signal,
        )),
        source: "jev",
        model: "test-only-contract-fixture",
      });
    },
    () => clock,
  );
  driver.sim.start("strict", "cancel-auto-fixture");
  starve(driver);
  await settle();
  clock = 400;
  driver.update(0);
  await settle();
  driver.pause();
  release();
  await settle();
  clock = 10000;
  driver.update(1);
  assert.equal(driver.sim.status, "paused");
  assert.equal(driver.automaticRecoveryPending, false);
  assert.ok(driver.sim.npcs.every((n) => !n.action));
});
test("repeated starvation cannot exceed four automatic recovery attempts per minute", async () => {
  let clock = 0,
    calls = 0;
  const driver = new Driver(
    async (url, init) => {
      if (url === "/api/invalidate") return json({ ok: true });
      calls++;
      return json({
        ...(await mockProvider(
          JSON.parse(String(init?.body)),
          new AbortController().signal,
        )),
        source: "jev",
        model: "test-only-contract-fixture",
      });
    },
    () => clock,
  );
  driver.sim.start("strict", "auto-window-fixture");
  for (let i = 0; i < 5; i++) {
    starve(driver);
    await settle();
    clock += 500;
    driver.update(0);
    await settle();
  }
  assert.equal(calls, 4);
  assert.equal(driver.sim.status, "reconnecting");
  assert.equal(driver.automaticRecoveryPending, false);
});

test("recovery stops new batches after Retry-After and keeps the longest concurrent backoff", async () => {
  let calls = 0;
  const driver = new Driver(
    async (url) => {
      if (url === "/api/invalidate") return json({ ok: true });
      calls++;
      return json(
        { error: "provider_http_429", retryMs: calls === 1 ? 8000 : 2000 },
        503,
      );
    },
    () => 100,
  );
  driver.sim.start("strict", "batch-backoff-fixture");
  for (let i = 0; i < 6; i++) driver.sim.addNPC("rifleman", { x: i * 2, z: 4 });
  driver.sim.pause();
  await driver.resume();
  assert.equal(calls, 4);
  assert.equal(driver.backoff, 8100);
  assert.equal(driver.sim.status, "reconnecting");
  assert.ok(driver.sim.npcs.every((n) => !n.action));
});

test("losing focus on the briefing does not invalidate a nonexistent session or show a connection error", async () => {
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
