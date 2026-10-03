import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  idleInput,
  type NPC,
} from "../apps/web/src/game/simulation";
import { distance } from "../apps/web/src/game/arena";
import { replay } from "../apps/web/src/game/driver";
import { chooseLocally, searchWaypoint } from "../apps/web/src/game/tactics";
import { responseSchema } from "../packages/shared/contracts";
function fixture(archetype: NPC["archetype"] = "rifleman") {
  const s = new Simulation();
  s.start("scripted", "tactics-fixture");
  // An open woodland spot with every surrounding move available.
  const n = s.addNPC("rifleman", { x: -17, z: 7 }, archetype);
  s.player.pos = { x: -11, z: 7 };
  return { s, n };
}
// Count choices over many sequence numbers so per-decision noise averages out.
function tally(s: Simulation, n: NPC, runs = 60) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const d = chooseLocally(s.request(n));
    counts[d.selected] = (counts[d.selected] ?? 0) + 1;
  }
  return counts;
}
test("local choice is a valid, deterministic decision from the legal menu", () => {
  const { s, n } = fixture();
  const r = s.request(n);
  const d = chooseLocally(r);
  responseSchema.parse(d);
  assert.equal(d.source, "local");
  assert.ok(r.candidates.some((c) => c.id === d.selected));
  assert.deepEqual(chooseLocally(r), d);
  const total = Object.values(d.probabilities!).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(s.apply(r, d));
});
test("riflemen fire at a visible player in range and reload when empty", () => {
  const { s, n } = fixture();
  assert.ok(s.visible(n));
  const armed = tally(s, n);
  // Normal fire discipline takes about half of available shots.
  assert.ok((armed.fire_player ?? 0) > 20, JSON.stringify(armed));
  n.ammo = 0;
  assert.deepEqual(tally(s, n), { reload: 60 });
});
test("without any contact NPCs search instead of holding", () => {
  const { s, n } = fixture();
  s.player.pos = { x: 20, z: 15 };
  n.lastSeen = null;
  n.lastHeard = null;
  assert.ok(!s.visible(n));
  const counts = tally(s, n);
  const moves = Object.entries(counts)
    .filter(([id]) => id.startsWith("move_") || id === "advance_contact")
    .reduce((sum, [, c]) => sum + c, 0);
  assert.ok(moves > 50, JSON.stringify(counts));
  const w = searchWaypoint(n.id, 0);
  assert.ok(Math.abs(w.x) <= 16 && Math.abs(w.z) <= 12);
});
test("marksmen back away from a player inside their minimum range", () => {
  const { s, n } = fixture("marksman");
  s.player.pos = { x: -13, z: 7 };
  const r = s.request(n);
  const d = chooseLocally(r);
  const c = r.candidates.find((c) => c.id === d.selected)!;
  assert.equal(c.kind, "move");
  if (c.kind === "move")
    assert.ok(
      distance(c.destination, s.player.pos) > distance(n.pos, s.player.pos),
    );
});
test("local mode never starves or pauses and replays identically", () => {
  const s = new Simulation(4242);
  s.start("local", "local-fixture", "endless");
  const idle = new Map<string, number>();
  let worst = 0;
  for (let i = 0; i < 180 * 60; i++) {
    if (s.status === "upgrading") s.chooseUpgrade(s.upgradeChoices[0]);
    const input = idleInput();
    const enemy = s.npcs.find((n) => n.role !== "general" && n.hp > 0);
    if (enemy) {
      input.aim = { ...enemy.pos };
      input.fire = true;
    }
    input.reload = s.player.ammo === 0;
    s.step(input);
    if (s.status === "lost") break;
    // An action can end mid-tick or stall; a replacement must follow within ticks.
    for (const n of s.npcs) {
      idle.set(n.id, n.hp > 0 && !n.action ? (idle.get(n.id) ?? 0) + 1 : 0);
      worst = Math.max(worst, idle.get(n.id)!);
    }
  }
  assert.ok(worst <= 3, `an NPC stayed idle for ${worst} ticks`);
  assert.ok(s.recording.decisions.length > 50);
  assert.ok(s.recording.decisions.every((d) => d.decision.source === "local"));
  assert.ok(s.player.hp < 100, "enemies should land shots");
  const again = replay(s.recording);
  assert.equal(again.tick, s.tick);
  assert.equal(again.kills, s.kills);
  assert.equal(again.score, s.score);
  assert.deepEqual(again.player, s.player);
});
