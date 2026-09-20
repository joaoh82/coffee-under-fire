import { InviteAccess } from "./access";
import { Store } from "./store";
import { ManagedAccess } from "./admin";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serveStatic } from "./static";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { Pipeline, LIMITS } from "./pipeline";
import { DecisionError, jevProvider, mockProvider } from "./jev";
import { allowedOrigin } from "./origin";
const production = process.env.NODE_ENV === "production";
const publicOrigin =
  process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || "";
const dbPath = process.env.ACCESS_DB_PATH;
let store: Store | undefined;
if (dbPath) {
  if (dbPath === ":memory:" && production)
    throw Error("Production requires persistent ACCESS_DB_PATH");
  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32)
    throw Error("ADMIN_TOKEN must contain at least 32 characters");
  mkdirSync(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });
  store = new Store(
    dbPath,
    Date.now,
    Number(process.env.MONTHLY_INPUT_TOKEN_LIMIT || 100_000_000),
  );
  await store.importInvites(process.env.PLAYTEST_INVITES || "{}");
}
if (
  production &&
  (!process.env.TYPESAFE_API_KEY || process.env.DECISION_MODE === "mock")
)
  throw new Error("Production requires a Jev key and strict mode");
const mode = process.env.DECISION_MODE === "mock" ? "mock" : "strict";
const pipeline = new Pipeline(
  mode === "mock"
    ? mockProvider
    : jevProvider(
        process.env.TYPESAFE_API_KEY,
        process.env.JEV_MODEL || "jev-latest",
      ),
  Date.now,
  LIMITS,
  store,
);
const reconcileGames = () => {
  if (!store) return;
  for (const id of store.expireSessions()) pipeline.close(id);
  for (const id of pipeline.sessions.keys())
    if (!store.sessionActive(id)) pipeline.close(id);
};
const managed = store
  ? new ManagedAccess(
      store,
      process.env.ADMIN_TOKEN!,
      publicOrigin,
      (id) => pipeline.close(id),
      production,
      Date.now,
      Number(process.env.JEV_INPUT_USD_PER_MILLION || 0.042),
      reconcileGames,
    )
  : null;
const access =
  managed ??
  (production
    ? new InviteAccess(
        process.env.PLAYTEST_COOKIE_SECRET ?? "",
        process.env.PLAYTEST_INVITES ?? "",
        publicOrigin,
      )
    : null);
// One process per disk. Expire abandoned leases and revoke in-flight work promptly.
if (store) setInterval(reconcileGames, 5000).unref();
const port = Number(process.env.PORT || 8787);
if (port === 3000) throw new Error("Port 3000 is reserved");
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, data: unknown) => {
    if (!res.destroyed) {
      res.writeHead(status);
      res.end(JSON.stringify(data));
    }
  };
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Preserve Origin on same-origin form POSTs so the invite gate can validate it.
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  );
  if (production)
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    if (access && (await access.handle(req, res))) return;
  } catch {
    send(400, { error: "invalid_access_request" });
    return;
  }
  if (production && !req.url?.startsWith("/api/")) {
    await serveStatic(req, res, resolve("dist/web"));
    return;
  }
  const origin = req.headers.origin;
  if (
    production
      ? Boolean(origin && origin !== publicOrigin)
      : !allowedOrigin(origin, req.headers.host, port)
  ) {
    send(403, { error: "origin_denied" });
    return;
  }
  const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
  try {
    if (req.method === "GET" && req.url === "/api/status") {
      send(200, {
        mode,
        keyConfigured: Boolean(process.env.TYPESAFE_API_KEY),
        model: process.env.JEV_MODEL || "jev-latest",
      });
      return;
    }
    const invite = managed?.user(req);
    if (store && token && !store.ownsSession(token, invite ?? "")) {
      send(403, { error: "session_expired_or_not_owned" });
      return;
    }
    if (req.method === "POST" && req.url === "/api/session") {
      const id = pipeline.create();
      if (store) {
        try {
          store.startSession(id, invite!);
        } catch {
          pipeline.close(id);
          send(409, {
            error: "invite_session_limit",
            message:
              "Your invite already has an active game. Close it or wait 90 seconds for its slot to expire.",
          });
          return;
        }
      }
      send(201, { session: id, mode, heartbeat: Boolean(store) });
      return;
    }
    if (req.method === "DELETE" && req.url === "/api/session") {
      pipeline.close(token);
      store?.endSession(token);
      send(200, { closed: true });
      return;
    }
    if (req.method !== "POST") {
      send(404, { error: "not_found" });
      return;
    }
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (Buffer.byteLength(data) > LIMITS.maxBodyBytes) {
        send(413, { error: "body_too_large" });
        return;
      }
    }
    let body: unknown;
    try {
      body = JSON.parse(data);
    } catch {
      send(400, { error: "invalid_json" });
      return;
    }
    if (req.url === "/api/heartbeat") {
      const playing = (body as { playing?: unknown })?.playing;
      if (typeof playing !== "boolean") {
        send(400, { error: "invalid_heartbeat" });
        return;
      }
      if (!store || store.heartbeat(token, invite!, playing))
        send(200, { ok: true });
      else send(403, { error: "session_expired" });
      return;
    }
    if (req.url === "/api/invalidate") {
      const epoch = (body as { epoch?: number })?.epoch;
      if (!Number.isSafeInteger(epoch) || epoch! < 0)
        throw new DecisionError("invalid_epoch");
      pipeline.invalidate(token, epoch!);
      send(200, { ok: true });
      return;
    }
    if (req.url === "/api/decision") {
      const controller = new AbortController();
      res.on("close", () => controller.abort());
      send(200, await pipeline.decide(token, body, controller.signal));
      return;
    }
    send(404, { error: "not_found" });
  } catch (e) {
    const err =
      e instanceof DecisionError ? e : new DecisionError("internal_error");
    if (err.retryMs)
      res.setHeader("Retry-After", Math.ceil(err.retryMs / 1000));
    send(err.code === "invalid_request" ? 400 : 503, {
      error: err.code,
      retryMs: err.retryMs,
    });
  }
});
server.listen(port, production ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(`Decision server http://127.0.0.1:${port} (${mode})`),
);
