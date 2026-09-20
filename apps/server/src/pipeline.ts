import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  requestSchema,
  type DecisionRequest,
  type Decision,
} from "../../../packages/shared/contracts";
import { bodyFor, DecisionError, type Provider } from "./jev";
import type { Store } from "./store";
export const LIMITS = {
  sessions: 8,
  globalConcurrency: 8,
  sessionConcurrency: 4,
  requests: 6500,
  inputTokens: 10_000_000,
  globalRequests: 20_000,
  maxBodyBytes: 16000,
  sessionMs: 30 * 60_000,
};
type Session = {
  id: string;
  created: number;
  requests: number;
  tokens: number;
  reserved: number;
  inflight: Map<string, AbortController>;
  sequences: Map<string, number>;
  cooldown: number;
  epoch: number;
};
export type Log = {
  at: number;
  event: string;
  session: string;
  npc?: string;
  sequence?: number;
  tick?: number;
  source?: string;
  selected?: string;
  latencyMs?: number;
  queueMs?: number;
  reason?: string;
  usage?: Decision["usage"];
  model?: string;
  config?: string;
};
export class Pipeline {
  sessions = new Map<string, Session>();
  logs: Log[] = [];
  active = 0;
  totalRequests = 0;
  constructor(
    private provider: Provider,
    private now = () => Date.now(),
    private limits = LIMITS,
    private store?: Store,
  ) {}
  log(row: Log) {
    this.logs.push(row);
    if (this.logs.length > 5000) this.logs.shift();
  }
  create() {
    for (const [id, s] of this.sessions)
      if (this.now() - s.created > this.limits.sessionMs) this.close(id);
    if (this.sessions.size >= this.limits.sessions)
      throw new DecisionError("session_capacity");
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      created: this.now(),
      requests: 0,
      tokens: 0,
      reserved: 0,
      inflight: new Map(),
      sequences: new Map(),
      cooldown: 0,
      epoch: 0,
    });
    return id;
  }
  close(id: string) {
    const s = this.sessions.get(id);
    if (s) {
      for (const c of s.inflight.values()) c.abort();
      this.sessions.delete(id);
    }
  }
  invalidate(id: string, epoch: number) {
    const s = this.sessions.get(id);
    if (!s) throw new DecisionError("session_expired");
    if (epoch <= s.epoch) return;
    for (const c of s.inflight.values()) c.abort();
    s.epoch = epoch;
    s.sequences.clear();
  }
  async decide(
    sessionId: string,
    raw: unknown,
    outer?: AbortSignal,
  ): Promise<Decision> {
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) throw new DecisionError("invalid_request");
    const r = parsed.data;
    const s = this.sessions.get(sessionId);
    if (
      !s ||
      r.session !== sessionId ||
      this.now() - s.created > this.limits.sessionMs
    )
      throw new DecisionError("session_expired");
    if (r.epoch !== s.epoch) throw new DecisionError("stale_epoch");
    const key = `${r.observation.npc}:${r.generation}`;
    if (s.inflight.has(key)) throw new DecisionError("npc_inflight");
    if (r.sequence <= (s.sequences.get(key) ?? 0))
      throw new DecisionError("stale_sequence");
    if (this.now() < s.cooldown)
      throw new DecisionError("backoff", s.cooldown - this.now());
    if (
      s.inflight.size >= this.limits.sessionConcurrency ||
      this.active >= this.limits.globalConcurrency
    )
      throw new DecisionError("concurrency_capacity", 250);
    // Reserve a deliberately pessimistic byte-based allowance, NOT a claimed token count.
    // Failed/unknown requests retain their reservation; successful requests settle actual usage.
    const reserve =
      Buffer.byteLength(JSON.stringify(bodyFor(r, "jev-latest"))) * 2 + 2048;
    if (
      s.requests >= this.limits.requests ||
      this.totalRequests >= this.limits.globalRequests ||
      s.tokens + s.reserved + reserve > this.limits.inputTokens
    )
      throw new DecisionError("budget_exhausted");
    let reservation: string | undefined;
    if (this.store) {
      try {
        reservation = this.store.reserveUsage(sessionId, reserve);
      } catch {
        throw new DecisionError("monthly_budget_exhausted");
      }
    }
    const c = new AbortController();
    const signal = outer ? AbortSignal.any([outer, c.signal]) : c.signal;
    s.inflight.set(key, c);
    s.sequences.set(key, r.sequence);
    s.requests++;
    this.totalRequests++;
    s.reserved += reserve;
    this.active++;
    let charge = reserve;
    let reported: number | undefined;
    let failed = true;
    const start = performance.now();
    const base = {
      at: this.now(),
      session: sessionId,
      npc: r.observation.npc,
      sequence: r.sequence,
      tick: r.tick,
    };
    try {
      const d = await this.provider(r, signal);
      if (
        signal.aborted ||
        s.epoch !== r.epoch ||
        !this.sessions.has(sessionId)
      )
        throw new DecisionError("cancelled");
      charge = d.usage?.input_tokens ?? reserve;
      reported = d.usage?.input_tokens;
      failed = false;
      this.log({
        ...base,
        event: "provider_decision",
        source: d.source,
        selected: d.selected,
        latencyMs: performance.now() - start,
        queueMs: 0,
        usage: d.usage,
        model: d.model,
        config: d.config,
      });
      return d;
    } catch (e) {
      const err =
        e instanceof DecisionError ? e : new DecisionError("provider_failure");
      if (err.code !== "cancelled")
        s.cooldown = this.now() + Math.max(1000, err.retryMs);
      this.log({
        ...base,
        event: "rejected",
        reason: err.code,
        latencyMs: performance.now() - start,
      });
      throw err;
    } finally {
      try {
        if (reservation) this.store!.settleUsage(reservation, reported, failed);
      } finally {
        s.tokens += charge;
        s.reserved -= reserve;
        s.inflight.delete(key);
        this.active--;
      }
    }
  }
}
