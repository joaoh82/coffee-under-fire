import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { Driver } from "../game/driver";
import { DT, type NPC } from "../game/simulation";
import { cannonRecoil, treadPose, TREAD_LOOP } from "./tankMotion";
import { segmentBox } from "../game/arena";

export function TankCharacter({
  driver,
  actor,
}: {
  driver: Driver;
  actor: NPC;
}) {
  const gltf = useLoader(GLTFLoader, "/assets/models/npc_tank.glb");
  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = o.receiveShadow = true;
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return root;
  }, [gltf]);
  const hull = useMemo(() => model.getObjectByName("HULL")!, [model]);
  const turret = useMemo(() => model.getObjectByName("TURRET")!, [model]);
  const cannon = useMemo(() => model.getObjectByName("CANNON")!, [model]);
  const treads = useMemo(
    () =>
      ["L", "R"].map((side) =>
        Array.from({ length: 6 }, (_, i) =>
          model.getObjectByName(`TREAD_${side}_${i}`)!,
        ),
      ),
    [model],
  );
  const travel = useRef({
    x: actor.pos.x,
    z: actor.pos.z,
    yaw: 0,
    left: 0,
    right: 0,
  });
  const group = useRef<THREE.Group>(null!);
  const bar = useRef<THREE.Group>(null!);
  const fill = useRef<THREE.Mesh>(null!);
  const warning = useRef<THREE.Mesh>(null!);
  const reticle = useRef<THREE.Mesh>(null!);
  const muzzleFlash = useRef<THREE.Mesh>(null!);
  const state = useRef({ hp: actor.hp, hitUntil: -1 });
  const muzzle = useMemo(
    () => model.getObjectByName("SOCKET_muzzle")!,
    [model],
  );
  const point = useMemo(() => new THREE.Vector3(), []);
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
    },
    [model],
  );
  useFrame(({ camera }, delta) => {
    const s = driver.sim;
    const running = s.status === "running" && !driver.recovering;
    const alpha = running && actor.hp > 0 ? driver.accumulator / DT : 1;
    group.current.position.set(
      actor.previous.x + (actor.pos.x - actor.previous.x) * alpha,
      0,
      actor.previous.z + (actor.pos.z - actor.previous.z) * alpha,
    );
    if (running) {
      if (actor.action?.kind === "move") {
        const diff = Math.atan2(
          Math.sin(actor.angle - hull.rotation.y),
          Math.cos(actor.angle - hull.rotation.y),
        );
        hull.rotation.y += diff * (1 - Math.exp(-8 * delta));
      }
      turret.rotation.y = actor.angle;
    }
    const motion = travel.current;
    const dx = group.current.position.x - motion.x,
      dz = group.current.position.z - motion.z;
    const turn = Math.atan2(
      Math.sin(hull.rotation.y - motion.yaw),
      Math.cos(hull.rotation.y - motion.yaw),
    );
    if (running && actor.hp > 0) {
      const distance =
        dx * Math.sin(hull.rotation.y) + dz * Math.cos(hull.rotation.y);
      motion.left += distance + turn * 0.63;
      motion.right += distance - turn * 0.63;
    }
    motion.x = group.current.position.x;
    motion.z = group.current.position.z;
    motion.yaw = hull.rotation.y;
    treads.forEach((links, side) =>
      links.forEach((link, i) => {
        const pose = treadPose(
          (i / 6) * TREAD_LOOP + (side === 0 ? motion.left : motion.right),
        );
        link.position.set(side === 0 ? -0.63 : 0.63, pose.y, pose.z);
        link.rotation.x = pose.angle;
      }),
    );
    const recoil = actor.hp > 0 ? cannonRecoil(s.tick - actor.shotAt) : 0;
    cannon.position.z = -recoil;
    hull.rotation.x = -recoil * 0.12;
    turret.rotation.z = actor.hp > 0 ? 0 : 0.18;
    if (actor.hp < state.current.hp) state.current.hitUntil = s.tick + 12;
    state.current.hp = actor.hp;
    model.traverse((o) => {
      if (o instanceof THREE.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive.set("#ff3020");
            m.emissiveIntensity = s.tick < state.current.hitUntil ? 0.75 : 0;
          }
    });
    bar.current.visible = actor.hp > 0;
    bar.current.quaternion.copy(camera.quaternion);
    const ratio = Math.max(0, actor.hp / actor.maxHp);
    fill.current.scale.x = ratio;
    fill.current.position.x = -(1 - ratio) * 0.8;
    const action = actor.action;
    warning.current.visible = reticle.current.visible =
      actor.hp > 0 &&
      action?.kind === "cannon" &&
      s.tick - actor.actionStart < 72;
    if (warning.current.visible && action?.kind === "cannon") {
      const dx = action.aimPoint.x - actor.pos.x,
        dz = action.aimPoint.z - actor.pos.z;
      const angle = Math.atan2(dx, dz);
      const end = {
        x: actor.pos.x + Math.sin(angle) * 22.5,
        z: actor.pos.z + Math.cos(angle) * 22.5,
      };
      let fraction = 1;
      for (const obstacle of driver.sim.arena.obstacles) {
        const hit = segmentBox(actor.pos, end, obstacle, 0.18);
        if (hit !== null) fraction = Math.min(fraction, hit);
      }
      const length = 22.5 * fraction;
      warning.current.position.set(
        actor.pos.x + (Math.sin(angle) * length) / 2,
        0.07,
        actor.pos.z + (Math.cos(angle) * length) / 2,
      );
      warning.current.rotation.y = angle;
      warning.current.scale.set(
        0.12 + (0.08 * (s.tick - actor.actionStart)) / 72,
        0.025,
        length,
      );
      reticle.current.position.set(action.aimPoint.x, 0.08, action.aimPoint.z);
      reticle.current.scale.setScalar(
        1 - (0.35 * (s.tick - actor.actionStart)) / 72,
      );
    }
    muzzleFlash.current.visible = actor.hp > 0 && s.tick - actor.shotAt < 6;
    if (muzzleFlash.current.visible) {
      muzzle.getWorldPosition(point);
      muzzleFlash.current.position.copy(group.current.worldToLocal(point));
      muzzleFlash.current.scale.setScalar(
        0.4 * (1 - (s.tick - actor.shotAt) / 7),
      );
    }
  }, -0.5);
  return (
    <>
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation();
          driver.inspectedNpcId = actor.id;
        }}
      >
        <primitive object={model} dispose={null} />
        <mesh ref={muzzleFlash} visible={false}>
          <octahedronGeometry />
          <meshBasicMaterial color="#fff0a0" toneMapped={false} />
        </mesh>
        <group ref={bar} position={[0, 1.8, 0]}>
          <mesh renderOrder={10}>
            <planeGeometry args={[1.75, 0.19]} />
            <meshBasicMaterial color="#302f28" depthTest={false} />
          </mesh>
          <mesh ref={fill} position={[0, 0, 0.01]} renderOrder={11}>
            <planeGeometry args={[1.6, 0.11]} />
            <meshBasicMaterial color="#f28657" depthTest={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={warning} visible={false}>
        <boxGeometry />
        <meshBasicMaterial
          color="#ff813d"
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={reticle} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.66, 24]} />
        <meshBasicMaterial color="#ffaf60" toneMapped={false} />
      </mesh>
    </>
  );
}
