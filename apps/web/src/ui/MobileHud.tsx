import type { Driver } from "../game/driver";
import { distance } from "../game/arena";
export function MobileHud({ driver, time }: { driver: Driver; time: string }) {
  const s = driver.sim;
  const carrying = s.cup && s.cup.volume >= 25 && s.cup.warmth >= 20;
  const target = carrying ? s.tent : s.arena.kitchen;
  const bearing =
    (Math.atan2(target.x - s.player.pos.x, -(target.z - s.player.pos.z)) *
      180) /
    Math.PI;
  return (
    <div className="mobile-hud" aria-label="Mission status">
      <div className="mobile-status">
        <div>
          <b>♥ {s.player.hp}</b>
          <meter aria-label="Player health" value={s.player.hp} max={100} />
        </div>
        <span aria-label="Ammunition">
          {s.player.reloadUntil > s.tick
            ? "Reload…"
            : `${s.player.ammo}/${s.magazineSize}`}
          <small>ammo</small>
        </span>
        <span>
          {time}
          <small>Wave {s.wave + 1}</small>
        </span>
        <button
          disabled={s.status !== "running"}
          onClick={() => driver.pause()}
          aria-label="Pause and settings"
        >
          ☰
        </button>
      </div>
      <div className="mobile-errand">
        <span
          aria-label="Direction to coffee objective"
          style={{
            display: "inline-block",
            transform: `rotate(${bearing}deg)`,
          }}
        >
          ↑
        </span>
        <span>
          ☕ {s.deliveries}
          {s.missionMode === "mission" ? "/5" : ""}
        </span>
        <button
          onClick={() => driver.pause()}
          aria-label="Open objective map and settings"
        >
          {carrying ? "Tent" : "Coffee"} ·{" "}
          {Math.ceil(distance(s.player.pos, target))} m ↗
        </button>
        <span>Lv {s.level}</span>
      </div>
      {s.interaction > 0 && (
        <progress
          aria-label="Coffee interaction"
          value={s.interaction}
          max={36}
        />
      )}
    </div>
  );
}
