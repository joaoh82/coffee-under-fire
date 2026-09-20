import { ICON_HEAD } from "../../../packages/shared/site-meta";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
const COOKIE = "coffee_access";
const WEEK = 7 * 24 * 3600;
const digest = (s: string) => createHash("sha256").update(s).digest();
const equal = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
export class InviteAccess {
  private invites: Record<string, string>;
  constructor(
    private secret: string,
    invites: string,
    private origin: string,
    private secure = true,
    private now = Date.now,
  ) {
    if (secret.length < 32)
      throw new Error(
        "PLAYTEST_COOKIE_SECRET must contain at least 32 characters",
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(invites);
    } catch {
      throw new Error("PLAYTEST_INVITES must be a JSON object");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("PLAYTEST_INVITES must be a JSON object");
    const entries = Object.entries(parsed);
    if (
      !entries.length ||
      entries.length > 100 ||
      entries.some(
        ([id, password]) =>
          !/^[a-zA-Z0-9_-]{1,40}$/.test(id) ||
          typeof password !== "string" ||
          password.length < 16 ||
          password.length > 256,
      )
    )
      throw new Error(
        "Configure 1–100 invite IDs with passwords of 16–256 characters",
      );
    this.invites = Object.fromEntries(entries);
    if (
      new URL(origin).origin !== origin ||
      (secure && !origin.startsWith("https://"))
    )
      throw new Error("PUBLIC_ORIGIN must be an HTTPS origin in production");
  }
  private sign(value: string) {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
  private password(id: string): string | undefined {
    return Object.hasOwn(this.invites, id) ? this.invites[id] : undefined;
  }
  issue(id: string, password: string): string | null {
    const expected = this.password(id);
    const matches = equal(password, expected ?? "invalid-invite");
    if (!expected || !matches) return null;
    const payload = Buffer.from(
      JSON.stringify({
        id,
        exp: Math.floor(this.now() / 1000) + WEEK,
        revision: this.sign(expected),
      }),
    ).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }
  valid(token: string): boolean {
    if (token.length > 2048) return false;
    const parts = token.split(".");
    if (parts.length !== 2 || !equal(parts[1], this.sign(parts[0])))
      return false;
    try {
      const p = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const password =
        typeof p.id === "string" ? this.password(p.id) : undefined;
      return Boolean(
        password &&
        Number.isSafeInteger(p.exp) &&
        p.exp > this.now() / 1000 &&
        typeof p.revision === "string" &&
        equal(p.revision, this.sign(password)),
      );
    } catch {
      return false;
    }
  }
  cookie(token: string, age = WEEK) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${this.secure ? "; Secure" : ""}`;
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const pathname = new URL(req.url ?? "/", this.origin).pathname;
    if (
      pathname === "/healthz" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      res.setHeader("Content-Type", "application/json");
      res.end(req.method === "HEAD" ? undefined : '{"ok":true}');
      return true;
    }
    if (pathname === "/access/login" || pathname === "/access/logout") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" });
        res.end();
        return true;
      }
      if (req.headers.origin !== this.origin) {
        res.writeHead(403);
        res.end("Origin denied");
        return true;
      }
      if (pathname === "/access/logout") {
        res.setHeader("Set-Cookie", this.cookie("", 0));
        res.writeHead(303, { Location: "/" });
        res.end();
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
      let data = "";
      for await (const chunk of req) {
        data += chunk;
        if (Buffer.byteLength(data) > 4096) {
          res.writeHead(413);
          res.end();
          return true;
        }
      }
      const form = new URLSearchParams(data);
      const token = this.issue(
        form.get("invite") ?? "",
        form.get("password") ?? "",
      );
      if (token) {
        res.setHeader("Set-Cookie", this.cookie(token));
        res.writeHead(303, { Location: "/" });
        res.end();
        return true;
      }
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
      res.end(loginPage(true));
      return true;
    }
    const token = (req.headers.cookie ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1);
    if (token && this.valid(token)) return false;
    if (pathname.startsWith("/api/")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":"invite_required"}');
      return true;
    }
    res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : loginPage());
    return true;
  }
}
function loginPage(error = false) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Your field pass · Coffee Under Fire</title>${ICON_HEAD}<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#303c30;color:#29392d;font:17px/1.5 system-ui;padding:24px}main{width:min(100%,460px);padding:36px;background:#e9dfbd;border-radius:12px;box-shadow:10px 12px #202c25}small{letter-spacing:.14em;text-transform:uppercase}h1{font-size:36px;line-height:1.1;margin:16px 0}label{display:block;margin:18px 0 5px;font-weight:600}input,button{font:inherit;width:100%;padding:13px;border:2px solid #697454;border-radius:6px}input{background:#fff8df}button{margin-top:24px;background:#a94e27;color:#fff8df;border-color:#a94e27;cursor:pointer;font-weight:700}:focus-visible{outline:3px solid #a94e27;outline-offset:3px}.error{color:#923918}footer{font-size:13px;margin-top:22px}</style>
<main><small>☕ Private field test</small><h1>Coffee Under Fire</h1><p>Your orders: survive the battlefield. Deliver the coffee. First, show your field pass.</p>${error ? '<p class="error" role="alert">That invite and password did not match. Please try again.</p>' : ""}<form action="/access/login" method="post"><label for="invite">Invite name</label><input id="invite" name="invite" autocomplete="username" maxlength="40" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button>Enter the outpost</button></form><footer>Invite-only playtest · NPC tactics powered by Jev</footer></main></html>`;
}
