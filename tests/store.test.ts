import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/server/src/store";
const password = "long-test-password-123456";

test("password hashing, login expiry, rotation, revocation and one-time import survive restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "coffee-store-"));
  const path = join(dir, "state.sqlite");
  let now = Date.UTC(2026, 8, 20);
  let store = new Store(path, () => now);
  try {
    await store.importInvites(JSON.stringify({ alice: password }));
    assert.equal(await store.authenticate("alice", password), true);
    assert.equal(await store.authenticate("alice", "wrong"), false);
    assert.equal(await store.authenticate("unknown", password), false);
    const token = store.createLogin("alice");
    assert.equal(store.identity(token), "alice");
    assert.equal(store.identity(token + "x"), null);
    store.logout(token);
    assert.equal(store.identity(token), null);
    const expired = store.createLogin("alice");
    now += 7 * 86400_000;
    assert.equal(store.identity(expired), null);
    const rotated = store.createLogin("alice");
    await store.saveInvite("alice", "a-different-long-password", 1, true);
    assert.equal(store.identity(rotated), null);
    assert.equal(await store.authenticate("alice", password), false);
    store.startSession("secret-session", "alice");
    assert.equal(store.sessionActive("secret-session"), true);
    store.revokeInvite("alice");
    assert.equal(store.sessionActive("secret-session"), false);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(path + "-wal").mode & 0o777, 0o600);
    assert.equal(store.ownsSession("secret-session", "alice"), false);
    store.close();
    assert.equal(readFileSync(path).includes(Buffer.from(password)), false);
    store = new Store(path, () => now);
    await store.importInvites(
      JSON.stringify({ alice: password, bob: password }),
    );
    assert.equal(store.getInvite("alice")?.enabled, false);
    assert.equal(store.getInvite("bob"), undefined);
    assert.equal(store.listInvites()[0].loginCount, 3);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrency is per invite and leases, ownership and bounded active time are enforced", async () => {
  let now = 1000;
  const store = new Store(":memory:", () => now);
  try {
    await store.saveInvite("alice", password, 1, true);
    await store.saveInvite("bob", password, 1, true);
    store.startSession("one", "alice");
    assert.throws(() => store.startSession("two", "alice"), /Concurrent/);
    assert.equal(store.heartbeat("one", "bob", true), false);
    store.heartbeat("one", "alice", true);
    now += 40_000;
    store.heartbeat("one", "alice", true);
    assert.equal(store.listInvites()[0].activeMs, 15_000);
    now += 1000;
    store.heartbeat("one", "alice", false);
    now += 1000;
    store.heartbeat("one", "alice", true);
    assert.equal(store.listInvites()[0].activeMs, 15_000);
    assert.ok(!JSON.stringify(store.activeSessions()).includes('"one"'));
    now += 90_000;
    assert.deepEqual(store.expireSessions(), ["one"]);
    store.startSession("two", "alice");
    now += 1800_000;
    assert.equal(store.ownsSession("two", "alice"), false);
  } finally {
    store.close();
  }
});
