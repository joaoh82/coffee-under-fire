import { publicName } from "./name-policy";
import {
  boardOptionsSchema,
  leaderboardNameKey,
  DEFAULT_BOARD,
  scoreSubmissionSchema,
  reportPoints,
  type BoardOptions,
  type BoardEntry,
} from "../../../packages/shared/leaderboard";
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
  private boardCache = new Map<
    string,
    { until: number; entries: BoardEntry[] }
  >();
  constructor(
    path: string,
    private now = Date.now,
  ) {
    this.db = new DatabaseSync(path);
    this.db.function("admin_lower", { deterministic: true }, (value) =>
      String(value).toLowerCase(),
    );
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL, max_sessions INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS logins (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES invites(id), revision INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, logged_out INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, management_id TEXT UNIQUE NOT NULL, invite_id TEXT NOT NULL REFERENCES invites(id), started INTEGER NOT NULL, heartbeat INTEGER NOT NULL, playing INTEGER NOT NULL DEFAULT 0, active_ms INTEGER NOT NULL DEFAULT 0, ended INTEGER);
      CREATE INDEX IF NOT EXISTS sessions_invite ON sessions(invite_id, ended);
      CREATE INDEX IF NOT EXISTS logins_invite ON logins(invite_id);`);
    // Additive migration, preserving existing invites. A legacy `usage` table from
    // the retired Jev integration is left untouched and no longer read.
    const add = (table: string, name: string, definition: string) => {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some((c) => c.name === name))
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    };
    add("invites", "display_name", "TEXT NOT NULL DEFAULT ''");
    add("sessions", "ip_key", "TEXT NOT NULL DEFAULT ''");
    add("sessions", "board_options", "TEXT");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS guests (invite_id TEXT PRIMARY KEY REFERENCES invites(id),created INTEGER NOT NULL,ip_key TEXT NOT NULL); CREATE INDEX IF NOT EXISTS sessions_ip ON sessions(ip_key,ended); CREATE INDEX IF NOT EXISTS guests_ip ON guests(ip_key,created)",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS leaderboard (id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id), invite_id TEXT NOT NULL REFERENCES invites(id), name TEXT NOT NULL, score INTEGER NOT NULL, time REAL NOT NULL, kills INTEGER NOT NULL, deliveries INTEGER NOT NULL, map_id TEXT NOT NULL, difficulty TEXT NOT NULL, mission_mode TEXT NOT NULL, created INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS leaderboard_category ON leaderboard(map_id,difficulty,mission_mode,hidden,score DESC)",
    );
    add("leaderboard", "name_key", "TEXT");
    this.transaction(() => {
      const update = this.db.prepare(
        "UPDATE leaderboard SET name_key=? WHERE id=?",
      );
      for (const row of this.db
        .prepare("SELECT id,name FROM leaderboard WHERE name_key IS NULL")
        .all()) {
        update.run(leaderboardNameKey(String(row.name)), row.id);
      }
    });
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS leaderboard_name_category ON leaderboard(map_id,difficulty,mission_mode,hidden,name_key,score DESC)",
    );
    this.db
      .prepare("UPDATE sessions SET ended=? WHERE ended IS NULL")
      .run(this.now());
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS sessions_started ON sessions(started); CREATE INDEX IF NOT EXISTS logins_created ON logins(created DESC); CREATE INDEX IF NOT EXISTS logins_invite_created ON logins(invite_id,created)",
    );
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
  startSession(id: string, inviteId: string, ipKey = "", board?: BoardOptions) {
    if (board) boardOptionsSchema.parse(board);
    if (!id || id.length > 256) throw new Error("Invalid session ID");
    this.expireSessions();
    this.transaction(() => {
      if (this.isGuest(inviteId) && !this.publicSettings().publicEnabled)
        throw new AccessLimit("public_closed");
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
          "INSERT INTO sessions(id,management_id,invite_id,started,heartbeat,ip_key,board_options) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          id,
          hash(id),
          inviteId,
          now,
          now,
          ipKey,
          board ? JSON.stringify(board) : null,
        );
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
          `SELECT i.id,i.display_name AS displayName,i.enabled,i.max_sessions AS maxSessions,i.revision,
      (SELECT COUNT(*) FROM logins l WHERE l.invite_id=i.id) AS loginCount,
      (SELECT MAX(created) FROM logins l WHERE l.invite_id=i.id) AS lastLogin,
      (SELECT MAX(heartbeat) FROM sessions s WHERE s.invite_id=i.id) AS lastSeen,
      (SELECT COUNT(*) FROM sessions s WHERE s.invite_id=i.id) AS runs,
      (SELECT COUNT(*) FROM sessions s WHERE s.invite_id=i.id AND ended IS NULL) AS activeSessions,
      COALESCE((SELECT SUM(active_ms) FROM sessions s WHERE s.invite_id=i.id),0) AS activeMs
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
  /** Literal substring search; SQL wildcards have no special meaning. */
  private adminSearch(search = "") {
    return search.trim().slice(0, 100).toLowerCase();
  }
  private adminPage(total: number, requested = 1) {
    const pageSize = 25 as const;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(
      pages,
      Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1),
    );
    return { total, page, pageSize, pages };
  }
  pagedInvites(
    options: {
      search?: string;
      page?: number;
      sort?: "lastLogin" | "playTime";
      direction?: "asc" | "desc";
    } = {},
  ) {
    this.expireSessions();
    const search = this.adminSearch(options.search);
    const where =
      "(instr(admin_lower(i.id),?)>0 OR instr(admin_lower(i.display_name),?)>0)";
    const total = Number(
      this.db
        .prepare(`SELECT COUNT(*) AS n FROM invites i WHERE ${where}`)
        .get(search, search)!.n,
    );
    const pagination = this.adminPage(total, options.page);
    // Order expressions are selected from constants, never interpolated user input.
    const sort = options.sort === "playTime" ? "activeMs" : "lastLogin";
    const direction = options.direction === "asc" ? "ASC" : "DESC";
    const rows = this.db
      .prepare(
        `WITH login_stats AS (
      SELECT invite_id,COUNT(*) AS loginCount,MAX(created) AS lastLogin FROM logins GROUP BY invite_id
    ), session_stats AS (
      SELECT invite_id,MAX(heartbeat) AS lastSeen,COUNT(*) AS runs,SUM(ended IS NULL) AS activeSessions,SUM(active_ms) AS activeMs FROM sessions GROUP BY invite_id
    ) SELECT i.id,i.display_name AS displayName,i.enabled,i.max_sessions AS maxSessions,i.revision,
      g.invite_id IS NOT NULL AS isGuest,COALESCE(l.loginCount,0) AS loginCount,l.lastLogin,s.lastSeen,
      COALESCE(s.runs,0) AS runs,COALESCE(s.activeSessions,0) AS activeSessions,COALESCE(s.activeMs,0) AS activeMs
      FROM invites i LEFT JOIN login_stats l ON l.invite_id=i.id LEFT JOIN session_stats s ON s.invite_id=i.id
      LEFT JOIN guests g ON g.invite_id=i.id
      WHERE ${where} ORDER BY ${sort} ${direction} NULLS LAST,i.id ASC LIMIT ? OFFSET ?`,
      )
      .all(
        search,
        search,
        pagination.pageSize,
        (pagination.page - 1) * pagination.pageSize,
      )
      .map((row) => ({
        ...row,
        enabled: !!row.enabled,
        isGuest: !!row.isGuest,
      })) as Row[];
    return { ...pagination, rows };
  }
  pagedLogins(options: { search?: string; page?: number } = {}) {
    const search = this.adminSearch(options.search);
    const where =
      "(instr(admin_lower(i.id),?)>0 OR instr(admin_lower(i.display_name),?)>0)";
    const total = Number(
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM logins l JOIN invites i ON i.id=l.invite_id WHERE ${where}`,
        )
        .get(search, search)!.n,
    );
    const pagination = this.adminPage(total, options.page);
    const rows = this.db
      .prepare(
        `SELECT l.invite_id AS inviteId,i.display_name AS displayName,l.created,l.expires,l.logged_out AS loggedOut,
      (i.enabled=0 OR i.revision<>l.revision) AS revoked FROM logins l JOIN invites i ON i.id=l.invite_id
      WHERE ${where} ORDER BY l.created DESC,l.rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(
        search,
        search,
        pagination.pageSize,
        (pagination.page - 1) * pagination.pageSize,
      )
      .map((row) => ({ ...row, revoked: !!row.revoked })) as Row[];
    return { ...pagination, rows };
  }
  /** UTC days. Historical sessions have no per-day heartbeats: measured play is
   * attributed to their start day. New users are identities' first successful login.
   * Average minutes divides measured play by distinct active identities that day. */
  analytics(requested: 7 | 30 | 90 = 30) {
    const count = requested === 7 || requested === 90 ? requested : 30;
    const end = Date.parse(this.day() + "T00:00:00Z") + 86400000;
    const start = end - count * 86400000;
    const play = this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d',started/1000.0,'unixepoch') AS day,
      COUNT(DISTINCT CASE WHEN active_ms>0 THEN invite_id END) AS activeUsers,COUNT(*) AS runs,SUM(active_ms) AS activeMs
      FROM sessions WHERE started>=? AND started<? GROUP BY day`,
      )
      .all(start, end);
    const fresh = this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d',first_login/1000.0,'unixepoch') AS day,COUNT(*) AS newUsers
      FROM (SELECT MIN(created) AS first_login FROM logins GROUP BY invite_id) WHERE first_login>=? AND first_login<? GROUP BY day`,
      )
      .all(start, end);
    const days = Array.from({ length: count }, (_, index) => ({
      day: new Date(start + index * 86400000).toISOString().slice(0, 10),
      activeUsers: 0,
      newUsers: 0,
      runs: 0,
      activeMs: 0,
      averageMinutes: 0,
    }));
    const byDay = new Map(days.map((day) => [day.day, day]));
    for (const row of [...play, ...fresh]) {
      const day = byDay.get(String(row.day));
      if (day) Object.assign(day, row);
    }
    for (const day of days)
      day.averageMinutes = day.activeUsers
        ? day.activeMs / day.activeUsers / 60000
        : 0;
    const totalPlayers = Number(
      this.db.prepare("SELECT COUNT(*) AS n FROM invites").get()!.n,
    );
    const uniqueActiveUsers = Number(
      this.db
        .prepare(
          "SELECT COUNT(DISTINCT invite_id) AS n FROM sessions WHERE active_ms>0 AND started>=? AND started<?",
        )
        .get(start, end)!.n,
    );
    return {
      days,
      totalPlayers,
      uniqueActiveUsers,
      newUsers: days.reduce((sum, day) => sum + day.newUsers, 0),
      activeMs: days.reduce((sum, day) => sum + day.activeMs, 0),
      runs: days.reduce((sum, day) => sum + day.runs, 0),
      historicalApproximation: true,
    };
  }
  submitScore(
    sessionId: string,
    inviteId: string,
    network: string,
    raw: unknown,
  ) {
    const input = scoreSubmissionSchema.parse(raw);
    // A guest may publish their own generated ID as the no-name fallback.
    const name =
      this.isGuest(inviteId) && input.name === inviteId
        ? inviteId
        : publicName(input.name);
    return this.transaction(() => {
      const session = this.db
        .prepare("SELECT * FROM sessions WHERE id=? AND invite_id=?")
        .get(sessionId, inviteId) as Row | undefined;
      if (
        !session ||
        !this.getInvite(inviteId)?.enabled ||
        (this.isGuest(inviteId) && session.ip_key !== network)
      )
        throw new Error("Score session not owned");
      const existing = this.db
        .prepare("SELECT id,hidden FROM leaderboard WHERE session_id=?")
        .get(sessionId) as Row | undefined;
      if (existing) {
        if (existing.hidden) throw new Error("Entry removed by moderator");
        return { id: existing.id, alreadySubmitted: true };
      }
      if (!session.board_options)
        throw new Error("Start a new run to enter the leaderboard");
      const options = boardOptionsSchema.parse(
        JSON.parse(session.board_options),
      );
      const finish = session.ended ?? this.now();
      if (session.ended === null && session.heartbeat < this.now() - 90000)
        throw new Error("Run expired");
      if (
        finish < this.now() - 3600000 ||
        this.now() - session.started < 5000 ||
        input.report.time > (finish - session.started) / 1000 + 5
      )
        throw new Error("Run timing is not eligible");
      const r = input.report;
      if (
        (options.missionMode === "mission" && r.time > 481) ||
        (r.won && (options.missionMode !== "mission" || r.time < 479)) ||
        r.kills > r.time * 20 + 10 ||
        r.deliveries > r.time / 1.2 + 1 ||
        r.score > r.kills * 500 + r.deliveries * 1000 + r.time * 100 + 10000
      )
        throw new Error("Invalid run totals");
      const total = this.db
        .prepare("SELECT COUNT(*) AS n FROM leaderboard")
        .get() as Row;
      if (total.n >= 100000) throw new Error("Leaderboard is temporarily full");
      const id = random();
      this.db
        .prepare(
          "INSERT INTO leaderboard(id,session_id,invite_id,name,score,time,kills,deliveries,map_id,difficulty,mission_mode,created,name_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          sessionId,
          inviteId,
          name,
          reportPoints(r),
          r.time,
          r.kills,
          r.deliveries,
          options.mapId,
          options.difficulty,
          options.missionMode,
          this.now(),
          leaderboardNameKey(name),
        );
      this.db
        .prepare("UPDATE sessions SET ended=COALESCE(ended,?) WHERE id=?")
        .run(this.now(), sessionId);
      // Remember the chosen name for future runs, but keep an ID fallback unnamed.
      this.db
        .prepare("UPDATE invites SET display_name=? WHERE id=?")
        .run(name === inviteId ? "" : name, inviteId);
      this.boardCache.clear();
      return { id, alreadySubmitted: false };
    });
  }
  leaderboard(options: BoardOptions = DEFAULT_BOARD): BoardEntry[] {
    boardOptionsSchema.parse(options);
    const key = [options.mapId, options.difficulty, options.missionMode].join(
      ":",
    );
    const cached = this.boardCache.get(key);
    if (cached && cached.until > this.now()) return cached.entries;
    const entries = this.db
      .prepare(
        `SELECT id,name,score,time,kills,deliveries,created FROM (
      SELECT *,ROW_NUMBER() OVER(PARTITION BY name_key ORDER BY score DESC,created ASC,id ASC) AS place
      FROM leaderboard WHERE map_id=? AND difficulty=? AND mission_mode=? AND hidden=0
    ) WHERE place=1 ORDER BY score DESC,created ASC,id ASC LIMIT 20`,
      )
      .all(
        options.mapId,
        options.difficulty,
        options.missionMode,
      ) as BoardEntry[];
    this.boardCache.set(key, { until: this.now() + 5000, entries });
    return entries;
  }
  recentScores() {
    return this.db
      .prepare(
        "SELECT id,name,score,map_id AS mapId,difficulty,mission_mode AS missionMode FROM leaderboard WHERE hidden=0 ORDER BY created DESC LIMIT 100",
      )
      .all() as Row[];
  }
  hideScore(id: string) {
    this.boardCache.clear();
    this.db.prepare("UPDATE leaderboard SET hidden=1 WHERE id=?").run(id);
  }
  publicSettings(): PublicSettings {
    const row = this.db
      .prepare("SELECT value FROM metadata WHERE key='public_settings'")
      .get() as Row | undefined;
    if (!row) return { ...DEFAULT_PUBLIC_SETTINGS };
    // Older rows also carry retired spending caps; keep only current fields.
    const { publicEnabled, ipConcurrent } = JSON.parse(row.value);
    return { publicEnabled, ipConcurrent };
  }
  savePublicSettings(settings: PublicSettings) {
    if (
      typeof settings.publicEnabled !== "boolean" ||
      !Number.isInteger(settings.ipConcurrent) ||
      settings.ipConcurrent < 1 ||
      settings.ipConcurrent > 8
    )
      throw new Error("Invalid public settings");
    this.db
      .prepare(
        "INSERT INTO metadata(key,value) VALUES('public_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(
        JSON.stringify({
          publicEnabled: settings.publicEnabled,
          ipConcurrent: settings.ipConcurrent,
        }),
      );
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
  playerProfile(id: string) {
    const row = this.db
      .prepare(
        "SELECT id,display_name AS displayName FROM invites WHERE id=? AND enabled=1",
      )
      .get(id) as { id: string; displayName: string } | undefined;
    if (!row) throw new Error("Player unavailable");
    return row;
  }
  createGuest(ipKey: string, displayName = ""): string {
    const name = displayName.trim() ? publicName(displayName) : "";
    return this.transaction(() => {
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
      if (!ipKey) throw new AccessLimit("public_unavailable");
      if (total.n >= 10000) throw new AccessLimit("guest_capacity_limit");
      if (recent.n >= 4) throw new AccessLimit("guest_daily_creation_limit");
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
      this.db
        .prepare("UPDATE invites SET display_name=? WHERE id=?")
        .run(name, id);
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
}
