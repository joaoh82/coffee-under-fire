import layout from "../../../../packages/shared/map-layout.json";
import type { Vec } from "../../../../packages/shared/contracts";
export type Obstacle = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
};
// Shared placement source consumed by the simulation and Blender map generator.
export const arena = layout;
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export function clear(p: Vec, r = 0.45, arena = layout) {
  return (
    Math.abs(p.x) <= 22 - r &&
    Math.abs(p.z) <= 18 - r &&
    !arena.obstacles.some(
      (o) =>
        Math.abs(p.x - o.x) < o.w / 2 + r && Math.abs(p.z - o.z) < o.d / 2 + r,
    )
  );
}
// Slab intersection gives earliest hit fraction, including segments starting inside a collider.
export function segmentBox(a: Vec, b: Vec, o: Obstacle, pad = 0) {
  let lo = 0,
    hi = 1;
  for (const [s, e, min, max] of [
    [a.x, b.x, o.x - o.w / 2 - pad, o.x + o.w / 2 + pad],
    [a.z, b.z, o.z - o.d / 2 - pad, o.z + o.d / 2 + pad],
  ]) {
    const d = e - s;
    if (Math.abs(d) < 1e-9) {
      if (s < min || s > max) return null;
      continue;
    }
    const t1 = (min - s) / d,
      t2 = (max - s) / d;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return null;
  }
  return lo;
}
export function sight(a: Vec, b: Vec, arena = layout) {
  return !arena.obstacles.some((o) => segmentBox(a, b, o) !== null);
}
export function segmentCircle(a: Vec, b: Vec, c: Vec, r: number) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    fx = a.x - c.x,
    fz = a.z - c.z,
    A = dx * dx + dz * dz,
    C = fx * fx + fz * fz - r * r;
  if (C <= 0) return 0;
  if (A === 0) return null;
  const B = 2 * (fx * dx + fz * dz),
    D = B * B - 4 * A * C;
  if (D < 0) return null;
  const t = (-B - Math.sqrt(D)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
// Four-neighbour A*: goals are selected elsewhere; this only finds collision-safe paths.
export function path(
  start: Vec,
  goal: Vec,
  radius = 0.45,
  arena = layout,
): Vec[] {
  if (!clear(goal, radius, arena)) return [];
  const point = (n: number): Vec => ({
    x: (n % 43) - 21,
    z: Math.floor(n / 43) - 17,
  });
  const index = (p: Vec) => Math.round(p.x) + 21 + (Math.round(p.z) + 17) * 43;
  const first = index(start),
    last = index(goal);
  const open = new Set([first]);
  const prev = new Map<number, number>();
  const cost = new Map([[first, 0]]);
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const n of open) {
      const f = cost.get(n)! + distance(point(n), goal);
      if (f < best) {
        current = n;
        best = f;
      }
    }
    if (current === last) {
      const result: Vec[] = [goal];
      while (current !== first) {
        result.unshift(point(current));
        current = prev.get(current)!;
      }
      return result;
    }
    open.delete(current);
    const p = point(current);
    for (const q of [
      { x: p.x + 1, z: p.z },
      { x: p.x - 1, z: p.z },
      { x: p.x, z: p.z + 1 },
      { x: p.x, z: p.z - 1 },
    ]) {
      if (!clear(q, Math.max(0.5, radius), arena)) continue;
      const n = index(q),
        next = cost.get(current)! + 1;
      if (next < (cost.get(n) ?? Infinity)) {
        cost.set(n, next);
        prev.set(n, current);
        open.add(n);
      }
    }
  }
  return [];
}
