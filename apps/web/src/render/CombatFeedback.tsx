import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Driver } from "../game/driver";
export function CombatFeedback({ driver }: { driver: Driver }) {
  const gems = useRef<THREE.InstancedMesh>(null!);
  const debris = useRef<THREE.InstancedMesh>(null!);
  const sparks = useRef<THREE.InstancedMesh>(null!);
  const traces = useRef<THREE.InstancedMesh>(null!);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const red = useMemo(() => new THREE.Color("#bc473b"), []);
  const dark = useMemo(() => new THREE.Color("#59624b"), []);
  const gold = useMemo(() => new THREE.Color("#ffe39a"), []);
  const orange = useMemo(() => new THREE.Color("#ff9755"), []);
  useFrame(() => {
    const s = driver.sim;
    sparks.current.count = s.impacts.length * 5;
    traces.current.count = 0;
    s.impacts.forEach((impact, i) => {
      const age = (s.tick - impact.born) / 60;
      for (let j = 0; j < 5; j++) {
        const angle = (j * Math.PI * 2) / 5 + impact.born;
        const radius = age * (1.8 + j * 0.25);
        temp.position.set(
          impact.pos.x + Math.cos(angle) * radius,
          0.8 + age * 2.5 - age * age * 7,
          impact.pos.z + Math.sin(angle) * radius,
        );
        temp.rotation.set(age * 9, angle, age * 7);
        const fade = Math.max(0, 1 - age / 0.3);
        temp.scale.set(0.09 * fade, 0.09 * fade, 0.22 * fade);
        temp.updateMatrix();
        sparks.current.setMatrixAt(i * 5 + j, temp.matrix);
        sparks.current.setColorAt(
          i * 5 + j,
          impact.target === "actor" ? red : gold,
        );
      }
      // A short final trace survives collision removal, so even a shot that
      // hits between rendered frames has visible feedback. Ends at the hit.
      if (s.tick - impact.born < 6) {
        const dx = impact.pos.x - impact.from.x,
          dz = impact.pos.z - impact.from.z;
        temp.position.set(
          (impact.pos.x + impact.from.x) / 2,
          0.75,
          (impact.pos.z + impact.from.z) / 2,
        );
        temp.rotation.set(0, Math.atan2(dx, dz), 0);
        temp.scale.set(0.12, 0.12, Math.max(0.02, Math.hypot(dx, dz)));
        temp.updateMatrix();
        const index = traces.current.count++;
        traces.current.setMatrixAt(index, temp.matrix);
        traces.current.setColorAt(
          index,
          impact.owner === "player" ? gold : orange,
        );
      }
    });
    for (const mesh of [sparks.current, traces.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    gems.current.count = s.gems.length;
    s.gems.forEach((gem, i) => {
      temp.position.set(
        gem.pos.x,
        0.3 + Math.sin(s.time * 4 + gem.id) * 0.08,
        gem.pos.z,
      );
      temp.rotation.set(0, s.time * 1.8, 0.25);
      temp.scale.setScalar(0.24);
      temp.updateMatrix();
      gems.current.setMatrixAt(i, temp.matrix);
    });
    gems.current.instanceMatrix.needsUpdate = true;
    debris.current.count = s.deathBursts.length * 9;
    s.deathBursts.forEach((burst, i) => {
      const age = (s.tick - burst.born) / 60;
      for (let j = 0; j < 9; j++) {
        const angle = (j * Math.PI * 2) / 9;
        const radius = age * (1.5 + (j % 3) * 0.4);
        temp.position.set(
          burst.pos.x + Math.cos(angle) * radius,
          Math.max(0.05, 0.6 + age * 2.3 - age * age * 6),
          burst.pos.z + Math.sin(angle) * radius,
        );
        temp.rotation.set(age * 8 + j, angle, age * 6);
        temp.scale.setScalar(
          Math.max(0, 1 - age / 0.8) * (j % 3 === 0 ? 0.3 : 0.2),
        );
        temp.updateMatrix();
        debris.current.setMatrixAt(i * 9 + j, temp.matrix);
        debris.current.setColorAt(i * 9 + j, j % 3 === 0 ? dark : red);
      }
    });
    debris.current.instanceMatrix.needsUpdate = true;
    if (debris.current.instanceColor)
      debris.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh
        ref={sparks}
        args={[undefined, undefined, 320]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={traces}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={gems}
        args={[undefined, undefined, 128]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#67dfd0"
          emissive="#2baca7"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </instancedMesh>
      <instancedMesh
        ref={debris}
        args={[undefined, undefined, 288]}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </>
  );
}
