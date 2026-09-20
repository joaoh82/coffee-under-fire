import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

test("production entrypoint protects API and serves the compiled game after login", async (t) => {
  try {
    await access("dist/web/index.html");
  } catch {
    t.skip("Run npm run build first for the production HTTP smoke test");
    return;
  }
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const origin = "https://coffee-test.example";
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        PUBLIC_ORIGIN: origin,
        DECISION_MODE: "strict",
        TYPESAFE_API_KEY: "nonfunctional-fixture-key-no-provider-calls",
        PLAYTEST_COOKIE_SECRET:
          "production-fixture-cookie-secret-32-characters",
        PLAYTEST_INVITES: JSON.stringify({
          tester: "fixture-invite-password-12345",
        }),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const closed = new Promise((resolve) => child.once("exit", resolve));
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      ...init,
    });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await request("/healthz")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(ready, output);
    const fieldPass = await request("/");
    assert.equal(fieldPass.status, 401);
    assert.equal(fieldPass.headers.get("referrer-policy"), "same-origin");
    for (const from of ["null", "https://untrusted.example", undefined]) {
      assert.equal(
        (
          await request("/access/login", {
            method: "POST",
            headers: {
              ...(from ? { Origin: from } : {}),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              invite: "tester",
              password: "fixture-invite-password-12345",
            }),
          })
        ).status,
        403,
      );
    }
    for (const [path, type] of [
      ["/assets/brand/social-card-v1.png", "image/png"],
      ["/favicon.svg", "image/svg+xml"],
      ["/favicon.ico", "image/x-icon"],
      ["/robots.txt", "text/plain"],
      ["/sitemap.xml", "application/xml"],
    ]) {
      const asset = await request(path);
      assert.equal(asset.status, 200, path);
      assert.ok(asset.headers.get("content-type")?.startsWith(type));
      assert.equal((await request(path, { method: "HEAD" })).status, 200);
    }
    assert.equal(
      (await request("/assets/models/slice_soldier.glb")).status,
      401,
    );
    assert.match(
      (await request("/admin")).headers.get("x-robots-tag") ?? "",
      /noindex/,
    );
    assert.equal(
      (await request("/api/session", { method: "POST" })).status,
      401,
    );
    const login = await request("/access/login", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        invite: "tester",
        password: "fixture-invite-password-12345",
      }),
    });
    assert.equal(login.status, 303);
    assert.match(login.headers.get("set-cookie")!, /Secure/);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const home = await request("/", { headers: { Cookie: cookie } });
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /<div id="root">/);
    const script = html.match(/src="([^"]+\.js)"/)![1];
    const bundle = await request(script, { headers: { Cookie: cookie } });
    assert.equal(bundle.status, 200);
    assert.match(bundle.headers.get("content-type")!, /javascript/);
    const session = await request("/api/session", {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin },
    });
    assert.equal(session.status, 201);
    const data = await session.json();
    assert.equal(data.mode, "strict");
    assert.ok(data.session);
    assert.equal(
      (
        await request("/api/session", {
          method: "POST",
          headers: { Cookie: cookie, Origin: "http://localhost:5173" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await request("/.env", { headers: { Cookie: cookie } })).status,
      404,
    );
  } finally {
    child.kill("SIGTERM");
    await closed;
  }
});
