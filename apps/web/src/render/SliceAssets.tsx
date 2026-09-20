import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Driver } from "../game/driver";
import { CarriedCoffee } from "./CarriedCoffee";
import {
  infantryAppearance,
  type InfantryAppearance,
} from "./infantryAppearance";
import { motionPose } from "./motionPose";
import { animationLayers } from "./animationLayers";
import { DT, type NPC } from "../game/simulation";
export function SliceProp({
  name,
  position,
}: {
  name: "kitchen" | "tent" | "terrain";
  position: [number, number, number];
}) {
  const gltf = useLoader(GLTFLoader, `/assets/models/slice_${name}.glb`);
  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return root;
  }, [gltf]);
  return <primitive object={model} position={position} dispose={null} />;
}
export function SliceSoldier({
  driver,
  previewClip,
  actor,
  appearance,
  variant = actor?.role === "tank" ? "rifleman" : (actor?.role ?? "soldier"),
}: {
  driver: Driver;
  previewClip?: string;
  actor?: NPC;
  appearance?: InfantryAppearance;
  variant?: "soldier" | "rifleman" | "general";
}) {
  const gltf = useLoader(
    GLTFLoader,
    variant === "soldier"
      ? "/assets/models/slice_soldier.glb"
      : `/assets/models/npc_${variant === "rifleman" ? (appearance ?? infantryAppearance(actor?.id ?? "preview")) : variant}.glb`,
  );
  const model = useMemo(() => {
    const root = clone(gltf.scene);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Animated limbs can leave their bind-pose bounds. The small, capped
        // character population does not need per-part frustum culling.
        o.frustumCulled = false;
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return root;
  }, [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const clips = useMemo(() => animationLayers(gltf.animations), [gltf]);
  const group = useRef<THREE.Group>(null!);
  const posture = useRef<THREE.Group>(null!);
  const bar = useRef<THREE.Group>(null!);
  const fill = useRef<THREE.Mesh>(null!);
  const groundRing = useRef<THREE.Mesh>(null!);
  const muzzleFlash = useRef<THREE.Group>(null!);
  const muzzle = useMemo(() => model.getObjectByName("SOCKET_muzzle"), [model]);
  const muzzlePosition = useMemo(() => new THREE.Vector3(), []);
  const firstFrame = useRef(true);
  const state = useRef({
    clip: "",
    base: "",
    hp: actor?.hp ?? 100,
    hitUntil: -1,
    shot: -100,
    reactionStart: -1,
  });
  const inverse = useMemo(() => new THREE.Quaternion(), []);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      model.traverse((o) => {
        if (o instanceof THREE.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      });
    },
    [model, mixer],
  );
  useFrame(({ camera }, delta) => {
    const s = driver.sim,
      p = actor ?? s.player;
    const alpha =
      s.status === "running" && !driver.recovering && p.hp > 0
        ? driver.accumulator / DT
        : 1;
    group.current.position.set(
      p.previous.x + (p.pos.x - p.previous.x) * alpha,
      0,
      p.previous.z + (p.pos.z - p.previous.z) * alpha,
    );
    if (firstFrame.current) {
      group.current.rotation.y = p.angle;
      firstFrame.current = false;
    }
    if (groundRing.current) groundRing.current.visible = p.hp > 0;
    const turn = Math.atan2(
      Math.sin(p.angle - group.current.rotation.y),
      Math.cos(p.angle - group.current.rotation.y),
    );
    if (s.status === "running" && !driver.recovering && p.hp > 0)
      group.current.rotation.y +=
        turn * (1 - Math.exp(-(actor ? 24 : 38) * delta));
    else if (previewClip) group.current.rotation.y = p.angle;
    if (p.hp < state.current.hp) state.current.hitUntil = s.tick + 12;
    state.current.hp = p.hp;
    const dx = p.pos.x - p.previous.x,
      dz = p.pos.z - p.previous.z;
    const distanceMoved = Math.hypot(dx, dz);
    const moving = distanceMoved > 0.001;
    const speed = distanceMoved / DT;
    const localX = moving
      ? (dx * Math.cos(p.angle) - dz * Math.sin(p.angle)) / distanceMoved
      : 0;
    const localZ = moving
      ? (dx * Math.sin(p.angle) + dz * Math.cos(p.angle)) / distanceMoved
      : 0;
    const pose = motionPose(
      speed,
      localX,
      localZ,
      !actor && moving ? s.tick - s.dodgeAt : -1,
    );
    if (
      !previewClip &&
      p.hp > 0 &&
      s.status === "running" &&
      !driver.recovering
    ) {
      const blend = 1 - Math.exp(-22 * delta);
      posture.current.rotation.x +=
        (pose.pitch - posture.current.rotation.x) * blend;
      posture.current.rotation.z +=
        (pose.roll - posture.current.rotation.z) * blend;
      posture.current.position.y = pose.height;
      posture.current.scale.y = pose.squash;
    } else if (p.hp <= 0) {
      posture.current.rotation.set(0, 0, 0);
      posture.current.position.y = 0;
      posture.current.scale.y = 1;
    }
    const reaction =
      actor?.action?.kind === "reaction" ? actor.action.reaction : null;
    const clip =
      previewClip ??
      (p.hp <= 0
        ? "death"
        : s.tick < state.current.hitUntil
          ? "hit"
          : reaction
            ? reaction
            : p.reloadUntil > s.tick
              ? "reload"
              : s.tick - p.shotAt < 8
                ? "shoot"
                : moving
                  ? "run"
                  : "idle");
    const layered = !previewClip && p.hp > 0;
    const base = moving ? "lower_run" : "lower_idle";
    if (layered && base !== state.current.base) {
      const next = mixer
        .clipAction(clips.find((a) => a.name === base)!)
        .reset()
        .setEffectiveWeight(1)
        .play();
      if (state.current.base)
        mixer
          .clipAction(clips.find((a) => a.name === state.current.base)!)
          .crossFadeTo(next, 0.12, false);
      state.current.base = base;
    }
    if (!layered && state.current.base) {
      mixer
        .clipAction(clips.find((a) => a.name === state.current.base)!)
        .stop();
      state.current.base = "";
    }
    if (layered && state.current.base === "lower_run") {
      const action = mixer.clipAction(
        clips.find((a) => a.name === "lower_run")!,
      );
      action.setEffectiveTimeScale(pose.strideRate * (localZ < -0.25 ? -1 : 1));
    }
    const actualClip = layered ? `upper_${clip}` : clip;
    const repeatShot = clip === "shoot" && state.current.shot !== p.shotAt;
    const repeatReaction = Boolean(
      reaction && actor?.actionStart !== state.current.reactionStart,
    );
    if (actualClip !== state.current.clip || repeatShot || repeatReaction) {
      const next = mixer.clipAction(clips.find((a) => a.name === actualClip)!);
      next.reset().setEffectiveWeight(1).play();
      if (["death", "hit", "shoot", "reload"].includes(clip)) {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else next.setLoop(THREE.LoopRepeat, Infinity);
      if (state.current.clip && state.current.clip !== actualClip)
        mixer
          .clipAction(clips.find((a) => a.name === state.current.clip)!)
          .crossFadeTo(next, 0.1, false);
      state.current.clip = actualClip;
      state.current.shot = p.shotAt;
      state.current.reactionStart = actor?.actionStart ?? -1;
    }
    if (
      (s.status === "running" && !driver.recovering) ||
      (!actor && p.hp <= 0) ||
      previewClip
    )
      mixer.update(Math.min(delta, 0.1));
    const flashAge =
      previewClip === "shoot"
        ? mixer.clipAction(clips.find((a) => a.name === "shoot")!).time * 60
        : s.tick - p.shotAt;
    muzzleFlash.current.visible =
      variant !== "general" &&
      p.hp > 0 &&
      Boolean(muzzle) &&
      flashAge >= 0 &&
      flashAge < 4;
    if (muzzleFlash.current.visible && muzzle) {
      muzzle.getWorldPosition(muzzlePosition);
      muzzleFlash.current.position.copy(
        group.current.worldToLocal(muzzlePosition),
      );
      muzzleFlash.current.scale.setScalar(1 - flashAge / 5);
    }
    model.traverse((o) => {
      if (o.name.startsWith("VIS_Coffee"))
        o.visible = variant === "soldier" ? false : clip === "sip";
      if (o.name.startsWith("VIS_Map")) o.visible = clip === "map";
      if (o instanceof THREE.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive.set("#ff3020");
            m.emissiveIntensity = s.tick < state.current.hitUntil ? 0.8 : 0;
          }
    });
    bar.current.visible = !previewClip && p.hp > 0;
    bar.current.quaternion
      .copy(inverse.copy(group.current.quaternion).invert())
      .multiply(camera.quaternion);
    const ratio = Math.max(
      0,
      Math.min(1, p.hp / (variant === "rifleman" ? 30 : 100)),
    );
    fill.current.scale.x = ratio;
    fill.current.position.x = -(1 - ratio) * 0.5;
  }, -0.5);
  return (
    <group
      ref={group}
      onClick={(e) => {
        if (actor && actor.hp > 0) {
          e.stopPropagation();
          driver.inspectedNpcId = actor.id;
        }
      }}
    >
      <group ref={posture}>
        <primitive object={model} dispose={null} />
      </group>
      {variant === "soldier" && (
        <CarriedCoffee
          driver={driver}
          model={model}
          previewClip={previewClip}
        />
      )}
      <group ref={muzzleFlash} visible={false}>
        <mesh scale={[0.18, 0.18, 0.38]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#ffb444" toneMapped={false} />
        </mesh>
        <mesh scale={[0.1, 0.1, 0.42]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#fff9d6" toneMapped={false} />
        </mesh>
      </group>
      <group ref={bar} position={[0, 2.15, 0]}>
        <mesh renderOrder={10}>
          <planeGeometry args={[1.12, 0.18]} />
          <meshBasicMaterial color="#25332b" depthTest={false} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.01]} renderOrder={11}>
          <planeGeometry args={[1, 0.1]} />
          <meshBasicMaterial
            color={
              variant === "rifleman"
                ? "#ef796b"
                : variant === "general"
                  ? "#e9cd78"
                  : "#a5da78"
            }
            depthTest={false}
          />
        </mesh>
      </group>
      {!previewClip && (
        <mesh
          ref={groundRing}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, 0]}
        >
          <ringGeometry args={[0.5, 0.56, variant === "rifleman" ? 3 : 24]} />
          <meshBasicMaterial
            color={variant === "rifleman" ? "#e0a583" : "#f5e5a9"}
          />
        </mesh>
      )}
    </group>
  );
}
