import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { Store } from "../apps/server/src/store";
import { ManagedAccess } from "../apps/server/src/admin";
import {
  GuestAccess,
  normalizedNetwork,
  type GuestConfig,
} from "../apps/server/src/guests";
import { DEFAULT_PUBLIC_SETTINGS } from "../apps/server/src/public-policy";
const config: GuestConfig = {
  siteKey: "local-fixture-site-key",
  secretKey: "local-fixture-secret",
  ipSalt: "fixture-network-salt-at-least-32-characters",
  ipSource: "socket",
  render: false,
  origin: "http://localhost",
  production: false,
};
test("network keys normalize IPv4 mapped IPv6 and IPv6 /64; do not trust arbitrary forwarding headers", () => {
  assert.equal(normalizedNetwork("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(
    normalizedNetwork("2001:db8:1:2::123"),
    normalizedNetwork("2001:0db8:0001:0002::456"),
  );
  assert.throws(() => normalizedNetwork("malformed, 192.0.2.1"));
  const store = new Store(":memory:");
  try {
    const access = new GuestAccess(store, config);
    const req = {
      headers: {
        "x-forwarded-for": "attacker",
        "cf-connecting-ip": "attacker",
      },
      socket: { remoteAddress: "192.0.2.1" },
    } as unknown as IncomingMessage;
    const key = access.network(req);
    assert.equal(key.length, 64);
    assert.ok(!key.includes("192.0.2.1"));
    req.headers["x-forwarded-for"] = "another";
    assert.equal(access.network(req), key);
    const rendered = new GuestAccess(store, {
      ...config,
      production: true,
      render: true,
      origin: "https://game.example",
      ipSource: "render",
    });
    assert.throws(() => rendered.network(req));
    req.headers["cf-connecting-ip"] = "192.0.2.1";
    assert.equal(rendered.network(req), key);
    assert.equal(
      new GuestAccess(store, { ...config, production: true }).ready(),
      false,
    );
    assert.equal(
      new GuestAccess(store, { ...config, secretKey: "" }).ready(),
      false,
    );
  } finally {
    store.close();
  }
});
test("public guest admission uses verified single-use challenge, exact origin, secure identity and persistent limits", async () => {
  const store = new Store(":memory:");
  let managed: ManagedAccess;
  const server = createServer(async (req, res) => {
    try {
      if (!(await managed.handle(req, res))) res.end("game");
    } catch {
      res.writeHead(400);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const used = new Set<string>();
  let calls = 0;
  const transport = (async (_url, init) => {
    calls++;
    const body = JSON.parse(init!.body as string);
    assert.equal(body.secret, config.secretKey);
    const ok = body.response === "valid" && !used.has(body.response);
    used.add(body.response);
    return new Response(
      JSON.stringify({
        success: ok,
        hostname: new URL(origin).hostname,
        action: "guest-play",
      }),
    );
  }) as typeof fetch;
  const guests = new GuestAccess(store, { ...config, origin }, transport);
  managed = new ManagedAccess(
    store,
    "owner-fixture-token-at-least-32-characters",
    origin,
    () => {},
    false,
    Date.now,
    0.042,
    () => {},
    guests,
  );
  const request = (path: string, init: RequestInit = {}) =>
    fetch(origin + path, { redirect: "manual", ...init });
  const post = (token: string, from = origin, displayName = "") =>
    request("/access/guest", {
      method: "POST",
      headers: {
        Origin: from,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "cf-turnstile-response": token,
        displayName,
      }),
    });
  try {
    assert.equal((await request("/")).status, 401);
    store.savePublicSettings({
      ...DEFAULT_PUBLIC_SETTINGS,
      publicEnabled: true,
    });
    const page = await (await request("/")).text();
    assert.match(page, /Play as guest/);
    assert.match(page, /property="og:image"/);
    assert.match(page, /coffee.yardsort.sh/);
    assert.match(page, /rel="icon"/);
    assert.ok(!page.includes(config.secretKey));
    assert.ok(!page.includes(config.ipSalt));
    assert.equal((await post("valid", "https://evil.example")).status, 403);
    assert.equal(calls, 0);
    assert.match(page, /Display name \(optional\)/);
    assert.equal((await post("valid", origin, "porn star")).status, 400);
    assert.equal(
      calls,
      0,
      "invalid names are rejected before spending a challenge",
    );
    assert.equal((await post("bad")).status, 403);
    const admitted = await post("valid", origin, "Coffee Captain");
    assert.equal(admitted.status, 303);
    const cookie = admitted.headers.get("set-cookie")!.split(";")[0];
    assert.match(
      admitted.headers.get("set-cookie")!,
      /HttpOnly; SameSite=Strict/,
    );
    assert.equal(
      (await request("/", { headers: { Cookie: cookie } })).status,
      200,
    );
    assert.equal(
      (await request("/admin", { headers: { Cookie: cookie } })).status,
      401,
    );
    assert.equal((await post("valid")).status, 403);
    assert.equal(store.listInvites().length, 1);
    assert.equal(store.listInvites()[0].displayName, "Coffee Captain");
    store.savePublicSettings({ ...store.publicSettings(), dailyCents: 0 });
    const empty = await (await request("/")).text();
    assert.match(empty, /coffee fund is empty/);
    assert.match(empty, /ko-fi.com/);
    assert.ok(!empty.includes("<button>Play as guest"));
    store.savePublicSettings({
      ...store.publicSettings(),
      publicEnabled: false,
    });
    assert.equal(
      (await request("/api/status", { headers: { Cookie: cookie } })).status,
      403,
    );
    for (const patch of [
      { hostname: "wrong" },
      { action: "wrong" },
      { success: false },
    ]) {
      const invalid = new GuestAccess(
        store,
        { ...config, origin },
        (async () =>
          new Response(
            JSON.stringify({
              success: true,
              hostname: new URL(origin).hostname,
              action: "guest-play",
              ...patch,
            }),
          )) as typeof fetch,
      );
      assert.equal(await invalid.verify("token"), false);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
