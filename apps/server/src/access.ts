import { accessPage } from "./access-page";
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
  return accessPage(
    `<span class="eyebrow">Your field pass</span><h2>Your orders are waiting.</h2><p class="muted">Enter your invite to start a coffee run.</p>${error ? '<p class="notice" role="alert">That invite and password did not match. Please try again.</p>' : ""}<form action="/access/login" method="post"><label for="invite">Invite name</label><input id="invite" name="invite" autocomplete="username" maxlength="40" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button>Enter the outpost</button></form><footer>Invite-only playtest · NPC tactics powered by Jev</footer>`,
  );
}
