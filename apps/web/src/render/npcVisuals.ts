import type { NPC } from "../game/simulation";

export type NpcVisual = { actor: NPC; deadAt: number | null };
export const CORPSE_TICKS = 60;
export const MAX_CORPSES = 12;

// Presentation only: retain defeated actors for one second of animation without
// putting them back into physics, perception, targeting, or Jev requests.
export function syncNpcVisuals(
  previous: NpcVisual[],
  actors: NPC[],
  tick: number,
): NpcVisual[] {
  const live = actors.filter((a) => a.hp > 0);
  const corpses = previous
    .filter((v) => v.actor.hp <= 0)
    .map((v) => (v.deadAt === null ? { ...v, deadAt: tick } : v))
    .filter((v) => tick - v.deadAt! < CORPSE_TICKS)
    .sort((a, b) => a.deadAt! - b.deadAt!)
    .slice(-MAX_CORPSES);
  const next = live
    .map(
      (actor) =>
        previous.find((v) => v.actor === actor && v.deadAt === null) ?? {
          actor,
          deadAt: null,
        },
    )
    .concat(corpses);
  return next.length === previous.length &&
    next.every((v, i) => v === previous[i])
    ? previous
    : next;
}
