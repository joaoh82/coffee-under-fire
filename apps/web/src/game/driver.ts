import { mapPreset, type MapId } from "./maps";
import type { Difficulty } from "./difficulty";
import {
  responseSchema,
  type DecisionRequest,
  type Decision,
} from "../../../../packages/shared/contracts";
import {
  Simulation,
  type Input,
  type Recording,
  idleInput,
  DT,
  type MissionMode,
} from "./simulation";
export type TraceRow = {
  id: number;
  request: DecisionRequest;
  decision?: Decision;
  status: "pending" | "queued" | "applied" | "rejected" | "error" | "cancelled";
  reason?: string;
  applicationTick?: number;
  elapsedMs?: number;
};
export class Driver {
  // Invoke the browser API in its own context, not as a method of Driver.
  constructor(
    private transport: typeof fetch = (input, init) => fetch(input, init),
    private now: () => number = () => performance.now(),
  ) {}
  sim = new Simulation();
  renderStats: { fps: number; frameMs: number } | null = null;
  input: Input = idleInput();
  autoReload = true;
  autoFire = false;
  touchAim: { x: number; z: number } | null = null;
  pending = new Map<string, AbortController>();
  errors = new Map<string, string>();
  inspectedNpcId: string | null = null;
  traces: TraceRow[] = [];
  traceSerial = 0;
  totals = {
    requested: 0,
    applied: 0,
    rejected: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  queued = new Map<string, TraceRow>();
  applyTrace(row: TraceRow) {
    if (!row.decision) return;
    const accepted = this.sim.apply(row.request, row.decision);
    row.status = accepted ? "applied" : "rejected";
    row.applicationTick = this.sim.tick;
    if (accepted) this.totals.applied++;
    else {
      this.totals.rejected++;
      row.reason = this.sim.logs.at(-1)?.reason;
      // An expired/contended choice is not a completed action. Re-observe as
      // soon as a scheduler slot is free instead of extending tactical starvation.
      const npc = this.sim.npcs.find(
        (n) => n.id === row.request.observation.npc,
      );
      if (
        npc &&
        !npc.action &&
        (row.reason === "illegal" || row.reason === "stale")
      )
        npc.nextDecision = this.sim.tick;
    }
  }
  flush() {
    for (const [id, row] of this.queued) {
      const n = this.sim.npcs.find((n) => n.id === id);
      if (!n || !n.action) {
        this.queued.delete(id);
        this.applyTrace(row);
      }
    }
  }
  // Bounded automatic recovery changes transport/UI only; simulation stays frozen.
  autoRecoveryAttempts = 0;
  autoRecoveryAt = Infinity;
  private autoRecoveryTimes: number[] = [];
  private recoveryGeneration = 0;
  get automaticRecoveryPending() {
    return (
      this.sim.status === "reconnecting" &&
      Number.isFinite(this.autoRecoveryAt) &&
      this.autoRecoveryAttempts < 2
    );
  }
  get retryWaitSeconds() {
    return Math.max(0, Math.ceil((this.backoff - this.now()) / 1000));
  }
  private async recoverAutomatically() {
    const generation = this.recoveryGeneration;
    this.autoRecoveryTimes = this.autoRecoveryTimes.filter(
      (t) => this.now() - t < 60_000,
    );
    if (this.autoRecoveryTimes.length >= 4) {
      this.autoRecoveryAt = Infinity;
      return;
    }
    this.autoRecoveryAttempts++;
    this.autoRecoveryTimes.push(this.now());
    this.autoRecoveryAt = Infinity;
    await this.resume();
    if (
      !this.disposed &&
      generation === this.recoveryGeneration &&
      this.sim.status === "reconnecting" &&
      this.autoRecoveryAttempts < 2
    )
      this.autoRecoveryAt = Math.max(this.backoff, this.now() + 2000);
  }
  backoff = 0;
  accumulator = 0;
  busy = false;
  disposed = false;
  accessBlock: { code: string; message: string; resetAt?: number } | null =
    null;
  private blockAccess(data: {
    error?: string;
    message?: string;
    resetAt?: number;
  }) {
    if (
      !data.error ||
      ![
        "daily_budget_exhausted",
        "guest_daily_budget_exhausted",
        "ip_daily_budget_exhausted",
        "ip_session_limit",
        "public_closed",
        "public_unavailable",
        "network_changed",
      ].includes(data.error)
    )
      return;
    this.accessBlock = {
      code: data.error,
      message: data.message || "Guest play is temporarily unavailable.",
      resetAt: data.resetAt,
    };
    this.recoveryGeneration++;
    this.autoRecoveryAt = Infinity;
    this.backoff = Infinity;
    this.sim.pause();
    this.input = idleInput();
    this.cancel();
  }
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private heartbeatBusy = false;
  private async heartbeat() {
    if (this.heartbeatBusy || this.disposed) return;
    this.heartbeatBusy = true;
    try {
      const terminal =
        this.sim.status === "won" ||
        this.sim.status === "lost" ||
        this.sim.status === "ready";
      const response = await this.transport(
        terminal ? "/api/session" : "/api/heartbeat",
        {
          method: terminal ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.sim.session}`,
          },
          ...(terminal
            ? {}
            : {
                body: JSON.stringify({
                  playing:
                    this.sim.status === "running" &&
                    (typeof document === "undefined" ||
                      document.visibilityState === "visible"),
                }),
              }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.status === 403)
        this.blockAccess(
          await response
            .clone()
            .json()
            .catch(() => ({})),
        );
      if (terminal || response.status === 401 || response.status === 403) {
        clearInterval(this.heartbeatTimer);
        if (!terminal) {
          this.pause();
          this.sim.status = "reconnecting";
          this.sim.reason =
            "Your game session ended. Return to the briefing or sign in again.";
          this.autoRecoveryAt = Infinity;
        }
      }
    } catch {
      /* The lease expires server-side if connectivity is lost. */
    } finally {
      this.heartbeatBusy = false;
    }
  }
  recovering = false;
  async start(
    mode: "strict" | "mock",
    missionMode: MissionMode = "mission",
    difficulty: Difficulty = "normal.v1",
    mapId: MapId = "woodland.v1",
  ) {
    mapPreset(mapId);
    const response = await this.transport("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapId, difficulty, missionMode }),
    });
    const data = await response.json();
    if (!response.ok) {
      this.blockAccess(data);
      throw new Error(data.message || data.error);
    }
    if (mode === "mock" && data.mode !== "mock") {
      await this.transport("/api/session", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session}` },
      });
      throw new Error(
        "Mock mode requires DECISION_MODE=mock on the development server.",
      );
    }
    if (this.sim.mapId !== mapId)
      this.sim = new Simulation(this.sim.seed, mapId);
    clearInterval(this.heartbeatTimer);
    if (data.heartbeat)
      this.heartbeatTimer = setInterval(() => void this.heartbeat(), 10_000);
    this.sim.start(
      data.mode === "mock" ? "mock" : "strict",
      data.session,
      missionMode,
      difficulty,
    );
  }
  async submitScore(name: string) {
    if (
      !["won", "lost"].includes(this.sim.status) ||
      this.sim.recording.mode !== "strict"
    )
      throw new Error(
        "Only completed live Jev runs can enter the leaderboard.",
      );
    const s = this.sim;
    const response = await this.transport("/api/leaderboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.session}`,
      },
      body: JSON.stringify({
        name,
        report: {
          score: s.score,
          time: s.time,
          kills: s.kills,
          deliveries: s.deliveries,
          level: s.level,
          won: s.status === "won",
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "Unable to submit score. Please try again.",
      );
    return data as { id: string; alreadySubmitted: boolean };
  }
  cancel() {
    for (const c of this.pending.values()) c.abort();
    this.pending.clear();
    for (const row of this.traces)
      if (row.status === "pending" || row.status === "queued") {
        row.status = "cancelled";
        row.reason = "pause_or_restart";
      }
    this.queued.clear();
  }
  async syncEpoch() {
    this.cancel();
    this.busy = true;
    try {
      const r = await this.transport("/api/invalidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.sim.session}`,
        },
        body: JSON.stringify({ epoch: this.sim.epoch }),
      });
      if (!r.ok) throw new Error("Session expired; restart mission");
    } catch (e) {
      this.sim.reason = String(e);
      this.sim.status = "reconnecting";
    } finally {
      this.busy = false;
    }
  }
  pause() {
    if (this.sim.status !== "running" && this.sim.status !== "reconnecting")
      return;
    this.recoveryGeneration++;
    this.autoRecoveryAt = Infinity;
    this.sim.pause();
    this.input = idleInput();
    void this.syncEpoch();
  }
  async resume() {
    if (
      this.accessBlock ||
      this.disposed ||
      this.recovering ||
      this.now() < this.backoff
    )
      return;
    this.autoRecoveryAt = Infinity;
    this.recovering = true;
    this.sim.resume();
    const epoch = this.sim.epoch;
    try {
      await this.syncEpoch();
      if (this.sim.epoch !== epoch || this.sim.status !== "running") return;
      // Concurrent model choices can contend for one destination. Keep accepted
      // actions frozen and re-observe only unresolved NPCs against reservations.
      // Four passes bound contention retries; provider errors are not auto-retried.
      for (let pass = 0; pass < 4; pass++) {
        const unresolved = this.sim.npcs.filter(
          (n) =>
            n.hp > 0 && !n.action && (pass === 0 || !this.errors.has(n.id)),
        );
        if (!unresolved.length) break;
        for (let i = 0; i < unresolved.length; i += 4) {
          if (this.now() < this.backoff) break;
          if (this.sim.epoch !== epoch || this.sim.status !== "running") return;
          await Promise.all(
            unresolved.slice(i, i + 4).map(async (n) => {
              const r = this.sim.request(n);
              const c = new AbortController();
              this.pending.set(n.id, c);
              try {
                await this.decide(r, c);
              } finally {
                if (this.pending.get(n.id) === c) this.pending.delete(n.id);
              }
            }),
          );
        }
      }
      if (
        this.sim.epoch === epoch &&
        this.sim.npcs.some((n) => n.hp > 0 && !n.action)
      ) {
        this.sim.status = "reconnecting";
        this.sim.reason = "Reconnecting to command";
      }
    } finally {
      this.recovering = false;
    }
  }
  async retry() {
    await this.resume();
  }
  async dispose() {
    this.disposed = true;
    clearInterval(this.heartbeatTimer);
    this.recoveryGeneration++;
    this.autoRecoveryAt = Infinity;
    this.cancel();
    if (this.sim.session !== "offline")
      await this.transport("/api/session", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.sim.session}` },
      });
  }
  update(delta: number) {
    if (this.disposed || this.recovering) return;
    if (
      this.automaticRecoveryPending &&
      !this.busy &&
      this.now() >= Math.max(this.autoRecoveryAt, this.backoff)
    ) {
      void this.recoverAutomatically();
      return;
    }
    if (this.sim.status === "running") {
      this.accumulator = Math.min(this.accumulator + delta, 0.1);
      while (this.accumulator >= DT) {
        // Consume a ready choice before checking starvation on the next tick.
        this.flush();
        this.sim.step({
          ...this.input,
          fire: this.input.fire || this.autoFire,
          reload:
            this.input.reload ||
            (this.autoReload && this.sim.player.ammo === 0),
        });
        this.accumulator -= DT;
      }
      if ((this.sim.status as string) === "reconnecting") {
        this.accumulator = 0;
        this.autoRecoveryAttempts = 0;
        this.autoRecoveryAt = this.now() + 350;
        void this.syncEpoch();
        return;
      }
      if (this.sim.status !== "running") {
        this.cancel();
        return;
      }
      this.flush();
      if (!this.busy && this.now() >= this.backoff) this.schedule();
    } else this.accumulator = 0;
  }
  schedule() {
    if (this.accessBlock) return;
    for (const [id, c] of this.pending)
      if (!this.sim.npcs.some((n) => n.id === id && n.hp > 0)) {
        c.abort();
        this.pending.delete(id);
      }
    // Actors without an action have a nearer starvation deadline than prefetches.
    // Oldest waiting actors lead; normal request age breaks ties.
    for (const n of [...this.sim.npcs].sort(
      (a, b) =>
        Number(Boolean(a.action)) - Number(Boolean(b.action)) ||
        (a.action && b.action
          ? a.actionUntil - b.actionUntil
          : a.starvedAt - b.starvedAt) ||
        a.nextDecision - b.nextDecision,
    )) {
      if (this.pending.size >= 4) break;
      if (
        n.hp <= 0 ||
        (n.action && n.actionUntil - this.sim.tick > 30) ||
        this.queued.has(n.id) ||
        this.pending.has(n.id) ||
        this.sim.tick < n.nextDecision
      )
        continue;
      const r = this.sim.request(n);
      const c = new AbortController();
      this.pending.set(n.id, c);
      n.nextDecision = this.sim.tick + 60;
      void this.decide(r, c).finally(() => {
        if (this.pending.get(n.id) === c) this.pending.delete(n.id);
      });
    }
  }
  async decide(r: DecisionRequest, c: AbortController) {
    const started = this.now();
    const row: TraceRow = {
      id: ++this.traceSerial,
      request: structuredClone(r),
      status: "pending",
    };
    this.traces.push(row);
    if (this.traces.length > 200) this.traces.shift();
    this.totals.requested++;
    try {
      const res = await this.transport("/api/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.sim.session}`,
        },
        body: JSON.stringify(r),
        signal: c.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        this.blockAccess(data);
        this.backoff = Math.max(
          this.backoff,
          this.now() + Math.max(1000, data.retryMs || 0),
        );
        throw new Error(data.error);
      }
      const d = responseSchema.parse(data);
      row.decision = d;
      row.elapsedMs = this.now() - started;
      this.totals.inputTokens += d.usage?.input_tokens ?? 0;
      this.totals.outputTokens += d.usage?.output_tokens ?? 0;
      if (!c.signal.aborted) {
        const n = this.sim.npcs.find((n) => n.id === r.observation.npc);
        if (
          n?.action &&
          n.actionUntil > this.sim.tick &&
          r.epoch === this.sim.epoch
        ) {
          row.status = "queued";
          this.queued.set(n.id, row);
        } else this.applyTrace(row);
      } else row.status = "cancelled";
      this.errors.delete(r.observation.npc);
    } catch (e) {
      row.elapsedMs = this.now() - started;
      row.reason = e instanceof Error ? e.message : "Decision failed";
      row.status = c.signal.aborted ? "cancelled" : "error";
      if (!c.signal.aborted) this.totals.errors++;
      if (!c.signal.aborted)
        this.errors.set(
          r.observation.npc,
          e instanceof Error ? e.message : "Decision failed",
        );
    }
  }
}
export function replay(record: Recording) {
  if (record.version !== "replay.v1" && record.version !== "replay.v2")
    throw new Error("Unsupported replay version");
  const s = new Simulation(record.seed, record.mapId ?? "woodland.v1");
  s.waveProfile = record.waveProfile ?? "legacy";
  s.combatProfile = record.combatProfile ?? "infantry.v1";
  s.projectileOriginProfile = record.projectileOriginProfile ?? "center.v1";
  s.start(
    "replay",
    record.decisions[0]?.request.session ?? "offline",
    record.missionMode ?? "mission",
    record.difficulty ?? "normal.v1",
  );
  s.progressionEnabled = record.version === "replay.v2";
  let upgradeIndex = 0;
  let decisionIndex = 0,
    epochIndex = 0;
  function applyEpochs(tick: number, throughEpoch = Infinity) {
    while (
      record.epochs[epochIndex]?.tick === tick &&
      record.epochs[epochIndex].epoch <= throughEpoch
    ) {
      s.epoch = record.epochs[epochIndex++].epoch;
      for (const n of s.npcs) {
        n.action = null;
        n.route = [];
        n.request = null;
        n.starvedAt = s.tick;
        n.nextDecision = s.tick;
      }
    }
  }
  function applyChoices(tick: number) {
    // Recovery can apply choices, then invalidate and recover again at the
    // same frozen tick. Epoch numbers preserve their ordering without inventing
    // an input step between them. Apply a checkpoint's terminal choices too.
    while (record.decisions[decisionIndex]?.tick === tick) {
      const a = record.decisions[decisionIndex++];
      applyEpochs(tick, a.request.epoch);
      const n = s.npcs.find((n) => n.id === a.request.observation.npc);
      if (n) n.sequence = a.request.sequence;
      if (!s.apply(a.request, { ...a.decision, source: "replay" }))
        throw new Error(
          `Replay decision rejected at tick ${tick}: ${s.logs.at(-1)?.reason}`,
        );
    }
    applyEpochs(tick);
  }
  for (const row of record.inputs) {
    while (record.upgrades?.[upgradeIndex]?.tick === row.tick) {
      if (!s.chooseUpgrade(record.upgrades[upgradeIndex++].choice))
        throw new Error("Invalid replay upgrade");
    }
    applyChoices(row.tick);
    if (s.tick !== row.tick) throw new Error("Replay tick divergence");
    s.step(row.input);
  }
  applyChoices(s.tick);
  while (record.upgrades?.[upgradeIndex]?.tick === s.tick) {
    if (!s.chooseUpgrade(record.upgrades[upgradeIndex++].choice))
      throw new Error("Invalid replay upgrade");
  }
  return s;
}
