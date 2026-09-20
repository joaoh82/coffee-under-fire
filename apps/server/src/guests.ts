import { publicName, NameRejected } from "./name-policy";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Store } from "./store";
import { AccessLimit, limitMessage } from "./public-policy";
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export type GuestConfig = {
  siteKey: string;
  secretKey: string;
  ipSalt: string;
  ipSource: "socket" | "render";
  render: boolean;
  origin: string;
  production: boolean;
};
export function normalizedNetwork(ip: string): string {
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes("%"))
    throw new AccessLimit("public_unavailable");
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const parts = canonical.split("::"),
    left = parts[0] ? parts[0].split(":") : [],
    right = parts[1] ? parts[1].split(":") : [];
  const words = (
    parts.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left
  ).map((s) => parseInt(s, 16));
  if (words.slice(0, 5).every((n) => n === 0) && words[5] === 65535)
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(
      ".",
    );
  return (
    words
      .slice(0, 4)
      .map((n) => n.toString(16))
      .join(":") + "::/64"
  );
}
export class GuestAccess {
  private active = 0;
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    readonly store: Store,
    readonly config: GuestConfig,
    private transport: typeof fetch = fetch,
    private now = Date.now,
  ) {}
  ready() {
    const c = this.config;
    return !!(
      c.siteKey &&
      c.secretKey &&
      c.ipSalt.length >= 32 &&
      (!c.production ||
        (c.render &&
          c.ipSource === "render" &&
          !c.siteKey.startsWith("1x000") &&
          !c.siteKey.startsWith("2x000") &&
          !c.siteKey.startsWith("3x000")))
    );
  }
  network(req: IncomingMessage) {
    if (!this.ready()) throw new AccessLimit("public_unavailable");
    // Render documents overwriting CF-Connecting-IP at its public edge. Never trust XFF's leftmost entry.
    const address =
      this.config.ipSource === "render"
        ? req.headers["cf-connecting-ip"]
        : req.socket.remoteAddress;
    if (typeof address !== "string")
      throw new AccessLimit("public_unavailable");
    return createHmac("sha256", this.config.ipSalt)
      .update(normalizedNetwork(address))
      .digest("hex");
  }
  private allow(key: string, limit: number) {
    const now = this.now();
    for (const [k, v] of this.attempts)
      if (v.until <= now) this.attempts.delete(k);
    const row = this.attempts.get(key) ?? { count: 0, until: now + 60000 };
    if (
      row.count >= limit ||
      (!this.attempts.has(key) && this.attempts.size >= 5000)
    )
      return false;
    row.count++;
    this.attempts.set(key, row);
    return true;
  }
  async verify(token: string) {
    if (!this.ready() || !token || token.length > 2048) return false;
    try {
      const res = await this.transport(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: this.config.secretKey,
            response: token,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      const body = await res.json();
      return (
        res.ok &&
        body.success === true &&
        body.hostname === new URL(this.config.origin).hostname &&
        body.action === "guest-play"
      );
    } catch {
      return false;
    }
  }
  private landing(res: ServerResponse, message = "", status = 200) {
    const budget = this.store.dailyBudget();
    let exhausted = false;
    try {
      this.store.checkDaily();
    } catch {
      exhausted = true;
    }
    const available =
      this.store.publicSettings().publicEnabled && this.ready() && !exhausted;
    const text = exhausted ? limitMessage("daily_budget_exhausted") : message;
    res.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    res.end(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coffee Under Fire · Play</title><style>body{background:#252f29;color:#ede5cc;font:17px/1.5 system-ui;margin:0;padding:24px}main{max-width:540px;margin:6vh auto}h1{font-size:48px;line-height:1}button,input{font:inherit;padding:14px;border-radius:8px;border:0}button{background:#deb879;cursor:pointer;font-weight:700}input{display:block;margin:8px 0;width:90%}a{color:#deb879}.notice{padding:18px;background:#3b4939;border-radius:12px}small{color:#bdc6b5}details{margin-top:28px}</style><main><small>AI NPCs powered by Jev</small><h1>Coffee<br>Under Fire</h1><p>Hold the line. Don’t spill the coffee.</p>${text ? `<p class="notice" role="status">${esc(text)}</p>` : ""}${available ? `<form method="post" action="/access/guest"><label>Display name (optional)<input name="displayName" maxlength="40" autocomplete="nickname" placeholder="Coffee Captain"></label><small>Skip to use a generated guest ID. You can edit your name when submitting a score. Names submitted to the leaderboard are public; no profanity or sexual content.</small><div class="cf-turnstile" data-sitekey="${esc(this.config.siteKey)}" data-action="guest-play"></div><button>Play as guest</button></form><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><p><small>No signup required. A secure cookie remembers this browser. We record approximate play time and API usage, and use a keyed network identifier for daily and concurrent-play limits. Shared networks share an allowance. Cloudflare checks for automated abuse.</small></p>` : `<p>Guest play is ${exhausted ? "resting for today" : "currently unavailable"}.</p>`}<p>Daily allowance resets at <time>${esc(new Date(budget.resetAt).toUTCString())}</time>.</p><p>The general gets the coffee. The developer gets the API bill.<br><a href="https://ko-fi.com/thepolyglotprogrammer" target="_blank" rel="noopener noreferrer">Buy us a coffee</a> · Completely optional; donations don’t unlock access.</p><p><a href="/leaderboard">View the community leaderboard</a></p><details><summary>Have an invite?</summary><form method="post" action="/access/login"><label>Invite name<input name="invite" autocomplete="username" required maxlength="40"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>Sign in</button></form></details></main></html>`,
    );
  }
  async handle(
    req: IncomingMessage,
    res: ServerResponse,
    identity: string | null,
  ) {
    const path = new URL(req.url ?? "/", this.config.origin).pathname;
    if (
      path.startsWith("/admin") ||
      (path.startsWith("/access/") && path !== "/access/guest")
    )
      return false;
    const guest = identity && this.store.isGuest(identity);
    if (path === "/access/guest") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" });
        res.end();
        return true;
      }
      if (req.headers.origin !== this.config.origin) {
        res.writeHead(403);
        res.end("Origin denied");
        return true;
      }
      if (
        !req.headers["content-type"]?.startsWith(
          "application/x-www-form-urlencoded",
        )
      ) {
        res.writeHead(415);
        res.end();
        return true;
      }
      if (!this.store.publicSettings().publicEnabled || !this.ready()) {
        this.landing(res, "Guest play is not open yet.", 503);
        return true;
      }
      let data = "";
      for await (const part of req) {
        data += part;
        if (Buffer.byteLength(data) > 4096) {
          res.writeHead(413);
          res.end();
          return true;
        }
      }
      try {
        const requestedName =
          new URLSearchParams(data).get("displayName") ?? "";
        const displayName = requestedName.trim()
          ? publicName(requestedName)
          : "";
        const network = this.network(req);
        if (
          !this.allow("all", 60) ||
          !this.allow(network, 8) ||
          this.active >= 4
        )
          throw new AccessLimit("guest_creation_limit");
        this.store.checkDaily(identity ?? undefined, network);
        if (!identity) {
          this.active++;
          let verified = false;
          try {
            verified = await this.verify(
              new URLSearchParams(data).get("cf-turnstile-response") ?? "",
            );
          } finally {
            this.active--;
          }
          if (!verified) {
            this.landing(
              res,
              "Please complete the quick browser check and try again.",
              403,
            );
            return true;
          }
          const token = this.store.createGuest(network, displayName);
          res.setHeader(
            "Set-Cookie",
            `coffee_access=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${this.config.production ? "; Secure" : ""}`,
          );
        }
        res.writeHead(303, { Location: "/" });
        res.end();
      } catch (e) {
        if (e instanceof NameRejected) {
          this.landing(res, e.message, 400);
          return true;
        }
        this.landing(
          res,
          limitMessage(
            e instanceof AccessLimit ? e.code : "public_unavailable",
          ),
          429,
        );
      }
      return true;
    }
    if (
      guest &&
      (!this.store.publicSettings().publicEnabled || !this.ready())
    ) {
      if (path.startsWith("/api/")) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "public_closed",
            message: limitMessage("public_closed"),
          }),
        );
      } else this.landing(res, limitMessage("public_closed"), 503);
      return true;
    }
    if (
      !identity &&
      this.store.publicSettings().publicEnabled &&
      (path === "/" || path === "/index.html")
    ) {
      this.landing(res);
      return true;
    }
    return false;
  }
}
