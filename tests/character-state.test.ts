import test from "node:test";
import assert from "node:assert/strict";
import {
  characterState,
  syncCharacterState,
} from "../apps/web/src/render/characterState";

test("restart clears old damage and animation state even when the player ID repeats", () => {
  const oldSim = {};
  const dead = { id: "player", hp: 0 };
  const state = characterState(oldSim, dead);
  Object.assign(state, {
    hitUntil: 12012,
    clip: "death",
    base: "lower_run",
    shot: 11990,
    reactionStart: 11980,
  });
  const player = { id: "player", hp: 100 };
  const fresh = syncCharacterState(state, {}, player);
  assert.notEqual(fresh, state);
  assert.equal(fresh.hp, 100);
  assert.equal(fresh.hitUntil, -1);
  assert.equal(0 < fresh.hitUntil, false);
  assert.equal(fresh.clip, "");
  assert.equal(fresh.base, "");
  assert.equal(fresh.shot, -100);
  assert.equal(fresh.reactionStart, -1);
});

test("ordinary frames preserve damage feedback; actor replacement and simulation replacement reset it", () => {
  const sim = {},
    actor = { hp: 90 };
  const state = characterState(sim, actor);
  state.hitUntil = 112;
  actor.hp = 80;
  assert.equal(syncCharacterState(state, sim, actor), state);
  assert.equal(
    state.hp,
    90,
    "preserve previous HP so the renderer detects a new hit",
  );
  assert.equal(state.hitUntil, 112);
  assert.equal(syncCharacterState(state, {}, actor).hitUntil, -1);
  assert.equal(syncCharacterState(state, sim, { hp: 100 }).hitUntil, -1);
});
