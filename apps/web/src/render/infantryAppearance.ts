// Presentation only: do not consume simulation RNG or alter tactical roles.
export type InfantryAppearance =
  | "rifleman"
  | "rifleman_scout"
  | "rifleman_veteran"
  | "rifleman_gunner"
  | "rifleman_marksman";
export function infantryAppearance(id: string): InfantryAppearance {
  let hash = 0;
  for (const char of id)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return (["rifleman", "rifleman_scout", "rifleman_veteran"] as const)[
    hash % 3
  ];
}

export function specialistAppearance(
  archetype: string,
  id: string,
): InfantryAppearance {
  if (archetype === "scout") return "rifleman_scout";
  if (archetype === "gunner") return "rifleman_gunner";
  if (archetype === "marksman") return "rifleman_marksman";
  return infantryAppearance(id) === "rifleman_veteran"
    ? "rifleman_veteran"
    : "rifleman";
}
