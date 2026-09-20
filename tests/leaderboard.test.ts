import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../apps/server/src/store";
import {
  DEFAULT_BOARD,
  nicknameSchema,
  reportPoints,
} from "../packages/shared/leaderboard";
import { leaderboardPage } from "../apps/server/src/leaderboard-page";
import { shareMessage, cleanShareUrl } from "../apps/web/src/ui/share-result";
const report = {
  score: 120,
  time: 20,
  kills: 3,
  deliveries: 0,
  level: 2,
  won: false,
};
const input = { name: "Coffee Captain", report };
test("community leaderboard binds runs, validates submissions, prevents duplicates and keeps best per category", async () => {
  let now = Date.UTC(2026, 8, 20);
  const store = new Store(":memory:", () => now);
  const run = (id: string, player: string, options = DEFAULT_BOARD) => {
    store.startSession(id, player, "", options);
    const reserve = store.reserveUsage(id, 10);
    store.settleUsage(reserve, 10);
    now += 20000;
    store.endSession(id);
  };
  try {
    await store.saveInvite("alice", "fixture-password-long", 1, true);
    await store.saveInvite("bob", "fixture-password-long", 1, true);
    run("alice1", "alice");
    assert.throws(
      () => store.submitScore("alice1", "bob", "", input),
      /not owned/,
    );
    for (const bad of [
      { ...input, name: "<script>" },
      { ...input, name: "x".repeat(41) },
      { ...input, report: { ...report, score: Infinity } },
      { ...input, report: { ...report, time: 1800 } },
      { ...input, report: { ...report, won: true } },
    ])
      assert.throws(() => store.submitScore("alice1", "alice", "", bad));
    const result = store.submitScore("alice1", "alice", "", input);
    assert.equal(result.alreadySubmitted, false);
    assert.equal(
      store.submitScore("alice1", "alice", "", {
        ...input,
        name: "Other",
        report: { ...report, score: 999 },
      }).alreadySubmitted,
      true,
    );
    assert.equal(store.leaderboard()[0].score, 140);
    assert.equal(store.leaderboard()[0].name, "Coffee Captain");
    run("alice2", "alice");
    store.submitScore("alice2", "alice", "", {
      name: "Captain Two",
      report: { ...report, score: 200 },
    });
    run("bob1", "bob");
    store.submitScore("bob1", "bob", "", input);
    assert.equal(store.leaderboard().length, 2);
    assert.equal(store.leaderboard()[0].name, "Captain Two");
    assert.ok(!JSON.stringify(store.leaderboard()).includes("alice"));
    assert.ok(!JSON.stringify(store.leaderboard()).includes("session"));
    const easy = { ...DEFAULT_BOARD, difficulty: "easy.v1" as const };
    run("aliceEasy", "alice", easy);
    store.submitScore("aliceEasy", "alice", "", input);
    assert.equal(store.leaderboard(easy).length, 1);
    assert.equal(store.leaderboard().length, 2);
    store.hideScore(result.id);
    assert.throws(
      () => store.submitScore("alice1", "alice", "", input),
      /moderator/,
    );
    store.startSession("noJev", "alice", "", DEFAULT_BOARD);
    now += 20000;
    store.endSession("noJev");
    assert.throws(
      () => store.submitScore("noJev", "alice", "", input),
      /live Jev/,
    );
    run("old", "alice");
    now += 3600001;
    assert.throws(() => store.submitScore("old", "alice", "", input), /timing/);
  } finally {
    store.close();
  }
});
test("guest score network binding and persisted moderation", () => {
  let now = Date.UTC(2026, 8, 20);
  const dir = mkdtempSync(join(tmpdir(), "board-")),
    file = join(dir, "db.sqlite");
  let store = new Store(file, () => now);
  try {
    store.savePublicSettings({
      ...store.publicSettings(),
      publicEnabled: true,
    });
    const guest = store.identity(store.createGuest("network"))!;
    store.startSession("guestGame", guest, "network", DEFAULT_BOARD);
    const r = store.reserveUsage("guestGame", 10);
    store.settleUsage(r, 10);
    now += 20000;
    store.endSession("guestGame");
    assert.throws(
      () => store.submitScore("guestGame", guest, "other", input),
      /not owned/,
    );
    const saved = store.submitScore("guestGame", guest, "network", input);
    store.close();
    store = new Store(file, () => now);
    assert.equal(store.leaderboard().length, 1);
    store.hideScore(saved.id);
    assert.equal(store.leaderboard().length, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("share text matches report points, strips private URL parts; public HTML escapes names", () => {
  assert.equal(reportPoints(report), 140);
  assert.match(shareMessage(report), /140 points/);
  assert.match(shareMessage(report), /Jev/);
  assert.equal(
    cleanShareUrl("https://game.example/access/login?token=secret#private"),
    "https://game.example/",
  );
  assert.equal(
    cleanShareUrl("http://127.0.0.1:5173"),
    "https://coffee-under-fire.onrender.com/",
  );
  assert.equal(nicknameSchema.parse(" João 82 "), "João 82");
  assert.equal(nicknameSchema.safeParse("Café ☕!").success, true);
  const html = leaderboardPage(DEFAULT_BOARD, [
    {
      id: "public",
      name: "<script>alert(1)</script>",
      score: 140,
      time: 20,
      kills: 3,
      deliveries: 0,
      created: 0,
    },
  ]);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /not anti-cheat verified/);
});
