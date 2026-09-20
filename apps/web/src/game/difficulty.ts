// Versioned presets keep recorded runs stable when future balance changes land.
export const DIFFICULTIES = {
  "easy.v1": {
    label: "Easy",
    description: "Fewer enemies. Gentler hits.",
    damageScale: 0.625,
  },
  "normal.v1": {
    label: "Normal",
    description: "The current battlefield balance.",
    damageScale: 1,
  },
  "hard.v1": {
    label: "Hard",
    description: "Faster, larger enemy groups.",
    damageScale: 1,
  },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
export function difficultyPreset(value: Difficulty) {
  if (!Object.hasOwn(DIFFICULTIES, value))
    throw new Error("Unsupported difficulty preset");
  return DIFFICULTIES[value];
}
