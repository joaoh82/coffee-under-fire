// Presentation only: do not consume simulation RNG or alter tactical roles.
export type InfantryAppearance =
  "rifleman" | "rifleman_scout" | "rifleman_veteran";
export function infantryAppearance(id: string): InfantryAppearance {
  let hash = 0;
  for (const char of id)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return (["rifleman", "rifleman_scout", "rifleman_veteran"] as const)[
    hash % 3
  ];
}
