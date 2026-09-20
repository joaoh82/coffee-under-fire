import type { Simulation } from "../game/simulation";
import { distance } from "../game/arena";
export function MissionMap({ sim }: { sim: Simulation }) {
  const carrying = sim.cup && sim.cup.volume >= 25 && sim.cup.warmth >= 20;
  const target = carrying ? sim.tent : sim.arena.kitchen;
  return (
    <aside
      className="mission-map"
      aria-label="Outpost map and coffee destination"
    >
      <svg
        viewBox="-23 -19 46 38"
        role="img"
        aria-label="Map: blue dot is you, C is coffee kitchen, T is the general's tent"
      >
        <rect
          x={-22}
          y={-18}
          width={44}
          height={36}
          fill={sim.mapId === "village.v1" ? "#827a69" : "#829572"}
          stroke="#4a5943"
          strokeWidth={0.4}
        />
        {sim.arena.obstacles.map((o) => (
          <rect
            key={o.id}
            x={o.x - o.w / 2}
            y={o.z - o.d / 2}
            width={o.w}
            height={o.d}
            fill="#465341"
          />
        ))}
        <line
          x1={sim.player.pos.x}
          y1={sim.player.pos.z}
          x2={target.x}
          y2={target.z}
          stroke="#ffe9a1"
          strokeWidth={0.4}
          strokeDasharray="1 1"
        />
        {[
          { ...sim.arena.kitchen, label: "C" },
          { ...sim.tent, label: "T" },
        ].map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.z} r={2.5} fill="#f5e9bb" />
            <text
              x={p.x}
              y={p.z + 1}
              textAnchor="middle"
              fontSize={3.1}
              fontWeight="bold"
              fill="#273329"
            >
              {p.label}
            </text>
          </g>
        ))}
        <circle
          cx={sim.player.pos.x}
          cy={sim.player.pos.z}
          r={1.2}
          fill="#4cdbef"
          stroke="#183e43"
          strokeWidth={0.4}
        />
      </svg>
      <b>{carrying ? "T · Deliver coffee" : "C · Get fresh coffee"}</b>
      <small>
        {Math.ceil(distance(sim.player.pos, target))} m · Blue dot: you
      </small>
    </aside>
  );
}
