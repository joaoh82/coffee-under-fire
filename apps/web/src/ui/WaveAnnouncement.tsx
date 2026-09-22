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
      <small>
        {number === 3
          ? "Scouts incoming · fast feet, close-range fire"
          : number === 4
            ? "Tanks incoming · dodge the orange aiming line"
            : number === 5
              ? "Gunners incoming · watch for rapid bursts"
              : number === 7
                ? "Marksmen incoming · watch their red aiming line"
                : "Hold the line. Keep the coffee moving."}
      </small>
    </div>
  );
}
