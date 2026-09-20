import { ReportCommunity } from "./ReportCommunity";
import { reportPoints } from "../../../../packages/shared/leaderboard";
import { SupportCallout } from "./SupportCallout";
import { MAPS, type MapId } from "../game/maps";
import { DIFFICULTIES, type Difficulty } from "../game/difficulty";
import type { MissionMode } from "../game/simulation";
import { GAME_LOGO } from "./Briefing";

export type ReportData = {
  mapId?: MapId;
  difficulty?: Difficulty;
  won: boolean;
  reason: string;
  missionMode: MissionMode;
  deliveries: number;
  kills: number;
  time: number;
  score: number;
  level: number;
};
function ReportEmblem({ won }: { won: boolean }) {
  return (
    <svg
      className="report-emblem"
      viewBox="0 0 220 180"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="m39 123-12 41 38-12 19 17 11-44m34 0 13 44 19-17 38 12-13-41"
        fill={won ? "#b77e35" : "#717958"}
      />
      <path
        d="m110 7 24 12 27-1 12 23 24 13-2 28 12 24-18 20-7 27-28 5-23 16-23-13-28 1-13-23-24-13 2-28-12-24 18-20 7-27 28-5Z"
        fill="#344b35"
      />
      <circle cx="110" cy="90" r="67" fill={won ? "#e9bc5c" : "#b7b88b"} />
      <circle
        cx="110"
        cy="90"
        r="58"
        fill="none"
        stroke={won ? "#f9df99" : "#d7d6ad"}
        strokeWidth="3"
        strokeDasharray="4 5"
      />
      <ellipse cx="111" cy="130" rx="40" ry="8" fill="#344b35" opacity=".2" />
      <g transform={won ? "translate(0 0)" : "rotate(23 110 99)"}>
        <path
          d="M139 76h17q16 0 16 17t-20 19h-13"
          fill="none"
          stroke="#344b35"
          strokeWidth="12"
        />
        <path d="M75 71h68l-5 52q-29 16-59-1Z" fill="#435b38" />
        <path d="m80 81 8 37 15 4-3-41Z" fill="#748159" />
        <ellipse cx="109" cy="72" rx="34" ry="10" fill="#f3e6bb" />
        <ellipse cx="109" cy="73" rx="26" ry="6" fill="#69472c" />
        <path
          d="m110 87 4 8 9 1-7 6 2 10-8-5-8 5 2-10-7-6 9-1Z"
          fill="#e9bc5c"
        />
        {!won && (
          <path
            d="m117 71 13-10 3-14 6 10-4 18 15 15-4 5-18-15-20-3Z"
            fill="#69472c"
          />
        )}
      </g>
      {won ? (
        <g fill="none" stroke="#fff4d3" strokeWidth="5" strokeLinecap="round">
          <path d="m99 56-4-10 6-9-2-8m18 25 4-9-5-8 3-10" />
        </g>
      ) : (
        <path d="M147 134q11-10 30-3l-2 5-28 4-18-4Z" fill="#69472c" />
      )}
      {won && (
        <path d="m174 22 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#e9bc5c" />
      )}
    </svg>
  );
}
function StatIcon({ kind }: { kind: "coffee" | "combat" | "time" | "level" }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      {kind === "coffee" && (
        <>
          <path d="M8 12h21l-2 19q-9 6-17 0Z" fill="#708150" />
          <path
            d="M29 15h4q6 9-5 10M16 8l-2-4m8 4 2-5"
            fill="none"
            stroke="#43543b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="18" cy="12" rx="10" ry="3" fill="#a87944" />
        </>
      )}
      {kind === "combat" && (
        <g fill="none" stroke="#935531" strokeWidth="3">
          <circle cx="20" cy="20" r="12" />
          <path d="M20 2v10m0 16v10M2 20h10m16 0h10" />
          <circle cx="20" cy="20" r="3" fill="#935531" stroke="none" />
        </g>
      )}
      {kind === "time" && (
        <>
          <path d="M16 3h8m-4 0v5" stroke="#43543b" strokeWidth="3" />
          <circle cx="20" cy="23" r="14" fill="#d5aa53" />
          <path
            d="M20 13v10l7 4"
            fill="none"
            stroke="#43543b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === "level" && (
        <>
          <path d="m20 3 15 13-15 21L5 16Z" fill="#4aa99c" />
          <path d="m20 3-5 13 5 21 5-21Z" fill="#8ed6c1" />
          <path d="M5 16h30" stroke="#28695f" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
export function MissionReport({
  data,
  onRestart,
  onSave,
  onSubmitScore,
}: {
  data: ReportData;
  onRestart: () => void;
  onSave?: () => void;
  onSubmitScore?: (name: string) => Promise<unknown>;
}) {
  const seconds = Math.floor(data.time);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const stats = [
    {
      kind: "coffee" as const,
      value: data.deliveries,
      label: "Hot deliveries",
    },
    { kind: "combat" as const, value: data.kills, label: "Enemies defeated" },
    { kind: "time" as const, value: elapsed, label: "Time survived" },
    { kind: "level" as const, value: data.level, label: "Level reached" },
  ];
  return (
    <section
      className={`brief mission-report ${data.won ? "report-won" : "report-lost"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      aria-describedby="report-reason"
    >
      <header className="report-header">
        <img src={GAME_LOGO} alt="Coffee Under Fire" />
        <span>
          {data.missionMode === "endless"
            ? "Endless survival"
            : "Eight-minute mission"}
          <b>
            {DIFFICULTIES[data.difficulty ?? "normal.v1"].label} ·{" "}
            {MAPS[data.mapId ?? "woodland.v1"].label}
          </b>
        </span>
      </header>
      <div className="report-result">
        <ReportEmblem won={data.won} />
        <div>
          <span className="report-outcome">
            {data.won ? "Mission accomplished" : "Mission ended"}
          </span>
          <h1 id="report-title">
            {data.won ? "The outpost holds!" : "Every cup counted."}
          </h1>
          <p id="report-reason">{data.reason}</p>
          <div className="report-score">
            <strong>{reportPoints(data).toLocaleString("en-US")}</strong>
            <span>points earned</span>
          </div>
        </div>
      </div>
      <dl className="report-stats">
        {stats.map((stat) => (
          <div key={stat.kind}>
            <StatIcon kind={stat.kind} />
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="report-actions">
        <button className="primary" onClick={onRestart}>
          Another coffee run
        </button>
        <button className="report-save" disabled={!onSave} onClick={onSave}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Save decision replay
        </button>
      </div>
      <p className="report-footnote">
        A fresh run. A fresh cup. Upgrades reset each mission.
      </p>
      <ReportCommunity
        data={data}
        options={{
          mapId: data.mapId ?? "woodland.v1",
          difficulty: data.difficulty ?? "normal.v1",
          missionMode: data.missionMode,
        }}
        onSubmit={onSubmitScore}
      />
      <SupportCallout />
    </section>
  );
}
