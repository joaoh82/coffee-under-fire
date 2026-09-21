import { ProjectileGeometry } from "./ProjectileGeometry";
import { useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Driver } from "../game/driver";

import { SliceSoldier, SliceProp } from "./SliceAssets";
import { CoffeeFeedback } from "./CoffeeFeedback";
import { DodgeFeedback } from "./DodgeFeedback";
import { TankEffects } from "./TankEffects";
import { CombatFeedback } from "./CombatFeedback";
import { cameraFrame } from "./camera";
import { OutpostMap } from "./OutpostMap";
import { NpcCharacters } from "./NpcCharacters";
import { FrameCounter } from "./FrameCounter";
import { updateBulletInstances } from "./bulletInstances";
import { DT } from "../game/simulation";
function Box({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}
function Actor({ driver, index }: { driver: Driver; index: number }) {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const left = useRef<THREE.Group>(null!);
  const right = useRef<THREE.Group>(null!);
  const cup = useRef<THREE.Group>(null!);
  const gun = useRef<THREE.Group>(null!);
  const previousActor = useRef<object | null>(null);
  const previousSim = useRef(driver.sim);
  const lastHp = useRef(100);
  const flashUntil = useRef(-1);
  const health = useRef<THREE.Group>(null!);
  const healthFill = useRef<THREE.Mesh>(null!);
  const inverseRotation = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ camera }, delta) => {
    const s = driver.sim,
      a = index < 0 ? s.player : s.npcs[index];
    group.current.visible = Boolean(a && a.hp > 0);
    if (!a) return;
    const alpha =
      s.status === "running" && !driver.recovering
        ? driver.accumulator / DT
        : 1;
    group.current.position.set(
      a.previous.x + (a.pos.x - a.previous.x) * alpha,
      0,
      a.previous.z + (a.pos.z - a.previous.z) * alpha,
    );
    const change = Math.atan2(
      Math.sin(a.angle - group.current.rotation.y),
      Math.cos(a.angle - group.current.rotation.y),
    );
    if (previousSim.current !== s || previousActor.current !== a) {
      group.current.rotation.y = a.angle;
      previousSim.current = s;
      previousActor.current = a;
      lastHp.current = a.hp;
      flashUntil.current = -1;
    } else if (s.status === "running")
      group.current.rotation.y += change * (1 - Math.exp(-24 * delta));
    if (a.hp < lastHp.current) flashUntil.current = s.time + 0.2;
    lastHp.current = a.hp;
    const flash = Math.max(0, (flashUntil.current - s.time) / 0.2);
    for (const part of [body.current, left.current, right.current])
      part.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          object.material instanceof THREE.MeshStandardMaterial
        ) {
          object.material.emissive.set("#ff2020");
          object.material.emissiveIntensity = flash * 1.8;
        }
      });
    health.current.quaternion
      .copy(inverseRotation.copy(group.current.quaternion).invert())
      .multiply(camera.quaternion);
    const ratio = Math.max(
      0,
      Math.min(1, a.hp / (index < 0 ? 100 : index === 0 ? 100 : 30)),
    );
    healthFill.current.scale.x = ratio;
    healthFill.current.position.x = -(1 - ratio) * 0.5;
    const speed =
      Math.hypot(a.pos.x - a.previous.x, a.pos.z - a.previous.z) / DT;
    const stride = Math.sin(s.time * 14) * Math.min(1, speed / 3);
    left.current.rotation.x = stride * 0.55;
    right.current.rotation.x = -stride * 0.55;
    body.current.position.y = Math.abs(stride) * 0.055;
    body.current.rotation.z = -stride * 0.035;
    body.current.rotation.x = index < 0 && s.tick < s.dodgeUntil ? -0.25 : 0;
    gun.current.position.z = -(s.tick - a.shotAt < 5 ? 0.1 : 0);
    cup.current.visible = index < 0 && Boolean(s.cup);
    cup.current.rotation.z =
      Math.sin(s.time * 8) * 0.1 * Math.min(1, speed / 3);
  });
  const color = index < 0 ? "#647653" : index === 0 ? "#b59b50" : "#67717b";
  return (
    <group
      ref={group}
      onClick={(e) => {
        if (index >= 0) {
          e.stopPropagation();
          driver.inspectedNpcId = driver.sim.npcs[index]?.id ?? null;
        }
      }}
    >
      <group ref={health} position={[0, 2.05, 0]}>
        <mesh renderOrder={10}>
          <planeGeometry args={[1.12, 0.19]} />
          <meshBasicMaterial color="#25332b" depthTest={false} />
        </mesh>
        <mesh ref={healthFill} position={[0, 0, 0.01]} renderOrder={11}>
          <planeGeometry args={[1, 0.1]} />
          <meshBasicMaterial
            color={index < 0 ? "#9ed779" : index === 0 ? "#e9cd78" : "#ef796b"}
            depthTest={false}
          />
        </mesh>
      </group>
      <group ref={body}>
        <Box position={[0, 0.75, 0]} size={[0.65, 0.7, 0.45]} color={color} />
        <mesh position={[0, 1.27, 0]} castShadow>
          <sphereGeometry args={[0.35, 8, 5]} />
          <meshStandardMaterial color="#dab99a" />
        </mesh>
        <mesh position={[0, 1.48, 0]} castShadow>
          <sphereGeometry args={[0.38, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Box
          position={[-0.4, 0.88, 0.02]}
          size={[0.18, 0.4, 0.23]}
          color={color}
        />
        <Box
          position={[0.4, 0.88, 0.02]}
          size={[0.18, 0.4, 0.23]}
          color={color}
        />
        <group ref={gun}>
          <Box
            position={[0.38, 0.8, 0.3]}
            size={[0.14, 0.15, 0.8]}
            color="#3b3d34"
          />
        </group>
        <group ref={cup} position={[-0.55, 1.02, 0.16]} scale={1.4}>
          <mesh>
            <cylinderGeometry args={[0.17, 0.13, 0.29, 12]} />
            <meshStandardMaterial color="#fff9dd" />
          </mesh>
          <mesh position={[-0.18, 0.02, 0]}>
            <torusGeometry args={[0.095, 0.035, 5, 10]} />
            <meshStandardMaterial color="#fff9dd" />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.01, 12]} />
            <meshStandardMaterial color="#713c22" />
          </mesh>
        </group>
      </group>
      <group ref={left} position={[-0.19, 0.52, 0]}>
        <Box position={[0, -0.31, 0]} size={[0.23, 0.4, 0.4]} color="#333f37" />
      </group>
      <group ref={right} position={[0.19, 0.52, 0]}>
        <Box position={[0, -0.31, 0]} size={[0.23, 0.4, 0.4]} color="#333f37" />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.49, 0.56, index < 0 ? 24 : 3]} />
        <meshBasicMaterial color={index < 0 ? "#f9efb9" : "#e0a583"} />
      </mesh>
    </group>
  );
}
function TacticalPath({ driver }: { driver: Driver }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(900), 3),
    );
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: "#f6dc75", depthTest: false }),
    );
  }, []);
  const ring = useRef<THREE.Mesh>(null!);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  useFrame(() => {
    const n = driver.sim.npcs.find((n) => n.id === driver.inspectedNpcId);
    ring.current.visible = Boolean(n);
    if (n) ring.current.position.set(n.pos.x, 0.06, n.pos.z);
    const points = n?.action?.kind === "move" ? [n.pos, ...n.route] : [];
    line.visible = points.length > 1;
    line.geometry.setDrawRange(0, Math.min(points.length, 300));
    const attr = line.geometry.getAttribute("position");
    points.slice(0, 300).forEach((p, i) => attr.setXYZ(i, p.x, 0.1, p.z));
    attr.needsUpdate = true;
    line.frustumCulled = false;
  });
  return (
    <>
      <primitive object={line} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.78, 32]} />
        <meshBasicMaterial color="#f6dc75" depthTest={false} />
      </mesh>
    </>
  );
}
function LandmarkLabel({
  text,
  position,
}: {
  text: string;
  position: [number, number, number];
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#28392b";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#fff0bc";
    ctx.font = "bold 36px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48);
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[3.5, 0.66, 1]} renderOrder={12}>
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
function Scene({ driver }: { driver: Driver }) {
  const { camera, size, raycaster, pointer } = useThree();
  const bulletRef = useRef<THREE.InstancedMesh>(null!);
  const marks = useRef<THREE.InstancedMesh>(null!);
  const temp = new THREE.Object3D();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aim = new THREE.Vector3();
  useFrame((_, delta) => {
    const frame = cameraFrame(size.width, size.height, driver.sim.player.pos);
    camera.position.set(frame.x, 42, frame.z + 29);
    camera.lookAt(frame.x, 0, frame.z);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = frame.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    if (driver.touchAim)
      driver.input.aim = {
        x: driver.sim.player.pos.x + driver.touchAim.x * 10,
        z: driver.sim.player.pos.z + driver.touchAim.z * 10,
      };
    else if (raycaster.ray.intersectPlane(plane, aim))
      driver.input.aim = { x: aim.x, z: aim.z };
    driver.update(delta);
    const s = driver.sim;
    updateBulletInstances(bulletRef.current, s.bullets, temp);
    marks.current.count = s.telegraphs.length;
    s.telegraphs.forEach((m, i) => {
      temp.position.set(m.pos.x, 0.05, m.pos.z);
      temp.scale.setScalar(m.role === "tank" ? 1.65 : 1);
      temp.rotation.set(-Math.PI / 2, 0, 0);
      temp.updateMatrix();
      marks.current.setMatrixAt(i, temp.matrix);
    });
    marks.current.instanceMatrix.needsUpdate = true;
    marks.current.computeBoundingSphere();
  }, -2);
  return (
    <>
      <color attach="background" args={["#969786"]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#ece3d2", "#505345", 0.6]} />
      <directionalLight
        position={[-12, 28, 12]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <Suspense
        fallback={
          <group>
            {" "}
            <Box position={[0, -0.3, 0]} size={[44, 0.6, 36]} color="#89916c" />
            <Box
              position={[0, 0.005, 5]}
              size={[42, 0.01, 3.2]}
              color="#afa383"
            />
            <Box
              position={[15, 0.01, 0]}
              size={[3.2, 0.02, 33]}
              color="#afa383"
            />
            {driver.sim.arena.obstacles.map((o) => (
              <Box
                key={o.id}
                position={[o.x, 0.6, o.z]}
                size={[o.w, 1.2, o.d]}
                color={o.id.startsWith("wall") ? "#939989" : "#9a8666"}
              />
            ))}
          </group>
        }
      >
        <OutpostMap mapId={driver.sim.mapId} />
      </Suspense>
      <Suspense fallback={null}>
        <SliceProp
          name="kitchen"
          position={[driver.sim.arena.kitchen.x, 0, driver.sim.arena.kitchen.z]}
        />

        <SliceProp
          name="tent"
          position={[driver.sim.tent.x, 0, driver.sim.tent.z]}
        />
      </Suspense>
      <mesh
        position={[
          driver.sim.arena.kitchen.x,
          0.02,
          driver.sim.arena.kitchen.z,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.8, 2, 40]} />
        <meshBasicMaterial color="#fff4cb" />
      </mesh>
      <mesh
        position={[driver.sim.tent.x, 0.03, driver.sim.tent.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.8, 2, 40]} />
        <meshBasicMaterial color="#fff4cb" />
      </mesh>
      <LandmarkLabel
        text="COFFEE KITCHEN"
        position={[driver.sim.arena.kitchen.x, 4.2, driver.sim.arena.kitchen.z]}
      />
      <LandmarkLabel
        text="DELIVER COFFEE"
        position={[driver.sim.tent.x, 3.2, driver.sim.tent.z]}
      />
      <CombatFeedback driver={driver} />
      <TankEffects driver={driver} />
      <DodgeFeedback driver={driver} />
      <TacticalPath driver={driver} />
      <Suspense fallback={<Actor driver={driver} index={-1} />}>
        <SliceSoldier driver={driver} />
      </Suspense>
      <Suspense
        fallback={Array.from({ length: 15 }, (_, i) => (
          <Actor key={i} driver={driver} index={i} />
        ))}
      >
        <NpcCharacters driver={driver} />
      </Suspense>
      <instancedMesh ref={bulletRef} args={[undefined, undefined, 256]}>
        <ProjectileGeometry />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={marks} args={[undefined, undefined, 12]}>
        <ringGeometry args={[0.7, 0.85, 24]} />
        <meshBasicMaterial color="#af4e31" side={THREE.DoubleSide} />
      </instancedMesh>
      <CoffeeFeedback driver={driver} />
    </>
  );
}
export function World({ driver }: { driver: Driver }) {
  return (
    <Canvas
      orthographic
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [0, 42, 29], near: 0.1, far: 120 }}
      fallback={<p>WebGL is required for this mission.</p>}
    >
      <FrameCounter driver={driver} />
      <Scene driver={driver} />
    </Canvas>
  );
}
