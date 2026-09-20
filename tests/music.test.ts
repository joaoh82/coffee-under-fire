import { test } from "node:test";
import assert from "node:assert/strict";
import { GameMusic } from "../apps/web/src/audio/GameMusic";
function fixture(play?: () => Promise<void>) {
  const track = {
    paused: true,
    loop: false,
    volume: 1,
    preload: "",
    calls: 0,
    pauses: 0,
    loads: 0,
    async play() {
      this.calls++;
      this.paused = false;
      await play?.();
    },
    pause() {
      this.paused = true;
      this.pauses++;
    },
    removeAttribute(_name: string) {},
    load() {
      this.loads++;
    },
  };
  return {
    track,
    music: new GameMusic(() => track as unknown as HTMLAudioElement),
  };
}
test("music requires a gesture, uses one quiet loop and pauses without restarting the track", async () => {
  const { track, music } = fixture();
  music.setActive(true);
  assert.equal(track.calls, 0);
  await music.unlock();
  assert.equal(track.calls, 1);
  assert.equal(track.loop, true);
  assert.equal(track.volume, 0.28);
  for (let i = 0; i < 100; i++) music.setActive(true);
  assert.equal(track.calls, 1);
  music.setActive(false);
  assert.equal(track.paused, true);
  music.setActive(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(track.calls, 2);
  music.dispose();
  music.dispose();
  assert.equal(track.loads, 1);
  await music.unlock();
  assert.equal(track.calls, 2);
});
test("music mute persists through activation and does not request playback", async () => {
  const { track, music } = fixture();
  music.toggle();
  await music.unlock();
  music.setActive(true);
  assert.equal(track.calls, 0);
  music.toggle();
  await new Promise((r) => setImmediate(r));
  assert.equal(track.calls, 1);
  music.toggle();
  assert.equal(track.paused, true);
});
test("a pending playback cannot restart music after pause or disposal", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { track, music } = fixture(() => gate);
  const started = music.unlock();
  music.setActive(false);
  release();
  await started;
  assert.equal(track.paused, true);
  music.dispose();
  music.setActive(true);
  assert.equal(track.calls, 1);
});
test("playback rejection disables retries until a new user gesture", async () => {
  const { track, music } = fixture(async () => {
    throw new Error("not allowed");
  });
  await music.unlock();
  assert.equal(music.enabled, false);
  assert.match(music.error, /could not play/);
  for (let i = 0; i < 100; i++) music.setActive(true);
  assert.equal(track.calls, 1);
});

test("an intentional playback interruption does not turn off the music preference", async () => {
  const { music } = fixture(async () => {
    throw new DOMException("Paused", "AbortError");
  });
  await music.unlock();
  assert.equal(music.enabled, true);
  assert.equal(music.error, "");
});
