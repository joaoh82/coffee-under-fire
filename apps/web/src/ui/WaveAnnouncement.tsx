import "./wave-announcement.css";
import { waveAnnouncement } from "./wave-notice";
export function WaveAnnouncement({
  wave,
  time,
  running,
}: {
  wave: number;
  time: number;
  running: boolean;
}) {
  const number = waveAnnouncement(wave, time, running);
  return number === null ? null : (
    <div
      key={number}
      className="wave-announcement"
      role="status"
      aria-live="polite"
    >
      <span>INCOMING</span>
      <strong>WAVE {number}</strong>
      <small>Hold the line. Keep the coffee moving.</small>
    </div>
  );
}
