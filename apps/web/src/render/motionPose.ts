// Presentation only; simulation movement, aim and dodge rules stay authoritative.
export function motionPose(
  speed: number,
  localX: number,
  localZ: number,
  dodgeAge: number,
) {
  const dodge =
    dodgeAge >= 0 && dodgeAge < 12 ? Math.sin((Math.PI * dodgeAge) / 12) : 0;
  const moving = Math.min(1, speed / 5);
  return {
    pitch: localZ * (moving * 0.055 + dodge * 0.48),
    roll: -localX * (moving * 0.055 + dodge * 0.48),
    height: dodge * 0.16,
    squash: 1 - dodge * 0.13,
    strideRate: Math.min(2.2, Math.max(0.55, speed / 3.6)),
  };
}
