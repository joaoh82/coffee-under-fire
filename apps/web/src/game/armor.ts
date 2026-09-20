import type { Difficulty } from "./difficulty";
// armor.v2: quotas are per wave, including telegraphs; total NPC cap still applies.
export function armorSettings(wave: number, difficulty: Difficulty) {
  const easy = difficulty === "easy.v1",
    hard = difficulty === "hard.v1";
  return {
    hp: easy ? 150 : hard ? 240 : 200,
    quota: wave < 3 ? 0 : easy ? (wave < 5 ? 1 : 2) : wave < 5 ? 2 : 3,
    activeCap: easy ? 2 : 3,
    spacingTicks: (easy ? 18 : hard ? 9 : 12) * 60,
  };
}
