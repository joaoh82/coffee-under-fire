export type RosterProfile = "legacy" | "specialists.v1";
export const ENEMY_TYPES = {
  rifleman: {
    label: "Rifleman",
    unlockWave: 1,
    speed: 2.7,
    fireRange: 14,
    cadenceTicks: 24,
    windupTicks: 18,
    perceptionRange: 14,
    bulletSpeed: 11,
  },
  scout: {
    label: "Scout",
    unlockWave: 3,
    speed: 3.8,
    fireRange: 7,
    cadenceTicks: 24,
    windupTicks: 18,
    perceptionRange: 14,
    bulletSpeed: 11,
  },
  gunner: {
    label: "Gunner",
    unlockWave: 5,
    speed: 2.1,
    fireRange: 12,
    cadenceTicks: 12,
    windupTicks: 18,
    perceptionRange: 14,
    bulletSpeed: 11,
  },
  marksman: {
    label: "Marksman",
    unlockWave: 7,
    speed: 2.3,
    fireRange: 18,
    cadenceTicks: 60,
    windupTicks: 36,
    perceptionRange: 18,
    bulletSpeed: 14,
  },
} as const;
export type EnemyArchetype = keyof typeof ENEMY_TYPES;
// Composition only, never an NPC tactical choice. No additional RNG consumption.
export function infantryArchetype(
  wave: number,
  index: number,
  profile: RosterProfile,
): EnemyArchetype {
  if (profile === "legacy") return "rifleman";
  const unlocked = (Object.keys(ENEMY_TYPES) as EnemyArchetype[]).filter(
    (type) => ENEMY_TYPES[type].unlockWave <= wave + 1,
  );
  return unlocked[(unlocked.length - 1 + index) % unlocked.length];
}
