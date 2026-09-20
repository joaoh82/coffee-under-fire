import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Driver } from "../game/driver";
import { DT } from "../game/simulation";

// Editable runtime geometry, attached to the Blender-authored coffee socket.
// Cosmetic motion only: this component never changes coffee volume or warmth.
export function CarriedCoffee({
  driver,
  model,
  previewClip,
}: {
  driver: Driver;
  model: THREE.Object3D;
  previewClip?: string;
}) {
  const previewTime = useRef(0);
  const root = useRef<THREE.Group>(null!);
  const liquid = useRef<THREE.Mesh>(null!);
  const steam = useRef<THREE.Group>(null!);
  const socket = useMemo(
    () => model.getObjectByName("SOCKET_hand_coffee"),
    [model],
  );
  const position = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const s = driver.sim;
    if (previewClip) previewTime.current += Math.min(delta, 0.1);
    const time = previewClip ? previewTime.current : s.time;
    root.current.visible =
      Boolean(socket) && (Boolean(s.cup) || Boolean(previewClip));
    if (!root.current.visible || !socket) return;
    socket.getWorldPosition(position);
    root.current.position.copy(root.current.parent!.worldToLocal(position));
    const speed = previewClip
      ? previewClip === "run"
        ? 1
        : 0
      : Math.min(
          1,
          Math.hypot(
            s.player.pos.x - s.player.previous.x,
            s.player.pos.z - s.player.previous.z,
          ) /
            DT /
            5,
        );
    const kick = Math.max(0, 1 - (s.tick - s.spillAt) / 24);
    const wobble = Math.sin(time * 11) * (speed * 0.08 + kick * 0.15);
    root.current.rotation.set(wobble * 0.5, 0, wobble);
    liquid.current.position.y = -0.22 + 0.2 * ((s.cup?.volume ?? 100) / 100);
    liquid.current.rotation.set(
      Math.sin(time * 9) * speed * 0.08,
      0,
      -wobble * 0.6,
    );
    liquid.current.visible = (s.cup?.volume ?? 100) > 0;
    const warmth = (s.cup?.warmth ?? 100) / 100;
    steam.current.visible = warmth > 0.2;
    steam.current.children.forEach((p, i) => {
      const age = (time * 0.65 + i / 3) % 1;
      p.position.set(
        Math.sin(time * 2 + i) * 0.05,
        0.04 + age * 0.55,
        Math.cos(i * 2) * 0.04,
      );
      p.scale.setScalar((0.045 + age * 0.065) * warmth);
      const material = (p as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (1 - age) * 0.4 * warmth;
    });
  });
  return (
    <group ref={root} scale={1.45} visible={false}>
      <mesh position={[0, -0.14, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.14, 0.27, 12, 1, true]} />
        <meshStandardMaterial
          color="#fff1cc"
          side={THREE.DoubleSide}
          roughness={0.5}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.165, 0.025, 5, 12]} />
        <meshStandardMaterial color="#fff8e0" />
      </mesh>
      <mesh position={[0, -0.265, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshStandardMaterial color="#fff1cc" />
      </mesh>
      <mesh position={[-0.21, -0.12, 0]} castShadow>
        <torusGeometry args={[0.09, 0.032, 5, 10]} />
        <meshStandardMaterial color="#fff1cc" />
      </mesh>
      <mesh ref={liquid} position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.142, 0.142, 0.012, 12]} />
        <meshStandardMaterial color="#713b20" roughness={0.25} />
      </mesh>
      <group ref={steam}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color="#fff5df"
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
