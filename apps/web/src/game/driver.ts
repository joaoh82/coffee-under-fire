import { mapPreset, type MapId } from "./maps";
import type { Difficulty } from "./difficulty";
import type {
  DecisionRequest,
  Decision,
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
  decision: Decision;
  status: "applied" | "rejected";
  reason?: string;
  applicationTick: number;
};
// Server access codes that stop play until the player returns to the briefing.
const BLOCKING_ACCESS_CODES = [
  "ip_session_limit",
  "public_closed",
  "public_unavailable",
  "network_changed",
];
export class Driver {
  // Invoke the browser API in its own context, not as a method of Driver.
  constructor(
    private transport: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  sim = new Simulation();
  renderStats: { fps: number; frameMs: number } | null = null;
  input: Input = idleInput();
  autoReload = true;
  autoFire = false;
  touchAim: { x: number; z: number } | null = null;
  inspectedNpcId: string | null = null;
  traces: TraceRow[] = [];
  traceSerial = 0;
  totals = { applied: 0, rejected: 0 };
  accumulator = 0;
  disposed = false;
  accessBlock: { code: string; message: string } | null = null;
  private blockAccess(data: { error?: string; message?: string }) {
    if (!data.error || !BLOCKING_ACCESS_CODES.includes(data.error)) return;
    this.endPlay(
      data.error,
      data.message || "Guest play is temporarily unavailable.",
    );
  }
  private endPlay(code: string, message: string) {
    this.accessBlock = { code, message };
    this.sim.pause();
    this.input = idleInput();
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
        if (!terminal && !this.accessBlock)
          this.endPlay(
            "session_ended",
            "Your game session ended. Return to the briefing or sign in again.",
          );
      }
    } catch {
      /* The lease expires server-side if connectivity is lost. */
    } finally {
      this.heartbeatBusy = false;
    }
  }
  async start(
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
    if (this.sim.mapId !== mapId)
      this.sim = new Simulation(this.sim.seed, mapId);
    clearInterval(this.heartbeatTimer);
    if (data.heartbeat)
      this.heartbeatTimer = setInterval(() => void this.heartbeat(), 10_000);
    this.sim.onLocalDecision = (request, decision, applied) => {
      this.traces.push({
        id: ++this.traceSerial,
        request,
        decision,
        status: applied ? "applied" : "rejected",
        reason: applied ? undefined : this.sim.logs.at(-1)?.reason,
        applicationTick: this.sim.tick,
      });
      if (this.traces.length > 200) this.traces.shift();
      if (applied) this.totals.applied++;
      else this.totals.rejected++;
    };
    this.sim.start("local", data.session, missionMode, difficulty);
  }
  async submitScore(name: string) {
    if (
      !["won", "lost"].includes(this.sim.status) ||
      this.sim.recording.mode !== "local"
    )
      throw new Error("Only completed hosted runs can enter the leaderboard.");
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
  pause() {
    this.sim.pause();
    this.input = idleInput();
  }
  resume() {
    if (this.accessBlock || this.disposed) return;
    this.sim.resume();
  }
  async dispose() {
    this.disposed = true;
    clearInterval(this.heartbeatTimer);
    if (this.sim.session !== "offline")
      await this.transport("/api/session", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.sim.session}` },
      });
  }
  update(delta: number) {
    if (this.disposed || this.sim.status !== "running") {
      this.accumulator = 0;
      return;
    }
    this.accumulator = Math.min(this.accumulator + delta, 0.1);
    while (this.accumulator >= DT && this.sim.status === "running") {
      this.sim.step({
        ...this.input,
        fire: this.input.fire || this.autoFire,
        reload:
          this.input.reload || (this.autoReload && this.sim.player.ammo === 0),
      });
      this.accumulator -= DT;
    }
  }
}
export function replay(record: Recording) {
  if (record.version !== "replay.v1" && record.version !== "replay.v2")
    throw new Error("Unsupported replay version");
  const s = new Simulation(record.seed, record.mapId ?? "woodland.v1");
  s.rosterProfile = record.rosterProfile ?? "legacy";
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
