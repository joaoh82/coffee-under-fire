import { z } from "zod";
export const VERSION = "coffee.v2" as const;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const vec = z
  .object({
    x: z.number().finite().min(-22).max(22),
    z: z.number().finite().min(-18).max(18),
  })
  .strict();
export type Vec = z.infer<typeof vec>;
export const candidateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id,
      kind: z.literal("cannon"),
      duration: z.literal(1.8),
      target: z.literal("player"),
      aimPoint: vec,
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("hold"),
      duration: z.number().positive().max(1),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("move"),
      duration: z.number().positive().max(2),
      destination: vec,
      purpose: z.enum(["approach", "investigate", "reposition"]).optional(),
      route: z.enum(["orchard", "central", "supply"]).optional(),
      occludedFromLastSeen: z.boolean().nullable().optional(),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("fire"),
      duration: z.number().min(0.3).max(0.8),
      target: id,
    })
    .strict(),
  z
    .object({ id, kind: z.literal("reload"), duration: z.literal(1.2) })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("reaction"),
      duration: z.number().min(3).max(5),
      reaction: z.enum(["map", "watch", "sip", "pleased"]),
    })
    .strict(),
]);
export type Candidate = z.infer<typeof candidateSchema>;
export const observationSchema = z
  .object({
    npc: id,
    role: z.enum(["rifleman", "general", "tank"]),
    // Additive coffee.v2 specialist extension; old observations remain valid.
    archetype: z.enum(["rifleman", "scout", "gunner", "marksman"]).optional(),
    combat: z
      .object({
        movementSpeed: z.number().positive().max(10),
        fireRange: z.number().positive().max(24),
        fireCadenceTicks: z.number().int().min(1).max(120),
        fireWindupTicks: z.number().int().min(0).max(120),
      })
      .strict()
      .optional(),
    position: vec,
    // Additive coffee.v2 armor extension; legacy observations remain valid.
    hp: z.number().min(0).max(240),
    maxHp: z.number().min(1).max(240).optional(),
    ammo: z.number().int().min(0).max(12),
    visible: z.array(z.object({ id, position: vec }).strict()).max(1),
    lastSeen: z
      .object({ position: vec, age: z.number().min(0).max(10) })
      .strict()
      .nullable(),
    recentDamage: z.boolean(),
    audible: z
      .object({
        position: vec,
        age: z.number().min(0).max(3),
        kind: z.enum(["footsteps", "gunfire"]),
      })
      .strict()
      .nullable()
      .optional(),
    currentAction: z.string().max(80).nullable(),
    frame: z.literal("XZ_meters_Y_up"),
  })
  .strict();
export const requestSchema = z
  .object({
    version: z.literal(VERSION),
    session: id,
    epoch: z.number().int().nonnegative(),
    generation: z.number().int().nonnegative(),
    sequence: z.number().int().positive(),
    tick: z.number().int().nonnegative(),
    observation: observationSchema,
    candidates: z.array(candidateSchema).min(1).max(12),
  })
  .strict()
  .superRefine((r, c) => {
    if (new Set(r.candidates.map((a) => a.id)).size !== r.candidates.length)
      c.addIssue({ code: "custom", message: "Duplicate candidate IDs" });
    for (const a of r.candidates) {
      if (
        a.kind === "cannon" &&
        (r.observation.role !== "tank" ||
          r.observation.ammo === 0 ||
          !r.observation.visible.some(
            (t) =>
              t.id === a.target &&
              t.position.x === a.aimPoint.x &&
              t.position.z === a.aimPoint.z,
          ))
      )
        c.addIssue({ code: "custom", message: "Illegal cannon candidate" });
      if (
        a.kind === "fire" &&
        (r.observation.role !== "rifleman" ||
          r.observation.ammo === 0 ||
          !r.observation.visible.some((t) => t.id === a.target))
      )
        c.addIssue({ code: "custom", message: "Illegal fire candidate" });
      if (
        a.kind === "reload" &&
        (r.observation.role === "general" || r.observation.ammo === 12)
      )
        c.addIssue({ code: "custom", message: "Illegal reload candidate" });
      if (a.kind === "reaction" && r.observation.role !== "general")
        c.addIssue({ code: "custom", message: "Illegal reaction" });
      if (r.observation.role === "general" && a.kind !== "reaction")
        c.addIssue({ code: "custom", message: "General may only react" });
    }
  });
export type DecisionRequest = z.infer<typeof requestSchema>;
export type Observation = z.infer<typeof observationSchema>;
export const responseSchema = z
  .object({
    version: z.literal(VERSION),
    session: id,
    epoch: z.number().int(),
    generation: z.number().int(),
    sequence: z.number().int(),
    tick: z.number().int(),
    npc: id,
    selected: id,
    source: z.enum(["jev", "mock", "replay"]),
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number().min(0).max(1)).optional(),
    latencyMs: z.number().nonnegative(),
    model: z.string().max(100),
    config: z.enum([
      "tactics.v1",
      "tactics.v2",
      "tactics.v3",
      "tactics.v4",
      "tactics.v5",
    ]),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .nullable(),
  })
  .strict();
export type Decision = z.infer<typeof responseSchema>;
export function envelope(r: DecisionRequest) {
  return {
    version: VERSION,
    session: r.session,
    epoch: r.epoch,
    generation: r.generation,
    sequence: r.sequence,
    tick: r.tick,
    npc: r.observation.npc,
    config: r.observation.archetype
      ? ("tactics.v5" as const)
      : ("tactics.v4" as const),
  };
}
