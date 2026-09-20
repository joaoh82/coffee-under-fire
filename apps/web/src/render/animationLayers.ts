import { AnimationClip } from "three";
export function animationLayers(clips: AnimationClip[]) {
  const layers = [...clips];
  for (const clip of clips) {
    if (clip.name === "death") continue;
    layers.push(
      new AnimationClip(
        `upper_${clip.name}`,
        clip.duration,
        clip.tracks
          .filter(
            (t) =>
              /^(arm_l|arm_r)\./.test(t.name) || t.name === "body.quaternion",
          )
          .map((t) => t.clone()),
      ),
    );
    if (clip.name === "idle" || clip.name === "run")
      layers.push(
        new AnimationClip(
          `lower_${clip.name}`,
          clip.duration,
          clip.tracks
            .filter(
              (t) =>
                !/^(arm_l|arm_r)\./.test(t.name) &&
                t.name !== "body.quaternion",
            )
            .map((t) => t.clone()),
        ),
      );
  }
  return layers;
}
