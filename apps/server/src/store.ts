import {
  AccessLimit,
  DEFAULT_PUBLIC_SETTINGS,
  type PublicSettings,
} from "./public-policy";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync } from "node:fs";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,40}$/.test(id);
const validPassword = (password: string) =>
  typeof password === "string" &&
  password.length >= 16 &&
  password.length <= 256;
type Invite = {
  id: string;
  revision: number;
  enabled: boolean;
  maxSessions: number;
};
type Row = Record<string, any>;

/** Single-process durable state. Put the database on a persistent disk in production. */
export class Store {
  private db: DatabaseSync;
  constructor(
    path: string,
    private now = Date.now,
    private monthlyCap = 100_000_000,
    private inputRate = 0.042,
  ) {
    if (!Number.isSafeInteger(monthlyCap) || monthlyCap < 1)
      throw new Error("Monthly input token cap must be a positive integer");
    if (!Number.isFinite(inputRate) || inputRate <= 0 || inputRate > 1000)
      throw new Error("Invalid input token price");
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL, max_sessions INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS logins (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES invites(id), revision INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, logged_out INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, management_id TEXT UNIQUE NOT NULL, invite_id TEXT NOT NULL REFERENCES invites(id), started INTEGER NOT NULL, heartbeat INTEGER NOT NULL, playing INTEGER NOT NULL DEFAULT 0, active_ms INTEGER NOT NULL DEFAULT 0, ended INTEGER);
      CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), month TEXT NOT NULL, tokens INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, reported INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS sessions_invite ON sessions(invite_id, ended);
      CREATE INDEX IF NOT EXISTS usage_month ON usage(month);
      CREATE INDEX IF NOT EXISTS usage_session ON usage(session_id);
      CREATE INDEX IF NOT EXISTS logins_invite ON logins(invite_id);`);
    // Additive migration, preserving existing invites and usage. Legacy current-month
    // usage is charged conservatively to migration day because its timestamps are unknown.
    const add = (table: string, name: string, definition: string) => {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some((c) => c.name === name))
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    };
    add("sessions", "ip_key", "TEXT NOT NULL DEFAULT ''");
    add("usage", "day", "TEXT");
    add("usage", "cost", "INTEGER NOT NULL DEFAULT 0");
    add("usage", "unit_cost", "INTEGER NOT NULL DEFAULT 0");
    this.db
      .prepare(
        "UPDATE usage SET day=CASE WHEN month=? THEN ? ELSE month || '-01' END,cost=tokens*?,unit_cost=? WHERE day IS NULL",
      )
      .run(this.month(), this.day(), this.unitCost(), this.unitCost());
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS guests (invite_id TEXT PRIMARY KEY REFERENCES invites(id),created INTEGER NOT NULL,ip_key TEXT NOT NULL); CREATE INDEX IF NOT EXISTS usage_day ON usage(day); CREATE INDEX IF NOT EXISTS sessions_ip ON sessions(ip_key,ended); CREATE INDEX IF NOT EXISTS guests_ip ON guests(ip_key,created)",
    );
    this.db
      .prepare("UPDATE sessions SET ended=? WHERE ended IS NULL")
      .run(this.now());
    this.secureDatabaseFiles(path);
  }
  private secureDatabaseFiles(path: string) {
    if (path === ":memory:") return;
    for (const file of [path, `${path}-wal`, `${path}-shm`]) {
      if (existsSync(file)) chmodSync(file, 0o600);
    }
  }
  close() {
    this.db.close();
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  async importInvites(json: string) {
    if (
      this.db
        .prepare("SELECT value FROM metadata WHERE key='legacy_imported'")
        .get()
    )
      return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Legacy invites must be a JSON object");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Legacy invites must be a JSON object");
    const entries = Object.entries(parsed);
    if (
      entries.length > 100 ||
      entries.some(([id, password]) => !validId(id) || !validPassword(password))
    )
      throw new Error(
        "Invalid legacy invite IDs or passwords (16–256 characters required)",
      );
    const prepared: { id: string; salt: string; key: string }[] = [];
    for (const [id, password] of entries) {
      const salt = random();
      prepared.push({
        id,
        salt,
        key: (await derive(password, salt)).toString("hex"),
      });
    }
    this.transaction(() => {
      if (
        this.db
          .prepare("SELECT value FROM metadata WHERE key='legacy_imported'")
          .get()
      )
        return;
      for (const entry of prepared)
        this.db
          .prepare(
            "INSERT OR IGNORE INTO invites(id,salt,password_hash,enabled,max_sessions) VALUES(?,?,?,1,1)",
          )
          .run(entry.id, entry.salt, entry.key);
      this.db
        .prepare("INSERT INTO metadata VALUES('legacy_imported','1')")
        .run();
    });
  }
  async saveInvite(
    id: string,
    password: string | null,
    maxSessions: number,
    enabled: boolean,
  ) {
    if (
      !validId(id) ||
      !Number.isInteger(maxSessions) ||
      maxSessions < 1 ||
      maxSessions > 8 ||
      typeof enabled !== "boolean"
    )
      throw new Error("Invalid invite settings");
    if (password !== null && !validPassword(password))
      throw new Error("Invite password must contain 16–256 characters");
    const salt = password === null ? null : random();
    const key =
      password === null
        ? null
        : (await derive(password, salt!)).toString("hex");
    this.transaction(() => {
      const existing = this.getInvite(id);
      if (!existing && !password)
        throw new Error("New invites require a password");
      if (!existing)
        this.db
          .prepare(
            "INSERT INTO invites(id,salt,password_hash,enabled,max_sessions) VALUES(?,?,?,?,?)",
          )
          .run(id, salt!, key!, Number(enabled), maxSessions);
      else {
        const revoke = password !== null || existing.enabled !== enabled;
        this.db
          .prepare(
            "UPDATE invites SET salt=COALESCE(?,salt),password_hash=COALESCE(?,password_hash),enabled=?,max_sessions=?,revision=revision+? WHERE id=?",
          )
          .run(salt, key, Number(enabled), maxSessions, Number(revoke), id);
        if (revoke || maxSessions < existing.maxSessions)
          this.db
            .prepare(
              "UPDATE sessions SET ended=? WHERE invite_id=? AND ended IS NULL",
            )
            .run(this.now(), id);
      }
    });
  }
  async resetPassword(id: string, password: string) {
    if (!validId(id) || !validPassword(password))
      throw new Error("Invalid password reset");
    const salt = random();
    const key = (await derive(password, salt)).toString("hex");
    this.transaction(() => {
      if (!this.getInvite(id)) throw new Error("Invite not found");
      this.db
        .prepare(
          "UPDATE invites SET salt=?,password_hash=?,revision=revision+1 WHERE id=?",
        )
        .run(salt, key, id);
      this.db
        .prepare(
          "UPDATE sessions SET ended=? WHERE invite_id=? AND ended IS NULL",
        )
        .run(this.now(), id);
    });
  }
  revokeInvite(id: string) {
    this.transaction(() => {
      this.db
        .prepare("UPDATE invites SET enabled=0,revision=revision+1 WHERE id=?")
        .run(id);
      this.db
        .prepare(
          "UPDATE sessions SET ended=? WHERE invite_id=? AND ended IS NULL",
        )
        .run(this.now(), id);
    });
  }
  async authenticate(id: string, password: string) {
    if (typeof password !== "string" || password.length > 256 || !validId(id))
      return false;
    const row = this.db.prepare("SELECT * FROM invites WHERE id=?").get(id) as
      Row | undefined;
    // Same expensive derivation for missing users avoids a cheap username timing oracle.
    const key = await derive(
      password,
      row?.salt ?? "missing-invite-dummy-salt",
    );
    const expected = row
      ? Buffer.from(row.password_hash, "hex")
      : Buffer.alloc(64);
    const current = this.getInvite(id);
    return (
      !!row?.enabled &&
      !!current?.enabled &&
      current.revision === row.revision &&
      timingSafeEqual(key, expected)
    );
  }
  getInvite(id: string): Invite | undefined {
    const row = this.db
      .prepare(
        "SELECT id,revision,enabled,max_sessions FROM invites WHERE id=?",
      )
      .get(id) as Row | undefined;
    return row
      ? {
          id: row.id,
          revision: row.revision,
          enabled: !!row.enabled,
          maxSessions: row.max_sessions,
        }
      : undefined;
  }
  createLogin(id: string) {
    const invite = this.getInvite(id);
    if (!invite?.enabled) throw new Error("Invite unavailable");
    const token = random(),
      now = this.now();
    this.db
      .prepare(
        "INSERT INTO logins(token_hash,invite_id,revision,created,expires) VALUES(?,?,?,?,?)",
      )
      .run(hash(token), id, invite.revision, now, now + 7 * 86400_000);
    return token;
  }
  identity(token: string): string | null {
    if (typeof token !== "string" || token.length > 256) return null;
    const row = this.db
      .prepare(
        "SELECT l.invite_id FROM logins l JOIN invites i ON i.id=l.invite_id WHERE l.token_hash=? AND l.expires>? AND l.logged_out=0 AND i.enabled=1 AND i.revision=l.revision",
      )
      .get(hash(token), this.now()) as Row | undefined;
    return row?.invite_id ?? null;
  }
  logout(token: string) {
    this.db
      .prepare("UPDATE logins SET logged_out=1 WHERE token_hash=?")
      .run(hash(token));
  }
  startSession(id: string, inviteId: string, ipKey = "") {
    if (!id || id.length > 256) throw new Error("Invalid session ID");
    this.expireSessions();
    this.transaction(() => {
      this.checkDaily(inviteId, ipKey);
      const invite = this.getInvite(inviteId);
      if (!invite?.enabled) throw new Error("Invite unavailable");
      const row = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM sessions WHERE invite_id=? AND ended IS NULL",
        )
        .get(inviteId) as Row;
      if (row.count >= (this.isGuest(inviteId) ? 1 : invite.maxSessions))
        throw new Error("Concurrent session limit reached");
      if (this.isGuest(inviteId)) {
        if (!ipKey) throw new AccessLimit("public_unavailable");
        const active = this.db
          .prepare(
            "SELECT COUNT(*) AS n FROM sessions WHERE ip_key=? AND ended IS NULL",
          )
          .get(ipKey) as Row;
        if (active.n >= this.publicSettings().ipConcurrent)
          throw new AccessLimit("ip_session_limit");
      }
      const now = this.now();
      this.db
        .prepare(
          "INSERT INTO sessions(id,management_id,invite_id,started,heartbeat,ip_key) VALUES(?,?,?,?,?,?)",
        )
        .run(id, hash(id), inviteId, now, now, ipKey);
    });
  }
  sessionActive(id: string): boolean {
    const session = this.db
      .prepare("SELECT invite_id FROM sessions WHERE id=?")
      .get(id) as Row | undefined;
    return !!session && this.ownsSession(id, session.invite_id);
  }
  ownsSession(id: string, inviteId: string) {
    const now = this.now();
    return !!this.db
      .prepare(
        "SELECT s.id FROM sessions s JOIN invites i ON i.id=s.invite_id WHERE s.id=? AND s.invite_id=? AND s.ended IS NULL AND s.heartbeat>? AND s.started>? AND i.enabled=1",
      )
      .get(id, inviteId, now - 90_000, now - 1800_000);
  }
  heartbeat(id: string, inviteId: string, playing: boolean) {
    if (typeof playing !== "boolean" || !this.ownsSession(id, inviteId))
      return false;
    const now = this.now();
    this.db
      .prepare(
        "UPDATE sessions SET active_ms=active_ms+CASE WHEN playing=1 AND ?=1 THEN MIN(15000,MAX(0,?-heartbeat)) ELSE 0 END,heartbeat=?,playing=? WHERE id=?",
      )
      .run(Number(playing), now, now, Number(playing), id);
    return true;
  }
  endSession(id: string) {
    this.db
      .prepare("UPDATE sessions SET ended=? WHERE id=? AND ended IS NULL")
      .run(this.now(), id);
  }
  expireSessions(): string[] {
    const now = this.now();
    const rows = this.db
      .prepare(
        "SELECT id FROM sessions WHERE ended IS NULL AND (heartbeat<=? OR started<=?)",
      )
      .all(now - 90_000, now - 1800_000) as Row[];
    for (const row of rows) this.endSession(row.id);
    return rows.map((row) => row.id);
  }
  sessionIdForManagement(id: string): string | undefined {
    return (
      this.db
        .prepare("SELECT id FROM sessions WHERE management_id=?")
        .get(id) as Row | undefined
    )?.id;
  }
  activeSessions() {
    this.expireSessions();
    return this.db
      .prepare(
        "SELECT management_id AS managementId,invite_id AS inviteId,started,heartbeat,active_ms AS activeMs FROM sessions WHERE ended IS NULL ORDER BY started DESC",
      )
      .all();
  }
  listInvites(): Row[] {
    this.expireSessions();
    return (
      this.db
        .prepare(
          `SELECT i.id,i.enabled,i.max_sessions AS maxSessions,i.revision,
      (SELECT COUNT(*) FROM logins l WHERE l.invite_id=i.id) AS loginCount,
      (SELECT MAX(created) FROM logins l WHERE l.invite_id=i.id) AS lastLogin,
      (SELECT MAX(heartbeat) FROM sessions s WHERE s.invite_id=i.id) AS lastSeen,
      (SELECT COUNT(*) FROM sessions s WHERE s.invite_id=i.id) AS runs,
      (SELECT COUNT(*) FROM sessions s WHERE s.invite_id=i.id AND ended IS NULL) AS activeSessions,
      COALESCE((SELECT SUM(active_ms) FROM sessions s WHERE s.invite_id=i.id),0) AS activeMs,
      (SELECT COUNT(*) FROM usage u JOIN sessions s ON s.id=u.session_id WHERE s.invite_id=i.id) AS requests,
      COALESCE((SELECT SUM(tokens) FROM usage u JOIN sessions s ON s.id=u.session_id WHERE s.invite_id=i.id AND reported=1),0) AS inputTokens,
      COALESCE((SELECT SUM(failed) FROM usage u JOIN sessions s ON s.id=u.session_id WHERE s.invite_id=i.id),0) AS failures
      FROM invites i ORDER BY i.id LIMIT 200`,
        )
        .all() as Row[]
    ).map((row) => ({ ...row, enabled: !!row.enabled }));
  }
  recentLogins() {
    return this.db
      .prepare(
        "SELECT invite_id AS inviteId,created,expires,logged_out AS loggedOut FROM logins ORDER BY created DESC LIMIT 100",
      )
      .all();
  }
  publicSettings(): PublicSettings {
    const row = this.db
      .prepare("SELECT value FROM metadata WHERE key='public_settings'")
      .get() as Row | undefined;
    return row ? JSON.parse(row.value) : { ...DEFAULT_PUBLIC_SETTINGS };
  }
  savePublicSettings(settings: PublicSettings) {
    if (
      typeof settings.publicEnabled !== "boolean" ||
      ![settings.dailyCents, settings.guestCents, settings.ipCents].every(
        (v) => Number.isSafeInteger(v) && v >= 0 && v <= 10000,
      ) ||
      !Number.isInteger(settings.ipConcurrent) ||
      settings.ipConcurrent < 1 ||
      settings.ipConcurrent > 8
    )
      throw new Error("Invalid public settings");
    this.db
      .prepare(
        "INSERT INTO metadata(key,value) VALUES('public_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(settings));
    if (!settings.publicEnabled)
      this.db
        .prepare(
          "UPDATE sessions SET ended=? WHERE ended IS NULL AND invite_id IN (SELECT invite_id FROM guests)",
        )
        .run(this.now());
  }
  isGuest(id: string) {
    return !!this.db.prepare("SELECT 1 FROM guests WHERE invite_id=?").get(id);
  }
  createGuest(ipKey: string): string {
    return this.transaction(() => {
      this.checkDaily(undefined, ipKey);
      if (!this.publicSettings().publicEnabled)
        throw new AccessLimit("public_closed");
      const total = this.db
        .prepare("SELECT COUNT(*) AS n FROM guests")
        .get() as Row;
      const recent = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM guests WHERE ip_key=? AND created>=?",
        )
        .get(ipKey, Date.parse(this.day() + "T00:00:00Z")) as Row;
      if (!ipKey || total.n >= 10000 || recent.n >= 4)
        throw new AccessLimit("guest_creation_limit");
      const id = "guest_" + randomBytes(12).toString("hex");
      // Guests have no usable password. Secure random credential material is never returned.
      this.db
        .prepare(
          "INSERT INTO invites(id,salt,password_hash,enabled,max_sessions) VALUES(?,?,?,1,1)",
        )
        .run(id, random(), randomBytes(64).toString("hex"));
      this.db
        .prepare("INSERT INTO guests VALUES(?,?,?)")
        .run(id, this.now(), ipKey);
      return this.createLogin(id);
    });
  }
  sessionNetwork(id: string) {
    return (
      (
        this.db.prepare("SELECT ip_key FROM sessions WHERE id=?").get(id) as
          Row | undefined
      )?.ip_key ?? ""
    );
  }
  private day() {
    return new Date(this.now()).toISOString().slice(0, 10);
  }
  private unitCost() {
    return Math.ceil(this.inputRate * 1000);
  } // nanodollars per input token
  dailyBudget() {
    const settings = this.publicSettings();
    const row = this.db
      .prepare("SELECT COALESCE(SUM(cost),0) AS cost FROM usage WHERE day=?")
      .get(this.day()) as Row;
    return {
      day: this.day(),
      chargedUsd: row.cost / 1e9,
      limitUsd: settings.dailyCents / 100,
      effectiveUsd: (settings.dailyCents / 100) * 0.95,
      resetAt: Date.parse(this.day() + "T00:00:00Z") + 86400000,
    };
  }
  checkDaily(inviteId?: string, ipKey = "", reserveTokens = 1) {
    const p = this.publicSettings();
    const budget = this.dailyBudget();
    const cost = reserveTokens * this.unitCost();
    if (
      Math.round(budget.chargedUsd * 1e9) + cost >
      p.dailyCents * 10000000 * 0.95
    )
      throw new AccessLimit("daily_budget_exhausted");
    if (inviteId && this.isGuest(inviteId)) {
      if (!p.publicEnabled) throw new AccessLimit("public_closed");
      const usage = this.db
        .prepare(
          "SELECT COALESCE(SUM(u.cost),0) AS cost FROM usage u JOIN sessions s ON s.id=u.session_id WHERE u.day=? AND s.invite_id=?",
        )
        .get(this.day(), inviteId) as Row;
      if (usage.cost + cost > p.guestCents * 10000000 * 0.95)
        throw new AccessLimit("guest_daily_budget_exhausted");
    }
    if (ipKey) {
      const usage = this.db
        .prepare(
          "SELECT COALESCE(SUM(u.cost),0) AS cost FROM usage u JOIN sessions s ON s.id=u.session_id WHERE u.day=? AND s.ip_key=?",
        )
        .get(this.day(), ipKey) as Row;
      if (usage.cost + cost > p.ipCents * 10000000 * 0.95)
        throw new AccessLimit("ip_daily_budget_exhausted");
    }
  }
  private month() {
    return new Date(this.now()).toISOString().slice(0, 7);
  }
  budget() {
    const month = this.month();
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(tokens),0) AS charged FROM usage WHERE month=?",
      )
      .get(month) as Row;
    return { month, cap: this.monthlyCap, charged: row.charged as number };
  }
  reserveUsage(sessionId: string, reserveTokens: number) {
    if (!Number.isSafeInteger(reserveTokens) || reserveTokens < 1)
      throw new Error("Invalid token reservation");
    return this.transaction(() => {
      const session = this.db
        .prepare("SELECT invite_id,ip_key FROM sessions WHERE id=?")
        .get(sessionId) as Row | undefined;
      if (!session || !this.ownsSession(sessionId, session.invite_id))
        throw new Error("Session unavailable");
      this.checkDaily(session.invite_id, session.ip_key, reserveTokens);
      const budget = this.budget();
      if (budget.charged + reserveTokens > budget.cap)
        throw new Error("Monthly token budget exhausted");
      const id = random();
      this.db
        .prepare(
          "INSERT INTO usage(id,session_id,month,tokens,day,cost,unit_cost) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          id,
          sessionId,
          budget.month,
          reserveTokens,
          this.day(),
          reserveTokens * this.unitCost(),
          this.unitCost(),
        );
      return id;
    });
  }
  settleUsage(id: string, actualInputTokens?: number, failed = false) {
    if (
      actualInputTokens !== undefined &&
      (!Number.isSafeInteger(actualInputTokens) || actualInputTokens < 0)
    )
      throw new Error("Invalid reported usage");
    this.db
      .prepare(
        "UPDATE usage SET tokens=COALESCE(?,tokens),cost=CASE WHEN ? IS NULL THEN cost ELSE ?*unit_cost END,settled=1,reported=?,failed=? WHERE id=? AND settled=0",
      )
      .run(
        actualInputTokens ?? null,
        actualInputTokens ?? null,
        actualInputTokens ?? null,
        Number(actualInputTokens !== undefined),
        Number(failed),
        id,
      );
  }
}
