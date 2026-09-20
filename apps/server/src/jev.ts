import { performance } from "node:perf_hooks";
import { z } from "zod";
import {
  envelope,
  requestSchema,
  type DecisionRequest,
  type Decision,
} from "../../../packages/shared/contracts";
export class DecisionError extends Error {
  constructor(
    public code: string,
    public retryMs = 0,
  ) {
    super(code);
  }
}
const probability = z.number().finite().min(0).max(1);
const providerSchema = z.object({
  model: z.string().min(1).max(100),
  answers: z.object({
    tactic: z.object({
      type: z.literal("choice"),
      choice: z.string(),
      confidence: probability,
      probabilities: z.record(z.string(), probability),
    }),
  }),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});
export function bodyFor(r: DecisionRequest, model: string) {
  requestSchema.parse(r);
  return {
    model,
    state: r.observation,
    questions: {
      tactic: {
        type: "choice",
        instructions:
          r.observation.role === "general"
            ? "You are the general at a fictional WWII outpost. Select one complete permitted authored reaction based only on this observation."
            : r.observation.role === "tank"
              ? "You command a slow light tank in an arena shooter. Choose ONE complete legal candidate. Pressure perceived opponents: move into a clear firing lane, fire the cannon at a visible opponent when suitable, or reload. Cannon commits to the supplied aimPoint: it warns for 1.2 seconds, then fires one slow straight shell (16 damage); it never tracks a moving player after selection. Movement lasts at most 2 seconds at 1.4 meters/second. Search or investigate remembered/approximate audible contacts when visibility is lost. You alone choose tactics; physics will not pursue or retarget automatically. Use only this tank's observation. Hold is a brief tactical pause."
              : "You are an aggressive assault rifleman in an arena shooter. Apply continuous pressure: close toward a visible opponent until roughly 6 meters away, then fire short bursts and reposition. When sight is lost, investigate the last-seen or audible location. Without a contact, actively search by moving through the outpost; do not wait at the spawn point. Reload when necessary. Hold is a brief tactical pause, not the default. Choose ONE complete legal candidate, including its fixed destination and duration. You alone choose the tactic; the executor will not pursue or retarget automatically. Use only this NPC’s observation. Audible locations are approximate and memories can be stale.",
        criteria: Object.fromEntries(
          r.candidates.map((c) => [c.id, JSON.stringify(c)]),
        ),
      },
    },
  };
}
export function parseProvider(
  raw: unknown,
  r: DecisionRequest,
  latencyMs: number,
): Decision {
  const v = providerSchema.safeParse(raw);
  if (!v.success) throw new DecisionError("invalid_provider_schema");
  const p = v.data;
  const a = p.answers.tactic;
  const ids = r.candidates.map((c) => c.id);
  if (
    !ids.includes(a.choice) ||
    Object.keys(a.probabilities).length !== ids.length ||
    ids.some((id) => !Object.hasOwn(a.probabilities, id)) ||
    Math.abs(Object.values(a.probabilities).reduce((s, v) => s + v, 0) - 1) >
      0.02
  )
    throw new DecisionError("invalid_provider_choice");
  return {
    ...envelope(r),
    selected: a.choice,
    source: "jev",
    confidence: a.confidence,
    probabilities: a.probabilities,
    latencyMs,
    model: p.model,
    usage: p.usage,
  };
}
export function retryDelay(headers: Headers, now = Date.now()) {
  const ms = headers.get("retry-after-ms");
  if (ms !== null && Number.isFinite(Number(ms)) && Number(ms) >= 0)
    return Number(ms);
  const value = headers.get("retry-after");
  if (!value) return 1000;
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? Math.max(0, seconds * 1000)
    : Math.max(1000, Date.parse(value) - now || 1000);
}
export type Provider = (
  r: DecisionRequest,
  signal: AbortSignal,
) => Promise<Decision>;
export function jevProvider(
  key: string | undefined,
  model = "jev-latest",
  transport: typeof fetch = fetch,
): Provider {
  return async (r, signal) => {
    if (!key) throw new DecisionError("missing_api_key");
    const start = performance.now();
    const combined = AbortSignal.any([signal, AbortSignal.timeout(1200)]);
    let response: Response;
    try {
      response = await transport("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyFor(r, model)),
        signal: combined,
      });
    } catch {
      throw new DecisionError(
        signal.aborted ? "cancelled" : "provider_timeout_or_network",
      );
    }
    if (!response.ok)
      throw new DecisionError(
        `provider_http_${response.status}`,
        response.status === 429 ? retryDelay(response.headers) : 0,
      );
    try {
      return parseProvider(await response.json(), r, performance.now() - start);
    } catch (e) {
      if (e instanceof DecisionError) throw e;
      throw new DecisionError("invalid_provider_json");
    }
  };
}
// Explicit offline fixture: round-robin, no tactical heuristic, never labelled Jev.
export const mockProvider: Provider = async (r, signal) => {
  if (signal.aborted) throw new DecisionError("cancelled");
  return {
    ...envelope(r),
    selected: r.candidates[(r.sequence - 1) % r.candidates.length].id,
    source: "mock",
    confidence: 0,
    latencyMs: 0,
    model: "development-fixture",
    usage: null,
  };
};
