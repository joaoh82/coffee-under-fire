import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/server/src/store";
import { DEFAULT_PUBLIC_SETTINGS } from "../apps/server/src/public-policy";
import { Pipeline, LIMITS } from "../apps/server/src/pipeline";
import { Simulation } from "../apps/web/src/game/simulation";
import { mockProvider } from "../apps/server/src/jev";
const open = (store: Store) =>
  store.savePublicSettings({ ...DEFAULT_PUBLIC_SETTINGS, publicEnabled: true });
test("guest and network concurrency, repeated IDs, daily allowances and global invite spending", async () => {
  const store = new Store(":memory:", Date.now, 100_000_000, 1);
  try {
    open(store);
    const a = store.identity(store.createGuest("network-a"))!;
    const b = store.identity(store.createGuest("network-a"))!;
    const c = store.identity(store.createGuest("network-a"))!;
    store.startSession("a", a, "network-a");
    assert.throws(() => store.startSession("a2", a, "network-a"), /Concurrent/);
    store.startSession("b", b, "network-a");
    assert.throws(
      () => store.startSession("c", c, "network-a"),
      /ip_session_limit/,
    );
    store.reserveUsage("a", 200000);
    assert.throws(
      () => store.reserveUsage("a", 50000),
      /guest_daily_budget_exhausted/,
    );
    store.reserveUsage("b", 200000);
    store.endSession("a");
    store.startSession("c", c, "network-a");
    assert.throws(
      () => store.reserveUsage("c", 80000),
      /ip_daily_budget_exhausted/,
    );
    // Clearing cookies cannot clear shared network spending.
    const d = store.identity(store.createGuest("network-a"))!;
    assert.ok(d !== a);
    assert.throws(() => store.createGuest("network-a"), /guest_creation_limit/);
    await store.saveInvite("owner-player", "a-long-test-password", 1, true);
    store.startSession("owner-game", "owner-player");
    const reservation = store.reserveUsage("owner-game", 1400000);
    assert.throws(
      () => store.reserveUsage("owner-game", 100001),
      /daily_budget_exhausted/,
    );
    assert.equal(store.dailyBudget().chargedUsd, 1.8);
    store.settleUsage(reservation, 1000000);
    assert.equal(store.dailyBudget().chargedUsd, 1.4);
    store.settleUsage(reservation, 0);
    assert.equal(store.dailyBudget().chargedUsd, 1.4);
    store.savePublicSettings({
      ...store.publicSettings(),
      publicEnabled: false,
    });
    assert.equal(store.sessionActive("b"), false);
    assert.equal(store.sessionActive("c"), false);
    assert.equal(store.sessionActive("owner-game"), true);
    assert.throws(
      () => store.startSession("new", b, "network-b"),
      /public_closed/,
    );
  } finally {
    store.close();
  }
});
test("daily reservations survive restart, price changes, unknown settlement and UTC rollover", async () => {
  let now = Date.UTC(2026, 8, 20, 23, 59, 30);
  const dir = mkdtempSync(join(tmpdir(), "guest-budget-")),
    file = join(dir, "state.sqlite");
  let store = new Store(file, () => now, 100_000_000, 1);
  try {
    await store.saveInvite("alice", "a-long-test-password", 1, true);
    store.startSession("first", "alice");
    const id = store.reserveUsage("first", 1800000);
    store.close();
    store = new Store(file, () => now, 100_000_000, 2);
    assert.equal(store.dailyBudget().chargedUsd, 1.8);
    store.startSession("second", "alice");
    assert.throws(
      () => store.reserveUsage("second", 60000),
      /daily_budget_exhausted/,
    );
    store.settleUsage(id, undefined, true);
    assert.equal(store.dailyBudget().chargedUsd, 1.8);
    now += 31000;
    assert.equal(store.dailyBudget().chargedUsd, 0);
    assert.equal(store.dailyBudget().resetAt, Date.UTC(2026, 8, 22));
    assert.ok(store.reserveUsage("second", 10000));
    store.savePublicSettings({ ...store.publicSettings(), dailyCents: 0 });
    assert.throws(
      () => store.reserveUsage("second", 1),
      /daily_budget_exhausted/,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("budget denial happens before the provider is contacted", async () => {
  const store = new Store(":memory:");
  try {
    await store.saveInvite("alice", "a-long-test-password", 1, true);
    let calls = 0;
    const p = new Pipeline(
      async (r, s) => {
        calls++;
        return mockProvider(r, s);
      },
      Date.now,
      LIMITS,
      store,
    );
    const session = p.create();
    store.startSession(session, "alice");
    const sim = new Simulation();
    sim.start("mock", session);
    const npc = sim.addNPC("rifleman", { x: 0, z: 0 });
    store.savePublicSettings({ ...store.publicSettings(), dailyCents: 0 });
    await assert.rejects(
      p.decide(session, sim.request(npc)),
      /daily_budget_exhausted/,
    );
    assert.equal(calls, 0);
    assert.equal(p.active, 0);
  } finally {
    store.close();
  }
});

test("legacy usage migration charges current month conservatively, excludes older months", async () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-migration-")),
    file = join(dir, "state.sqlite");
  const now = Date.UTC(2026, 8, 20);
  let store = new Store(file, () => now, 100_000_000, 1);
  try {
    await store.saveInvite("alice", "a-long-test-password", 1, true);
    store.startSession("one", "alice");
    const recent = store.reserveUsage("one", 1000),
      old = store.reserveUsage("one", 1000);
    store.close();
    const db = new DatabaseSync(file);
    db.prepare("UPDATE usage SET day=NULL,month='2026-08' WHERE id=?").run(old);
    db.prepare("UPDATE usage SET day=NULL WHERE id=?").run(recent);
    db.close();
    store = new Store(file, () => now, 100_000_000, 1);
    assert.equal(store.dailyBudget().chargedUsd, 0.001);
    assert.equal(store.budget().charged, 1000);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
