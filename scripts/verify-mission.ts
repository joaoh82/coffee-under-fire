import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { replay } from "../apps/web/src/game/driver";
import type { Recording } from "../apps/web/src/game/simulation";
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label))
  throw new Error("Supply an existing mission report label");
const base = `docs/benchmarks/live-mission-${label}`;
const report = JSON.parse(await readFile(`${base}.json`, "utf8"));
const recording: Recording = JSON.parse(
  await readFile(`${base}-replay.json`, "utf8"),
);
const simulation = replay(recording);
assert.equal(simulation.time, report.simulationSeconds);
assert.equal(simulation.kills, report.kills);
assert.equal(simulation.deliveries, report.deliveries);
assert.equal(simulation.player.hp, report.health);
assert.equal(simulation.recording.decisions.length, recording.decisions.length);
if (report.termination === "won" || report.termination === "lost")
  assert.equal(simulation.status, report.termination);
const result = {
  sourceReport: `${base}.json`,
  recording: `${base}-replay.json`,
  checkedAt: new Date().toISOString(),
  outcomeMatches: true,
  simulationSeconds: simulation.time,
  health: simulation.player.hp,
  deliveries: simulation.deliveries,
  kills: simulation.kills,
  appliedChoicesReplayed: simulation.recording.decisions.length,
  recordedAppliedChoices: recording.decisions.length,
  note: "Offline execution of recorded decisions; no Jev requests. Interrupted-run UI pause state is not reconstructed.",
};
await writeFile(
  `${base}-verification.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
