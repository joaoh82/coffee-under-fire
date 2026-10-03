import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../apps/web/src/game/simulation";
import { chooseLocally } from "../apps/web/src/game/tactics";
import { requestSchema } from "../packages/shared/contracts";
function fixture() {
  const s = new Simulation();
  s.start("scripted", "fixture");
  const n = s.addNPC("rifleman", { x: -17, z: 7 });
  return { s, n, r: s.request(n) };
}
test("observations carry perception only, never hidden player state", () => {
  const { s, n } = fixture();
  n.pos = { x: 20, z: -15 };
  s.player.pos = { x: -20, z: 15 };
  const r = s.request(n);
  assert.equal(r.observation.visible.length, 0);
  assert.deepEqual(r.observation.lastSeen?.position, { x: -17, z: 12 });
  assert.notDeepEqual(r.observation.lastSeen?.position, s.player.pos);
  assert.ok(!JSON.stringify(r).includes("warmth"));
});
test("stale, generation, epoch and illegal results rejected", () => {
  for (const variant of ["stale", "epoch", "generation", "illegal"]) {
    const { s, n, r } = fixture();
    const d = chooseLocally(r);
    if (variant === "stale") s.tick += 61;
    if (variant === "epoch") s.invalidate();
    if (variant === "generation") n.generation++;
    if (variant === "illegal") d.selected = "not_available";
    assert.equal(s.apply(r, d), false, variant);
  }
});
test("same decision cannot restart an action twice", () => {
  const { s, r } = fixture();
  const d = chooseLocally(r);
  assert.equal(s.apply(r, d), true);
  assert.equal(s.apply(r, d), false);
});
test("target death and occupied destination invalidate chosen actions", () => {
  const { s, r } = fixture();
  const d = chooseLocally(r);
  d.selected = "fire_player";
  s.player.hp = 0;
  assert.equal(s.apply(r, d), false);
  s.player.hp = 100;
  const move = r.candidates.find((c) => c.kind === "move");
  assert.ok(move && move.kind === "move");
  s.addNPC("rifleman", move.destination);
  d.selected = move.id;
  assert.equal(s.apply(r, d), false);
});
test("request contract enforces enums and finite coordinates", () => {
  const { r } = fixture();
  assert.ok(requestSchema.safeParse(r).success);
  r.observation.position.x = Infinity;
  assert.ok(!requestSchema.safeParse(r).success);
});
