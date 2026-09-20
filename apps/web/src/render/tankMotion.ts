// Visual-only belt path in the exported GLB's Y-up coordinates.
export const TREAD_LOOP = 2.4 + 2 * Math.PI * 0.25;
export function treadPose(distance: number) {
  const t = ((distance % TREAD_LOOP) + TREAD_LOOP) % TREAD_LOOP;
  if (t < 1.2) return { z: -0.6 + t, y: 0.55, angle: 0 };
  if (t < 1.2 + Math.PI * 0.25) {
    const angle = (t - 1.2) / 0.25;
    return {
      z: 0.6 + Math.sin(angle) * 0.25,
      y: 0.3 + Math.cos(angle) * 0.25,
      angle,
    };
  }
  if (t < 2.4 + Math.PI * 0.25)
    return { z: 0.6 - (t - 1.2 - Math.PI * 0.25), y: 0.05, angle: Math.PI };
  const angle = Math.PI + (t - 2.4 - Math.PI * 0.25) / 0.25;
  return {
    z: -0.6 + Math.sin(angle) * 0.25,
    y: 0.3 + Math.cos(angle) * 0.25,
    angle,
  };
}
export function cannonRecoil(ageTicks: number) {
  if (ageTicks < 0 || ageTicks >= 24) return 0;
  return 0.2 * (1 - ageTicks / 24) ** 2;
}
