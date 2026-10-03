import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../apps/web/src/game/simulation";
import { chooseLocally } from "../apps/web/src/game/tactics";
import { envelope } from "../packages/shared/contracts";
import { specialistAppearance } from "../apps/web/src/render/infantryAppearance";

test("specialist requests expose combat limits and local tactics choose legally", () => {
  for (const archetype of ["scout", "gunner", "marksman"] as const) {
    const simulation = new Simulation();
    simulation.start("scripted", "provider-fixture");
    const npc = simulation.addNPC("rifleman", { x: 0, z: 0 }, archetype);
    const request = simulation.request(npc);
    assert.equal(request.observation.archetype, archetype);
    assert.ok(request.observation.combat);
    const decision = chooseLocally(request);
    assert.ok(request.candidates.some((c) => c.id === decision.selected));
    assert.deepEqual(
      Object.keys(decision.probabilities!),
      request.candidates.map((candidate) => candidate.id),
    );
    assert.equal(envelope(request).config, "tactics.v5");
    assert.equal(
      specialistAppearance(archetype, npc.id),
      `rifleman_${archetype}`,
    );
  }
});
