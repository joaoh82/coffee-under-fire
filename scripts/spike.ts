import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Simulation } from "../apps/web/src/game/simulation";
import { Pipeline } from "../apps/server/src/pipeline";
import { jevProvider, mockProvider } from "../apps/server/src/jev";
const live = process.argv.includes("--live");
if (live && !process.env.TYPESAFE_API_KEY)
  throw new Error("Live probe requires server-side TYPESAFE_API_KEY");
const p = new Pipeline(
  live
    ? jevProvider(
        process.env.TYPESAFE_API_KEY,
        process.env.JEV_MODEL || "jev-latest",
      )
    : mockProvider,
);
const session = p.create();
const s = new Simulation();
s.start(live ? "strict" : "mock", session);
const rows: any[] = [];
const rounds = process.argv.includes("--remaining") ? [1, 2] : [0, 1, 2];
// Hard cap: 36 calls, 12 actors, three rounds; max 4 concurrent. No automatic retries.
for (const round of rounds) {
  for (let offset = 0; offset < 12; offset += 4) {
    if (live && rows.length)
      await new Promise((resolve) => setTimeout(resolve, 1100));
    await Promise.all(
      Array.from({ length: 4 }, async (_, j) => {
        const i = offset + j;
        const n =
          s.npcs.find((n) => n.id === `probe_${i}`) ??
          s.addNPC("rifleman", {
            x: -17 + (i % 4) * 2,
            z: 7 - Math.floor(i / 4) * 2,
          });
        n.id = `probe_${i}`;
        if (round === 1) n.ammo = 0;
        if (round === 2) {
          n.ammo = 12;
          n.hp = 10;
          n.pos = { x: 16, z: -12 };
        }
        const r = s.request(n),
          start = performance.now();
        try {
          const d = await p.decide(session, r);
          rows.push({
            npc: n.id,
            round,
            elapsedMs: performance.now() - start,
            decision: d,
            observation: r.observation,
            candidates: r.candidates,
          });
        } catch (e) {
          rows.push({
            npc: n.id,
            round,
            error: e instanceof Error ? e.message : "unknown",
            elapsedMs: performance.now() - start,
          });
        }
      }),
    );
  }
}
const ok = rows.filter((r) => r.decision);
const lat = ok.map((r) => r.elapsedMs).sort((a, b) => a - b);
const total = ok.reduce((n, r) => n + (r.decision.usage?.input_tokens ?? 0), 0);
const output = ok.reduce(
  (n, r) => n + (r.decision.usage?.output_tokens ?? 0),
  0,
);
const price = process.env.JEV_INPUT_USD_PER_MILLION,
  outputPrice = process.env.JEV_OUTPUT_USD_PER_MILLION;
const report = {
  source: live ? "live-jev" : "development-fixture",
  timestamp: new Date().toISOString(),
  host: process.platform,
  submissions: rows.length,
  providerAttempts: p.totalRequests,
  requests: rows.length,
  success: ok.length,
  failed: rows.length - ok.length,
  p50Ms: lat.length ? lat[Math.floor((lat.length - 1) * 0.5)] : null,
  p95Ms: lat.length ? lat[Math.ceil((lat.length - 1) * 0.95)] : null,
  inputTokens: live ? total : null,
  outputTokens: live ? output : null,
  projectedRunInputTokens:
    live && ok.length ? (total / ok.length) * (12 * 480 + 120) : null,
  projectedRunUsd:
    live && ok.length && price && outputPrice
      ? (((total * Number(price) + output * Number(outputPrice)) / ok.length) *
          (12 * 480 + 120)) /
        1e6
      : null,
  notes: [
    "Burst probe, not a sustained 8-minute capacity test.",
    "No assumed pricing. Unknown usage/cost remains null.",
    "Fixture timings do not measure Jev.",
  ],
  rows,
};
await mkdir("docs/benchmarks", { recursive: true });
const target = `docs/benchmarks/phase0-${live ? (process.argv.includes("--remaining") ? "live-paced" : "live") : "fixture"}.json`;
await writeFile(target, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
