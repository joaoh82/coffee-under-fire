import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Store } from "./store";
const hash = (s: string) => createHash("sha256").update(s).digest();
const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const cookie = (req: IncomingMessage, name: string) =>
  (req.headers.cookie ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="))
    ?.slice(name.length + 1) ?? "";
const date = (v: unknown) =>
  typeof v === "number" && v > 0
    ? new Date(v).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "—";
const page = (
  title: string,
  content: string,
) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} · Coffee Under Fire</title><style>
*{box-sizing:border-box}body{margin:0;background:#252f29;color:#ede5cc;font:16px/1.5 system-ui;padding:clamp(16px,4vw,48px)}main{max-width:1100px;margin:auto}header{display:flex;justify-content:space-between;gap:20px;align-items:center}h1{font-size:clamp(28px,5vw,44px);margin:8px 0 24px}h2{font-size:22px}small,.muted{color:#b6c3ad}a{color:#f0c48e}section{background:#333f34;border:1px solid #63705a;padding:24px;margin:20px 0;border-radius:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}label{display:block;margin:12px 0 5px}input,select,button{font:inherit;border-radius:6px;padding:11px;border:1px solid #9da88d}input,select{width:100%;background:#f7efd7;color:#25352a}button{background:#deb879;color:#25352a;font-weight:700;cursor:pointer;margin:10px 0}button.danger{background:#d78570}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;border-bottom:1px solid #63705a;padding:12px 8px;white-space:nowrap}.scroll{overflow:auto}.notice{padding:16px;background:#525d40;border-left:4px solid #deb879}form.inline{display:inline}.login{max-width:460px;margin:8vh auto}.stats strong{font-size:25px;display:block}:focus-visible{outline:3px solid #eab466;outline-offset:3px}</style><main>${content}</main></html>`;

// Fixed-window, bounded maps; do not trust user-supplied forwarding headers for identity.
export class LoginLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(private now = Date.now) {}
  allow(key: string, limit: number, windowMs = 600_000) {
    const now = this.now();
    for (const [k, v] of this.buckets)
      if (v.until <= now) this.buckets.delete(k);
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= 1000) return false;
      b = { count: 0, until: now + windowMs };
      this.buckets.set(key, b);
    }
    if (b.count >= limit) return false;
    b.count++;
    return true;
  }
}
export class ManagedAccess {
  private admins = new Map<string, number>();
  private limiter: LoginLimiter;
  private hashing = 0;
  constructor(
    readonly store: Store,
    private ownerToken: string,
    private origin: string,
    private endGame: (id: string) => void,
    private secure = true,
    private now = Date.now,
    private inputRate = 0.042,
    private reconcileGames: () => void = () => {},
  ) {
    if (!Number.isFinite(inputRate) || inputRate < 0)
      throw Error("Invalid Jev input price");
    if (ownerToken.length < 32)
      throw Error("ADMIN_TOKEN must contain at least 32 characters");
    if (
      new URL(origin).origin !== origin ||
      (secure && !origin.startsWith("https://"))
    )
      throw Error("PUBLIC_ORIGIN must be an HTTPS origin");
    this.limiter = new LoginLimiter(now);
  }
  user(req: IncomingMessage) {
    return this.store.identity(cookie(req, "coffee_access"));
  }
  private admin(req: IncomingMessage) {
    const key = hash(cookie(req, "coffee_admin")).toString("hex");
    const expiry = this.admins.get(key);
    return Boolean(expiry && expiry > this.now());
  }
  private setCookie(
    res: ServerResponse,
    name: string,
    value: string,
    age: number,
  ) {
    res.setHeader(
      "Set-Cookie",
      `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${this.secure ? "; Secure" : ""}`,
    );
  }
  private html(
    res: ServerResponse,
    status: number,
    title: string,
    content: string,
  ) {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page(title, content));
  }
  private login(
    res: ServerResponse,
    admin: boolean,
    error = false,
    status = 401,
  ) {
    this.html(
      res,
      status,
      admin ? "Owner login" : "Your field pass",
      `<section class="login"><small>${admin ? "OWNER ACCESS" : "PRIVATE FIELD TEST"}</small><h1>Coffee Under Fire</h1>${error ? '<p role="alert">Unable to sign in. Check your credentials or try again later.</p>' : ""}<form method="post" action="${admin ? "/admin/login" : "/access/login"}">${admin ? "" : '<label for="invite">Invite name</label><input id="invite" name="invite" maxlength="40" autocomplete="username" required>'}<label for="password">${admin ? "Owner token" : "Password"}</label><input id="password" name="password" type="password" maxlength="256" autocomplete="current-password" required><button>Sign in</button></form><p class="muted">${admin ? "Owner credentials never grant player access." : "Login times, approximate play time and Jev usage are recorded for this private playtest."}</p></section>`,
    );
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = new URL(req.url ?? "/", this.origin).pathname;
    if (path === "/healthz" && ["GET", "HEAD"].includes(req.method ?? "")) {
      res.setHeader("Content-Type", "application/json");
      res.end(req.method === "HEAD" ? undefined : '{"ok":true}');
      return true;
    }
    const isAdmin = path === "/admin" || path.startsWith("/admin/");
    if (isAdmin)
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      );
    const authRoute = path.startsWith("/access/");
    if (isAdmin || authRoute) {
      if (req.method === "GET" && path === "/admin") {
        if (this.admin(req)) this.dashboard(res);
        else this.login(res, true);
        return true;
      }
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
      if (
        !req.headers["content-type"]?.startsWith(
          "application/x-www-form-urlencoded",
        )
      ) {
        res.writeHead(415);
        res.end();
        return true;
      }
      if (isAdmin && path !== "/admin/login" && !this.admin(req)) {
        this.login(res, true);
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
      if (path === "/admin/login" || path === "/access/login") {
        const id = form.get("invite") ?? "";
        if (
          !this.limiter.allow("global", 60, 60_000) ||
          !this.limiter.allow(isAdmin ? "admin" : "invite:" + id, 8) ||
          this.hashing >= 2
        ) {
          this.login(res, isAdmin, true, 429);
          return true;
        }
        const password = form.get("password") ?? "";
        if (password.length > 256) {
          this.login(res, isAdmin, true);
          return true;
        }
        if (isAdmin) {
          if (!timingSafeEqual(hash(password), hash(this.ownerToken))) {
            this.login(res, true, true);
            return true;
          }
          for (const [k, expiry] of this.admins)
            if (expiry <= this.now()) this.admins.delete(k);
          if (this.admins.size >= 10)
            this.admins.delete(this.admins.keys().next().value!);
          const token = randomBytes(32).toString("hex");
          this.admins.set(
            hash(token).toString("hex"),
            this.now() + 8 * 3600_000,
          );
          this.setCookie(res, "coffee_admin", token, 8 * 3600);
        } else {
          this.hashing++;
          let valid = false;
          try {
            valid = await this.store.authenticate(id, password);
          } finally {
            this.hashing--;
          }
          if (!valid) {
            this.login(res, false, true);
            return true;
          }
          this.setCookie(
            res,
            "coffee_access",
            this.store.createLogin(id),
            7 * 24 * 3600,
          );
        }
        res.writeHead(303, { Location: isAdmin ? "/admin" : "/" });
        res.end();
        return true;
      }
      if (path === "/admin/logout") {
        this.admins.delete(hash(cookie(req, "coffee_admin")).toString("hex"));
        this.setCookie(res, "coffee_admin", "", 0);
        res.writeHead(303, { Location: "/admin" });
        res.end();
        return true;
      }
      if (path === "/access/logout") {
        this.store.logout(cookie(req, "coffee_access"));
        this.setCookie(res, "coffee_access", "", 0);
        res.writeHead(303, { Location: "/" });
        res.end();
        return true;
      }
      if (path === "/admin/invite") {
        const id = form.get("id") ?? "";
        const exists = this.store.getInvite(id);
        const password =
          form.get("password") ||
          (!exists ? randomBytes(18).toString("base64url") : null);
        try {
          await this.store.saveInvite(
            id,
            password,
            Number(form.get("maxSessions")),
            form.get("enabled") === "yes",
          );
        } catch {
          this.dashboard(
            res,
            "Invalid invite settings. Use a name of 1–40 letters, digits, underscores or hyphens, a password of 16–256 characters, and 1–8 concurrent games.",
          );
          return true;
        }
        // Invalidated games are closed before they can spend more provider budget.
        this.reconcileGames();
        this.dashboard(
          res,
          password
            ? `Saved ${id}. Copy the password now; it is not displayed again.`
            : `Updated ${id}.`,
          password,
        );
        return true;
      }
      if (path === "/admin/end-session") {
        const id = this.store.sessionIdForManagement(form.get("session") ?? "");
        if (id) {
          this.store.endSession(id);
          this.endGame(id);
        }
        res.writeHead(303, { Location: "/admin" });
        res.end();
        return true;
      }
      res.writeHead(404);
      res.end();
      return true;
    }
    if (this.user(req)) return false;
    if (path.startsWith("/api/")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":"invite_required"}');
    } else this.login(res, false);
    return true;
  }
  private dashboard(
    res: ServerResponse,
    notice = "",
    password: string | null = null,
  ) {
    const invites = this.store.listInvites();
    const sessions = this.store.activeSessions();
    const budget = this.store.budget();
    this.html(
      res,
      200,
      "Field command",
      `<header><div><small>OWNER CONSOLE</small><h1>Field command</h1></div><form method="post" action="/admin/logout"><button>Sign out</button></form></header>${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ""}${password ? `<label>One-time password</label><input readonly value="${escape(password)}">` : ""}<div class="grid stats"><section><small>Invites</small><strong>${invites.length}</strong></section><section><small>Active games</small><strong>${sessions.length}</strong></section><section><small>Monthly token safety budget</small><strong>${Math.round((100 * budget.charged) / budget.cap)}% used</strong><small>${budget.charged.toLocaleString()} / ${budget.cap.toLocaleString()} tokens · ${escape(budget.month)} UTC. Includes conservative reservations, not an invoice.</small></section></div>
    <section><h2>Create or update an invite</h2><p class="muted">Use an existing name to update it. Leave its password blank to keep it. A new invite gets a generated password when blank. Resetting a password or disabling access revokes its sessions.</p><form method="post" action="/admin/invite"><div class="grid"><div><label for="id">Invite name</label><input id="id" name="id" pattern="[A-Za-z0-9_-]{1,40}" maxlength="40" required></div><div><label for="new-password">Password (16+ characters)</label><input id="new-password" name="password" type="password" minlength="16" maxlength="256" autocomplete="new-password"></div><div><label for="maxSessions">Concurrent games</label><input id="maxSessions" name="maxSessions" type="number" min="1" max="8" value="1" required></div><div><label for="enabled">Access</label><select id="enabled" name="enabled"><option value="yes">Enabled</option><option value="no">Disabled</option></select></div></div><button>Save invite</button></form></section>
    <section><h2>Players and usage</h2><p class="muted">Play time is estimated from visible, running-game heartbeats, not login duration or verified human activity. Usage excludes unreported provider billing.</p><div class="scroll"><table><thead><tr><th>Invite</th><th>Access / games</th><th>Logins / runs</th><th>Last login</th><th>Play time</th><th>Jev usage</th><th>Est. cost</th></tr></thead><tbody>${invites.map((i: any) => `<tr><td>${escape(i.id)}</td><td>${i.enabled ? "Enabled" : "Disabled"} · ${i.activeSessions}/${i.maxSessions}</td><td>${i.loginCount} / ${i.runs}</td><td>${date(i.lastLogin)}</td><td>${Math.round(i.activeMs / 60000)} min</td><td>${i.requests} requests<br>${Number(i.inputTokens).toLocaleString()} input tokens<br>${i.failures} failures</td><td>$${((i.inputTokens / 1e6) * this.inputRate).toFixed(4)}</td></tr>`).join("") || '<tr><td colspan="7">No invites yet. Create your first field pass above.</td></tr>'}</tbody></table></div></section>
    <section><h2>Active games</h2><div class="scroll"><table><thead><tr><th>Invite</th><th>Session</th><th>Action</th></tr></thead><tbody>${sessions.map((s: any) => `<tr><td>${escape(s.inviteId)}</td><td>${escape(s.managementId.slice(0, 12))}<br>Started ${date(s.started)}<br>Last seen ${date(s.heartbeat)}</td><td><form method="post" action="/admin/end-session"><input type="hidden" name="session" value="${escape(s.managementId)}"><button class="danger">End game</button></form></td></tr>`).join("") || '<tr><td colspan="3">No active games.</td></tr>'}</tbody></table></div></section>
    <section><h2>Recent successful logins</h2><div class="scroll"><table><thead><tr><th>Invite</th><th>Signed in</th><th>Login state</th></tr></thead><tbody>${this.store
      .recentLogins()
      .map(
        (l: any) =>
          `<tr><td>${escape(l.inviteId)}</td><td>${date(l.created)}</td><td>${l.loggedOut ? "Signed out" : l.expires <= this.now() ? "Expired" : "Within login lifetime"}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><p class="muted">Statistics persist across restarts. Running games do not. Estimated cost uses reported input tokens at $${this.inputRate}/million. Unknown provider charges are excluded. Cookie lifetime does not imply the player is online. <a href="/">Open game</a></p>`,
    );
  }
}
