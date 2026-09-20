import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Driver } from "../game/driver";
import { TankCharacter } from "./TankCharacter";
import { SliceSoldier } from "./SliceAssets";
import { syncNpcVisuals, type NpcVisual } from "./npcVisuals";

export function NpcCharacters({ driver }: { driver: Driver }) {
  const [visuals, setVisuals] = useState<NpcVisual[]>([]);
  const pool = useRef({ sim: driver.sim, visuals, generation: 0 });
  useFrame(() => {
    if (pool.current.sim !== driver.sim) {
      pool.current = {
        sim: driver.sim,
        visuals: [],
        generation: pool.current.generation + 1,
      };
    }
    const next = syncNpcVisuals(
      pool.current.visuals,
      driver.sim.npcs,
      driver.sim.tick,
    );
    if (next !== pool.current.visuals || next !== visuals) {
      pool.current.visuals = next;
      setVisuals(next);
    }
  }, -1);
  return visuals.map(({ actor }) =>
    actor.role === "tank" ? (
      <TankCharacter
        key={`${pool.current.generation}:${actor.id}`}
        driver={driver}
        actor={actor}
      />
    ) : (
      <SliceSoldier
        key={`${pool.current.generation}:${actor.id}`}
        driver={driver}
        actor={actor}
      />
    ),
  );
}
