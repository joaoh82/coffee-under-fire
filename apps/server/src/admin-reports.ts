import type { Store } from "./store";
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const date = (value: number) =>
  value
    ? new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "Never";
export function reportOptions(query: URLSearchParams) {
  const page = (key: string) =>
    Math.max(1, Math.min(1_000_000, Math.floor(Number(query.get(key))) || 1));
  return {
    search: (query.get("q") ?? "").trim().slice(0, 80),
    page: page("playerPage"),
    sort:
      query.get("sort") === "playTime"
        ? ("playTime" as const)
        : ("lastLogin" as const),
    direction:
      query.get("order") === "asc" ? ("asc" as const) : ("desc" as const),
    loginSearch: (query.get("loginQ") ?? "").trim().slice(0, 80),
    loginPage: page("loginPage"),
    days: ([7, 30, 90].includes(Number(query.get("days")))
      ? Number(query.get("days"))
      : 30) as 7 | 30 | 90,
  };
}
export const REPORT_CSS = `
.report-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:16px 0}.report-toolbar>div{flex:1;min-width:160px}.report-toolbar button{margin:0}.pagination{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:18px 0 0}.pagination a{padding:8px 12px;border:1px solid #8e9b7b;border-radius:5px}.pagination span{color:#c4ceb9}.charts{display:grid;grid-template-columns:1fr 1fr;gap:24px}.chart{margin:0;min-width:0}.chart h3{font-size:16px;margin-bottom:2px}.chart strong{font-size:30px;font-variant-numeric:tabular-nums}.chart svg{width:100%;height:auto;display:block}.chart text{fill:#c4ceb9;font-size:11px}.chart rect{fill:#deb879}.chart line{stroke:#63705a}.chart figcaption{color:#c4ceb9;font-size:13px}.report-intro{max-width:76ch}.stats,td{font-variant-numeric:tabular-nums}details.daily-data{margin-top:24px}summary{cursor:pointer}a:hover{color:#ffe4b5}button:hover{filter:brightness(1.08)}@media(max-width:650px){.charts{grid-template-columns:1fr}section{padding:16px}.report-toolbar>div{min-width:100%}}
`;
export function renderReports(
  store: Store,
  query: URLSearchParams,
  now: number,
  inputRate: number,
) {
  const o = reportOptions(query);
  const players = store.pagedInvites(o);
  const logins = store.pagedLogins({
    search: o.loginSearch,
    page: o.loginPage,
  });
  const analytics = store.analytics(o.days);
  const base = new URLSearchParams({
    q: o.search,
    playerPage: String(players.page),
    sort: o.sort,
    order: o.direction,
    loginQ: o.loginSearch,
    loginPage: String(logins.page),
    days: String(o.days),
  });
  const href = (changes: Record<string, string>, anchor: string) => {
    const p = new URLSearchParams(base);
    for (const [k, v] of Object.entries(changes)) p.set(k, v);
    return esc("/admin?" + p.toString() + "#" + anchor);
  };
  const hidden = (exclude: string[]) =>
    [...base]
      .filter(([k]) => !exclude.includes(k))
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
      .join("");
  const pager = (
    data: { page: number; pages: number; total: number; pageSize: number },
    key: string,
    anchor: string,
  ) =>
    `<nav class="pagination" aria-label="${anchor} pages">${data.page > 1 ? `<a href="${href({ [key]: String(data.page - 1) }, anchor)}">← Previous</a>` : ""}<span>${data.total ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}` : "0 results"} · Page ${data.page} of ${data.pages}</span>${data.page < data.pages ? `<a href="${href({ [key]: String(data.page + 1) }, anchor)}">Next →</a>` : ""}</nav>`;
  const playerSection = `<section id="players"><h2>Players and usage</h2><p class="muted report-intro">Search by invite ID, guest ID or current display name. Play time estimates visible, running-game activity. Usage excludes unreported provider billing.</p><form class="report-toolbar" method="get" action="/admin#players">${hidden(["q", "playerPage", "sort", "order"])}<div><label for="player-search">Find a player</label><input type="search" id="player-search" name="q" maxlength="80" value="${esc(o.search)}" placeholder="ID or display name"></div><div><label for="player-sort">Sort by</label><select id="player-sort" name="sort"><option value="lastLogin" ${o.sort === "lastLogin" ? "selected" : ""}>Last login</option><option value="playTime" ${o.sort === "playTime" ? "selected" : ""}>Play time</option></select></div><div><label for="player-order">Order</label><select id="player-order" name="order"><option value="desc" ${o.direction === "desc" ? "selected" : ""}>Highest / newest first</option><option value="asc" ${o.direction === "asc" ? "selected" : ""}>Lowest / oldest first</option></select></div><button>Apply</button><a href="${href({ q: "", playerPage: "1", sort: "lastLogin", order: "desc" }, "players")}">Clear</a></form><div class="scroll"><table><thead><tr><th>Invite / guest ID</th><th>Display name</th><th>Access / games</th><th>Logins / runs</th><th>Last login</th><th>Play time</th><th>Jev usage</th><th>Est. cost</th><th>Password</th></tr></thead><tbody>${players.rows.map((i) => `<tr><td>${esc(i.id)}<br><small>${i.isGuest ? "Guest" : "Invite"}</small></td><td>${esc(i.displayName || "Not set")}</td><td>${i.enabled ? "Enabled" : "Disabled"} · ${i.activeSessions}/${i.maxSessions}</td><td>${i.loginCount} / ${i.runs}</td><td>${date(i.lastLogin)}</td><td>${(i.activeMs / 60000).toFixed(1)} min</td><td>${i.requests} requests<br>${Number(i.inputTokens).toLocaleString()} input tokens<br>${i.failures} failures</td><td>$${((i.inputTokens / 1e6) * inputRate).toFixed(4)}</td><td>${i.isGuest ? "Not applicable" : `<form method="post" action="/admin/reset-password"><input type="hidden" name="id" value="${esc(i.id)}"><button class="danger" aria-label="Reset password for ${esc(i.id)}">Reset password</button></form><small>Signs out this player</small>`}</td></tr>`).join("") || '<tr><td colspan="9">No players match this search.</td></tr>'}</tbody></table></div>${pager(players, "playerPage", "players")}</section>`;
  const loginSection = `<section id="logins"><h2>Recent successful logins</h2><form class="report-toolbar" method="get" action="/admin#logins">${hidden(["loginQ", "loginPage"])}<div><label for="login-search">Find logins</label><input type="search" id="login-search" name="loginQ" maxlength="80" value="${esc(o.loginSearch)}" placeholder="Invite ID, guest ID or display name"></div><button>Search logins</button><a href="${href({ loginQ: "", loginPage: "1" }, "logins")}">Clear</a></form><div class="scroll"><table><thead><tr><th>Invite / guest ID</th><th>Current display name</th><th>Signed in</th><th>Login state</th></tr></thead><tbody>${logins.rows.map((l) => `<tr><td>${esc(l.inviteId)}</td><td>${esc(l.displayName || "Not set")}</td><td>${date(l.created)}</td><td>${l.revoked ? "Revoked" : l.loggedOut ? "Signed out" : l.expires <= now ? "Expired" : "Within login lifetime"}</td></tr>`).join("") || '<tr><td colspan="4">No successful logins match this search.</td></tr>'}</tbody></table></div>${pager(logins, "loginPage", "logins")}</section>`;
  type Day = (typeof analytics.days)[number];
  const chart = (
    title: string,
    key: keyof Day,
    value: string,
    caption: string,
    format: (n: number) => string,
  ) => {
    const max = Math.max(0, ...analytics.days.map((d) => Number(d[key]))) || 1;
    const width = 440,
      left = 42,
      plot = 390,
      step = plot / analytics.days.length;
    return `<figure class="chart"><h3>${title}</h3><strong>${value}</strong><svg viewBox="0 0 ${width} 170" role="img" aria-label="${esc(title)} by UTC day; exact values in daily data below"><text x="0" y="22">${esc(format(max))}</text><text x="22" y="132">0</text><line x1="${left}" y1="130" x2="435" y2="130"/>${analytics.days
      .map((d, i) => {
        const h = (Number(d[key]) / max) * 105;
        return `<rect x="${left + i * step + 1}" y="${130 - h}" width="${Math.max(1, step - 2)}" height="${h}"><title>${d.day}: ${esc(format(Number(d[key])))}</title></rect>`;
      })
      .join(
        "",
      )}<text x="${left}" y="154">${analytics.days[0].day.slice(5)}</text><text x="435" y="154" text-anchor="end">${analytics.days.at(-1)!.day.slice(5)}</text></svg><figcaption>${caption}</figcaption></figure>`;
  };
  const activeDays = analytics.days.reduce((sum, d) => sum + d.activeUsers, 0);
  const activity = `<section id="activity"><h2>Activity report</h2><p class="muted report-intro">UTC days, including today so far. Counts represent browser or invite identities, not verified people. Charts cover all players, independently of the table searches.</p><form class="report-toolbar" method="get" action="/admin#activity">${hidden(["days"])}<div><label for="report-days">Report period</label><select id="report-days" name="days">${[7, 30, 90].map((d) => `<option value="${d}" ${d === o.days ? "selected" : ""}>Last ${d} days</option>`).join("")}</select></div><button>Update report</button><a href="/admin/report.csv?days=${o.days}">Download daily CSV</a></form><div class="charts">${chart("Daily active players", "activeUsers", String(analytics.uniqueActiveUsers), "Unique players in this period with measured play time.", (n) => String(n))}${chart("New players", "newUsers", String(analytics.newUsers), "First successful login, including guests and invites.", (n) => String(n))}${chart("Average daily play time", "averageMinutes", (activeDays ? analytics.activeMs / 60000 / activeDays : 0).toFixed(1) + " min", "Per active player per day, weighted across the period.", (n) => n.toFixed(1))}${chart("Estimated Jev spending", "costUsd", "$" + analytics.costUsd.toFixed(4), "Charged or reserved estimate, not a provider invoice.", (n) => "$" + n.toFixed(3))}</div><p class="muted">${analytics.runs} game starts · ${(analytics.activeMs / 3600000).toFixed(1)} hours of measured play. Games and their play time are assigned to their UTC start day, including games crossing midnight. Paused or hidden-tab time is excluded; this measures running-game time, not verified attention.</p><details class="daily-data"><summary>View daily data</summary><div class="scroll"><table><thead><tr><th>UTC day</th><th>Active players</th><th>New players</th><th>Game starts</th><th>Play minutes</th><th>Average minutes / active player</th><th>Est. Jev USD</th></tr></thead><tbody>${analytics.days.map((d) => `<tr><td>${d.day}</td><td>${d.activeUsers}</td><td>${d.newUsers}</td><td>${d.runs}</td><td>${(d.activeMs / 60000).toFixed(2)}</td><td>${d.averageMinutes.toFixed(2)}</td><td>${d.costUsd.toFixed(6)}</td></tr>`).join("")}</tbody></table></div></details></section>`;
  return {
    playerSection,
    loginSection,
    activity,
    totalPlayers: analytics.totalPlayers,
  };
}
export function reportCsv(store: Store, days: 7 | 30 | 90) {
  return (
    [
      "utc_day,active_players,new_players,game_starts,play_minutes,average_minutes_per_active_player,estimated_jev_usd",
      ...store
        .analytics(days)
        .days.map((d) =>
          [
            d.day,
            d.activeUsers,
            d.newUsers,
            d.runs,
            (d.activeMs / 60000).toFixed(4),
            d.averageMinutes.toFixed(4),
            d.costUsd.toFixed(6),
          ].join(","),
        ),
    ].join("\r\n") + "\r\n"
  );
}
