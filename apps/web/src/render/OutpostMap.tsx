import { MAPS, type MapId } from "../game/maps";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh } from "three";
export function OutpostMap({ mapId = "woodland.v1" }: { mapId?: MapId }) {
  const gltf = useLoader(GLTFLoader, "/assets/models/" + MAPS[mapId].model);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.receiveShadow = true;
        o.castShadow = !/Ground|Packed_dirt|Path_edge/.test(o.name);
      }
    });
    return root;
  }, [gltf]);
  return <primitive object={scene} dispose={null} />;
}
