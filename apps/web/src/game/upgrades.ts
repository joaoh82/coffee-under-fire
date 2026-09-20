export const UPGRADES = {
  boots: { name: "Quick boots", description: "+10% movement speed", cap: 5 },
  damage: { name: "Heavy rounds", description: "+20% bullet damage", cap: 5 },
  cadence: {
    name: "Quick trigger",
    description: "Shorter time between shots",
    cap: 5,
  },
  heal: {
    name: "Field dressing",
    description: "Restore 25 health immediately",
    cap: Infinity,
  },
} as const;
export type Upgrade = keyof typeof UPGRADES;
