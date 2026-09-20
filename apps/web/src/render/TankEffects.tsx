import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Driver } from "../game/driver";

// Eight bursts maximum, fixed world origins, simulation time: pauses freeze FX.
export function TankEffects({ driver }: { driver: Driver }) {
  const clouds = useRef<THREE.InstancedMesh>(null!);
  const shards = useRef<THREE.InstancedMesh>(null!);
  const rings = useRef<THREE.InstancedMesh>(null!);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const fire = useMemo(() => new THREE.Color("#ffb343"), []);
  const smoke = useMemo(() => new THREE.Color("#4b4b47"), []);
  useFrame(() => {
    const s = driver.sim;
    clouds.current.count = shards.current.count = s.tankBursts.length * 8;
    rings.current.count = s.tankBursts.length;
    s.tankBursts.forEach((burst, i) => {
      const age = Math.max(0, (s.tick - burst.born) / 60);
      const fade = Math.max(0, 1 - age / 1.6);
      for (let j = 0; j < 8; j++) {
        const angle = (j * Math.PI) / 4 + burst.born;
        const radius = age * (0.5 + (j % 3) * 0.3);
        temp.position.set(
          burst.pos.x + Math.cos(angle) * radius,
          0.55 + age * (0.9 + (j % 3) * 0.4),
          burst.pos.z + Math.sin(angle) * radius,
        );
        temp.rotation.set(j + age, angle, age * 0.4);
        temp.scale.setScalar((0.45 + Math.min(age, 0.7) * 1.15) * fade);
        temp.updateMatrix();
        clouds.current.setMatrixAt(i * 8 + j, temp.matrix);
        color.copy(fire).lerp(smoke, Math.min(1, age / 0.65 + (j % 3) * 0.12));
        clouds.current.setColorAt(i * 8 + j, color);
        const reach = age * (2 + (j % 3) * 0.5);
        temp.position.set(
          burst.pos.x + Math.cos(angle) * reach,
          Math.max(0.07, 0.7 + age * (3 + (j % 3)) - age * age * 5),
          burst.pos.z + Math.sin(angle) * reach,
        );
        temp.rotation.set(age * 8 + j, angle, age * 5);
        temp.scale.set(0.18 * fade, 0.1 * fade, 0.32 * fade);
        temp.updateMatrix();
        shards.current.setMatrixAt(i * 8 + j, temp.matrix);
      }
      temp.position.set(burst.pos.x, 0.06, burst.pos.z);
      temp.rotation.set(-Math.PI / 2, 0, 0);
      temp.scale.setScalar(age < 0.45 ? 0.5 + age * 5 : 0);
      temp.updateMatrix();
      rings.current.setMatrixAt(i, temp.matrix);
    });
    for (const mesh of [clouds.current, shards.current, rings.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh
        ref={clouds}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={shards}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshStandardMaterial color="#444c43" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, 8]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.92, 1, 24]} />
        <meshBasicMaterial
          color="#d39955"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}
