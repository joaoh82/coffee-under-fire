import type { Simulation } from "../game/simulation";
// Original synthesized placeholder cues; no downloaded sound assets.
export class GameAudio {
  enabled = true;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private seen = 0;
  private run: Simulation | null = null;
  private voices = 0;
  private noise: AudioBuffer | null = null;
  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0.12;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 6;
        this.gain.connect(limiter);
        limiter.connect(this.context.destination);
        this.noise = this.context.createBuffer(
          1,
          Math.ceil(this.context.sampleRate * 0.8),
          this.context.sampleRate,
        );
        const samples = this.noise.getChannelData(0);
        let seed = 1729;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = (seed / 4294967296) * 2 - 1;
        }
      }
      await this.context.resume();
    } catch {
      this.enabled = false;
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.gain && this.context)
      this.gain.gain.setValueAtTime(
        this.enabled ? 0.12 : 0,
        this.context.currentTime,
      );
    if (this.enabled) void this.unlock();
  }
  update(sim: Simulation) {
    if (this.run !== sim) {
      this.run = sim;
      this.seen = 0;
    }
    const fresh = sim.events.filter((e) => e.id > this.seen);
    this.seen = sim.eventSerial;
    if (!this.enabled || this.context?.state !== "running" || !this.gain)
      return;
    const cues = {
      shot: [210, 48, 0.085],
      cannon: [95, 28, 0.32],
      tankDeath: [130, 24, 0.65],
      impact: [850, 220, 0.055],
      hit: [95, 40, 0.08],
      death: [130, 28, 0.18],
      pickup: [650, 1100, 0.1],
      coffee: [380, 650, 0.18],
      spill: [300, 90, 0.12],
      delivery: [660, 1320, 0.3],
      level: [720, 1440, 0.3],
    };
    for (const event of fresh
      .reverse()
      .sort(
        (a, b) =>
          Number(["cannon", "tankDeath"].includes(b.kind)) -
          Number(["cannon", "tankDeath"].includes(a.kind)),
      )
      .slice(0, 8)) {
      if (this.voices >= 16) break;
      const distance = event.pos
        ? Math.hypot(
            event.pos.x - sim.player.pos.x,
            event.pos.z - sim.player.pos.z,
          )
        : 0;
      if (distance > 18) continue;
      const volume =
        (event.enemy ? 0.45 : 1) * Math.max(0.1, 1 - distance / 20);
      const pan = event.pos
        ? Math.max(-0.8, Math.min(0.8, (event.pos.x - sim.player.pos.x) / 12))
        : 0;
      const [start, end, duration] = cues[event.kind];
      const ctx = this.context,
        t = ctx.currentTime;
      const osc = ctx.createOscillator(),
        envelope = ctx.createGain(),
        panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(this.gain);
      osc.type = ["shot", "hit", "death", "cannon", "tankDeath"].includes(
        event.kind,
      )
        ? "triangle"
        : "sine";
      osc.frequency.setValueAtTime(start, t);
      osc.frequency.exponentialRampToValueAtTime(end, t + duration);
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(0.45 * volume, t + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(envelope);
      envelope.connect(panner);
      this.voices++;
      osc.onended = () => {
        osc.disconnect();
        envelope.disconnect();
        panner.disconnect();
        this.voices--;
      };
      osc.start(t);
      osc.stop(t + duration + 0.01);
      // A filtered transient gives impacts texture without external samples.
      if (
        this.noise &&
        [
          "shot",
          "impact",
          "hit",
          "death",
          "coffee",
          "spill",
          "cannon",
          "tankDeath",
        ].includes(event.kind) &&
        this.voices < 16
      ) {
        const burst = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          amp = ctx.createGain();
        burst.buffer = this.noise;
        filter.type = "bandpass";
        filter.frequency.value =
          event.kind === "cannon"
            ? 240
            : event.kind === "tankDeath"
              ? 160
              : event.kind === "coffee"
                ? 2600
                : event.kind === "shot"
                  ? 1700
                  : 650;
        filter.Q.value = 0.6;
        amp.gain.setValueAtTime(
          (["cannon", "tankDeath"].includes(event.kind)
            ? 1.0
            : event.kind === "coffee"
              ? 0.1
              : event.kind === "shot"
                ? 0.5
                : 0.2) * volume,
          t,
        );
        amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
        burst.connect(filter);
        filter.connect(amp);
        amp.connect(panner);
        this.voices++;
        burst.onended = () => {
          burst.disconnect();
          filter.disconnect();
          amp.disconnect();
          this.voices--;
        };
        burst.start(t);
        burst.stop(t + duration);
      }
    }
  }
  dispose() {
    // React development cleanup can run more than once for the same instance.
    const context = this.context;
    this.context = null;
    this.gain = null;
    this.noise = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }
}
