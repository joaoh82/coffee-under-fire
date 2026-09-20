import { mapPreset, type MapId } from "../apps/web/src/game/maps";
import {
  difficultyPreset,
  type Difficulty,
} from "../apps/web/src/game/difficulty";
import { writeFile } from "node:fs/promises";
import { Driver } from "../apps/web/src/game/driver";
import { idleInput } from "../apps/web/src/game/simulation";
import { distance } from "../apps/web/src/game/arena";
// Scripted human controls; all NPC choices remain real Jev responses. No invulnerability.
let sentDecisions = 0;
const driver = new Driver((input, init) => {
  if (String(input) === "/api/decision") {
    if (sentDecisions >= requestBudget)
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: "measurement_budget", retryMs: 1000 }),
          { status: 503 },
        ),
      );
    sentDecisions++;
  }
  return fetch(new URL(String(input), "http://127.0.0.1:8787"), init);
});
const label = process.argv[2] ?? "art-pass";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid report label");
const requestBudget = Number(process.argv[3] ?? 700);
if (
  !Number.isInteger(requestBudget) ||
  requestBudget < 1 ||
  requestBudget > 6000
)
  throw new Error("Request budget must be 1–6000");
const started = performance.now();
let peakTanks = 0;
let peakEnemies = 0,
  progressMinute = -1;
const tankShots = new Set<string>();
let peakInfantry = 0;
const rows: any[] = [];
const pauseSnapshots: unknown[] = [];
const seen = new Set<number>();
let pauses = 0,
  pauseMs = 0,
  retryFailures = 0,
  reason = "";
let route: { x: number; z: number }[] = [],
  goal = "";
function captureRows() {
  for (const row of driver.traces.filter(
    (r) => !seen.has(r.id) && r.status !== "pending" && r.status !== "queued",
  )) {
    rows.push({
      id: row.id,
      npc: row.request.observation.npc,
      role: row.request.observation.role,
      status: row.status,
      reason: row.reason,
      latencyMs: row.decision?.latencyMs,
      source: row.decision?.source,
      selected: row.decision?.selected,
      usage: row.decision?.usage,
    });
    seen.add(row.id);
  }
}
const mapId = (process.argv[4] ?? "woodland.v1") as MapId;
const difficulty = (process.argv[5] ?? "normal.v1") as Difficulty;
mapPreset(mapId);
difficultyPreset(difficulty);
await driver.start("strict", "mission", difficulty, mapId);
if (driver.sim.mode !== "strict")
  throw new Error("Live measurement refuses mock server");
try {
  let previous = performance.now();
  while (
    performance.now() - started < 600000 &&
    driver.totals.requested < requestBudget
  ) {
    const s = driver.sim;
    peakEnemies = Math.max(
      peakEnemies,
      s.npcs.filter((n) => n.role !== "general").length,
    );
    for (const n of s.npcs)
      if (n.role === "tank" && n.shotAt >= 0)
        tankShots.add(`${n.id}:${n.shotAt}`);
    if (Math.floor(s.time / 60) !== progressMinute) {
      progressMinute = Math.floor(s.time / 60);
      console.log(
        JSON.stringify({
          simulationSeconds: s.time,
          requested: driver.totals.requested,
          health: s.player.hp,
          deliveries: s.deliveries,
          peakEnemies,
          peakTanks,
          tankShots: tankShots.size,
        }),
      );
    }
    peakTanks = Math.max(
      peakTanks,
      s.npcs.filter((n) => n.role === "tank").length,
    );
    peakInfantry = Math.max(
      peakInfantry,
      s.npcs.filter((n) => n.role === "rifleman").length,
    );
    if (s.status === "won" || s.status === "lost") {
      reason = s.status;
      break;
    }
    if (s.status === "upgrading") s.chooseUpgrade(s.upgradeChoices[0]);
    if (s.status === "reconnecting") {
      pauses++;
      if (pauseSnapshots.length < 30)
        pauseSnapshots.push(structuredClone(s.lastStarvation));
      const pauseStart = performance.now();
      await new Promise((r) => setTimeout(r, 1200));
      await driver.retry();
      pauseMs += performance.now() - pauseStart;
      if (s.status === "reconnecting" && ++retryFailures >= 5) {
        reason = "five_recovery_failures";
        break;
      }
      previous = performance.now();
    }
    const input = idleInput();
    const target = s.cup ? s.tent : s.arena.kitchen;
    const nextGoal = s.cup ? "tent" : "kitchen";
    if (nextGoal !== goal) {
      route = s.path(s.player.pos, target);
      goal = nextGoal;
    }
    if (distance(s.player.pos, target) < 1.7) input.interact = true;
    else {
      while (route.length && distance(s.player.pos, route[0]) < 0.16)
        route.shift();
      const next = route[0];
      if (next) {
        const d = distance(s.player.pos, next);
        input.x = (next.x - s.player.pos.x) / d;
        input.z = (next.z - s.player.pos.z) / d;
      }
    }
    const enemy = s.npcs
      .filter(
        (n) =>
          n.role !== "general" &&
          distance(n.pos, s.player.pos) < 14 &&
          s.sight(n.pos, s.player.pos),
      )
      .sort(
        (a, b) => distance(a.pos, s.player.pos) - distance(b.pos, s.player.pos),
      )[0];
    if (enemy) {
      input.aim = { ...enemy.pos };
      input.fire = true;
    }
    input.dodge = s.bullets.some(
      (b) => b.owner !== "player" && distance(b.pos, s.player.pos) < 2,
    );
    driver.input = input;
    const now = performance.now();
    driver.update((now - previous) / 1000);
    previous = now;
    captureRows();
    await new Promise((r) => setTimeout(r, 16));
  }
} finally {
  driver.cancel();
  await driver.dispose();
  captureRows();
  const lat = rows
    .filter((r) => r.source === "jev")
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);
  const report = {
    timestamp: new Date().toISOString(),
    kind: "live-jev-scripted-player",
    note: `Synthetic player test, not human playthrough; same health, collision, coffee and combat rules. Hard limit ${requestBudget} decision requests sent to the backend / 10 minutes wall time.`,
    requestBudget,
    sentDecisions,
    combatProfile: driver.sim.combatProfile,
    peakTanks,
    peakEnemies,
    tankShots: tankShots.size,
    termination: reason || "measurement_budget",
    simulationSeconds: driver.sim.time,
    wallSeconds: (performance.now() - started) / 1000,
    waveProfile: driver.sim.waveProfile,
    peakInfantry,
    deliveries: driver.sim.deliveries,
    kills: driver.sim.kills,
    health: driver.sim.player.hp,
    pauses,
    pauseMs,
    pauseSnapshots,
    retryFailures,
    totals: driver.totals,
    p50Ms: lat[Math.floor((lat.length - 1) * 0.5)] ?? null,
    p95Ms: lat[Math.ceil((lat.length - 1) * 0.95)] ?? null,
    costUsd: null,
    rows,
  };
  await writeFile(
    `docs/benchmarks/live-mission-${label}.json`,
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    `docs/benchmarks/live-mission-${label}-replay.json`,
    JSON.stringify(driver.sim.recording),
  );
  console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
}
