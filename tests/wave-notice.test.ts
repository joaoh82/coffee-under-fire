import test from "node:test";
import assert from "node:assert/strict";
import { waveAnnouncement } from "../apps/web/src/ui/wave-notice";
test("wave announcements follow wave boundaries, pauses and restart", () => {
  assert.equal(waveAnnouncement(0, 0, true), 1);
  assert.equal(waveAnnouncement(0, 2.59, true), 1);
  assert.equal(waveAnnouncement(0, 2.6, true), null);
  assert.equal(waveAnnouncement(1, 60, true), 2);
  assert.equal(waveAnnouncement(2, 120.1, true), 3);
  assert.equal(waveAnnouncement(2, 120.1, false), null);
  assert.equal(waveAnnouncement(2, 125, true), null);
  assert.equal(waveAnnouncement(0, 0, true), 1);
});
