import { type Difficulty, difficultyPreset } from "./difficulty";
export type WaveProfile = "legacy" | "pressure.v1";
export function waveSettings(
  wave: number,
  profile: WaveProfile = "pressure.v1",
  difficulty: Difficulty = "normal.v1",
) {
  difficultyPreset(difficulty);
  if (profile !== "legacy" && difficulty === "easy.v1")
    return {
      cap: Math.min(8, 4 + wave),
      interval: Math.max(4.5, 6 - wave * 0.25),
      batch: 1,
      activeSeconds: 44,
      telegraphGap: 60,
    };
  if (profile !== "legacy" && difficulty === "hard.v1")
    return {
      cap: 14,
      interval: Math.max(2, 3 - wave * 0.25),
      batch: 3,
      activeSeconds: 55,
      telegraphGap: 30,
    };
  return profile === "legacy"
    ? {
        cap: 12,
        interval: Math.max(3, 7 - wave * 0.5),
        batch: 1,
        activeSeconds: 45,
        telegraphGap: 60,
      }
    : {
        cap: Math.min(14, 10 + wave * 2),
        interval: Math.max(2.5, 4 - wave * 0.5),
        batch: wave >= 3 ? 3 : 2,
        activeSeconds: 52,
        telegraphGap: 30,
      };
}
