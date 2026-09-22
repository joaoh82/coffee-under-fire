import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../apps/web/src/game/simulation";
import { bodyFor } from "../apps/server/src/jev";
import { envelope } from "../packages/shared/contracts";
import { specialistAppearance } from "../apps/web/src/render/infantryAppearance";

test("specialist Jev requests expose combat limits and complete legal choices", () => {
  for (const archetype of ["scout", "gunner", "marksman"] as const) {
    const simulation = new Simulation();
    simulation.start("mock", "provider-fixture");
    const npc = simulation.addNPC("rifleman", { x: 0, z: 0 }, archetype);
    const request = simulation.request(npc);
    const body = bodyFor(request, "fixture-model");
    assert.equal(body.state.archetype, archetype);
    assert.ok(body.state.combat);
    assert.match(body.questions.tactic.instructions, new RegExp(archetype));
    assert.match(
      body.questions.tactic.instructions,
      /ONE complete legal candidate/,
    );
    assert.deepEqual(
      Object.values(body.questions.tactic.criteria),
      request.candidates.map((candidate) => JSON.stringify(candidate)),
    );
    assert.equal(envelope(request).config, "tactics.v5");
    assert.equal(
      specialistAppearance(archetype, npc.id),
      `rifleman_${archetype}`,
    );
  }
});
