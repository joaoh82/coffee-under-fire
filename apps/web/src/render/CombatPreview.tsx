import { ProjectileGeometry } from "./ProjectileGeometry";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameAudio } from "../audio/GameAudio";
import { Driver } from "../game/driver";
import { envelope } from "../../../../packages/shared/contracts";
import { DT, Simulation, idleInput } from "../game/simulation";
import { SliceSoldier } from "./SliceAssets";
import { NpcCharacters } from "./NpcCharacters";
import { DodgeFeedback } from "./DodgeFeedback";
import { TankEffects } from "./TankEffects";
import { CombatFeedback } from "./CombatFeedback";
import { updateBulletInstances } from "./bulletInstances";
import { OutpostMap } from "./OutpostMap";

// Explicit offline art fixture: stationary targets, scripted human fire, no
// autonomous tactical choices or provider requests. Uses real shot collisions.
class FiringRange extends Simulation {
  override waves() {}
}
export function CombatPreview({
  weapons = false,
  movement = false,
  tank = false,
  audio,
  blast = 0,
}: {
  weapons?: boolean;
  movement?: boolean;
  tank?: boolean;
  audio?: GameAudio;
  blast?: number;
}) {
  const driver = useMemo(() => {
    const d = new Driver();
    d.sim = new FiringRange();
    d.sim.npcs = [];
    d.sim.player.pos = { x: movement ? -5.5 : 0, z: 4 };
    d.sim.player.previous = { ...d.sim.player.pos };
    d.sim.progressionEnabled = false;
    if (weapons) {
      d.sim.ranks.rockets = 1;
      d.sim.ranks.grenades = 1;
    }
    d.sim.start("mock", "offline-render-fixture", "endless");
    return d;
  }, [movement, tank, weapons]);
  const seenBlast = useRef(blast);
  const bullets = useRef<THREE.InstancedMesh>(null!);
  const temp = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    driver.accumulator = Math.min(driver.accumulator + delta, 0.1);
    while (driver.accumulator >= DT) {
      const s = driver.sim;
      if (
        !movement &&
        !tank &&
        s.tick % 240 === 0 &&
        !s.npcs.some((n) => n.hp > 0)
      )
        s.addNPC("rifleman", { x: 0, z: -3 });
      if (tank && s.tick % 720 === 0) {
        s.npcs = [];
        s.player.hp = 100;
        s.addNPC("tank", { x: 0, z: -3 });
      }
      if (tank && [0, 180, 360].includes(s.tick % 720)) {
        const actor = s.npcs[0];
        if (actor) {
          const request = s.request(actor);
          const selected = request.candidates.find(
            (c) => c.kind === (s.tick % 720 === 0 ? "move" : "cannon"),
          );
          if (selected)
            s.apply(request, {
              ...envelope(request),
              selected: selected.id,
              source: "mock",
              model: "scripted-tank-art-fixture",
              confidence: 0,
              latencyMs: 0,
              usage: null,
            });
        }
      }
      if (tank && seenBlast.current !== blast) {
        seenBlast.current = blast;
        if (s.npcs[0]?.hp > 0) s.damage(s.npcs[0], s.npcs[0].hp);
      }
      // Explicit destruction fixture, not an autonomous choice or production damage rule.
      if (tank && s.tick % 720 === 600 && s.npcs[0]?.hp > 0)
        s.damage(s.npcs[0], s.npcs[0].hp);
      const atCover = s.tick % 240 >= 120;
      s.step(
        tank
          ? {
              ...idleInput(),
              x: s.tick % 240 < 120 ? 1 : -1,
              aim: { x: 0, z: -3 },
            }
          : movement
            ? {
                ...idleInput(),
                x: s.tick % 240 < 120 ? 1 : -1,
                dodge: s.tick % 120 === 30,
                aim: { x: s.player.pos.x, z: -10 },
              }
            : {
                ...idleInput(),
                fire: true,
                reload: s.player.ammo === 0,
                aim: atCover ? { x: 7, z: 0 } : { x: 0, z: -3 },
              },
      );
      driver.accumulator -= DT;
    }
    audio?.update(driver.sim);
    updateBulletInstances(bullets.current, driver.sim.bullets, temp);
  }, -2);
  return (
    <>
      <OutpostMap />
      <SliceSoldier driver={driver} />
      <NpcCharacters driver={driver} />
      <CombatFeedback driver={driver} />
      <TankEffects driver={driver} />
      <DodgeFeedback driver={driver} />
      <instancedMesh ref={bullets} args={[undefined, undefined, 256]}>
        <ProjectileGeometry />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </>
  );
}
