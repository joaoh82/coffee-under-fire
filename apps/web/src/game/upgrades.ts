export const UPGRADES = {
  boots: { name: "Quick boots", description: "+10% movement speed", cap: 5 },
  damage: { name: "Heavy rounds", description: "+20% bullet damage", cap: 5 },
  cadence: {
    name: "Quick trigger",
    description: "Shorter time between shots",
    cap: 5,
  },
  magazine: {
    name: "Extended magazine",
    description: "+6 rounds before reloading",
    cap: 3,
  },
  rockets: {
    name: "Rocket launcher",
    description:
      "Fire an extra explosive rocket every 3 seconds while shooting",
    cap: 1,
  },
  grenades: {
    name: "Grenade launcher",
    description: "Lob an extra grenade every 5 seconds while shooting",
    cap: 1,
  },
  heal: {
    name: "Field dressing",
    description: "Restore 25 health immediately",
    cap: Infinity,
  },
} as const;
export type Upgrade = keyof typeof UPGRADES;
