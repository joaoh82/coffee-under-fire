import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/server/src/store";
import { DEFAULT_PUBLIC_SETTINGS } from "../apps/server/src/public-policy";
const open = (store: Store) =>
  store.savePublicSettings({ ...DEFAULT_PUBLIC_SETTINGS, publicEnabled: true });
test("guest and network concurrency, repeated IDs and closing public play", async () => {
  const store = new Store(":memory:");
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
    store.endSession("a");
    store.startSession("c", c, "network-a");
    // Clearing cookies creates a new guest but cannot exceed the daily cap.
    const d = store.identity(store.createGuest("network-a"))!;
    assert.ok(d !== a);
    assert.throws(
      () => store.createGuest("network-a"),
      /guest_daily_creation_limit/,
    );
    await store.saveInvite("owner-player", "a-long-test-password", 1, true);
    store.startSession("owner-game", "owner-player");
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
test("databases from the Jev era keep working: legacy usage rows and spending caps are ignored", async () => {
  const dir = mkdtempSync(join(tmpdir(), "coffee-legacy-"));
  const path = join(dir, "state.sqlite");
  try {
    let store = new Store(path);
    await store.saveInvite("alice", "a-long-test-password", 1, true);
    store.close();
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE usage (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, month TEXT NOT NULL, tokens INTEGER NOT NULL)",
    );
    db.prepare(
      "INSERT INTO metadata(key,value) VALUES('public_settings',?)",
    ).run(
      JSON.stringify({
        publicEnabled: true,
        dailyCents: 0,
        guestCents: 0,
        ipCents: 0,
        ipConcurrent: 3,
      }),
    );
    db.close();
    store = new Store(path);
    assert.deepEqual(store.publicSettings(), {
      publicEnabled: true,
      ipConcurrent: 3,
    });
    // A zero spending cap used to block play; it no longer applies.
    store.startSession("game", "alice");
    assert.equal(store.sessionActive("game"), true);
    const guest = store.identity(store.createGuest("network"))!;
    store.startSession("guest-game", guest, "network");
    assert.equal(store.listInvites().length, 2);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("new guest profile limit resets at midnight UTC without invalidating existing logins", () => {
  let now = Date.UTC(2026, 8, 20, 23, 59, 59);
  const store = new Store(":memory:", () => now);
  try {
    open(store);
    const token = store.createGuest("same-network");
    for (let i = 0; i < 3; i++) store.createGuest("same-network");
    assert.throws(
      () => store.createGuest("same-network"),
      /guest_daily_creation_limit/,
    );
    assert.ok(store.identity(token));
    now += 1000;
    assert.ok(store.createGuest("same-network"));
    assert.ok(store.identity(token));
  } finally {
    store.close();
  }
});
