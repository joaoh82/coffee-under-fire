import { useEffect, useState } from "react";
import { SupportCallout } from "./SupportCallout";
export function AccessBudgetNotice({
  block,
  score,
  onLeave,
  onSave,
}: {
  block: { code: string; message: string; resetAt?: number };
  score: number;
  onLeave: () => void;
  onSave: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil(((block.resetAt ?? now) - now) / 1000));
  const countdown = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
  return (
    <div
      className="overlay"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-title"
    >
      <section className="brief compact">
        <h1 id="budget-title">
          {block.code === "daily_budget_exhausted"
            ? "The coffee fund is empty for today."
            : "A break between coffee runs."}
        </h1>
        <p>{block.message}</p>
        {block.resetAt && (
          <p>
            Daily allowance resets{" "}
            {seconds
              ? `in ${countdown}`
              : "now — return to the briefing to try again"}
            .
          </p>
        )}
        <p>
          Your battlefield is paused. Score: <strong>{score}</strong>.
        </p>
        <button onClick={onLeave} autoFocus>
          Return to briefing
        </button>
        <button onClick={onSave}>Save decision replay</button>
        <SupportCallout />
        <small>
          Donations are optional and do not automatically unlock more play time.
        </small>
      </section>
    </div>
  );
}
