import {
  envelope,
  type Candidate,
  type Decision,
  type DecisionRequest,
  type Observation,
  type Vec,
} from "../../../../packages/shared/contracts";
export const LOCAL_TACTICS_MODEL = "local-tactics.v1";
// Preferred engagement distance and appetite for closing in, per enemy type.
const PROFILES = {
  rifleman: { preferred: 6, minimum: 3, advance: 8, investigate: 8 },
  scout: { preferred: 4, minimum: 2, advance: 9, investigate: 8.5 },
  gunner: { preferred: 9, minimum: 5, advance: 7, investigate: 7 },
  marksman: { preferred: 13, minimum: 8, advance: 6, investigate: 6.5 },
  tank: { preferred: 10, minimum: 5, advance: 7.5, investigate: 7 },
} as const;
const NOISE = 1.5;
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
// Stateless per-decision randomness: the same request always yields the same
// choice, and the simulation's own RNG stream is never consumed.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function randomFor(seed: string) {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Without any contact, each NPC sweeps toward a waypoint that changes every
// ten seconds so squads spread through the arena instead of idling at spawn.
export function searchWaypoint(npc: string, tick: number): Vec {
  const r = randomFor(`${npc}:search:${Math.floor(tick / 600)}`);
  return { x: Math.round(r() * 32 - 16), z: Math.round(r() * 24 - 12) };
}
function profileOf(o: Observation) {
  return o.role === "tank"
    ? PROFILES.tank
    : PROFILES[o.archetype ?? "rifleman"];
}
function maxHpOf(o: Observation) {
  return o.maxHp ?? (o.role === "tank" ? 90 : o.role === "general" ? 100 : 30);
}
export function scoreCandidate(
  r: DecisionRequest,
  c: Candidate,
  previous: string | null,
): number {
  const o = r.observation;
  if (c.kind === "reaction") {
    const base = {
      watch: o.visible.length ? 4 : 2,
      map: 2,
      sip: 2,
      pleased: 1,
    };
    return base[c.reaction] - (previous === c.id ? 1.5 : 0);
  }
  const p = profileOf(o);
  const target = o.visible[0]?.position ?? null;
  const known = target ?? o.lastSeen?.position ?? o.audible?.position ?? null;
  const range = target ? distance(o.position, target) : null;
  const wounded = o.hp / maxHpOf(o) < 0.35;
  const canAttack = r.candidates.some(
    (a) => a.kind === "fire" || a.kind === "cannon",
  );
  const afterAttack =
    previous === "fire_player" || previous === "cannon_player";
  switch (c.kind) {
    case "hold":
      return 0.3;
    case "reload":
      if (o.ammo === 0) return 11;
      if (target) return 0.2;
      return o.ammo <= 6 ? 5.5 : 1.5;
    case "fire":
    case "cannon": {
      let score = 9;
      // Close-range specialists and gunners mix bursts with repositioning.
      if (afterAttack && o.archetype !== "marksman" && o.role !== "tank")
        score -= o.archetype === "scout" || o.archetype === "gunner" ? 2.5 : 1;
      if (range !== null && range < p.minimum && o.archetype === "marksman")
        score -= 4;
      return score;
    }
    case "move": {
      const to = c.destination;
      if (c.id === "advance_contact") {
        if (!target) return p.investigate;
        if (!canAttack) return p.advance + 1;
        return range! > p.preferred + 1 ? p.advance - 1 : 1;
      }
      if (target) {
        const next = distance(to, target);
        let score = 4 - Math.abs(next - p.preferred) * 0.4;
        if (range! < p.minimum) score += (next - range!) * 0.8 + 2;
        if (afterAttack) score += 2;
        if (wounded && c.occludedFromLastSeen === true) score += 4;
        return score;
      }
      if (known) {
        let score =
          3 + (distance(o.position, known) - distance(to, known)) * 0.5;
        // Long-range shooters look for a clear lane onto the last sighting.
        if (
          (o.role === "tank" || o.archetype === "marksman") &&
          c.occludedFromLastSeen === false
        )
          score += 2;
        if (wounded && c.occludedFromLastSeen === true) score += 3;
        return score;
      }
      const waypoint = searchWaypoint(o.npc, r.tick);
      return (
        4 + (distance(o.position, waypoint) - distance(to, waypoint)) * 0.6
      );
    }
  }
}
// Deterministic utility AI over the simulation's legal candidate menu.
export function chooseLocally(
  r: DecisionRequest,
  previous: string | null = null,
  blocked = false,
  fireDiscipline = 0.5,
): Decision {
  const random = randomFor(
    `${r.session}:${r.observation.npc}:${r.epoch}:${r.sequence}:${r.tick}`,
  );
  // Difficulty sets how often an available shot is taken; otherwise the NPC
  // maneuvers. The retired Jev model took roughly 45% of such shots.
  const holdFire = random() >= fireDiscipline;
  // A move that stalled immediately is wedged against cover or a squadmate:
  // pause briefly rather than re-plan every tick.
  const wedged =
    blocked &&
    (previous === "advance_contact" || /^move_\d$/.test(previous ?? ""));
  const scores = r.candidates.map(
    (c) =>
      scoreCandidate(r, c, previous) +
      random() * NOISE -
      (blocked && c.id === previous ? 8 : 0) +
      (wedged && c.kind === "hold" ? 6 : 0) -
      (holdFire && (c.kind === "fire" || c.kind === "cannon") ? 20 : 0),
  );
  let best = 0;
  for (let i = 1; i < scores.length; i++)
    if (scores[i] > scores[best]) best = i;
  const top = scores[best];
  const weights = scores.map((s) => Math.exp(s - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = Object.fromEntries(
    r.candidates.map((c, i) => [c.id, weights[i] / total]),
  );
  return {
    ...envelope(r),
    selected: r.candidates[best].id,
    source: "local",
    confidence: weights[best] / total,
    probabilities,
    model: LOCAL_TACTICS_MODEL,
  };
}
