import { Store } from "../apps/server/src/store";
import { DEFAULT_BOARD } from "../packages/shared/leaderboard";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("managed production binds games to invites and enforces admin revocation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coffee-managed-"));
  const reservation = createServer();
  await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((r) => reservation.close(() => r()));
  const origin = "https://game.example";
  const password = "production-fixture-password-12345";
  const owner = "fixture-owner-token-at-least-32-characters";
  // Seed an explicitly synthetic completed Jev run; no provider requests occur.
  let fixtureNow = Date.now() - 20000;
  const fixtureStore = new Store(join(dir, "access.sqlite"), () => fixtureNow);
  await fixtureStore.saveInvite("alice", password, 1, true);
  fixtureStore.startSession(
    "score-fixture-session",
    "alice",
    "",
    DEFAULT_BOARD,
  );
  const reservationId = fixtureStore.reserveUsage("score-fixture-session", 10);
  fixtureStore.settleUsage(reservationId, 10);
  fixtureNow += 20000;
  fixtureStore.endSession("score-fixture-session");
  const fixtureLogin = fixtureStore.createLogin("alice");
  fixtureStore.close();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        PUBLIC_ORIGIN: origin,
        ACCESS_DB_PATH: join(dir, "access.sqlite"),
        ADMIN_TOKEN: owner,
        PLAYTEST_INVITES: JSON.stringify({ alice: password, bob: password }),
        DECISION_MODE: "strict",
        TYPESAFE_API_KEY: "fixture-no-provider-calls",
      },
      stdio: "ignore",
    },
  );
  const exited = new Promise((r) => child.once("exit", r));
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
      ...init,
    });
  const form = (path: string, fields: Record<string, string>, cookie = "") =>
    request(path, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
    });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready = (await request("/healthz")).ok;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(ready);
    assert.equal((await request("//")).status, 400);
    assert.equal((await request("/healthz")).status, 200);
    const publicBoard = await request("/api/leaderboard");
    assert.equal(publicBoard.status, 200);
    assert.deepEqual((await publicBoard.json()).entries, []);
    assert.equal((await request("/leaderboard")).status, 200);
    const scoreResponse = await request("/api/leaderboard", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: `coffee_access=${fixtureLogin}`,
        Authorization: "Bearer score-fixture-session",
      },
      body: JSON.stringify({
        name: "Fixture Captain",
        report: {
          score: 120,
          time: 20,
          kills: 3,
          deliveries: 0,
          level: 2,
          won: false,
        },
      }),
    });
    assert.equal(scoreResponse.status, 200);
    const publicScores = await (await request("/api/leaderboard")).json();
    assert.equal(publicScores.entries[0].name, "Fixture Captain");
    assert.equal(publicScores.entries[0].score, 140);
    assert.ok(!JSON.stringify(publicScores).includes("alice"));
    assert.ok(!JSON.stringify(publicScores).includes("score-fixture-session"));

    assert.equal(
      (await request("/api/leaderboard?difficulty=invalid")).status,
      400,
    );
    assert.equal(
      (
        await request("/api/leaderboard", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );

    const alice = (
      await form("/access/login", { invite: "alice", password })
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const bob = (
      await form("/access/login", { invite: "bob", password })
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const session = await request("/api/session", {
      method: "POST",
      headers: { Cookie: alice, Origin: origin },
    });
    assert.equal(session.status, 201);
    const data = await session.json();
    assert.equal(data.heartbeat, true);
    assert.equal(
      (
        await request("/api/session", {
          method: "POST",
          headers: { Cookie: alice, Origin: origin },
        })
      ).status,
      409,
    );
    const other = await request("/api/session", {
      method: "POST",
      headers: { Cookie: bob, Origin: origin },
    });
    assert.equal(other.status, 201);
    for (const endpoint of [
      "/api/heartbeat",
      "/api/decision",
      "/api/invalidate",
    ])
      assert.equal(
        (
          await request(endpoint, {
            method: "POST",
            headers: {
              Cookie: bob,
              Origin: origin,
              Authorization: `Bearer ${data.session}`,
              "Content-Type": "application/json",
            },
            body: '{"playing":true,"epoch":2}',
          })
        ).status,
        403,
      );
    assert.equal(
      (
        await request("/api/session", {
          method: "DELETE",
          headers: {
            Cookie: bob,
            Origin: origin,
            Authorization: `Bearer ${data.session}`,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/heartbeat", {
          method: "POST",
          headers: {
            Cookie: alice,
            Origin: origin,
            Authorization: `Bearer ${data.session}`,
            "Content-Type": "application/json",
          },
          body: '{"playing":true}',
        })
      ).status,
      200,
    );
    const admin = (await form("/admin/login", { password: owner })).headers
      .get("set-cookie")!
      .split(";")[0];
    assert.equal(
      (
        await form(
          "/admin/invite",
          { id: "alice", maxSessions: "1", enabled: "no" },
          admin,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/session", {
          method: "POST",
          headers: { Cookie: alice, Origin: origin },
        })
      ).status,
      401,
    );
    const dashboard = await (
      await request("/admin", { headers: { Cookie: admin } })
    ).text();
    assert.match(dashboard, /alice/);
    assert.ok(!dashboard.includes(data.session));
    assert.ok(!dashboard.includes(password));
  } finally {
    child.kill("SIGTERM");
    await exited;
    await rm(dir, { recursive: true, force: true });
  }
});
