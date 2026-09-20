import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Driver } from "../game/driver";

export function DodgeFeedback({ driver }: { driver: Driver }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const burst = useRef({ tick: -100, x: 0, z: 0, dx: 0, dz: 0 });
  useFrame(() => {
    const s = driver.sim,
      p = s.player;
    if (s.dodgeAt !== burst.current.tick) {
      const dx = p.pos.x - p.previous.x,
        dz = p.pos.z - p.previous.z;
      const length = Math.hypot(dx, dz);
      burst.current = {
        tick: s.dodgeAt,
        x: p.previous.x,
        z: p.previous.z,
        dx: length ? dx / length : 0,
        dz: length ? dz / length : 0,
      };
    }
    const b = burst.current,
      age = (s.tick - b.tick) / 60;
    mesh.current.count =
      age >= 0 && age < 0.4 && Math.hypot(b.dx, b.dz) > 0 ? 8 : 0;
    for (let i = 0; i < mesh.current.count; i++) {
      const side = (i % 2 ? 1 : -1) * age * 0.65;
      temp.position.set(
        b.x + b.dx * i * 0.17 - b.dz * side,
        0.08 + age * 0.25,
        b.z + b.dz * i * 0.17 + b.dx * side,
      );
      temp.rotation.set(0, i, age * 2);
      temp.scale.setScalar(0.13 * (1 - age / 0.4));
      temp.updateMatrix();
      mesh.current.setMatrixAt(i, temp.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 8]}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color="#bcac88"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
