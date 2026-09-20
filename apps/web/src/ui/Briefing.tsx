import { SupportCallout } from "./SupportCallout";
import { MAPS, type MapId } from "../game/maps";
import { DIFFICULTIES, type Difficulty } from "../game/difficulty";
import type { MissionMode } from "../game/simulation";
export const GAME_LOGO = "/assets/brand/coffee-under-fire-logo-v1.png";

function ModeArt({ endless = false }: { endless?: boolean }) {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true" focusable="false">
      <path
        d="M8 63 40 43 78 49 116 32 170 57 142 84 88 78 47 88Z"
        fill="#69744c"
      />
      <path
        d="m14 68 38-13 36 13 42-25 31 17"
        fill="none"
        stroke="#c5b888"
        strokeWidth="8"
      />
      <path d="m90 57 24-34 31 35-29 12Z" fill="#b9ac72" />
      <path d="m114 23 2 47 29-12Z" fill="#7d8250" />
      <path d="m109 48 7-11 8 26-8 7-7-3Z" fill="#293d2c" />
      <path
        d="m30 49 9-23 10 23Z m119-12 8-23 11 23Z m18 13 7-19 10 19Z"
        fill="#354d35"
      />
      <path d="M34 64h15v13H34z" fill="#e8deb7" />
      <path d="M49 66h5v7h-5" fill="none" stroke="#e8deb7" strokeWidth="3" />
      <path d="m39 59 2-5-3-4" fill="none" stroke="#e8deb7" strokeWidth="2" />
      {endless ? (
        <g
          fill="none"
          stroke="#ebc563"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M65 25c-21-27-45 7-25 16 15 7 25-23 38-23 20 0 17 31 0 28-8-2-12-9-17-15" />
          <path d="m73 37 5 9 8-5" />
        </g>
      ) : (
        <g stroke="#293d2c" strokeWidth="3">
          <path d="M61 8v7m-5-7h10" />
          <circle cx="61" cy="32" r="20" fill="#ebc563" />
          <circle cx="61" cy="32" r="15" fill="#f0e5bf" stroke="none" />
          <path d="M61 21v11l9 5" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
export function Briefing({
  mapId,
  setMapId,
  difficulty,
  setDifficulty,
  musicEnabled,
  onMusicToggle,
  onShowDecisions,
  mode,
  setMode,
  loading,
  error,
  start,
}: {
  mapId: MapId;
  setMapId: (id: MapId) => void;
  difficulty: Difficulty;
  setDifficulty: (value: Difficulty) => void;
  musicEnabled: boolean;
  onMusicToggle: () => void;
  onShowDecisions: () => void;
  mode: MissionMode;
  setMode: (mode: MissionMode) => void;
  loading: boolean;
  error: string;
  start: () => void;
}) {
  return (
    <section className="brief field-brief" aria-labelledby="briefing-title">
      <header className="brief-heading">
        <img
          className="brief-logo"
          src={GAME_LOGO}
          alt="Coffee Under Fire"
          width="1774"
          height="887"
        />
        <h1 id="briefing-title">Hold the line. Keep the coffee coming.</h1>
      </header>
      <aside className="jev-callout" aria-label="NPCs powered by Jev">
        <span className="jev-insignia" aria-hidden="true">
          Jev
        </span>
        <div>
          <strong>NPCs powered by Jev</strong>
          <p>
            A playable AI proof of concept. TypeSafe AI’s Jev model chooses the
            tactics for every NPC—from infantry and tanks to the general. The
            game handles movement, aiming and combat.
          </p>
          <button onClick={onShowDecisions}>See the decision dashboard</button>
        </div>
      </aside>
      <div className="brief-choices">
        <fieldset className="mode-cards">
          <legend>Choose your operation</legend>
          {(["mission", "endless"] as const).map((value) => (
            <label className="mode-card" key={value}>
              <input
                type="radio"
                name="mission-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              <span className="mode-card-body">
                <ModeArt endless={value === "endless"} />
                <strong>
                  {value === "mission" ? "Coffee run" : "Endless survival"}
                </strong>
                <span>
                  {value === "mission"
                    ? "8 minutes · 5 hot deliveries"
                    : "Keep fighting. Beat your score."}
                </span>
                <span className="mode-check" aria-hidden="true">
                  {mode === value ? "✓" : ""}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="map-options">
          <legend>Choose your battlefield</legend>
          {(Object.keys(MAPS) as MapId[]).map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="battlefield"
                checked={mapId === id}
                onChange={() => setMapId(id)}
              />
              <span className="map-option-body">
                <svg viewBox="-23 -19 46 38" aria-hidden="true">
                  <rect
                    x="-23"
                    y="-19"
                    width="46"
                    height="38"
                    rx="2"
                    fill={id === "village.v1" ? "#827a69" : "#667154"}
                  />
                  <path
                    d={
                      id === "village.v1"
                        ? "M-22 -2H22M-3 -18V18M-22 12H22"
                        : "M-22 5H22M15 -18V18"
                    }
                    stroke="#b3a17c"
                    strokeWidth="3"
                    fill="none"
                  />
                  {MAPS[id].layout.obstacles.map((o) => (
                    <g key={o.id}>
                      <rect
                        x={o.x - o.w / 2 + 0.5}
                        y={o.z - o.d / 2 + 0.7}
                        width={o.w}
                        height={o.d}
                        fill="#32362e"
                      />
                      <rect
                        x={o.x - o.w / 2}
                        y={o.z - o.d / 2}
                        width={o.w}
                        height={o.d}
                        fill={id === "village.v1" ? "#c2b89e" : "#99a07a"}
                      />
                    </g>
                  ))}
                  <circle cx="-17" cy="12" r="1.6" fill="#edcd71" />
                </svg>
                <span>
                  <strong>{MAPS[id].label}</strong>
                  <small>{MAPS[id].description}</small>
                </span>
                <b aria-hidden="true">{mapId === id ? "✓" : ""}</b>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="difficulty-options">
          <legend>Difficulty</legend>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((value, i) => (
            <label key={value}>
              <input
                type="radio"
                name="difficulty"
                checked={difficulty === value}
                onChange={() => setDifficulty(value)}
              />
              <span>
                <b>
                  <i aria-hidden="true">{"❯".repeat(i + 1)}</i>
                  {DIFFICULTIES[value].label}
                </b>
                <small>{DIFFICULTIES[value].description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="tank-wave-note">
          Tanks can arrive at wave 4—around three minutes in. Waves advance with
          time, independently of your XP level.
        </p>
      </div>
      <div className="brief-launch">
        <div className="field-orders">
          <p>
            <b>Fill at C.</b> Hold E at the kitchen.
          </p>
          <p>
            <b>Deliver at T.</b> Hot coffee restores 20 health.
          </p>
          <p>
            <b>Gear up.</b> Collect gems to pick upgrades.
          </p>
        </div>
        <button
          className="primary deploy-button"
          disabled={loading}
          onClick={start}
        >
          {loading
            ? "Connecting to Jev…"
            : mode === "mission"
              ? "Begin coffee run"
              : "Begin endless survival"}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <SupportCallout />
        <button
          className="brief-music"
          aria-pressed={musicEnabled}
          onClick={onMusicToggle}
        >
          ♫ Music: {musicEnabled ? "on" : "off"}
          <span>Plays when your run begins</span>
        </button>
        <details className="field-manual">
          <summary>Controls & field notes</summary>
          <p>
            WASD to move, mouse to aim and fire, Space to dodge, R to reload, E
            to fill or deliver coffee. Touch controls are available. Auto-fire
            and auto-reload can be toggled in the game.
          </p>
          <p>
            Running won’t spill coffee; hits and dodges might. The first patrol
            arrives after six seconds. From wave 4, watch for tanks and dodge
            their orange aiming line.
          </p>
          <p>
            Live Jev controls the NPCs. Service interruptions pause the
            battlefield while reconnecting. Prototype session limits apply;
            replay records the first 30 minutes.
          </p>
        </details>
        {import.meta.env.PROD && (
          <form action="/access/logout" method="post">
            <button className="brief-signout">Sign out of playtest</button>
          </form>
        )}
      </div>
    </section>
  );
}
