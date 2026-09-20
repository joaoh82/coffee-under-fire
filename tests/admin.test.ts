import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Store } from "../apps/server/src/store";
import { ManagedAccess } from "../apps/server/src/admin";

test("owner console: role separation, CSRF, invite creation, cookie secrecy, logout and throttling", async () => {
  const store = new Store(":memory:");
  let access: ManagedAccess;
  const server = createServer(async (req, res) => {
    try {
      if (!(await access.handle(req, res))) res.end("game");
    } catch {
      res.writeHead(400);
      res.end("invalid");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address() as { port: number };
  const origin = `http://127.0.0.1:${a.port}`;
  const owner = "test-owner-token-with-at-least-32-characters";
  access = new ManagedAccess(store, owner, origin, () => {}, false);
  const req = (path: string, init: RequestInit = {}) =>
    fetch(origin + path, { redirect: "manual", ...init });
  const post = (
    path: string,
    data: Record<string, string>,
    cookie = "",
    from = origin,
  ) =>
    req(path, {
      method: "POST",
      headers: {
        Origin: from,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: new URLSearchParams(data),
    });
  try {
    assert.equal((await req("/admin")).status, 401);
    assert.equal(
      (
        await post("/admin/invite", {
          id: "alice",
          enabled: "yes",
          maxSessions: "1",
        })
      ).status,
      401,
    );
    assert.equal(
      (await post("/admin/login", { password: owner }, "", "null")).status,
      403,
    );
    const login = await post("/admin/login", { password: owner });
    assert.equal(login.status, 303);
    const adminCookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.ok(!adminCookie.includes(owner));
    assert.equal(
      (await req("/api/status", { headers: { Cookie: adminCookie } })).status,
      401,
    );
    const created = await post(
      "/admin/invite",
      {
        id: "alice",
        password: "test-password-long-enough",
        enabled: "yes",
        maxSessions: "1",
      },
      adminCookie,
    );
    assert.equal(created.status, 200);
    assert.match(await created.text(), /Copy the password now/);
    const dashboard = await req("/admin", { headers: { Cookie: adminCookie } });
    const html = await dashboard.text();
    assert.ok(!html.includes("test-password-long-enough"));
    assert.ok(!html.includes("password_hash"));
    assert.ok(!html.includes(owner));
    const player = await post("/access/login", {
      invite: "alice",
      password: "test-password-long-enough",
    });
    assert.equal(player.status, 303);
    const playerCookie = player.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (await req("/", { headers: { Cookie: playerCookie } })).status,
      200,
    );
    assert.equal(
      (await req("/admin", { headers: { Cookie: playerCookie } })).status,
      401,
    );
    assert.equal(
      (
        await post(
          "/admin/invite",
          { id: "bob", enabled: "yes", maxSessions: "1" },
          playerCookie,
        )
      ).status,
      401,
    );
    await post("/access/logout", {}, playerCookie);
    assert.equal(
      (await req("/", { headers: { Cookie: playerCookie } })).status,
      401,
    );
    await post("/admin/logout", {}, adminCookie);
    assert.equal(
      (await req("/admin", { headers: { Cookie: adminCookie } })).status,
      401,
    );
    for (let i = 0; i < 8; i++)
      await post("/access/login", { invite: "alice", password: "wrong" });
    assert.equal(
      (
        await post("/access/login", {
          invite: "alice",
          password: "test-password-long-enough",
        })
      ).status,
      429,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
