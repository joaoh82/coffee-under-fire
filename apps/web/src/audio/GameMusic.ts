// Separate from effects: no autoplay before a user gesture, one looping source.
export class GameMusic {
  enabled = true;
  error = "";
  private track: HTMLAudioElement | null = null;
  private unlocked = false;
  private active = false;
  private pending = false;
  private disposed = false;
  constructor(
    private create: () => HTMLAudioElement = () =>
      new Audio("/assets/audio/coffee-patrol-v2.wav"),
  ) {}
  async unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    this.active = true;
    await this.play();
  }
  private async play() {
    if (
      !this.enabled ||
      !this.unlocked ||
      !this.active ||
      this.disposed ||
      this.pending
    )
      return;
    if (!this.track) {
      this.track = this.create();
      this.track.loop = true;
      this.track.volume = 0.28;
      this.track.preload = "auto";
    }
    if (!this.track.paused) return;
    this.pending = true;
    try {
      await this.track.play();
      this.error = "";
      if (!this.active || !this.enabled || this.disposed) this.track?.pause();
    } catch (error) {
      // pause() can interrupt an in-flight play() during reconnect or tab blur.
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (this.active && this.enabled && !this.disposed) {
        this.enabled = false;
        this.error = "Music could not play. Toggle music to try again.";
      }
    } finally {
      this.pending = false;
    }
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      if (this.track && !this.track.paused) this.track.pause();
    } else void this.play();
  }
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.track?.pause();
    else {
      this.unlocked = true;
      void this.play();
    }
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.track?.pause();
    if (this.track) {
      this.track.removeAttribute("src");
      this.track.load();
    }
    this.track = null;
  }
}
