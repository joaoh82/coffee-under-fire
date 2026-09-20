import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Driver } from "../game/driver";

export function CoffeeFeedback({ driver }: { driver: Driver }) {
  const particles = useRef<THREE.InstancedMesh>(null!);
  const rings = useRef<THREE.InstancedMesh>(null!);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(
    () => ({
      spill: new THREE.Color("#713b20"),
      fill: new THREE.Color("#fff1bc"),
      delivery: new THREE.Color("#f3c95f"),
    }),
    [],
  );
  useFrame(() => {
    const s = driver.sim;
    particles.current.count = 0;
    rings.current.count = 0;
    for (const event of s.coffeeFeedback) {
      const age = (s.tick - event.born) / 60;
      const spill = event.kind === "spill";
      if (age < 0.75)
        for (let j = 0; j < 8; j++) {
          const angle = (j * Math.PI) / 4;
          const radius = age * (spill ? 1.1 : 1.6);
          temp.position.set(
            event.pos.x + Math.cos(angle) * radius,
            spill ? Math.max(0.04, 0.9 + age - 3 * age * age) : 0.4 + age * 1.8,
            event.pos.z + Math.sin(angle) * radius,
          );
          temp.rotation.set(age * 3, angle, age * 4);
          temp.scale.setScalar((spill ? 0.1 : 0.13) * (1 - age / 0.75));
          temp.updateMatrix();
          const index = particles.current.count++;
          particles.current.setMatrixAt(index, temp.matrix);
          particles.current.setColorAt(index, colors[event.kind]);
        }
      const fade = Math.max(0, 1 - age / 2);
      const radius = spill ? 0.35 + Math.min(age, 0.5) * 0.3 : 0.6 + age * 0.8;
      temp.position.set(event.pos.x, 0.06, event.pos.z);
      temp.rotation.set(-Math.PI / 2, 0, 0);
      temp.scale.set(radius * fade, radius * fade, 1);
      temp.updateMatrix();
      const index = rings.current.count++;
      rings.current.setMatrixAt(index, temp.matrix);
      rings.current.setColorAt(index, colors[event.kind]);
    }
    for (const mesh of [particles.current, rings.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh
        ref={particles}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, 8]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.82, 1, 20]} />
        <meshBasicMaterial
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}
