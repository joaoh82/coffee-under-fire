import { test } from "node:test";
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { Store } from "../apps/server/src/store";

function fixture(now = Date.parse("2026-09-21T12:00:00Z")) {
  const store = new Store(":memory:", () => now);
  // Synthetic persisted rows exercise aggregate queries without generating credentials.
  const db = (store as unknown as { db: DatabaseSync }).db;
  const player = (id: string, name = "") =>
    db
      .prepare(
        "INSERT INTO invites(id,salt,password_hash,enabled,max_sessions,display_name) VALUES(?,'fixture','fixture',1,1,?)",
      )
      .run(id, name);
  let serial = 0;
  const login = (id: string, created: number, revision = 1) =>
    db
      .prepare(
        "INSERT INTO logins(token_hash,invite_id,revision,created,expires) VALUES(?,?,?,?,?)",
      )
      .run(`fixture-${++serial}`, id, revision, created, created + 86400000);
  const run = (id: string, started: number, ms: number) => {
    const session = `session-${++serial}`;
    db.prepare(
      "INSERT INTO sessions(id,management_id,invite_id,started,heartbeat,active_ms,ended) VALUES(?,?,?,?,?,?,?)",
    ).run(session, session, id, started, started + ms, ms, started + ms);
    return session;
  };
  return { store, db, player, login, run, now };
}

test("admin player pagination includes every identity beyond old 200 cap, clamps pages and sorts stably", () => {
  const f = fixture();
  try {
    for (let i = 0; i < 231; i++) {
      const id = `player_${String(i).padStart(3, "0")}`;
      f.player(id);
      f.login(id, f.now - i * 1000);
      f.run(id, f.now - 10000, i * 100);
    }
    const first = f.store.pagedInvites();
    assert.equal(first.total, 231);
    assert.equal(first.pages, 10);
    assert.equal(first.rows.length, 25);
    assert.equal(first.rows[0].id, "player_000");
    assert.equal(
      f.store.pagedInvites({ sort: "lastLogin", direction: "asc" }).rows[0].id,
      "player_230",
    );
    assert.equal(
      f.store.pagedInvites({ sort: "playTime" }).rows[0].id,
      "player_230",
    );
    assert.equal(
      f.store.pagedInvites({ sort: "playTime", direction: "asc" }).rows[0].id,
      "player_000",
    );
    assert.equal(f.store.pagedInvites({ page: 999 }).rows.length, 6);
    assert.equal(f.store.pagedInvites({ page: -1 }).page, 1);
    assert.equal(f.store.pagedInvites({ page: NaN }).page, 1);
    const ids = Array.from({ length: 10 }, (_, i) =>
      f.store.pagedInvites({ page: i + 1 }).rows.map((r) => r.id),
    ).flat();
    assert.equal(new Set(ids).size, 231);
    f.player("tie_b");
    f.player("tie_a");
    const ties = f.store.pagedInvites({ search: "tie", sort: "playTime" });
    assert.deepEqual(
      ties.rows.map((r) => r.id),
      ["tie_a", "tie_b"],
    );
  } finally {
    f.store.close();
  }
});

test("admin search treats SQL metacharacters literally and matches IDs and current display names", () => {
  const f = fixture();
  try {
    f.player("guest_alpha", "Coffee % Captain");
    f.player("invite_beta", "Coffee Captain");
    f.db
      .prepare("INSERT INTO guests VALUES(?,?,?)")
      .run("guest_alpha", f.now, "fixture-network");
    for (let i = 0; i < 31; i++) f.login("guest_alpha", f.now);
    f.login("invite_beta", f.now);
    assert.equal(
      f.store.pagedInvites({ search: "GUEST_ALPHA" }).rows[0].isGuest,
      true,
    );
    assert.equal(f.store.pagedInvites({ search: "coffee" }).total, 2);
    assert.equal(f.store.pagedInvites({ search: "%" }).total, 1);
    assert.equal(f.store.pagedInvites({ search: "' OR 1=1 --" }).total, 0);
    assert.equal(f.store.pagedInvites({ search: "absent", page: 3 }).page, 1);
    const page = f.store.pagedLogins({ search: "%", page: 2 });
    assert.equal(page.total, 31);
    assert.equal(page.rows.length, 6);
    assert.ok(page.rows.every((row) => row.displayName === "Coffee % Captain"));
    assert.equal(f.store.pagedLogins({ search: "INVITE_BETA" }).total, 1);
    f.db.prepare("UPDATE invites SET revision=2 WHERE id='guest_alpha'").run();
    assert.ok(
      f.store
        .pagedLogins({ search: "guest_alpha" })
        .rows.every((row) => row.revoked),
    );
    f.db.prepare("UPDATE invites SET enabled=0 WHERE id='invite_beta'").run();
    assert.equal(
      f.store.pagedLogins({ search: "invite_beta" }).rows[0].revoked,
      true,
    );
    assert.equal("token_hash" in page.rows[0], false);
    f.player("accented", "Café Captain");
    assert.equal(f.store.pagedInvites({ search: "CAFÉ" }).total, 1);
  } finally {
    f.store.close();
  }
});

test("analytics zero fills UTC days and deduplicates active identities without multiplying usage through logins", () => {
  const f = fixture();
  try {
    const empty = f.store.analytics(7);
    assert.equal(empty.days.length, 7);
    assert.equal(empty.days[0].day, "2026-09-15");
    assert.equal(empty.days[6].day, "2026-09-21");
    assert.ok(
      empty.days.every((day) => day.averageMinutes === 0 && day.costUsd === 0),
    );
    f.player("returning");
    f.player("new");
    f.player("unused");
    f.login("returning", Date.parse("2026-09-01T00:00:00Z"));
    f.login("returning", f.now);
    f.login("returning", f.now);
    f.login("new", Date.parse("2026-09-20T23:59:59Z"));
    f.login("new", f.now);
    // Midnight-crossing historical play belongs entirely to start day.
    const a = f.run("new", Date.parse("2026-09-20T23:59:00Z"), 120000);
    f.run("returning", f.now, 60000);
    f.run("returning", f.now, 60000);
    const b = f.run("new", f.now, 120000);
    f.run("unused", f.now, 0);
    f.db
      .prepare(
        "INSERT INTO usage(id,session_id,month,tokens,day,cost,settled) VALUES('a',?,'2026-09',100,'2026-09-20',1000000,1),('b',?,'2026-09',200,'2026-09-21',2000000,0)",
      )
      .run(a, b);
    const result = f.store.analytics(7);
    assert.equal(result.totalPlayers, 3);
    assert.equal(result.uniqueActiveUsers, 2);
    assert.equal(result.newUsers, 1);
    assert.equal(result.runs, 5);
    assert.equal(result.activeMs, 360000);
    assert.equal(result.costUsd, 0.003);
    assert.equal(result.historicalApproximation, true);
    assert.deepEqual(result.days[5], {
      day: "2026-09-20",
      activeUsers: 1,
      newUsers: 1,
      runs: 1,
      activeMs: 120000,
      averageMinutes: 2,
      costUsd: 0.001,
    });
    assert.deepEqual(result.days[6], {
      day: "2026-09-21",
      activeUsers: 2,
      newUsers: 0,
      runs: 4,
      activeMs: 240000,
      averageMinutes: 2,
      costUsd: 0.002,
    });
    assert.equal(JSON.stringify(result).includes("returning"), false);
    assert.equal(f.store.analytics(90).days.length, 90);
  } finally {
    f.store.close();
  }
});
