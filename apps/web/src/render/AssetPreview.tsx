import { MAPS, type MapId } from "../game/maps";
import { Suspense, useEffect, useMemo, useState } from "react";
import { GameAudio } from "../audio/GameAudio";
import { FrameCounter } from "./FrameCounter";
import { CombatPreview } from "./CombatPreview";
import { Canvas } from "@react-three/fiber";
import { infantryAppearance } from "./infantryAppearance";
import { OutpostMap } from "./OutpostMap";

import { Driver } from "../game/driver";
import { SliceSoldier, SliceProp } from "./SliceAssets";
export function AssetPreview() {
  const [mapId, setMapId] = useState<MapId>("woodland.v1");
  const arena = MAPS[mapId].layout;
  const audio = useMemo(() => {
    const a = new GameAudio();
    a.enabled = false;
    return a;
  }, []);
  const [blast, setBlast] = useState(0);
  const [sound, setSound] = useState(false);
  useEffect(() => () => audio.dispose(), [audio]);
  const [character, setCharacter] = useState<
    "soldier" | "rifleman" | "general"
  >("soldier");
  const [clip, setClip] = useState("idle");
  const [take, setTake] = useState(0);
  const [view, setView] = useState("soldier");
  const driver = useMemo(() => {
    const d = new Driver();
    d.sim.player.pos = { x: 0, z: 0 };
    d.sim.player.previous = { x: 0, z: 0 };
    return d;
  }, []);
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => refresh((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <main>
      <div style={{ position: "absolute", top: 70, left: 16, zIndex: 20 }}>
        {(Object.keys(MAPS) as MapId[]).map((id) => (
          <button
            key={id}
            onClick={() => {
              setMapId(id);
              setView("map");
            }}
          >
            {MAPS[id].label}
          </button>
        ))}
      </div>
      <Canvas
        key={view}
        shadows="percentage"
        camera={{
          position:
            view === "soldier"
              ? [3, 2.4, 4]
              : view === "map"
                ? [0, 44, 29]
                : [8, 7, 10],
          fov: 42,
        }}
        onCreated={({ camera }) => camera.lookAt(0, 1, 0)}
      >
        <FrameCounter driver={driver} />
        <color attach="background" args={["#c3c5a8"]} />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#fff0d2", "#606546", 0.6]} />
        <directionalLight
          position={[-4, 8, 5]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
        />
        <Suspense fallback={null}>
          {view === "tank" && (
            <CombatPreview tank audio={audio} blast={blast} />
          )}
          {view === "combat" && <CombatPreview />}
          {view === "weapons" && <CombatPreview weapons />}
          {view === "movement" && <CombatPreview movement />}
          {view !== "map" &&
            view !== "crowd" &&
            view !== "combat" &&
            view !== "weapons" &&
            view !== "movement" &&
            view !== "tank" && (
              <SliceSoldier
                key={`${character}:${take}`}
                driver={driver}
                previewClip={clip}
                variant={character}
              />
            )}
          {view === "crowd" && (
            <>
              {Array.from({ length: 12 }, (_, i) => (
                <group
                  key={i}
                  position={[
                    ((i % 4) - 1.5) * 2,
                    0,
                    (Math.floor(i / 4) - 1) * 2.3,
                  ]}
                >
                  <SliceSoldier
                    driver={driver}
                    variant="rifleman"
                    appearance={infantryAppearance(`enemy_${i}`)}
                    previewClip={["idle", "run", "shoot", "reload"][i % 4]}
                  />
                </group>
              ))}
              <group position={[0, 0, -4.5]}>
                <SliceSoldier
                  driver={driver}
                  variant="general"
                  previewClip="watch"
                />
              </group>
            </>
          )}
          {view === "map" && (
            <>
              <OutpostMap mapId={mapId} />
              <SliceProp
                name="kitchen"
                position={[arena.kitchen.x, 0, arena.kitchen.z]}
              />
              <SliceProp
                name="tent"
                position={[arena.tents[0].x, 0, arena.tents[0].z]}
              />
            </>
          )}
          {view === "outpost" && (
            <>
              <SliceProp name="kitchen" position={[-3, 0, -1]} />
              <SliceProp name="tent" position={[3, 0, -1]} />
              <SliceProp name="terrain" position={[-3, 0, -1]} />
            </>
          )}
        </Suspense>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.02, 0]}
          receiveShadow
        >
          <planeGeometry args={[25, 25]} />
          <meshStandardMaterial color="#89916c" />
        </mesh>
      </Canvas>
      <div className="asset-toolbar">
        <b>Original Blender character and map preview</b>
        <div>
          {(["soldier", "rifleman", "general"] as const).map((name) => (
            <button
              key={name}
              aria-pressed={character === name}
              onClick={() => {
                setCharacter(name);
                setClip("idle");
                setView("soldier");
                setTake((n) => n + 1);
              }}
            >
              {name === "soldier"
                ? "Player"
                : name === "rifleman"
                  ? "Enemy rifleman"
                  : "General"}
            </button>
          ))}
        </div>
        <div>
          {(character === "general"
            ? ["idle", "run", "map", "watch", "sip", "pleased", "hit", "death"]
            : ["idle", "run", "shoot", "reload", "hit", "death"]
          ).map((name) => (
            <button
              key={name}
              aria-pressed={clip === name}
              onClick={() => {
                setClip(name);
                setTake((n) => n + 1);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            setView((v) => (v === "soldier" ? "outpost" : "soldier"))
          }
        >
          {view === "soldier" ? "Show outpost props" : "Inspect soldier"}
        </button>
        <button onClick={() => setView("map")}>Inspect full map</button>
        <button onClick={() => setView("crowd")}>Preview 12 enemies</button>
        <button onClick={() => setView("movement")}>
          Preview movement / dodge
        </button>
        <button onClick={() => setView("weapons")}>
          Preview rocket / grenade upgrades
        </button>
        <button onClick={() => setView("combat")}>
          Preview combat effects
        </button>
        <button onClick={() => setView("tank")}>Preview tank effects</button>
        {view === "tank" && (
          <button
            onClick={() => {
              audio.toggle();
              setSound(audio.enabled);
            }}
          >
            {sound ? "Mute tank sound" : "Enable tank sound"}
          </button>
        )}
        {view === "tank" && (
          <button onClick={() => setBlast((n) => n + 1)}>
            Destroy preview tank
          </button>
        )}
        <a href="/">Back to mission</a>
        <small>
          {view === "tank"
            ? `Scripted 12-second tank loop: movement, cannon, destruction · mock decisions · no Jev calls · sound ${sound ? "on" : "off"}`
            : view === "movement"
              ? "Scripted movement/dodge fixture · no Jev calls"
              : view === "weapons"
                ? "Automatic rocket/grenade firing fixture · both upgrades equipped · no Jev calls"
                : view === "combat"
                  ? "Scripted firing-range fixture · stationary targets · no Jev calls · sound off"
                  : view === "crowd"
                    ? "Animation fixture: 12 enemies + general, no tactical decisions"
                    : "Exported skeletal animations · editable .blend sources · no Jev calls in this preview"}
          {driver.renderStats && ` · ${driver.renderStats.fps} FPS`}
        </small>
      </div>
    </main>
  );
}
