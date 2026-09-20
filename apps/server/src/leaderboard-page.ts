import { ICON_HEAD } from "../../../packages/shared/site-meta";
import type {
  BoardEntry,
  BoardOptions,
} from "../../../packages/shared/leaderboard";
const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function leaderboardPage(options: BoardOptions, entries: BoardEntry[]) {
  const select = (name: string, values: Record<string, string>) =>
    `<select name="${name}" aria-label="${name}">${Object.entries(values)
      .map(
        ([key, label]) =>
          `<option value="${key}" ${options[name as keyof BoardOptions] === key ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coffee Under Fire · Leaderboard</title>${ICON_HEAD}<style>body{background:#252f29;color:#ede5cc;font:16px/1.5 system-ui;margin:0;padding:24px}main{max-width:900px;margin:auto}h1{font-size:40px}a{color:#deb879}select,button{font:inherit;padding:10px;margin:5px;border-radius:6px}table{border-collapse:collapse;width:100%;margin-top:20px}td,th{text-align:left;padding:12px;border-bottom:1px solid #61715b}.scroll{overflow:auto}small{color:#c1c9b4}</style><main><a href="/">← Play Coffee Under Fire</a><h1>Field honours</h1><p>Community leaderboard · Best score per nickname, for this map, difficulty and mode.</p><small>Scores are reported by players’ browsers, with basic session checks. They are not anti-cheat verified. Names are nicknames, not verified identities.</small><form method="get">${select("mapId", { "woodland.v1": "Little Outpost", "village.v1": "Ruined Village" })}${select("difficulty", { "easy.v1": "Easy", "normal.v1": "Normal", "hard.v1": "Hard" })}${select("missionMode", { mission: "Eight-minute mission", endless: "Endless survival" })}<button>Show scores</button></form><div class="scroll"><table><thead><tr><th>Rank</th><th>Player</th><th>Points</th><th>Time</th><th>Coffee</th></tr></thead><tbody>${entries.map((e, i) => `<tr><td>${i + 1}</td><td>${escape(e.name)}</td><td>${e.score.toLocaleString("en-US")}</td><td>${Math.floor(e.time / 60)}:${String(Math.floor(e.time % 60)).padStart(2, "0")}</td><td>${e.deliveries}</td></tr>`).join("") || '<tr><td colspan="5">No scores yet. Finish a run and add yours!</td></tr>'}</tbody></table></div></main></html>`;
}
