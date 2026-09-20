import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InviteAccess } from "../apps/server/src/access";
import { serveStatic } from "../apps/server/src/static";
const secret = "test-cookie-secret-at-least-32-characters";
const password = "random-test-invite-password";
const invites = JSON.stringify({
  alice: password,
  bob: "other-random-test-password",
});
test("invite tokens reject tampering, expiry, removed invites and rotated passwords", () => {
  let now = 1_000_000;
  const gate = new InviteAccess(
    secret,
    invites,
    "https://game.example",
    true,
    () => now,
  );
  assert.equal(gate.issue("alice", "wrong"), null);
  assert.equal(gate.issue("toString", password), null);
  const token = gate.issue("alice", password)!;
  assert.ok(gate.valid(token));
  assert.ok(!token.includes(password));
  assert.ok(!gate.valid(token + "x"));
  assert.ok(!gate.valid("garbage"));
  const revoked = new InviteAccess(
    secret,
    JSON.stringify({ bob: "other-random-test-password" }),
    "https://game.example",
  );
  assert.ok(!revoked.valid(token));
  const rotated = new InviteAccess(
    secret,
    JSON.stringify({ alice: "changed-invite-password" }),
    "https://game.example",
    true,
    () => now,
  );
  assert.ok(!rotated.valid(token));
  now += 8 * 24 * 3600 * 1000;
  assert.ok(!gate.valid(token));
  assert.match(
    gate.cookie(token),
    /HttpOnly; SameSite=Strict; Max-Age=604800; Secure/,
  );
  assert.throws(() => new InviteAccess("", invites, "https://game.example"));
  assert.throws(() => new InviteAccess(secret, "{}", "https://game.example"));
  assert.throws(() => new InviteAccess(secret, invites, "http://game.example"));
});
test("HTTP gate protects API and assets, validates login origin, supports logout; static files cannot escape root", async () => {
  const temp = await mkdtemp(join(tmpdir(), "coffee-access-"));
  await mkdir(join(temp, "web"));
  await writeFile(join(temp, "web", "index.html"), "test game");
  await writeFile(join(temp, "secret.txt"), "not public");
  await symlink(join(temp, "secret.txt"), join(temp, "web", "leak.txt"));
  let gate: InviteAccess;
  let reachedApi = 0;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (await gate.handle(req, res)) return;
    if (req.url?.startsWith("/api/")) {
      reachedApi++;
      res.end("authorized");
      return;
    }
    await serveStatic(req, res, join(temp, "web"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  gate = new InviteAccess(secret, invites, origin, false);
  const request = (path: string, init: RequestInit = {}) =>
    fetch(origin + path, { redirect: "manual", ...init });
  try {
    assert.equal((await request("/healthz")).status, 200);
    assert.equal((await request("/")).status, 401);
    assert.equal(
      (await request("/api/session", { method: "POST" })).status,
      401,
    );
    assert.equal(
      (
        await request("/api/decision", {
          method: "POST",
          headers: { Authorization: "Bearer stolen-token" },
        })
      ).status,
      401,
    );
    assert.equal(reachedApi, 0);
    const login = (pw: string, from = origin) =>
      request("/access/login", {
        method: "POST",
        headers: {
          Origin: from,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ invite: "alice", password: pw }),
      });
    assert.equal(
      (await login(password, "https://foreign.example")).status,
      403,
    );
    assert.equal((await login("wrong")).status, 401);
    const response = await login(password);
    assert.equal(response.status, 303);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      await (await request("/", { headers: { Cookie: cookie } })).text(),
      "test game",
    );
    assert.equal(
      (
        await request("/api/session", {
          method: "POST",
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
    assert.equal(reachedApi, 1);
    for (const path of ["/leak.txt", "/%2e%2e%2fsecret.txt", "/.env", "/%ZZ"])
      assert.equal(
        (await request(path, { headers: { Cookie: cookie } })).status,
        404,
      );
    const logout = await request("/access/logout", {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin },
    });
    assert.equal(logout.status, 303);
    assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(temp, { recursive: true, force: true });
  }
});
