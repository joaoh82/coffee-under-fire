import { AccessBudgetNotice } from "./ui/AccessBudgetNotice";
import { MAPS, type MapId } from "./game/maps";
import { DIFFICULTIES, type Difficulty } from "./game/difficulty";
// @refresh reset
import { useEffect, useRef, useState } from "react";
import { MissionReport } from "./ui/MissionReport";
import { Briefing, GAME_LOGO } from "./ui/Briefing";
import { GameMusic } from "./audio/GameMusic";
import { GameAudio } from "./audio/GameAudio";
import { UPGRADES } from "./game/upgrades";
import { idleInput } from "./game/simulation";
import { Driver } from "./game/driver";
import { MissionMap } from "./ui/MissionMap";
import { World } from "./render/World";
import { distance } from "./game/arena";
import "./style.css";
import { CommandDashboard } from "./ui/CommandDashboard";
import { TouchControls } from "./ui/TouchControls";
import { FIRST_SPAWN_SECONDS, type MissionMode } from "./game/simulation";
export default function App() {
  const [driver, setDriver] = useState(() => new Driver());
  const musicStarting = useRef(false);
  const [music] = useState(() => new GameMusic());
  useEffect(() => () => music.dispose(), [music]);
  const [audio] = useState(() => new GameAudio());
  useEffect(() => () => audio.dispose(), [audio]);
  const [, refresh] = useState(0);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(
    new URLSearchParams(location.search).has("demo"),
  );
  const [mapId, setMapId] = useState<MapId>("woodland.v1");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy.v1");
  const [missionMode, setMissionMode] = useState<MissionMode>("mission");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => refresh((n) => n + 1), 100);
    let audioFrame = 0;
    const updateAudio = () => {
      audio.update(driver.sim);
      music.setActive(
        !document.hidden &&
          !driver.recovering &&
          (musicStarting.current ||
            ["running", "upgrading"].includes(driver.sim.status)),
      );
      audioFrame = requestAnimationFrame(updateAudio);
    };
    audioFrame = requestAnimationFrame(updateAudio);
    const keys = new Set<string>();
    function sync() {
      driver.input.x = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
      driver.input.z = Number(keys.has("KeyS")) - Number(keys.has("KeyW"));
      driver.input.interact = keys.has("KeyE");
      driver.input.reload = keys.has("KeyR");
      driver.input.dodge = keys.has("Space");
    }
    const down = (e: KeyboardEvent) => {
      // Native controls retain Space/arrow-key behavior, including mode radios.
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, select, textarea, button, summary, a")
      )
        return;
      if (
        [
          "Space",
          "Escape",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyE",
          "KeyR",
        ].includes(e.code)
      )
        e.preventDefault();
      keys.add(e.code);
      sync();
      if (e.code === "Escape" && !e.repeat) {
        if (driver.sim.status === "running") driver.pause();
        else if (driver.sim.status === "paused") void driver.resume();
      }
      if (e.code === "Backquote") setDebug((v) => !v);
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      sync();
    };
    const mouseDown = (e: MouseEvent) => {
      if (e.button === 0 && e.target instanceof HTMLCanvasElement)
        driver.input.fire = true;
    };
    const mouseUp = () => {
      driver.input.fire = false;
    };
    const blur = () => {
      musicStarting.current = false;
      music.setActive(false);
      keys.clear();
      sync();
      driver.input.fire = false;
      driver.pause();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(audioFrame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mouseup", mouseUp);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      void driver.dispose();
    };
  }, [driver, audio, music]);
  const s = driver.sim;
  const seconds =
    s.missionMode === "endless"
      ? Math.floor(s.time)
      : Math.max(0, 480 - Math.floor(s.time));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  async function start() {
    musicStarting.current = true;
    void audio.unlock();
    void music.unlock();
    setLoading(true);
    setError("");
    try {
      await driver.start("strict", missionMode, difficulty, mapId);
    } catch (e) {
      setError(String(e));
    } finally {
      musicStarting.current = false;
      setLoading(false);
    }
  }
  const restart = () => {
    const next = new Driver();
    next.autoReload = driver.autoReload;
    next.autoFire = driver.autoFire;
    setDriver(next);
    setError("");
  };
  const save = () => {
    const blob = new Blob([JSON.stringify(s.recording)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coffee-replay.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const coffeeNotice = s.coffeeFeedback.at(-1);
  const usableCup = s.cup && s.cup.volume >= 25 && s.cup.warmth >= 20;
  const prompt =
    distance(s.player.pos, s.arena.kitchen) < 2
      ? s.cup
        ? "Fresh coffee ready — take it to T on the map"
        : "Hold E (or Coffee) for 0.6s to fill your cup"
      : distance(s.player.pos, s.tent) < 2 && usableCup
        ? "Hold E (or Coffee) for 0.6s to deliver"
        : usableCup
          ? "Carry your coffee to T on the map"
          : s.cup
            ? "Coffee is cold or too low — refill at C"
            : "Pick up coffee at C on the map";
  return (
    <main className={debug ? "command-open" : ""}>
      {driver.accessBlock && (
        <AccessBudgetNotice
          block={driver.accessBlock}
          score={Math.floor(s.score)}
          onLeave={restart}
          onSave={save}
        />
      )}
      <section className="battlefield">
        <World driver={driver} />
        <div
          className="fps-counter"
          title="Rendered frames per second and average frame interval over the last half-second"
          aria-label="Rendering performance"
        >
          {driver.renderStats
            ? `${driver.renderStats.fps} FPS · ${driver.renderStats.frameMs.toFixed(1)} ms`
            : "FPS · measuring…"}
        </div>
        <MissionMap sim={s} />
        <header className="top">
          <div className="wordmark">
            <img src={GAME_LOGO} alt="Coffee Under Fire" />
          </div>
          <div className="mission">
            <span>
              {s.missionMode === "endless"
                ? "Endless survival"
                : MAPS[s.mapId].label}{" "}
              ·{" "}
              {
                DIFFICULTIES[s.status === "ready" ? difficulty : s.difficulty]
                  .label
              }
            </span>
            <strong>{time}</strong>
            <span>
              Wave {s.wave + 1}
              {s.missionMode === "mission" ? " of 8" : ""}
            </span>
          </div>
          <div className="header-actions">
            <button
              aria-pressed={audio.enabled}
              onClick={() => {
                audio.toggle();
                refresh((n) => n + 1);
              }}
            >
              Effects: {audio.enabled ? "on" : "off"}
            </button>
            <button
              aria-pressed={music.enabled}
              title={music.error || "Background music"}
              onClick={() => {
                music.toggle();
                refresh((n) => n + 1);
              }}
            >
              Music: {music.enabled ? "on" : "off"}
            </button>
            <button onClick={() => setDebug((v) => !v)} aria-pressed={debug}>
              Jev dashboard
            </button>
            <button
              className="pause"
              disabled={s.status === "upgrading"}
              onClick={() =>
                s.status === "running" ? driver.pause() : void driver.resume()
              }
            >
              Pause / Esc
            </button>
          </div>
        </header>
        {s.mode === "mock" && (
          <div className="mode-banner">
            Development mock — NPC choices are fixtures, not Jev
          </div>
        )}
        <div className="objective">
          <span className="cup-icon">☕</span>
          <div>
            <b>
              {s.deliveries}
              {s.missionMode === "mission" ? " / 5" : ""} deliveries
            </b>
            <span>
              General’s tent: {s.tent.z < 0 ? "north" : "south"}
              {s.tent.x > 0 ? "east" : ""}
            </span>
            <strong className="run-score">
              Score {Math.floor(s.score).toLocaleString()} · Level {s.level}
            </strong>
            <label className="xp-meter">
              XP {s.xp} / {s.xpNeeded}
              <progress value={s.xp} max={s.xpNeeded} />
            </label>
          </div>
        </div>
        {s.status === "running" && s.time < FIRST_SPAWN_SECONDS + 1 && (
          <div className="arrival-notice">
            Fill your cup · First patrol in{" "}
            {Math.max(0, Math.ceil(FIRST_SPAWN_SECONDS + 1 - s.time))}s
          </div>
        )}
        <footer>
          <div className="vitals">
            <button
              className="weapon-toggle"
              aria-pressed={driver.autoFire}
              title="Fire continuously toward your mouse or touch aim"
              onClick={() => {
                driver.autoFire = !driver.autoFire;
                refresh((n) => n + 1);
              }}
            >
              Auto-fire: {driver.autoFire ? "on" : "off"}
            </button>
            <label>
              Health <b>{s.player.hp}</b>
            </label>
            <meter value={s.player.hp} max={100} />
            <label>
              Ammo{" "}
              <b>
                {s.player.reloadUntil > s.tick
                  ? "Reloading…"
                  : `${s.player.ammo} / 12`}
              </b>
            </label>
            <button
              className="weapon-toggle"
              aria-pressed={driver.autoReload}
              onClick={() => {
                driver.autoReload = !driver.autoReload;
                refresh((n) => n + 1);
              }}
            >
              Auto-reload: {driver.autoReload ? "on" : "off"}
            </button>
          </div>
          <div className="coffee">
            <b>{s.cup ? "☕ Carrying coffee" : "☕ Your coffee errand"}</b>
            <p>{prompt}</p>
            {s.cup && (
              <div className="cup-values">
                <label>
                  Fullness {Math.round(s.cup.volume)}%
                  <meter value={s.cup.volume} max={100} />
                </label>
                <label>
                  Warmth {Math.round(s.cup.warmth)}%
                  <meter value={s.cup.warmth} max={100} />
                </label>
              </div>
            )}
            {coffeeNotice && s.tick - coffeeNotice.born < 120 && (
              <p className={`coffee-notice ${coffeeNotice.kind}`} role="status">
                {coffeeNotice.kind === "delivery"
                  ? `Delivered! +${Math.round(coffeeNotice.score)} score${coffeeNotice.amount > 0 ? ` · +${coffeeNotice.amount} health` : ""}`
                  : coffeeNotice.kind === "spill"
                    ? `Small spill · −${coffeeNotice.amount}% coffee`
                    : "Fresh coffee ready! Take it to the general."}
              </p>
            )}
            {s.interaction > 0 && (
              <label className="coffee-progress">
                {s.interactionAt === "kitchen"
                  ? "Filling your mug…"
                  : "Handing over coffee…"}
                <progress
                  aria-label={
                    s.interactionAt === "kitchen"
                      ? "Filling coffee"
                      : "Delivering coffee"
                  }
                  value={s.interaction}
                  max={36}
                />
              </label>
            )}
          </div>
          <div className="controls">
            WASD move · Mouse aim / fire
            <br />E interact · R reload · Space dodge
            <br />
            <button onClick={() => setDebug(!debug)}>Jev dashboard</button>
          </div>
        </footer>
        <TouchControls driver={driver} />
        {s.status === "ready" && (
          <div className="overlay">
            <Briefing
              mapId={mapId}
              setMapId={setMapId}
              musicEnabled={music.enabled}
              onMusicToggle={() => {
                music.toggle();
                refresh((n) => n + 1);
              }}
              onShowDecisions={() => setDebug(true)}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              mode={missionMode}
              setMode={setMissionMode}
              loading={loading}
              error={error}
              start={() => void start()}
            />
          </div>
        )}
        {s.status === "upgrading" && (
          <div className="overlay">
            <section
              className="brief upgrade-brief"
              aria-label="Choose a run upgrade"
            >
              <span className="stamp">Level {s.level + 1}</span>
              <h1>A little more firepower.</h1>
              <p>
                Choose one upgrade for this run. The battlefield and coffee are
                paused.
              </p>
              <div className="upgrade-options">
                {s.upgradeChoices.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      driver.input = idleInput();
                      if (s.chooseUpgrade(key)) refresh((n) => n + 1);
                    }}
                  >
                    <b>{UPGRADES[key].name}</b>
                    <span>{UPGRADES[key].description}</span>
                    {key !== "heal" && (
                      <small>
                        Rank {s.ranks[key] + 1} / {UPGRADES[key].cap}
                      </small>
                    )}
                  </button>
                ))}
              </div>
              <small>Upgrades reset when you start a new run.</small>
            </section>
          </div>
        )}
        {(driver.automaticRecoveryPending || driver.recovering) &&
          s.status !== "paused" && (
            <div className="reconnect-notice" role="status" aria-live="polite">
              <span className="radio-symbol" aria-hidden="true">
                ⌁
              </span>
              <div>
                <strong>Reconnecting to Jev…</strong>
                <span>
                  Battlefield paused. Resuming automatically when decisions
                  arrive.
                </span>
              </div>
              <button onClick={restart}>Quit</button>
            </div>
          )}
        {(s.status === "paused" ||
          (s.status === "reconnecting" &&
            !driver.automaticRecoveryPending &&
            !driver.recovering)) && (
          <div className="overlay">
            <section className="brief compact">
              <h1>
                {s.status === "paused"
                  ? "A little breather."
                  : "Jev connection interrupted"}
              </h1>
              <p>
                {s.status === "paused"
                  ? "The battlefield and your coffee are paused."
                  : "We couldn’t get fresh NPC decisions. The battlefield is safely paused. Retry the connection to continue your run."}
              </p>
              {driver.errors.size > 0 && (
                <details className="field-manual">
                  <summary>Connection details</summary>
                  <p>{[...new Set(driver.errors.values())].join(", ")}</p>
                </details>
              )}
              <button
                className="primary"
                disabled={driver.recovering || driver.retryWaitSeconds > 0}
                onClick={() => void driver.retry()}
              >
                {driver.retryWaitSeconds > 0
                  ? `Retry in ${driver.retryWaitSeconds}s`
                  : s.status === "paused"
                    ? "Resume mission"
                    : "Retry Jev connection"}
              </button>
              <button onClick={restart}>Quit to briefing</button>
            </section>
          </div>
        )}
        {(s.status === "won" || s.status === "lost") && (
          <div className="overlay">
            <MissionReport
              data={{
                mapId: s.mapId,
                won: s.status === "won",
                reason: s.reason,
                difficulty: s.difficulty,
                missionMode: s.missionMode,
                deliveries: s.deliveries,
                kills: s.kills,
                time: s.time,
                score: s.score,
                level: s.level,
              }}
              onRestart={restart}
              onSave={save}
              onSubmitScore={s.recording.mode === "strict" ? (name) => driver.submitScore(name) : undefined}
            />
          </div>
        )}
      </section>
      {debug && (
        <CommandDashboard
          driver={driver}
          onClose={() => {
            setDebug(false);
            driver.inspectedNpcId = null;
          }}
          onExport={save}
        />
      )}
    </main>
  );
}
