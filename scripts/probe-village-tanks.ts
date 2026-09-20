// Bounded live integration probe: three decisions; synthetic positions, real Jev responses.
import { writeFile } from "node:fs/promises";
import { Simulation } from "../apps/web/src/game/simulation";
import { requestSchema, responseSchema } from "../packages/shared/contracts";
import { DIFFICULTIES, type Difficulty } from "../apps/web/src/game/difficulty";
const base = "http://127.0.0.1:8787";
const sessionResponse = await fetch(base + "/api/session", {
  method: "POST",
  signal: AbortSignal.timeout(10000),
});
if (!sessionResponse.ok) throw new Error("Session failed");
const session = await sessionResponse.json();
if (session.mode !== "strict")
  throw new Error("This probe requires live strict mode");
const rows = [];
try {
  let generation = 0;
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    const s = new Simulation(7341, "village.v1");
    s.start("strict", session.session, "mission", difficulty);
    s.player.pos = { x: 0, z: -8 };
    const tank = s.addNPC("tank", { x: 0, z: -4 });
    tank.id = `probe_tank_${++generation}`;
    const request = requestSchema.parse(s.request(tank));
    const start = performance.now();
    const response = await fetch(base + "/api/decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) {
      rows.push({
        difficulty,
        hp: tank.hp,
        status: response.status,
        error: data.error,
      });
      continue;
    }
    const decision = responseSchema.parse(data);
    const applied = s.apply(request, decision);
    rows.push({
      difficulty,
      hp: request.observation.hp,
      maxHp: request.observation.maxHp,
      source: decision.source,
      selected: decision.selected,
      applied,
      latencyMs: decision.latencyMs,
      roundTripMs: performance.now() - start,
      usage: decision.usage,
      model: decision.model,
    });
  }
} finally {
  await fetch(base + "/api/session", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.session}` },
    signal: AbortSignal.timeout(10000),
  });
}
const report = {
  kind: "synthetic village tank observations; real bounded live Jev probe",
  mapId: "village.v1",
  combatProfile: "armor.v2",
  requests: 3,
  rows,
  cost: null,
};
await writeFile(
  "docs/benchmarks/village-tank-probe.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (rows.some((r) => !("applied" in r) || !r.applied)) process.exitCode = 1;
