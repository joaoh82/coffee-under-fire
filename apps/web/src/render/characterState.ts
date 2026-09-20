// Transient visual state belongs to one actor in one simulation, never its ID alone.
export function characterState(sim: object, actor: { hp: number }) {
  return {
    sim,
    actor,
    clip: "",
    base: "",
    hp: actor.hp,
    hitUntil: -1,
    shot: -100,
    reactionStart: -1,
  };
}

export function syncCharacterState(
  previous: ReturnType<typeof characterState>,
  sim: object,
  actor: { hp: number },
) {
  return previous.sim === sim && previous.actor === actor
    ? previous
    : characterState(sim, actor);
}
