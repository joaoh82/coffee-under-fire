import woodland from "../../../../packages/shared/map-layout.json";
import village from "../../../../packages/shared/village-layout.json";
export const MAPS = {
  "woodland.v1": {
    label: "Little Outpost",
    description: "Broken woodland · supply tracks",
    layout: woodland,
    model: "outpost_map.glb",
  },
  "village.v1": {
    label: "Ruined Village",
    description: "Shelled houses · open streets",
    layout: village,
    model: "village_map.glb",
  },
} as const;
export type MapId = keyof typeof MAPS;
export function mapPreset(id: MapId) {
  if (!Object.hasOwn(MAPS, id)) throw new Error("Unsupported map");
  return MAPS[id];
}
