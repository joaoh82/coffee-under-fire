import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { Driver } from "../game/driver";
import mounts from "../../../../packages/shared/weapon-mounts.json";

// Original Blender attachment, authored in the soldier's local coordinate space.
export function ShoulderLauncher({ driver }: { driver: Driver }) {
  const gltf = useLoader(GLTFLoader, "/assets/models/shoulder_launcher.glb");
  const model = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copy;
  }, [gltf]);
  const group = useRef<THREE.Group>(null!);
  const flash = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const s = driver.sim;
    group.current.visible = s.ranks.rockets > 0 && s.player.hp > 0;
    const age = s.tick - s.rocketAt;
    flash.current.visible = age >= 0 && age < 5;
    flash.current.scale.setScalar(Math.max(0, 1 - age / 5));
  }, -0.4);
  return (
    <group ref={group} visible={false}>
      <primitive object={model} dispose={null} />
      <mesh
        ref={flash}
        visible={false}
        rotation={[Math.PI / 2, 0, 0]}
        position={[mounts.rocket.x, mounts.rocket.y, mounts.rocket.z + 0.12]}
      >
        <coneGeometry args={[0.17, 0.4, 6]} />
        <meshBasicMaterial color="#ffd27c" toneMapped={false} />
      </mesh>
    </group>
  );
}
