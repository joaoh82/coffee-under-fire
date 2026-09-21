import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2, Float32BufferAttribute } from "three";

// A rounded brass projectile with a pointed copper nose, facing local +Z.
// Vertex colours preserve a readable silhouette without lighting dependence.
export function ProjectileGeometry() {
  const geometry = useMemo(() => {
    const shape = new LatheGeometry(
      [
        new Vector2(0, -0.5),
        new Vector2(0.4, -0.5),
        new Vector2(0.4, 0.05),
        new Vector2(0.28, 0.32),
        new Vector2(0, 0.5),
      ],
      8,
    ).rotateX(Math.PI / 2);
    const positions = shape.getAttribute("position");
    const colors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const nose = positions.getZ(i) > 0.05;
      colors.push(1, nose ? 0.67 : 0.93, nose ? 0.35 : 0.64);
    }
    shape.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return shape;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}
