import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../apps/server/src/store";
import { publicName, NameRejected } from "../apps/server/src/name-policy";
import { DEFAULT_PUBLIC_SETTINGS } from "../apps/server/src/public-policy";
import { DEFAULT_BOARD } from "../packages/shared/leaderboard";

test("public names reject profanity, sexual content and obfuscation but keep ordinary Unicode nicknames", () => {
  for (const name of [
    "fuck",
    "f.u.c.k",
    "fuuuuuck",
    "fück",
    "p0rn",
    "porn star",
    "hentai",
    "sex",
    "SexyCaptain",
    "sexmaster",
    "s.e.x.y",
    "nudes",
    "NSFW",
    "OnlyFans",
    "<script>",
    "hidden\u200bname",
    "line\nbreak",
    "x".repeat(41),
  ])
    assert.throws(() => publicName(name), NameRejected, name);
  for (const name of [
    "Coffee Captain",
    "João",
    "Café ☕",
    "O'Connor",
    "Scunthorpe",
    "Classic",
    "Sexton",
    "玩家",
    "  Friendly!  ",
  ])
    assert.equal(publicName(name), name.trim().normalize());
});

test("guest names persist separately, omitted names use full guest ID, and score edits remember names", () => {
  const dir = mkdtempSync(join(tmpdir(), "coffee-names-"));
  const path = join(dir, "names.sqlite");
  let now = Date.now();
  let store = new Store(path, () => now);
  try {
    store.savePublicSettings({
      ...DEFAULT_PUBLIC_SETTINGS,
      publicEnabled: true,
    });
    const token = store.createGuest("network", "  Café Captain  ");
    const id = store.identity(token)!;
    assert.match(id, /^guest_[0-9a-f]{24}$/);
    assert.deepEqual(
      { ...store.playerProfile(id) },
      {
        id,
        displayName: "Café Captain",
      },
    );
    const anonymous = store.identity(store.createGuest("network"))!;
    assert.equal(store.playerProfile(anonymous).displayName, "");
    assert.throws(
      () => store.createGuest("network", "porn star"),
      NameRejected,
    );
    assert.equal(
      store.listInvites().length,
      2,
      "rejected names do not create guests",
    );
    const report = {
      score: 100,
      time: 20,
      kills: 1,
      deliveries: 0,
      level: 1,
      won: false,
    };
    function run(session: string, player: string) {
      store.startSession(session, player, "network", DEFAULT_BOARD);
      const usage = store.reserveUsage(session, 10);
      store.settleUsage(usage, 10);
      now += 20000;
      store.endSession(session);
    }
    run("named-run", id);
    assert.throws(
      () =>
        store.submitScore("named-run", id, "network", {
          name: "f.u.c.k",
          report,
        }),
      NameRejected,
    );
    assert.equal(store.leaderboard().length, 0);
    store.submitScore("named-run", id, "network", {
      name: "New Captain",
      report,
    });
    assert.equal(store.playerProfile(id).displayName, "New Captain");
    store.submitScore("named-run", id, "network", {
      name: "Different",
      report,
    });
    assert.equal(
      store.playerProfile(id).displayName,
      "New Captain",
      "duplicate runs cannot rename a profile",
    );
    run("anonymous-run", anonymous);
    store.submitScore("anonymous-run", anonymous, "network", {
      name: anonymous,
      report,
    });
    assert.equal(store.playerProfile(anonymous).displayName, "");
    assert.ok(store.leaderboard().some((e) => e.name === anonymous));
    store.close();
    store = new Store(path, () => now);
    assert.equal(store.playerProfile(id).displayName, "New Captain");
    assert.equal(
      store.listInvites().find((row) => row.id === id)?.displayName,
      "New Captain",
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
